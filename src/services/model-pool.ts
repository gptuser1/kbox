import { createKv } from './kv';
import { masterKey } from './config';

// 免费模型池服务（非插件）：
// - refreshModelPool 拉取免费模型并按 AA 指数排序，结果写入 KV
// - readModelPool 供 /api/model-pool/pool 返回「已排序、极简、仅 model+baseurl」清单
// 排序结果是服务端唯一产物，客户端只消费顺序，不接触 AA 分数。

export interface PoolEntry {
  model: string;
  baseurl: string;
}

const NS_POOL = 'model_pool';
const KEY_POOL = 'latest';

const AA_MODELS_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODELS_URL = `${OPENROUTER_BASE}/models`;

const ZEN_BASE = 'https://opencode.ai/zen/v1';
const ZEN_MODELS_URL = `${ZEN_BASE}/models`;

const FETCH_TIMEOUT = 20000;

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

// 归一化模型名，用于 OpenRouter/zen id 与 AA name/别名 的宽松匹配。
// OpenRouter id 形如 "google/gemma-4-26b-a4b-it:free"，AA 的 name 形如 "Gemma 4 26B A4B IT"。
function normalize(name: string): string {
  return name
    .toLowerCase()
    // 去掉 free 态后缀（OpenRouter ":free"、zen "-free"）
    .replace(/:free$/, '')
    .replace(/-free$/, '')
    .replace(/:[a-z]+$/, '')
    // 去掉 provider 前缀 "google/"
    .replace(/^[a-z0-9-]+\//, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// 从 AA 返回中抽取 name -> 智能指数 映射，用户名归一化建表
function buildAaIndex(data: any[]): { index: Map<string, number>; names: Map<string, string> } {
  const index = new Map<string, number>();
  const names = new Map<string, string>();
  for (const m of data || []) {
    const score = m?.evaluations?.artificial_analysis_intelligence_index;
    if (typeof score !== 'number' || !m?.name) continue;
    const key = normalize(m.name);
    index.set(key, score);
    names.set(key, m.name);
  }
  return { index, names };
}

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string | number; completion?: string | number };
}

interface ZenModel {
  id: string;
}

// 拉取 OpenRouter 免费模型（input+output 双 0）
async function fetchOpenRouterFree(): Promise<PoolEntry[]> {
  const data = await fetchJson<{ data?: OpenRouterModel[] }>(OPENROUTER_MODELS_URL);
  const out: PoolEntry[] = [];
  for (const m of data?.data || []) {
    if (!m.id?.endsWith(':free')) continue;
    const prompt = Number(m.pricing?.prompt ?? 1);
    const completion = Number(m.pricing?.completion ?? 1);
    if (prompt === 0 && completion === 0) {
      out.push({ model: m.id, baseurl: OPENROUTER_BASE });
    }
  }
  return out;
}

// 拉取 opencode zen 免费模型（id 以 -free 结尾）
async function fetchZenFree(): Promise<PoolEntry[]> {
  const data = await fetchJson<{ data?: ZenModel[] }>(ZEN_MODELS_URL);
  const out: PoolEntry[] = [];
  for (const m of data?.data || []) {
    if (m.id?.endsWith('-free')) {
      out.push({ model: m.id, baseurl: ZEN_BASE });
    }
  }
  return out;
}

// 拉取 AA 指数（必需）。排序是模型池的唯一意义，缺 key 或拉取失败必须
// 判定为失败，而不是静默降级成一份未排序的假清单。
async function fetchAaIndex(apiKey?: string): Promise<{ index: Map<string, number>; names: Map<string, string> }> {
  if (!apiKey) throw new Error('缺少 AA_API_KEY，无法对模型池排序');
  const data = await fetchJson<{ data?: any[] }>(AA_MODELS_URL, { 'x-api-key': apiKey });
  return buildAaIndex(data?.data || []);
}

// 合成最终清单：多源免费模型 + AA 指数，按智能指数降序。
// AA 分数只用于局部排序，不下发。无 AA 指数者排在有分数者之后。
export async function compilePool(env: any): Promise<PoolEntry[]> {
  const sources = await Promise.all([
    fetchOpenRouterFree().catch(() => []),
    fetchZenFree().catch(() => []),
  ]);
  const free = sources.flat().filter(e => e.model);
  if (free.length === 0) return free;

  const aa = await fetchAaIndex(env.AA_API_KEY);
  const scored: { entry: PoolEntry; score: number }[] = [];
  const unscored: PoolEntry[] = [];
  for (const entry of free) {
    const score = aa.index.get(normalize(entry.model));
    if (score !== undefined) scored.push({ entry, score });
    else unscored.push(entry);
  }

  scored.sort((a, b) => b.score - a.score);
  return [...scored.map(s => s.entry), ...unscored];
}

// 定时/手动刷新：编译并写入 KV
export async function refreshModelPool(env: any): Promise<{ success: boolean; count: number; error?: string }> {
  const kv = createKv(await masterKey({ env }), env.D1_API_BASE, 'cron');
  try {
    const pool = await compilePool(env);
    if (pool.length === 0) return { success: false, count: 0, error: '空模型池' };
    await kv.set(NS_POOL, KEY_POOL, { updated_at: Date.now(), entries: pool });
    console.log(`[model-pool] refreshed ${pool.length} free models`);
    return { success: true, count: pool.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[model-pool] refresh failed:', msg);
    return { success: false, count: 0, error: msg };
  }
}

// 读取极简清单（供 /pool 接口）
export async function readModelPool(env: any): Promise<{ updated_at: number; entries: PoolEntry[] }> {
  const kv = createKv(await masterKey({ env }), env.D1_API_BASE);
  const latest = await kv.getJson<{ updated_at: number; entries: PoolEntry[] }>(NS_POOL, KEY_POOL);
  return latest || { updated_at: 0, entries: [] };
}

// 导出 getter，供 cron action 复用（无 HTTP 开销）
export async function getModelPool(env: any): Promise<PoolEntry[]> {
  try {
    return (await readModelPool(env)).entries;
  } catch {
    return [];
  }
}