// 用户偏好设置路由（通用 KV，不限定结构）
// 任意 key → 任意 JSON value。供前端存放各类用户偏好

import { Hono } from 'hono';
import { createKv } from '../kv';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {};

const NS_PREFS = 'preferences';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 列出所有偏好
router.get('/', async (c) => {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    const items = await kv.list<any>(NS_PREFS);
    const prefs: Record<string, any> = {};
    for (const item of items) prefs[item.key] = item.value;
    return c.json({ preferences: prefs });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '读取偏好失败' }, 500);
  }
});

// 读取单条偏好
router.get('/:key', async (c) => {
  const key = c.req.param('key');
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    const value = await kv.getJson<any>(NS_PREFS, key);
    return c.json({ key, value: value === null ? null : value });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '读取偏好失败' }, 500);
  }
});

// 写入单条偏好
router.put('/:key', async (c) => {
  const key = c.req.param('key');
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  if (!('value' in body)) {
    return c.json({ error: '请求体需为 { value: any }' }, 400);
  }
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    await kv.set(NS_PREFS, key, body.value);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '保存偏好失败' }, 500);
  }
});

// 删除单条偏好
router.delete('/:key', async (c) => {
  const key = c.req.param('key');
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    await kv.delete(NS_PREFS, key);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '删除偏好失败' }, 500);
  }
});

export default router;