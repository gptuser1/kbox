import { Hono } from 'hono';
import { createDb, DbError } from '../db';
import { createKv, getKvTableError } from '../kv';
import { crawlAll } from './news-crawler';
import { summarizeArticles } from './news-llm';
import { extractTopKeywords, type KeywordStat } from './news-keywords';

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
// Top 关键词快照存于通用 KV 表：namespace='news_top_keywords', key=时间戳字符串
// 仅保留最近 5 份快照（list 后按 key DESC 取前 5，多余删除）
const NS_KEYWORDS = 'news_top_keywords';
const KEYWORDS_KEEP = 5;

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
    // Top 关键词快照已迁移到通用 KV 表（namespace='news_top_keywords'），此处不再单独建表
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

// 北京时间 ISO（原 now-u-know 用 ISO，这里保持一致）
function nowISO(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
}

// ─── 抓取 + AI 锐评 + 入库（核心逻辑） ───
async function runCron(c: any): Promise<{ success: boolean; articles_count: number; error?: string }> {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) {
    return { success: false, articles_count: 0, error: tableInitError || '建表失败' };
  }
  const db = getDb(c);

  try {
    const now = nowISO();
    const articles = await crawlAll();

    if (articles.length === 0) {
      return { success: true, articles_count: 0, error: 'No articles crawled' };
    }

    // 去重：跳过已存在记录（source + title 相同）
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

    const summaries = await summarizeArticles(
      c.env,
      unique.map((a) => ({ title: a.title, source: a.source })),
    );

    // 分块插入（15 条一批，避免单 SQL 过长）
    const CHUNK_SIZE = 15;
    for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, unique.length);
      const placeholders: string[] = [];
      const values: any[] = [];
      for (let j = i; j < chunkEnd; j++) {
        placeholders.push('(?, ?, ?, ?, ?, ?)');
        const a = unique[j];
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

    // 生成 Top 10 关键词快照（基于当前库内全部新闻），存入通用 KV 表
    try {
      const allRows = await db.queryAll<{ title: string; source: string; url: string; summary: string; category: string; crawled_at: string }>(
        `SELECT title, source, url, summary, category, crawled_at FROM newsfeed ORDER BY id DESC LIMIT ?`,
        [KEEP_LIMIT],
      );
      const topKeywords = extractTopKeywords(allRows, 10);
      const kv = getKv(c);
      // key 用毫秒时间戳，list 按 key DESC 即可拿到最新
      const key = String(Date.now());
      await kv.set(NS_KEYWORDS, key, { generated_at: now, keywords: topKeywords });
      // 只保留最近 5 份快照：按 key 降序，超出部分删除
      const all = await kv.list<{ generated_at: string; keywords: KeywordStat[] }>(NS_KEYWORDS);
      all.sort((a, b) => (a.key > b.key ? -1 : 1));
      for (const item of all.slice(KEYWORDS_KEEP)) {
        await kv.delete(NS_KEYWORDS, item.key);
      }
    } catch (e) {
      // 关键词统计失败不影响主流程
      console.error('Top keywords generation failed:', e instanceof Error ? e.message : String(e));
    }

    return { success: true, articles_count: unique.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('News cron failed:', msg);
    return { success: false, articles_count: 0, error: msg };
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
  const result = await runCron(c);
  return c.json(result, result.success ? 200 : 500);
});

// 获取 Top 10 关键词（最近一次抓取生成的快照，存于通用 KV 表）
app.get('/top', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const kv = getKv(c);
  try {
    const all = await kv.list<{ generated_at: string; keywords: KeywordStat[] }>(NS_KEYWORDS);
    if (all.length === 0) {
      return c.json({ generated_at: null, keywords: [] });
    }
    // 按 key 降序取最新一份
    all.sort((a, b) => (a.key > b.key ? -1 : 1));
    const latest = all[0].value;
    return c.json({ generated_at: latest.generated_at, keywords: latest.keywords });
  } catch (e) {
    if (getKvTableError()) return c.json({ error: getKvTableError() }, 503);
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

export default app;
