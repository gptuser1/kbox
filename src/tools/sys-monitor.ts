import { Hono } from 'hono';
import { createKv } from '../kv';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const NS_HOSTS = 'sys_monitor:hosts';
const NS_HISTORY = 'sys_monitor:history';
const HISTORY_MAX = 500; // 每主机最多保留最近 N 条

interface HostRecord {
  hostname: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  data: Record<string, any>;
}

interface HistoryEntry {
  hostname: string;
  timestamp: string;
  data: Record<string, any>;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function kv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── 客户端上报 ───
app.post('/report', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的 JSON' }, 400);
  }

  const hostname = (body.hostname || '').trim();
  if (!hostname) {
    return c.json({ error: '缺少 hostname 字段' }, 400);
  }

  const reportData = body.data || {};
  const ts = nowISO();
  const k = kv(c);

  // 读取或初始化主机记录
  let host: HostRecord | null = null;
  try {
    host = await k.getJson<HostRecord>(NS_HOSTS, hostname);
  } catch { /* 不存在 */ }

  const now: HostRecord = host
    ? { ...host, lastSeen: ts }
    : { hostname, name: hostname, firstSeen: ts, lastSeen: ts, data: {} };
  // 合并：客户端上报的字段覆盖旧值，未上报的字段保留旧值
  for (const key of Object.keys(reportData)) {
    now.data[key] = reportData[key];
  }
  // 删除客户端明确上报为 null 的字段
  for (const key of Object.keys(reportData)) {
    if (reportData[key] === null) delete now.data[key];
  }

  await k.set(NS_HOSTS, hostname, now);

  // 写入历史
  const historyKey = hostname + ':' + ts;
  const entry: HistoryEntry = { hostname, timestamp: ts, data: reportData };
  await k.set(NS_HISTORY, historyKey, entry);

  // 清理超量历史（懒删除）
  try {
    const all = await k.list(NS_HISTORY, hostname + ':');
    if (all.length > HISTORY_MAX) {
      // 按 key 排序，删除最早的
      all.sort((a, b) => a.key.localeCompare(b.key));
      const toDelete = all.length - HISTORY_MAX;
      for (let i = 0; i < toDelete; i++) {
        await k.delete(NS_HISTORY, all[i].key);
      }
    }
  } catch { /* 清理失败忽略 */ }

  return c.json({ ok: true, hostname });
});

// ─── 列出所有主机 ───
app.get('/hosts', async (c) => {
  const k = kv(c);
  try {
    const items = await k.list<HostRecord>(NS_HOSTS);
    const hosts = items.map(item => ({
      id: item.key,
      hostname: item.value.hostname,
      name: item.value.name,
      firstSeen: item.value.firstSeen,
      lastSeen: item.value.lastSeen,
      data: item.value.data,
    }));
    // 按 lastSeen 降序
    hosts.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    return c.json({ hosts });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '查询失败' }, 500);
  }
});

// ─── 查询单个主机详情 + 历史 ───
app.get('/hosts/:id', async (c) => {
  const id = c.req.param('id');
  const k = kv(c);

  let host: HostRecord | null = null;
  try {
    host = await k.getJson<HostRecord>(NS_HOSTS, id);
  } catch { /* 忽略 */ }
  if (!host) return c.json({ error: '主机不存在' }, 404);

  const historyItems = await k.list<HistoryEntry>(NS_HISTORY, id + ':');
  historyItems.sort((a, b) => a.key.localeCompare(b.key));

  // 只返回最近 100 条
  const recent = historyItems.slice(-100).map(item => ({
    timestamp: item.value.timestamp,
    data: item.value.data,
  }));

  return c.json({
    host: {
      id,
      hostname: host.hostname,
      name: host.name,
      firstSeen: host.firstSeen,
      lastSeen: host.lastSeen,
      data: host.data,
    },
    history: recent,
  });
});

// ─── 重命名主机 ───
app.put('/hosts/:id', async (c) => {
  const id = c.req.param('id');
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: '请求体必须是有效的 JSON' }, 400);
  }

  const name = (body.name || '').trim();
  if (!name) return c.json({ error: '缺少 name 字段' }, 400);

  const k = kv(c);
  let host: HostRecord | null = null;
  try {
    host = await k.getJson<HostRecord>(NS_HOSTS, id);
  } catch { /* 忽略 */ }
  if (!host) return c.json({ error: '主机不存在' }, 404);

  host.name = name;
  await k.set(NS_HOSTS, id, host);
  return c.json({ ok: true, name });
});

// ─── 删除主机 ───
app.delete('/hosts/:id', async (c) => {
  const id = c.req.param('id');
  const k = kv(c);

  await k.delete(NS_HOSTS, id);

  // 删除历史
  try {
    const items = await k.list(NS_HISTORY, id + ':');
    for (const item of items) {
      await k.delete(NS_HISTORY, item.key);
    }
  } catch { /* 忽略 */ }

  return c.json({ ok: true });
});

export default app;