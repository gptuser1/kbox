import { Hono } from 'hono';
import { renderFrontend } from './frontend';
import disk from './tools/cloud-disk';
import stock from './tools/stock';
import news from './tools/news';
import { createKv, getKvTableError } from './kv';
import { getConfig, getAppConfig, getToolConfig, setAppConfig, deleteAppConfig, getConfigSchema, listToolOverrides, setToolConfig, deleteToolConfig, ConfigField } from './config';

type Bindings = {
  ACCESS_TOKEN: string;       // = KBOX_TOKEN（鉴权）
  D1_API_TOKEN: string;       // = KBOX_TOKEN（D1 访问 + 配置加密主密钥）
  D1_API_BASE?: string;
  // 以下为 env 兼容期字段（首次部署未填配置时降级用）
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
  // 下载端点用一次性 dt 令牌鉴权，跳过主鉴权（dt 由 POST /files/:id/download-token 生成）
  const path = new URL(c.req.url).pathname;
  if (/^\/api\/tools\/disk\/files\/\d+\/download$/.test(path)) {
    await next();
    return;
  }
  // 优先 Authorization header，其次支持 ?token= query param（保留兼容）
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

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', d1_token: !!c.env.D1_API_TOKEN });
});

// ─── 配置管理 ───
// 所有业务配置集中存 D1 kbox_kv 表，敏感字段 AES-GCM 加密
// 三级降级：tool:<name> → app → env 兼容期 → 代码默认值

// 工具清单（用于前端渲染工具级覆盖 UI）
const TOOL_LIST = [
  { id: 'dispatch', name: 'GitHub Actions 触发' },
  { id: 'disk',     name: '微型云盘' },
  { id: 'stock',    name: '基金估值' },
  { id: 'news',     name: 'AI 新闻锐评' },
];

// 敏感值脱敏：用多个 * 号代替明文（不返回真实值）
function maskField(field: ConfigField, value: string | null) {
  if (value == null || value === '') {
    return { hasValue: false, value: null };
  }
  if (field.sensitive) {
    return { hasValue: true, value: '******' }; // 用 * 号脱敏，不返回明文
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
      // 空值 → 删除配置（回退到 env/默认）
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
    // 直接读工具级值（不经降级）
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
// 返回该 workflow 最近 N 次 runs（默认 1），用于"上次执行"和"实时执行"展示
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
// namespace = 'dispatch_configs'，key = '{token}:{id}'，value = { repo, workflow_id, branch, inputs }

interface DispatchConfig {
  id?: string;  // 存储时不带 id（id 作为 KV key），读取时由 list 拼回
  repo: string;
  workflow_id: string;
  branch: string;
  inputs: Array<[string, string]>;
  updated_at?: string;
}

const NS_DISPATCH = 'dispatch_configs';

function kvError(c: any) {
  return c.json({ error: getKvTableError() || 'KV 表初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 列出当前用户所有 dispatch 配置
app.get('/api/tools/dispatch-configs', async (c) => {
  const token = c.get('token');
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  try {
    const items = await kv.list<DispatchConfig>(NS_DISPATCH, token + ':');
    // key 格式 '{token}:{id}'，提取 id 拼到对象里
    const configs = items.map(item => ({
      ...item.value,
      id: item.key.split(':').slice(1).join(':'),
    }));
    return c.json({ configs });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return c.json({ error: e instanceof Error ? e.message : '获取配置失败' }, 500);
  }
});

// 新增配置（自动生成 id）
app.post('/api/tools/dispatch-configs', async (c) => {
  const token = c.get('token');
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
    await kv.set(NS_DISPATCH, token + ':' + id, config);
    return c.json({ ok: true, id, ...config });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
    return c.json({ error: e instanceof Error ? e.message : '保存配置失败' }, 500);
  }
});

// 删除配置
app.delete('/api/tools/dispatch-configs/:id', async (c) => {
  const token = c.get('token');
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const id = c.req.param('id');

  try {
    await kv.delete(NS_DISPATCH, token + ':' + id);
    return c.json({ ok: true });
  } catch (e) {
    if (getKvTableError()) return kvError(c);
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
    if (indent <= wdIndent) return []; // 离开 workflow_dispatch 块
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

    // 新 input key（缩进等于 inputsIndent）
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

    // 解析属性
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

    // data.content 是 base64 编码的文件内容
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
    // cron 触发：抓取新闻并 AI 锐评
    ctx.waitUntil(handleNewsCron(env));
  },
};

// news cron 任务：复用 news 工具的抓取逻辑
async function handleNewsCron(env: Bindings) {
  // 直接内联核心流程，避免 Hono 路由依赖
  try {
    const { createDb } = await import('./db');
    const { crawlAll } = await import('./tools/news-crawler');
    const { summarizeArticles } = await import('./tools/news-llm');

    const db = createDb(env.D1_API_TOKEN, env.D1_API_BASE);
    // 建表
    await db.query(`CREATE TABLE IF NOT EXISTS newsfeed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crawled_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general'
    )`);

    const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const articles = await crawlAll(env);
    if (articles.length === 0) {
      console.log('[news-cron] No articles crawled');
      return;
    }

    const existingRows = await db.queryAll<{ source: string; title: string }>(
      `SELECT DISTINCT source, title FROM newsfeed`
    );
    const existing = new Set<string>();
    for (const row of existingRows) {
      existing.add(`${row.source}||${row.title}`);
    }

    const seen = new Set<string>();
    const unique = articles.filter((a: any) => {
      const key = `${a.source}||${a.title}`;
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      console.log('[news-cron] All articles already exist');
      return;
    }

    // LLM 语义去重：识别"同一事件不同标题"并合并
    const { dedupeArticlesByLLM } = await import('./tools/news-llm');
    const deduped = await dedupeArticlesByLLM(env, unique);

    if (deduped.length === 0) {
      console.log('[news-cron] All articles deduped');
      return;
    }

    const summaries = await summarizeArticles(
      env,
      deduped.map((a: any) => ({ title: a.title, source: a.source })),
    );

    const CHUNK_SIZE = 15;
    for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, deduped.length);
      const placeholders: string[] = [];
      const values: any[] = [];
      for (let j = i; j < chunkEnd; j++) {
        placeholders.push('(?, ?, ?, ?, ?, ?)');
        const a = deduped[j];
        values.push(now, a.source, a.title, a.url, summaries[j] || '', a.category);
      }
      await db.execute(
        `INSERT INTO newsfeed (crawled_at, source, title, url, summary, category) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    await db.execute(
      `DELETE FROM newsfeed WHERE id NOT IN (
        SELECT id FROM newsfeed ORDER BY id DESC LIMIT ?
      )`,
      [60],
    );

    console.log(`[news-cron] Inserted ${deduped.length} articles`);
  } catch (e) {
    console.error('[news-cron] failed:', e instanceof Error ? e.message : String(e));
  }
}
