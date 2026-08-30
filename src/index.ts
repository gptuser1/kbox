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
import cronPlugin, { runCronTasks, currentHourCN } from './plugins/cron/backend';
import { refreshModelPool } from './services/model-pool';
import configPlugin from './plugins/config/backend';
import ghDispatchPlugin from './plugins/gh-dispatch/backend';
import postmanPlugin from './plugins/postman/backend';
import shareRoutes from './plugins/share/backend';
import preferencesRoutes from './plugins/preferences/backend';
import modelPoolRoutes from './plugins/model-pool/router';

type Bindings = {
  SECRET: SecretsStoreSecret;
  D1_API_BASE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  TENCENT_API_BASE?: string;
  YAHOO_API_BASE?: string;
  AA_API_KEY?: string;
  // 构建部署信息（由 deploy.yml 经 wrangler --var 注入）
  BUILD_COMMIT?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 全局鉴权中间件（/api/*）
app.use('/api/*', authMiddleware);

// ─── 前端页面与静态资源 ───
app.get('/', (c) => c.html(renderShellHTML(c.env as unknown as Record<string, string | undefined>)));

// ─── 鉴权验证 ───
app.get('/api/verify', (c) => c.json({ ok: true, message: '令牌有效' }));

// ─── 健康检查 ───
app.get('/api/health', async (c) => {
  let secret = false;
  try {
    await c.env.SECRET.get();
    secret = true;
  } catch { /* 未配置 */ }
  return c.json({ status: 'ok', secretConfigured: secret });
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
registerPlugin(postmanPlugin);
mountPlugins(app);

// ─── 非插件路由（无前端入口） ───
app.route('/api/preferences', preferencesRoutes);
app.route('/api/model-pool', modelPoolRoutes);
app.route('/share', shareRoutes);

export default {
  ...app,
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      // 免费模型池每 12h 刷新一次（北京时间 0 点和 12 点各一次，由每小时 cron 顺带触发）
      const hour = currentHourCN();
      if (hour === 0 || hour === 12) {
        try {
          const r = await refreshModelPool(env);
          console.log(`[model-pool] cron refresh success=${r.success} count=${r.count}`);
        } catch (e) {
          console.error('[model-pool] cron refresh threw:', e instanceof Error ? e.message : String(e));
        }
      }
      try {
        const result = await runCronTasks(env);
        console.log(`[cron] ran=${result.ran} skipped=${result.skipped} errors=${result.errors}`);
      } catch (e) {
        console.error('[cron] threw:', e instanceof Error ? e.message : String(e));
      }
    })());
  },
};
