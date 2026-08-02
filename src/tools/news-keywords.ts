// 新闻关键词提取与统计
// 从新闻标题中提取高频词，返回 Top N 及其相关新闻

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

// 英文停用词（短/常见/无信息量）
const STOP_WORDS_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'as', 'if', 'then', 'than', 'so',
  'not', 'no', 'yes', 'up', 'out', 'about', 'into', 'over', 'after', 'before',
  'new', 'says', 'said', 'how', 'why', 'what', 'when', 'where', 'who', 'which',
  'can', 'you', 'your', 'we', 'our', 'they', 'their', 'he', 'she', 'him', 'her',
  'more', 'most', 'less', 'least', 'one', 'two', 'three', 'first', 'last',
  'via', 'amid', 'after', 'during', 'while', 'amid', 'among', 'between',
]);

// 中文停用词（单字/常见虚词）
const STOP_WORDS_ZH = new Set([
  '的', '了', '是', '在', '和', '与', '或', '也', '都', '就', '还', '又', '已',
  '将', '会', '能', '可', '要', '想', '需', '应', '该', '被', '把', '让', '使',
  '对', '为', '由', '于', '从', '向', '到', '至', '等', '之', '其', '此', '这',
  '那', '些', '个', '们', '上', '下', '中', '内', '外', '前', '后', '左', '右',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万',
  '只', '才', '再', '并', '且', '但', '而', '因', '所', '以', '若', '如', '虽',
  '新', '大', '小', '多', '少', '高', '低', '长', '短', '好', '坏', '称', '说',
  '日', '月', '年', '时', '分', '秒', '今', '明', '昨', '前', '后',
]);

// 英文专有名词/科技词汇白名单（即使短也保留，且大小写归一化为首字母大写形式便于匹配）
// 这些词在科技新闻里信息量高，不算停用词
const TECH_TERMS = new Set([
  'AI', 'GPT', 'GPU', 'CPU', 'API', 'SDK', 'iOS', 'Mac', 'App', 'Web', 'AWS',
  'GCP', 'LLM', 'NLP', 'VR', 'AR', 'XR', 'IT', 'DB', 'SQL', 'HTML', 'CSS',
  'JS', 'TS', 'C++', 'Go', 'Rust', 'Java', 'Python', 'Ruby', 'PHP', 'Kotlin',
  'Swift', 'Xcode', 'VSCode', 'Linux', 'Windows', 'Android', 'Chrome', 'Safari',
  'Firefox', 'Edge', 'GitHub', 'GitLab', 'Bitbucket', 'Docker', 'Kubernetes',
  'OpenAI', 'Anthropic', 'Google', 'Microsoft', 'Apple', 'Meta', 'Amazon',
  'Nvidia', 'AMD', 'Intel', 'Tesla', 'OpenAI', 'DeepSeek', 'ByteDance',
  'TikTok', 'YouTube', 'Twitter', 'Facebook', 'Instagram', 'WhatsApp',
  'Telegram', 'Discord', 'Slack', 'Notion', 'Figma', 'Vercel', 'Cloudflare',
  'Flutter', 'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt',
  'Fedora', 'Ubuntu', 'Debian', 'Arch', 'MacOS', 'iPadOS', 'watchOS',
  'Vision', 'Copilot', 'Gemini', 'Claude', 'ChatGPT', 'Bard', 'Llama',
  'Mistral', 'Perplexity', 'HuggingFace', 'PyTorch', 'TensorFlow',
  'CUDA', 'ROCm', 'TPU', 'RTX', 'Ryzen', 'Core', 'Xeon', 'Snapdragon',
  'M1', 'M2', 'M3', 'M4', 'A17', 'A18',
]);

/** 判断是否为有意义英文 token（长度>=2 或在科技词白名单） */
function isMeaningfulEn(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (TECH_TERMS.has(t)) return true;
  if (t.length < 3) return false;
  if (STOP_WORDS_EN.has(t.toLowerCase())) return false;
  if (/^\d+$/.test(t)) return false; // 纯数字
  return true;
}

/** 归一化英文 token（保留科技词原样，其他小写） */
function normalizeEn(token: string): string {
  if (TECH_TERMS.has(token)) return token;
  return token.toLowerCase();
}

/** 从标题中提取候选词（中英文混合） */
function extractTokens(title: string): string[] {
  const tokens: string[] = [];
  // 1. 英文 token：连续字母数字 + 点 + +（如 Next.js, C++, GPT-4）
  const enRegex = /[A-Za-z][A-Za-z0-9.+#-]{1,}/g;
  let m: RegExpExecArray | null;
  while ((m = enRegex.exec(title)) !== null) {
    const raw = m[0].replace(/[.+#-]+$/, ''); // 去尾部符号
    if (raw && isMeaningfulEn(raw)) {
      tokens.push(normalizeEn(raw));
    }
  }

  // 2. 中文 2-4 字词组（滑动窗口提取 2/3/4 字组合，取频次高的）
  // 简化方案：提取连续中文字符段，然后切 2-gram 和 3-gram
  const zhSegments = title.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const seg of zhSegments) {
    // 2-gram
    for (let i = 0; i <= seg.length - 2; i++) {
      const word = seg.slice(i, i + 2);
      if (!STOP_WORDS_ZH.has(word[0]) && !STOP_WORDS_ZH.has(word[1])) {
        tokens.push(word);
      }
    }
    // 3-gram（更精确的词组）
    for (let i = 0; i <= seg.length - 3; i++) {
      const word = seg.slice(i, i + 3);
      tokens.push(word);
    }
  }

  return tokens;
}

/**
 * 从新闻列表中提取 Top N 关键词及其相关新闻
 * 算法：
 * 1. 对每条标题分词
 * 2. 统计词频（中文 n-gram 会产生重叠，通过去重相关文章缓解）
 * 3. 按 count 降序取 Top N
 * 4. 每个词关联最多 3 条新闻
 */
export function extractTopKeywords(articles: NewsItem[], topN = 10): KeywordStat[] {
  // keyword -> { count, articleSet (用 title 去重) }
  const stats = new Map<string, { count: number; articles: NewsItem[]; seenTitles: Set<string> }>();

  for (const article of articles) {
    const tokens = extractTokens(article.title);
    // 同一标题内的相同 token 只计一次（避免标题里重复词刷分）
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      if (!stats.has(token)) {
        stats.set(token, { count: 0, articles: [], seenTitles: new Set() });
      }
      const s = stats.get(token)!;
      s.count += 1;
      // 每个词最多关联 3 条新闻，且按标题去重
      if (s.articles.length < 3 && !s.seenTitles.has(article.title)) {
        s.seenTitles.add(article.title);
        s.articles.push(article);
      }
    }
  }

  // 过滤：count >= 2 才算有意义（至少出现 2 次）
  // 但如果总词数太少，放宽到 count >= 1
  const minCount = articles.length > 20 ? 2 : 1;

  const result = Array.from(stats.entries())
    .filter(([, s]) => s.count >= minCount)
    .map(([keyword, s]) => ({ keyword, count: s.count, articles: s.articles }))
    .sort((a, b) => {
      // 主排序：count 降序
      if (b.count !== a.count) return b.count - a.count;
      // 次排序：词长降序（长词优先，避免 2-gram 碎片）
      return b.keyword.length - a.keyword.length;
    });

  // 去重：移除被更长词包含的短词（如 "GPT" 被 "ChatGPT" 包含则去掉 "GPT"）
  // 但科技词白名单里的保留
  const filtered: KeywordStat[] = [];
  const seenKeywords = new Set<string>();
  for (const item of result) {
    let isSubstring = false;
    for (const seen of seenKeywords) {
      if (seen !== item.keyword && seen.includes(item.keyword) && !TECH_TERMS.has(item.keyword)) {
        // 当前词是某个已选词的子串，且不是白名单科技词，跳过
        isSubstring = true;
        break;
      }
    }
    if (!isSubstring) {
      filtered.push(item);
      seenKeywords.add(item.keyword);
    }
    if (filtered.length >= topN) break;
  }

  return filtered;
}
