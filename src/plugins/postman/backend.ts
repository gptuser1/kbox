// 插件：轻量 Postman — 后端转发
// 由 kbox worker 代发 HTTP 请求，绕开浏览器 CORS 限制。
// 请求经 /api/plugins/postman 鉴权后发出，可携带任意自定义头并读取完整响应。
import { Hono } from 'hono';
import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

type Bindings = {};
type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 最大响应体（防止拖垮 worker），此处用 5MB 足够覆盖常规 API
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

// 轻量 SSRF 防护：仅允许 http/https，拒绝内网/回环/保留/链路本地地址
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h)) {
    const parts = h.split('.').map(Number);
    if (parts.length !== 4) return false;
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 链路本地
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // 组播/保留
    return false;
  }
  return false;
}

function safeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL 格式无效');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http/https 协议');
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error('不允许访问内网/本地地址: ' + url.hostname);
  }
  return url;
}

// POST /request — 代发 HTTP 请求
app.post('/request', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const method = (typeof body.method === 'string' ? body.method : 'GET').toUpperCase();
  const urlRaw = typeof body.url === 'string' ? body.url.trim() : '';
  const headers = body && typeof body.headers === 'object' ? body.headers : {};
  const rawBody = typeof body.body === 'string' ? body.body : '';

  if (!urlRaw) return c.json({ error: '缺少 URL' }, 400);

  let url: URL;
  try {
    url = safeUrl(urlRaw);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'URL 不合法' }, 400);
  }

  const init: RequestInit = { method, headers };
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  if (hasBody && rawBody) init.body = rawBody;

  try {
    const res = await fetch(url.toString(), init);
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => { resHeaders[key] = value; });

    let responseBody = '';
    if (res.headers.get('content-type')?.includes('application/json')) {
      try {
        responseBody = await res.clone().text();
        if (responseBody.length > MAX_RESPONSE_BYTES) {
          responseBody = responseBody.slice(0, MAX_RESPONSE_BYTES) + '\n…(已截断)';
        }
      } catch { /* 读取失败 */ }
    } else {
      try {
        const buf = await res.arrayBuffer();
        responseBody = new TextDecoder('utf-8').decode(buf.slice(0, MAX_RESPONSE_BYTES));
      } catch { /* 读取失败 */ }
    }

    return c.json({
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: responseBody,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '转发请求失败' }, 502);
  }
});

const postmanPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default postmanPlugin;