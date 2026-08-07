import { describe, it, expect } from 'vitest';
import { getMarketStatus, parseTencentLine } from '../src/tools/stock-fetcher';

// ─── getMarketStatus ───

// A 股（Asia/Shanghai，UTC+8）：session 09:30-11:30 / 13:00-15:00
// 2026-08-03 为周一；10:00 CST = 02:00 UTC；12:00 CST = 04:00 UTC；
// 09:00 CST = 01:00 UTC；15:30 CST = 07:30 UTC
describe('getMarketStatus (A)', () => {
  it('returns open during morning session', () => {
    const now = new Date('2026-08-03T02:00:00Z'); // 10:00 CST Mon
    expect(getMarketStatus('A', now).status).toBe('open');
  });

  it('returns break during lunch break', () => {
    const now = new Date('2026-08-03T04:00:00Z'); // 12:00 CST Mon
    expect(getMarketStatus('A', now).status).toBe('break');
  });

  it('returns pre before opening', () => {
    const now = new Date('2026-08-03T01:00:00Z'); // 09:00 CST Mon
    expect(getMarketStatus('A', now).status).toBe('pre');
  });

  it('returns closed after market close', () => {
    const now = new Date('2026-08-03T07:30:00Z'); // 15:30 CST Mon
    expect(getMarketStatus('A', now).status).toBe('closed');
  });

  it('returns weekend on Sunday', () => {
    const now = new Date('2026-08-02T02:00:00Z'); // 10:00 CST Sun
    expect(getMarketStatus('A', now).status).toBe('weekend');
  });

  it('returns weekend on Saturday', () => {
    const now = new Date('2026-08-01T02:00:00Z'); // 10:00 CST Sat
    expect(getMarketStatus('A', now).status).toBe('weekend');
  });

  it('returns open at exactly session start (09:30)', () => {
    const now = new Date('2026-08-03T01:30:00Z'); // 09:30 CST Mon
    expect(getMarketStatus('A', now).status).toBe('open');
  });

  it('returns closed at exactly session end (15:00)', () => {
    const now = new Date('2026-08-03T07:00:00Z'); // 15:00 CST Mon
    expect(getMarketStatus('A', now).status).toBe('closed');
  });
});

describe('getMarketStatus (US)', () => {
  it('returns open during US session (EDT, UTC-4)', () => {
    const now = new Date('2026-08-03T14:00:00Z'); // 10:00 EDT Mon
    expect(getMarketStatus('US', now).status).toBe('open');
  });

  it('returns weekend on US Saturday', () => {
    const now = new Date('2026-08-01T14:00:00Z'); // 10:00 EDT Sat
    expect(getMarketStatus('US', now).status).toBe('weekend');
  });
});

describe('getMarketStatus (unknown market)', () => {
  it('returns unknown for unsupported market code', () => {
    expect(getMarketStatus('XX', new Date())).toEqual({ status: 'unknown', label: '未知' });
  });
});

// ─── parseTencentLine ───

function tencentLine(overrides: { price?: string; changePct?: string } = {}): string {
  const price = overrides.price ?? '10.25';
  const changePct = overrides.changePct ?? '2.34';
  const fields: string[] = [
    '1', '浦发银行', 'sh600000', price, // 0-3
    '10.30', '10.31', '9.20', '9.50', '9.80', '10.00', '9.99', '10.01', // 4-11
    '10.05', '10.06', '10.07', '10.08', '10.09', '10.10', '10.11', '10.12', // 12-19
    '10.13', '10.14', '10.15', '10.16', '10.17', '10.18', '10.19', '10.20', // 20-27
    '10.21', '10.22', '10.23', '10.24', changePct, // 28-32
  ];
  return `v_sh600000="${fields.join('~')}";`;
}

describe('parseTencentLine', () => {
  it('parses a valid line', () => {
    const result = parseTencentLine(tencentLine());
    expect(result).toEqual({ price: 10.25, changePct: 2.34 });
  });

  it('parses line with zero values', () => {
    const result = parseTencentLine(tencentLine({ price: '0', changePct: '0' }));
    expect(result).toEqual({ price: 0, changePct: 0 });
  });

  it('returns null for non-numeric price', () => {
    const result = parseTencentLine(tencentLine({ price: 'abc' }));
    expect(result).toEqual({ price: null, changePct: 2.34 });
  });

  it('returns null for malformed line', () => {
    expect(parseTencentLine('not a tencent line')).toBeNull();
    expect(parseTencentLine('v_sh600000="1~2~3~4";')).toBeNull(); // < 33 fields
  });
});