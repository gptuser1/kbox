export function renderFrontend(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kbox</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
:root {
  --bg: #f0f2f5;
  --card: #ffffff;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-light: #eef2ff;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --success: #22c55e;
  --text: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --bar-bg: rgba(255,255,255,0.95);
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 24px rgba(0,0,0,0.08);
  --input-bg: #f0f2f5;
  --tag-bg: #f1f5f9;
  --overlay: rgba(0,0,0,0.5);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --card: #1e293b;
    --primary: #818cf8;
    --primary-hover: #6366f1;
    --primary-light: #1e1b4b;
    --danger: #f87171;
    --danger-hover: #ef4444;
    --success: #4ade80;
    --text: #e2e8f0;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --border: #334155;
    --bar-bg: rgba(15,23,42,0.95);
    --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
    --shadow-lg: 0 4px 24px rgba(0,0,0,0.4);
    --input-bg: #1e293b;
    --tag-bg: #334155;
    --overlay: rgba(0,0,0,0.7);
  }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; transition: background 0.3s, color 0.3s; min-height: 100vh; }
input, select, button, textarea { font-family: inherit; }

/* ─── 令牌栏 ─── */
.token-bar {
  background: var(--bar-bg); border-bottom: 1px solid var(--border);
  padding: 14px 24px; position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; gap: 16px;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  transition: background 0.3s, border-color 0.3s;
}
.token-bar .logo { font-size: 20px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.token-bar .logo span { font-size: 22px; }
.token-bar .token-group { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.token-bar .token-group input {
  flex: 1; padding: 9px 14px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.2s, background 0.3s; background: var(--input-bg); color: var(--text); min-width: 0;
}
.token-bar .token-group input:focus { border-color: var(--primary); }
.token-bar .btn-verify {
  padding: 9px 28px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; background: var(--primary); color: #fff; transition: background 0.2s, opacity 0.2s; white-space: nowrap; flex-shrink: 0; min-width: 88px;
}
.token-bar .btn-verify:hover:not(:disabled) { background: var(--primary-hover); }
.token-bar .btn-verify:disabled { opacity: 0.6; cursor: not-allowed; }
.token-bar .btn-verify.ok { background: var(--success); }
.token-bar .btn-verify.err { background: var(--danger); }
.token-bar .btn-verify.loading { opacity: 0.75; }

/* ─── Toast ─── */
.toast-container { position: fixed; top: 80px; right: 20px; z-index: 999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast {
  padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500;
  box-shadow: var(--shadow-lg); pointer-events: auto; max-width: 380px;
  animation: toastIn 0.3s ease; display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(8px);
}
.toast.success { background: var(--success); color: #fff; }
.toast.error { background: var(--danger); color: #fff; }
.toast.info { background: var(--primary); color: #fff; }
.toast-out { animation: toastOut 0.3s ease forwards; }
@keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes toastOut { from { opacity: 1; } to { opacity: 0; transform: translateX(40px); } }

/* ─── 容器 ─── */
.container { max-width: 920px; margin: 0 auto; padding: 32px 20px 80px; display: none; }
.container.active { display: block; }

/* ─── 工具网格 ─── */
.tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.tool-card {
  background: var(--card); border-radius: 12px; padding: 24px; cursor: pointer;
  box-shadow: var(--shadow); transition: box-shadow 0.2s, transform 0.2s, background 0.3s;
  border: 1px solid transparent;
}
.tool-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); border-color: var(--primary); }
.tool-card .tool-icon { font-size: 32px; margin-bottom: 12px; }
.tool-card .tool-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.tool-card .tool-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

/* ─── 工具视图 ─── */
.tool-view { display: none; }
.tool-view.active { display: block; }

/* ─── 常驻浮动返回按钮 ─── */
/* 仅在工具子页可见，固定右下角，z-index 高于 toast(999) 和 modal(200) */
.float-back {
  position: fixed; right: 24px; bottom: 24px; z-index: 1500;
  width: 48px; height: 48px; border-radius: 50%; border: none;
  background: var(--primary); color: #fff; cursor: pointer;
  display: none; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.float-back:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5); }
.float-back:active { transform: translateY(0); }
.float-back.show { display: inline-flex; }
/* 任何弹窗打开时隐藏浮动按钮（弹窗自身有关闭/取消，避免重叠） */
body:has(.disk-modal-overlay.show) .float-back { display: none !important; }
.tool-view h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.tool-view .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }

/* ─── 表单 ─── */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.2s, background 0.3s; background: var(--input-bg); color: var(--text);
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--primary); background: var(--card); }
.form-row { display: flex; gap: 8px; align-items: flex-end; }
.form-row .form-group { flex: 1; margin-bottom: 0; }
.btn {
  padding: 9px 18px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; justify-content: center; white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.btn-outline { background: var(--card); color: var(--text); border: 1px solid var(--border); }
.btn-outline:hover:not(:disabled) { background: var(--bg); border-color: var(--text-muted); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-sm { padding: 6px 14px; font-size: 13px; }

/* ─── 工作流列表 ─── */
.section-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin: 24px 0 12px; }
.wf-list { display: flex; flex-direction: column; gap: 8px; }
.wf-item {
  background: var(--card); border-radius: 10px; padding: 14px 16px; cursor: pointer;
  border: 2px solid var(--border); transition: border-color 0.2s, background 0.3s;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.wf-item:hover { border-color: var(--primary); }
.wf-item.selected { border-color: var(--primary); background: var(--primary-light); }
.wf-item .wf-info { flex: 1; min-width: 0; }
.wf-item .wf-name { font-size: 14px; font-weight: 600; }
.wf-item .wf-path { font-size: 12px; color: var(--text-muted); margin-top: 2px; font-family: 'SF Mono', Monaco, Consolas, monospace; }
.wf-item .wf-state { font-size: 11px; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
.wf-item .wf-state.active { background: rgba(34,197,94,0.15); color: var(--success); }

/* ─── 结果 ─── */
.result-box { padding: 14px 16px; border-radius: 10px; font-size: 14px; margin-top: 16px; display: none; }
.result-box.show { display: block; animation: fadeIn 0.3s ease; }
.result-box.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--success); }
.result-box.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: var(--danger); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

/* ─── 空状态 ─── */
.empty { text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px; }

/* ─── 保存的配置 ─── */
.saved-configs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.saved-config {
  background: var(--tag-bg); color: var(--text-secondary); font-size: 12px; padding: 5px 12px;
  border-radius: 16px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.saved-config:hover { border-color: var(--primary); color: var(--primary); }
.saved-config .del { margin-left: 6px; opacity: 0.5; }
.saved-config .del:hover { opacity: 1; color: var(--danger); }

/* ─── input 描述 ─── */
.input-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.input-required { color: var(--danger); }

/* ─── 云盘 ─── */
.disk-stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.disk-stat-card { background: var(--card); border-radius: 10px; padding: 14px 18px; box-shadow: var(--shadow); flex: 1; min-width: 140px; }
.disk-stat-card .stat-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.disk-stat-card .stat-value { font-size: 20px; font-weight: 700; }
.disk-stat-card .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.disk-usage-bar { height: 6px; background: var(--input-bg); border-radius: 3px; overflow: hidden; margin-top: 8px; }
.disk-usage-fill { height: 100%; background: var(--primary); transition: width 0.3s; }
.disk-usage-fill.warn { background: var(--danger); }

.disk-upload { background: var(--card); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.disk-upload.dragover { border: 2px dashed var(--primary); }
.disk-drop-zone { border: 1.5px dashed var(--border); border-radius: 8px; padding: 14px 16px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.disk-drop-zone:hover { border-color: var(--primary); background: var(--primary-light); }
.disk-drop-zone .drop-icon { font-size: 18px; opacity: 0.6; }
.disk-drop-zone .drop-text { font-size: 13px; color: var(--text-secondary); }
.disk-drop-zone .drop-hint { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
.disk-pending { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.disk-pending-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 10px; background: var(--input-bg); border-radius: 6px; }
.disk-pending-item .pn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.disk-pending-item .ps { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.disk-pending-item .px { cursor: pointer; color: var(--text-muted); flex-shrink: 0; padding: 0 4px; }
.disk-pending-item .px:hover { color: var(--danger); }
.disk-upload-actions { margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end; }
.disk-upload-progress { margin-top: 10px; }
.disk-upload-progress .progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
.disk-upload-progress .progress-bar { flex: 1; height: 4px; background: var(--input-bg); border-radius: 2px; overflow: hidden; }
.disk-upload-progress .progress-fill { height: 100%; background: var(--primary); transition: width 0.3s; }

.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-item { background: var(--card); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 12px; transition: box-shadow 0.2s; }
.file-item:hover { box-shadow: var(--shadow-lg); }
.file-icon { font-size: 22px; flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.file-actions { display: flex; gap: 6px; flex-shrink: 0; }

@media (max-width: 640px) {
  .token-bar { padding: 12px 16px; gap: 8px; }
  .token-bar .logo { font-size: 17px; }
  .token-bar .token-group input { font-size: 13px; padding: 8px 10px; }
  .token-bar .btn-verify { padding: 8px 14px; font-size: 13px; min-width: 70px; }
  .container { padding: 24px 16px 60px; }
  .tool-grid { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; align-items: stretch; }
}
@media (max-width: 400px) {
  .token-bar { flex-wrap: wrap; }
  .token-bar .token-group { width: 100%; }
}

/* ─── 弹层 modal ─── */
.disk-modal-overlay {
  display: none; position: fixed; inset: 0; background: var(--overlay); z-index: 200;
  align-items: center; justify-content: center; padding: 20px;
}
.disk-modal-overlay.show { display: flex; }
.disk-modal {
  background: var(--card); border-radius: 12px; width: 100%; max-width: 480px;
  max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: var(--shadow-lg); animation: modalIn 0.2s ease;
}
@keyframes modalIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.disk-modal-header {
  padding: 14px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.disk-modal-header h3 { font-size: 16px; font-weight: 600; }
.disk-modal-close {
  background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted);
  padding: 4px 8px; border-radius: 6px; transition: background 0.2s;
}
.disk-modal-close:hover { background: var(--bg); }
.disk-modal-body { padding: 18px; overflow-y: auto; flex: 1; }
.disk-modal-footer {
  padding: 12px 18px; border-top: 1px solid var(--border);
  display: flex; gap: 8px; justify-content: flex-end;
}

/* ─── 涨跌色（基金估值） ─── */
.change-up { color: #ef4444; }
.change-down { color: #22c55e; }
.change-flat { color: var(--text-muted); }
.num { font-variant-numeric: tabular-nums; }

/* ─── 表单内联行 ─── */
.form-inline { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
.form-inline input, .form-inline select { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; background: var(--input-bg); color: var(--text); outline: none; }
.form-inline input:focus, .form-inline select:focus { border-color: var(--primary); }
</style>
</head>
<body>

<div class="token-bar">
  <div class="logo"><span>🧭</span> kbox</div>
  <div class="token-group">
    <input type="password" id="tokenInput" placeholder="输入访问令牌">
    <button class="btn-verify" id="verifyBtn">验证</button>
  </div>
</div>

<div class="toast-container" id="toastContainer"></div>

<!-- 常驻浮动返回按钮：仅在工具子页可见，固定右上角，最上层 -->
<button class="float-back" id="floatBack" onclick="backToGrid()" title="返回首页" aria-label="返回首页">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
  </svg>
</button>

<!-- 主页：工具网格 -->
<div class="container" id="mainContent">
  <div class="tool-grid" id="toolGrid"></div>
  <div id="toolViews"></div>
</div>

<script>
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('kbox_token') || '';

const tokenInput = $('tokenInput'), verifyBtn = $('verifyBtn');
const mainContent = $('mainContent'), toolGrid = $('toolGrid'), toolViews = $('toolViews');
const toastContainer = $('toastContainer');

// ─── Toast ───
function toast(msg, type) {
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, 3000);
}

function setBtnStatus(text, cls, disabled) {
  verifyBtn.textContent = text;
  verifyBtn.className = 'btn-verify' + (cls ? ' ' + cls : '');
  verifyBtn.disabled = !!disabled;
}

// ─── 令牌验证 ───
async function verifyToken() {
  token = tokenInput.value.trim();
  if (!token) { setBtnStatus('请输入', 'err'); tokenInput.focus(); return; }
  setBtnStatus('验证中…', 'loading', true);
  try {
    const res = await fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) {
      localStorage.setItem('kbox_token', token);
      setBtnStatus('✓ 已授权', 'ok');
      mainContent.classList.add('active');
      initTools();
    } else if (res.status === 401) {
      setBtnStatus('✗ 无效', 'err');
      localStorage.removeItem('kbox_token');
      toast('令牌无效', 'error');
    } else {
      setBtnStatus('✗ 失败', 'err');
      toast('验证失败', 'error');
    }
  } catch {
    setBtnStatus('✗ 网络错误', 'err');
    toast('网络请求失败', 'error');
  }
}

async function api(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options?.headers, 'Authorization': 'Bearer ' + token },
  });
  if (res.status === 401) {
    setBtnStatus('✗ 已失效', 'err');
    mainContent.classList.remove('active');
    localStorage.removeItem('kbox_token');
    toast('令牌已失效，请重新验证', 'error');
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    let msg = '请求失败';
    try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ─── 工具函数 ───
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 解析仓库输入：支持 GitHub URL / SSH / owner/repo
function parseRepo(input) {
  input = (input || '').trim();
  if (!input) return null;
  // https://github.com/user/repo 或 https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // github.com/user/repo
  var m = input.match(/github\\.com[:/]([^/\\s]+)\\/([^/\\s.#]+)(?:\\.git)?/i);
  if (m) return m[1] + '/' + m[2];
  // 纯 owner/repo
  if (/^[\\w.-]+\\/[\\w.-]+$/.test(input)) return input;
  return null;
}

// ─── 工具注册表（模块化：新增工具只需在此注册 + 实现 render/mount） ───
const TOOLS = [
  { id: 'dispatch', name: 'GitHub Actions 触发', icon: '⚡', desc: '通过 API 触发 GitHub workflow dispatch', render: renderDispatchTool, mount: mountDispatchTool },
  { id: 'disk', name: '微型云盘', icon: '☁️', desc: '基于 D1 的轻量文件存储，支持分片上传', render: renderDiskTool, mount: mountDiskTool },
  { id: 'stock', name: '基金估值', icon: '💰', desc: '多市场基金持仓估值刷新，A股/港股/美股/韩台日', render: renderStockTool, mount: mountStockTool },
  { id: 'news', name: 'AI 新闻锐评', icon: '📰', desc: '抓取科技新闻并由 AI 写贴吧风格锐评', render: renderNewsTool, mount: mountNewsTool },
  { id: 'config', name: '配置管理', icon: '⚙️', desc: '集中管理 API 密钥与工具配置，敏感字段加密存储', render: renderConfigTool, mount: mountConfigTool },
];

function initTools() {
  let grid = '';
  for (const t of TOOLS) {
    grid += '<div class="tool-card" onclick="showTool(\\'' + t.id + '\\')"><div class="tool-icon">' + t.icon + '</div><div class="tool-name">' + t.name + '</div><div class="tool-desc">' + t.desc + '</div></div>';
  }
  toolGrid.innerHTML = grid;
  let views = '';
  for (const t of TOOLS) {
    views += '<div class="tool-view" id="view-' + t.id + '">' + t.render() + '</div>';
  }
  toolViews.innerHTML = views;
  for (const t of TOOLS) { t.mount(); }
}

window.showTool = function(id) {
  toolGrid.style.display = 'none';
  for (const t of TOOLS) {
    const v = $('view-' + t.id);
    if (t.id === id) { v.classList.add('active'); }
    else { v.classList.remove('active'); }
  }
  // 显示常驻浮动返回按钮
  $('floatBack').classList.add('show');
}

window.backToGrid = function() {
  for (const t of TOOLS) { $('view-' + t.id).classList.remove('active'); }
  toolGrid.style.display = 'grid';
  // 隐藏常驻浮动返回按钮，回到顶部
  $('floatBack').classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══ 工具 1：GitHub Workflow Dispatch ═══
function renderDispatchTool() {
  return \`
    <h2>⚡ GitHub Actions 触发</h2>
    <p class="subtitle">通过 GitHub API 触发指定仓库的 workflow_dispatch</p>
    <div class="saved-configs" id="dispatchSavedConfigs"></div>
    <div class="form-row">
      <div class="form-group">
        <label>仓库（支持 GitHub 链接 / SSH / owner/repo）</label>
        <input type="text" id="dispatchRepo" placeholder="例如 user/repo 或粘贴 GitHub 链接">
      </div>
      <button class="btn btn-outline" id="dispatchLoadBtn" style="margin-bottom:0">加载</button>
    </div>
    <div class="form-group" id="dispatchBranchGroup" style="display:none">
      <label>分支</label>
      <select id="dispatchBranch"></select>
    </div>
    <div class="section-title" id="dispatchWfTitle" style="display:none">选择工作流</div>
    <div class="wf-list" id="dispatchWfList"></div>
    <div id="dispatchInputsSection" style="display:none">
      <div class="section-title" id="dispatchInputsTitle">Workflow Inputs</div>
      <div id="dispatchInputs"></div>
    </div>
    <div style="margin-top:24px">
      <button class="btn btn-primary" id="dispatchTriggerBtn" disabled>触发</button>
      <button class="btn btn-outline" id="dispatchSaveBtn">保存配置</button>
    </div>
    <div class="result-box" id="dispatchResult"></div>
    <div id="dispatchRunSection" style="display:none;margin-top:16px">
      <div class="section-title">执行状态</div>
      <div id="dispatchRunCard"></div>
    </div>
  \`;
}

let selectedWf = null;
let selectedWfPath = null;
let wfInputs = [];

function mountDispatchTool() {
  const repoInput = $('dispatchRepo');
  const loadBtn = $('dispatchLoadBtn');
  const wfList = $('dispatchWfList');
  const wfTitle = $('dispatchWfTitle');
  const branchGroup = $('dispatchBranchGroup');
  const branchSelect = $('dispatchBranch');
  const inputsSection = $('dispatchInputsSection');
  const inputsTitle = $('dispatchInputsTitle');
  const inputsBox = $('dispatchInputs');
  const triggerBtn = $('dispatchTriggerBtn');
  const saveBtn = $('dispatchSaveBtn');
  const resultBox = $('dispatchResult');
  const savedConfigsBox = $('dispatchSavedConfigs');
  const runSection = $('dispatchRunSection');
  const runCard = $('dispatchRunCard');

  // 执行状态轮询
  let runPollTimer = null;
  let trackingLive = false;    // true=正在跟踪一次新触发的实时执行；false=仅查看上次
  let lastRunId = null;        // 实时跟踪目标的 run id（首次拉取前为 null，取最新一条）
  let pollOwner = '';
  let pollRepo = '';
  let pollWf = '';

  // 状态文案与颜色映射
  function runStatusText(status, conclusion) {
    if (status === 'queued') return '⏳ 排队中';
    if (status === 'in_progress') return '🔄 运行中';
    if (status === 'completed') {
      if (conclusion === 'success') return '✅ 成功';
      if (conclusion === 'failure') return '❌ 失败';
      if (conclusion === 'cancelled') return '⚠️ 已取消';
      if (conclusion === 'skipped') return '⏭️ 已跳过';
      return '📦 ' + (conclusion || '完成');
    }
    return '未知';
  }
  function runStatusColor(status, conclusion) {
    if (status === 'queued') return 'var(--text-muted)';
    if (status === 'in_progress') return 'var(--primary)';
    if (status === 'completed') {
      if (conclusion === 'success') return 'var(--success)';
      return 'var(--danger)';
    }
    return 'var(--text-secondary)';
  }

  // 渲染单条 run 卡片。isLive=true 显示"实时"标签，否则显示"上次"
  function renderRunCard(run, isLive) {
    if (!run) { runCard.innerHTML = '<div class="empty">暂无执行记录</div>'; return; }
    const tag = isLive ? '<span style="font-size:11px;color:var(--primary);margin-left:6px">实时</span>' : '<span style="font-size:11px;color:var(--text-muted);margin-left:6px">上次</span>';
    const color = runStatusColor(run.status, run.conclusion);
    const created = run.created_at ? formatDate(run.created_at.replace('T', ' ').replace('Z', '')) : '';
    const branch = run.head_branch ? ' · ' + esc(run.head_branch) : '';
    const url = run.html_url ? '<a href="' + esc(run.html_url) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--primary);text-decoration:none;margin-left:6px">查看 ↗</a>' : '';
    runCard.innerHTML =
      '<div class="file-item" style="display:block;padding:14px 16px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="font-weight:600;font-size:14px">' + esc(run.name || pollWf) + tag + '</div>' +
          '<div style="font-size:13px;font-weight:600;color:' + color + '">' + runStatusText(run.status, run.conclusion) + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:6px">#' + run.id + branch + ' · ' + created + url + '</div>' +
      '</div>';
  }

  // 拉取一次 run 列表并渲染。
  // trackingLive=true 时：优先匹配 lastRunId，状态完结后停止轮询
  // trackingLive=false 时：取最新一条作为"上次执行"，不轮询
  async function fetchRuns() {
    if (!pollOwner || !pollRepo || !pollWf) return;
    try {
      const data = await api('/api/tools/workflow-runs?owner=' + encodeURIComponent(pollOwner) + '&repo=' + encodeURIComponent(pollRepo) + '&workflow_id=' + encodeURIComponent(pollWf) + '&per_page=5');
      const runs = data.runs || [];
      runSection.style.display = '';
      if (!runs.length) { renderRunCard(null, false); stopPoll(); return; }

      // 实时跟踪：优先找 lastRunId，否则用最新一条作为目标并记录
      let target = null;
      if (trackingLive && lastRunId) target = runs.find(r => String(r.id) === String(lastRunId));
      if (!target) target = runs[0];
      if (trackingLive) lastRunId = target.id;

      renderRunCard(target, trackingLive);

      // 实时跟踪且仍在进行 → 继续轮询；完结 → 停止
      if (trackingLive && (target.status === 'queued' || target.status === 'in_progress')) {
        startPoll();
      } else {
        stopPoll();
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      runSection.style.display = '';
      runCard.innerHTML = '<div class="empty">获取状态失败：' + esc(e.message) + '</div>';
    }
  }

  function startPoll() {
    stopPoll();
    runPollTimer = setInterval(fetchRuns, 3000);
  }
  function stopPoll() {
    if (runPollTimer) { clearInterval(runPollTimer); runPollTimer = null; }
  }

  renderSavedConfigs();

  // 从数据库加载已保存配置
  let savedConfigs = []; // [{id, repo, workflow_id, branch, inputs}]

  async function renderSavedConfigs() {
    try {
      const data = await api('/api/tools/dispatch-configs');
      savedConfigs = data.configs || [];
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      savedConfigsBox.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">配置加载失败</span>';
      return;
    }
    if (!savedConfigs.length) { savedConfigsBox.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < savedConfigs.length; i++) {
      const c = savedConfigs[i];
      html += '<span class="saved-config" onclick="loadDispatchConfig(' + i + ')">' + esc(c.repo) + ' / ' + esc(c.workflow_id) + '<span class="del" onclick="delDispatchConfig(event,' + i + ')">✕</span></span>';
    }
    savedConfigsBox.innerHTML = html;
  }

  window.loadDispatchConfig = function(i) {
    const c = savedConfigs[i];
    if (!c) return;
    repoInput.value = c.repo || '';
    loadBtn.click();
    // 等加载完成后自动选中
    setTimeout(() => {
      selectedWf = c.workflow_id;
      const items = wfList.querySelectorAll('.wf-item');
      items.forEach(item => {
        if (item.dataset.wf === c.workflow_id) { item.classList.add('selected'); }
        else { item.classList.remove('selected'); }
      });
      triggerBtn.disabled = !selectedWf;
      // 选中后触发 inputs 获取
      if (selectedWf) {
        const selectedItem = wfList.querySelector('.wf-item.selected');
        if (selectedItem) selectedItem.click();
      }
      // 等分支加载完
      if (c.branch) {
        setTimeout(() => { branchSelect.value = c.branch; }, 800);
      }
    }, 1500);
  };

  window.delDispatchConfig = async function(e, i) {
    e.stopPropagation();
    const c = savedConfigs[i];
    if (!c || !c.id) return;
    try {
      await api('/api/tools/dispatch-configs/' + encodeURIComponent(c.id), { method: 'DELETE' });
      toast('已删除', 'success');
      renderSavedConfigs();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  loadBtn.onclick = async () => {
    const raw = repoInput.value.trim();
    const repo = parseRepo(raw);
    if (!repo) { toast('无法识别仓库，请输入 owner/repo 或 GitHub 链接', 'error'); repoInput.focus(); return; }
    // 如果输入的是 URL/SSH，替换为标准 owner/repo
    if (raw !== repo) repoInput.value = repo;

    const [owner, repoName] = repo.split('/');
    loadBtn.disabled = true; loadBtn.textContent = '加载中…';
    wfList.innerHTML = '<div class="empty">加载中…</div>';
    wfTitle.style.display = '';
    inputsSection.style.display = 'none';
    branchGroup.style.display = 'none';
    selectedWf = null;
    triggerBtn.disabled = true;
    // 重置执行状态面板
    stopPoll();
    trackingLive = false;
    lastRunId = null;
    pollOwner = '';
    pollRepo = '';
    pollWf = '';
    runSection.style.display = 'none';

    try {
      // 并行加载工作流和分支
      const [wfData, branchData] = await Promise.all([
        api('/api/tools/workflows?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/tools/branches?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
      ]);

      // 渲染分支
      const branches = branchData.branches || [];
      if (branches.length) {
        branchGroup.style.display = '';
        branchSelect.innerHTML = branches.map(b =>
          '<option value="' + esc(b.name) + '"' + (b.name === 'main' ? ' selected' : '') + '>' + esc(b.name) + '</option>'
        ).join('');
      }

      // 渲染工作流
      if (!wfData.workflows || !wfData.workflows.length) {
        wfList.innerHTML = '<div class="empty">该仓库没有 workflows</div>';
        return;
      }
      let html = '';
      for (const w of wfData.workflows) {
        html += '<div class="wf-item" data-wf="' + esc(w.filename) + '" data-path="' + esc(w.path) + '"><div class="wf-info"><div class="wf-name">' + esc(w.name) + '</div><div class="wf-path">' + esc(w.path) + '</div></div><span class="wf-state ' + (w.state === 'active' ? 'active' : '') + '">' + esc(w.state) + '</span></div>';
      }
      wfList.innerHTML = html;
      wfList.querySelectorAll('.wf-item').forEach(item => {
        item.onclick = () => {
          wfList.querySelectorAll('.wf-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedWf = item.dataset.wf;
          selectedWfPath = item.dataset.path;
          triggerBtn.disabled = false;

          // 获取 workflow inputs 定义（无参数时由 renderInputs 隐藏区块）
          inputsBox.innerHTML = '<div class="empty">加载参数定义中…</div>';
          inputsTitle.textContent = 'Workflow Inputs';

          const [owner2, repoName2] = repoInput.value.split('/');
          api('/api/tools/workflow-inputs?owner=' + encodeURIComponent(owner2) + '&repo=' + encodeURIComponent(repoName2) + '&path=' + encodeURIComponent(selectedWfPath))
            .then(inputData => {
              wfInputs = inputData.inputs || [];
              renderInputs();
            })
            .catch(e => {
              if (e.message === 'UNAUTHORIZED') return;
              inputsBox.innerHTML = '<div class="empty">获取参数失败：' + esc(e.message) + '</div>';
            });

          // 加载"上次执行"状态（非实时跟踪）
          stopPoll();
          trackingLive = false;
          lastRunId = null;
          pollOwner = owner2;
          pollRepo = repoName2;
          pollWf = selectedWf;
          fetchRuns();
        };
      });
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      wfList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
      toast('加载失败', 'error');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '加载';
    }
  };

  function renderInputs() {
    if (!wfInputs.length) {
      // 无参数时隐藏整个 Inputs 区块
      inputsSection.style.display = 'none';
      return;
    }
    inputsSection.style.display = '';
    let html = '';
    for (const inp of wfInputs) {
      const reqMark = inp.required ? ' <span class="input-required">*</span>' : '';
      const desc = inp.description ? '<div class="input-desc">' + esc(inp.description) + '</div>' : '';
      const label = esc(inp.name) + reqMark;
      if (inp.type === 'boolean') {
        html += '<div class="form-group"><label>' + label + '</label><select data-input="' + esc(inp.name) + '"><option value="false"' + (inp.default !== 'true' ? ' selected' : '') + '>false</option><option value="true"' + (inp.default === 'true' ? ' selected' : '') + '>true</option></select>' + desc + '</div>';
      } else if (inp.type === 'choice' && inp.options && inp.options.length) {
        html += '<div class="form-group"><label>' + label + '</label><select data-input="' + esc(inp.name) + '">' + inp.options.map(o => '<option value="' + esc(o) + '"' + (o === inp.default ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' + desc + '</div>';
      } else {
        html += '<div class="form-group"><label>' + label + '</label><input type="text" data-input="' + esc(inp.name) + '" value="' + esc(inp.default) + '" placeholder="' + (inp.required ? '必填' : '可选') + '">' + desc + '</div>';
      }
    }
    inputsBox.innerHTML = html;
  }

  triggerBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo || !selectedWf) return;
    const [owner, repoName] = repo.split('/');

    // 收集 inputs
    const inputs = {};
    if (wfInputs.length) {
      inputsBox.querySelectorAll('[data-input]').forEach(el => {
        const k = el.dataset.input;
        if (k) inputs[k] = el.value;
      });
    }

    triggerBtn.disabled = true; triggerBtn.textContent = '触发中…';
    resultBox.className = 'result-box';
    try {
      const ref = branchSelect.value || 'main';
      const data = await api('/api/tools/dispatch', {
        method: 'POST',
        body: JSON.stringify({ owner, repo: repoName, workflow_id: selectedWf, ref, inputs }),
        headers: { 'Content-Type': 'application/json' },
      });
      resultBox.className = 'result-box show success';
      resultBox.textContent = '✓ ' + data.message + '（' + selectedWf + ' @ ' + ref + '）';
      toast('已触发，开始跟踪执行状态', 'success');

      // 启动实时跟踪：等 2 秒让 GitHub 创建 run，然后取最新一条作为跟踪目标
      stopPoll();
      trackingLive = true;
      lastRunId = null;
      pollOwner = owner;
      pollRepo = repoName;
      pollWf = selectedWf;
      runSection.style.display = '';
      runCard.innerHTML = '<div class="empty">⏳ 等待 GitHub 创建运行记录…</div>';
      setTimeout(() => { fetchRuns(); }, 2000);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('触发失败', 'error');
    } finally {
      triggerBtn.disabled = false; triggerBtn.textContent = '触发';
    }
  };

  saveBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo || !selectedWf) { toast('请先选择仓库和工作流', 'error'); return; }
    const inputs = [];
    if (wfInputs.length) {
      inputsBox.querySelectorAll('[data-input]').forEach(el => {
        const k = el.dataset.input;
        const v = el.value;
        if (k) inputs.push([k, v]);
      });
    }
    try {
      await api('/api/tools/dispatch-configs', {
        method: 'POST',
        body: JSON.stringify({ repo, workflow_id: selectedWf, branch: branchSelect.value || 'main', inputs }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('配置已保存', 'success');
      renderSavedConfigs();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    }
  };
}

// ═══ 工具 2：微型云盘 ═══
const DISK_CHUNK_SIZE = 1.4 * 1024 * 1024; // 1.4MB，与后端一致
const DISK_MAX_SIZE = 10 * 1024 * 1024; // 10MB

function renderDiskTool() {
  return \`
    <h2>☁️ 微型云盘</h2>
    <p class="subtitle">基于 D1 的轻量文件存储 · 单文件上限 10MB</p>
    <div class="disk-stats" id="diskStats"></div>
    <div class="disk-upload">
      <div class="disk-drop-zone" id="diskDropZone">
        <span class="drop-icon">📁</span>
        <span class="drop-text">点击选择或拖拽文件到此处</span>
        <span class="drop-hint">· 单文件最大 10MB</span>
      </div>
      <input type="file" id="diskFileInput" style="display:none" multiple>
      <div class="disk-pending" id="diskPending"></div>
      <div class="disk-upload-actions" id="diskUploadActions" style="display:none">
        <button class="btn btn-outline btn-sm" id="diskClearBtn">清空</button>
        <button class="btn btn-primary btn-sm" id="diskUploadBtn">确认上传</button>
      </div>
      <div class="disk-upload-progress" id="diskProgress"></div>
    </div>
    <div class="section-title">文件列表</div>
    <div class="file-list" id="diskFileList"></div>
    <details class="disk-api-docs" style="margin-top:24px">
      <summary style="cursor:pointer;font-size:14px;font-weight:600;color:var(--text-secondary);padding:12px;background:var(--card);border-radius:8px;box-shadow:var(--shadow)">📋 API 接口文档</summary>
      <div style="padding:16px;background:var(--card);border-radius:8px;margin-top:8px;box-shadow:var(--shadow);font-size:13px;line-height:1.8;color:var(--text-secondary);overflow-x:auto">
        <p style="color:var(--text);font-weight:600">所有接口需鉴权（除下载端点）：</p>
        <p>Header: <code>Authorization: Bearer &lt;token&gt;</code></p>
        <p style="color:var(--text-muted)">下载端点不接收主 token，必须先换取一次性 dt 令牌</p>
        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
        <p><b>GET</b> <code>/api/tools/disk/stats</code> — 容量统计</p>
        <p><b>GET</b> <code>/api/tools/disk/files</code> — 文件列表</p>
        <p><b>POST</b> <code>/api/tools/disk/files</code> — 创建文件记录<br>
        <span style="color:var(--text-muted)">body: { name, size, mime_type }</span></p>
        <p><b>POST</b> <code>/api/tools/disk/files/:id/chunks</code> — 上传分片<br>
        <span style="color:var(--text-muted)">body: { chunk_index, content(base64), chunk_size }</span></p>
        <p><b>POST</b> <code>/api/tools/disk/files/:id/download-token</code> — 生成一次性下载令牌<br>
        <span style="color:var(--text-muted)">返回 { dt, expires_in: 300, url }，5 分钟内一次性有效</span></p>
        <p><b>GET</b> <code>/api/tools/disk/files/:id/download?dt=xxx</code> — 用 dt 下载文件</p>
        <p><b>DELETE</b> <code>/api/tools/disk/files/:id</code> — 删除文件</p>
      </div>
    </details>
  \`;
}

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) return '🗜️';
  if (mime.includes('json') || mime.includes('text') || mime.includes('javascript') || mime.includes('xml')) return '📝';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️';
  if (mime.includes('word') || mime.includes('document')) return '📃';
  return '📄';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').substring(0, 16);
}

function mountDiskTool() {
  const statsBox = $('diskStats');
  const fileList = $('diskFileList');
  const dropZone = $('diskDropZone');
  const fileInput = $('diskFileInput');
  const progressBox = $('diskProgress');
  const pendingBox = $('diskPending');
  const uploadActions = $('diskUploadActions');
  const uploadBtn = $('diskUploadBtn');
  const clearBtn = $('diskClearBtn');

  let pendingFiles = []; // 待上传文件队列

  async function loadStats() {
    try {
      const s = await api('/api/tools/disk/stats');
      const usagePct = s.max_db_size > 0 ? Math.min(100, (s.db_size / s.max_db_size) * 100) : 0;
      const filePct = s.max_file_size > 0 ? Math.min(100, (s.total_size / (s.max_db_size * 0.8)) * 100) : 0;
      statsBox.innerHTML =
        '<div class="disk-stat-card"><div class="stat-label">文件数</div><div class="stat-value">' + s.file_count + '</div></div>' +
        '<div class="disk-stat-card"><div class="stat-label">文件大小</div><div class="stat-value">' + formatSize(s.total_size) + '</div></div>' +
        '<div class="disk-stat-card"><div class="stat-label">D1 存储占用</div><div class="stat-value">' + formatSize(s.db_size) + '</div><div class="stat-sub">上限 ' + formatSize(s.max_db_size) + '</div><div class="disk-usage-bar"><div class="disk-usage-fill ' + (usagePct > 80 ? 'warn' : '') + '" style="width:' + usagePct + '%"></div></div></div>';
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      statsBox.innerHTML = '<div class="empty">统计加载失败</div>';
    }
  }

  async function loadFiles() {
    fileList.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/disk/files');
      const files = data.files || [];
      if (!files.length) {
        fileList.innerHTML = '<div class="empty">暂无文件</div>';
        return;
      }
      fileList.innerHTML = files.map(f =>
        '<div class="file-item"><div class="file-icon">' + fileIcon(f.mime_type) + '</div>' +
        '<div class="file-info"><div class="file-name">' + esc(f.name) + '</div>' +
        '<div class="file-meta">' + formatSize(f.size) + ' · ' + formatDate(f.created_at) + ' · ' + f.chunks + ' 片</div></div>' +
        '<div class="file-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="downloadFile(' + f.id + ',\\'' + esc(f.name) + '\\')">下载</button>' +
        '<button class="btn btn-outline btn-sm" onclick="deleteFile(' + f.id + ',\\'' + esc(f.name) + '\\')" style="color:var(--danger)">删除</button>' +
        '</div></div>'
      ).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      fileList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  // 一次性下载令牌：先 POST 换 dt，再用 dt 跳转下载（链接不含主 token）
  window.downloadFile = async function(id, name) {
    try {
      const data = await api('/api/tools/disk/files/' + id + '/download-token', { method: 'POST' });
      if (!data.dt) throw new Error('未获取到下载令牌');
      // 用 dt 跳转，浏览器自动触发下载
      const a = document.createElement('a');
      a.href = '/api/tools/disk/files/' + id + '/download?dt=' + encodeURIComponent(data.dt);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('下载失败：' + e.message, 'error');
    }
  };

  window.deleteFile = async function(id, name) {
    if (!confirm('确认删除「' + name + '」？')) return;
    try {
      await api('/api/tools/disk/files/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      loadStats();
      loadFiles();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  // 待上传队列：选文件 → 渲染 pending → 点确认批量上传
  function addFiles(files) {
    const arr = Array.from(files);
    let added = 0;
    for (const file of arr) {
      if (file.size > DISK_MAX_SIZE) {
        toast('「' + file.name + '」超过 10MB 限制', 'error');
        continue;
      }
      // 去重：同名同大小
      const dup = pendingFiles.find(p => p.name === file.name && p.size === file.size);
      if (dup) { toast('「' + file.name + '」已在队列中', 'info'); continue; }
      pendingFiles.push(file);
      added++;
    }
    if (added) renderPending();
  }

  function renderPending() {
    if (!pendingFiles.length) {
      pendingBox.innerHTML = '';
      uploadActions.style.display = 'none';
      return;
    }
    pendingBox.innerHTML = pendingFiles.map((f, i) =>
      '<div class="disk-pending-item">' +
        '<span class="pn">' + esc(f.name) + '</span>' +
        '<span class="ps">' + formatSize(f.size) + '</span>' +
        '<span class="px" onclick="removePendingFile(' + i + ')">✕</span>' +
      '</div>'
    ).join('');
    uploadActions.style.display = '';
  }

  window.removePendingFile = function(i) {
    pendingFiles.splice(i, 1);
    renderPending();
  };

  clearBtn.onclick = () => {
    pendingFiles = [];
    renderPending();
  };

  uploadBtn.onclick = async () => {
    if (!pendingFiles.length) return;
    const batch = pendingFiles.slice();
    pendingFiles = [];
    renderPending();
    uploadBtn.disabled = true; uploadBtn.textContent = '上传中…';
    for (const f of batch) {
      await uploadFile(f);
    }
    uploadBtn.disabled = false; uploadBtn.textContent = '确认上传';
  };

  async function uploadFile(file) {
    const chunkCount = Math.ceil(file.size / DISK_CHUNK_SIZE);
    const fileIdKey = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // 创建进度条
    const row = document.createElement('div');
    row.className = 'progress-row';
    row.innerHTML = '<span style="flex-shrink:0;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(file.name) + '</span><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><span style="flex-shrink:0;font-size:12px;color:var(--text-muted)">0/' + chunkCount + '</span>';
    progressBox.appendChild(row);
    const fill = row.querySelector('.progress-fill');
    const status = row.querySelectorAll('span')[1];

    try {
      // 1. 创建文件记录
      const createRes = await api('/api/tools/disk/files', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, size: file.size, mime_type: file.type || '' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const fileId = createRes.id;

      // 2. 分片上传
      for (let i = 0; i < chunkCount; i++) {
        const start = i * DISK_CHUNK_SIZE;
        const end = Math.min(start + DISK_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const buf = await chunk.arrayBuffer();
        // Base64 编码
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        const base64 = btoa(binary);

        await api('/api/tools/disk/files/' + fileId + '/chunks', {
          method: 'POST',
          body: JSON.stringify({ chunk_index: i, content: base64, chunk_size: end - start }),
          headers: { 'Content-Type': 'application/json' },
        });

        const pct = Math.round(((i + 1) / chunkCount) * 100);
        fill.style.width = pct + '%';
        status.textContent = (i + 1) + '/' + chunkCount;
      }

      row.querySelector('span').textContent = '✓ ' + file.name;
      status.textContent = '完成';
      toast('「' + file.name + '」上传完成', 'success');
      loadStats();
      loadFiles();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      row.querySelector('span').textContent = '✗ ' + file.name;
      status.textContent = '失败';
      fill.style.background = 'var(--danger)';
      toast('「' + file.name + '」上传失败：' + e.message, 'error');
    }
  }

  // 拖拽 + 点击选择（进入待上传队列）
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files.length) addFiles(fileInput.files); fileInput.value = ''; };
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'var(--primary-light)'; };
  dropZone.ondragleave = () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; };
  dropZone.ondrop = (e) => { e.preventDefault(); dropZone.style.borderColor = ''; dropZone.style.background = ''; if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  loadStats();
  loadFiles();
}

// ═══ 工具 4：基金估值 ═══
function renderStockTool() {
  return \`
<h2>💰 基金估值</h2>
<p class="subtitle">多市场基金持仓估值刷新 · A股/港股/美股/韩台日</p>

<div class="disk-stats" id="stockStats">
  <div class="disk-stat-card"><div class="stat-label">基金数</div><div class="stat-value" id="stockCount">-</div></div>
  <div class="disk-stat-card"><div class="stat-label">上次刷新</div><div class="stat-value" id="stockLastTime" style="font-size:14px">-</div></div>
</div>

<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-primary" id="stockRefreshBtn">🔄 刷新全部估值</button>
  <button class="btn btn-outline" id="stockAddBtn">➕ 添加基金</button>
</div>

<div class="result-box" id="stockResult"></div>

<div class="section-title">基金列表</div>
<div class="file-list" id="stockList">
  <div class="empty">加载中…</div>
</div>

<!-- 添加/编辑基金弹层 -->
<div class="disk-modal-overlay" id="stockModalOverlay">
  <div class="disk-modal" style="max-width:560px">
    <div class="disk-modal-header">
      <h3 id="stockModalTitle">添加基金</h3>
      <button class="btn btn-outline btn-sm" id="stockGotoImportBtn" style="margin-right:auto;display:none">📥 自动导入</button>
      <button class="disk-modal-close" onclick="closeStockModal()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="form-group">
        <label>基金名称</label>
        <input id="stockFundName" placeholder="如：华夏沪深300ETF">
      </div>
      <div class="form-group">
        <label>基金代码（可选）</label>
        <input id="stockFundCode" placeholder="如：510300">
      </div>
      <div class="form-group">
        <label>持仓明细 <button type="button" class="btn btn-outline btn-sm" onclick="addStockHolding()" style="margin-left:8px">+ 添加持仓</button></label>
        <div id="stockHoldingsList"></div>
      </div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" id="stockModalExportBtn" style="display:none;margin-right:auto">导出</button>
      <button class="btn btn-outline" style="color:var(--danger);display:none" id="stockModalDeleteBtn">删除</button>
      <button class="btn btn-outline" onclick="closeStockModal()">取消</button>
      <button class="btn btn-primary" id="stockModalSave">保存</button>
    </div>
  </div>
</div>

<!-- 自动导入弹层 -->
<div class="disk-modal-overlay" id="stockImportOverlay">
  <div class="disk-modal" style="max-width:640px">
    <div class="disk-modal-header">
      <h3>📥 自动导入基金</h3>
      <button class="disk-modal-close" onclick="closeStockImport()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="form-group">
        <label>JSON 数据 <span style="font-weight:400;color:var(--text-muted)">（最外层为数组，支持一次导入多个基金）</span></label>
        <textarea id="stockImportText" class="code-input" placeholder='粘贴 JSON 列表，例如：&#10;[&#10;  { "fund_name": "华夏沪深300ETF", "fund_code": "510300", "holdings": [{"name":"贵州茅台","code":"600519","market":"A","weight":5.23}] }&#10;]' spellcheck="false" style="width:100%;min-height:160px;font-family:var(--font-mono,monospace);font-size:12px;resize:vertical"></textarea>
      </div>
      <div class="form-group">
        <label>模板示例 <span style="font-weight:400;color:var(--text-muted)">（点击下方按钮填入输入框）</span></label>
        <button class="btn btn-outline btn-sm" id="stockFillTemplateBtn">填入模板</button>
      </div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" onclick="closeStockImport()">取消</button>
      <button class="btn btn-primary" id="stockImportSubmit">导入</button>
    </div>
  </div>
</div>
\`;
}

function mountStockTool() {
  const list = $('stockList');
  const refreshBtn = $('stockRefreshBtn');
  const addBtn = $('stockAddBtn');
  const gotoImportBtn = $('stockGotoImportBtn');
  const resultBox = $('stockResult');
  const modalOverlay = $('stockModalOverlay');
  const modalSave = $('stockModalSave');
  const modalDeleteBtn = $('stockModalDeleteBtn');
  const modalExportBtn = $('stockModalExportBtn');
  const holdingsList = $('stockHoldingsList');
  const importOverlay = $('stockImportOverlay');
  const importText = $('stockImportText');
  const importSubmit = $('stockImportSubmit');
  let editingId = null;
  let fundsCache = [];

  const MARKET_LABELS = { A: '内地', HK: '香港', US: '美国', KR: '韩国', TW: '台湾', JP: '日本' };

  // 自动导入模板示例
  const IMPORT_TEMPLATE = [
    {
      fund_name: "华夏沪深300ETF",
      fund_code: "510300",
      holdings: [
        { name: "贵州茅台", code: "600519", market: "A", weight: 5.23 },
        { name: "腾讯控股", code: "700", market: "HK", weight: 8.10 },
        { name: "苹果", code: "AAPL", market: "US", weight: 4.50 }
      ]
    }
  ];

  async function loadFunds() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/stock/funds');
      fundsCache = data.results || [];
      $('stockCount').textContent = fundsCache.length;
      $('stockLastTime').textContent = fundsCache[0]?.estimated_time || '-';
      if (!fundsCache.length) {
        list.innerHTML = '<div class="empty">暂无基金，点击「添加基金」开始</div>';
        return;
      }
      list.innerHTML = fundsCache.map(f => {
        const chg = f.estimated_change;
        const chgClass = chg > 0.01 ? 'change-up' : chg < -0.01 ? 'change-down' : 'change-flat';
        const chgText = chg == null || chg === 0 ? '—' : ((chg > 0 ? '+' : '') + Number(chg).toFixed(2) + '%');
        let holdCount = 0;
        try { holdCount = JSON.parse(f.holdings || '[]').length; } catch {}
        return '<div class="file-item" onclick="openStockDetail(\\'' + f.id + '\\')">' +
          '<div class="file-icon">📊</div>' +
          '<div class="file-info"><div class="file-name">' + esc(f.fund_name) + (f.fund_code ? ' <span style="color:var(--text-muted);font-weight:400;font-size:12px">' + esc(f.fund_code) + '</span>' : '') + '</div>' +
          '<div class="file-meta">' + holdCount + ' 只持仓</div></div>' +
          '<div class="file-actions"><span class="num ' + chgClass + '" style="font-weight:600;font-size:14px">' + chgText + '</span>' +
          '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editStockFund(\\'' + f.id + '\\')">编辑</button></div>' +
          '</div>';
      }).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function addStockHolding(name, code, market, weight) {
    const div = document.createElement('div');
    div.className = 'form-inline';
    div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
    div.innerHTML =
      '<input class="h-name" placeholder="名称" value="' + esc(name||'') + '" style="flex:1">' +
      '<input class="h-code" placeholder="代码" value="' + esc(code||'') + '" style="width:90px" spellcheck="false">' +
      '<select class="h-market" style="width:80px">' +
        '<option value="A"' + (market==='A'?' selected':'') + '>内地</option>' +
        '<option value="HK"' + (market==='HK'?' selected':'') + '>香港</option>' +
        '<option value="US"' + (market==='US'?' selected':'') + '>美国</option>' +
        '<option value="KR"' + (market==='KR'?' selected':'') + '>韩国</option>' +
        '<option value="TW"' + (market==='TW'?' selected':'') + '>台湾</option>' +
        '<option value="JP"' + (market==='JP'?' selected':'') + '>日本</option>' +
      '</select>' +
      '<input class="h-weight" type="number" placeholder="%" value="' + (weight||'') + '" step="0.01" style="width:70px">' +
      '<button class="btn btn-outline btn-sm" onclick="this.parentElement.remove()">✕</button>';
    holdingsList.appendChild(div);
  }

  window.addStockHolding = addStockHolding;

  window.openStockModal = function(isEdit) {
    $('stockModalTitle').textContent = isEdit ? '编辑基金' : '添加基金';
    // 删除、导出按钮仅在编辑时显示；自动导入入口仅在新增时显示
    modalDeleteBtn.style.display = isEdit ? '' : 'none';
    modalExportBtn.style.display = isEdit ? '' : 'none';
    gotoImportBtn.style.display = isEdit ? 'none' : '';
    modalOverlay.classList.add('show');
  };
  window.closeStockModal = function() {
    modalOverlay.classList.remove('show');
    editingId = null;
  };
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeStockModal(); };

  // 弹层内删除按钮：先确认，删后关闭弹层
  modalDeleteBtn.onclick = async () => {
    if (!editingId) return;
    if (!confirm('确定删除此基金？')) return;
    try {
      await api('/api/tools/stock/funds/' + editingId, { method: 'DELETE' });
      toast('已删除', 'success');
      closeStockModal();
      loadFunds();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  // 弹层内导出按钮：把当前编辑的基金序列化为 JSON 复制到剪贴板
  modalExportBtn.onclick = () => {
    const name = $('stockFundName').value.trim();
    const code = $('stockFundCode').value.trim();
    const rows = holdingsList.querySelectorAll('.form-inline');
    const holdings = [];
    for (const row of rows) {
      const n = row.querySelector('.h-name').value.trim();
      const c = row.querySelector('.h-code').value.trim();
      const m = row.querySelector('.h-market').value;
      const w = parseFloat(row.querySelector('.h-weight').value) || 0;
      if (!n && !c) continue;
      holdings.push({ name: n, code: c, market: m, weight: w });
    }
    const json = JSON.stringify({ fund_name: name, fund_code: code, holdings }, null, 2);
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    toast(ok ? 'JSON 已复制到剪贴板' : '复制失败，请手动复制', ok ? 'success' : 'error');
  };

  window.editStockFund = function(id) {
    const f = fundsCache.find(x => x.id === id);
    if (!f) return;
    editingId = id;
    $('stockFundName').value = f.fund_name || '';
    $('stockFundCode').value = f.fund_code || '';
    holdingsList.innerHTML = '';
    let holdings = [];
    try { holdings = JSON.parse(f.holdings || '[]'); } catch {}
    if (!holdings.length) addStockHolding();
    else holdings.forEach(h => addStockHolding(h.name, h.code, h.market, h.weight));
    openStockModal(true);
  };

  window.openStockDetail = function(id) {
    const f = fundsCache.find(x => x.id === id);
    if (!f) return;
    let details = [];
    try { details = JSON.parse(f.holdings_detail || '[]'); } catch {}
    if (!details.length) {
      toast('暂无估值详情，请先点击「刷新全部估值」', 'info');
      return;
    }
    let html = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-muted)">' + esc(f.fund_name) + ' · ' + (f.estimated_time ? esc(f.estimated_time) : '') + '</div>';
    html += '<table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:4px">持仓</th><th>市场</th><th class="num">权重</th><th class="num">涨跌</th><th class="num">贡献</th><th>状态</th></tr></thead><tbody>';
    for (const d of details) {
      const cp = d.changePct;
      const chgClass = cp == null ? 'change-flat' : cp > 0.01 ? 'change-up' : cp < -0.01 ? 'change-down' : 'change-flat';
      const chgText = cp == null ? '—' : ((cp > 0 ? '+' : '') + Number(cp).toFixed(2) + '%');
      const contribText = d.contribution == null ? '—' : ((d.contribution > 0 ? '+' : '') + Number(d.contribution).toFixed(2) + '%');
      html += '<tr style="border-top:1px solid var(--border)"><td style="padding:4px">' + esc(d.name) + '<div style="color:var(--text-muted);font-size:11px">' + esc(d.code) + '</div></td>' +
        '<td style="text-align:center">' + esc(MARKET_LABELS[d.market] || d.market) + '</td>' +
        '<td class="num" style="text-align:right">' + (d.weight||0) + '%</td>' +
        '<td class="num ' + chgClass + '" style="text-align:right">' + chgText + '</td>' +
        '<td class="num ' + chgClass + '" style="text-align:right">' + contribText + '</td>' +
        '<td style="text-align:center;font-size:11px">' + esc(d.statusLabel || '—') + '</td></tr>';
    }
    html += '</tbody></table>';
    // 复用 disk-modal 结构弹层显示
    const detailOverlay = document.createElement('div');
    detailOverlay.className = 'disk-modal-overlay show';
    detailOverlay.innerHTML = '<div class="disk-modal" style="max-width:560px"><div class="disk-modal-header"><h3>估值详情</h3><button class="disk-modal-close">✕</button></div><div class="disk-modal-body">' + html + '</div></div>';
    detailOverlay.onclick = (e) => { if (e.target === detailOverlay || e.target.className === 'disk-modal-close') detailOverlay.remove(); };
    document.body.appendChild(detailOverlay);
  };

  addBtn.onclick = () => {
    editingId = null;
    $('stockFundName').value = '';
    $('stockFundCode').value = '';
    holdingsList.innerHTML = '';
    addStockHolding();
    openStockModal(false);
  };

  modalSave.onclick = async () => {
    const name = $('stockFundName').value.trim();
    if (!name) { toast('请输入基金名称', 'error'); return; }
    const code = $('stockFundCode').value.trim();
    const rows = holdingsList.querySelectorAll('.form-inline');
    const holdings = [];
    for (const row of rows) {
      const n = row.querySelector('.h-name').value.trim();
      const c = row.querySelector('.h-code').value.trim();
      const m = row.querySelector('.h-market').value;
      const w = parseFloat(row.querySelector('.h-weight').value) || 0;
      if (!n && !c) continue;
      if (!n) { toast('请填写持仓名称', 'error'); return; }
      if (!c) { toast('请填写持仓代码', 'error'); return; }
      holdings.push({ name: n, code: c, market: m, weight: w });
    }
    if (!holdings.length) { toast('请至少添加一条持仓明细', 'error'); return; }
    const body = { fund_name: name, fund_code: code, holdings: JSON.stringify(holdings) };
    modalSave.disabled = true; modalSave.textContent = '保存中…';
    try {
      if (editingId) {
        await api('/api/tools/stock/funds/' + editingId, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
        toast('已更新', 'success');
      } else {
        await api('/api/tools/stock/funds', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
        toast('已添加', 'success');
      }
      closeStockModal();
      loadFunds();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    } finally {
      modalSave.disabled = false; modalSave.textContent = '保存';
    }
  };

  refreshBtn.onclick = async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = '🔄 刷新中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在抓取行情并计算估值…';
    try {
      const data = await api('/api/tools/stock/refresh', { method: 'POST' });
      const s = data.stats || {};
      resultBox.className = 'result-box show success';
      resultBox.textContent = '✓ 刷新完成：' + s.updated_funds + '/' + s.total_funds + ' 只基金 · ' +
        s.matched_holdings + '/' + s.total_holdings + ' 持仓匹配 (' + s.match_rate + ') · ' +
        (s.time_ms ? (s.time_ms + 'ms') : '');
      toast('估值已刷新', 'success');
      loadFunds();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('刷新失败', 'error');
    } finally {
      refreshBtn.disabled = false; refreshBtn.textContent = '🔄 刷新全部估值';
    }
  };

  // ─── 自动导入 ───
  window.closeStockImport = function() {
    importOverlay.classList.remove('show');
  };
  importOverlay.onclick = (e) => { if (e.target === importOverlay) closeStockImport(); };

  gotoImportBtn.onclick = () => {
    closeStockModal();
    importText.value = '';
    importOverlay.classList.add('show');
  };

  $('stockFillTemplateBtn').onclick = () => {
    importText.value = JSON.stringify(IMPORT_TEMPLATE, null, 2);
  };

  importSubmit.onclick = async () => {
    const raw = importText.value.trim();
    if (!raw) { toast('请输入 JSON 数据', 'error'); return; }
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { toast('JSON 格式错误：' + e.message, 'error'); return; }
    if (!Array.isArray(data)) { toast('最外层必须是数组', 'error'); return; }

    importSubmit.disabled = true; importSubmit.textContent = '导入中…';
    try {
      const result = await api('/api/tools/stock/funds/batch', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = result.success || 0, fail = result.failed || 0;
      if (fail === 0) {
        toast('成功导入 ' + ok + ' 只基金', 'success');
      } else if (ok > 0) {
        toast('导入完成：成功 ' + ok + '，失败 ' + fail, 'info');
      } else {
        toast('导入失败：' + (result.errors?.[0]?.error || '未知错误'), 'error');
      }
      closeStockImport();
      loadFunds();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('导入失败：' + e.message, 'error');
    } finally {
      importSubmit.disabled = false; importSubmit.textContent = '导入';
    }
  };

  loadFunds();
}

// ═══ 工具 5：AI 新闻锐评 ═══
function renderNewsTool() {
  return \`
<h2>📰 AI 新闻锐评</h2>
<p class="subtitle">抓取科技新闻并由 AI 写贴吧风格锐评 · 保留最近 60 条</p>

<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-primary" id="newsTriggerBtn">📡 立即抓取</button>
  <button class="btn btn-outline" id="newsTopBtn">🎯 生成 Top 10</button>
  <button class="btn btn-outline" id="newsReloadBtn">🔄 刷新</button>
  <button class="btn btn-outline" id="newsToggleBtn">📋 查看全部</button>
</div>

<div class="result-box" id="newsResult"></div>

<div class="section-title" id="newsSectionTitle">🔥 Top 10 热门关键词</div>
<div class="file-list" id="newsList">
  <div class="empty">加载中…</div>
</div>
\`;
}

function mountNewsTool() {
  const list = $('newsList');
  const triggerBtn = $('newsTriggerBtn');
  const topBtn = $('newsTopBtn');
  const reloadBtn = $('newsReloadBtn');
  const toggleBtn = $('newsToggleBtn');
  const sectionTitle = $('newsSectionTitle');
  const resultBox = $('newsResult');

  // 视图模式：'top' = Top10 关键词，'all' = 全部新闻列表
  let viewMode = 'top';

  function renderNewsCard(item) {
    const time = formatNewsTime(item.crawled_at);
    return '<div class="file-item" style="align-items:flex-start;flex-direction:column;gap:4px">' +
      '<div style="display:flex;gap:6px;font-size:11px;color:var(--text-muted);align-items:center;width:100%">' +
        '<span style="color:var(--primary);font-weight:600">' + esc(item.source) + '</span>' +
        '<span style="background:var(--tag-bg);padding:1px 6px;border-radius:3px">' + esc(item.category) + '</span>' +
        '<span style="margin-left:auto">' + esc(time) + '</span>' +
      '</div>' +
      '<a href="' + esc(item.url) + '" target="_blank" rel="noopener" style="color:var(--text);font-weight:500;font-size:14px;text-decoration:none;line-height:1.4">' + esc(item.title) + '</a>' +
      (item.summary ? '<div style="color:var(--text-secondary);font-size:13px;line-height:1.5;margin-top:2px">' + esc(item.summary) + '</div>' : '') +
    '</div>';
  }

  async function loadTop() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/news/top');
      const keywords = data.keywords || [];
      if (!keywords.length) {
        list.innerHTML = '<div class="empty">暂无统计，点击「🎯 生成 Top 10」生成</div>';
        return;
      }
      const generatedAt = data.generated_at ? ' · 生成于 ' + formatNewsTime(data.generated_at) : '';
      list.innerHTML = keywords.map((kw, i) => {
        const rank = i + 1;
        const rankStyle = rank <= 3 ? 'color:#fff;background:var(--primary)' : 'color:var(--text-muted);background:var(--tag-bg)';
        const articlesHtml = (kw.articles || []).map(a => renderNewsCard(a)).join('');
        return '<div class="file-item" style="align-items:flex-start;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:8px;align-items:center;width:100%">' +
            '<span style="' + rankStyle + ';width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + rank + '</span>' +
            '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(kw.keyword) + '</span>' +
            '<span style="margin-left:auto;color:var(--text-muted);font-size:12px">' + kw.count + ' 条' + generatedAt + '</span>' +
          '</div>' +
          '<div style="width:100%;display:flex;flex-direction:column;gap:6px">' + articlesHtml + '</div>' +
        '</div>';
      }).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  async function loadAllNews() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/news/list?limit=60');
      const items = data.results || [];
      if (!items.length) {
        list.innerHTML = '<div class="empty">暂无新闻，点击「立即抓取」开始</div>';
        return;
      }
      list.innerHTML = items.map(renderNewsCard).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function loadCurrent() {
    if (viewMode === 'top') loadTop();
    else loadAllNews();
  }

  function setView(mode) {
    viewMode = mode;
    if (mode === 'top') {
      sectionTitle.textContent = '🔥 Top 10 热门关键词';
      toggleBtn.textContent = '📋 查看全部';
    } else {
      sectionTitle.textContent = '最近新闻（全部）';
      toggleBtn.textContent = '🔥 返回 Top 10';
    }
    loadCurrent();
  }

  function formatNewsTime(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      const cst = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      return (cst.getUTCMonth() + 1) + '/' + pad(cst.getUTCDate()) + ' ' + pad(cst.getUTCHours()) + ':' + pad(cst.getUTCMinutes());
    } catch { return iso || ''; }
  }

  triggerBtn.onclick = async () => {
    triggerBtn.disabled = true; triggerBtn.textContent = '📡 抓取中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在抓取新闻并由 AI 写锐评，可能需要 30-60 秒…';
    try {
      const data = await api('/api/tools/news/trigger', { method: 'POST' });
      if (data.success) {
        resultBox.className = 'result-box show success';
        resultBox.textContent = '✓ 抓取完成：新增 ' + data.articles_count + ' 条' + (data.error ? ' · ' + data.error : '');
        toast('抓取完成', 'success');
        loadCurrent();
      } else {
        resultBox.className = 'result-box show error';
        resultBox.textContent = '✗ ' + (data.error || '抓取失败');
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('抓取失败', 'error');
    } finally {
      triggerBtn.disabled = false; triggerBtn.textContent = '📡 立即抓取';
    }
  };

  topBtn.onclick = async () => {
    topBtn.disabled = true; topBtn.textContent = '🎯 生成中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在基于当前新闻生成 Top 10 关键词…';
    try {
      const data = await api('/api/tools/news/top/refresh', { method: 'POST' });
      if (data.success) {
        resultBox.className = 'result-box show success';
        resultBox.textContent = '✓ 生成完成：' + data.count + ' 个关键词' + (data.generated_at ? ' · ' + formatNewsTime(data.generated_at) : '');
        toast('Top 10 生成完成', 'success');
        viewMode = 'top';
        setView('top');
        loadTop();
      } else {
        resultBox.className = 'result-box show error';
        resultBox.textContent = '✗ ' + (data.error || '生成失败');
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('生成失败', 'error');
    } finally {
      topBtn.disabled = false; topBtn.textContent = '🎯 生成 Top 10';
    }
  };

  reloadBtn.onclick = loadCurrent;
  toggleBtn.onclick = () => setView(viewMode === 'top' ? 'all' : 'top');

  loadTop();
}

// ═══ 工具 6：配置管理 ═══
function renderConfigTool() {
  return \`
<h2>⚙️ 配置管理</h2>
<p class="subtitle">集中管理 API 密钥与工具配置 · 敏感字段 AES-GCM 加密存储</p>

<div style="background:var(--card);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--text-secondary);box-shadow:var(--shadow)">
  <b>三级降级读取</b>：工具级覆盖 → 全局默认 → env 兼容期 → 代码默认值。
  敏感字段（密钥/Token）写入时加密存储，读取时只返回"已设置/未设置"标记。
</div>

<div class="result-box" id="configResult"></div>

<div class="section-title">全局默认配置（namespace=app）</div>
<div class="file-list" id="configGlobalList">
  <div class="empty">加载中…</div>
</div>

<div class="section-title">工具级覆盖（namespace=tool:&lt;工具名&gt;）</div>
<div class="file-list" id="configToolList">
  <div class="empty">加载中…</div>
</div>

<!-- 编辑弹层 -->
<div class="disk-modal-overlay" id="configModalOverlay">
  <div class="disk-modal">
    <div class="disk-modal-header">
      <h3 id="configModalTitle">编辑配置</h3>
      <button class="disk-modal-close" onclick="closeConfigModal()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="form-group">
        <label id="configModalLabel"></label>
        <input type="text" id="configModalInput" autocomplete="off" spellcheck="false">
        <div class="input-desc" id="configModalHint"></div>
      </div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" onclick="closeConfigModal()">取消</button>
      <button class="btn btn-primary" id="configModalSave">保存</button>
    </div>
  </div>
</div>

<!-- 选择覆盖配置项弹层 -->
<div class="disk-modal-overlay" id="configPickOverlay">
  <div class="disk-modal" style="max-width:480px">
    <div class="disk-modal-header">
      <h3>选择要覆盖的配置项</h3>
      <button class="disk-modal-close" onclick="closeConfigPick()">✕</button>
    </div>
    <div class="disk-modal-body" id="configPickBody"></div>
  </div>
</div>
\`;
}

function mountConfigTool() {
  const globalList = $('configGlobalList');
  const toolList = $('configToolList');
  const resultBox = $('configResult');
  const modalOverlay = $('configModalOverlay');
  const modalSave = $('configModalSave');
  const modalInput = $('configModalInput');
  const modalLabel = $('configModalLabel');
  const modalHint = $('configModalHint');
  const modalTitle = $('configModalTitle');
  const pickOverlay = $('configPickOverlay');
  const pickBody = $('configPickBody');

  let schema = [];
  let tools = [];
  let globalConfigs = [];   // [{ key, desc, sensitive, placeholder, default, hasValue, value }]
  let toolOverrides = {};   // { toolId: [{ key, desc, sensitive, hasValue, value }] }
  let editing = null;       // { scope: 'app'|'tool', tool?, key, field }

  function valueDisplay(cfg) {
    // 敏感字段：用 ****** 脱敏显示
    if (cfg.sensitive) {
      return cfg.hasValue
        ? '<span class="num" style="color:var(--success)">******</span>'
        : '<span style="color:var(--text-muted)">○ 未设置</span>';
    }
    // 非敏感：显示值或默认
    if (cfg.hasValue && cfg.value) {
      return '<span class="num">' + esc(cfg.value) + '</span>';
    }
    if (cfg.default) {
      return '<span style="color:var(--text-muted)">默认: ' + esc(cfg.default) + '</span>';
    }
    return '<span style="color:var(--text-muted)">未设置</span>';
  }

  function renderGlobal() {
    if (!globalConfigs.length) {
      globalList.innerHTML = '<div class="empty">无配置项</div>';
      return;
    }
    globalList.innerHTML = globalConfigs.map(cfg => {
      const icon = cfg.sensitive ? '🔐' : '⚙️';
      const tag = cfg.sensitive ? ' <span style="font-size:10px;background:rgba(239,68,68,0.15);color:var(--danger);padding:1px 6px;border-radius:3px">敏感</span>' : '';
      return '<div class="file-item">' +
        '<div class="file-icon">' + icon + '</div>' +
        '<div class="file-info"><div class="file-name">' + esc(cfg.key) + tag + '</div>' +
        '<div class="file-meta">' + esc(cfg.desc) + ' · ' + valueDisplay(cfg) + '</div></div>' +
        '<div class="file-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="editConfig(\\'app\\',null,\\'' + esc(cfg.key) + '\\')">编辑</button>' +
        (cfg.hasValue ? '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="clearConfig(\\'app\\',null,\\'' + esc(cfg.key) + '\\')">清除</button>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderTools() {
    if (!tools.length) {
      toolList.innerHTML = '<div class="empty">无工具</div>';
      return;
    }
    toolList.innerHTML = tools.map(t => {
      const overrides = toolOverrides[t.id] || [];
      let body = '';
      if (!overrides.length) {
        body = '<span style="font-size:12px;color:var(--text-muted)">无覆盖（使用全局默认）</span>';
      } else {
        body = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + overrides.map(o => {
          const valText = o.sensitive ? '******' : (o.value ? esc(o.value) : '已设置');
          return '<span class="saved-config" onclick="editConfig(\\'tool\\',\\'' + t.id + '\\',\\'' + esc(o.key) + '\\')">' + esc(o.key) + ': ' + valText +
            '<span class="del" onclick="event.stopPropagation();clearConfig(\\'tool\\',\\'' + t.id + '\\',\\'' + esc(o.key) + '\\')">✕</span></span>';
        }).join('') + '</div>';
      }
      // 工具可覆盖的配置项（schema 中所有 key 减去已覆盖的）
      const existing = new Set(overrides.map(o => o.key));
      const available = schema.filter(f => !existing.has(f.key));
      const addBtn = available.length
        ? '<button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="addToolOverride(\\'' + t.id + '\\')">+ 添加覆盖</button>'
        : '';
      return '<div class="file-item" style="display:block;padding:14px 16px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-weight:600;font-size:14px">' + esc(t.name) + ' <span style="color:var(--text-muted);font-weight:400;font-size:12px">tool:' + esc(t.id) + '</span></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + body + addBtn + '</div>' +
        '</div>';
    }).join('');
  }

  async function loadAll() {
    try {
      const [schemaData, globalData] = await Promise.all([
        api('/api/config/schema'),
        api('/api/config'),
      ]);
      schema = schemaData.schema || [];
      tools = schemaData.tools || [];
      globalConfigs = globalData.configs || [];

      // 并行加载所有工具的覆盖
      const results = await Promise.all(
        tools.map(t => api('/api/config/tools/' + t.id).catch(() => ({ overrides: [] })))
      );
      toolOverrides = {};
      tools.forEach((t, i) => {
        toolOverrides[t.id] = results[i].overrides || [];
      });

      renderGlobal();
      renderTools();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      globalList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
      toolList.innerHTML = '';
    }
  }

  function openModal(scope, tool, key) {
    const field = schema.find(f => f.key === key);
    if (!field) return;
    editing = { scope, tool, key, field };

    modalTitle.textContent = scope === 'app' ? '编辑全局配置' : '编辑工具级覆盖';
    modalLabel.textContent = field.key + ' — ' + field.desc + (field.sensitive ? ' （敏感）' : '');
    modalInput.placeholder = field.placeholder || (field.default ? '默认: ' + field.default : '');
    modalInput.value = '';
    modalInput.type = field.sensitive ? 'password' : 'text';
    let hint = '';
    if (field.sensitive) hint = '敏感字段，已加密存储。留空保存将清除该配置。';
    else if (field.default) hint = '留空保存将回退到默认值：' + field.default;
    else hint = '留空保存将清除该配置。';
    if (scope === 'tool') hint += ' （工具级覆盖优先于全局默认）';
    modalHint.textContent = hint;

    modalOverlay.classList.add('show');
    setTimeout(() => modalInput.focus(), 50);
  }

  window.closeConfigModal = function() {
    modalOverlay.classList.remove('show');
    editing = null;
  };
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeConfigModal(); };

  window.editConfig = function(scope, tool, key) {
    openModal(scope, tool, key);
  };

  window.addToolOverride = function(tool) {
    // 列出该工具未覆盖的所有配置项，让用户选择
    const overrides = toolOverrides[tool] || [];
    const existing = new Set(overrides.map(o => o.key));
    const available = schema.filter(f => !existing.has(f.key));
    if (!available.length) { toast('该工具已覆盖所有配置项', 'info'); return; }
    pickBody.innerHTML = available.map(f => {
      const sensitiveTag = f.sensitive ? ' <span style="color:var(--text-muted);font-size:11px">（敏感）</span>' : '';
      const defaultTag = f.default ? ' <span style="color:var(--text-muted);font-size:11px">默认: ' + esc(f.default) + '</span>' : '';
      return '<div class="file-item" style="padding:10px 14px;cursor:pointer" onclick="pickOverride(\\'' + esc(tool) + '\\',\\'' + esc(f.key) + '\\')">' +
        '<div class="file-info"><div class="file-name">' + esc(f.key) + sensitiveTag + '</div>' +
        '<div class="file-meta">' + esc(f.desc) + defaultTag + '</div></div></div>';
    }).join('');
    pickOverlay.classList.add('show');
  };

  window.closeConfigPick = function() {
    pickOverlay.classList.remove('show');
  };
  pickOverlay.onclick = (e) => { if (e.target === pickOverlay) closeConfigPick(); };

  window.pickOverride = function(tool, key) {
    closeConfigPick();
    openModal('tool', tool, key);
  };

  window.clearConfig = async function(scope, tool, key) {
    const scopeText = scope === 'app' ? '全局配置' : '工具 ' + tool + ' 覆盖';
    if (!confirm('确认清除 ' + scopeText + ' 的 ' + key + '？')) return;
    try {
      const url = scope === 'app'
        ? '/api/config/' + encodeURIComponent(key)
        : '/api/config/tools/' + encodeURIComponent(tool) + '/' + encodeURIComponent(key);
      await api(url, { method: 'PUT', body: JSON.stringify({ value: '' }), headers: { 'Content-Type': 'application/json' } });
      toast('已清除', 'success');
      loadAll();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('清除失败：' + e.message, 'error');
    }
  };

  modalSave.onclick = async () => {
    if (!editing) return;
    const { scope, tool, key } = editing;
    const value = modalInput.value;
    modalSave.disabled = true; modalSave.textContent = '保存中…';
    try {
      const url = scope === 'app'
        ? '/api/config/' + encodeURIComponent(key)
        : '/api/config/tools/' + encodeURIComponent(tool) + '/' + encodeURIComponent(key);
      await api(url, { method: 'PUT', body: JSON.stringify({ value }), headers: { 'Content-Type': 'application/json' } });
      toast('已保存', 'success');
      closeConfigModal();
      loadAll();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    } finally {
      modalSave.disabled = false; modalSave.textContent = '保存';
    }
  };

  loadAll();
}

// ─── 初始化 ───
tokenInput.value = token;
verifyBtn.addEventListener('click', verifyToken);
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyToken(); });

// 自动验证已保存的令牌
if (token) {
  setBtnStatus('验证中…', 'loading', true);
  fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => {
      if (res.ok) {
        setBtnStatus('✓ 已授权', 'ok');
        mainContent.classList.add('active');
        initTools();
      } else {
        setBtnStatus('验证', '');
        localStorage.removeItem('kbox_token');
        token = '';
      }
    })
    .catch(() => setBtnStatus('验证', ''));
} else {
  setBtnStatus('验证', '');
}
</script>
</body>
</html>`;
}
