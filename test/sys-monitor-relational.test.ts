import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
import { _resetSmState } from '../src/plugins/sys-monitor/backend';

// ─── 用真实 SQLite 模拟 D1 网关 ───
// 拦截全局 fetch：d1.ts 会向 `<base>/query` POST {query, params}，
// 我们解析后真正执行在 sqlite 上，按 D1 协议返回 {success, results, meta}。
// 这样走的是真实 createDb 请求序列化路径，验证关系化 SQL 的语义。
const dbState: { sqlite: DatabaseSync | null } = { sqlite: null };

// D1 返回的 results 是数组，写操作 results 为数组（D1 的 /query 返回 results: []）
async function fakeFetch(input: any, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : (input as any).url;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const { query, params } = (body as { query: string; params?: any[] }) || {};
  if (!query) {
    return Response.json({ success: false, error: 'missing query' }, { status: 400 });
  }

  const db = dbState.sqlite!;
  try {
    const stmt = db.prepare(query);
    const isQuery = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(query);
    if (isQuery) {
      const rows = stmt.all(...(params || []));
      return Response.json({ success: true, results: rows, meta: { duration: 0, changes: 0, served_by: 'sqlite-test' } });
    }
    const info = stmt.run(...(params || []));
    return Response.json({ success: true, results: [], meta: { duration: 0, changes: Number(info.changes), served_by: 'sqlite-test' } });
  } catch (e) {
    return Response.json({ success: false, error: e instanceof Error ? e.message : 'sqlite error' }, { status: 500 });
  }
}

// config mock：让 getConfig 走默认值（历史上限 60，在线超时 30min）
vi.mock('../../src/services/config', () => ({
  getConfig: vi.fn(async () => null),
}));

import sysMonitorPlugin from '../src/plugins/sys-monitor/backend';

function makeEnv() {
  return { D1_API_TOKEN: 'test-token', D1_API_BASE: 'http://d1.test' };
}

function appReq(method: string, path: string, body?: unknown, env = makeEnv()) {
  const pathParts = path.split('?')[0].split('/').filter(Boolean);
  const search = path.split('?')[1] ? new URLSearchParams(path.split('?')[1]) : null;
  const url = `http://host/${pathParts.join('/')}${search ? '?' + search.toString() : ''}`;
  const req = new Request(url, {
    method,
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return sysMonitorPlugin.router.fetch(req, env, {});
}

beforeEach(() => {
  dbState.sqlite = new DatabaseSync(':memory:');
  _resetSmState();
});

describe('sys-monitor 关系化改造集成验证', () => {
  it('report → hosts 列表 → 详情/历史 → 超限清理 → delete 全链路', async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch as any;
    try {
      // 第一次上报：新主机
      let res = await appReq('POST', '/report', {
        hostname: 'pc1',
        data: { cpu_usage: 45, mem_usage: 60, net_iface: 'eth0' },
      });
      expect(res.status).toBe(200, await res.text());

      // 第二次上报：更新已有主机 + 加历史
      res = await appReq('POST', '/report', {
        hostname: 'pc1',
        data: { cpu_usage: 55, lan_ipv4: '192.168.0.5' },
      });
      expect(res.status).toBe(200, await res.text());

      // hosts 列表
      res = await appReq('GET', '/hosts');
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(list.hosts).toHaveLength(1);
      const h = list.hosts[0];
      expect(h.hostname).toBe('pc1');
      expect(h.online).toBe(true);
      const sumKeys = h.summary.map((s: any) => s.key);
      expect(sumKeys).toContain('cpu_usage');
      expect(sumKeys).toContain('mem_usage');
      expect('history' in h).toBe(false);

      // 详情 + 历史（时间正序）
      res = await appReq('GET', '/hosts/pc1');
      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.host.name).toBe('pc1');
      expect(detail.history).toHaveLength(2);
      expect(detail.history[0].data.cpu_usage).toBe(45);
      expect(detail.history[1].data.cpu_usage).toBe(55);
      expect(detail.history[1].data.lan_ipv4).toBe('192.168.0.5');
      const cpuCat = detail.host.categories['CPU'];
      expect(cpuCat.metrics.find((m: any) => m.key === 'cpu_usage').value).toBe(55);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it('custom 指标 + extra 正确持久化', async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch as any;
    try {
      const post = await appReq('POST', '/report', {
        hostname: 'pc2',
        data: { cpu_usage: 10 },
        custom: JSON.stringify({ category: '系统', custom: [{ label: '电量', type: 'percent', value: 80, unit: '%', warn: -60, crit: -30, summary: true }] }),
        extra: '附加说明',
      });
      expect(post.status).toBe(200, await post.text());

      const detail = await (await appReq('GET', '/hosts/pc2')).json();
      const sysCat = detail.host.categories['系统'];
      const batt = sysCat.metrics.find((m: any) => m.key === 'custom.电量');
      expect(batt).toBeTruthy();
      expect(batt.value).toBe(80);
      expect(detail.host.extra).toBe('附加说明');
      expect(detail.history[0].data['custom.电量']).toBe(80);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it('history 超限清理只保留最近 maxHistory 条 + delete 级联删除', async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch as any;
    try {
      const db = dbState.sqlite!;
      // 造表 + 一个主机 + 70 条超量历史
      db.exec(`CREATE TABLE IF NOT EXISTS kbox_sm_hosts (hostname TEXT PRIMARY KEY, name TEXT, first_seen INTEGER, last_seen INTEGER, data_json TEXT, extra TEXT, custom_schema_json TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS kbox_sm_history (hostname TEXT, ts INTEGER, data_json TEXT, PRIMARY KEY(hostname, ts))`);
      db.prepare(`INSERT INTO kbox_sm_hosts (hostname,name,first_seen,last_seen,data_json) VALUES ('pc3','pc3',1,1,'{}')`).run();
      const base = Date.now() - 10_000_000;
      for (let i = 0; i < 70; i++) {
        db.prepare(`INSERT INTO kbox_sm_history (hostname,ts,data_json) VALUES ('pc3',?,'{"cpu_usage":1}')`).run(base + i);
      }

      // 触发一次 report，跑超限清理 DELETE（默认 maxHistory=60）
      const res = await appReq('POST', '/report', { hostname: 'pc3', data: { cpu_usage: 2 } });
      expect(res.status).toBe(200, await res.text());

      const cnt = db.prepare(`SELECT COUNT(*) AS c FROM kbox_sm_history WHERE hostname='pc3'`).get() as any;
      expect(Number(cnt.c)).toBeLessThanOrEqual(60);

      // delete 主机（含其历史）
      const del = await appReq('DELETE', '/hosts/pc3');
      expect(del.status).toBe(200, await del.text());
      const afterHost = db.prepare(`SELECT COUNT(*) AS c FROM kbox_sm_hosts WHERE hostname='pc3'`).get() as any;
      const afterHis = db.prepare(`SELECT COUNT(*) AS c FROM kbox_sm_history WHERE hostname='pc3'`).get() as any;
      expect(Number(afterHost.c)).toBe(0);
      expect(Number(afterHis.c)).toBe(0);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it('legacy 手动 SQL 迁移：kbox_kv blob 拆进新表', async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch as any;
    try {
      const db = dbState.sqlite!;
      const oldBlob = JSON.stringify({
        hostname: 'WS1608', name: 'WS1608', firstSeen: 100, lastSeen: 200,
        data: { cpu_usage: 33, 'custom.电量': 80 }, extra: '备注',
        customSchema: { 'custom.电量': { key: 'custom.电量', category: '系统', label: '电量', type: 'percent', unit: '%' } },
        history: [{ ts: 150, data: { cpu_usage: 30 } }, { ts: 200, data: { cpu_usage: 33 } }],
      });
      db.exec(`CREATE TABLE IF NOT EXISTS kbox_kv (namespace TEXT, key TEXT, value TEXT, PRIMARY KEY(namespace, key))`);
      db.prepare(`INSERT INTO kbox_kv (namespace,key,value) VALUES ('sys_monitor:hosts','WS1608',?)`).run(oldBlob);

      // 手动执行迁移 SQL（与交付给用户的语句一致），先建好目标表
      db.exec(`CREATE TABLE IF NOT EXISTS kbox_sm_hosts (hostname TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, data_json TEXT NOT NULL, extra TEXT, custom_schema_json TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS kbox_sm_history (hostname TEXT NOT NULL, ts INTEGER NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY(hostname, ts))`);

      // hosts 行
      db.prepare(
        `INSERT INTO kbox_sm_hosts (hostname, name, first_seen, last_seen, data_json, extra, custom_schema_json)
         SELECT
           json_extract(value, '$.hostname') AS hostname,
           COALESCE(json_extract(value, '$.name'), json_extract(value, '$.hostname')) AS name,
           COALESCE(json_extract(value, '$.firstSeen'), 0) AS first_seen,
           COALESCE(json_extract(value, '$.lastSeen'), 0) AS last_seen,
           COALESCE(json_extract(value, '$.data'), '{}') AS data_json,
           json_extract(value, '$.extra') AS extra,
           json_extract(value, '$.customSchema') AS custom_schema_json
         FROM kbox_kv
         WHERE namespace = 'sys_monitor:hosts' AND key = 'WS1608'
         ON CONFLICT(hostname) DO UPDATE SET
           name = excluded.name,
           first_seen = excluded.first_seen,
           last_seen = excluded.last_seen,
           data_json = excluded.data_json,
           extra = excluded.extra,
           custom_schema_json = excluded.custom_schema_json`
      ).run();

      // history 行
      db.prepare(
        `INSERT INTO kbox_sm_history (hostname, ts, data_json)
         SELECT
           json_extract(kv.value, '$.hostname') AS hostname,
           json_extract(h.value, '$.ts') AS ts,
           COALESCE(json_extract(h.value, '$.data'), '{}') AS data_json
         FROM kbox_kv AS kv, json_each(kv.value, '$.history') AS h
         WHERE kv.namespace = 'sys_monitor:hosts' AND kv.key = 'WS1608'
         ON CONFLICT(hostname, ts) DO UPDATE SET data_json = excluded.data_json`
      ).run();

      // 通过 API 读，验证迁移结果
      const res = await appReq('GET', '/hosts/WS1608');
      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.host.name).toBe('WS1608');
      expect(detail.host.extra).toBe('备注');
      expect(detail.history).toHaveLength(2);
      expect(detail.history[0].data.cpu_usage).toBe(30);
      expect(detail.history[1].data.cpu_usage).toBe(33);
      const batt = detail.host.categories['系统'].metrics.find((m: any) => m.key === 'custom.电量');
      expect(batt.label).toBe('电量');
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});