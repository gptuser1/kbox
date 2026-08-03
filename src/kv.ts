import { createDb, DbError } from './db';

// 通用 KV 表：每个 D1 数据库各自维护一份 kbox_kv（同名同结构，物理独立）
// 表结构：namespace + key 联合主键，value 存 JSON 字符串
//
// 适用：小对象（<100KB）、低频读写、按主键查
// 不适用：大 value（>1MB）、需字段级索引/排序/聚合 → 用专用表
//
// 多库说明：建表状态按连接（token+base）缓存，不同数据库各自独立确保。
// 主 kbox 应用用 ocean 的 kbox_kv，云盘等工具可指向 forest 的 kbox_kv，互不影响。

// 按连接缓存建表状态，避免单例缓存误导其他连接
const kvTableReady = new Map<string, boolean>();
const kvTableError = new Map<string, string | null>();

function connKey(token: string, base?: string): string {
  return token + '|' + (base || '');
}

async function ensureKvTable(token: string, base?: string): Promise<boolean> {
  const ck = connKey(token, base);
  if (kvTableReady.get(ck)) return true;
  if (kvTableError.has(ck)) return false;

  const db = createDb(token, base);
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS kbox_kv (
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (namespace, key)
    )`);
    kvTableReady.set(ck, true);
    return true;
  } catch (e) {
    const msg = e instanceof DbError ? e.message : '建表失败';
    kvTableError.set(ck, msg);
    console.error('KV table init error:', msg);
    return false;
  }
}

// 重置状态（仅测试用）
export function _resetKvState() {
  kvTableReady.clear();
  kvTableError.clear();
}

export function createKv(token: string, base?: string) {
  const apiBase = base;
  const ck = connKey(token, base);

  async function ensure(): Promise<boolean> {
    return ensureKvTable(token, apiBase);
  }

  // 返回该连接的建表错误（无错误或未尝试返回 null）
  function error(): string | null {
    return kvTableError.get(ck) || null;
  }

  return {
    ensure,
    error,

    // ─── 读单条 ───
    // 返回解析后的对象，不存在返回 null
    async get<T = any>(namespace: string, key: string): Promise<T | null> {
      if (!await ensure()) throw new Error(error() || 'KV 表未就绪');
      const db = createDb(token, apiBase);
      const row = await db.queryOne<{ value: string }>(
        `SELECT value FROM kbox_kv WHERE namespace = ? AND key = ?`,
        [namespace, key]
      );
      if (!row) return null;
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    },

    // ─── 读多条（按 namespace） ───
    // 返回 [{key, value}] 数组，value 已解析
    async list<T = any>(namespace: string, keyPrefix?: string): Promise<Array<{ key: string; value: T }>> {
      if (!await ensure()) throw new Error(error() || 'KV 表未就绪');
      const db = createDb(token, apiBase);
      let rows: Array<{ key: string; value: string }>;
      if (keyPrefix) {
        // 前缀匹配：利用复合主键索引，namespace 等值 + key 前缀扫描
        rows = await db.queryAll(
          `SELECT key, value FROM kbox_kv WHERE namespace = ? AND key LIKE ? ORDER BY key`,
          [namespace, keyPrefix + '%']
        );
      } else {
        rows = await db.queryAll(
          `SELECT key, value FROM kbox_kv WHERE namespace = ? ORDER BY key`,
          [namespace]
        );
      }
      return rows.map(r => {
        let value: any;
        try { value = JSON.parse(r.value); } catch { value = null; }
        return { key: r.key, value: value as T };
      });
    },

    // ─── 写（upsert） ───
    // 整体覆盖模式：直接替换 value，避免读-改-写竞态
    async set<T = any>(namespace: string, key: string, value: T): Promise<void> {
      if (!await ensure()) throw new Error(error() || 'KV 表未就绪');
      const db = createDb(token, apiBase);
      const jsonStr = JSON.stringify(value);
      // SQLite 参数化绑定处理引号转义，JSON.stringify 已处理内部转义
      await db.execute(
        `INSERT INTO kbox_kv (namespace, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(namespace, key) DO UPDATE SET value = ?, updated_at = ?`,
        [namespace, key, jsonStr, localtimeNow(), jsonStr, localtimeNow()]
      );
    },

    // ─── 删单条 ───
    async delete(namespace: string, key: string): Promise<void> {
      if (!await ensure()) throw new Error(error() || 'KV 表未就绪');
      const db = createDb(token, apiBase);
      await db.execute(
        `DELETE FROM kbox_kv WHERE namespace = ? AND key = ?`,
        [namespace, key]
      );
    },

    // ─── 删整个 namespace（或带前缀的子集） ───
    async clear(namespace: string, keyPrefix?: string): Promise<void> {
      if (!await ensure()) throw new Error(error() || 'KV 表未就绪');
      const db = createDb(token, apiBase);
      if (keyPrefix) {
        await db.execute(
          `DELETE FROM kbox_kv WHERE namespace = ? AND key LIKE ?`,
          [namespace, keyPrefix + '%']
        );
      } else {
        await db.execute(
          `DELETE FROM kbox_kv WHERE namespace = ?`,
          [namespace]
        );
      }
    },
  };
}

// 北京时间（与 cloud-disk 保持一致）
function localtimeNow(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}
