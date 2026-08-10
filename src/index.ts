// kbox 入口：创建 Hono app，注册中间件与插件路由
import { Hono } from 'hono';
import { renderShellHTML } from './shell-html';
import { authMiddleware } from './services/auth';
import { registerPlugin, mountPlugins } from './adaptation/registry';
import stockPlugin from './plugins/stock/backend';
import diskPlugin from './plugins/disk/backend';
import newsPlugin from './plugins/news/backend';
import dbAdminPlugin from './plugins/db-admin/backend';
import jsRunnerPlugin from './plugins/js-runner/backend';
import sysMonitorPlugin from './plugins/sys-monitor/backend';
import cronPlugin, { runCronTasks } from './plugins/cron/backend';
import configPlugin from './plugins/config/backend';
import ghDispatchPlugin from './plugins/gh-dispatch/backend';
import shareRoutes from './plugins/share/backend';
import preferencesRoutes from './plugins/preferences/backend';

type Bindings = {
  ACCESS_TOKEN: string;
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  GH_TOKEN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  TENCENT_API_BASE?: string;
  YAHOO_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// favicon SVG（简约现代风格：圆角方块 + 渐变折线，插件主题）
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#818cf8"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"/>
  <rect x="8" y="9" width="16" height="3" rx="1.5" fill="url(#line)"/>
  <rect x="8" y="14.5" width="11" height="3" rx="1.5" fill="url(#line)" opacity="0.7"/>
  <rect x="8" y="20" width="14" height="3" rx="1.5" fill="url(#line)" opacity="0.5"/>
  <circle cx="23" cy="15.5" r="2.4" fill="#6366f1"/>
  <circle cx="23" cy="15.5" r="1" fill="#fff" fill-opacity="0.85"/>
</svg>`;

// 全局鉴权中间件（/api/*）
app.use('/api/*', authMiddleware);

// ─── 前端页面与静态资源 ───
app.get('/', (c) => c.html(renderShellHTML()));
app.get('/favicon.svg', (c) => {
  return new Response(FAVICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// ─── 鉴权验证 ───
app.get('/api/verify', (c) => c.json({ ok: true, message: '令牌有效' }));

// ─── 健康检查 ───
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', d1_token: !!c.env.D1_API_TOKEN });
});

// ─── 注册所有插件 ───
registerPlugin(stockPlugin);
registerPlugin(diskPlugin);
registerPlugin(newsPlugin);
registerPlugin(dbAdminPlugin);
registerPlugin(jsRunnerPlugin);
registerPlugin(sysMonitorPlugin);
registerPlugin(cronPlugin);
registerPlugin(configPlugin);
registerPlugin(ghDispatchPlugin);
mountPlugins(app);

// ─── 非插件路由（无前端入口） ───
app.route('/api/preferences', preferencesRoutes);
app.route('/share', shareRoutes);

export default {
  ...app,
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try {
        const result = await runCronTasks(env);
        console.log(`[cron] ran=${result.ran} skipped=${result.skipped} errors=${result.errors}`);
      } catch (e) {
        console.error('[cron] threw:', e instanceof Error ? e.message : String(e));
      }
    })());
  },
};
