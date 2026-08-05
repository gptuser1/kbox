import { Hono } from 'hono';
import { createDb, DbError } from '../db';
import { createKv } from '../kv';
import { crawlAll } from './news-crawler';
import { summarizeArticles, extractKeywordsViaLLM, dedupeArticlesByLLM, type KeywordStat } from './news-llm';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const KEEP_LIMIT = 60;
const NS_KEYWORDS = 'news_top_keywords';
const KEYWORDS_KEY = 'latest';

// ─── 自动建表 ───
let tableReady = false;
let tableInitError: string | null = null;

async function ensureTable(token: string, base?: string): Promise<boolean> {
  if (tableReady) return true;
  if (tableInitError) return false;

  const db = createDb(token, base);
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS newsfeed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crawled_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general'
    )`);
    tableReady = true;
    return true;
  } catch (e) {
    const msg = e instanceof DbError ? e.message : '建表失败';
    tableInitError = msg;
    console.error('News table init error:', msg);
    return false;
  }
}

function getDb(c: any) {
  return createDb(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function getKv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function tableError(c: any) {
  return c.json({ error: tableInitError || '数据库初始化失败，请检查 D1_API_TOKEN' }, 503);
}

function nowISO(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
}

// ─── 抓取 + AI 锐评 + 入库 ───
export async function runCron(env: any): Promise<{ success: boolean; articles_count: number; error?: string }> {
  if (!await ensureTable(env.D1_API_TOKEN, env.D1_API_BASE)) {
    return { success: false, articles_count: 0, error: tableInitError || '建表失败' };
  }
  const db = createDb(env.D1_API_TOKEN, env.D1_API_BASE);

  try {
    const now = nowISO();
    const articles = await crawlAll(env);

    if (articles.length === 0) {
      return { success: true, articles_count: 0, error: 'No articles crawled' };
    }

    // ─── 去重 ───
    const existingRows = await db.queryAll<{ source: string; title: string }>(
      `SELECT DISTINCT source, title FROM newsfeed`
    );
    const existing = new Set<string>();
    for (const row of existingRows) {
      existing.add(`${row.source}||${row.title}`);
    }

    const seen = new Set<string>();
    const unique = articles.filter((a) => {
      const key = `${a.source}||${a.title}`;
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      return { success: true, articles_count: 0, error: 'All articles already exist' };
    }

    const deduped = await dedupeArticlesByLLM(env, unique);

    if (deduped.length === 0) {
      return { success: true, articles_count: 0, error: 'All articles deduped' };
    }

    const summaries = await summarizeArticles(
      env,
      deduped.map((a) => ({ title: a.title, source: a.source })),
    );

    // 分块插入
    const CHUNK_SIZE = 15;
    for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, deduped.length);
      const placeholders: string[] = [];
      const values: any[] = [];
      for (let j = i; j < chunkEnd; j++) {
        placeholders.push('(?, ?, ?, ?, ?, ?)');
        const a = deduped[j];
        values.push(now, a.source, a.title, a.url, summaries[j] || '', a.category);
      }
      await db.execute(
        `INSERT INTO newsfeed (crawled_at, source, title, url, summary, category) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    // 清理旧记录，只保留最新 KEEP_LIMIT 条
    await db.execute(
      `DELETE FROM newsfeed WHERE id NOT IN (
        SELECT id FROM newsfeed ORDER BY id DESC LIMIT ?
      )`,
      [KEEP_LIMIT],
    );

    return { success: true, articles_count: deduped.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('News cron failed:', msg);
    return { success: false, articles_count: 0, error: msg };
  }
}

// ─── 生成 Top 10 关键词快照 ───
export async function generateTopKeywords(env: any): Promise<{ success: boolean; generated_at: string | null; count: number; error?: string }> {
  if (!await ensureTable(env.D1_API_TOKEN, env.D1_API_BASE)) {
    return { success: false, generated_at: null, count: 0, error: tableInitError || '建表失败' };
  }
  const db = createDb(env.D1_API_TOKEN, env.D1_API_BASE);
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);

  try {
    const allRows = await db.queryAll<{ title: string; source: string; url: string; summary: string; category: string; crawled_at: string }>(
      `SELECT title, source, url, summary, category, crawled_at FROM newsfeed ORDER BY id DESC LIMIT ?`,
      [KEEP_LIMIT],
    );
    if (allRows.length === 0) {
      return { success: false, generated_at: null, count: 0, error: '暂无新闻数据，请先抓取' };
    }

    const topKeywords = await extractKeywordsViaLLM(env, allRows, 10);
    if (topKeywords.length === 0) {
      return { success: false, generated_at: null, count: 0, error: 'LLM 提取失败，请检查 OPENAI 配置后重试' };
    }

    const now = nowISO();
    await kv.set(NS_KEYWORDS, KEYWORDS_KEY, { generated_at: now, keywords: topKeywords });

    return { success: true, generated_at: now, count: topKeywords.length };
  } catch (e) {
    const kvErr = kv.error();
    if (kvErr) {
      return { success: false, generated_at: null, count: 0, error: kvErr };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Top keywords generation failed:', msg);
    return { success: false, generated_at: null, count: 0, error: msg };
  }
}

// ─── 路由 ───

// 获取最新新闻列表（默认 30 条）
app.get('/list', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    const limit = Math.min(Number(c.req.query('limit')) || 30, 100);
    const items = await db.queryAll(
      `SELECT * FROM newsfeed ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    return c.json({ results: items, count: items.length });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '获取列表失败' }, 500);
  }
});

// 手动触发抓取
app.post('/trigger', async (c) => {
  const result = await runCron(c.env);
  return c.json(result, result.success ? 200 : 500);
});

// 手动触发 Top 10 关键词生成
app.post('/top/refresh', async (c) => {
  const result = await generateTopKeywords(c.env);
  return c.json(result, result.success ? 200 : 500);
});

// 获取 Top 10 关键词
app.get('/top', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const kv = getKv(c);
  try {
    const latest = await kv.get<{ generated_at: string; keywords: KeywordStat[] }>(NS_KEYWORDS, KEYWORDS_KEY);
    if (!latest) {
      return c.json({ generated_at: null, keywords: [] });
    }
    return c.json({ generated_at: latest.generated_at, keywords: latest.keywords });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '获取 Top 关键词失败' }, 500);
  }
});

// 删除单条
app.delete('/items/:id', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    await db.execute(
      `DELETE FROM newsfeed WHERE id = ?`,
      [Number(c.req.param('id'))]
    );
    return c.json({ ok: true, message: '删除成功' });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '删除失败' }, 500);
  }
});

// ─── 供 JS Runner / kbox 对象内部直调的读函数 ───
// 这些函数不走 HTTP，直接复用内部逻辑，避免 token 透传与子请求消耗

export async function listNews(env: any, limit = 30): Promise<any[]> {
  if (!await ensureTable(env.D1_API_TOKEN, env.D1_API_BASE)) return [];
  const db = createDb(env.D1_API_TOKEN, env.D1_API_BASE);
  try {
    return await db.queryAll(
      `SELECT * FROM newsfeed ORDER BY id DESC LIMIT ?`,
      [Math.min(limit, 100)]
    );
  } catch { return []; }
}

export async function getTopKeywords(env: any): Promise<{ generated_at: string | null; keywords: any[] }> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  try {
    const latest = await kv.get<{ generated_at: string; keywords: any[] }>(NS_KEYWORDS, KEYWORDS_KEY);
    return latest || { generated_at: null, keywords: [] };
  } catch { return { generated_at: null, keywords: [] }; }
}

export default app;
