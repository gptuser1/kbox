import { Hono } from 'hono';
import { renderFrontend } from './frontend';
import disk from './tools/cloud-disk';
import stock from './tools/stock';
import news from './tools/news';
import dbAdmin from './tools/db-admin';
import jsRunner from './tools/js-runner';
import { createKv } from './kv';
import { runCronTasks, listTasks, createTask, updateTask, deleteTask, triggerTask } from './tools/cron-tasks';
import { getConfig, getAppConfig, getToolConfig, setAppConfig, deleteAppConfig, getConfigSchema, listToolOverrides, setToolConfig, deleteToolConfig, ConfigField } from './config';

type Bindings = {
  ACCESS_TOKEN: string;
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  GH_TOKEN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  TENCENT_API_BASE?: string;
  YAHOO_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// favicon SVG（简约现代风格：圆角方块 + 渐变折线，工具箱主题）
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#818cf8"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"/>
  <rect x="8" y="9" width="16" height="3" rx="1.5" fill="url(#line)"/>
  <rect x="8" y="14.5" width="11" height="3" rx="1.5" fill="url(#line)" opacity="0.7"/>
  <rect x="8" y="20" width="14" height="3" rx="1.5" fill="url(#line)" opacity="0.5"/>
  <circle cx="23" cy="15.5" r="2.4" fill="#6366f1"/>
  <circle cx="23" cy="15.5" r="1" fill="#fff" fill-opacity="0.85"/>
</svg>`;

// ─── 鉴权中间件 ───
app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (/^\/api\/tools\/disk\/files\/\d+\/download$/.test(path)) {
    await next();
    return;
  }
  const auth = c.req.header('Authorization');
  let token = '';
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7).trim();
  } else {
    token = c.req.query('token')?.trim() || '';
  }
  if (!token) {
    return c.json({ error: '缺少鉴权信息，格式: Bearer <token> 或 ?token=<token>' }, 401);
  }
  if (token !== c.env.ACCESS_TOKEN) {
    return c.json({ error: '令牌无效' }, 401);
  }
  c.set('token', token);
  await next();
});

// ─── 路由 ───

// 前端页面
app.get('/', (c) => c.html(renderFrontend()));

// favicon
app.get('/favicon.svg', (c) => {
  return new Response(FAVICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// 验证令牌
app.get('/api/verify', (c) => c.json({ ok: true, message: '令牌有效' }));

// ─── 微型云盘工具 ───
app.route('/api/tools/disk', disk);

// ─── 基金估值工具 ───
app.route('/api/tools/stock', stock);

// ─── AI 新闻锐评工具 ───
app.route('/api/tools/news', news);

// ─── DB 管理工具 ───
app.route('/api/tools/db-admin', dbAdmin);

// ─── JS 运行工具 ───
app.route('/api/tools/js', jsRunner);

// ─── Cron 任务管理（软定时） ───
app.get('/api/cron-tasks', async (c) => {
  try {
    const tasks = await listTasks(c.env);
    return c.json({ tasks });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '获取任务失败' }, 500);
  }
});
app.post('/api/cron-tasks', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  try {
    const task = await createTask(c.env, body);
    return c.json({ task });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '创建任务失败' }, 500);
  }
});
app.put('/api/cron-tasks/:id', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }
  try {
    const task = await updateTask(c.env, c.req.param('id'), body);
    if (!task) return c.json({ error: '任务不存在' }, 404);
    return c.json({ task });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '更新任务失败' }, 500);
  }
});
app.delete('/api/cron-tasks/:id', async (c) => {
  try {
    await deleteTask(c.env, c.req.param('id'));
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '删除任务失败' }, 500);
  }
});
app.post('/api/cron-tasks/:id/trigger', async (c) => {
  try {
    const result = await triggerTask(c.env, c.req.param('id'));
    return c.json(result, result.ok ? 200 : 500);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '触发失败' }, 500);
  }
});

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', d1_token: !!c.env.D1_API_TOKEN });
});

// ─── 配置管理 ───

// 工具清单（用于前端渲染工具级覆盖 UI）
const TOOL_LIST = [
  { id: 'dispatch',  name: 'GitHub Actions 触发' },
  { id: 'disk',      name: '微型云盘' },
  { id: 'stock',     name: '基金估值' },
  { id: 'news',      name: 'AI 新闻锐评' },
  { id: 'db-admin',  name: 'DB 管理' },
  { id: 'js',        name: 'JS 运行工具' },
  { id: 'cron',      name: 'Cron 任务' },
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
app.get('/api/config/schema', (c) => {
  return c.json({ schema: getConfigSchema(), tools: TOOL_LIST });
});

// GET /api/config — 列出所有全局配置（敏感脱敏）
app.get('/api/config', async (c) => {
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
app.get('/api/config/:key', async (c) => {
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
// body: { value: string }，空字符串表示清除
app.put('/api/config/:key', async (c) => {
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
app.get('/api/config/tools/:tool', async (c) => {
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
    // 直接读工具级值
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
app.put('/api/config/tools/:tool/:key', async (c) => {
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
app.delete('/api/config/tools/:tool/:key', async (c) => {
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

// ─── 用户偏好设置（通用 KV，不限定结构）───
// KV namespace: preferences
// 任意 key → 任意 JSON value。供前端存放各类用户偏好，例如：
//   home_layout   -> { viewMode, order, overrides }
//   config_order  -> { [scope]: [keys...] }
//   theme         -> 'dark' | 'light'
// 未来新增任何偏好都复用这套端点，无需后端改代码。

const NS_PREFS = 'preferences';

// GET /api/preferences — 列出所有偏好
app.get('/api/preferences', async (c) => {
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

// GET /api/preferences/:key — 读取单条偏好
app.get('/api/preferences/:key', async (c) => {
  const key = c.req.param('key');
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    const value = await kv.get<any>(NS_PREFS, key);
    return c.json({ key, value: value === null ? null : value });
  } catch (e) {
    if (kv.error()) return c.json({ error: kv.error() }, 503);
    return c.json({ error: e instanceof Error ? e.message : '读取偏好失败' }, 500);
  }
});

// PUT /api/preferences/:key — 写入单条偏好（任意 JSON value）
app.put('/api/preferences/:key', async (c) => {
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

// DELETE /api/preferences/:key — 删除单条偏好
app.delete('/api/preferences/:key', async (c) => {
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

// ─── GitHub Workflow Dispatch 工具 ───

// 列出仓库的 workflows
app.get('/api/tools/workflows', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  if (!owner || !repo) {
    return c.json({ error: '需要 owner 和 repo 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
        },
      }
    );
    const data: any = await res.json();
    if (!res.ok) {
      return c.json({ error: data?.message || `GitHub API ${res.status}` }, res.status as any);
    }
    const workflows = (data.workflows || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
      filename: w.path?.split('/').pop(),
    }));
    return c.json({ workflows });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// 触发 workflow dispatch
app.post('/api/tools/dispatch', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const { owner, repo, workflow_id, ref, inputs } = body;
  if (!owner || !repo || !workflow_id) {
    return c.json({ error: '需要 owner、repo、workflow_id 字段' }, 400);
  }

  const refValue = ref || 'main';
  const payload: any = { ref: refValue };
  if (inputs && typeof inputs === 'object' && Object.keys(inputs).length > 0) {
    payload.inputs = inputs;
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow_id)}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.status === 204) {
      return c.json({ ok: true, message: '已触发', workflow_id, ref: refValue });
    }
    const data: any = await res.json().catch(() => ({}));
    return c.json({ error: data?.message || `GitHub API ${res.status}` }, res.status as any);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// ─── 查询 workflow 最近执行状态 ───
app.get('/api/tools/workflow-runs', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  const workflowId = c.req.query('workflow_id')?.trim();
  if (!owner || !repo || !workflowId) {
    return c.json({ error: '需要 owner、repo、workflow_id 参数' }, 400);
  }
  const perPage = Math.min(Number(c.req.query('per_page')) || 1, 10);

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
        },
      }
    );
    const data: any = await res.json();
    if (!res.ok) {
      return c.json({ error: data?.message || `GitHub API ${res.status}` }, res.status as any);
    }
    const runs = (data.workflow_runs || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      head_branch: r.head_branch,
      status: r.status,           // queued | in_progress | completed
      conclusion: r.conclusion,   // success | failure | cancelled | null（运行中）
      html_url: r.html_url,
      created_at: r.created_at,
      updated_at: r.updated_at,
      run_attempt: r.run_attempt,
    }));
    return c.json({ runs });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// ─── Dispatch 配置 CRUD（基于通用 KV 表） ───

interface DispatchConfig {
  id?: string;
  repo: string;
  workflow_id: string;
  branch: string;
  inputs: Array<[string, string]>;
  updated_at?: string;
}

const NS_DISPATCH = 'dispatch_configs';

function kvError(c: any, kv: any) {
  return c.json({ error: kv.error() || 'KV 表初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 列出所有 dispatch 配置
app.get('/api/tools/dispatch-configs', async (c) => {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    const items = await kv.list<DispatchConfig>(NS_DISPATCH);
    const configs = items.map(item => ({
      ...item.value,
      id: item.key,
    }));
    return c.json({ configs });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return c.json({ error: e instanceof Error ? e.message : '获取配置失败' }, 500);
  }
});

// 新增配置（自动生成 id）
app.post('/api/tools/dispatch-configs', async (c) => {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const repo = body.repo?.trim();
  const workflowId = body.workflow_id?.trim();
  if (!repo || !workflowId) {
    return c.json({ error: '需要 repo 和 workflow_id 字段' }, 400);
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const config: DispatchConfig = {
    repo,
    workflow_id: workflowId,
    branch: body.branch || 'main',
    inputs: Array.isArray(body.inputs) ? body.inputs : [],
  };

  try {
    await kv.set(NS_DISPATCH, id, config);
    return c.json({ ok: true, id, ...config });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return c.json({ error: e instanceof Error ? e.message : '保存配置失败' }, 500);
  }
});

// 删除配置
app.delete('/api/tools/dispatch-configs/:id', async (c) => {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const id = c.req.param('id');

  try {
    await kv.delete(NS_DISPATCH, id);
    return c.json({ ok: true });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return c.json({ error: e instanceof Error ? e.message : '删除配置失败' }, 500);
  }
});

// ─── 辅助：解析 workflow_dispatch inputs ───

interface WorkflowInput {
  name: string;
  description: string;
  required: boolean;
  default: string;
  type: string;
  options?: string[];
}

function parseWorkflowInputs(yamlContent: string): WorkflowInput[] {
  const lines = yamlContent.split('\n');
  let i = 0;

  // 找到 workflow_dispatch: 行
  while (i < lines.length) {
    if (/^\s*workflow_dispatch\s*:/.test(lines[i])) break;
    i++;
  }
  if (i >= lines.length) return [];

  const wdIndent = (lines[i].match(/^(\s*)/) || ['', ''])[1].length;
  i++;

  // 在 workflow_dispatch 之下找 inputs:
  let inputsLine = -1;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const indent = (line.match(/^(\s*)/) || ['', ''])[1].length;
    if (indent <= wdIndent) return [];
    if (/^\s*inputs\s*:/.test(line)) { inputsLine = i; break; }
    i++;
  }
  if (inputsLine === -1) return [];

  const inputsIndent = (lines[inputsLine].match(/^(\s*)/) || ['', ''])[1].length + 2;
  i = inputsLine + 1;

  const inputs: WorkflowInput[] = [];
  let current: WorkflowInput | null = null;
  let inOptions = false;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const indent = (line.match(/^(\s*)/) || ['', ''])[1].length;
    if (indent < inputsIndent) break;

    if (indent === inputsIndent) {
      const keyMatch = line.match(/^\s+(\S[\w-]*)\s*:/);
      if (keyMatch) {
        if (current) inputs.push(current);
        current = { name: keyMatch[1], description: '', required: false, default: '', type: 'string' };
        inOptions = false;
        i++;
        continue;
      }
    }

    if (current) {
      const propMatch = line.match(/^\s*(description|required|default|type|options)\s*:\s*(.*)$/);
      if (propMatch) {
        const [, key, val] = propMatch;
        const cleanVal = val.replace(/^['"]|['"]$/g, '').trim();
        if (key === 'required') current.required = cleanVal === 'true';
        else if (key === 'type') { current.type = cleanVal; inOptions = cleanVal === 'choice'; }
        else if (key === 'default') current.default = cleanVal;
        else if (key === 'description') current.description = cleanVal;
        else if (key === 'options') inOptions = true;
      } else if (inOptions) {
        const optMatch = line.match(/^\s*-\s+(.*)$/);
        if (optMatch) {
          if (!current.options) current.options = [];
          current.options.push(optMatch[1].replace(/^['"]|['"]$/g, '').trim());
        }
      }
    }
    i++;
  }
  if (current) inputs.push(current);
  return inputs;
}

// 列出仓库分支
app.get('/api/tools/branches', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  if (!owner || !repo) {
    return c.json({ error: '需要 owner 和 repo 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
        },
      }
    );
    const data: any = await res.json();
    if (!res.ok) {
      return c.json({ error: data?.message || `GitHub API ${res.status}` }, res.status as any);
    }
    const branches = (Array.isArray(data) ? data : []).map((b: any) => ({
      name: b.name,
      protected: b.protected,
    }));
    return c.json({ branches });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// 获取 workflow inputs 定义
app.get('/api/tools/workflow-inputs', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  const path = c.req.query('path')?.trim();
  if (!owner || !repo || !path) {
    return c.json({ error: '需要 owner、repo、path 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
        },
      }
    );
    const data: any = await res.json();
    if (!res.ok) {
      return c.json({ error: data?.message || `GitHub API ${res.status}` }, res.status as any);
    }

    const content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
    const inputs = parseWorkflowInputs(content);
    return c.json({ inputs });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

export default {
  ...app,
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try {
        const result = await runCronTasks(env);
        console.log(`[cron] ran=${result.ran} skipped=${result.skipped} errors=${result.errors}`);
      } catch (e) {
        console.error('[cron] threw:', e instanceof Error ? e.message : String(e));
      }
    })());
  },
};
