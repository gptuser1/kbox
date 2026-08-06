import { Hono } from 'hono';
import { DbError } from '../db';
import { createKv } from '../kv';

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
  database: string;
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

function kvError(c: any, kv: any) {
  return c.json({ error: kv.error() || 'KV 表初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 表名/列名仅允许字母数字下划线，防止注入
function sanitizeIdent(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

// 拼接 /query 端点 URL
function buildQueryUrl(conn: Pick<DbConnection, 'base_url' | 'database'>): string {
  const base = conn.base_url.replace(/\/+$/, '');
  return conn.database
    ? `${base}/${conn.database}/query`
    : `${base}/query`;
}

// 调用 d1-rest 执行 SQL
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

// 取连接（404 友好）：成功返回 DbConnection，失败返回 Response
async function getConn(c: any, id: string): Promise<DbConnection | Response> {
  const kv = getKv(c);
  try {
    const conn = await kv.getJson<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);
    return conn;
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '读取连接失败');
  }
}

// ─── 连接 CRUD ───

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
    if (kv.error()) return kvError(c, kv);
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
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '创建连接失败');
  }
});

// 更新连接
app.put('/connections/:id', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const existing = await kv.getJson<DbConnection>(NS, id);
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
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '更新连接失败');
  }
});

// 删除连接
app.delete('/connections/:id', async (c) => {
  const kv = getKv(c);
  try {
    const id = c.req.param('id');
    const existing = await kv.getJson<DbConnection>(NS, id);
    if (!existing) return c.json({ error: '连接不存在' }, 404);
    await kv.delete(NS, id);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '删除连接失败');
  }
});

// 测试连接（SELECT 1）—— 不抛错，返回 {ok, ...} 供前端展示
app.post('/connections/:id/test', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const { ok, status, data } = await callD1Rest(c.env, conn, 'SELECT 1 AS ok');
    if (!ok) {
      return c.json({ ok: false, status, error: data?.error || `HTTP ${status}` });
    }
    return c.json({ ok: true, sample: data?.results?.[0] || null });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || '测试失败' });
  }
});

// 执行 SQL（adminer 的 SQL 命令 tab）
app.post('/connections/:id/query', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
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

// ─── 库/表元信息（adminer 左侧导航 + 表 tab） ───

// 列出所有表（含行数估算，adminer 风格的左侧导航）
app.get('/connections/:id/tables', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;

    // sqlite_master 拿表名 + 建表 SQL（用于修改 tab）
    const { ok, status, data } = await callD1Rest(
      c.env,
      conn,
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
    );
    if (!ok) {
      return c.json({ error: data?.error || `HTTP ${status}` }, 500);
    }
    const tables = (data?.results || []).map((r: any) => ({
      name: r.name,
      sql: r.sql || '',
    }));
    return c.json({ results: tables });
  } catch (e) {
    return errorResponse(c, e, '获取表列表失败');
  }
});

// 表结构（PRAGMA table_info + 索引 + 行数）
app.get('/connections/:id/tables/:table/schema', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    // 并行查：字段 / 索引 / 建表 SQL / 行数
    const [colsRes, idxRes, sqlRes, countRes] = await Promise.all([
      callD1Rest(c.env, conn, `PRAGMA table_info(\`${table}\`)`),
      callD1Rest(c.env, conn, `PRAGMA index_list(\`${table}\`)`),
      callD1Rest(c.env, conn, "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", [table]),
      callD1Rest(c.env, conn, `SELECT COUNT(*) AS cnt FROM \`${table}\``),
    ]);

    if (!colsRes.ok) return c.json({ error: colsRes.data?.error || `HTTP ${colsRes.status}` }, 500);

    // 索引详情
    const indexes: any[] = [];
    if (idxRes.ok && idxRes.data?.results) {
      for (const idx of idxRes.data.results) {
        const info = await callD1Rest(c.env, conn, `PRAGMA index_info(\`${sanitizeIdent(idx.name)}\`)`);
        indexes.push({
          name: idx.name,
          unique: idx.unique === 1,
          columns: (info.data?.results || []).map((c: any) => c.name),
        });
      }
    }

    return c.json({
      columns: colsRes.data?.results || [],
      indexes,
      sql: sqlRes.data?.results?.[0]?.sql || '',
      count: countRes.data?.results?.[0]?.cnt ?? null,
    });
  } catch (e) {
    return errorResponse(c, e, '获取表结构失败');
  }
});

// 表数据浏览（分页 + 排序 + 简单过滤，adminer 选择数据 tab）
app.get('/connections/:id/tables/:table/data', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50'), 1), 500);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
    const sortBy = sanitizeIdent(c.req.query('sort') || '');
    const order = (c.req.query('order') || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    // 简单等值过滤：?col=val
    const filters: Array<{ col: string; val: string }> = [];
    for (const [k, v] of Object.entries(c.req.query())) {
      if (['limit', 'offset', 'sort', 'order'].includes(k)) continue;
      if (v == null || v === '') continue;
      const col = sanitizeIdent(k);
      if (col) filters.push({ col, val: String(v) });
    }

    const where = filters.length
      ? ' WHERE ' + filters.map(f => `\`${f.col}\` = ?`).join(' AND ')
      : '';
    const orderBy = sortBy ? ` ORDER BY \`${sortBy}\` ${order}` : '';
    const params = filters.map(f => f.val);

    // 数据 + 总行数并行
    const [dataRes, countRes] = await Promise.all([
      callD1Rest(c.env, conn, `SELECT * FROM \`${table}\`${where}${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]),
      callD1Rest(c.env, conn, `SELECT COUNT(*) AS cnt FROM \`${table}\`${where}`, params),
    ]);

    if (!dataRes.ok) return c.json({ error: dataRes.data?.error || `HTTP ${dataRes.status}` }, 500);

    return c.json({
      results: dataRes.data?.results || [],
      count: countRes.data?.results?.[0]?.cnt ?? null,
      limit,
      offset,
    });
  } catch (e) {
    return errorResponse(c, e, '获取表数据失败');
  }
});

// 单行读取（编辑表单用）
app.get('/connections/:id/tables/:table/row', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const colsRes = await callD1Rest(c.env, conn, `PRAGMA table_info(\`${table}\`)`);
    if (!colsRes.ok) return c.json({ error: colsRes.data?.error || '获取列信息失败' }, 500);
    const cols = colsRes.data?.results || [];
    const pkCols = cols.filter((c: any) => c.pk).map((c: any) => c.name);

    const where = c.req.query();
    const conditions: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(where)) {
      const col = sanitizeIdent(k);
      if (col && v != null && v !== '') {
        conditions.push(`\`${col}\` = ?`);
        params.push(v);
      }
    }
    if (conditions.length === 0) return c.json({ error: '需提供定位条件' }, 400);

    const dataRes = await callD1Rest(c.env, conn, `SELECT * FROM \`${table}\` WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
    if (!dataRes.ok) return c.json({ error: dataRes.data?.error || `HTTP ${dataRes.status}` }, 500);
    return c.json({ row: dataRes.data?.results?.[0] || null, pk: pkCols });
  } catch (e) {
    return errorResponse(c, e, '读取行失败');
  }
});

// 新建/更新行（adminer 编辑表单提交）
// PUT 带 where 参数定位行；POST 不带 where 即新建
app.put('/connections/:id/tables/:table/row', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const body = await c.req.json();
    const set: Record<string, any> = body.set || {};
    const where: Record<string, any> = body.where || {};
    if (Object.keys(set).length === 0) return c.json({ error: 'set 不能为空' }, 400);
    if (Object.keys(where).length === 0) return c.json({ error: 'where 不能为空（更新需定位行）' }, 400);

    const setCols = Object.keys(set).map(sanitizeIdent).filter(Boolean);
    const whereCols = Object.keys(where).map(sanitizeIdent).filter(Boolean);
    const sql = `UPDATE \`${table}\` SET ${setCols.map(c => `\`${c}\` = ?`).join(', ')} WHERE ${whereCols.map(c => `\`${c}\` = ?`).join(' AND ')}`;
    const params = [...setCols.map(c => set[c]), ...whereCols.map(c => where[c])];

    const res = await callD1Rest(c.env, conn, sql, params);
    if (!res.ok) return c.json({ error: res.data?.error || `HTTP ${res.status}` }, 500);
    return c.json({ ok: true, changes: res.data?.meta?.changes ?? 0 });
  } catch (e) {
    return errorResponse(c, e, '更新行失败');
  }
});

app.post('/connections/:id/tables/:table/row', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const body = await c.req.json();
    const values: Record<string, any> = body.values || {};
    if (Object.keys(values).length === 0) return c.json({ error: 'values 不能为空' }, 400);

    const cols = Object.keys(values).map(sanitizeIdent).filter(Boolean);
    const sql = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const params = cols.map(c => values[c]);

    const res = await callD1Rest(c.env, conn, sql, params);
    if (!res.ok) return c.json({ error: res.data?.error || `HTTP ${res.status}` }, 500);
    return c.json({ ok: true, last_row_id: res.data?.meta?.last_row_id ?? null });
  } catch (e) {
    return errorResponse(c, e, '新建行失败');
  }
});

// 删除行
app.delete('/connections/:id/tables/:table/row', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const where = c.req.query();
    const conditions: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(where)) {
      const col = sanitizeIdent(k);
      if (col && v != null && v !== '') {
        conditions.push(`\`${col}\` = ?`);
        params.push(v);
      }
    }
    if (conditions.length === 0) return c.json({ error: '需提供定位条件' }, 400);

    const res = await callD1Rest(c.env, conn, `DELETE FROM \`${table}\` WHERE ${conditions.join(' AND ')}`, params);
    if (!res.ok) return c.json({ error: res.data?.error || `HTTP ${res.status}` }, 500);
    return c.json({ ok: true, changes: res.data?.meta?.changes ?? 0 });
  } catch (e) {
    return errorResponse(c, e, '删除行失败');
  }
});

// 删除表
app.delete('/connections/:id/tables/:table', async (c) => {
  try {
    const connOrErr = await getConn(c, c.req.param('id'));
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(c.req.param('table'));
    if (!table) return c.json({ error: '无效表名' }, 400);

    const res = await callD1Rest(c.env, conn, `DROP TABLE \`${table}\``);
    if (!res.ok) return c.json({ error: res.data?.error || `HTTP ${res.status}` }, 500);
    return c.json({ ok: true });
  } catch (e) {
    return errorResponse(c, e, '删除表失败');
  }
});

export default app;
