import { describe, it, expect, vi } from 'vitest';
import { METRIC_SCHEMA, SCHEMA_MAP, parseMetrics, extractSummary, isOnline } from '../src/tools/sys-monitor';

// Mock getConfig to return null (fall back to default), so isOnline uses default 30min timeout
vi.mock('../src/config', () => ({
  getConfig: vi.fn().mockResolvedValue(null),
}));

const mockC = { env: { D1_API_TOKEN: 'test', D1_API_BASE: 'http://test' } };

describe('METRIC_SCHEMA', () => {
  it('has 18 metric definitions', () => {
    expect(METRIC_SCHEMA).toHaveLength(18);
  });

  it('has summary metrics defined', () => {
    const summaryKeys = METRIC_SCHEMA.filter(m => m.summary).map(m => m.key);
    expect(summaryKeys).toContain('cpu_usage');
    expect(summaryKeys).toContain('mem_usage');
    expect(summaryKeys).toContain('disk_usage');
  });
});

describe('SCHEMA_MAP', () => {
  it('maps all schema keys', () => {
    for (const def of METRIC_SCHEMA) {
      expect(SCHEMA_MAP[def.key]).toBe(def);
    }
  });

  it('has correct type for cpu_usage', () => {
    expect(SCHEMA_MAP['cpu_usage'].type).toBe('percent');
  });
});

// ─── parseMetrics ───

describe('parseMetrics', () => {
  it('categorizes known metrics by category', () => {
    const result = parseMetrics({ cpu_usage: 45, mem_usage: 60, disk_usage: 70 });
    expect(result['CPU']).toBeDefined();
    expect(result['内存']).toBeDefined();
    expect(result['磁盘']).toBeDefined();
    expect(result['CPU'].metrics[0].value).toBe(45);
    expect(result['内存'].metrics[0].value).toBe(60);
  });

  it('puts unknown metrics in 其他', () => {
    const result = parseMetrics({ custom_field: 'hello' });
    expect(result['其他']).toBeDefined();
    expect(result['其他'].metrics[0].key).toBe('custom_field');
  });

  it('skips null and undefined values', () => {
    const result = parseMetrics({ cpu_usage: null, mem_usage: undefined });
    expect(result['CPU']).toBeUndefined();
    expect(result['内存']).toBeUndefined();
  });

  it('includes warn and crit thresholds', () => {
    const result = parseMetrics({ cpu_usage: 50 });
    expect(result['CPU'].metrics[0].warn).toBe(70);
    expect(result['CPU'].metrics[0].crit).toBe(90);
  });

  it('returns empty categories when no matching data', () => {
    const result = parseMetrics({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ─── extractSummary ───

describe('extractSummary', () => {
  it('returns only summary-tagged metrics', () => {
    const result = extractSummary({ cpu_usage: 45, mem_usage: 60, disk_usage: 70, cpu_cores: 8 });
    expect(result).toHaveLength(3);
    expect(result.map(r => r.key)).toEqual(['cpu_usage', 'mem_usage', 'disk_usage']);
  });

  it('skips null values', () => {
    const result = extractSummary({ cpu_usage: null, mem_usage: 60 });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('mem_usage');
  });

  it('returns empty array when no data', () => {
    expect(extractSummary({})).toEqual([]);
  });
});

// ─── isOnline ───

describe('isOnline', () => {
  it('returns true for recent lastSeen', async () => {
    await expect(isOnline(mockC, Date.now() - 1000)).resolves.toBe(true);
  });

  it('returns false for old lastSeen (over 30min)', async () => {
    await expect(isOnline(mockC, Date.now() - 31 * 60 * 1000)).resolves.toBe(false);
  });

  it('returns true at exactly 29min', async () => {
    await expect(isOnline(mockC, Date.now() - 29 * 60 * 1000)).resolves.toBe(true);
  });
});