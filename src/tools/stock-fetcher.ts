interface Holding {
  name: string;
  code: string;
  market: string;
  weight: number;
}

interface PriceData {
  price: number | null;
  changePct: number | null;
}

interface YahooQuoteItem {
  symbol: string;
  regularMarketPrice: number | null;
  regularMarketChangePercent: number | null;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: YahooQuoteItem[];
    error?: any;
  };
}

interface YahooChartMeta {
  regularMarketPrice: number | null;
  regularMarketChangePercent: number | null;
  previousClose?: number | null;
  chartPreviousClose?: number | null;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta: YahooChartMeta;
    }>;
    error?: any;
  };
}

// 市场代码标准化
function normalizeCode(code: string, market: string): string {
  const trimmed = code.trim();
  if (market === 'HK') {
    // 港股代码统一补齐5位，如 "700" → "00700"
    return trimmed.padStart(5, '0');
  }
  return trimmed;
}

// 获取腾讯行情symbol
function toTencentSymbol(code: string, market: string): string | null {
  if (market === 'A') {
    // 6开头→sh（沪市），0/3开头→sz（深市）
    return code.startsWith('6') ? `sh${code}` : `sz${code}`;
  }
  if (market === 'HK') {
    return `hk${code}`;
  }
  return null;
}

// 获取Yahoo Finance symbol
function toYahooSymbol(code: string, market: string): string | null {
  if (market === 'US') return code;
  if (market === 'KR') return `${code}.KS`;
  if (market === 'TW') return `${code}.TW`;
  if (market === 'JP') return `${code}.T`; // 东京证券交易所
  return null;
}

// ─── 交易所交易时间状态判断 ───
interface MarketSession {
  tz: string;
  sessions: [number, number][]; // 每段交易时段 [startHM, endHM]，如 930 表示 09:30
}

function getMarketInfo(market: string): MarketSession | null {
  switch (market) {
    case 'A':  return { tz: 'Asia/Shanghai',    sessions: [[930, 1130], [1300, 1500]] };
    case 'HK': return { tz: 'Asia/Hong_Kong',   sessions: [[930, 1200], [1300, 1600]] };
    case 'US': return { tz: 'America/New_York', sessions: [[930, 1600]] };
    case 'KR': return { tz: 'Asia/Seoul',       sessions: [[900, 1530]] };
    case 'TW': return { tz: 'Asia/Taipei',      sessions: [[900, 1330]] };
    case 'JP': return { tz: 'Asia/Tokyo',       sessions: [[900, 1130], [1230, 1500]] };
    default:   return null;
  }
}

export interface MarketStatus {
  status: 'open' | 'closed' | 'pre' | 'break' | 'weekend' | 'unknown';
  label: string;
}

export function getMarketStatus(market: string, now: Date = new Date()): MarketStatus {
  const info = getMarketInfo(market);
  if (!info) return { status: 'unknown', label: '未知' };

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: info.tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  let weekday = '', hour = 0, minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    else if (p.type === 'hour') hour = parseInt(p.value, 10);
    else if (p.type === 'minute') minute = parseInt(p.value, 10);
  }
  if (hour === 24) hour = 0;
  const hm = hour * 100 + minute;

  if (weekday === 'Sat' || weekday === 'Sun') {
    return { status: 'weekend', label: '周末休市' };
  }

  let inSession = false, betweenSessions = false;
  for (let i = 0; i < info.sessions.length; i++) {
    const [start, end] = info.sessions[i];
    if (hm >= start && hm <= end) { inSession = true; break; }
    // 在两段交易时段之间的午休
    if (i > 0 && hm > info.sessions[i - 1][1] && hm < start) { betweenSessions = true; }
  }

  if (inSession) return { status: 'open', label: '交易中' };
  if (betweenSessions) return { status: 'break', label: '午休' };

  const firstStart = info.sessions[0][0];
  const lastEnd = info.sessions[info.sessions.length - 1][1];
  if (hm < firstStart) return { status: 'pre', label: '未开盘' };
  return { status: 'closed', label: '已收盘' };
}

// 带超时的fetch封装
async function fetchWithTimeout(url: string, timeoutMs: number = 8000, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { ...headers },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// 解析腾讯行情单行数据
function parseTencentLine(line: string): PriceData | null {
  // 格式: v_sh600519="...";  或  v_hk00700="...";
  const match = line.match(/^v_\w+="(.*)";$/);
  if (!match) return null;

  const fields = match[1].split('~');
  if (fields.length < 33) return null;

  // fields[3] = 当前价, fields[32] = 涨跌幅%
  const price = parseFloat(fields[3]);
  const changePct = parseFloat(fields[32]);

  return {
    price: isNaN(price) ? null : price,
    changePct: isNaN(changePct) ? null : changePct,
  };
}

// 批量拉取腾讯行情（A股+港股）
async function fetchTencent(symbols: string[], apiBase: string): Promise<Map<string, PriceData>> {
  const map = new Map<string, PriceData>();
  if (symbols.length === 0) return map;

  try {
    const url = `${apiBase}/q=${symbols.join(',')}`;
    const res = await fetchWithTimeout(url, 10000, {
      'Referer': 'https://qt.gtimg.cn/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    if (!res.ok) {
      console.error(`Tencent HTTP ${res.status}`);
      return map;
    }

    const text = await res.text();
    // 每行一条数据，格式: v_sh600519="...";\n
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 提取symbol key: v_sh600519
      const keyMatch = trimmed.match(/^v_(\w+)=".*";$/);
      if (!keyMatch) continue;

      const symbol = keyMatch[1]; // e.g., "sh600519" or "hk00700"
      const priceData = parseTencentLine(trimmed);
      if (priceData) {
        map.set(symbol, priceData);
      }
    }
  } catch (e) {
    console.error('Tencent API error:', e instanceof Error ? e.message : e);
  }
  return map;
}

// 批量拉取Yahoo行情（美/韩/台）
async function fetchYahooBatch(symbols: string[], apiBase: string): Promise<Map<string, PriceData>> {
  const map = new Map<string, PriceData>();
  if (symbols.length === 0) return map;

  // 尝试v7批量接口
  try {
    const url = `${apiBase}/v7/finance/quote?symbols=${symbols.join(',')}`;
    const res = await fetchWithTimeout(url, 8000, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    if (res.ok) {
      const data: YahooQuoteResponse = await res.json();
      if (data?.quoteResponse?.result && Array.isArray(data.quoteResponse.result)) {
        for (const item of data.quoteResponse.result) {
          if (item.symbol) {
            map.set(item.symbol, {
              price: item.regularMarketPrice ?? null,
              changePct: item.regularMarketChangePercent ?? null,
            });
          }
        }
        // 检查是否所有symbol都有数据
        const missing = symbols.filter(s => !map.has(s));
        if (missing.length === 0) return map;
        // 有缺失的继续用v8补
        symbols = missing;
      }
    }
  } catch (e) {
    console.error('Yahoo batch API error, falling back to individual:', e instanceof Error ? e.message : e);
  }

  // 逐个拉取v8 chart接口（并行）
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const url = `${apiBase}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetchWithTimeout(url, 5000, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
        if (!res.ok) return;
        const data: YahooChartResponse = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          let changePct = meta.regularMarketChangePercent ?? null;
          // Yahoo 不再返回 changePercent 时用前收价计算
          if (changePct == null) {
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
            if (prev && prev !== 0) {
              changePct = Math.round(((meta.regularMarketPrice - prev) / prev) * 10000) / 100;
            }
          }
          map.set(symbol, {
            price: meta.regularMarketPrice,
            changePct,
          });
        }
      } catch (e) {
        console.error(`Yahoo chart error for ${symbol}:`, e instanceof Error ? e.message : e);
      }
    })
  );

  return map;
}

export interface HoldingDetail {
  name: string;
  code: string;
  market: string;
  weight: number;
  price: number | null;
  changePct: number | null;
  contribution: number | null; // 该持仓对基金涨跌幅的贡献（百分比）
  status: string;
  statusLabel: string;
}

export interface FundUpdate {
  id: number;
  fund_name: string;
  fund_code: string;
  holdings: string;
  holdings_detail: string;
  estimated_change: number;
  estimated_time: string;
}

export interface RefreshStats {
  totalFunds: number;
  updatedFunds: number;
  failedFunds: number;
  totalHoldings: number;
  matchedHoldings: number;
  timeElapsed: number;
  markets: string[];
}

export async function refreshValuations(
  getFunds: () => Promise<any[]>,
  updateFund: (id: number, data: any) => Promise<any>,
  env?: { TENCENT_API_BASE?: string; YAHOO_API_BASE?: string }
): Promise<{ funds: FundUpdate[]; stats: RefreshStats }> {
  const startTime = Date.now();
  const funds = await getFunds();
  if (!funds.length) {
    return {
      funds: [],
      stats: { totalFunds: 0, updatedFunds: 0, failedFunds: 0, totalHoldings: 0, matchedHoldings: 0, timeElapsed: 0, markets: [] },
    };
  }

  // 收集所有持仓，按数据源分组
  const tencentLookup: { symbol: string; code: string; fundId: number; holding: Holding }[] = [];
  const yahooLookup: { symbol: string; fundId: number; holding: Holding }[] = [];
  const markets = new Set<string>();

  for (const fund of funds) {
    let holdings: Holding[];
    try {
      holdings = JSON.parse(fund.holdings || '[]');
      if (!Array.isArray(holdings)) continue;
    } catch {
      continue;
    }

    for (const h of holdings) {
      if (!h.name || !h.code || !h.market) continue;
      markets.add(h.market);

      const normalizedCode = normalizeCode(h.code, h.market);

      // 腾讯行情（A股+港股）
      const tSymbol = toTencentSymbol(normalizedCode, h.market);
      if (tSymbol) {
        tencentLookup.push({ symbol: tSymbol, code: normalizedCode, fundId: fund.id, holding: h });
        continue;
      }

      // Yahoo Finance（美/韩/台/日）
      const ySymbol = toYahooSymbol(normalizedCode, h.market);
      if (ySymbol) {
        yahooLookup.push({ symbol: ySymbol, fundId: fund.id, holding: h });
      }
    }
  }

  // 去重后拉取
  const uniqueTencent = [...new Set(tencentLookup.map(x => x.symbol))];
  const uniqueYahoo = [...new Set(yahooLookup.map(x => x.symbol))];

  const tencentBase = env?.TENCENT_API_BASE || 'https://qt.gtimg.cn';
  const yahooBase = env?.YAHOO_API_BASE || 'https://query1.finance.yahoo.com';

  const [tencentPrices, yahooPrices] = await Promise.all([
    fetchTencent(uniqueTencent, tencentBase),
    fetchYahooBatch(uniqueYahoo, yahooBase),
  ]);

  // 为每个持仓匹配价格
  function getPrice(holding: Holding): PriceData {
    const code = normalizeCode(holding.code, holding.market);

    if (holding.market === 'A' || holding.market === 'HK') {
      const symbol = toTencentSymbol(code, holding.market);
      if (!symbol) return { price: null, changePct: null };
      return tencentPrices.get(symbol) ?? { price: null, changePct: null };
    }

    const symbol = toYahooSymbol(code, holding.market);
    if (!symbol) return { price: null, changePct: null };
    return yahooPrices.get(symbol) ?? { price: null, changePct: null };
  }

  // 计算每个基金的加权涨跌幅
  const nowDate = new Date();
  const now = nowDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const updated: FundUpdate[] = [];
  let totalHoldings = 0;
  let matchedHoldings = 0;
  let failedFunds = 0;

  for (const fund of funds) {
    let holdings: Holding[];
    try {
      holdings = JSON.parse(fund.holdings || '[]');
      if (!Array.isArray(holdings)) { failedFunds++; continue; }
    } catch {
      failedFunds++;
      continue;
    }

    let totalWeight = 0;
    let weightedChange = 0;
    const details: HoldingDetail[] = [];

    for (const h of holdings) {
      if (!h.name || !h.code || !h.market) continue;
      totalHoldings++;
      const w = Number(h.weight) || 0;
      totalWeight += w;
      const { changePct, price } = getPrice(h);
      const mStatus = getMarketStatus(h.market, nowDate);

      let contribution: number | null = null;
      if (changePct !== null) {
        weightedChange += w * changePct;
        matchedHoldings++;
        contribution = w * changePct;
      }

      details.push({
        name: h.name,
        code: h.code,
        market: h.market,
        weight: w,
        price,
        changePct,
        contribution,
        status: mStatus.status,
        statusLabel: mStatus.label,
      });
    }

    const estimatedChange = totalWeight > 0
      ? Math.round((weightedChange / totalWeight) * 10000) / 10000
      : 0;

    // 同时规范化 contribution 单位为百分比（保留4位小数）
    for (const d of details) {
      if (d.contribution !== null && totalWeight > 0) {
        d.contribution = Math.round((d.contribution / totalWeight) * 10000) / 10000;
      }
    }

    const holdingsDetail = JSON.stringify(details);

    try {
      await updateFund(fund.id, {
        estimated_change: estimatedChange,
        estimated_time: now,
        updated_at: now,
        holdings_detail: holdingsDetail,
      });
    } catch (e) {
      console.error(`Failed to update fund ${fund.id}:`, e);
      failedFunds++;
      continue;
    }

    updated.push({
      id: fund.id,
      fund_name: fund.fund_name,
      fund_code: fund.fund_code,
      holdings: fund.holdings,
      holdings_detail: holdingsDetail,
      estimated_change: estimatedChange,
      estimated_time: now,
    });
  }

  return {
    funds: updated,
    stats: {
      totalFunds: funds.length,
      updatedFunds: updated.length,
      failedFunds,
      totalHoldings,
      matchedHoldings,
      timeElapsed: Date.now() - startTime,
      markets: [...markets].sort(),
    },
  };
}