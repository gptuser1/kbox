// 免费模型池服务路由（非插件，类似 /api/preferences）
// GET  /api/model-pool/pool      获取已排序极简清单（[{model, baseurl}]）
// POST /api/model-pool/refresh   手动刷新模型池

import { Hono } from 'hono';
import { readModelPool, refreshModelPool } from '../../services/model-pool';

type Bindings = {
  SECRET: SecretsStoreSecret;
  D1_API_BASE?: string;
  AA_API_KEY?: string;
};

type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 返回极简有序清单（服务端已按 AA 指数降序排好）
router.get('/pool', async (c) => {
  try {
    const pool = await readModelPool(c.env);
    return c.json({ updated_at: pool.updated_at, entries: pool.entries });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '读取模型池失败' }, 500);
  }
});

// 手动刷新
router.post('/refresh', async (c) => {
  try {
    const r = await refreshModelPool(c.env);
    return c.json(r, r.success ? 200 : 500);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '刷新失败' }, 500);
  }
});

export default router;