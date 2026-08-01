import { Hono } from 'hono';
import { renderFrontend } from './frontend';

type Bindings = {
  ACCESS_TOKEN: string;
  GH_TOKEN: string;
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
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: '缺少Authorization头，格式: Bearer <token>' }, 401);
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return c.json({ error: '令牌不能为空' }, 401);
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

export default app;
