import { Hono } from 'hono';
import { createDb, DbError } from '../db';
import { refreshValuations } from './stock-fetcher';
import { getConfig } from '../config';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
  // env 兼容期字段（首次部署未填配置时降级用）
  TENCENT_API_BASE?: string;
  YAHOO_API_BASE?: string;
};

type Variables = {
  token: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── 自动建表 ───
let tableReady = false;
let tableInitError: string | null = null;

async function ensureTable(token: string, base?: string): Promise<boolean> {
  if (tableReady) return true;
  if (tableInitError) return false;

  const db = createDb(token, base);
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS stock_fund_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_name TEXT NOT NULL,
      fund_code TEXT DEFAULT '',
      holdings TEXT NOT NULL DEFAULT '[]',
      holdings_detail TEXT NOT NULL DEFAULT '[]',
      estimated_change REAL DEFAULT 0,
      estimated_time TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`);
    // 兼容已存在的旧表：尝试添加 holdings_detail 字段（已存在则忽略错误）
    try {
      await db.query(`ALTER TABLE stock_fund_holdings ADD COLUMN holdings_detail TEXT NOT NULL DEFAULT '[]'`);
    } catch {
      // 字段已存在，忽略
    }
    tableReady = true;
    return true;
  } catch (e) {
    const msg = e instanceof DbError ? e.message : '建表失败';
    tableInitError = msg;
    console.error('Stock table init error:', msg);
    return false;
  }
}

// 北京时间（与 cloud-disk 保持一致）
function localtimeNow(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function getDb(c: any) {
  return createDb(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

function tableError(c: any) {
  return c.json({ error: tableInitError || '数据库初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// 验证holdings JSON
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

// 列出所有基金
app.get('/funds', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    const funds = await db.queryAll(
      `SELECT * FROM stock_fund_holdings ORDER BY created_at DESC`
    );
    return c.json({ results: funds, count: funds.length });
  } catch (e) {
    return errorResponse(c, e, '获取列表失败');
  }
});

// 获取单个基金
app.get('/funds/:id', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    const fund = await db.queryOne(
      `SELECT * FROM stock_fund_holdings WHERE id = ?`,
      [Number(c.req.param('id'))]
    );
    if (!fund) return c.json({ error: '记录不存在' }, 404);
    return c.json({ results: [fund] });
  } catch (e) {
    return errorResponse(c, e, '获取基金失败');
  }
});

// 新增基金
app.post('/funds', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);

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

  try {
    const now = localtimeNow();
    await db.execute(
      `INSERT INTO stock_fund_holdings (fund_name, fund_code, holdings, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [body.fund_name.trim(), (body.fund_code || '').trim(), holdings, now, now]
    );
    const row = await db.queryOne<{ id: number }>(
      `SELECT id FROM stock_fund_holdings WHERE fund_name = ? AND created_at = ? ORDER BY id DESC LIMIT 1`,
      [body.fund_name.trim(), now]
    );
    return c.json({ id: row?.id, fund_name: body.fund_name.trim(), fund_code: (body.fund_code || '').trim(), holdings }, 201);
  } catch (e) {
    return errorResponse(c, e, '创建失败');
  }
});

// 批量导入基金
app.post('/funds/batch', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);

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
    try {
      const now = localtimeNow();
      await db.execute(
        `INSERT INTO stock_fund_holdings (fund_name, fund_code, holdings, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [item.fund_name.trim(), (item.fund_code || '').trim(), holdings, now, now]
      );
      const row = await db.queryOne<{ id: number }>(
        `SELECT id FROM stock_fund_holdings WHERE fund_name = ? AND created_at = ? ORDER BY id DESC LIMIT 1`,
        [item.fund_name.trim(), now]
      );
      results.push({ id: row?.id, fund_name: item.fund_name.trim(), fund_code: (item.fund_code || '').trim(), holdings });
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
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);

  let body: FundBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [localtimeNow()];

  if (body.fund_name !== undefined) {
    if (!body.fund_name.trim()) {
      return c.json({ error: '基金名称不能为空' }, 400);
    }
    sets.push('fund_name = ?');
    params.push(body.fund_name.trim());
  }

  if (body.fund_code !== undefined) {
    sets.push('fund_code = ?');
    params.push(body.fund_code.trim());
  }

  if (body.holdings !== undefined) {
    const validationError = validateHoldings(body.holdings);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }
    sets.push('holdings = ?');
    params.push(body.holdings);
  }

  params.push(Number(c.req.param('id')));

  try {
    await db.execute(
      `UPDATE stock_fund_holdings SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    const row = await db.queryOne(
      `SELECT * FROM stock_fund_holdings WHERE id = ?`,
      [Number(c.req.param('id'))]
    );
    return c.json(row);
  } catch (e) {
    return errorResponse(c, e, '更新失败');
  }
});

// 删除基金
app.delete('/funds/:id', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    await db.execute(
      `DELETE FROM stock_fund_holdings WHERE id = ?`,
      [Number(c.req.param('id'))]
    );
    return c.json({ ok: true, message: '删除成功' });
  } catch (e) {
    return errorResponse(c, e, '删除失败');
  }
});

// 手动触发刷新估值
app.post('/refresh', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);

  try {
    // 行情 API 地址走配置（tool:stock 覆盖 → app 全局 → env 兼容 → 代码默认）
    const tencentBase = await getConfig(c, 'stock', 'tencent_api_base');
    const yahooBase = await getConfig(c, 'stock', 'yahoo_api_base');
    const { funds: updated, stats } = await refreshValuations(
      async () => db.queryAll(`SELECT * FROM stock_fund_holdings ORDER BY created_at DESC`),
      async (id: number, data: any) => {
        const sets: string[] = [];
        const params: any[] = [];
        for (const k of Object.keys(data)) {
          sets.push(`${k} = ?`);
          params.push(data[k]);
        }
        params.push(id);
        await db.execute(`UPDATE stock_fund_holdings SET ${sets.join(', ')} WHERE id = ?`, params);
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
    return errorResponse(c, e, '刷新估值失败');
  }
});

export default app;
