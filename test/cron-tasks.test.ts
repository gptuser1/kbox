import { describe, it, expect } from 'vitest';
import { CRON_ACTIONS, NS_CRON_TASKS, normalizeHours } from '../src/tools/cron-tasks';

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