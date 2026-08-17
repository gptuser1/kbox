import { createKv } from './kv';
import { encrypt, decrypt, isEncrypted } from './crypto';

export interface ConfigField {
  key: string;
  desc: string;
  sensitive: boolean;
  default?: string;
  placeholder?: string;
  envName?: string;
  plugins?: string[];
}

const APP_CONFIG_SCHEMA: ConfigField[] = [
  { key: 'openai_api_key',  desc: 'OpenAI API Key',    sensitive: true,  placeholder: 'sk-...', envName: 'OPENAI_API_KEY' },
  { key: 'openai_base_url', desc: 'LLM API 地址',      sensitive: false, default: 'https://api.siliconflow.cn/v1', envName: 'OPENAI_BASE_URL' },
  { key: 'openai_model',    desc: 'LLM 模型名',        sensitive: false, default: 'THUDM/GLM-4-9B-0414', envName: 'OPENAI_MODEL' },
  { key: 'gh_token',        desc: 'GitHub Token',      sensitive: true,  placeholder: 'ghp_...' },
  { key: 'tencent_api_base', desc: '腾讯行情 API',     sensitive: false, default: 'https://qt.gtimg.cn' },
  { key: 'yahoo_api_base',  desc: 'Yahoo 行情 API',    sensitive: false, default: 'https://query1.finance.yahoo.com' },
  { key: 'tavily_api_key',  desc: 'Tavily 搜索 API Key', sensitive: true, placeholder: 'tvly-...', envName: 'TAVILY_API_KEY' },
    { key: 'disk_d1_base',  desc: '云盘 D1 REST API 地址', sensitive: false, placeholder: 'https://ocean.klinux.dpdns.org', plugins: ['disk'] },

  { key: 'disk_d1_token', desc: '云盘 D1 REST API Token', sensitive: true,  placeholder: '留空则使用全局主令牌', plugins: ['disk'] },
  { key: 'sys_monitor_history_max', desc: '系统监控最大上报历史数量', sensitive: false, default: '60', plugins: ['sys-monitor'] },
  { key: 'sys_monitor_online_timeout', desc: '系统监控在线超时时间（分钟）', sensitive: false, default: '30', plugins: ['sys-monitor'] },
  { key: 'share_token', desc: '分享端点口令', sensitive: true, placeholder: '留空则禁用分享端点' },
];

export const NS_APP = 'app';
export function pluginNs(plugin: string) { return 'plugin:' + plugin; }

const cache = new Map<string, { value: any; expireAt: number }>();
const CACHE_TTL = 60 * 1000;

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

function masterKey(c: any): string {
  return c.env.D1_API_TOKEN || c.env.ACCESS_TOKEN || '';
}

// 读单条配置（含解密）
async function readConfig(c: any, ns: string, key: string): Promise<string | null> {
  const cached = cacheGet(ns, key);
  if (cached !== undefined) return cached;

  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const value = await kv.getJson<any>(ns, key);

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

// 写单条配置
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

export async function getConfig(c: any, plugin: string, key: string): Promise<string | null> {
  const pluginVal = await readConfig(c, pluginNs(plugin), key);
  if (pluginVal != null) return pluginVal;

  const appVal = await readConfig(c, NS_APP, key);
  if (appVal != null) return appVal;

  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (field?.envName) {
    const envVal = c.env[field.envName];
    if (envVal) return envVal;
  }

  return field?.default || null;
}

export async function getAppConfig(c: any, key: string): Promise<string | null> {
  return readConfig(c, NS_APP, key);
}

// 仅判断指定 namespace 下某 key 是否已存值，不需要明文时不触发解密。
// 敏感配置在列表/读取接口只用于显示「是否已配置」，避免每次 PBKDF2 解密的无谓 CPU。
async function hasStoredConfig(c: any, ns: string, key: string): Promise<boolean> {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const raw = await kv.get(ns, key);
  return raw != null && raw !== '';
}

export async function hasAppConfig(c: any, key: string): Promise<boolean> {
  return hasStoredConfig(c, NS_APP, key);
}

export async function hasPluginConfig(c: any, plugin: string, key: string): Promise<boolean> {
  return hasStoredConfig(c, pluginNs(plugin), key);
}

export async function getPluginConfig(c: any, plugin: string, key: string): Promise<string | null> {
  return readConfig(c, pluginNs(plugin), key);
}

// 写全局配置
export async function setAppConfig(c: any, key: string, value: string) {
  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (!field) throw new Error('未知配置项: ' + key);
  if (field.plugins) throw new Error('该配置项为插件专用，不可写入全局默认');
  await writeConfig(c, NS_APP, key, value, field.sensitive);
}

// 删除全局配置
export async function deleteAppConfig(c: any, key: string) {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  await kv.delete(NS_APP, key);
  cacheInvalidate(NS_APP, key);
}

// 写插件级覆盖配置
export async function setPluginConfig(c: any, plugin: string, key: string, value: string) {
  const field = APP_CONFIG_SCHEMA.find(f => f.key === key);
  if (!field) throw new Error('未知配置项: ' + key);
  if (field.plugins && !field.plugins.includes(plugin)) throw new Error('该配置项为 ' + field.plugins.join('/') + ' 专用，不可写入 ' + plugin);
  await writeConfig(c, pluginNs(plugin), key, value, field.sensitive);
}

// 删除插件级覆盖
export async function deletePluginConfig(c: any, plugin: string, key: string) {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  await kv.delete(pluginNs(plugin), key);
  cacheInvalidate(pluginNs(plugin), key);
}

// 列出所有配置定义（供 UI 渲染表单）
export function getConfigSchema(): ConfigField[] {
  return APP_CONFIG_SCHEMA;
}

// 列出某插件的所有覆盖配置 key
export async function listPluginOverrides(c: any, plugin: string): Promise<string[]> {
  const kv = createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
  const items = await kv.list(pluginNs(plugin));
  return items.map(i => i.key);
}

export async function getConfigByEnv(env: any, plugin: string, key: string): Promise<string | null> {
  return getConfig({ env }, plugin, key);
}
