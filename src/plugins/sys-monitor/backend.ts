import { Hono } from 'hono';
import { createKv } from '../../services/kv';
import { getConfig } from '../../services/config';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const NS_HOSTS = 'sys_monitor:hosts';
const DEFAULT_HISTORY_MAX = 60;
const DEFAULT_ONLINE_TIMEOUT_MIN = 30;

// 从插件级配置读取，带默认值
async function historyMax(c: any): Promise<number> {
  const val = await getConfig(c, 'sys-monitor', 'sys_monitor_history_max');
  const n = parseInt(val || '', 10);
  return (!isNaN(n) && n > 0) ? n : DEFAULT_HISTORY_MAX;
}

async function onlineTimeoutMin(c: any): Promise<number> {
  const val = await getConfig(c, 'sys-monitor', 'sys_monitor_online_timeout');
  const n = parseInt(val || '', 10);
  return (!isNaN(n) && n > 0) ? n : DEFAULT_ONLINE_TIMEOUT_MIN;
}

// ─── 指标 Schema 定义 ───
// 服务端预定义所有可解析的指标，知道每个字段属于哪个分类、什么类型、什么单位
// 客户端选择性上报，服务端按此 schema 解析归类
interface MetricDef {
  key: string;
  category: string;
  label: string;
  type: 'percent' | 'bytes' | 'kb' | 'mb' | 'number' | 'float' | 'string' | 'temp';
  unit?: string;
  warn?: number;
  crit?: number;
  summary?: boolean;
}

export const METRIC_SCHEMA: MetricDef[] = [
  { key: 'cpu_usage', category: 'CPU', label: 'CPU 使用率', type: 'percent', unit: '%', warn: 70, crit: 90, summary: true },
  { key: 'cpu_cores', category: 'CPU', label: 'CPU 核数', type: 'number', unit: '核' },
  { key: 'cpu_temp', category: 'CPU', label: 'CPU 温度', type: 'temp', unit: '°C', warn: 60, crit: 80 },
  { key: 'mem_usage', category: '内存', label: '内存使用率', type: 'percent', unit: '%', warn: 70, crit: 90, summary: true },
  { key: 'mem_total_mb', category: '内存', label: '内存总量', type: 'mb', unit: 'MB' },
  { key: 'mem_used_mb', category: '内存', label: '内存已用', type: 'mb', unit: 'MB' },
  { key: 'swap_usage', category: '内存', label: 'Swap 使用率', type: 'percent', unit: '%', warn: 50, crit: 80 },
  { key: 'disk_usage', category: '磁盘', label: '磁盘使用率', type: 'percent', unit: '%', warn: 80, crit: 95, summary: true },
  { key: 'disk_total_kb', category: '磁盘', label: '磁盘总量', type: 'kb', unit: 'KB' },
  { key: 'disk_used_kb', category: '磁盘', label: '磁盘已用', type: 'kb', unit: 'KB' },
  { key: 'load_1m', category: '负载', label: '1分钟负载', type: 'float' },
  { key: 'load_5m', category: '负载', label: '5分钟负载', type: 'float' },
  { key: 'load_15m', category: '负载', label: '15分钟负载', type: 'float' },
  { key: 'processes', category: '负载', label: '进程数', type: 'number' },
  { key: 'net_iface', category: '网络', label: '网络接口', type: 'string' },
  { key: 'lan_ipv4', category: '网络', label: '内网 IPv4', type: 'string' },
  { key: 'net_rx_bytes', category: '网络', label: '接收总量', type: 'bytes', unit: 'B' },
  { key: 'net_tx_bytes', category: '网络', label: '发送总量', type: 'bytes', unit: 'B' },
  { key: 'uptime_seconds', category: '系统', label: '运行时长', type: 'number', unit: 's' },
];

export const SCHEMA_MAP: Record<string, MetricDef> = {};
for (const m of METRIC_SCHEMA) SCHEMA_MAP[m.key] = m;

const CATEGORIES = ['CPU', '内存', '磁盘', '负载', '网络', '系统'];

// ─── 数据模型 ───
// 每个主机存为一个 KV，key 为 hostname，value 包含主机信息 + 历史数组（FIFO）

interface HistoryEntry {
  ts: number; // ms unix 时间戳
  data: Record<string, any>;
}

interface HostRecord {
  hostname: string;
  name: string;
  firstSeen: number; // ms unix 时间戳
  lastSeen: number;  // ms unix 时间戳
  data: Record<string, any>; // 最新合并的指标数据
  extra: string | null; // 最近一次 extra，只保留最新值，无历史
  history: HistoryEntry[]; // FIFO 数组，按配置最大数量限制
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function kv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE, 'monitor');
}

function nowMs(): number {
  return Date.now();
}

// 自定义指标：从 extra 中解析约定 JSON 得到的数据名 / 类型 / 值
interface CustomMetric {
  name: string;
  type: string;
  value: any;
}

// extra 约定 JSON 格式：{"custom": [{"name":"数据名","type":"number|string","value":...}]}
// 解析成功返回指标数组；JSON 解析失败或结构与约定不符返回 null（按任意字符串处理）
const CUSTOM_PREFIX = 'custom.';

export function parseCustomExtra(extra: string): CustomMetric[] | null {
  let obj: any;
  try {
    obj = JSON.parse(extra);
  } catch {
    return null; // 非 JSON：按任意字符串处理
  }
  // JSON 但与约定结构不符：同样按任意字符串处理
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.custom)) return null;
  const out: CustomMetric[] = [];
  for (const it of obj.custom) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
    const name = typeof it.name === 'string' ? it.name.trim() : '';
    const type = typeof it.type === 'string' ? it.type.trim() : '';
    if (!name || !type) return null;
    out.push({ name, type, value: it.value });
  }
  return out;
}

// 按 schema 解析原始 data，返回结构化的分类指标
export function parseMetrics(data: Record<string, any>): Record<string, { label: string; metrics: { key: string; label: string; type: string; value: any; unit?: string; warn?: number; crit?: number }[] }> {
  const result: Record<string, { label: string; metrics: any[] }> = {};
  for (const cat of CATEGORIES) result[cat] = { label: cat, metrics: [] };

  const others: any[] = [];

  for (const [key, val] of Object.entries(data)) {
    if (val == null) continue;
    const def = SCHEMA_MAP[key];
    if (def) {
      result[def.category].metrics.push({
        key: def.key, label: def.label, type: def.type,
        value: val, unit: def.unit, warn: def.warn, crit: def.crit,
      });
    } else if (key.startsWith(CUSTOM_PREFIX)) {
      // 自定义指标：归入「自定义」分类，label 用客户端给的数据名，类型按实际值推导
      const customCat = (result['自定义'] || (result['自定义'] = { label: '自定义', metrics: [] }));
      customCat.metrics.push({
        key, label: key.slice(CUSTOM_PREFIX.length),
        type: typeof val === 'number' ? 'number' : 'string',
        value: val,
      });
    } else {
      others.push({ key, label: key, type: 'string', value: val });
    }
  }

  for (const cat of CATEGORIES) {
    if (result[cat].metrics.length === 0) delete result[cat];
  }
  if (others.length > 0) result['其他'] = { label: '其他', metrics: others };

  return result;
}

// 提取摘要指标（用于列表页）
export function extractSummary(data: Record<string, any>): { key: string; label: string; value: any; unit?: string; warn?: number; crit?: number }[] {
  const summary: any[] = [];
  for (const def of METRIC_SCHEMA) {
    if (def.summary && data[def.key] != null) {
      summary.push({ key: def.key, label: def.label, value: data[def.key], unit: def.unit, warn: def.warn, crit: def.crit });
    }
  }
  return summary;
}

export async function isOnline(c: any, lastSeen: number): Promise<boolean> {
  const timeout = await onlineTimeoutMin(c);
  return Date.now() - lastSeen < timeout * 60 * 1000;
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

  let reportData = body.data || {};
  const extra = typeof body.extra === 'string' ? body.extra : null;
  // 若 extra 是约定的自定义指标 JSON，解析并合并进 data，与常规指标一致处理（含历史趋势）
  const customMetrics = extra !== null ? parseCustomExtra(extra) : null;
  if (customMetrics) {
    reportData = { ...reportData };
    for (const cm of customMetrics) {
      if (cm.value === null) continue;
      reportData[`${CUSTOM_PREFIX}${cm.name}`] = cm.value;
    }
  }
  const ts = nowMs();
  const k = kv(c);

  let host: HostRecord | null = null;
  try {
    host = await k.getJson<HostRecord>(NS_HOSTS, hostname);
  } catch { /* 不存在 */ }

  if (host) {
    // 更新已有主机
    host.lastSeen = ts;
    // 合并：客户端上报的字段覆盖旧值
    for (const key of Object.keys(reportData)) {
      if (reportData[key] === null) {
        delete host.data[key];
      } else {
        host.data[key] = reportData[key];
      }
    }
    // extra 只保留最新值
    if (extra !== null) host.extra = extra;
  } else {
    // 新主机
    host = {
      hostname,
      name: hostname,
      firstSeen: ts,
      lastSeen: ts,
      data: { ...reportData },
      extra: extra,
      history: [],
    };
    // 清除 null 值
    for (const key of Object.keys(host.data)) {
      if (host.data[key] === null) delete host.data[key];
    }
  }

  // 添加历史记录（FIFO）
  host.history.push({ ts, data: reportData });
  const maxHistory = await historyMax(c);
  if (host.history.length > maxHistory) {
    host.history = host.history.slice(-maxHistory);
  }

  await k.set(NS_HOSTS, hostname, host);

  return c.json({ ok: true, hostname });
});

// ─── 列出所有主机（含摘要指标） ───
app.get('/hosts', async (c) => {
  const k = kv(c);
  try {
    const items = await k.list<HostRecord>(NS_HOSTS);
    const hosts = (await Promise.all(items.map(async (item) => ({
      id: item.key,
      hostname: item.value.hostname,
      name: item.value.name,
      firstSeen: item.value.firstSeen,
      lastSeen: item.value.lastSeen,
      online: await isOnline(c, item.value.lastSeen),
      summary: extractSummary(item.value.data),
      hasExtra: !!item.value.extra,
    }))));
    hosts.sort((a, b) => b.lastSeen - a.lastSeen);
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

  return c.json({
    host: {
      id,
      hostname: host.hostname,
      name: host.name,
      firstSeen: host.firstSeen,
      lastSeen: host.lastSeen,
      online: await isOnline(c, host.lastSeen),
      categories: parseMetrics(host.data),
      extra: host.extra,
    },
    history: host.history.slice(-100),
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
  return c.json({ ok: true });
});

import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

const sysMonitorPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default sysMonitorPlugin;
