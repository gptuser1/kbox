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
const HISTORY_MAX = 500;
const ONLINE_THRESHOLD_MIN = 10;

// ─── 指标 Schema 定义 ───
// 服务端预定义所有可解析的指标，知道每个字段属于哪个分类、什么类型、什么单位
// 客户端选择性上报，服务端按此 schema 解析归类
interface MetricDef {
  key: string;
  category: string;
  label: string;
  type: 'percent' | 'bytes' | 'kb' | 'mb' | 'number' | 'float' | 'string' | 'temp';
  unit?: string;
  // 百分比类指标的阈值着色
  warn?: number;
  crit?: number;
  // 是否在列表页摘要中显示
  summary?: boolean;
}

const METRIC_SCHEMA: MetricDef[] = [
  // CPU
  { key: 'cpu_usage', category: 'CPU', label: 'CPU 使用率', type: 'percent', unit: '%', warn: 70, crit: 90, summary: true },
  { key: 'cpu_cores', category: 'CPU', label: 'CPU 核数', type: 'number', unit: '核' },
  { key: 'cpu_temp', category: 'CPU', label: 'CPU 温度', type: 'temp', unit: '°C', warn: 60, crit: 80 },
  // 内存
  { key: 'mem_usage', category: '内存', label: '内存使用率', type: 'percent', unit: '%', warn: 70, crit: 90, summary: true },
  { key: 'mem_total_mb', category: '内存', label: '内存总量', type: 'mb', unit: 'MB' },
  { key: 'mem_used_mb', category: '内存', label: '内存已用', type: 'mb', unit: 'MB' },
  { key: 'swap_usage', category: '内存', label: 'Swap 使用率', type: 'percent', unit: '%', warn: 50, crit: 80 },
  // 磁盘
  { key: 'disk_usage', category: '磁盘', label: '磁盘使用率', type: 'percent', unit: '%', warn: 80, crit: 95, summary: true },
  { key: 'disk_total_kb', category: '磁盘', label: '磁盘总量', type: 'kb', unit: 'KB' },
  { key: 'disk_used_kb', category: '磁盘', label: '磁盘已用', type: 'kb', unit: 'KB' },
  // 负载
  { key: 'load_1m', category: '负载', label: '1分钟负载', type: 'float' },
  { key: 'load_5m', category: '负载', label: '5分钟负载', type: 'float' },
  { key: 'load_15m', category: '负载', label: '15分钟负载', type: 'float' },
  { key: 'processes', category: '负载', label: '进程数', type: 'number' },
  // 网络
  { key: 'net_iface', category: '网络', label: '网络接口', type: 'string' },
  { key: 'net_rx_bytes', category: '网络', label: '接收总量', type: 'bytes', unit: 'B' },
  { key: 'net_tx_bytes', category: '网络', label: '发送总量', type: 'bytes', unit: 'B' },
  { key: 'uptime_seconds', category: '系统', label: '运行时长', type: 'number', unit: 's' },
];

const SCHEMA_MAP: Record<string, MetricDef> = {};
for (const m of METRIC_SCHEMA) SCHEMA_MAP[m.key] = m;

const CATEGORIES = ['CPU', '内存', '磁盘', '负载', '网络', '系统'];

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

// 按 schema 解析原始 data，返回结构化的分类指标
function parseMetrics(data: Record<string, any>): Record<string, { label: string; metrics: { key: string; label: string; type: string; value: any; unit?: string; warn?: number; crit?: number }[] }> {
  const result: Record<string, { label: string; metrics: any[] }> = {};
  for (const cat of CATEGORIES) result[cat] = { label: cat, metrics: [] };

  // 未识别字段归入 "其他"
  const others: any[] = [];

  for (const [key, val] of Object.entries(data)) {
    if (val == null) continue;
    const def = SCHEMA_MAP[key];
    if (def) {
      result[def.category].metrics.push({
        key: def.key,
        label: def.label,
        type: def.type,
        value: val,
        unit: def.unit,
        warn: def.warn,
        crit: def.crit,
      });
    } else {
      others.push({ key, label: key, type: 'string', value: val });
    }
  }

  // 移除空分类
  for (const cat of CATEGORIES) {
    if (result[cat].metrics.length === 0) delete result[cat];
  }
  if (others.length > 0) result['其他'] = { label: '其他', metrics: others };

  return result;
}

// 提取摘要指标（用于列表页）
function extractSummary(data: Record<string, any>): { key: string; label: string; value: any; unit?: string; warn?: number; crit?: number }[] {
  const summary: any[] = [];
  for (const def of METRIC_SCHEMA) {
    if (def.summary && data[def.key] != null) {
      summary.push({ key: def.key, label: def.label, value: data[def.key], unit: def.unit, warn: def.warn, crit: def.crit });
    }
  }
  return summary;
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MIN * 60 * 1000;
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

  let host: HostRecord | null = null;
  try {
    host = await k.getJson<HostRecord>(NS_HOSTS, hostname);
  } catch { /* 不存在 */ }

  const now: HostRecord = host
    ? { ...host, lastSeen: ts }
    : { hostname, name: hostname, firstSeen: ts, lastSeen: ts, data: {} };

  // 合并：客户端上报的字段覆盖旧值
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

  // 清理超量历史
  try {
    const all = await k.list(NS_HISTORY, hostname + ':');
    if (all.length > HISTORY_MAX) {
      all.sort((a, b) => a.key.localeCompare(b.key));
      const toDelete = all.length - HISTORY_MAX;
      for (let i = 0; i < toDelete; i++) {
        await k.delete(NS_HISTORY, all[i].key);
      }
    }
  } catch { /* 清理失败忽略 */ }

  return c.json({ ok: true, hostname });
});

// ─── 列出所有主机（含摘要指标） ───
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
      online: isOnline(item.value.lastSeen),
      summary: extractSummary(item.value.data),
    }));
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
      online: isOnline(host.lastSeen),
      categories: parseMetrics(host.data),
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

  try {
    const items = await k.list(NS_HISTORY, id + ':');
    for (const item of items) {
      await k.delete(NS_HISTORY, item.key);
    }
  } catch { /* 忽略 */ }

  return c.json({ ok: true });
});

export default app;
