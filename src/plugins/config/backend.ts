// 配置管理路由：全局配置 + 工具级覆盖配置 CRUD

import { Hono } from 'hono';
import { getConfig, getAppConfig, getToolConfig, setAppConfig, deleteAppConfig, getConfigSchema, listToolOverrides, setToolConfig, deleteToolConfig, ConfigField } from '../../services/config';

type Bindings = {};
type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 工具清单（用于前端渲染工具级覆盖 UI）
const TOOL_LIST = [
  { id: 'dispatch',  name: 'GitHub Actions 触发' },
  { id: 'disk',      name: '微型云盘' },
  { id: 'stock',     name: '基金估值' },
  { id: 'news',      name: 'AI 新闻锐评' },
  { id: 'db-admin',  name: 'DB 管理' },
  { id: 'js',        name: 'JS 运行工具' },
  { id: 'cron',      name: 'Cron 任务' },
  { id: 'sys-monitor', name: '系统监控' },
];

// 敏感值脱敏：用多个 * 号代替明文
function maskField(field: ConfigField, value: string | null) {
  if (value == null || value === '') {
    return { hasValue: false, value: null };
  }
  if (field.sensitive) {
    return { hasValue: true, value: '******' };
  }
  return { hasValue: true, value };
}

// GET /api/config/schema — 所有配置项定义
router.get('/schema', (c) => {
  return c.json({ schema: getConfigSchema(), tools: TOOL_LIST });
});

// GET /api/config — 列出所有全局配置（敏感脱敏）
router.get('/', async (c) => {
  const schema = getConfigSchema();
  const configs = [];
  for (const field of schema) {
    if (field.tools) continue;
    const raw = await getAppConfig(c, field.key);
    const masked = maskField(field, raw);
    configs.push({
      key: field.key,
      desc: field.desc,
      sensitive: field.sensitive,
      placeholder: field.placeholder,
      default: field.default || null,
      hasValue: masked.hasValue,
      value: masked.value,
    });
  }
  return c.json({ configs });
});

// GET /api/config/:key — 读取单条全局配置（敏感脱敏）
router.get('/:key', async (c) => {
  const key = c.req.param('key');
  const field = getConfigSchema().find(f => f.key === key);
  if (!field) return c.json({ error: '未知配置项: ' + key }, 404);
  const raw = await getAppConfig(c, key);
  const masked = maskField(field, raw);
  return c.json({
    key, desc: field.desc, sensitive: field.sensitive,
    default: field.default || null,
    hasValue: masked.hasValue,
    value: masked.value,
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

// GET /api/config/tools/:tool — 列出某工具的所有覆盖配置（敏感脱敏）
router.get('/tools/:tool', async (c) => {
  const tool = c.req.param('tool');
  if (!TOOL_LIST.find(t => t.id === tool)) {
    return c.json({ error: '未知工具: ' + tool }, 404);
  }
  const overrideKeys = await listToolOverrides(c, tool);
  const schema = getConfigSchema();
  const overrides = [];
  for (const key of overrideKeys) {
    const field = schema.find(f => f.key === key);
    if (!field) continue;
    const raw = await getToolConfig(c, tool, key);
    const masked = maskField(field, raw);
    overrides.push({
      key, desc: field.desc, sensitive: field.sensitive,
      hasValue: masked.hasValue, value: masked.value,
    });
  }
  return c.json({ tool, overrides });
});

// PUT /api/config/tools/:tool/:key — 写入工具级覆盖
router.put('/tools/:tool/:key', async (c) => {
  const tool = c.req.param('tool');
  const key = c.req.param('key');
  if (!TOOL_LIST.find(t => t.id === tool)) {
    return c.json({ error: '未知工具: ' + tool }, 404);
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
      await deleteToolConfig(c, tool, key);
    } else {
      await setToolConfig(c, tool, key, value);
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '保存失败' }, 500);
  }
});

// DELETE /api/config/tools/:tool/:key — 删除工具级覆盖（回退到全局）
router.delete('/tools/:tool/:key', async (c) => {
  const tool = c.req.param('tool');
  const key = c.req.param('key');
  if (!TOOL_LIST.find(t => t.id === tool)) {
    return c.json({ error: '未知工具: ' + tool }, 404);
  }
  try {
    await deleteToolConfig(c, tool, key);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '删除失败' }, 500);
  }
});

import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

const configPlugin: BackendPlugin = {
  manifest,
  router,
};

export default configPlugin;