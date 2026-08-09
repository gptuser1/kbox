import { getConfigByEnv } from '../services/config';

interface Env {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  TAVILY_API_KEY?: string;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
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
export async function search(
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

export function buildTrendingQuery(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // 北京时间
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return `${month}月${day}日 新闻热点 头条`;
}

/**
 * 搜索全领域今日热点
 */
export async function searchTrending(
  env: Env,
  _queries?: string[],
  maxResults = 20,
): Promise<TavilyResult[]> {
  const apiKey = await getConfigByEnv(env, 'news', 'tavily_api_key');
  if (!apiKey) {
    console.error('Tavily API key not configured');
    return [];
  }

  const query = buildTrendingQuery();
  const results = await search(apiKey, query, {
    searchDepth: 'basic',
    topic: 'news',
    maxResults,
    timeRange: 'day',
    includeAnswer: false,
  });

  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const r of results) {
    if (r.url && !seen.has(r.url)) {
      seen.add(r.url);
      merged.push(r);
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return merged;
}

