import { Hono } from 'hono';
import { createKv } from '../../services/kv';
import { listNews, getTopKeywords } from '../news/backend';
import { listFunds } from '../stock/backend';
import { listDiskFiles, getDiskStats } from '../disk/backend';
import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const NS_SCRIPTS = 'js_scripts';
const RUN_TIMEOUT_MS = 5000;
const MAX_LOG_BYTES = 100 * 1024;

// 系统 namespace 黑名单：脚本禁止写入（保护配置/系统数据）
const WRITE_BLACKLIST = [
  'app', 'preferences', 'dispatch_configs', 'db_admin_connections',
  'js_scripts', 'disk_tokens', 'news_top_keywords', 'stock_funds', 'cron_tasks',
];
export function isWriteForbidden(ns: string): boolean {
  if (WRITE_BLACKLIST.includes(ns)) return true;
  if (ns.startsWith('plugin:')) return true;
  return false;
}

interface JsScript {
  id: string;
  name: string;
  desc: string;
  code: string;
  icon: string;
  published: boolean;
  created_at: number;
  updated_at: number;
  last_run?: { at: number; status: 'ok' | 'error'; error?: string };
}

interface RunResult {
  logs: string[];
  result?: any;
  error?: { message: string; stack?: string };
  truncated?: boolean;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowUnix(): number {
  return Date.now();
}

function getKv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

// ─── kbox 对象构造 ───
function buildKbox(env: any, logs: string[]): any {
  const log = (...args: any[]) => {
    const line = args.map(a => {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
    logs.push(line);
  };

  // 超时 Promise
  const timeout = (ms: number) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('执行超时（' + (ms / 1000) + 's）')), ms)
  );

  const kbox = {
    log,
    now: () => Date.now(),
    sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
    fetch: (url: string, opts?: any) => fetch(url, opts),

    kv: {
      get: async (ns: string, key: string) => {
        const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
        return await kv.getJson(ns, key);
      },
      set: async (ns: string, key: string, value: any) => {
        if (isWriteForbidden(ns)) throw new Error('禁止写入系统 namespace: ' + ns);
        const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
        await kv.set(ns, key, value);
      },
      delete: async (ns: string, key: string) => {
        if (isWriteForbidden(ns)) throw new Error('禁止写入系统 namespace: ' + ns);
        const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
        await kv.delete(ns, key);
      },
      list: async (ns: string) => {
        const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
        return await kv.list(ns);
      },
    },

    news: {
      list: (limit?: number) => listNews(env, limit),
      top: () => getTopKeywords(env),
    },
    stock: {
      funds: () => listFunds(env),
    },
    disk: {
      files: () => listDiskFiles(env),
      stats: () => getDiskStats(env),
    },
  };
  return kbox;
}

// ─── 执行引擎 ───

export async function executeScript(env: any, code: string, params: Record<string, any> = {}): Promise<RunResult> {
  const logs: string[] = [];
  const started = Date.now();
  const kbox = buildKbox(env, logs);

  // 重定向 console
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  console.log = (...a) => logs.push(a.map(String).join(' '));
  console.error = (...a) => logs.push('[error] ' + a.map(String).join(' '));
  console.warn = (...a) => logs.push('[warn] ' + a.map(String).join(' '));

  const paramNames = Object.keys(params);
  const wrapped = `
    const { log, fetch, kv, news, stock, disk, now, sleep } = kbox;
    const console = { log, info: log, warn: log, error: log, debug: log };
    const { ${paramNames.join(', ')} } = params;
    return (async () => {
      ${code}
    })();
  `;

  try {
    const fn = new Function('kbox', 'params', wrapped);
    const resultPromise = fn(kbox, params);
    const result = await Promise.race([
      resultPromise,
      timeout(RUN_TIMEOUT_MS),
    ]);
    const totalBytes = logs.join('\n').length;
    return {
      logs,
      result: result === undefined ? null : result,
      truncated: totalBytes > MAX_LOG_BYTES,
    };
  } catch (e) {
    const totalBytes = logs.join('\n').length;
    return {
      logs,
      error: {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
      truncated: totalBytes > MAX_LOG_BYTES,
    };
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
  }
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('执行超时（' + (ms / 1000) + 's）')), ms));
}

// ─── 脚本 CRUD ───

// 列出所有脚本
app.get('/scripts', async (c) => {
  const kv = getKv(c);
  try {
    const items = await kv.list<JsScript>(NS_SCRIPTS);
    const scripts = items.map(i => ({ ...i.value, id: i.key }))
      .sort((a, b) => b.created_at - a.created_at);
    return c.json({ scripts });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '获取脚本失败' }, 500);
  }
});

// 列出已发布脚本（供首页卡片）
app.get('/published', async (c) => {
  const kv = getKv(c);
  try {
    const items = await kv.list<JsScript>(NS_SCRIPTS);
    const published = items
      .map(i => ({ ...i.value, id: i.key }))
      .filter(s => s.published)
      .sort((a, b) => b.created_at - a.created_at);
    return c.json({ scripts: published });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '获取发布脚本失败' }, 500);
  }
});

// 新建脚本
app.post('/scripts', async (c) => {
  const kv = getKv(c);
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  const id = genId();
  const now = nowUnix();
  const script: JsScript = {
    id,
    name: (body.name || '').trim() || '未命名脚本',
    desc: (body.desc || '').trim(),
    code: body.code || '',
    icon: body.icon || '📝',
    published: !!body.published,
    created_at: now,
    updated_at: now,
  };
  try {
    await kv.set(NS_SCRIPTS, id, script);
    return c.json({ script });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '创建脚本失败' }, 500);
  }
});

// 获取单条
app.get('/scripts/:id', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  try {
    const script = await kv.getJson<JsScript>(NS_SCRIPTS, id);
    if (!script) return c.json({ error: '脚本不存在' }, 404);
    return c.json({ script: { ...script, id } });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '获取脚本失败' }, 500);
  }
});

// 更新脚本
app.put('/scripts/:id', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  try {
    const existing = await kv.getJson<JsScript>(NS_SCRIPTS, id);
    if (!existing) return c.json({ error: '脚本不存在' }, 404);
    const updated: JsScript = {
      ...existing,
      name: body.name !== undefined ? ((body.name || '').trim() || '未命名脚本') : existing.name,
      desc: body.desc !== undefined ? (body.desc || '').trim() : existing.desc,
      code: body.code !== undefined ? body.code : existing.code,
      icon: body.icon !== undefined ? body.icon : existing.icon,
      published: body.published !== undefined ? !!body.published : existing.published,
      updated_at: nowUnix(),
    };
    await kv.set(NS_SCRIPTS, id, updated);
    return c.json({ script: { ...updated, id } });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '更新脚本失败' }, 500);
  }
});

// 删除脚本
app.delete('/scripts/:id', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  try {
    await kv.delete(NS_SCRIPTS, id);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '删除脚本失败' }, 500);
  }
});

// 切换发布状态
app.post('/scripts/:id/publish', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  try {
    const existing = await kv.getJson<JsScript>(NS_SCRIPTS, id);
    if (!existing) return c.json({ error: '脚本不存在' }, 404);
    existing.published = !!body.published;
    existing.updated_at = nowUnix();
    await kv.set(NS_SCRIPTS, id, existing);
    return c.json({ ok: true, published: existing.published });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '切换发布失败' }, 500);
  }
});

// ─── 执行端点 ───

// 临时执行（不保存）
app.post('/run', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  const code = body.code || '';
  const params = body.params && typeof body.params === 'object' ? body.params : {};
  const result = await executeScript(c.env, code, params);
  return c.json(result);
});

// ─── 通用 KV 读写（供前端 kbox.kv 调用，带黑名单校验） ───
app.get('/kv/:ns/:key', async (c) => {
  const kv = getKv(c);
  const ns = c.req.param('ns');
  const key = c.req.param('key');
  try {
    const value = await kv.getJson(ns, key);
    return c.json({ value });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '读取失败' }, 500);
  }
});

app.post('/kv/:ns/:key', async (c) => {
  const kv = getKv(c);
  const ns = c.req.param('ns');
  const key = c.req.param('key');
  if (isWriteForbidden(ns)) return c.json({ error: '禁止写入系统 namespace: ' + ns }, 403);
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '无效 JSON' }, 400); }
  try {
    await kv.set(ns, key, body.value);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '写入失败' }, 500);
  }
});

app.delete('/kv/:ns/:key', async (c) => {
  const kv = getKv(c);
  const ns = c.req.param('ns');
  const key = c.req.param('key');
  if (isWriteForbidden(ns)) return c.json({ error: '禁止写入系统 namespace: ' + ns }, 403);
  try {
    await kv.delete(ns, key);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '删除失败' }, 500);
  }
});

app.get('/kv/:ns', async (c) => {
  const kv = getKv(c);
  const ns = c.req.param('ns');
  try {
    const items = await kv.list(ns);
    return c.json({ items });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '列出失败' }, 500);
  }
});

// 运行已保存脚本
app.post('/scripts/:id/run', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  let body: any = {};
  try { body = await c.req.json(); } catch { /* 无 body 也行 */ }
  const params = body.params && typeof body.params === 'object' ? body.params : {};

  try {
    const script = await kv.getJson<JsScript>(NS_SCRIPTS, id);
    if (!script) return c.json({ error: '脚本不存在' }, 404);
    const result = await executeScript(c.env, script.code, params);
    // 记录 last_run
    script.last_run = {
      at: nowUnix(),
      status: result.error ? 'error' : 'ok',
      error: result.error?.message,
    };
    await kv.set(NS_SCRIPTS, id, script);
    return c.json(result);
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '运行失败' }, 500);
  }
});

// 记录脚本运行结果（前端执行后调用，仅更新 last_run）
app.post('/scripts/:id/record-run', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch { body = {}; }
  try {
    const script = await kv.getJson<JsScript>(NS_SCRIPTS, id);
    if (!script) return c.json({ error: '脚本不存在' }, 404);
    script.last_run = {
      at: nowUnix(),
      status: body.status === 'ok' ? 'ok' : 'error',
      error: body.error,
    };
    await kv.set(NS_SCRIPTS, id, script);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '记录失败' }, 500);
  }
});

const jsRunnerPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default jsRunnerPlugin;
