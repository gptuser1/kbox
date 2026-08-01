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
.token-bar .token-group { display: flex; align-items: center; gap: 8px; flex: 1; }
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

/* ─── inputs 动态表单 ─── */
.input-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.input-row input { flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--input-bg); color: var(--text); outline: none; transition: border-color 0.2s; }
.input-row input:focus { border-color: var(--primary); }
.input-row .input-key { flex: 0 0 120px; }
.input-row .btn-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; padding: 6px; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; }
.input-row .btn-remove:hover { color: var(--danger); background: rgba(239,68,68,0.1); }

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

@media (max-width: 640px) {
  .token-bar { flex-wrap: wrap; padding: 12px 16px; }
  .token-bar .token-group { width: 100%; }
  .container { padding: 24px 16px 60px; }
  .tool-grid { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; align-items: stretch; }
}
</style>
</head>
<body>

<div class="token-bar">
  <div class="logo"><span>📦</span> kbox</div>
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

// ─── 工具注册表（模块化：新增工具只需在此注册 + 实现 render/mount） ───
const TOOLS = [
  { id: 'dispatch', name: 'GitHub Actions 触发', icon: '⚡', desc: '通过 API 触发 GitHub workflow dispatch', render: renderDispatchTool, mount: mountDispatchTool },
];

function initTools() {
  // 渲染工具网格
  let grid = '';
  for (const t of TOOLS) {
    grid += '<div class="tool-card" onclick="showTool(\\'' + t.id + '\\')"><div class="tool-icon">' + t.icon + '</div><div class="tool-name">' + t.name + '</div><div class="tool-desc">' + t.desc + '</div></div>';
  }
  toolGrid.innerHTML = grid;
  // 渲染工具视图容器
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
        <label>仓库 (owner/repo)</label>
        <input type="text" id="dispatchRepo" placeholder="例如 gptuser1/stock">
      </div>
      <button class="btn btn-outline" id="dispatchLoadBtn" style="margin-bottom:0">加载工作流</button>
    </div>
    <div class="form-group">
      <label>分支 / Ref</label>
      <input type="text" id="dispatchRef" value="main" placeholder="默认 main">
    </div>
    <div class="section-title" id="dispatchWfTitle" style="display:none">选择工作流</div>
    <div class="wf-list" id="dispatchWfList"></div>
    <div id="dispatchInputsSection" style="display:none">
      <div class="section-title">Workflow Inputs <span style="font-weight:400;color:var(--text-muted)">（可选，留空则不传）</span></div>
      <div id="dispatchInputs"></div>
      <button class="btn btn-outline btn-sm" id="dispatchAddInputBtn">＋ 添加参数</button>
    </div>
    <div style="margin-top:24px">
      <button class="btn btn-primary" id="dispatchTriggerBtn" disabled>触发</button>
      <button class="btn btn-outline" id="dispatchSaveBtn">保存配置</button>
    </div>
    <div class="result-box" id="dispatchResult"></div>
  \`;
}

let selectedWf = null;

function mountDispatchTool() {
  const repoInput = $('dispatchRepo');
  const loadBtn = $('dispatchLoadBtn');
  const wfList = $('dispatchWfList');
  const wfTitle = $('dispatchWfTitle');
  const inputsSection = $('dispatchInputsSection');
  const inputsBox = $('dispatchInputs');
  const addInputBtn = $('dispatchAddInputBtn');
  const triggerBtn = $('dispatchTriggerBtn');
  const saveBtn = $('dispatchSaveBtn');
  const resultBox = $('dispatchResult');
  const savedConfigsBox = $('dispatchSavedConfigs');

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
    $('dispatchRef').value = c.ref || 'main';
    // 自动加载工作流并选中
    loadBtn.click();
    setTimeout(() => {
      selectedWf = c.workflow_id;
      // 标记选中
      const items = wfList.querySelectorAll('.wf-item');
      items.forEach(item => {
        if (item.dataset.wf === c.workflow_id) { item.classList.add('selected'); }
        else { item.classList.remove('selected'); }
      });
      triggerBtn.disabled = !selectedWf;
      if (c.inputs && c.inputs.length) {
        inputsSection.style.display = '';
        inputsBox.innerHTML = '';
        c.inputs.forEach(([k, v]) => addInputRow(k, v));
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

  function addInputRow(key, val) {
    key = key || ''; val = val || '';
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = '<input class="input-key" placeholder="参数名" value="' + esc(key) + '"><input class="input-val" placeholder="值" value="' + esc(val) + '"><button class="btn-remove">✕</button>';
    row.querySelector('.btn-remove').onclick = () => row.remove();
    inputsBox.appendChild(row);
  }

  addInputBtn.onclick = () => addInputRow();

  loadBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo) { toast('请输入 owner/repo', 'error'); repoInput.focus(); return; }
    if (!repo.includes('/')) { toast('格式应为 owner/repo', 'error'); return; }
    const [owner, repoName] = repo.split('/');
    loadBtn.disabled = true; loadBtn.textContent = '加载中…';
    wfList.innerHTML = '<div class="empty">加载中…</div>';
    wfTitle.style.display = '';
    try {
      const data = await api('/api/tools/workflows?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName));
      if (!data.workflows || !data.workflows.length) {
        wfList.innerHTML = '<div class="empty">该仓库没有 workflows</div>';
        return;
      }
      let html = '';
      for (const w of data.workflows) {
        html += '<div class="wf-item" data-wf="' + esc(w.filename) + '" data-wfid="' + w.id + '"><div class="wf-info"><div class="wf-name">' + esc(w.name) + '</div><div class="wf-path">' + esc(w.path) + '</div></div><span class="wf-state ' + (w.state === 'active' ? 'active' : '') + '">' + esc(w.state) + '</span></div>';
      }
      wfList.innerHTML = html;
      wfList.querySelectorAll('.wf-item').forEach(item => {
        item.onclick = () => {
          wfList.querySelectorAll('.wf-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedWf = item.dataset.wf;
          triggerBtn.disabled = false;
          inputsSection.style.display = '';
          if (!inputsBox.children.length) addInputRow();
        };
      });
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      wfList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
      toast('加载工作流失败', 'error');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '加载工作流';
    }
  };

  triggerBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo || !selectedWf) return;
    const [owner, repoName] = repo.split('/');
    // 收集 inputs
    const inputs = {};
    inputsBox.querySelectorAll('.input-row').forEach(row => {
      const k = row.querySelector('.input-key').value.trim();
      const v = row.querySelector('.input-val').value;
      if (k) inputs[k] = v;
    });
    triggerBtn.disabled = true; triggerBtn.textContent = '触发中…';
    resultBox.className = 'result-box';
    try {
      const data = await api('/api/tools/dispatch', {
        method: 'POST',
        body: JSON.stringify({ owner, repo: repoName, workflow_id: selectedWf, ref: $('dispatchRef').value.trim() || 'main', inputs }),
        headers: { 'Content-Type': 'application/json' },
      });
      resultBox.className = 'result-box show success';
      resultBox.textContent = '✓ ' + data.message + '（' + selectedWf + ' @ ' + (data.ref || 'main') + '）';
      toast('已触发', 'success');
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
    inputsBox.querySelectorAll('.input-row').forEach(row => {
      const k = row.querySelector('.input-key').value.trim();
      const v = row.querySelector('.input-val').value;
      if (k) inputs.push([k, v]);
    });
    const configs = JSON.parse(localStorage.getItem('kbox_dispatch_configs') || '[]');
    configs.push({ repo, workflow_id: selectedWf, ref: $('dispatchRef').value.trim() || 'main', inputs });
    localStorage.setItem('kbox_dispatch_configs', JSON.stringify(configs));
    renderSavedConfigs();
    toast('配置已保存', 'success');
  };
}

// ─── 工具函数 ───
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
