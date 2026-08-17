import { DbError, SOURCE_HEADER } from '../../abstraction/d1';
import { masterKey } from '../../services/config';
import { createKv } from '../../services/kv';

export type Bindings = {
  SECRET: SecretsStoreSecret;
  D1_API_BASE?: string;
};

export type Variables = {
  token: string;
};

export const NS = 'db_admin_connections';

export interface DbConnection {
  id: string;
  name: string;
  base_url: string;
  database: string;
  created_at: string;
  updated_at: string;
}

// 北京时间
export function localtimeNow(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

// 生成短 id（与 stock/dispatch 一致的风格）
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function getKv(c: any) {
  return createKv(await masterKey(c), c.env.D1_API_BASE);
}

export function errorResponse(c: any, e: unknown, defaultMsg = '服务器内部错误') {
  if (e instanceof DbError) {
    return c.json({ error: e.message }, e.status as any);
  }
  const msg = e instanceof Error ? e.message : defaultMsg;
  return c.json({ error: msg }, 500);
}

export function kvError(c: any, kv: any) {
  return c.json({ error: kv.error() || 'KV 表初始化失败，请检查主令牌' }, 503);
}

// 表名/列名仅允许字母数字下划线，防止注入
export function sanitizeIdent(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

// 拼接 /query 端点 URL
export function buildQueryUrl(conn: Pick<DbConnection, 'base_url' | 'database'>): string {
  const base = conn.base_url.replace(/\/+$/, '');
  return conn.database
    ? `${base}/${conn.database}/query`
    : `${base}/query`;
}

// 调用 d1-rest 执行 SQL
export async function callD1Rest(
  env: Bindings,
  conn: Pick<DbConnection, 'base_url' | 'database'>,
  query: string,
  params: any[] = [],
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = buildQueryUrl(conn);
  const tk = await masterKey({ env });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tk}`,
      'Content-Type': 'application/json',
      [SOURCE_HEADER]: 'default',
    },
    body: JSON.stringify({ query, params }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应 */ }
  return { ok: res.ok, status: res.status, data };
}

// 取连接（404 友好）：成功返回 DbConnection，失败返回 Response
export async function getConn(c: any, id: string): Promise<DbConnection | Response> {
  const kv = await getKv(c);
  try {
    const conn = await kv.getJson<DbConnection>(NS, id);
    if (!conn) return c.json({ error: '连接不存在' }, 404);
    return conn;
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '读取连接失败');
  }
}