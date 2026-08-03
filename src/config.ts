// 配置管理模块
// 所有业务配置存于 D1 kbox_kv 表，敏感字段 AES-GCM 加密
//
// 三级降级读取：
//   1. tool:<name> → <key>     工具级覆盖
//   2. app → <key>             全局默认
//   3. c.env.<ENV_NAME>        env 兼容期（首次部署未填配置时）
//
// 缓存：Workers 实例内 60 秒 TTL，避免每次请求重复读 D1

import { createKv } from './kv';
import { encrypt, decrypt, isEncrypted } from './crypto';

// 配置 Schema：定义所有配置项的元信息
export interface ConfigField {
  key: string;
  desc: string;
  sensitive: boolean;
  default?: string;
  placeholder?: string;
  envName?: string; // env 兼容期映射
}

// 全局默认配置（namespace='app'）
const APP_CONFIG_SCHEMA: ConfigField[] = [
  { key: 'openai_api_key',  desc: 'OpenAI API Key',    sensitive: true,  placeholder: 'sk-...', envName: 'OPENAI_API_KEY' },
  { key: 'openai_base_url', desc: 'LLM API 地址',      sensitive: false, default: 'https://api.siliconflow.cn/v1', envName: 'OPENAI_BASE_URL' },
  { key: 'openai_model',    desc: 'LLM 模型名',        sensitive: false, default: 'THUDM/GLM-4-9B-0414', envName: 'OPENAI_MODEL' },
  { key: 'gh_token',        desc: 'GitHub Token',      sensitive: true,  placeholder: 'ghp_...', envName: 'GH_TOKEN' },
  { key: 'tencent_api_base', desc: '腾讯行情 API',     sensitive: false, default: 'https://qt.gtimg.cn' },
  { key: 'yahoo_api_base',  desc: 'Yahoo 行情 API',    sensitive: false, default: 'https://query1.finance.yahoo.com' },
  { key: 'tavily_api_key',  desc: 'Tavily 搜索 API Key', sensitive: true, placeholder: 'tvly-...', envName: 'TAVILY_API_KEY' },
];

export const NS_APP = 'app';
export function toolNs(tool: string) { return 'tool:' + tool; }

// 缓存：key = namespace:key → { value, expireAt }
const cache = new Map<string, { value: any; expireAt: number }>();
const CACHE_TTL = 60 * 1000; // 60 秒

function cacheGet(ns: string, key: string): any | undefined {
  const k = ns + ':' + key;
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (Date.now() > hit.expireAt) {
    cache.delete(k);
    return undefined;
  }
  return hit.value;
}

function cacheSet(ns: string, key: string, value: any) {
  cache.set(ns + ':' + key, { value, expireAt: Date.now() + CACHE_TTL });
}

function cacheInvalidate(ns: string, key?: string) {
  if (key) {
    cache.delete(ns + ':' + key);
  } else {
    // 清除整个 namespace（用前缀匹配）
    const prefix = ns + ':';
    for (const k of cache.keys()) {
      if (k.startsWith(prefix)) cache.delete(k);
    }
  }
}

// 获取主密钥（KBOX_TOKEN，= D1_API_TOKEN = ACCESS_TOKEN）
function masterKey(c: any): string {
  return c.env.D1_API_TOKEN || c.env.ACCESS_TOKEN || '';
}

// 读单条配置（含解密）
async function readConfig(c: any, ns: string, key: string): Promise<string | null> {
  const cached = cacheGet(ns, key);
  if (cached !== undefined) return cached;

  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const value = await kv.get<any>(ns, key);

  let result: string | null = null;
  if (value == null) {
    result = null;
  } else if (typeof value === 'string') {
    result = value;
  } else if (isEncrypted(value)) {
    try {
      result = await decrypt(masterKey(c), value);
    } catch (e) {
      console.error('Config decrypt failed:', ns, key, e instanceof Error ? e.message : e);
      result = null;
    }
  } else {
    // 意外格式，转字符串
    result = String(value);
  }

  cacheSet(ns, key, result);
  return result;
}

// 写单条配置（敏感自动加密）
async function writeConfig(c: any, ns: string, key: string, value: string, sensitive: boolean) {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  let stored: any = value;
  if (sensitive && value) {
    stored = await encrypt(masterKey(c), value);
  }
  await kv.set(ns, key, stored);
  cacheInvalidate(ns, key);
}

// ─── 对外 API ───

// 读取配置（三级降级：tool → app → env → 默认）
export async function getConfig(c: any, tool: string, key: string): Promise<string | null> {
  // 1. 工具级覆盖
  const toolVal = await readConfig(c, toolNs(tool), key);
  if (toolVal != null) return toolVal;

  // 2. 全局默认
  const appVal = await readConfig(c, NS_APP, key);
  if (appVal != null) return appVal;

  // 3. env 兼容期
  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (field?.envName) {
    const envVal = c.env[field.envName];
    if (envVal) return envVal;
  }

  // 4. 代码默认值
  return field?.default || null;
}

// 读取全局配置（跳过工具级，供配置管理 UI 用）
export async function getAppConfig(c: any, key: string): Promise<string | null> {
  return readConfig(c, NS_APP, key);
}

// 读取工具级覆盖配置（仅工具级，不降级；供配置管理 UI 用）
export async function getToolConfig(c: any, tool: string, key: string): Promise<string | null> {
  return readConfig(c, toolNs(tool), key);
}

// 写全局配置
export async function setAppConfig(c: any, key: string, value: string) {
  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (!field) throw new Error('未知配置项: ' + key);
  await writeConfig(c, NS_APP, key, value, field.sensitive);
}

// 删除全局配置（回退到 env/默认）
export async function deleteAppConfig(c: any, key: string) {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  await kv.delete(NS_APP, key);
  cacheInvalidate(NS_APP, key);
}

// 写工具级覆盖配置
export async function setToolConfig(c: any, tool: string, key: string, value: string) {
  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (!field) throw new Error('未知配置项: ' + key);
  await writeConfig(c, toolNs(tool), key, value, field.sensitive);
}

// 删除工具级覆盖（回退到全局）
export async function deleteToolConfig(c: any, tool: string, key: string) {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  await kv.delete(toolNs(tool), key);
  cacheInvalidate(toolNs(tool), key);
}

// 列出所有配置定义（供 UI 渲染表单）
export function getConfigSchema(): ConfigField[] {
  return APP_CONFIG_SCHEMA;
}

// 列出某工具的所有覆盖配置 key（供 UI 显示哪些是工具级覆盖）
export async function listToolOverrides(c: any, tool: string): Promise<string[]> {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const items = await kv.list(toolNs(tool));
  return items.map(i => i.key);
}

// ─── cron 专用：无 Hono context，直接传 env ───
export async function getConfigByEnv(env: any, tool: string, key: string): Promise<string | null> {
  return getConfig({ env }, tool, key);
}
