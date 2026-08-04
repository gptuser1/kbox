import { getConfigByEnv } from '../config'

interface Env {
  D1_API_TOKEN: string
  D1_API_BASE?: string
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
    // 尝试编号行解析
  }

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

interface DedupeItem {
  index: number;
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

// ═══ 关键词提取（纯基于库内新闻）═══

function buildKeywordPrompt(
  articles: NewsItem[],
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

  const systemContent =
    `你是热点榜编辑，任务是基于下面给出的"库内新闻"生成一份"${dateStr}热点 Top ${topN}"榜单。\n`
    + '\n'
    + '【输入数据】\n'
    + `下面有 ${articles.length} 条库内新闻，每条带编号（1-based）、来源、分类、标题。\n`
    + '\n'
    + '【硬性规则】\n'
    + '1. 只能用下面列出的库内新闻生成话题，绝对禁止编造、联想、补充任何未在列表中出现的新闻事件。若某个话题在列表里找不到对应新闻，就绝不输出该话题。\n'
    + `2. 输出正好 Top ${topN} 个话题（若库内新闻不足 ${topN} 个独立事件，则按实际事件数输出，宁少勿造）。\n`
    + '3. 每个话题的 indices 必须精确指向下面列表中真实存在的编号（1-based）。indices 里的编号必须对应到讲同一事件的新闻，绝不能张冠李戴。\n'
    + '4. 语义去重（强制）：同一事件即使被多条新闻以不同措辞报道，也只输出一个话题，并把它们的编号全部合并到该话题的 indices 里。\n'
    + '   - 例如 BBC 的 "Prolonged drought could cause shortage" 和 "Continued drought could cause shortage" 是同一事件，必须合并为一个话题，indices 包含两条的编号。\n'
    + '5. 领域多样性：尽量覆盖科技/财经/国际/社会/体育/娱乐/政策等不同领域，不要扎堆单一方向。\n'
    + '\n'
    + '【话题命名风格】\n'
    + '- 以 # 开头，口语化、有传播力，让人一眼看懂事件核心。\n'
    + '- 好的例子："#AI内存短缺危机"、"#折叠屏苹果躺赢"、"#美联储9月降息预期"、"#奥运女排决赛"、"#某地暴雨内涝"。\n'
    + '- 差的例子：内存短缺、AI、drought（太泛、信息量低，不可接受）。\n'
    + '\n'
    + '【热度评分 heat_score】\n'
    + '0-100 整数，综合考量：\n'
    + '- 多源覆盖（同一事件被多个来源报道 → 重要，加分）\n'
    + '- 出现次数（同一事件多条新闻 → 加分）\n'
    + '- 突发性/争议性（突发大事件、有争议的话题 → 加分）\n'
    + '- 领域权重（重大国际/政策事件可适当加分）\n'
    + '\n'
    + '【输出格式】\n'
    + '严格输出以下 JSON，不要任何额外文字、不要 markdown 代码块、不要解释：\n'
    + '{\n'
    + '  "keywords": [\n'
    + '    {"keyword": "#话题1", "heat_score": 92, "category": "科技", "indices": [1, 3]},\n'
    + '    {"keyword": "#话题2", "heat_score": 78, "category": "财经", "indices": [2]}\n'
    + '  ]\n'
    + '}\n'
    + '\n'
    + 'category 字段从以下选一个：科技/财经/国际/社会/体育/娱乐/政策/其他。\n'
    + 'indices 至少 1 个，最多 5 个，必须是上面列表中真实存在的编号。';

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: `库内新闻（共 ${articles.length} 条，编号 1-based）：\n${articlesText}` },
  ];
}

interface LlmKeywordItem {
  keyword: string;
  heat_score?: number;
  category?: string;
  indices: number[];
}

function parseKeywords(raw: string, articleCount: number): LlmKeywordItem[] {
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

// 归一化关键词用于做语义去重前的粗筛：去 #、去标点、转小写
function normalizeKeyword(s: string): string {
  return s.replace(/^#/, '').replace(/[，。、！？：；""''《》（）【】\[\]{}!?,.:;'"()\s\-—–·…#]+/g, '').toLowerCase();
}

// 简单字符重叠度（Jaccard on bigrams），用于检测 LLM 是否在同一事件上重复造话题
function bigramJaccard(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const big = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const sa = big(a), sb = big(b);
  let inter = 0;
  for (const g of sa) if (sb.has(g)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/**
 * 用 LLM 基于库内新闻生成热搜风格 Top N 关键词。
 * 注意：信息源仅有库内已抓取的 newsfeed（RSS + 抓取阶段入库的 Tavily），
 *       此函数不再二次调用 Tavily。LLM 只能基于传入的 articles 生成话题。
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

  const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const dateStr = `${beijingDate.getUTCFullYear()}年${beijingDate.getUTCMonth() + 1}月${beijingDate.getUTCDate()}日`;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = buildKeywordPrompt(articles, topN, dateStr);
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

      // ─── 后处理：丢弃无关联文章的话题、做语义去重 ───
      // 1) indices 为空 = LLM 无法在库内找到对应新闻 = 极可能是幻觉，直接丢弃
      const withArticles = items
        .filter(item => item.indices.length > 0)
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
        })
        .filter(item => item.articles.length > 0);

      // 2) 话题语义去重：归一化后 bigram Jaccard > 0.6 视为同一事件，保留 heat_score 更高的
      const deduped: typeof withArticles = [];
      const usedNorms: string[] = [];
      for (const item of withArticles.sort((a, b) => b.heat_score - a.heat_score)) {
        const norm = normalizeKeyword(item.keyword);
        let dup = false;
        for (const used of usedNorms) {
          if (bigramJaccard(norm, used) > 0.6) {
            dup = true;
            break;
          }
        }
        if (!dup) {
          deduped.push(item);
          usedNorms.push(norm);
        } else {
          console.log(`Top keywords dedupe: dropped "${item.keyword}" as duplicate`);
        }
      }

      return deduped.slice(0, topN);
    } catch (e) {
      console.error(`Keywords attempt ${attempt + 1}/${MAX_RETRIES} threw:`, e instanceof Error ? e.message : String(e));
    }
  }

  console.error(`All ${MAX_RETRIES} keyword attempts failed`);
  return [];
}
