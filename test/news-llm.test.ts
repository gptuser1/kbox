import { describe, it, expect } from 'vitest';
import {
  buildPrompt,
  parseSummaries,
  isValidSummaries,
  buildDedupePrompt,
  parseDedupeGroups,
  buildKeywordPrompt,
  parseKeywords,
  normalizeKeyword,
  bigramJaccard,
} from '../src/tools/news-llm';

// ─── buildPrompt ───

describe('buildPrompt', () => {
  it('returns system and user messages', () => {
    const articles = [
      { title: 'AI 突破', source: 'BBC' },
      { title: '股市大涨', source: 'Reuters' },
    ];
    const msgs = buildPrompt(articles, 0);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('includes article count in system prompt', () => {
    const articles = [{ title: 'Test', source: 'S' }];
    const msgs = buildPrompt(articles, 0);
    expect(msgs[0].content).toContain('一共1条');
  });

  it('includes retry note when attempt > 0', () => {
    const articles = [{ title: 'A', source: 'S' }];
    const msgs = buildPrompt(articles, 2);
    expect(msgs[0].content).toContain('第3次尝试');
  });

  it('includes all articles in user message', () => {
    const articles = [
      { title: 'News 1', source: 'A' },
      { title: 'News 2', source: 'B' },
    ];
    const msgs = buildPrompt(articles, 0);
    expect(msgs[1].content).toContain('[A] News 1');
    expect(msgs[1].content).toContain('[B] News 2');
  });
});

// ─── parseSummaries ───

describe('parseSummaries', () => {
  it('parses JSON format', () => {
    const raw = JSON.stringify({
      summaries: [
        { index: 1, summary: '第一条锐评' },
        { index: 2, summary: '第二条锐评' },
      ],
    });
    const map = parseSummaries(raw, 3);
    expect(map.get(0)).toBe('第一条锐评');
    expect(map.get(1)).toBe('第二条锐评');
    expect(map.has(2)).toBe(false);
  });

  it('parses JSON with markdown fences', () => {
    const raw = '```json\n{"summaries": [{"index": 1, "summary": "Hello"}]}\n```';
    const map = parseSummaries(raw, 2);
    expect(map.get(0)).toBe('Hello');
  });

  it('parses numbered lines as fallback', () => {
    const raw = '1. 第一条锐评内容\n2: 第二条内容\n3、第三条';
    const map = parseSummaries(raw, 3);
    expect(map.get(0)).toBe('第一条锐评内容');
    expect(map.get(1)).toBe('第二条内容');
    expect(map.get(2)).toBe('第三条');
  });

  it('ignores out-of-range indices', () => {
    const raw = JSON.stringify({
      summaries: [{ index: 99, summary: '超出范围' }],
    });
    const map = parseSummaries(raw, 3);
    expect(map.has(98)).toBe(false);
  });

  it('returns empty map for unparseable input', () => {
    const map = parseSummaries('完全乱写', 3);
    expect(map.size).toBe(0);
  });

  it('returns empty map for empty string', () => {
    const map = parseSummaries('', 5);
    expect(map.size).toBe(0);
  });
});

// ─── isValidSummaries ───

describe('isValidSummaries', () => {
  it('returns true when enough valid summaries', () => {
    const summaries = ['短', '这是一条足够长的摘要内容', '这也是一条足够长的摘要内容', 'A'.repeat(10), 'B'.repeat(10), 'C'.repeat(10)];
    expect(isValidSummaries(summaries, 10)).toBe(true);
  });

  it('returns false when too few valid summaries', () => {
    const summaries = ['短', '太短', 'A'.repeat(9), ''];
    expect(isValidSummaries(summaries, 10)).toBe(false);
  });

  it('returns true when article count is small and all valid', () => {
    const summaries = ['有效内容至少十个字呀', '有效内容至少十个字呀'];
    expect(isValidSummaries(summaries, 2)).toBe(true);
  });
});

// ─── buildDedupePrompt ───

describe('buildDedupePrompt', () => {
  it('returns system and user messages', () => {
    const items = [{ index: 0, title: 'A', source: 'S' }];
    const msgs = buildDedupePrompt(items);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('includes items in user message', () => {
    const items = [
      { index: 1, title: 'News', source: 'BBC' },
      { index: 2, title: 'Tech', source: 'CNN' },
    ];
    const msgs = buildDedupePrompt(items);
    expect(msgs[1].content).toContain('1. [BBC] News');
    expect(msgs[1].content).toContain('2. [CNN] Tech');
  });
});

// ─── parseDedupeGroups ───

describe('parseDedupeGroups', () => {
  it('parses valid groups', () => {
    const raw = JSON.stringify({ groups: [[0, 2], [1], [3, 4]] });
    const groups = parseDedupeGroups(raw, 5);
    expect(groups).toEqual([[0, 2], [1], [3, 4]]);
  });

  it('handles markdown fences', () => {
    const raw = '```json\n{"groups": [[1, 3]]}\n```';
    const groups = parseDedupeGroups(raw, 5);
    expect(groups).toEqual([[1, 3]]);
  });

  it('deduplicates indices across groups', () => {
    // 如果第二个 group 包含已出现的 index，应被过滤
    const raw = JSON.stringify({ groups: [[0, 1], [1, 2]] });
    const groups = parseDedupeGroups(raw, 5);
    expect(groups).toEqual([[0, 1], [2]]);
  });

  it('filters out-of-range indices', () => {
    const raw = JSON.stringify({ groups: [[0, 99]] });
    const groups = parseDedupeGroups(raw, 3);
    expect(groups).toEqual([[0]]);
  });

  it('returns null for unparseable input', () => {
    expect(parseDedupeGroups('not json', 3)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseDedupeGroups('', 3)).toBeNull();
  });
});

// ─── buildKeywordPrompt ───

describe('buildKeywordPrompt', () => {
  it('returns system and user messages', () => {
    const articles = [{
      title: 'AI 突破',
      source: 'BBC',
      url: 'https://bbc.com/ai',
      summary: 'AI 新突破',
      category: 'tech',
      crawled_at: '2026-08-07',
    }];
    const msgs = buildKeywordPrompt(articles, 10, '2026年8月7日');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toContain('2026年8月7日热点 Top 10');
    expect(msgs[1].content).toContain('[BBC/tech] AI 突破');
  });

  it('includes summary when available', () => {
    const articles = [{
      title: 'Test',
      source: 'S',
      url: '',
      summary: 'Test summary',
      category: 'general',
    }];
    const msgs = buildKeywordPrompt(articles, 5, '今天');
    expect(msgs[1].content).toContain('| Test summary');
  });
});

// ─── parseKeywords ───

describe('parseKeywords', () => {
  it('parses valid keyword items', () => {
    const raw = JSON.stringify({
      keywords: [
        { keyword: '#AI突破', heat_score: 92, category: '科技', indices: [1, 3] },
        { keyword: '#股市大涨', heat_score: 78, category: '财经', indices: [2] },
      ],
    });
    const items = parseKeywords(raw, 5);
    expect(items).toHaveLength(2);
    expect(items[0].keyword).toBe('#AI突破');
    expect(items[0].heat_score).toBe(92);
    expect(items[0].category).toBe('科技');
    expect(items[0].indices).toEqual([1, 3]);
    expect(items[1].keyword).toBe('#股市大涨');
    expect(items[1].indices).toEqual([2]);
  });

  it('handles markdown fences', () => {
    const raw = '```\n{"keywords": [{"keyword": "#A", "indices": [1]}]}\n```';
    const items = parseKeywords(raw, 3);
    expect(items).toHaveLength(1);
  });

  it('filters out-of-range indices', () => {
    const raw = JSON.stringify({
      keywords: [{ keyword: '#A', indices: [0, 99] }],
    });
    const items = parseKeywords(raw, 3);
    expect(items).toHaveLength(1);
    expect(items[0].indices).toEqual([]);
  });

  it('filters items without keyword', () => {
    const raw = JSON.stringify({
      keywords: [
        { keyword: '', indices: [1] },
        { keyword: '  ', indices: [2] },
      ],
    });
    const items = parseKeywords(raw, 5);
    expect(items).toHaveLength(0);
  });

  it('returns empty array for unparseable input', () => {
    expect(parseKeywords('invalid', 3)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseKeywords('', 3)).toEqual([]);
  });
});

// ─── normalizeKeyword ───

describe('normalizeKeyword', () => {
  it('removes # prefix', () => {
    expect(normalizeKeyword('#AI突破')).toBe('ai突破');
  });

  it('removes punctuation', () => {
    expect(normalizeKeyword('AI，突破！')).toBe('ai突破');
  });

  it('converts to lowercase', () => {
    expect(normalizeKeyword('HelloWorld')).toBe('helloworld');
  });

  it('handles multiple special characters', () => {
    expect(normalizeKeyword('#美联储9月降息预期？')).toBe('美联储9月降息预期');
  });

  it('handles Chinese punctuation', () => {
    expect(normalizeKeyword('【突发】美债收益率飙升！')).toBe('突发美债收益率飙升');
  });
});

// ─── bigramJaccard ───

describe('bigramJaccard', () => {
  it('returns 1 for identical strings', () => {
    expect(bigramJaccard('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(bigramJaccard('abc', 'xyz')).toBe(0);
  });

  it('returns value between 0 and 1 for similar strings', () => {
    const sim = bigramJaccard('hello', 'hallo');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('handles short strings (< 2 chars)', () => {
    expect(bigramJaccard('a', 'a')).toBe(1);
    expect(bigramJaccard('a', 'b')).toBe(0);
  });

  it('handles empty strings', () => {
    expect(bigramJaccard('', '')).toBe(1);
    expect(bigramJaccard('', 'a')).toBe(0);
  });
});