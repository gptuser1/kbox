// GitHub Workflow Dispatch 路由：工作流列表、触发、运行状态、配置 CRUD

import { Hono } from 'hono';
import { getConfig } from '../services/config';
import { createKv } from '../services/kv';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

  while (i < lines.length) {
    if (/^\s*workflow_dispatch\s*:/.test(lines[i])) break;
    i++;
  }
  if (i >= lines.length) return [];

  const wdIndent = (lines[i].match(/^(\s*)/) || ['', ''])[1].length;
  i++;

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

// ─── 工作流列表 ───
router.get('/workflows', async (c) => {
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

// ─── 触发 workflow dispatch ───
router.post('/dispatch', async (c) => {
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
router.get('/workflow-runs', async (c) => {
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
      status: r.status,
      conclusion: r.conclusion,
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

// ─── 查询 workflow run 的 jobs 列表 ───
router.get('/workflow-run-jobs', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  const runId = c.req.query('run_id')?.trim();
  if (!owner || !repo || !runId) {
    return c.json({ error: '需要 owner、repo、run_id 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=100`,
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
    const jobs = (data.jobs || []).map((j: any) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.started_at,
      completed_at: j.completed_at,
      steps: (j.steps || []).map((s: any) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        number: s.number,
      })),
    }));
    return c.json({ jobs });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// ─── 获取 workflow job 的日志内容 ───
router.get('/workflow-run-logs', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  const jobId = c.req.query('job_id')?.trim();
  if (!owner || !repo || !jobId) {
    return c.json({ error: '需要 owner、repo、job_id 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    // GitHub API 返回 302 跳转到预签名 URL，需要手动跟随
    const redirectRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${encodeURIComponent(jobId)}/logs`,
      {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'kbox',
        },
        redirect: 'manual',
      }
    );
    const location = redirectRes.headers.get('location');
    if (!location) {
      return c.json({ error: '无法获取日志下载链接' }, 500);
    }
    // 跟随预签名 URL 获取日志内容
    const logRes = await fetch(location, { headers: { 'User-Agent': 'kbox' } });
    if (!logRes.ok) {
      return c.json({ error: `日志下载失败: HTTP ${logRes.status}` }, 500);
    }
    const logText = await logRes.text();
    return c.json({ log: logText });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// ─── Dispatch 配置 CRUD ───

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
router.get('/dispatch-configs', async (c) => {
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

// 新增配置
router.post('/dispatch-configs', async (c) => {
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
router.delete('/dispatch-configs/:id', async (c) => {
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

// ─── 列出仓库分支 ───
router.get('/branches', async (c) => {
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

// ─── 获取分支最新 commit 信息 ───
router.get('/branch-commit', async (c) => {
  const owner = c.req.query('owner')?.trim();
  const repo = c.req.query('repo')?.trim();
  const branch = c.req.query('branch')?.trim() || 'main';
  if (!owner || !repo) {
    return c.json({ error: '需要 owner 和 repo 参数' }, 400);
  }

  const ghToken = await getConfig(c, 'dispatch', 'gh_token');
  if (!ghToken) {
    return c.json({ error: '未配置 GitHub Token，请到配置管理设置 gh_token' }, 500);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
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
    if (!Array.isArray(data) || data.length === 0) {
      return c.json({ commit: null });
    }
    const item = data[0];
    return c.json({
      commit: {
        sha: item.sha,
        message: item.commit?.message?.split('\n')[0] || '',
        author: item.commit?.author?.name || '',
        date: item.commit?.author?.date || '',
        url: item.html_url || '',
      },
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '请求失败' }, 500);
  }
});

// ─── 获取 workflow inputs 定义 ───
router.get('/workflow-inputs', async (c) => {
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

export default router;