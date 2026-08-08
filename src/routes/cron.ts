// Cron 任务管理路由（软定时任务的 CRUD）

import { Hono } from 'hono';
import { listTasks, createTask, updateTask, deleteTask, triggerTask } from '../tools/cron-tasks';

type Bindings = {};

type Variables = {};

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get('/', async (c) => {
  try {
    const tasks = await listTasks(c.env);
    return c.json({ tasks });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '获取任务失败' }, 500);
  }
});

router.post('/', async (c) => {
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

router.put('/:id', async (c) => {
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

router.delete('/:id', async (c) => {
  try {
    await deleteTask(c.env, c.req.param('id'));
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '删除任务失败' }, 500);
  }
});

router.post('/:id/trigger', async (c) => {
  try {
    const result = await triggerTask(c.env, c.req.param('id'));
    return c.json(result, result.ok ? 200 : 500);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '触发失败' }, 500);
  }
});

export default router;