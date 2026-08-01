import { Hono } from 'hono';
import { createDb, DbError } from '../db';

type Bindings = {
  D1_API_TOKEN: string;
  D1_API_BASE?: string;
};

type Variables = {
  token: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 1.4 * 1024 * 1024; // 1.4MB → Base64 ≈ 1.87MB < 2MB 单行限制

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── 自动建表 ───
let tableReady = false;
let tableInitError: string | null = null;

async function ensureTable(token: string, base?: string): Promise<boolean> {
  if (tableReady) return true;
  if (tableInitError) return false;

  const db = createDb(token, base);
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS kbox_disk_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      chunks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS kbox_disk_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      chunk_size INTEGER NOT NULL DEFAULT 0
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_disk_chunks_file_id ON kbox_disk_chunks(file_id)`);
    tableReady = true;
    return true;
  } catch (e) {
    const msg = e instanceof DbError ? e.message : '建表失败';
    tableInitError = msg;
    console.error('Disk table init error:', msg);
    return false;
  }
}

function localtimeNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function getDb(c: any) {
  return createDb(c.env.D1_API_TOKEN, c.env.D1_API_BASE);
}

// ensureTable 失败时返回明确错误
function tableError(c: any) {
  return c.json({ error: tableInitError || '数据库初始化失败，请检查 D1_API_TOKEN' }, 503);
}

// ─── 容量统计 ───
app.get('/stats', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    // 文件数量和总大小
    const stats = await db.queryOne<{ count: number; total_size: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM kbox_disk_files`
    );
    // D1 数据库大小（通过 PRAGMA）
    let dbSize = 0;
    try {
      const pagecount = await db.queryAll<{ page_count: number }>('PRAGMA page_count');
      const pagesize = await db.queryAll<{ page_size: number }>('PRAGMA page_size');
      const pc = pagecount[0]?.page_count || 0;
      const ps = pagesize[0]?.page_size || 4096;
      dbSize = pc * ps;
    } catch {
      // PRAGMA 不支持时忽略
    }
    return c.json({
      file_count: stats?.count || 0,
      total_size: stats?.total_size || 0,
      db_size: dbSize,
      max_db_size: 500 * 1024 * 1024, // 500MB
      max_file_size: MAX_FILE_SIZE,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '获取统计失败' }, 500);
  }
});

// ─── 文件列表 ───
app.get('/files', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  try {
    const files = await db.queryAll(
      `SELECT id, name, mime_type, size, chunks, created_at FROM kbox_disk_files ORDER BY created_at DESC`
    );
    return c.json({ files });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '获取列表失败' }, 500);
  }
});

// ─── 创建文件记录 ───
app.post('/files', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ error: '文件名不能为空' }, 400);
  }

  const size = Number(body.size) || 0;
  if (size > MAX_FILE_SIZE) {
    return c.json({ error: `文件大小超过上限（${MAX_FILE_SIZE / 1024 / 1024}MB）` }, 400);
  }

  const mimeType = body.mime_type || '';
  const chunks = Math.ceil(size / CHUNK_SIZE);

  try {
    await db.query(
      `INSERT INTO kbox_disk_files (name, mime_type, size, chunks, created_at) VALUES (?, ?, ?, ?, ?)`,
      [name, mimeType, size, chunks, localtimeNow()]
    );
    const fileRow = await db.queryOne<{ id: number }>(
      `SELECT id FROM kbox_disk_files WHERE name = ? AND size = ? ORDER BY id DESC LIMIT 1`,
      [name, size]
    );
    return c.json({ id: fileRow?.id, name, mime_type: mimeType, size, chunks });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '创建文件失败' }, 500);
  }
});

// ─── 上传分片 ───
app.post('/files/:id/chunks', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  const fileId = Number(c.req.param('id'));

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体必须是有效的JSON' }, 400);
  }

  const chunkIndex = Number(body.chunk_index);
  const content = body.content;
  const chunkSize = Number(body.chunk_size) || 0;

  if (chunkIndex == null || !content) {
    return c.json({ error: '缺少 chunk_index 或 content 字段' }, 400);
  }

  try {
    await db.execute(
      `INSERT INTO kbox_disk_chunks (file_id, chunk_index, content, chunk_size) VALUES (?, ?, ?, ?)`,
      [fileId, chunkIndex, content, chunkSize]
    );
    return c.json({ ok: true, file_id: fileId, chunk_index: chunkIndex });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '上传分片失败' }, 500);
  }
});

// ─── 下载文件 ───
app.get('/files/:id/download', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  const fileId = Number(c.req.param('id'));

  try {
    const file = await db.queryOne<{ name: string; mime_type: string; size: number; chunks: number }>(
      `SELECT name, mime_type, size, chunks FROM kbox_disk_files WHERE id = ?`,
      [fileId]
    );
    if (!file) {
      return c.json({ error: '文件不存在' }, 404);
    }

    const chunks = await db.queryAll<{ chunk_index: number; content: string }>(
      `SELECT chunk_index, content FROM kbox_disk_chunks WHERE file_id = ? ORDER BY chunk_index ASC`,
      [fileId]
    );

    // 拼接 base64 → 解码
    const base64Data = chunks.map(ch => ch.content).join('');
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Response(bytes, {
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length': String(file.size),
      },
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '下载失败' }, 500);
  }
});

// ─── 删除文件 ───
app.delete('/files/:id', async (c) => {
  if (!await ensureTable(c.env.D1_API_TOKEN, c.env.D1_API_BASE)) return tableError(c);
  const db = getDb(c);
  const fileId = Number(c.req.param('id'));

  try {
    await db.execute(`DELETE FROM kbox_disk_chunks WHERE file_id = ?`, [fileId]);
    await db.execute(`DELETE FROM kbox_disk_files WHERE id = ?`, [fileId]);
    return c.json({ ok: true, message: '删除成功' });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : '删除失败' }, 500);
  }
});

export default app;
export { MAX_FILE_SIZE, CHUNK_SIZE };
