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
  heat_score?: number;
  category?: string;
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

// ═══ 语义去重（LLM 版）═══
// 字符串去重只能去掉标题完全相同的，无法识别"同一事件不同标题"
// 让 LLM 判断哪些文章讲的是同一事件，每组合并保留一条代表

interface DedupeItem {
  index: number; // 原数组中的下标，用于回填
  title: string;
  source: string;
}

function buildDedupePrompt(items: DedupeItem[]): ChatMessage[] {
  const itemsText = items
    .map(it => `${it.index}. [${it.source}] ${it.title}`)
    .join('\n');

  const systemContent =
    '你是一个新闻去重助手。判断下面这批新闻里哪些讲的是"同一事件"，给出分组。\n'
    + '规则：\n'
    + '1. "同一事件"指核心事实相同（如 BBC 的 "Prolonged drought could cause shortage" 和 "Continued drought could cause shortage" 是同一事件）\n'
    + '2. 不同角度的报道（如"事件本身"和"事件影响分析"）算不同条目，不去重\n'
    + '3. 同一事件的多条合并成一组，只保留第一个 index 作为代表\n'
    + '4. 单条独占的事件也要输出（groups 里包含单元素数组）\n'
    + '5. 严格按 JSON 格式输出，不要任何其他内容：\n'
    + '{\n'
    + '  "groups": [\n'
    + '    [1, 3, 5],\n'
    + '    [2],\n'
    + '    [4, 6]\n'
    + '  ]\n'
    + '}';

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: itemsText },
  ];
}

function parseDedupeGroups(raw: string, itemCount: number): number[][] | null {
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.groups)) {
      const validIndexSet = new Set<number>();
      const groups: number[][] = [];
      for (const group of parsed.groups) {
        if (!Array.isArray(group)) continue;
        const valid = group
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n < itemCount && !validIndexSet.has(n));
        if (valid.length > 0) {
          valid.forEach((n: number) => validIndexSet.add(n));
          groups.push(valid);
        }
      }
      return groups;
    }
  } catch {
    // 解析失败
  }
  return null;
}

/**
 * 用 LLM 对一批新闻做语义去重
 * 输入：文章数组（含 title/source）
 * 输出：去重后的文章数组（每组保留第一条）
 *
 * 注意：仅对单批内去重，不跨批（跨批由 news.ts 的字符串去重 + 库内已有判断兜底）
 */
export async function dedupeArticlesByLLM<T extends { title: string; source: string }>(
  env: Env,
  articles: T[],
): Promise<T[]> {
  if (articles.length <= 1) return articles;

  const apiKey = await getConfigByEnv(env, 'news', 'openai_api_key');
  const baseUrl = await getConfigByEnv(env, 'news', 'openai_base_url');
  const model = await getConfigByEnv(env, 'news', 'openai_model');
  if (!apiKey || !baseUrl || !model) {
    // LLM 不可用时降级为不去重（让字符串去重兜底）
    console.log('LLM not configured for dedupe, skipping semantic dedupe');
    return articles;
  }

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const items: DedupeItem[] = articles.map((a, i) => ({
        index: i,
        title: a.title,
        source: a.source,
      }));
      const messages = buildDedupePrompt(items);
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
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        console.error(`Dedupe attempt ${attempt + 1}/${MAX_RETRIES} HTTP ${res.status}`);
        continue;
      }

      const data: ChatResponse = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (!content.trim()) continue;

      const groups = parseDedupeGroups(content, articles.length);
      if (!groups) {
        console.error(`Dedupe attempt ${attempt + 1}/${MAX_RETRIES}: parse failed`);
        continue;
      }

      // 每组保留第一个 index 对应的文章
      const kept = groups.map(group => articles[group[0]]);
      console.log(`Dedupe: ${articles.length} → ${kept.length} articles (${articles.length - kept.length} duplicates merged)`);
      return kept;
    } catch (e) {
      console.error(`Dedupe attempt ${attempt + 1}/${MAX_RETRIES} threw:`, e instanceof Error ? e.message : String(e));
    }
  }

  // 全部失败，降级为不去重
  console.error('All dedupe attempts failed, returning original array');
  return articles;
}

// ═══ 关键词提取（LLM 版 + Tavily 热度）═══
// 数据源：
//   1. 库内新闻（newsfeed 表，已抓取的详细内容，含 Tavily 入库的全领域热点）
//   2. Tavily 全网热点搜索（带 score，提供实时热度维度）
// LLM 综合两部分，输出今日热点榜 Top N，按热度分降序
// 覆盖全领域（科技/财经/国际/社会/体育/娱乐等），不局限单一方向

import { searchTrending, type TavilyResult } from './tavily-search';

function buildKeywordPrompt(
  articles: NewsItem[],
  tavilyResults: TavilyResult[],
  topN: number,
  dateStr: string,
): ChatMessage[] {
  // 库内新闻（带 index 便于回填关联文章）
  const articlesText = articles
    .map((a, i) => {
      const summary = a.summary ? ` | ${a.summary}` : '';
      return `${i + 1}. [${a.source}/${a.category || 'general'}] ${a.title}${summary}`;
    })
    .join('\n');

  // Tavily 热点（带 score，体现全网热度）
  const tavilyText = tavilyResults.length > 0
    ? tavilyResults
      .slice(0, 30) // 限制长度，避免 prompt 过长
      .map((r, i) => `[热度${r.score.toFixed(2)}] ${r.title}${r.content ? ' - ' + r.content.slice(0, 100) : ''}`)
      .join('\n')
    : '（无 Tavily 实时热点数据，仅基于库内新闻生成）';

  const systemContent =
    `你是热点榜编辑，要生成一份"${dateStr}热点 Top ${topN}"榜单。\n`
    + '榜单覆盖全领域（科技、财经、国际、社会、体育、娱乐、政策等），不局限单一方向。\n'
    + '你有两部分数据：\n'
    + '【库内新闻】已抓取的详细新闻（带编号和来源/分类，用于关联）\n'
    + '【全网热点】来自 Tavily 搜索的实时热点新闻（带 0-1 热度分，体现全网传播热度）\n\n'
    + '要求：\n'
    + `1. 输出 Top ${topN} 热点话题，按热度从高到低排序\n`
    + '2. 话题名用"热搜词条"风格：#开头，口语化有传播力，能让人一眼看懂事件核心\n'
    + '   - 好的例子："#AI内存短缺危机"、"#折叠屏苹果躺赢"、"#美联储9月降息预期"、"#奥运女排决赛"、"#某地暴雨内涝"\n'
    + '   - 差的例子：内存短缺、AI、drought（太泛，信息量低）\n'
    + '3. 每个话题给 heat_score（0-100 整数），综合考量：\n'
    + '   - Tavily 热度分（全网传播度，权重最高）\n'
    + '   - 库内多源覆盖（同一事件被多个来源报道，说明重要）\n'
    + '   - 出现次数（同一事件多条新闻）\n'
    + '   - 突发性/争议性（突发大事件、有争议的话题加分）\n'
    + '4. 语义去重：同一事件（即使标题措辞不同）只输出一个话题，合并相关新闻的 index\n'
    + '   - 例如 BBC 的 "Prolonged drought could cause shortage" 和 "Continued drought could cause shortage" 是同一事件，必须合并\n'
    + '5. 领域多样性：尽量让榜单覆盖不同领域，不要全是科技或全是社会\n'
    + '6. 每个话题关联 1-3 条库内新闻的 index（1-based，用于回填详情）；若库内无对应新闻，indices 填空数组\n'
    + '7. 严格按 JSON 格式输出，不要任何其他内容：\n'
    + '{\n'
    + '  "keywords": [\n'
    + '    {"keyword": "#话题1", "heat_score": 92, "category": "科技", "indices": [1, 3]},\n'
    + '    {"keyword": "#话题2", "heat_score": 78, "category": "财经", "indices": [2]}\n'
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
  category?: string;
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
            category: typeof item.category === 'string' ? item.category : '',
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

  // 并行拉取 Tavily 全领域热点（失败不影响主流程，降级为仅库内新闻）
  // 使用默认 TRENDING_QUERIES，覆盖科技/财经/国际/社会/体育/娱乐等全领域
  let tavilyResults: TavilyResult[] = [];
  try {
    tavilyResults = await searchTrending(env);
    console.log(`Tavily returned ${tavilyResults.length} trending results`);
  } catch (e) {
    console.error('Tavily search failed, falling back to library-only:', e instanceof Error ? e.message : String(e));
  }

  // 取北京时间日期，用于 prompt 里明确日期（不写"今日"）
  const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const dateStr = `${beijingDate.getUTCFullYear()}年${beijingDate.getUTCMonth() + 1}月${beijingDate.getUTCDate()}日`;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = buildKeywordPrompt(articles, tavilyResults, topN, dateStr);
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
            heat_score: item.heat_score || 0,
            category: item.category || '',
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
