import { createKv } from '../kv';
import { runCron as runNewsCrawl } from './news';

export const NS_CRON_TASKS = 'cron_tasks';

// 可设为定时任务的 action 清单：只有仓库里已有的原生动作才能被定时触发
export const CRON_ACTIONS: Record<string, string> = {
  news_crawl: '新闻抓取',
};

export interface CronTask {
  id: string;
  name: string;
  action: string;            // 原生任务类型，见 CRON_ACTIONS
  hours: number[];           // 触发小时（0-23，北京时间），空数组表示每小时都触发
  enabled: boolean;
  lastRunAt: number | null;
  lastStatus?: 'ok' | 'error';
  lastError?: string;
  createdAt: number;
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function nowUnix(): number {
  return Date.now();
}

// 当前北京时间的小时（0-23）
export function currentHourCN(): number {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return d.getUTCHours();
}

export function normalizeHours(input: any): number[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  for (const h of input) {
    const n = Number(h);
    if (Number.isInteger(n) && n >= 0 && n <= 23) seen.add(n);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

// cron 调度入口：每小时触发一次，按当前小时匹配任务的 hours 字段
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

  const hour = currentHourCN();
  const now = Date.now();
  for (const item of items) {
    const task = item.value;
    if (!task.enabled) { result.skipped++; continue; }

    // 小时槽位匹配：hours 为空表示每小时都触发；否则需命中当前小时
    const hours = Array.isArray(task.hours) ? task.hours : [];
    if (hours.length > 0 && !hours.includes(hour)) {
      result.skipped++;
      continue;
    }

    // 防同一小时内重复执行（cron 每小时一次，理论上不会重复，保险起见）
    if (task.lastRunAt && task.lastRunAt > 0 && (now - task.lastRunAt) < 55 * 60 * 1000) {
      result.skipped++;
      continue;
    }

    try {
      const status = await runTask(env, task);
      task.lastRunAt = nowUnix();
      task.lastStatus = status.ok ? 'ok' : 'error';
      task.lastError = status.error;
      await kv.set(NS_CRON_TASKS, task.id, task);
      if (status.ok) result.ran++;
      else result.errors++;
    } catch (e) {
      task.lastRunAt = nowUnix();
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
    if (!task.action) return { ok: false, error: '任务缺少 action' };
    switch (task.action) {
      case 'news_crawl': {
        const r = await runNewsCrawl(env);
        return { ok: r.success, error: r.error };
      }
      default:
        return { ok: false, error: '未知任务类型：' + task.action };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── CRUD 辅助函数（供路由使用） ───

export async function listTasks(env: any): Promise<CronTask[]> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const items = await kv.list<CronTask>(NS_CRON_TASKS);
  return items.map(i => ({ ...i.value, id: i.key }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createTask(env: any, data: Partial<CronTask>): Promise<CronTask> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  if (!data.action || !CRON_ACTIONS[data.action]) {
    throw new Error('action 必须是 ' + Object.keys(CRON_ACTIONS).join('/'));
  }
  const task: CronTask = {
    id: genId(),
    name: (data.name || '').trim() || CRON_ACTIONS[data.action],
    action: data.action,
    hours: normalizeHours(data.hours),
    enabled: data.enabled !== false,
    lastRunAt: null,
    createdAt: nowUnix(),
  };
  await kv.set(NS_CRON_TASKS, task.id, task);
  return task;
}

export async function updateTask(env: any, id: string, data: Partial<CronTask>): Promise<CronTask | null> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  const existing = await kv.getJson<CronTask>(NS_CRON_TASKS, id);
  if (!existing) return null;
  if (data.name !== undefined) existing.name = (data.name || '').trim() || existing.name;
  if (data.action !== undefined && CRON_ACTIONS[data.action]) existing.action = data.action;
  if (data.hours !== undefined) existing.hours = normalizeHours(data.hours);
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
  const task = await kv.getJson<CronTask>(NS_CRON_TASKS, id);
  if (!task) return { ok: false, error: '任务不存在' };
  const status = await runTask(env, task);
  task.lastRunAt = nowUnix();
  task.lastStatus = status.ok ? 'ok' : 'error';
  task.lastError = status.error;
  await kv.set(NS_CRON_TASKS, id, task);
  return status;
}
