import { createKv } from '../kv';
import { runCron as runNewsCron } from './news';
import { executeScript, getScriptById } from './js-runner';

export const NS_CRON_TASKS = 'cron_tasks';

export interface CronTask {
  id: string;
  name: string;
  type: 'news' | 'script';
  everyMinutes: number;
  enabled: boolean;
  scriptId?: string;
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

// 首次部署迁移：若任务表为空，插入默认 news 任务
export async function ensureDefaultTasks(env: any): Promise<void> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  try {
    const items = await kv.list<CronTask>(NS_CRON_TASKS);
    if (items.length > 0) return;
    const defaultTask: CronTask = {
      id: genId(),
      name: '新闻抓取（默认）',
      type: 'news',
      everyMinutes: 360,   // 6 小时，对应原 4 次/天
      enabled: true,
      lastRunAt: null,
      createdAt: nowISO(),
    };
    await kv.set(NS_CRON_TASKS, defaultTask.id, defaultTask);
    console.log('[cron] 默认 news 任务已创建');
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

    // 到期，执行
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
    if (task.type === 'news') {
      const r = await runNewsCron({ env });
      return { ok: r.success, error: r.error };
    }
    if (task.type === 'script') {
      if (!task.scriptId) return { ok: false, error: '脚本任务缺少 scriptId' };
      const script = await getScriptById(env, task.scriptId);
      if (!script) return { ok: false, error: '脚本不存在' };
      const r = await executeScript(env, script.code, {});
      return { ok: !r.error, error: r.error?.message };
    }
    return { ok: false, error: '未知任务类型: ' + task.type };
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
  const task: CronTask = {
    id: genId(),
    name: (data.name || '').trim() || '未命名任务',
    type: data.type === 'script' ? 'script' : 'news',
    everyMinutes: Math.max(5, Number(data.everyMinutes) || 60),
    enabled: data.enabled !== false,
    scriptId: data.scriptId,
    lastRunAt: null,
    createdAt: nowISO(),
  };
  if (task.type === 'script' && !task.scriptId) {
    throw new Error('script 任务必须指定 scriptId');
  }
  await kv.set(NS_CRON_TASKS, task.id, task);
  return task;
}

export async function updateTask(env: any, id: string, data: Partial<CronTask>): Promise<CronTask | null> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const existing = await kv.get<CronTask>(NS_CRON_TASKS, id);
  if (!existing) return null;
  if (data.name !== undefined) existing.name = (data.name || '').trim() || existing.name;
  if (data.type !== undefined) existing.type = data.type === 'script' ? 'script' : 'news';
  if (data.everyMinutes !== undefined) existing.everyMinutes = Math.max(5, Number(data.everyMinutes) || 60);
  if (data.enabled !== undefined) existing.enabled = !!data.enabled;
  if (data.scriptId !== undefined) existing.scriptId = data.scriptId;
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
