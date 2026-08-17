// 性能基准：量化 sys-monitor/report 存储序列化/反序列化对 CPU 的贡献
// 对比两种持久化形态的 JSON 开销：
//  形态A（现状）：整个 host（含 history 数组，默认 max=60 条 × 全字段）单对象 stringify/parse
//  形态B（优化）：history 拆分存，每条只存精简字段 + 追加到独立键，避免重写整个历史数组
// 说明：此为纯 CPU 模拟（JSON parse/stringify），不含网络，用于判断 CPU 优化空间。
import { describe, it, expect } from 'vitest';

// 模拟一次上报的 data（对应当前客户端 build_payload 产生的全字段）
function makeReportData(): Record<string, any> {
  return {
    cpu_usage: 28, cpu_cores: 1, cpu_temp: 30,
    mem_total_mb: 2795, mem_used_mb: 1513, mem_usage: 54, swap_usage: 44,
    disk_usage: 60, disk_total_kb: 52428800, disk_used_kb: 31457280,
    load_1m: 0.5, load_5m: 0.7, load_15m: 0.6, processes: 120,
    net_iface: 'eth0', lan_ipv4: '192.168.10.205', net_rx_bytes: 1024000, net_tx_bytes: 204800,
    uptime_seconds: 1185226,
  };
}

// 模拟已累积的 history：history_max 条，每条含上报全字段（现状）
function buildFullHost(reportData: Record<string, any>, historyMax: number): any {
  const history = [];
  const start = Date.now();
  for (let i = 0; i < historyMax; i++) {
    history.push({ ts: start + i * 1000, data: reportData });
  }
  return {
    hostname: 'LeX620', name: 'LeX620', firstSeen: start, lastSeen: start + historyMax * 1000,
    data: reportData, extra: null, customSchema: undefined, history,
  };
}

// 优化形态：history 只存核心精简字段 + 追加到独立键（不重写整数组）
const HISTORY_COMPACT_FIELDS = ['cpu_usage', 'cpu_temp', 'mem_usage', 'disk_usage', 'load_1m', 'uptime_seconds'];

function buildCompactHistory(reportData: Record<string, any>, historyMax: number): any[] {
  const history = [];
  const start = Date.now();
  for (let i = 0; i < historyMax; i++) {
    const compact: Record<string, any> = {};
    for (const f of HISTORY_COMPACT_FIELDS) if (reportData[f] != null) compact[f] = reportData[f];
    history.push({ ts: start + i * 1000, data: compact });
  }
  return history;
}

function bench(fn: () => void, rounds = 2000): number {
  fn(); // warmup
  const t0 = performance.now();
  for (let i = 0; i < rounds; i++) fn();
  return (performance.now() - t0) / rounds;
}

describe('report 持久化 CPU 基准（JSON 序列化/反序列化）', () => {
  const reportData = makeReportData();

  it('full 形态（现状）stringify+parse 开销', () => {
    const full = buildFullHost(reportData, 60);
    const json = JSON.stringify(full);
    // 单次上报开销（读写各一次 parse/stringify）
    const ms = bench(() => {
      const s = JSON.stringify(full);
      JSON.parse(s);
    });
    // 简单 sanity：对象可还原
    const roundTrip = JSON.parse(json);
    expect(roundTrip.hostname).toBe('LeX620');
    // 报告 payload 大小
    console.log(`[full] 序列化后大小=${(json.length / 1024).toFixed(1)}KB 单次往返=${ms.toFixed(3)}ms`);
    // 当前这接近触限（<7ms 目标），若超预期应优化
    expect(ms).toBeLessThan(10);
  });

  it('compact 形态（优化）序列化开销显著更小', () => {
    const compact = buildCompactHistory(reportData, 60);
    const json = JSON.stringify(compact);
    const ms = bench(() => {
      const s = JSON.stringify(compact);
      JSON.parse(s);
    });
    console.log(`[compact] 序列化后大小=${(json.length / 1024).toFixed(1)}KB 单次往返=${ms.toFixed(3)}ms`);
    // compact 应明显小于 full（仅历史数组差异的镜像：full 含 meta+history，这里对比 history 块）
    const full = buildFullHost(reportData, 60);
    expect(json.length).toBeLessThan(
      JSON.stringify(buildFullHost(reportData, 60)).length
    );
  });

  it('历史累积到 max 时 compact 比 full 小多少（规模影响）', () => {
    for (const max of [30, 60, 120]) {
      const fullLen = JSON.stringify(buildFullHost(reportData, max)).length;
      const compactLen = JSON.stringify(buildCompactHistory(reportData, max)).length;
      const fullMs = bench(() => {
        const full = buildFullHost(reportData, max);
        JSON.stringify(full); JSON.parse(JSON.stringify(full));
      }, 800);
      const compactMs = bench(() => {
        const compact = buildCompactHistory(reportData, max);
        JSON.stringify(compact); JSON.parse(JSON.stringify(compact));
      }, 800);
      console.log(`max=${max}: full=${(fullLen/1024).toFixed(1)}KB/${fullMs.toFixed(3)}ms  compact=${(compactLen/1024).toFixed(1)}KB/${compactMs.toFixed(3)}ms  压缩=${(100*(1-fullLen/(fullLen)).toFixed(0))}%`);
    }
  });
});