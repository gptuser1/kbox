import { describe, it, expect } from 'vitest';
import { buildTrendingQuery } from '../src/tools/tavily-search';

describe('buildTrendingQuery', () => {
  it('produces a query in "X月Y日 新闻热点 头条" format', () => {
    const query = buildTrendingQuery();
    expect(query).toMatch(/^\d{1,2}月\d{1,2}日 新闻热点 头条$/);
  });

  it('uses Beijing time offset of +8h', () => {
    const now = Date.now();
    const bj = new Date(now + 8 * 60 * 60 * 1000);
    const expected = `${bj.getUTCMonth() + 1}月${bj.getUTCDate()}日 新闻热点 头条`;
    expect(buildTrendingQuery()).toBe(expected);
  });
});