import { Hono } from 'hono';
import { Bindings, Variables, getConn, errorResponse, sanitizeIdent, callD1Rest } from './db-utils';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 单行读取（编辑表单用）
router.get('/', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table') || '';
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(tableName);
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

// 更新行
router.put('/', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table') || '';
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(tableName);
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

// 新建行
router.post('/', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table') || '';
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(tableName);
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
router.delete('/', async (c) => {
  try {
    const id = c.req.param('id');
    const tableName = c.req.param('table') || '';
    if (!id) return c.json({ error: '缺少 id 参数' }, 400);
    const connOrErr = await getConn(c, id);
    if (connOrErr instanceof Response) return connOrErr;
    const conn = connOrErr;
    const table = sanitizeIdent(tableName);
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

export default router;