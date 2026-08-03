import { Hono } from 'hono';
import { DbError } from '../db';
import { createKv, getKvTableError } from '../kv';

// DB 管理工具：通过 d1-rest API 执行 SQL，支持多连接管理
// 连接配置存于 kbox_kv（namespace='db_admin_connections'），凭据统一使用 env.D1_API_TOKEN
//
// 连接模式两种（与 d1-rest 路由对齐）：
//   1. 专属域：database 留空 → 查询端点 = ${base_url}/query
//      例如 base_url = https://ocean.xxx.xxx
//   2. 主入口：database 填库名 → 查询端点 = ${base_url}/${database}/query
//      例如 base_url = https://db.xxx.xxx, database = ocean

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const NS = 'db_admin_connections';

interface DbConnection {
  id: string;
  name: string;
  base_url: string;
  database: string;        // '' = 专属域模式；非空 = 主入口模式（路径前缀）
  created_at: string;
  updated_at: string;
}

// 北京时间
function localtimeNow(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

// 生成短 id（与 stock/dispatch 一致的风格）
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getKv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function errorResponse(c: any, e: unknown, defaultMsg = '服务器内部错误') {
  if (e instanceof DbError) {
    return c.json({ error: e.message }, e.status as any);
  }
  const msg = e instanceof Error ? e.message : defaultMsg;
  return c.json({ error: msg }, 500);
}

function kvError(c: any) {
  return c.json({ error: getKvTableError() || 'KV 表初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 拼接 d1-rest 的 /query 端点 URL
function buildQueryUrl(conn: Pick<DbConnection, 'base_url' | 'database'>): string {
  const base = conn.base_url.replace(/\/+$/, '');
  return conn.database
    ? `${base}/${conn.database}/query`
    : `${base}/query`;
}

// 调用 d1-rest 执行 SQL（凭据统一用 env.D1_API_TOKEN）
async function callD1Rest(
  env: Bindings,
  conn: Pick<DbConnection, 'base_url' | 'database'>,
  query: string,
  params: any[] = [],
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = buildQueryUrl(conn);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.D1_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应 */ }
  return { ok: res.ok, status: res.status, data };
}

// ─── 路由 ───

// 列出所有连接
app.get('/connections', async (c) => {
  const kv = getKv(c);
  try {
    const items = await kv.list<DbConnection>(NS);
    const conns = items
      .map(item => item.value)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    return c.json({ results: conns, count: conns.length });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return errorResponse(c, e, '获取连接列表失败');
  }
});

// 创建连接
app.post('/connections', async (c) => {
  const kv = getKv(c);
  try {
    const body = await c.req.json();
    if (!body.name || !body.base_url) {
      return c.json({ error: 'name 和 base_url 必填' }, 400);
    }
    const now = localtimeNow();
    const conn: DbConnection = {
      id: genId(),
      name: String(body.name).trim(),
      base_url: String(body.base_url).trim(),
      database: body.database ? String(body.database).trim() : '',
      created_at: now,
      updated_at: now,
    };
    await kv.set(NS, conn.id, conn);
    return c.json({ ok: true, connection: conn }, 201);
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return errorResponse(c, e, '创建连接失败');
  }
});

// 更新连接
app.put('/connections/:id', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const existing = await kv.get<DbConnection>(NS, id);
    if (!existing) return c.json({ error: '连接不存在' }, 404);
    const body = await c.req.json();
    const updated: DbConnection = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      base_url: body.base_url !== undefined ? String(body.base_url).trim() : existing.base_url,
      database: body.database !== undefined ? String(body.database).trim() : existing.database,
      updated_at: localtimeNow(),
    };
    await kv.set(NS, id, updated);
    return c.json({ ok: true, connection: updated });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return errorResponse(c, e, '更新连接失败');
  }
});

// 删除连接
app.delete('/connections/:id', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const existing = await kv.get<DbConnection>(NS, id);
    if (!existing) return c.json({ error: '连接不存在' }, 404);
    await kv.delete(NS, id);
    return c.json({ ok: true });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return errorResponse(c, e, '删除连接失败');
  }
});

// 测试连接（SELECT 1）—— 不抛错，返回 {ok, ...} 供前端展示
app.post('/connections/:id/test', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const conn = await kv.get<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);

    const { ok, status, data } = await callD1Rest(c.env, conn, 'SELECT 1 AS ok');
    if (!ok) {
      return c.json({ ok: false, status, error: data?.error || `HTTP ${status}` });
    }
    return c.json({ ok: true, sample: data?.results?.[0] || null });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || '测试失败' });
  }
});

// 执行 SQL
app.post('/connections/:id/query', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const conn = await kv.get<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);

    const body = await c.req.json();
    if (!body.query) return c.json({ error: 'query 必填' }, 400);

    const { ok, status, data } = await callD1Rest(c.env, conn, body.query, body.params || []);
    if (!ok) {
      return c.json({ error: data?.error || `HTTP ${status}` }, status === 401 ? 401 : 500);
    }
    return c.json(data);
  } catch (e) {
    return errorResponse(c, e, '执行查询失败');
  }
});

// 列出所有表
app.get('/connections/:id/tables', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const conn = await kv.get<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);

    const { ok, status, data } = await callD1Rest(
      c.env,
      conn,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    if (!ok) {
      return c.json({ error: data?.error || `HTTP ${status}` }, 500);
    }
    return c.json({ results: data?.results || [] });
  } catch (e) {
    return errorResponse(c, e, '获取表列表失败');
  }
});

// 表结构（PRAGMA table_info）
app.get('/connections/:id/tables/:table/schema', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table');
    const conn = await kv.get<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);

    // 表名仅允许字母数字下划线，防止 PRAGMA 注入
    const safe = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safe) return c.json({ error: '无效表名' }, 400);

    const { ok, status, data } = await callD1Rest(c.env, conn, `PRAGMA table_info(\`${safe}\`)`);
    if (!ok) {
      return c.json({ error: data?.error || `HTTP ${status}` }, 500);
    }
    return c.json({ results: data?.results || [] });
  } catch (e) {
    return errorResponse(c, e, '获取表结构失败');
  }
});

// 表数据预览（SELECT * LIMIT 100）
app.get('/connections/:id/tables/:table/preview', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table');
    const conn = await kv.get<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);

    const safe = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safe) return c.json({ error: '无效表名' }, 400);

    const { ok, status, data } = await callD1Rest(c.env, conn, `SELECT * FROM \`${safe}\` LIMIT 100`);
    if (!ok) {
      return c.json({ error: data?.error || `HTTP ${status}` }, 500);
    }
    return c.json({ results: data?.results || [] });
  } catch (e) {
    return errorResponse(c, e, '预览表数据失败');
  }
});

export default app;
