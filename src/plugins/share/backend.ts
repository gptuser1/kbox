// Share Text 端点（公开只读，简单 token 认证）

import { Hono } from 'hono';
import { getConfig, masterKey } from '../../services/config';
import { createKv } from '../../services/kv';

type Bindings = {
  SECRET: SecretsStoreSecret;
  D1_API_BASE?: string;
};

type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get('/text', async (c) => {
  const expected = await getConfig(c, 'share', 'share_token');
  if (!expected) {
    return c.json({ error: '分享端点未启用（未配置 share_token）' }, 403);
  }
  const token = c.req.query('token');
  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const key = c.req.query('key');
  if (!key) {
    return c.json({ error: 'Missing key parameter' }, 400);
  }
  const diskBase = await getConfig(c, 'disk', 'disk_d1_base');
  const diskToken = await getConfig(c, 'disk', 'disk_d1_token');
  const kv = createKv(diskToken || await masterKey(c), diskBase || c.env.D1_API_BASE);
  try {
    const value = await kv.get('share_text', key);
    if (value === null) {
      return c.json({ error: 'Key not found' }, 404);
    }
    return new Response(value, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to read data';
    return c.json({ error: msg }, 500);
  }
});

export default router;
