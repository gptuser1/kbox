import { Hono } from 'hono';
import { createDb } from '../../abstraction/d1';
import { getConfig, masterKey } from '../../services/config';

type Bindings = {
  SECRET: SecretsStoreSecret;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const DEFAULT_HISTORY_MAX = 60;
const DEFAULT_ONLINE_TIMEOUT_MIN = 30;

// ─── 关系化表 ───
// 从「整条 host + history 塞一个 JSON blob」改为两张规范化表：
//  - kbox_sm_hosts: 每主机一行，只存最新合并数据，不含历史
//  - kbox_sm_history: 每主机每次上报一行，供历史趋势走索引查询
//
// 旧数据迁移（手动执行，从 kbox_kv 的 sys_monitor:hosts blob 拆到新表）：
// 对每个旧主机，把下面两条 SQL 中的 'WS1608' 换成实际 hostname 后执行。
//   hosts 行：
//   INSERT INTO kbox_sm_hosts (hostname, name, first_seen, last_seen, data_json, extra, custom_schema_json)
//   SELECT
//     json_extract(value, '$.hostname') AS hostname,
//     COALESCE(json_extract(value, '$.name'), json_extract(value, '$.hostname')) AS name,
//     COALESCE(json_extract(value, '$.firstSeen'), 0) AS first_seen,
//     COALESCE(json_extract(value, '$.lastSeen'), 0) AS last_seen,
//     COALESCE(json_extract(value, '$.data'), '{}') AS data_json,
//     json_extract(value, '$.extra') AS extra,
//     json_extract(value, '$.customSchema') AS custom_schema_json
//   FROM kbox_kv
//   WHERE namespace = 'sys_monitor:hosts' AND key = 'WS1608'
//   ON CONFLICT(hostname) DO UPDATE SET
//     name = excluded.name, first_seen = excluded.first_seen, last_seen = excluded.last_seen,
//     data_json = excluded.data_json, extra = excluded.extra, custom_schema_json = excluded.custom_schema_json;
//
//   history 行：
//   INSERT INTO kbox_sm_history (hostname, ts, data_json)
//   SELECT
//     json_extract(kv.value, '$.hostname') AS hostname,
//     json_extract(h.value, '$.ts') AS ts,
//     COALESCE(json_extract(h.value, '$.data'), '{}') AS data_json
//   FROM kbox_kv AS kv, json_each(kv.value, '$.history') AS h
//   WHERE kv.namespace = 'sys_monitor:hosts' AND kv.key = 'WS1608'
//   ON CONFLICT(hostname, ts) DO UPDATE SET data_json = excluded.data_json;
const T_HOSTS = 'kbox_sm_hosts';
const T_HISTORY = 'kbox_sm_history';

type Db = ReturnType<typeof createDb>;

// 按连接缓存建表状态
const smReady = new Map<string, boolean>();

function connKey(token: string, base?: string): string {
  return token + '|' + (base || '');
}

// 重置表就绪状态（仅测试用）
export function _resetSmState() {
  smReady.clear();
}

// 幂等建表（IF NOT EXISTS）
function ensureSql(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${T_HOSTS} (
      hostname TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      extra TEXT,
      custom_schema_json TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${T_HISTORY} (
      hostname TEXT NOT NULL,
      ts INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      PRIMARY KEY (hostname, ts)
    )`,
  ];
}

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
// kbox_sm_hosts 行对应的内存形态（不含 history；history 在 kbox_sm_history）
interface HostRow {
  hostname: string;
  name: string;
  firstSeen: number;
  lastSeen: number;
  data: Record<string, any>;
  extra: string | null;
  customSchema?: Record<string, CustomDef>;
}

interface HistoryEntry {
  ts: number; // ms unix 时间戳
  data: Record<string, any>;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function db(c: any): Promise<Db> {
  return createDb(await masterKey(c), c.env.D1_API_BASE, 'monitor');
}

function nowMs(): number {
  return Date.now();
}

// ─── 自定义指标 ───
// 客户端通过 custom 约定 JSON 动态注册指标，字段对齐 MetricDef：
//   {"category":"系统","custom":[{"label":"电量","type":"percent","value":61,"unit":"%","warn":30,"crit":10,"summary":true}]}
// - 顶层 category 可选：指定这些指标展示的分类卡片，缺省放「自定义」
// - 每项字段：label(数据名，必填)、type(对齐 MetricDef，必填)、value(必填)、unit/warn/crit/summary(可选)
// 解析成功返回 {category, items}；JSON 解析失败或结构与约定不符返回 null（按任意字符串处理）
const CUSTOM_PREFIX = 'custom.';
const CUSTOM_TYPES: MetricDef['type'][] = ['percent', 'bytes', 'kb', 'mb', 'number', 'float', 'string', 'temp'];

interface CustomDef {
  key: string;       // custom.<label>
  category: string;  // 展示分类卡片
  label: string;
  type: MetricDef['type'];
  unit?: string;
  warn?: number;
  crit?: number;
  summary?: boolean;
}

interface ParsedCustomItem {
  def: Omit<CustomDef, 'key' | 'category'>;
  value: any;
}

export function parseCustomExtra(extra: string): { category: string | null; items: ParsedCustomItem[] } | null {
  let obj: any;
  try {
    obj = JSON.parse(extra);
  } catch {
    return null; // 非 JSON：按任意字符串处理
  }
  // JSON 但与约定结构不符：同样按任意字符串处理
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.custom)) return null;
  const category = typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim() : null;
  const items: ParsedCustomItem[] = [];
  for (const it of obj.custom) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
    const label = typeof it.label === 'string' ? it.label.trim() : '';
    const rawType = typeof it.type === 'string' ? it.type.trim() : '';
    if (!label || !rawType || !(CUSTOM_TYPES as readonly string[]).includes(rawType)) return null;
    const def: Omit<CustomDef, 'key' | 'category'> = { label, type: rawType as MetricDef['type'] };
    if (typeof it.unit === 'string' && it.unit) def.unit = it.unit;
    if (typeof it.warn === 'number') def.warn = it.warn;
    if (typeof it.crit === 'number') def.crit = it.crit;
    if (typeof it.summary === 'boolean') def.summary = it.summary;
    items.push({ def, value: it.value });
  }
  return { category, items };
}

// 按 schema 解析原始 data，返回结构化的分类指标
export function parseMetrics(data: Record<string, any>, customSchema?: Record<string, CustomDef>): Record<string, { label: string; metrics: { key: string; label: string; type: string; value: any; unit?: string; warn?: number; crit?: number }[] }> {
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
      // 自定义指标：优先用动态注册的 customSchema 提供分类/类型/单位等，走与常规指标相同的渲染
      const def = customSchema?.[key];
      if (def) {
        const cat = (result[def.category] || (result[def.category] = { label: def.category, metrics: [] }));
        cat.metrics.push({
          key, label: def.label, type: def.type,
          value: val, unit: def.unit, warn: def.warn, crit: def.crit,
        });
      } else {
        // 无 schema（历史数据兜底）：归「自定义」分类，类型按实际值推导
        const customCat = (result['自定义'] || (result['自定义'] = { label: '自定义', metrics: [] }));
        customCat.metrics.push({
          key, label: key.slice(CUSTOM_PREFIX.length),
          type: typeof val === 'number' ? 'number' : 'string',
          value: val,
        });
      }
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

// 提取摘要指标（用于列表页）：常规 schema + 动态注册的自定义指标（summary=true 的项）
export function extractSummary(data: Record<string, any>, customSchema?: Record<string, CustomDef>): { key: string; label: string; value: any; unit?: string; warn?: number; crit?: number }[] {
  const summary: any[] = [];
  for (const def of METRIC_SCHEMA) {
    if (def.summary && data[def.key] != null) {
      summary.push({ key: def.key, label: def.label, value: data[def.key], unit: def.unit, warn: def.warn, crit: def.crit });
    }
  }
  if (customSchema) {
    for (const def of Object.values(customSchema)) {
      if (def.summary && data[def.key] != null) {
        summary.push({ key: def.key, label: def.label, value: data[def.key], unit: def.unit, warn: def.warn, crit: def.crit });
      }
    }
  }
  return summary;
}

export async function isOnline(c: any, lastSeen: number): Promise<boolean> {
  const timeout = await onlineTimeoutMin(c);
  return Date.now() - lastSeen < timeout * 60 * 1000;
}

// ─── 数据访问（关系化） ───

// 表就绪检查 + 一次性建表
async function ensureTables(k: Db, c: any): Promise<void> {
  const tk = await masterKey(c);
  const kkey = connKey(tk, c.env.D1_API_BASE);
  if (smReady.get(kkey)) return;
  for (const sql of ensureSql()) {
    await k.execute(sql);
  }
  smReady.set(kkey, true);
}

function rowToHost(row: any): HostRow {
  let data: Record<string, any> = {};
  try { data = row.data_json ? JSON.parse(row.data_json) : {}; } catch { data = {}; }
  let customSchema: Record<string, CustomDef> | undefined;
  if (row.custom_schema_json) {
    try { customSchema = JSON.parse(row.custom_schema_json); } catch { /* 忽略 */ }
  }
  return {
    hostname: row.hostname,
    name: row.name,
    firstSeen: Number(row.first_seen),
    lastSeen: Number(row.last_seen),
    data,
    extra: row.extra,
    customSchema,
  };
}

// 读主机（hosts 行，不含 history）
async function getHost(k: Db, hostname: string): Promise<HostRow | null> {
  const row = await k.queryOne(
    `SELECT hostname, name, first_seen, last_seen, data_json, extra, custom_schema_json
     FROM ${T_HOSTS} WHERE hostname = ?`,
    [hostname]
  );
  if (!row) return null;
  return rowToHost(row);
}

// upsert 主机行（局部写本次合并后的最新数据）
async function upsertHost(k: Db, host: HostRow): Promise<void> {
  await k.execute(
    `INSERT INTO ${T_HOSTS} (hostname, name, first_seen, last_seen, data_json, extra, custom_schema_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(hostname) DO UPDATE SET
       name = excluded.name,
       first_seen = excluded.first_seen,
       last_seen = excluded.last_seen,
       data_json = excluded.data_json,
       extra = excluded.extra,
       custom_schema_json = excluded.custom_schema_json`,
    [
      host.hostname,
      host.name,
      host.firstSeen,
      host.lastSeen,
      JSON.stringify(host.data),
      host.extra,
      host.customSchema ? JSON.stringify(host.customSchema) : null,
    ]
  );
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
  // 自定义指标通过独立字段 custom 携带约定 JSON：值合并进 data（custom.<label>），
  // 定义注册到 customSchema；extra 仅作附件展示，两者职责分离
  const customStr = typeof body.custom === 'string' ? body.custom : null;
  const parsedCustom = customStr !== null ? parseCustomExtra(customStr) : null;
  let customDefs: Record<string, CustomDef> | null = null;
  if (parsedCustom) {
    reportData = { ...reportData };
    customDefs = {};
    for (const it of parsedCustom.items) {
      if (it.value === null) continue;
      const key = `${CUSTOM_PREFIX}${it.def.label}`;
      reportData[key] = it.value;
      customDefs[key] = { key, category: parsedCustom.category || '自定义', ...it.def };
    }
  }
  const ts = nowMs();
  const k = await db(c);
  try {
    await ensureTables(k, c);
  } catch (e: any) {
    console.error('sys-monitor ensureTables failed:', e?.message);
    return c.json({ error: `表初始化失败：${e.message}` }, 503);
  }

  let host = await getHost(k, hostname);

  let firstSeen = ts;
  let name = hostname;
  if (host) {
    // 更新已有主机
    firstSeen = host.firstSeen;
    name = host.name;
    // 合并：客户端上报的字段覆盖旧值
    for (const key of Object.keys(reportData)) {
      if (reportData[key] === null) {
        delete host.data[key];
      } else {
        host.data[key] = reportData[key];
      }
    }
    // 合并动态注册的自定义指标定义（新定义覆盖旧定义）
    if (customDefs) {
      host.customSchema = { ...(host.customSchema || {}), ...customDefs };
    }
    // extra 只保留最新值（纯附件，不参与指标解析）
    if (extra !== null) host.extra = extra;
    host.lastSeen = ts;
  } else {
    // 新主机
    host = {
      hostname,
      name,
      firstSeen,
      lastSeen: ts,
      data: { ...reportData },
      extra: extra,
      customSchema: customDefs || undefined,
    };
    // 清除 null 值
    for (const key of Object.keys(host.data)) {
      if (host.data[key] === null) delete host.data[key];
    }
  }

  // 写主机行（只存最新，不重复序列化 history）
  await upsertHost(k, host);

  // 追加一条 history
  await k.execute(
    `INSERT INTO ${T_HISTORY} (hostname, ts, data_json) VALUES (?, ?, ?)`,
    [hostname, ts, JSON.stringify(reportData)]
  );

  // history 超限清理：仅保留最近 maxHistory 条（hostname+ts 唯一，ts 无重复）
  const maxHistory = await historyMax(c);
  await k.execute(
    `DELETE FROM ${T_HISTORY}
     WHERE hostname = ? AND ts NOT IN (
       SELECT ts FROM (
         SELECT ts FROM ${T_HISTORY} WHERE hostname = ? ORDER BY ts DESC LIMIT ?
       )
     )`,
    [hostname, hostname, maxHistory]
  );

  return c.json({ ok: true, hostname });
});

// ─── 列出所有主机（含摘要指标，不含历史） ───
app.get('/hosts', async (c) => {
  const k = await db(c);
  try {
    await ensureTables(k, c);
    const rows = await k.queryAll(
      `SELECT hostname, name, first_seen, last_seen, data_json, extra, custom_schema_json
       FROM ${T_HOSTS} ORDER BY last_seen DESC`
    );
    const hosts = await Promise.all(rows.map(async (row: any) => {
      const host = rowToHost(row);
      return {
        id: host.hostname,
        hostname: host.hostname,
        name: host.name,
        firstSeen: host.firstSeen,
        lastSeen: host.lastSeen,
        online: await isOnline(c, host.lastSeen),
        summary: extractSummary(host.data, host.customSchema),
        hasExtra: !!host.extra,
      };
    }));
    return c.json({ hosts });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '查询失败' }, 500);
  }
});

// ─── 查询单个主机详情 + 历史 ───
app.get('/hosts/:id', async (c) => {
  const id = c.req.param('id');
  const k = await db(c);
  try {
    await ensureTables(k, c);
  } catch (e: any) {
    console.error('sys-monitor ensureTables failed:', e?.message);
    return c.json({ error: `表初始化失败：${e.message}` }, 503);
  }

  let host = await getHost(k, id);
  if (!host) return c.json({ error: '主机不存在' }, 404);

  // 从 history 表读最近 100 条（走索引，只取所需）
  const historyRows = await k.queryAll<{ ts: number; data_json: string }>(
    `SELECT ts, data_json FROM ${T_HISTORY}
     WHERE hostname = ? ORDER BY ts DESC LIMIT 100`,
    [id]
  );
  const history: HistoryEntry[] = historyRows
    .map<HistoryEntry>(r => {
      let data: Record<string, any> = {};
      try { data = r.data_json ? JSON.parse(r.data_json) : {}; } catch { data = {}; }
      return { ts: Number(r.ts), data };
    })
    .reverse(); // 时间正序返回，与旧实现一致

  return c.json({
    host: {
      id,
      hostname: host.hostname,
      name: host.name,
      firstSeen: host.firstSeen,
      lastSeen: host.lastSeen,
      online: await isOnline(c, host.lastSeen),
      categories: parseMetrics(host.data, host.customSchema),
      extra: host.extra,
      customSchema: host.customSchema || {},
    },
    history,
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

  const k = await db(c);
  try {
    await ensureTables(k, c);
  } catch (e: any) {
    console.error('sys-monitor ensureTables failed:', e?.message);
    return c.json({ error: `表初始化失败：${e.message}` }, 503);
  }

  const host = await getHost(k, id);
  if (!host) return c.json({ error: '主机不存在' }, 404);

  host.name = name;
  await upsertHost(k, host);
  return c.json({ ok: true, name });
});

// ─── 删除主机（含其历史） ───
app.delete('/hosts/:id', async (c) => {
  const id = c.req.param('id');
  const k = await db(c);
  try {
    await ensureTables(k, c);
    await k.execute(`DELETE FROM ${T_HISTORY} WHERE hostname = ?`, [id]);
    await k.execute(`DELETE FROM ${T_HOSTS} WHERE hostname = ?`, [id]);
  } catch (e: any) {
    return c.json({ error: `删除失败：${e.message}` }, 500);
  }
  return c.json({ ok: true });
});

import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

const sysMonitorPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default sysMonitorPlugin;