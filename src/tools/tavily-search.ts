// Tavily Search API client
// 文档: https://docs.tavily.com/documentation/api-reference/endpoint/search
// 用途: 搜索全网热点新闻，返回带 score 的结果，为 Top10 关键词提供热度维度
//
// 参考: blog 项目的 .blog-ops/scripts/search_client.py

import { getConfigByEnv } from '../config';

interface Env {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  TAVILY_API_KEY?: string;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number; // 0-1，相关性/热度
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilyResult[];
}

/**
 * 执行一次 Tavily 搜索
 * search_depth: basic（快、便宜） / advanced（深、贵）
 * topic: news（新闻） / general（通用）
 * time_range: day / week / month / year
 */
async function search(
  apiKey: string,
  query: string,
  opts: {
    searchDepth?: 'basic' | 'advanced';
    topic?: 'news' | 'general';
    maxResults?: number;
    timeRange?: 'day' | 'week' | 'month' | 'year';
    includeAnswer?: boolean;
  } = {},
): Promise<TavilyResult[]> {
  const {
    searchDepth = 'basic',
    topic = 'news',
    maxResults = 8,
    timeRange = 'week',
    includeAnswer = false,
  } = opts;

  const payload: any = {
    query,
    search_depth: searchDepth,
    topic,
    max_results: maxResults,
    include_answer: includeAnswer,
    include_raw_content: false,
    include_images: false,
  };
  if (timeRange) payload.time_range = timeRange;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Tavily search HTTP ${res.status}: ${body}`);
      return [];
    }

    const data: TavilySearchResponse = await res.json();
    return data.results || [];
  } catch (e) {
    console.error('Tavily search error:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * 搜索今日热点（多查询词并行，合并去重）
 * 返回带 score 的结果，按 score 降序
 */
export async function searchTrending(
  env: Env,
  queries: string[],
  maxPerQuery = 8,
): Promise<TavilyResult[]> {
  const apiKey = await getConfigByEnv(env, 'news', 'tavily_api_key');
  if (!apiKey) {
    console.error('Tavily API key not configured');
    return [];
  }

  // 并行搜索所有查询词
  const allResults = await Promise.all(
    queries.map(q => search(apiKey, q, {
      searchDepth: 'basic',
      topic: 'news',
      maxResults: maxPerQuery,
      timeRange: 'week',
      includeAnswer: false,
    })),
  );

  // 合并 + 按 url 去重 + 按 score 降序
  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const results of allResults) {
    for (const r of results) {
      if (r.url && !seen.has(r.url)) {
        seen.add(r.url);
        merged.push(r);
      }
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return merged;
}
