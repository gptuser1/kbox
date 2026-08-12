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

// 全局鉴权中间件（/api/*）
app.use('/api/*', authMiddleware);

// ─── 前端页面与静态资源 ───
app.get('/', (c) => c.html(renderShellHTML()));

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
