import { describe, it, expect } from 'vitest';
import { CRON_ACTIONS, NS_CRON_TASKS, normalizeHours, genId, nowUnix, currentHourCN } from '../src/tools/cron-tasks';

// ─── 常量验证 ───

describe('CRON_ACTIONS', () => {
  it('has news_crawl action', () => {
    expect(CRON_ACTIONS.news_crawl).toBe('新闻抓取');
  });
});

describe('NS_CRON_TASKS', () => {
  it('is the correct namespace', () => {
    expect(NS_CRON_TASKS).toBe('cron_tasks');
  });
});

// ─── normalizeHours ───

describe('normalizeHours', () => {
  it('returns sorted unique valid hours', () => {
    expect(normalizeHours([9, 15, 9, 10])).toEqual([9, 10, 15]);
  });

  it('filters out invalid values', () => {
    expect(normalizeHours([-1, 24, 8, 'abc', undefined])).toEqual([8]);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeHours(null)).toEqual([]);
    expect(normalizeHours(undefined)).toEqual([]);
    expect(normalizeHours('string')).toEqual([]);
    expect(normalizeHours(123)).toEqual([]);
  });

  it('handles empty array', () => {
    expect(normalizeHours([])).toEqual([]);
  });

  it('handles boundary values 0 and 23', () => {
    expect(normalizeHours([0, 23])).toEqual([0, 23]);
  });

  it('converts string numbers to numbers', () => {
    expect(normalizeHours(['8', '9', '10'])).toEqual([8, 9, 10]);
  });

  it('filters floats', () => {
    expect(normalizeHours([8.5, 9.1])).toEqual([]);
  });
});

// ─── genId ───

describe('genId', () => {
  it('returns a non-empty string', () => {
    expect(genId()).toBeTruthy();
    expect(typeof genId()).toBe('string');
  });

  it('returns unique values on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });

  it('contains only alphanumeric characters', () => {
    const id = genId();
    expect(id).toMatch(/^[0-9a-z]+$/);
  });
});

// ─── nowUnix ───

describe('nowUnix', () => {
  it('returns a number close to current time', () => {
    const before = Date.now();
    const actual = nowUnix();
    const after = Date.now();
    expect(actual).toBeGreaterThanOrEqual(before);
    expect(actual).toBeLessThanOrEqual(after);
  });
});

// ─── currentHourCN ───

describe('currentHourCN', () => {
  it('returns an integer between 0 and 23', () => {
    const h = currentHourCN();
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});