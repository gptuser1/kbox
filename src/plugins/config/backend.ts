// 配置管理路由：全局配置 + 插件级覆盖配置 CRUD

import { Hono } from 'hono';
import { getAppConfig, getPluginConfig, setAppConfig, deleteAppConfig, getConfigSchema, listPluginOverrides, setPluginConfig, deletePluginConfig, hasAppConfig, hasPluginConfig } from '../../services/config';

type Bindings = {};
type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 插件清单（用于前端渲染插件级覆盖 UI）
const PLUGIN_LIST = [
  { id: 'gh-dispatch',  name: 'GitHub Actions 触发' },
  { id: 'disk',      name: '微型云盘' },
  { id: 'stock',     name: '基金估值' },
  { id: 'news',      name: 'AI 新闻锐评' },
  { id: 'db-admin',  name: 'DB 管理' },
  { id: 'js-runner', name: 'JS 运行插件' },
  { id: 'cron',      name: 'Cron 任务' },
  { id: 'sys-monitor', name: '系统监控' },
];

// GET /api/config/schema — 所有配置项定义
router.get('/schema', (c) => {
  return c.json({ schema: getConfigSchema(), plugins: PLUGIN_LIST });
});

// GET /api/config — 列出所有全局配置（敏感脱敏）
// 敏感项只判断「是否已配置」不触发解密，避免每次 PBKDF2 的无谓 CPU；
// 用串行读而非并行，避免同时打 D1 网关造成网关侧压力叠加（不拆东墙补西墙）。
router.get('/', async (c) => {
  const schema = getConfigSchema();
  const configs = [];
  for (const field of schema) {
    if (field.plugins) continue;
    let hasValue: boolean;
    let value: string | null;
    if (field.sensitive) {
      hasValue = await hasAppConfig(c, field.key);
      value = null;
    } else {
      const raw = await getAppConfig(c, field.key);
      hasValue = raw != null;
      value = raw;
    }
    configs.push({
      key: field.key,
      desc: field.desc,
      sensitive: field.sensitive,
      placeholder: field.placeholder,
      default: field.default || null,
      hasValue,
      value,
    });
  }
  return c.json({ configs });
});

// GET /api/config/:key — 读取单条全局配置（敏感脱敏，不触发解密）
router.get('/:key', async (c) => {
  const key = c.req.param('key');
  const field = getConfigSchema().find(f => f.key === key);
  if (!field) return c.json({ error: '未知配置项: ' + key }, 404);
  let hasValue: boolean;
  let value: string | null;
  if (field.sensitive) {
    hasValue = await hasAppConfig(c, key);
    value = null;
  } else {
    const raw = await getAppConfig(c, key);
    hasValue = raw != null;
    value = raw;
  }
  return c.json({
    key, desc: field.desc, sensitive: field.sensitive,
    default: field.default || null,
    hasValue,
    value,
  });
});

// PUT /api/config/:key — 写入全局配置（敏感自动加密）
router.put('/:key', async (c) => {
  const key = c.req.param('key');
  const field = getConfigSchema().find(f => f.key === key);
  if (!field) return c.json({ error: '未知配置项: ' + key }, 404);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  const value = typeof body.value === 'string' ? body.value : '';
  try {
    if (value === '') {
      await deleteAppConfig(c, key);
    } else {
      await setAppConfig(c, key, value);
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '保存失败' }, 500);
  }
});

// GET /api/config/plugins/:plugin — 列出某插件的所有覆盖配置（敏感脱敏）
router.get('/plugins/:plugin', async (c) => {
  const plugin = c.req.param('plugin');
  if (!PLUGIN_LIST.find(t => t.id === plugin)) {
    return c.json({ error: '未知插件: ' + plugin }, 404);
  }
  const overrideKeys = await listPluginOverrides(c, plugin);
  const schema = getConfigSchema();
  const overrides = [];
  for (const key of overrideKeys) {
    const field = schema.find(f => f.key === key);
    if (!field) continue;
    let hasValue: boolean;
    let value: string | null;
    if (field.sensitive) {
      hasValue = await hasPluginConfig(c, plugin, key);
      value = null;
    } else {
      const raw = await getPluginConfig(c, plugin, key);
      hasValue = raw != null;
      value = raw;
    }
    overrides.push({
      key, desc: field.desc, sensitive: field.sensitive,
      hasValue, value,
    });
  }
  return c.json({ plugin, overrides });
});

// PUT /api/config/plugins/:plugin/:key — 写入插件级覆盖
router.put('/plugins/:plugin/:key', async (c) => {
  const plugin = c.req.param('plugin');
  const key = c.req.param('key');
  if (!PLUGIN_LIST.find(t => t.id === plugin)) {
    return c.json({ error: '未知插件: ' + plugin }, 404);
  }
  const field = getConfigSchema().find(f => f.key === key);
  if (!field) return c.json({ error: '未知配置项: ' + key }, 404);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  const value = typeof body.value === 'string' ? body.value : '';
  try {
    if (value === '') {
      await deletePluginConfig(c, plugin, key);
    } else {
      await setPluginConfig(c, plugin, key, value);
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '保存失败' }, 500);
  }
});

// DELETE /api/config/plugins/:plugin/:key — 删除插件级覆盖（回退到全局）
router.delete('/plugins/:plugin/:key', async (c) => {
  const plugin = c.req.param('plugin');
  const key = c.req.param('key');
  if (!PLUGIN_LIST.find(t => t.id === plugin)) {
    return c.json({ error: '未知插件: ' + plugin }, 404);
  }
  try {
    await deletePluginConfig(c, plugin, key);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

const configPlugin: BackendPlugin = {
  manifest,
  router,
};

export default configPlugin;