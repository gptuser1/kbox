import { Hono } from 'hono';
import { Bindings, Variables, getConn, errorResponse, sanitizeIdent, callD1Rest } from './db-utils';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 执行 SQL
router.post('/query', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
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

// 列出所有表（含行数估算，adminer 风格的左侧导航）
router.get('/tables', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;

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
router.get('/tables/:table/schema', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const tableName = c.req.param('table') || '';
    const table = sanitizeIdent(tableName);
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
router.get('/tables/:table/data', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const tableName = c.req.param('table') || '';
    const table = sanitizeIdent(tableName);
    if (!table) return c.json({ error: '无效表名' }, 400);

    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50'), 1), 500);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
    const sortBy = sanitizeIdent(c.req.query('sort') || '');
    const order = (c.req.query('order') || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
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

// 删除表
router.delete('/tables/:table', async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const tableName = c.req.param('table') || '';
    const table = sanitizeIdent(tableName);
    if (!table) return c.json({ error: '无效表名' }, 400);

    const res = await callD1Rest(c.env, conn, `DROP TABLE \`${table}\``);
    if (!res.ok) return c.json({ error: res.data?.error || `HTTP ${res.status}` }, 500);
    return c.json({ ok: true });
  } catch (e) {
    return errorResponse(c, e, '删除表失败');
  }
});

export default router;