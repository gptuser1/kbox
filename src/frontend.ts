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
.tool-back {
  display: inline-flex; align-items: center; gap: 6px; background: none; border: none;
  color: var(--text-secondary); font-size: 14px; cursor: pointer; margin-bottom: 20px; padding: 6px 0;
  transition: color 0.2s;
}
.tool-back:hover { color: var(--primary); }
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

.disk-upload { background: var(--card); border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow); }
.disk-upload.dragover { border: 2px dashed var(--primary); }
.disk-drop-zone { border: 2px dashed var(--border); border-radius: 10px; padding: 28px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.3s; }
.disk-drop-zone:hover { border-color: var(--primary); background: var(--primary-light); }
.disk-drop-zone .drop-icon { font-size: 36px; margin-bottom: 8px; opacity: 0.5; }
.disk-drop-zone .drop-text { font-size: 14px; color: var(--text-secondary); }
.disk-drop-zone .drop-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.disk-upload-progress { margin-top: 12px; }
.disk-upload-progress .progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.disk-upload-progress .progress-bar { flex: 1; height: 4px; background: var(--input-bg); border-radius: 2px; overflow: hidden; }
.disk-upload-progress .progress-fill { height: 100%; background: var(--primary); transition: width 0.3s; }

.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-item { background: var(--card); border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 12px; transition: box-shadow 0.2s; }
.file-item:hover { box-shadow: var(--shadow-lg); }
.file-icon { font-size: 24px; flex-shrink: 0; }
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
}

window.backToGrid = function() {
  for (const t of TOOLS) { $('view-' + t.id).classList.remove('active'); }
  toolGrid.style.display = 'grid';
}

// ═══ 工具 1：GitHub Workflow Dispatch ═══
function renderDispatchTool() {
  return \`
    <button class="tool-back" onclick="backToGrid()">← 返回</button>
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

  function renderSavedConfigs() {
    const configs = JSON.parse(localStorage.getItem('kbox_dispatch_configs') || '[]');
    if (!configs.length) { savedConfigsBox.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      html += '<span class="saved-config" onclick="loadDispatchConfig(' + i + ')">' + esc(c.repo) + ' / ' + esc(c.workflow_id) + '<span class="del" onclick="delDispatchConfig(event,' + i + ')">✕</span></span>';
    }
    savedConfigsBox.innerHTML = html;
  }

  window.loadDispatchConfig = function(i) {
    const configs = JSON.parse(localStorage.getItem('kbox_dispatch_configs') || '[]');
    const c = configs[i];
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

  window.delDispatchConfig = function(e, i) {
    e.stopPropagation();
    const configs = JSON.parse(localStorage.getItem('kbox_dispatch_configs') || '[]');
    configs.splice(i, 1);
    localStorage.setItem('kbox_dispatch_configs', JSON.stringify(configs));
    renderSavedConfigs();
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

  saveBtn.onclick = () => {
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
    const configs = JSON.parse(localStorage.getItem('kbox_dispatch_configs') || '[]');
    configs.push({ repo, workflow_id: selectedWf, branch: branchSelect.value || 'main', inputs });
    localStorage.setItem('kbox_dispatch_configs', JSON.stringify(configs));
    renderSavedConfigs();
    toast('配置已保存', 'success');
  };
}

// ═══ 工具 2：微型云盘 ═══
const DISK_CHUNK_SIZE = 1.4 * 1024 * 1024; // 1.4MB，与后端一致
const DISK_MAX_SIZE = 10 * 1024 * 1024; // 10MB

function renderDiskTool() {
  return \`
    <button class="tool-back" onclick="backToGrid()">← 返回</button>
    <h2>☁️ 微型云盘</h2>
    <p class="subtitle">基于 D1 的轻量文件存储 · 单文件上限 10MB</p>
    <div class="disk-stats" id="diskStats"></div>
    <div class="disk-upload">
      <div class="disk-drop-zone" id="diskDropZone">
        <div class="drop-icon">📁</div>
        <div class="drop-text">点击选择文件或拖拽到此处</div>
        <div class="drop-hint">支持任意类型，单文件最大 10MB</div>
      </div>
      <input type="file" id="diskFileInput" style="display:none" multiple>
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

  // 上传逻辑
  function handleFiles(files) {
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > DISK_MAX_SIZE) {
        toast('「' + file.name + '」超过 10MB 限制', 'error');
        continue;
      }
      uploadFile(file);
    }
  }

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

  // 拖拽 + 点击上传
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files.length) handleFiles(fileInput.files); fileInput.value = ''; };
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'var(--primary-light)'; };
  dropZone.ondragleave = () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; };
  dropZone.ondrop = (e) => { e.preventDefault(); dropZone.style.borderColor = ''; dropZone.style.background = ''; if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); };

  loadStats();
  loadFiles();
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
