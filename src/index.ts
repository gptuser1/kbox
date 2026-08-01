import { Hono } from 'hono';
import { renderFrontend } from './frontend';
import disk from './tools/cloud-disk';

type Bindings = {
  ACCESS_TOKEN: string;
  GH_TOKEN: string;
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
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

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', gh_token: !!c.env.GH_TOKEN });
});

// ─── GitHub Workflow Dispatch 工具 ───

// 列出仓库的 workflows
app.get('/api/tools/workflows', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  if (!owner || !repo) {
    return c.json({ error: '需要 owner 和 repo 参数' }, 400);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.GH_TOKEN}`,
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

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow_id)}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.GH_TOKEN}`,
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

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.GH_TOKEN}`,
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

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.GH_TOKEN}`,
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

export default app;
