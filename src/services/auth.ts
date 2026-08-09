// 鉴权中间件：验证所有 /api/* 请求的 Bearer token 或 ?token= 参数
// 注意：下载路径 /api/plugins/disk/files/:id/download 跳过鉴权（使用 download-token 机制）

import { Context, Next } from 'hono';

type Bindings = {
  ACCESS_TOKEN: string;
};

type Variables = {
  token: string;
};

export async function authMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  // 下载路径跳过 token 鉴权（使用独立 download-token 机制）
  if (/^\/api\/plugins\/disk\/files\/\d+\/download$/.test(path)) {
    await next();
    return;
  }
  const auth = c.req.header('Authorization');
  let token = '';
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7).trim();
  } else {
    token = c.req.query('token')?.trim() || '';
  }
  if (!token) {
    return c.json({ error: '缺少鉴权信息，格式: Bearer <token> 或 ?token=<token>' }, 401);
  }
  if (token !== c.env.ACCESS_TOKEN) {
    return c.json({ error: '令牌无效' }, 401);
  }
  c.set('token', token);
  await next();
}
