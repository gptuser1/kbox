import { Hono } from 'hono';
import { DbError } from '../../abstraction/d1';
import { createKv } from '../../services/kv';
import { refreshValuations } from './stock-fetcher';
import { getConfig } from '../../services/config';
import type { BackendPlugin } from '../../adaptation/types';
import { manifest } from './manifest';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  TENCENT_API_BASE?: string;
  YAHOO_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const NS_STOCK = 'stock_funds';

interface FundRecord {
  id: string;
  fund_name: string;
  fund_code: string;
  holdings: string;
  holdings_detail: any[];
  estimated_change: number;
  estimated_time: string;
  created_at: string;
  updated_at: string;
}

// 北京时间
function localtimeNow(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

// 生成短 id
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getKv(c: any) {
  return createKv(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function kvError(c: any, kv: any) {
  return c.json({ error: kv.error() || 'KV 表初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 验证 holdings JSON
function validateHoldings(holdings: string): string | null {
  try {
    const parsed = JSON.parse(holdings);
    if (!Array.isArray(parsed)) return 'holdings必须是一个数组';
    for (const item of parsed) {
      if (!item.name || !item.code || !item.market) {
        return '每条持仓必须包含name、code、market字段';
      }
      if (!['A', 'HK', 'US', 'KR', 'TW', 'JP'].includes(item.market)) {
        return `不支持的市场: ${item.market}`;
      }
    }
    return null;
  } catch {
    return 'holdings不是有效的JSON格式';
  }
}

function errorResponse(c: any, e: unknown, defaultMsg = '服务器内部错误') {
  if (e instanceof DbError) {
    return c.json({ error: e.message }, e.status as any);
  }
  const msg = e instanceof Error ? e.message : defaultMsg;
  return c.json({ error: msg }, 500);
}

interface FundBody {
  fund_name?: string;
  fund_code?: string;
  holdings?: string;
}

// ─── 路由 ───

// 列出所有基金（按 created_at DESC）
app.get('/funds', async (c) => {
  const kv = getKv(c);
  try {
    const items = await kv.list<FundRecord>(NS_STOCK);
    const funds = items
      .map(item => item.value)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    return c.json({ results: funds, count: funds.length });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '获取列表失败');
  }
});

// 获取单个基金
app.get('/funds/:id', async (c) => {
  const kv = getKv(c);
  try {
    const fund = await kv.getJson<FundRecord>(NS_STOCK, c.req.param('id'));
    if (!fund) return c.json({ error: '记录不存在' }, 404);
    return c.json({ results: [fund] });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '获取基金失败');
  }
});

// 新增基金
app.post('/funds', async (c) => {
  const kv = getKv(c);

  let body: FundBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  if (!body.fund_name?.trim()) {
    return c.json({ error: '基金名称不能为空' }, 400);
  }

  const holdings = body.holdings || '[]';
  const validationError = validateHoldings(holdings);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const now = localtimeNow();
  const id = genId();
  const record: FundRecord = {
    id,
    fund_name: body.fund_name.trim(),
    fund_code: (body.fund_code || '').trim(),
    holdings,
    holdings_detail: [],
    estimated_change: 0,
    estimated_time: '',
    created_at: now,
    updated_at: now,
  };

  try {
    await kv.set(NS_STOCK, id, record);
    return c.json({ id, fund_name: record.fund_name, fund_code: record.fund_code, holdings }, 201);
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '创建失败');
  }
});

// 批量导入基金
app.post('/funds/batch', async (c) => {
  const kv = getKv(c);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  if (!Array.isArray(body)) {
    return c.json({ error: '请求体必须是JSON数组' }, 400);
  }

  if (body.length === 0) {
    return c.json({ error: '数组不能为空' }, 400);
  }

  const results: any[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (!item || typeof item !== 'object') {
      errors.push({ index: i, error: '条目必须是对象' });
      continue;
    }
    if (!item.fund_name?.trim()) {
      errors.push({ index: i, error: '基金名称不能为空' });
      continue;
    }
    const holdings = typeof item.holdings === 'string' ? item.holdings : JSON.stringify(item.holdings || []);
    const validationError = validateHoldings(holdings);
    if (validationError) {
      errors.push({ index: i, error: validationError });
      continue;
    }
    const now = localtimeNow();
    const id = genId();
    const record: FundRecord = {
      id,
      fund_name: item.fund_name.trim(),
      fund_code: (item.fund_code || '').trim(),
      holdings,
      holdings_detail: [],
      estimated_change: 0,
      estimated_time: '',
      created_at: now,
      updated_at: now,
    };
    try {
      await kv.set(NS_STOCK, id, record);
      results.push({ id, fund_name: record.fund_name, fund_code: record.fund_code, holdings });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : '创建失败' });
    }
  }

  return c.json({
    success: results.length,
    failed: errors.length,
    results,
    errors,
  }, results.length > 0 ? 201 : 400);
});

// 更新基金
app.put('/funds/:id', async (c) => {
  const kv = getKv(c);
  const id = c.req.param('id');

  let body: FundBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  try {
    const existing = await kv.getJson<FundRecord>(NS_STOCK, id);
    if (!existing) return c.json({ error: '记录不存在' }, 404);

    if (body.fund_name !== undefined) {
      if (!body.fund_name.trim()) {
        return c.json({ error: '基金名称不能为空' }, 400);
      }
      existing.fund_name = body.fund_name.trim();
    }
    if (body.fund_code !== undefined) {
      existing.fund_code = body.fund_code.trim();
    }
    if (body.holdings !== undefined) {
      const validationError = validateHoldings(body.holdings);
      if (validationError) {
        return c.json({ error: validationError }, 400);
      }
      existing.holdings = body.holdings;
    }
    existing.updated_at = localtimeNow();

    await kv.set(NS_STOCK, id, existing);
    return c.json(existing);
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '更新失败');
  }
});

// 删除基金
app.delete('/funds/:id', async (c) => {
  const kv = getKv(c);
  try {
    await kv.delete(NS_STOCK, c.req.param('id'));
    return c.json({ ok: true, message: '删除成功' });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '删除失败');
  }
});

// 手动触发刷新估值
app.post('/refresh', async (c) => {
  const kv = getKv(c);

  try {
    const tencentBase = await getConfig(c, 'stock', 'tencent_api_base');
    const yahooBase = await getConfig(c, 'stock', 'yahoo_api_base');

    const items = await kv.list<FundRecord>(NS_STOCK);
    const allFunds = items
      .map(item => item.value)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

    const { funds: updated, stats } = await refreshValuations(
      async () => allFunds,
      async (id: string, data: any) => {
        const fund = allFunds.find(f => f.id === id);
        if (!fund) return;
        for (const k of Object.keys(data)) {
          (fund as any)[k] = data[k];
        }
        fund.updated_at = localtimeNow();
        await kv.set(NS_STOCK, id, fund);
      },
      {
        TENCENT_API_BASE: tencentBase || undefined,
        YAHOO_API_BASE: yahooBase || undefined,
      },
    );

    return c.json({
      results: updated,
      stats: {
        total_funds: stats.totalFunds,
        updated_funds: stats.updatedFunds,
        failed_funds: stats.failedFunds,
        total_holdings: stats.totalHoldings,
        matched_holdings: stats.matchedHoldings,
        match_rate: stats.totalHoldings > 0
          ? Math.round((stats.matchedHoldings / stats.totalHoldings) * 10000) / 100 + '%'
          : '0%',
        markets: stats.markets,
        time_ms: stats.timeElapsed,
      },
    });
  } catch (e) {
    if (kv.error()) return kvError(c, kv);
    return errorResponse(c, e, '刷新估值失败');
  }
});

// ─── 供 JS Runner / kbox 对象内部直调的读函数 ───
export async function listFunds(env: any): Promise<any[]> {
  const kv = createKv(env.D1_API_TOKEN, env.D1_API_BASE);
  try {
    const items = await kv.list<FundRecord>(NS_STOCK);
    return items
      .map(item => item.value)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  } catch { return []; }
}

// ─── BackendPlugin 导出 ───
const stockPlugin: BackendPlugin = {
  manifest,
  router: app,
};

export default stockPlugin;
