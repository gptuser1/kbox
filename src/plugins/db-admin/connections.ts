import { Hono } from 'hono';
import { Bindings, Variables, DbConnection, NS, localtimeNow, genId, getKv, getConn, errorResponse, kvError, callD1Rest } from './utils';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 列出所有连接
router.get('/', async (c) => {
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
router.post('/', async (c) => {
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
router.put('/:id', async (c) => {
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
router.delete('/:id', async (c) => {
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
router.post('/:id/test', async (c) => {
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

export default router;