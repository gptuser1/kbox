import { createKv } from '../kv';
import { executeScript, getScriptById, saveScript, listScripts } from './js-runner';

export const NS_CRON_TASKS = 'cron_tasks';

export interface CronTask {
  id: string;
  name: string;
  scriptId: string;          // 关联的 JS 脚本 id（必填）
  everyMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus?: 'ok' | 'error';
  lastError?: string;
  createdAt: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowISO(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
}

function parseISO(ts: string | null): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return isNaN(t) ? 0 : t;
}

// 默认新闻抓取脚本（首次部署时作为示例脚本 + 关联任务一起创建）
const DEFAULT_NEWS_SCRIPT = `// 默认新闻抓取脚本（可自由编辑）
// kbox 注入：log/fetch/kv/news/stock/disk/now/sleep
const articles = await kbox.news.list(30);
kbox.log('最新新闻 ' + articles.length + ' 条');
for (const a of articles.slice(0, 5)) {
  kbox.log('• ' + a.title);
}
const top = await kbox.news.top();
kbox.log('Top 关键词：' + top.keywords.map(k => k.word).join(', '));
return { count: articles.length, top };
`;

// 首次部署迁移：若无任务，创建一个默认"新闻抓取"脚本 + 关联任务
export async function ensureDefaultTasks(env: any): Promise<void> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  try {
    const items = await kv.list<CronTask>(NS_CRON_TASKS);
    if (items.length > 0) return;

    // 1. 创建默认脚本（若已存在同名则复用）
    let scriptId: string | null = null;
    try {
      const scripts = await listScripts(env);
      const existing = scripts.find(s => s.name === '新闻抓取（默认）');
      if (existing) scriptId = existing.id;
    } catch { /* ignore */ }

    if (!scriptId) {
      const script = await saveScript(env, {
        name: '新闻抓取（默认）',
        desc: '抓取最新新闻并输出 Top 关键词',
        code: DEFAULT_NEWS_SCRIPT,
        icon: '📰',
        published: false,
      });
      scriptId = script.id;
    }

    // 2. 创建关联任务
    const defaultTask: CronTask = {
      id: genId(),
      name: '新闻抓取（默认）',
      scriptId,
      everyMinutes: 360,   // 6 小时
      enabled: true,
      lastRunAt: null,
      createdAt: nowISO(),
    };
    await kv.set(NS_CRON_TASKS, defaultTask.id, defaultTask);
    console.log('[cron] 默认任务已创建，关联脚本 ' + scriptId);
  } catch (e) {
    console.error('[cron] ensureDefaultTasks failed:', e instanceof Error ? e.message : e);
  }
}

// cron 调度入口
export async function runCronTasks(env: any): Promise<{ ran: number; skipped: number; errors: number }> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const result = { ran: 0, skipped: 0, errors: 0 };

  let items: Array<{ key: string; value: CronTask }>;
  try {
    items = await kv.list<CronTask>(NS_CRON_TASKS);
  } catch (e) {
    console.error('[cron] list tasks failed:', e instanceof Error ? e.message : e);
    return result;
  }

  const now = Date.now();
  for (const item of items) {
    const task = item.value;
    if (!task.enabled) { result.skipped++; continue; }

    const lastMs = parseISO(task.lastRunAt);
    const elapsedMin = (now - lastMs) / 60000;
    if (lastMs > 0 && elapsedMin < task.everyMinutes) {
      result.skipped++;
      continue;
    }

    try {
      const status = await runTask(env, task);
      task.lastRunAt = nowISO();
      task.lastStatus = status.ok ? 'ok' : 'error';
      task.lastError = status.error;
      await kv.set(NS_CRON_TASKS, task.id, task);
      if (status.ok) result.ran++;
      else result.errors++;
    } catch (e) {
      task.lastRunAt = nowISO();
      task.lastStatus = 'error';
      task.lastError = e instanceof Error ? e.message : String(e);
      await kv.set(NS_CRON_TASKS, task.id, task);
      result.errors++;
    }
  }
  return result;
}

async function runTask(env: any, task: CronTask): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!task.scriptId) return { ok: false, error: '任务缺少 scriptId' };
    const script = await getScriptById(env, task.scriptId);
    if (!script) return { ok: false, error: '关联脚本不存在' };
    const r = await executeScript(env, script.code, {});
    return { ok: !r.error, error: r.error?.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── CRUD 辅助函数（供路由使用） ───

export async function listTasks(env: any): Promise<CronTask[]> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const items = await kv.list<CronTask>(NS_CRON_TASKS);
  return items.map(i => ({ ...i.value, id: i.key }))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function createTask(env: any, data: Partial<CronTask>): Promise<CronTask> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  if (!data.scriptId) {
    throw new Error('必须指定 scriptId');
  }
  const task: CronTask = {
    id: genId(),
    name: (data.name || '').trim() || '未命名任务',
    scriptId: data.scriptId,
    everyMinutes: Math.max(5, Number(data.everyMinutes) || 60),
    enabled: data.enabled !== false,
    lastRunAt: null,
    createdAt: nowISO(),
  };
  await kv.set(NS_CRON_TASKS, task.id, task);
  return task;
}

export async function updateTask(env: any, id: string, data: Partial<CronTask>): Promise<CronTask | null> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const existing = await kv.get<CronTask>(NS_CRON_TASKS, id);
  if (!existing) return null;
  if (data.name !== undefined) existing.name = (data.name || '').trim() || existing.name;
  if (data.scriptId !== undefined) existing.scriptId = data.scriptId;
  if (data.everyMinutes !== undefined) existing.everyMinutes = Math.max(5, Number(data.everyMinutes) || 60);
  if (data.enabled !== undefined) existing.enabled = !!data.enabled;
  await kv.set(NS_CRON_TASKS, id, existing);
  return existing;
}

export async function deleteTask(env: any, id: string): Promise<boolean> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  await kv.delete(NS_CRON_TASKS, id);
  return true;
}

export async function triggerTask(env: any, id: string): Promise<{ ok: boolean; error?: string }> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const task = await kv.get<CronTask>(NS_CRON_TASKS, id);
  if (!task) return { ok: false, error: '任务不存在' };
  const status = await runTask(env, task);
  task.lastRunAt = nowISO();
  task.lastStatus = status.ok ? 'ok' : 'error';
  task.lastError = status.error;
  await kv.set(NS_CRON_TASKS, id, task);
  return status;
}
