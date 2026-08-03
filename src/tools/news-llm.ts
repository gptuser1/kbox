// 配置通过 getConfig 动态读取（三级降级：tool:news → app → env 兼容）
import { getConfigByEnv } from '../config'

// env 最小集合：只需 D1 连接信息（其余配置从 D1 读）
interface Env {
  D1_API_TOKEN: string
  D1_API_BASE?: string
  // 兼容期字段（首次部署未填配置时降级用）
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  choices: { message: { content: string } }[]
}

// ─── 关键词提取相关接口 ───
export interface NewsItem {
  title: string;
  source: string;
  url: string;
  summary?: string;
  category?: string;
  crawled_at?: string;
}

export interface KeywordStat {
  keyword: string;
  count: number;
  articles: NewsItem[];
}

function buildPrompt(articles: { title: string; source: string }[], attempt: number): ChatMessage[] {
  const articlesText = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
    .join('\n')

  const articleCount = articles.length

  let systemContent =
    '你是一个贴吧老哥，说话要带贴吧味儿。用词犀利、接地气。\n'
    + '全程用中文写锐评，工作语言为中文（专有名词如AI/GPT等可保留英文），不要中英夹杂。\n'
    + `每条锐评50字左右，最少30字，可以更长，精准吐槽。\n`
    + '严格按以下JSON格式输出，不要输出任何其他内容：\n'
    + '{\n'
    + '  "summaries": [\n'
    + `    {"index": 1, "summary": "锐评内容1"},\n`
    + `    {"index": 2, "summary": "锐评内容2"}\n`
    + '  ]\n'
    + `}\n\n一共${articleCount}条，index从1到${articleCount}，必须全部覆盖，不能少。`

  if (attempt > 0) {
    systemContent += `\n\n注意：这是第${attempt + 1}次尝试。之前返回的内容无效或为空，请务必输出有效的JSON格式锐评，每条至少30字。`
  }

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: `给下面这些新闻写贴吧风格锐评：\n\n${articlesText}` },
  ]
}

/** Try JSON parse first, fall back to numbered line parsing */
function parseSummaries(raw: string, articleCount: number): Map<number, string> {
  const map = new Map<number, string>()

  // Attempt 1: JSON parse
  try {
    let jsonStr = raw.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()

    const parsed = JSON.parse(jsonStr)
    if (parsed && Array.isArray(parsed.summaries)) {
      for (const item of parsed.summaries) {
        if (item && typeof item.index === 'number' && typeof item.summary === 'string') {
          const idx = item.index - 1
          if (idx >= 0 && idx < articleCount && item.summary.trim().length > 0) {
            map.set(idx, item.summary.trim())
          }
        }
      }
      return map
    }
  } catch {
    // JSON failed, try fallback parsing
  }

  // Attempt 2: numbered line parsing "1: xxx" or "1. xxx"
  for (const line of raw.split('\n')) {
    const match = line.trim().match(/^(\d+)[:.\、\s]\s*(.+)/)
    if (match) {
      const idx = parseInt(match[1]) - 1
      const text = match[2].trim()
      if (idx >= 0 && idx < articleCount && text.length > 0) {
        map.set(idx, text)
      }
    }
  }

  return map
}

/** Check if the summaries are valid (at least some coverage and reasonable length) */
function isValidSummaries(summaries: string[], articleCount: number): boolean {
  const validOnes = summaries.filter(s => s.trim().length >= 10)
  return validOnes.length >= Math.min(articleCount, 5)
}

export async function summarizeArticles(
  env: Env,
  articles: { title: string; source: string }[],
): Promise<string[]> {
  if (articles.length === 0) return []

  const MAX_RETRIES = 3
  let lastError: string | null = null
  let lastSummaries: string[] | null = null

  // 动态读取配置（tool:news 覆盖 → app 全局 → env 兼容）
  const apiKey = await getConfigByEnv(env, 'news', 'openai_api_key')
  const baseUrl = await getConfigByEnv(env, 'news', 'openai_base_url')
  const model = await getConfigByEnv(env, 'news', 'openai_model')
  if (!apiKey || !baseUrl || !model) {
    console.error('LLM config missing:', { hasKey: !!apiKey, hasUrl: !!baseUrl, hasModel: !!model })
    return articles.map(() => '')
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = buildPrompt(articles, attempt)

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 4096,
          temperature: 0.8,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        lastError = `LLM error (${res.status}): ${body}`
        console.error(`Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${lastError}`)
        continue
      }

      const data: ChatResponse = await res.json()
      const content = data.choices?.[0]?.message?.content || ''

      if (!content.trim()) {
        lastError = 'Empty response from LLM'
        console.error(`Attempt ${attempt + 1}/${MAX_RETRIES}: ${lastError}`)
        continue
      }

      const summaryMap = parseSummaries(content, articles.length)
      const summaries = articles.map((_, i) => summaryMap.get(i) || '')

      if (isValidSummaries(summaries, articles.length)) {
        return summaries
      }

      lastError = 'Summaries too sparse or empty after parsing'
      lastSummaries = summaries
      console.error(`Attempt ${attempt + 1}/${MAX_RETRIES}: ${lastError}`)

    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      console.error(`Attempt ${attempt + 1}/${MAX_RETRIES} threw: ${lastError}`)
    }
  }

  // All retries exhausted — return last partial result if any, else empty
  console.error(`All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`)
  return lastSummaries || articles.map(() => '')
}

// ═══ 关键词提取（LLM 版 + Tavily 热度）═══
// 数据源：
//   1. 库内新闻（newsfeed 表，已抓取的详细内容）
//   2. Tavily 全网热点搜索（带 score，提供热度维度）
// LLM 综合两部分，输出热搜风格 Top N，按热度分降序

import { searchTrending, type TavilyResult } from './tavily-search';

function buildKeywordPrompt(
  articles: NewsItem[],
  tavilyResults: TavilyResult[],
  topN: number,
): ChatMessage[] {
  // 库内新闻（带 index 便于回填关联文章）
  const articlesText = articles
    .map((a, i) => {
      const summary = a.summary ? ` | ${a.summary}` : '';
      return `${i + 1}. [${a.source}] ${a.title}${summary}`;
    })
    .join('\n');

  // Tavily 热点（带 score，体现全网热度）
  const tavilyText = tavilyResults.length > 0
    ? tavilyResults
      .slice(0, 30) // 限制长度，避免 prompt 过长
      .map((r, i) => `[热度${r.score.toFixed(2)}] ${r.title}${r.content ? ' - ' + r.content.slice(0, 100) : ''}`)
      .join('\n')
    : '（无 Tavily 热点数据，仅基于库内新闻生成）';

  const systemContent =
    '你是热搜榜编辑，要生成一份"科技热搜 Top ' + topN + '"。\n'
    + '你有两部分数据：\n'
    + '【库内新闻】已抓取的详细新闻（带编号，用于关联）\n'
    + '【全网热点】来自 Tavily 搜索的热点新闻（带 0-1 热度分，体现全网传播热度）\n\n'
    + '要求：\n'
    + `1. 输出 Top ${topN} 热搜话题，按热度从高到低排序\n`
    + '2. 话题名用"热搜词条"风格：#开头，口语化有传播力（如"#AI内存短缺危机"、"#折叠屏苹果躺赢"，而非"内存短缺"）\n'
    + '3. 每个话题给 heat_score（0-100 整数），综合考量：Tavily 热度分、出现次数、多源覆盖、突发性/争议性\n'
    + '4. 同一事件只输出一个话题（如多条干旱新闻合并成"#全球干旱粮食危机"）\n'
    + '5. 每个话题关联 1-3 条库内新闻的 index（1-based，用于回填详情）\n'
    + '6. 优先选 Tavily 热度高且库内有的话题；若库内无对应新闻，indices 填空数组\n'
    + '7. 严格按 JSON 格式输出，不要任何其他内容：\n'
    + '{\n'
    + '  "keywords": [\n'
    + '    {"keyword": "#话题1", "heat_score": 92, "indices": [1, 3]},\n'
    + '    {"keyword": "#话题2", "heat_score": 78, "indices": [2]}\n'
    + '  ]\n'
    + '}';

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: `【库内新闻】（共 ${articles.length} 条）：\n${articlesText}\n\n【全网热点】（Tavily，按热度降序）：\n${tavilyText}` },
  ];
}

interface LlmKeywordItem {
  keyword: string;
  heat_score?: number;
  indices: number[];
}

function parseKeywords(raw: string, articleCount: number): LlmKeywordItem[] {
  // 去掉 ```json fence
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.keywords)) {
      const items: LlmKeywordItem[] = [];
      for (const item of parsed.keywords) {
        if (item && typeof item.keyword === 'string' && item.keyword.trim()
          && Array.isArray(item.indices)) {
          // 过滤越界 index
          const validIndices = item.indices
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= articleCount);
          items.push({
            keyword: item.keyword.trim(),
            heat_score: typeof item.heat_score === 'number' ? item.heat_score : 0,
            indices: validIndices,
          });
        }
      }
      return items;
    }
  } catch {
    // 解析失败
  }
  return [];
}

/**
 * 用 LLM + Tavily 生成热搜风格 Top N 关键词
 * 数据源：库内新闻 + Tavily 全网热点
 * 返回 KeywordStat[]，articles 字段已回填关联的 NewsItem
 */
export async function extractKeywordsViaLLM(
  env: Env,
  articles: NewsItem[],
  topN = 10,
): Promise<KeywordStat[]> {
  if (articles.length === 0) return [];

  const apiKey = await getConfigByEnv(env, 'news', 'openai_api_key');
  const baseUrl = await getConfigByEnv(env, 'news', 'openai_base_url');
  const model = await getConfigByEnv(env, 'news', 'openai_model');
  if (!apiKey || !baseUrl || !model) {
    console.error('LLM config missing for keywords:', { hasKey: !!apiKey, hasUrl: !!baseUrl, hasModel: !!model });
    return [];
  }

  // 并行拉取 Tavily 热点（失败不影响主流程，降级为仅库内新闻）
  const tavilyQueries = ['今日科技热点 AI热点', 'today trending tech news'];
  let tavilyResults: TavilyResult[] = [];
  try {
    tavilyResults = await searchTrending(env, tavilyQueries, 10);
    console.log(`Tavily returned ${tavilyResults.length} trending results`);
  } catch (e) {
    console.error('Tavily search failed, falling back to library-only:', e instanceof Error ? e.message : String(e));
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = buildKeywordPrompt(articles, tavilyResults, topN);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2048,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Keywords attempt ${attempt + 1}/${MAX_RETRIES} HTTP ${res.status}: ${body}`);
        continue;
      }

      const data: ChatResponse = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        console.error(`Keywords attempt ${attempt + 1}/${MAX_RETRIES}: empty response`);
        continue;
      }

      const items = parseKeywords(content, articles.length);
      if (items.length === 0) {
        console.error(`Keywords attempt ${attempt + 1}/${MAX_RETRIES}: parse returned 0 items`);
        continue;
      }

      // 回填关联文章，按 heat_score 降序
      return items
        .slice(0, topN)
        .sort((a, b) => (b.heat_score || 0) - (a.heat_score || 0))
        .map(item => {
          const relatedArticles = item.indices
            .map(idx => articles[idx - 1])
            .filter(Boolean)
            .slice(0, 3);
          return {
            keyword: item.keyword,
            count: relatedArticles.length,
            articles: relatedArticles,
          };
        });
    } catch (e) {
      console.error(`Keywords attempt ${attempt + 1}/${MAX_RETRIES} threw:`, e instanceof Error ? e.message : String(e));
    }
  }

  console.error(`All ${MAX_RETRIES} keyword attempts failed`);
  return [];
}
