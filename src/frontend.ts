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
  --fm-bg: #ffffff;
  --fm-hover: #f0f2f5;
  --fm-border: #e2e8f0;
  --fm-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
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
    --fm-bg: #1e293b;
    --fm-hover: #334155;
    --fm-border: #334155;
    --fm-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
}
html[data-theme="dark"] {
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
  --fm-bg: #1e293b;
  --fm-hover: #334155;
  --fm-border: #334155;
  --fm-shadow: 0 8px 32px rgba(0,0,0,0.5);
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
.token-bar .token-group { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.token-bar .token-group input {
  width: 200px; padding: 9px 14px; border: 1px solid var(--border); border-radius: 999px;
  font-size: 14px; outline: none; transition: border-color 0.2s, background 0.3s; background: var(--input-bg); color: var(--text);
}
.token-bar .token-group input:focus { border-color: var(--primary); }
.token-bar .token-group input:disabled { display: none; }
.token-bar .btn-verify {
  padding: 9px 24px; border: none; border-radius: 999px; font-size: 14px; font-weight: 500;
  cursor: pointer; background: var(--primary); color: #fff; transition: background 0.2s, opacity 0.2s; white-space: nowrap;
}
.token-bar .btn-verify:hover:not(:disabled) { background: var(--primary-hover); }
.token-bar .btn-verify:disabled { opacity: 0.6; cursor: not-allowed; }
.token-bar .btn-verify.ok { background: var(--success); }
.token-bar .btn-verify.err { background: var(--danger); }
.token-bar .btn-verify.loading { opacity: 0.75; }
.token-bar .btn-verify.logout { cursor: pointer; }
.token-bar .btn-verify.logout:hover { filter: brightness(1.1); }

/* 三态主题切换（令牌栏右侧） */
.theme-switcher { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 3px; gap: 2px; }
.theme-switcher button {
  background: none; border: none; padding: 5px 9px; border-radius: 999px; cursor: pointer; font-size: 14px; color: var(--text-muted);
  transition: background 0.15s, color 0.15s; line-height: 1;
}
.theme-switcher button.active { background: var(--primary); color: #fff; }
.theme-switcher button:hover:not(.active) { color: var(--text); }

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
.tool-grid.view-compact { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.tool-grid.view-list { display: flex; flex-direction: column; gap: 8px; }

/* ─── 首页加载动画（读取布局偏好期间掩盖布局突变）─── */
.home-grid-wrap { position: relative; }
.home-loader {
  position: fixed; inset: 0; z-index: 1500;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
  background: var(--bg);
  transition: opacity 0.25s ease;
}
.home-loader.hide { opacity: 0; pointer-events: none; }
.home-loader .spinner {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid var(--border); border-top-color: var(--primary);
  animation: homeSpin 0.8s linear infinite;
}
@keyframes homeSpin { to { transform: rotate(360deg); } }
.tool-card {
  background: var(--card); border-radius: 12px; padding: 24px; cursor: pointer;
  box-shadow: var(--shadow); transition: box-shadow 0.2s, transform 0.2s, background 0.3s;
  border: 1px solid transparent; position: relative;
}
.tool-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); border-color: var(--primary); }
.tool-card .tool-icon { font-size: 32px; margin-bottom: 12px; }
.tool-card .tool-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.tool-card .tool-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

/* 紧凑视图 */
.tool-grid.view-compact .tool-card { padding: 16px; text-align: center; }
.tool-grid.view-compact .tool-card .tool-icon { font-size: 26px; margin-bottom: 8px; }
.tool-grid.view-compact .tool-card .tool-name { font-size: 14px; margin-bottom: 0; }
.tool-grid.view-compact .tool-card .tool-desc { display: none; }

/* 列表视图 */
.tool-grid.view-list .tool-card { display: flex; align-items: center; gap: 16px; padding: 14px 18px; }
.tool-grid.view-list .tool-card .tool-icon { font-size: 22px; margin-bottom: 0; flex-shrink: 0; }
.tool-grid.view-list .tool-card .tool-name { font-size: 15px; margin-bottom: 0; flex-shrink: 0; min-width: 140px; }
.tool-grid.view-list .tool-card .tool-desc { flex: 1; font-size: 13px; }

/* 编辑模式 */
.tool-card.editing { cursor: default; }
.tool-card-actions {
  position: absolute; top: 8px; right: 8px; display: none; gap: 4px;
}
.tool-card.editing .tool-card-actions { display: flex; }
.tool-card-actions button {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  width: 28px; height: 28px; cursor: pointer; font-size: 13px; color: var(--text-secondary);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool-card-actions button:hover { background: var(--primary); color: #fff; border-color: var(--primary); }

/* 通用图标方按钮（排序 ↑↓ 等，与首页卡片操作按钮同款） */
.icon-btn {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  width: 28px; height: 28px; cursor: pointer; font-size: 13px; color: var(--text-secondary);
  display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0;
}
.icon-btn:hover:not(:disabled) { background: var(--primary); color: #fff; border-color: var(--primary); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-card.hidden-tool { opacity: 0.45; }
.tool-card.hidden-tool .tool-name::after { content: ' (已隐藏)'; font-size: 11px; color: var(--text-muted); font-weight: 400; }

/* 首页工具栏 */
.home-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
}
.view-switcher {
  display: inline-flex; background: var(--card); border: 1px solid var(--border);
  border-radius: 8px; padding: 3px; gap: 2px;
}
.view-switcher button {
  background: none; border: none; padding: 6px 10px; border-radius: 6px;
  cursor: pointer; font-size: 13px; color: var(--text-secondary);
}
.view-switcher button.active { background: var(--primary); color: #fff; }
.home-toolbar .right-group { display: flex; gap: 8px; align-items: center; }

/* ─── 工具视图 ─── */
.tool-view { display: none; }
.tool-view > h2 { padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.tool-view.active { display: block; }

/* ─── 常驻浮动返回按钮 ─── */
.float-back {
  position: fixed; left: 24px; z-index: 1500;
  width: 48px; height: 48px; border-radius: 50%; border: none;
  background: var(--primary); color: #fff; cursor: pointer;
  display: none; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
  transition: background 0.2s, box-shadow 0.2s, top 0.2s ease;
}
.float-back:hover { background: var(--primary-hover); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5); }
.float-back.show { display: inline-flex; }
body:has(.disk-modal-overlay.show) .float-back { display: none !important; }

/* ─── 右侧浮动菜单按钮 + 面板 ─── */
.float-menu-btn {
  position: fixed; right: 24px; z-index: 1500;
  width: 48px; height: 48px; border-radius: 50%; border: none;
  background: var(--primary); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
  transition: background 0.2s, box-shadow 0.2s, top 0.2s ease, transform 0.2s;
}
.float-menu-btn:hover { background: var(--primary-hover); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5); }
.float-menu-btn.active { background: var(--primary-hover); }
.float-menu-btn svg { width: 22px; height: 22px; }
.float-menu-panel {
  position: fixed; right: 24px; z-index: 1499;
  min-width: 200px; background: var(--fm-bg); border: 1px solid var(--fm-border);
  border-radius: 14px; box-shadow: var(--fm-shadow); padding: 10px;
  display: none;
}
.float-menu-panel.show { display: block; animation: fmIn 0.18s ease; }
@keyframes fmIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.float-menu-section { padding: 6px 0; border-bottom: 1px solid var(--fm-border); }
.float-menu-section:last-child { border-bottom: none; }
.float-menu-label { font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 4px 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.float-menu-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px;
  cursor: pointer; font-size: 14px; color: var(--text); transition: background 0.12s;
}
.float-menu-item:hover { background: var(--fm-hover); }
.float-menu-item .icon { width: 20px; text-align: center; }
.float-menu-item .right { margin-left: auto; font-size: 12px; color: var(--text-muted); }
.float-menu-view-switcher { display: flex; gap: 2px; padding: 4px 10px; }
.float-menu-view-switcher button {
  flex: 1; padding: 6px 0; border: 1px solid var(--fm-border); border-radius: 8px;
  background: var(--bg); color: var(--text-secondary); cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.float-menu-view-switcher button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.float-menu-view-switcher button:hover:not(.active) { border-color: var(--primary); color: var(--primary); }
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
  .token-bar .token-group { gap: 6px; }
  .token-bar .token-group input { width: 140px; font-size: 13px; padding: 8px 10px; }
  .token-bar .btn-verify { padding: 8px 14px; font-size: 13px; }
  .container { padding: 24px 16px 60px; }
  .tool-grid { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; align-items: stretch; }
  .float-menu-btn, .float-menu-panel { right: 16px; }
  .float-menu-panel { min-width: 170px; }
  .float-menu-view-switcher { padding: 4px 6px; }
  .float-menu-view-switcher button { font-size: 12px; padding: 5px 0; }
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

/* ─── DB 管理工具（adminer 风格） ─── */
.db-topbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.db-topbar select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 14px; min-width: 200px; outline: none; }
.db-topbar select:focus { border-color: var(--primary); }
.db-layout { display: grid; grid-template-columns: 240px 1fr; gap: 14px; }
.db-sidebar { background: var(--card); border-radius: 10px; padding: 8px; box-shadow: var(--shadow); max-height: 72vh; overflow-y: auto; position: sticky; top: 12px; }
/* 标题可点击折叠：左侧"表 ▸/▾"，右侧"+ 新建" */
.db-sidebar-title { font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 6px 8px 4px; text-transform: uppercase; letter-spacing: 0.6px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.db-sidebar-toggle { cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none; }
.db-sidebar-toggle::before { content: '▾'; font-size: 10px; transition: transform 0.15s; display: inline-block; }
.db-sidebar.collapsed .db-sidebar-toggle::before { transform: rotate(-90deg); }
.db-sidebar.collapsed #dbTablesList,
.db-sidebar.collapsed #dbTablesEmpty { display: none; }
.db-sidebar.collapsed { max-height: none; overflow: visible; }
.db-sidebar-title .db-new-table { font-size: 11px; cursor: pointer; color: var(--primary); font-weight: 600; text-transform: none; letter-spacing: 0; }
.db-table-item { padding: 7px 10px; border-radius: 6px; font-size: 13px; cursor: pointer; color: var(--text); display: flex; align-items: center; gap: 6px; transition: background 0.12s; font-family: var(--font-mono, monospace); }
.db-table-item:hover { background: var(--bg); }
.db-table-item.active { background: var(--primary); color: #fff; }
.db-table-item .db-t-count { margin-left: auto; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono, monospace); }
.db-table-item.active .db-t-count { color: rgba(255,255,255,0.75); }
/* 移动端：竖向堆叠，sidebar 折叠成一行标题，点击展开 */
@media (max-width: 768px) {
  .db-layout { grid-template-columns: 1fr; gap: 10px; }
  .db-sidebar { position: static; max-height: none; overflow: visible; padding: 6px 8px; }
  .db-sidebar:not(.collapsed) { max-height: 60vh; overflow-y: auto; }
  .db-topbar select { min-width: 0; flex: 1; }
  .db-results-scroll { max-height: 50vh; }
}
.db-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.db-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 4px; flex-wrap: wrap; }
.db-tab { padding: 8px 16px; font-size: 13px; cursor: pointer; color: var(--text-muted); border: none; background: none; border-bottom: 2px solid transparent; transition: all 0.15s; font-weight: 500; }
.db-tab:hover { color: var(--text); }
.db-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.db-tab-badge { font-size: 11px; margin-left: 4px; padding: 1px 6px; border-radius: 10px; background: var(--bg); color: var(--text-muted); }
.db-tab.active .db-tab-badge { background: rgba(99,102,241,0.15); color: var(--primary); }
.db-panel { display: none; }
.db-panel.active { display: block; }
.db-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.db-meta { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.db-editor { width: 100%; min-height: 180px; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.5; resize: vertical; outline: none; tab-size: 2; }
.db-editor:focus { border-color: var(--primary); }
.sql-editor { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.5; resize: vertical; outline: none; tab-size: 2; box-sizing: border-box; }
.sql-editor:focus { border-color: var(--primary); }
.sql-output { background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto; margin: 8px 0; }
/* 通用数据表格（cron/js 等管理页） */
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--card); border-radius: 10px; overflow: hidden; box-shadow: var(--shadow); }
.data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: middle; }
.data-table th { background: var(--bg); color: var(--text-secondary); font-weight: 600; font-size: 12px; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--bg); }
.data-table .row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.data-table .row-actions .btn { font-size: 12px; padding: 4px 10px; }
/* 徽标 */
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--input-bg); color: var(--text-muted); }
.badge-ok { background: rgba(34,197,94,0.15); color: var(--success); }
.badge-err { background: rgba(239,68,68,0.15); color: var(--danger); }
/* 复选框：主题色 + 水平对齐 */
input[type="checkbox"] { accent-color: var(--primary); width: 16px; height: 16px; cursor: pointer; vertical-align: middle; margin: 0; }
.check-row { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }

/* cron 触发小时选择网格 */
.hour-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; margin-top: 4px; }
.hour-chip { position: relative; cursor: pointer; }
.hour-chip input { position: absolute; opacity: 0; pointer-events: none; }
.hour-chip span { display: block; text-align: center; padding: 4px 0; font-size: 12px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-secondary); background: var(--bg); transition: all .12s; }
.hour-chip input:checked + span { background: var(--primary); color: #fff; border-color: var(--primary); }
.hour-chip:hover span { border-color: var(--primary); }
.check-row input { margin: 0; }
.db-results-wrap { background: var(--card); border-radius: 10px; box-shadow: var(--shadow); overflow: hidden; }
.db-results-head { padding: 10px 14px; font-size: 12px; color: var(--text-muted); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.db-results-scroll { max-height: 56vh; overflow: auto; }
.db-results-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.db-results-table th, .db-results-table td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.db-results-table th { position: sticky; top: 0; background: var(--bg); color: var(--text-secondary); font-weight: 600; z-index: 1; }
.db-results-table th.db-th-sort { cursor: pointer; color: var(--primary); }
.db-results-table th.db-th-sort::after { content: ' ▲'; font-size: 10px; }
.db-results-table th.db-th-sort.desc::after { content: ' ▼'; }
.db-results-table td { color: var(--text); }
.db-results-table tr:hover td { background: var(--bg); }
.db-results-table .db-th-actions, .db-results-table .db-td-actions { position: sticky; right: 0; background: var(--card); border-left: 1px solid var(--border); width: 88px; min-width: 88px; }
.db-results-table tr:hover .db-td-actions { background: var(--bg); }
.db-results-table .db-row-actions { display: flex; gap: 8px; font-size: 12px; }
.db-results-table .db-row-actions a { color: var(--primary); cursor: pointer; text-decoration: none; }
.db-results-table .db-row-actions a.db-del { color: var(--danger); }
.db-cell-null { color: var(--text-muted); font-style: italic; }
.db-cell-num { color: var(--primary); font-family: var(--font-mono, monospace); font-size: 12px; }
.db-pagination { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.db-pagination button { padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 12px; }
.db-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.db-pagination .db-page-size { margin-left: auto; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-size: 12px; }
.db-filter-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; font-size: 12px; }
.db-filter-row input, .db-filter-row select { padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); font-size: 12px; outline: none; }
.db-filter-row input:focus, .db-filter-row select:focus { border-color: var(--primary); }
.db-schema-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.db-schema-table th, .db-schema-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; }
.db-schema-table th { background: var(--bg); color: var(--text-secondary); font-weight: 600; font-size: 12px; }
.db-schema-table .db-pk { color: var(--primary); font-weight: 700; }
.db-schema-table .db-type { color: var(--text-muted); font-family: var(--font-mono, monospace); font-size: 12px; }
.db-ddl { background: var(--bg); border-radius: 8px; padding: 12px; font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text); border: 1px solid var(--border); }
.db-conn-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.db-conn-row { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); }
.db-conn-row .db-conn-name { font-weight: 600; font-size: 14px; }
.db-conn-row .db-conn-url { font-size: 12px; color: var(--text-muted); font-family: var(--font-mono, monospace); word-break: break-all; }
.db-conn-row .db-conn-actions { margin-left: auto; display: flex; gap: 6px; flex-shrink: 0; }
.db-empty-hint { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 14px; }
.db-form-grid { display: grid; grid-template-columns: 140px 1fr; gap: 8px 12px; align-items: center; }
.db-form-grid label { font-size: 13px; color: var(--text-secondary); font-weight: 500; word-break: break-all; }
.db-form-grid input, .db-form-grid textarea { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); font-size: 13px; outline: none; font-family: var(--font-mono, monospace); }
.db-form-grid input:focus, .db-form-grid textarea:focus { border-color: var(--primary); }
.db-form-grid textarea { min-height: 60px; resize: vertical; }
.db-form-pk-hint { font-size: 11px; color: var(--primary); margin-left: 6px; }
/* 可视化建表列编辑器 */
.db-cols-head { display: grid; grid-template-columns: 1.4fr 1fr 0.6fr 1.6fr 1.2fr 32px; gap: 6px; padding: 0 4px 6px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.db-col-row { display: grid; grid-template-columns: 1.4fr 1fr 0.6fr 1.6fr 1.2fr 32px; gap: 6px; padding: 4px; align-items: center; border-bottom: 1px solid var(--border); }
.db-col-row input, .db-col-row select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); font-size: 12px; outline: none; font-family: var(--font-mono, monospace); width: 100%; min-width: 0; }
.db-col-row input:focus, .db-col-row select:focus { border-color: var(--primary); }
.db-col-attrs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.db-col-attrs label { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
.db-col-attrs input[type="checkbox"] { width: auto; }
.db-col-del { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
@media (max-width: 768px) {
  .db-cols-head { display: none; }
  .db-col-row { grid-template-columns: 1fr 1fr; gap: 6px; }
  .db-col-row > *:nth-child(n) { grid-column: span 1; }
  .db-col-row .db-col-attrs, .db-col-row .db-col-del { grid-column: span 2; }
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

<!-- 常驻浮动返回按钮：仅在工具子页可见 -->
<button class="float-back" id="floatBack" onclick="backToGrid()" title="返回首页" aria-label="返回首页">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
  </svg>
</button>

<!-- 右侧浮动菜单按钮 -->
<button class="float-menu-btn" id="floatMenuBtn" title="菜单" aria-label="菜单">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/>
  </svg>
</button>

<!-- 右侧浮动菜单面板 -->
<div class="float-menu-panel" id="floatMenuPanel">
  <div class="float-menu-section" id="fmViewSection">
    <div class="float-menu-label">视图</div>
    <div class="float-menu-view-switcher" id="fmViewSwitcher">
      <button data-mode="grid" title="大图标">▦</button>
      <button data-mode="compact" title="小图标">≡</button>
      <button data-mode="list" title="详细">☰</button>
    </div>
  </div>
  <div class="float-menu-section">
    <div class="float-menu-label">操作</div>
    <div class="float-menu-item" id="fmEditBtn">
      <span class="icon">✎</span><span>自定义布局</span>
    </div>
    <div class="float-menu-item" id="fmExitEditBtn" style="display:none">
      <span class="icon">✓</span><span>完成编辑</span>
    </div>
  </div>
  <div class="float-menu-section" id="fmThemeSection">
    <div class="float-menu-label">主题</div>
    <div class="theme-switcher" id="fmThemeSwitcher" style="margin:4px 10px">
      <button data-theme="light" title="亮色">☀️</button>
      <button data-theme="auto" title="跟随">🖥️</button>
      <button data-theme="dark" title="暗色">🌙</button>
    </div>
  </div>
</div>

<!-- 主页：工具网格 -->
<div class="container" id="mainContent">
  <div class="home-grid-wrap" id="homeGridWrap">
    <div class="home-loader" id="homeLoader">
      <div class="spinner"></div>
      <span>加载中…</span>
    </div>
    <div class="tool-grid" id="toolGrid"></div>
  </div>
  <div id="toolViews"></div>
</div>

<!-- 工具卡片编辑弹层（改名/改图标/隐藏）-->
<div class="disk-modal-overlay" id="toolEditOverlay">
  <div class="disk-modal" style="max-width:420px">
    <div class="disk-modal-header">
      <h3>编辑工具</h3>
      <button class="disk-modal-close" onclick="closeToolEdit()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="form-group">
        <label>名称</label>
        <input type="text" id="toolEditName" autocomplete="off" spellcheck="false">
      </div>
      <div class="form-group">
        <label>图标</label>
        <div id="toolEditIconPicker" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
        <input type="text" id="toolEditIconInput" placeholder="输入 emoji" autocomplete="off" spellcheck="false">
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="toolEditHidden" style="width:auto">
          <span>在首页隐藏此工具（仍可通过 URL 访问）</span>
        </label>
      </div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" onclick="closeToolEdit()">取消</button>
      <button class="btn btn-primary" id="toolEditSave">保存</button>
    </div>
  </div>
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

function setVerifiedState() {
  tokenInput.disabled = true;
  setBtnStatus('✓ 已验证', 'ok logout', false);
  verifyBtn.onclick = confirmLogout;
}

function resetVerifiedState() {
  tokenInput.disabled = false;
  setBtnStatus('验证', '', false);
  verifyBtn.onclick = verifyToken;
}

function confirmLogout() {
  if (confirm('是否退出？')) {
    localStorage.removeItem('kbox_token');
    token = '';
    resetVerifiedState();
    mainContent.classList.remove('active');
    toast('已退出', 'info');
  }
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
      setVerifiedState();
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
    localStorage.removeItem('kbox_token');
    tokenInput.disabled = false;
    setBtnStatus('✗ 已失效', 'err');
    mainContent.classList.remove('active');
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

// ─── 主题系统 ───
const THEME_KEY = 'kbox_theme';

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
  document.querySelectorAll('[id$="ThemeSwitcher"]').forEach(sw => {
    if (!sw) return;
    sw.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-theme') === theme);
    });
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(saved);
  updateThemeButtons(saved);
}

// 浮动菜单按钮：面板展开/关闭 + 主题切换绑定（与令牌验证状态无关，需尽早绑定）
function bindFloatMenu() {
  // 主题切换绑定（浮动菜单内）
  document.querySelectorAll('[id$="ThemeSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => setTheme(b.getAttribute('data-theme')));
    });
  });
  // 浮动菜单按钮
  const fmb = $('floatMenuBtn');
  const fmp = $('floatMenuPanel');
  if (fmb && fmp) {
    fmb.addEventListener('click', (e) => {
      e.stopPropagation();
      fmp.classList.toggle('show');
      fmb.classList.toggle('active', fmp.classList.contains('show'));
    });
    document.addEventListener('click', (e) => {
      if (!fmp.classList.contains('show')) return;
      if (fmp.contains(e.target) || fmb.contains(e.target)) return;
      fmp.classList.remove('show');
      fmb.classList.remove('active');
    });
  }
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
// 注意：name/icon 是默认值，用户偏好（preferences/home_layout）会覆盖
const TOOLS = [
  { id: 'dispatch', name: 'GitHub Actions', icon: '⚡', desc: '触发 GitHub 工作流', render: renderDispatchTool, mount: mountDispatchTool },
  { id: 'disk', name: '微型云盘', icon: '☁️', desc: '轻量文件存储，单文件 10MB', render: renderDiskTool, mount: mountDiskTool },
  { id: 'stock', name: '基金估值', icon: '💰', desc: '多市场基金持仓估值', render: renderStockTool, mount: mountStockTool },
  { id: 'news', name: 'AI 新闻锐评', icon: '📰', desc: '抓取科技新闻并由 AI 写锐评', render: renderNewsTool, mount: mountNewsTool },
  { id: 'db-admin', name: 'DB 管理', icon: '🗄️', desc: '浏览与编辑数据库', render: renderDbAdminTool, mount: mountDbAdminTool },
  { id: 'js', name: 'JS 运行工具', icon: '📜', desc: '运行自定义 JS 脚本', render: renderJsTool, mount: mountJsTool },
  { id: 'cron', name: '定时任务', icon: '⏰', desc: '定时执行任务', render: renderCronTool, mount: mountCronTool },
  { id: 'config', name: '配置管理', icon: '⚙️', desc: '管理 API 密钥与工具配置', render: renderConfigTool, mount: mountConfigTool },
];

// ─── 首页布局偏好 ───
// 结构：{ viewMode: 'grid'|'compact'|'list', order: [toolId...], overrides: { toolId: { name?, icon?, hidden? } } }
let homeLayout = { viewMode: 'grid', order: [], overrides: {} };
let editMode = false;
// 已发布 JS 脚本（动态注入首页卡片）
let publishedScripts = [];

// 取工具的显示名/图标（应用用户覆盖）
function findScriptById(id) {
  const m = id.match(/^script:(.+)$/);
  if (!m) return null;
  return publishedScripts.find(s => s.id === m[1]) || null;
}
function toolName(id) {
  if (homeLayout.overrides[id]?.name) return homeLayout.overrides[id].name;
  const t = TOOLS.find(t => t.id === id);
  if (t) return t.name;
  const s = findScriptById(id);
  if (s) return s.name;
  return id;
}
function toolIcon(id) {
  if (homeLayout.overrides[id]?.icon) return homeLayout.overrides[id].icon;
  const t = TOOLS.find(t => t.id === id);
  if (t) return t.icon;
  const s = findScriptById(id);
  if (s) return s.icon;
  return '□';
}
function toolHidden(id) { return !!homeLayout.overrides[id]?.hidden; }
function toolDesc(id) {
  const t = TOOLS.find(t => t.id === id);
  if (t) return t.desc;
  const s = findScriptById(id);
  if (s) return s.desc || '用户脚本';
  return '';
}

// 所有可用工具 id（静态 TOOLS + 已发布脚本）
function allToolIds() {
  const ids = TOOLS.map(t => t.id);
  for (const s of publishedScripts) {
    ids.push('script:' + s.id);
  }
  return ids;
}

// 按偏好顺序排列工具，未在 order 里的补到末尾
function orderedTools() {
  const ids = allToolIds();
  const ordered = [];
  for (const id of homeLayout.order) {
    if (ids.includes(id)) ordered.push(id);
  }
  for (const id of ids) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

function renderToolGrid() {
  // 设置视图模式 class
  toolGrid.className = 'tool-grid view-' + homeLayout.viewMode;
  const ids = orderedTools();
  let html = '';
  for (const id of ids) {
    const name = esc(toolName(id));
    const icon = toolIcon(id);
    const desc = esc(toolDesc(id));
    const hiddenCls = toolHidden(id) ? ' hidden-tool' : '';
    const editCls = editMode ? ' editing' : '';
    const clickAttr = editMode ? '' : ' onclick="showTool(\\'' + id + '\\')"';
    const actions = editMode
      ? '<div class="tool-card-actions">' +
        '<button title="编辑" onclick="event.stopPropagation();openToolEdit(\\'' + id + '\\')">✎</button>' +
        '<button title="上移" onclick="event.stopPropagation();moveTool(\\'' + id + '\\',-1)">↑</button>' +
        '<button title="下移" onclick="event.stopPropagation();moveTool(\\'' + id + '\\',1)">↓</button>' +
        '</div>'
      : '';
    html += '<div class="tool-card' + hiddenCls + editCls + '" data-id="' + id + '"' + clickAttr + '>' +
      '<div class="tool-icon">' + icon + '</div>' +
      '<div class="tool-name">' + name + '</div>' +
      '<div class="tool-desc">' + desc + '</div>' +
      actions +
      '</div>';
  }
  toolGrid.innerHTML = html;
}

// 上移/下移
window.moveTool = function(id, dir) {
  const order = orderedTools();
  const i = order.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  homeLayout.order = order;
  saveHomeLayout();
  renderToolGrid();
};

// 保存首页布局到偏好
async function saveHomeLayout() {
  try {
    await api('/api/preferences/home_layout', {
      method: 'PUT',
      body: JSON.stringify({ value: homeLayout }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') toast('布局保存失败：' + e.message, 'error');
  }
}

// 加载首页布局
async function loadHomeLayout() {
  try {
    const data = await api('/api/preferences/home_layout');
    if (data.value && typeof data.value === 'object') {
      homeLayout = {
        viewMode: data.value.viewMode === 'compact' || data.value.viewMode === 'list' ? data.value.viewMode : 'grid',
        order: Array.isArray(data.value.order) ? data.value.order : [],
        overrides: data.value.overrides && typeof data.value.overrides === 'object' ? data.value.overrides : {},
      };
    }
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') console.error('load home layout failed', e);
  }
  // 应用视图模式按钮高亮
  document.querySelectorAll('[id$="ViewSwitcher"] button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === homeLayout.viewMode);
  });
  // 加载已发布脚本（会触发 renderToolGrid）
  await loadPublishedScripts();
}

// 视图切换与编辑模式按钮绑定
function bindHomeToolbar() {
  // 视图切换（浮动菜单 + 令牌栏双源）
  function onViewModeChange(mode) {
    homeLayout.viewMode = mode;
    document.querySelectorAll('[id$="ViewSwitcher"] button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    saveHomeLayout();
    renderToolGrid();
  }
  document.querySelectorAll('[id$="ViewSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => onViewModeChange(btn.getAttribute('data-mode')));
    });
  });
  // 自定义/完成按钮（浮动菜单 + 令牌栏双源）
  function setEditModeUI(on) {
    editMode = on;
    const fmEdit = $('fmEditBtn');
    const fmExit = $('fmExitEditBtn');
    if (fmEdit) fmEdit.style.display = on ? 'none' : 'flex';
    if (fmExit) fmExit.style.display = on ? 'flex' : 'none';
    renderToolGrid();
  }
  const fmEditBtn = $('fmEditBtn');
  const fmExitEditBtn = $('fmExitEditBtn');
  if (fmEditBtn) fmEditBtn.addEventListener('click', () => setEditModeUI(true));
  if (fmExitEditBtn) fmExitEditBtn.addEventListener('click', () => setEditModeUI(false));
  // 主题切换与浮动菜单按钮的展开/关闭已在 bindFloatMenu() 中尽早绑定，此处无需重复
}

// ─── 工具卡片编辑弹层 ───
const EMOJI_CHOICES = ['⚡','☁️','💰','📰','🗄️','⚙️','🔧','📊','📅','🎯','🚀','📦','🔍','📈','💡','🛠️','🌐','📝','🔔','📁'];
let editingToolId = null;

window.openToolEdit = function(id) {
  editingToolId = id;
  const defaultName = toolName(id);
  const hasOverride = !!homeLayout.overrides[id]?.name;
  $('toolEditName').value = hasOverride ? defaultName : '';
  $('toolEditName').placeholder = defaultName;
  $('toolEditIconInput').value = (homeLayout.overrides[id]?.icon) || '';
  $('toolEditHidden').checked = toolHidden(id);
  // 渲染 emoji 选择器
  $('toolEditIconPicker').innerHTML = EMOJI_CHOICES.map(e =>
    '<span style="font-size:22px;cursor:pointer;padding:4px 6px;border-radius:6px" onmouseover="this.style.background=\\'var(--bg)\\'" onmouseout="this.style.background=\\'none\\'" onclick="pickEmoji(\\'' + e + '\\')">' + e + '</span>'
  ).join('');
  $('toolEditOverlay').classList.add('show');
};

window.pickEmoji = function(e) {
  $('toolEditIconInput').value = e;
};

window.closeToolEdit = function() {
  $('toolEditOverlay').classList.remove('show');
  editingToolId = null;
};

$('toolEditOverlay')?.addEventListener('click', (e) => { if (e.target === $('toolEditOverlay')) closeToolEdit(); });

$('toolEditSave')?.addEventListener('click', async () => {
  if (!editingToolId) return;
  const id = editingToolId;
  const name = $('toolEditName').value.trim();
  const icon = $('toolEditIconInput').value.trim();
  const hidden = $('toolEditHidden').checked;
  // 清理：与默认值相同的覆盖删除（避免存冗余）
  const defaultName = toolName(id);
  const defaultIcon = toolIcon(id);
  // 取未覆盖时的默认值：用 findScriptById 或 TOOLS 还原原始默认
  let origName = defaultName, origIcon = defaultIcon;
  const t = TOOLS.find(t => t.id === id);
  if (t) { origName = t.name; origIcon = t.icon; }
  else {
    const s = findScriptById(id);
    if (s) { origName = s.name; origIcon = s.icon; }
  }
  const ov = {};
  if (name && name !== origName) ov.name = name;
  if (icon && icon !== origIcon) ov.icon = icon;
  if (hidden) ov.hidden = true;
  if (Object.keys(ov).length === 0) {
    delete homeLayout.overrides[id];
  } else {
    homeLayout.overrides[id] = ov;
  }
  await saveHomeLayout();
  closeToolEdit();
  renderToolGrid();
  toast('已保存', 'success');
});

function initTools() {
  renderToolGrid();
  let views = '';
  for (const t of TOOLS) {
    views += '<div class="tool-view" id="view-' + t.id + '">' + t.render() + '</div>';
  }
  toolViews.innerHTML = views;
  for (const t of TOOLS) { t.mount(); }
  bindHomeToolbar();
  // 加载布局偏好期间显示加载动画，掩盖默认布局与最终布局的突变
  loadHomeLayout().finally(() => {
    const loader = $('homeLoader');
    if (loader) {
      loader.classList.add('hide');
      setTimeout(() => loader.remove(), 300);
    }
  });
}

window.showTool = function(id) {
  toolGrid.style.display = 'none';
  const hgw = $('homeGridWrap');
  if (hgw) hgw.style.display = 'none';
  const allViews = document.querySelectorAll('.tool-view');
  allViews.forEach(v => v.classList.remove('active'));
  const target = $('view-' + id);
  if (target) target.classList.add('active');
  $('floatBack').classList.add('show');
  // 进入子页时关闭浮动菜单面板
  $('floatMenuPanel')?.classList.remove('show');
  $('floatMenuBtn')?.classList.remove('active');
}

window.backToGrid = function() {
  const allViews = document.querySelectorAll('.tool-view');
  allViews.forEach(v => v.classList.remove('active'));
  toolGrid.style.display = 'grid';
  const hgw = $('homeGridWrap');
  if (hgw) hgw.style.display = '';
  $('floatBack').classList.remove('show');
  $('floatMenuPanel')?.classList.remove('show');
  $('floatMenuBtn')?.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 浮动按钮定位：监听滚动/缩放，钉在可视区域底部
(function() {
  const fb = document.getElementById('floatBack');
  const fm = document.getElementById('floatMenuBtn');
  if (!fb && !fm) return;
  function pinFloatButtons() {
    const top = window.innerHeight - 48 - 24;
    const pinTop = Math.max(24, top) + 'px';
    if (fb && fb.classList.contains('show')) fb.style.top = pinTop;
    if (fm) fm.style.top = pinTop;
  }
  window.addEventListener('scroll', pinFloatButtons, { passive: true });
  window.addEventListener('resize', pinFloatButtons);
  if (fb) {
    const obs = new MutationObserver(pinFloatButtons);
    obs.observe(fb, { attributes: true, attributeFilter: ['class'] });
  }
  pinFloatButtons();
})();

// ═══ 工具 1：GitHub Workflow Dispatch ═══
function renderDispatchTool() {
  return \`
    <h2>⚡ GitHub Actions 触发</h2>
    <div class="saved-configs" id="dispatchSavedConfigs"></div>
    <div class="form-row">
      <div class="form-group">
        <label>仓库</label>
        <input type="text" id="dispatchRepo" placeholder="user/repo 或粘贴 GitHub 链接">
      </div>
      <button class="btn btn-outline" id="dispatchLoadBtn" style="margin-bottom:0">加载</button>
    </div>
    <div class="form-group" id="dispatchBranchGroup" style="display:none">
      <label>分支</label>
      <select id="dispatchBranch"></select>
      <div id="dispatchCommitInfo" style="font-size:12px;color:var(--text-muted);margin-top:6px"></div>
    </div>
    <div class="section-title" id="dispatchWfTitle" style="display:none">选择工作流</div>
    <div class="wf-list" id="dispatchWfList"></div>
    <div id="dispatchInputsSection" style="display:none">
      <div class="section-title" id="dispatchInputsTitle">输入参数</div>
      <div id="dispatchInputs"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;margin-bottom:16px;flex-wrap:wrap">
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

  // 渲染分支最新 commit 信息
  const commitInfoEl = $('dispatchCommitInfo');
  function renderCommitInfo(commit) {
    if (!commit || !commit.sha) {
      commitInfoEl.textContent = '';
      return;
    }
    const sha = commit.sha.substring(0, 7);
    const date = commit.date ? formatDate(commit.date.replace('T', ' ').replace('Z', '')) : '';
    commitInfoEl.innerHTML =
      '<span style="opacity:0.7">最新</span> ' +
      esc(commit.message) + ' · ' +
      '<a href="' + esc(commit.url) + '" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">' + sha + '</a>' +
      (date ? ' · ' + date : '') +
      (commit.author ? ' · ' + esc(commit.author) : '');
  }

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
      // 并行加载工作流、分支和默认分支 commit 信息
      const defaultBranch = 'main';
      const [wfData, branchData, commitData] = await Promise.all([
        api('/api/tools/workflows?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/tools/branches?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/tools/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(defaultBranch)),
      ]);

      // 渲染分支
      const branches = branchData.branches || [];
      if (branches.length) {
        branchGroup.style.display = '';
        branchSelect.innerHTML = branches.map(b =>
          '<option value="' + esc(b.name) + '"' + (b.name === 'main' ? ' selected' : '') + '>' + esc(b.name) + '</option>'
        ).join('');
      }

      // 显示默认分支最新 commit
      renderCommitInfo(commitData.commit);

      // 分支切换时更新 commit 信息
      branchSelect.onchange = () => {
        const selectedBranch = branchSelect.value;
        api('/api/tools/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(selectedBranch))
          .then(d => renderCommitInfo(d.commit))
          .catch(() => {});
      };

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
          inputsTitle.textContent = '输入参数';

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
        <p style="color:var(--text);font-weight:600">所有接口需鉴权，支持两种方式：</p>
        <p>① Header: <code>Authorization: Bearer &lt;token&gt;</code></p>
        <p>② Query: <code>?token=&lt;token&gt;</code>（仅下载链接推荐）</p>
        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
        <p><b>GET</b> <code>/api/tools/disk/stats</code> — 容量统计</p>
        <p><b>GET</b> <code>/api/tools/disk/files</code> — 文件列表</p>
        <p><b>POST</b> <code>/api/tools/disk/files</code> — 创建文件记录<br>
        <span style="color:var(--text-muted)">body: { name, size, mime_type }</span></p>
        <p><b>POST</b> <code>/api/tools/disk/files/:id/chunks</code> — 上传分片<br>
        <span style="color:var(--text-muted)">body: { chunk_index, content(base64), chunk_size }</span></p>
        <p><b>GET</b> <code>/api/tools/disk/files/:id/download?token=xxx</code> — 下载文件</p>
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
        '<div class="disk-stat-card"><div class="stat-label">存储占用</div><div class="stat-value">' + formatSize(s.db_size) + '</div><div class="stat-sub">上限 ' + formatSize(s.max_db_size) + '</div><div class="disk-usage-bar"><div class="disk-usage-fill ' + (usagePct > 80 ? 'warn' : '') + '" style="width:' + usagePct + '%"></div></div></div>';
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
        '<div class="file-meta">' + formatSize(f.size) + ' · ' + formatDate(f.created_at) + '</div></div>' +
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

  window.downloadFile = async function(id, name) {
    try {
      const data = await api('/api/tools/disk/files/' + id + '/download-token', { method: 'POST' });
      if (!data.dt) throw new Error('未获取到下载令牌');
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
    row.innerHTML = '<span style="flex-shrink:0;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(file.name) + '</span><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><span style="flex-shrink:0;font-size:12px;color:var(--text-muted)">0%</span>';
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
        status.textContent = pct + '%';
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
      resultBox.textContent = '✓ 已刷新 ' + (s.updated_funds || 0) + '/' + (s.total_funds || 0) + ' 只基金估值';
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
        // 热度分 + 分类标签
        const heatBadge = (kw.heat_score != null)
          ? '<span style="color:#fff;background:linear-gradient(135deg,#ff6b6b,#ee5a6f);padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600">🔥 ' + kw.heat_score + '</span>'
          : '';
        const catBadge = kw.category
          ? '<span style="color:var(--text-muted);background:var(--tag-bg);padding:1px 8px;border-radius:10px;font-size:11px">' + esc(kw.category) + '</span>'
          : '';
        const countText = kw.count > 0 ? kw.count + ' 条' : '';
        return '<div class="file-item" style="align-items:flex-start;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:8px;align-items:center;width:100%;flex-wrap:wrap">' +
            '<span style="' + rankStyle + ';width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + rank + '</span>' +
            '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(kw.keyword) + '</span>' +
            heatBadge + catBadge +
            '<span style="margin-left:auto;color:var(--text-muted);font-size:12px">' + countText + generatedAt + '</span>' +
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

  function formatNewsTime(ts) {
    try {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, '0');
      const cst = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      return (cst.getUTCMonth() + 1) + '/' + pad(cst.getUTCDate()) + ' ' + pad(cst.getUTCHours()) + ':' + pad(cst.getUTCMinutes());
    } catch { return ts || ''; }
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

<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap">
  <div class="db-tabs" id="configTabs">
    <button class="db-tab active" data-ctab="global">全局配置</button>
    <button class="db-tab" data-ctab="tools">工具级</button>
  </div>
  <button class="btn btn-outline btn-sm" id="configSortBtn">调整顺序</button>
</div>

<div id="configGlobalPane">
  <div class="file-list" id="configGlobalList">
    <div class="empty">加载中…</div>
  </div>
</div>

<div id="configToolsPane" style="display:none">
  <div class="file-list" id="configToolList">
    <div class="empty">加载中…</div>
  </div>
</div>

<div class="disk-modal-overlay" id="configModalOverlay">
  <div class="disk-modal" style="max-width:520px">
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

<div class="disk-modal-overlay" id="configPickOverlay">
  <div class="disk-modal" style="max-width:440px">
    <div class="disk-modal-header">
      <h3>选择配置项</h3>
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
  const tabsEl = $('configTabs');
  const globalPane = $('configGlobalPane');
  const toolsPane = $('configToolsPane');
  const modalOverlay = $('configModalOverlay');
  const modalSave = $('configModalSave');
  const modalInput = $('configModalInput');
  const modalLabel = $('configModalLabel');
  const modalHint = $('configModalHint');
  const modalTitle = $('configModalTitle');
  const pickOverlay = $('configPickOverlay');
  const pickBody = $('configPickBody');
  const sortBtn = $('configSortBtn');

  let schema = [];
  let tools = [];
  let globalConfigs = [];
  let toolOverrides = {};
  let editing = null;
  let globalOrder = [];   // 全局配置项顺序 [key...]
  let toolOrder = [];     // 工具条目顺序 [toolId...]
  let sortMode = false;   // 排序模式：true 时条目右侧显示 ↑↓

  function applySortBtn() {
    if (!sortBtn) return;
    sortBtn.textContent = sortMode ? '完成' : '调整顺序';
    sortBtn.classList.toggle('btn-primary', sortMode);
    sortBtn.classList.toggle('btn-outline', !sortMode);
  }

  if (sortBtn) {
    sortBtn.onclick = () => {
      sortMode = !sortMode;
      applySortBtn();
      renderGlobal();
      renderTools();
    };
  }

  if (tabsEl) {
    tabsEl.querySelectorAll('.db-tab').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-ctab');
        tabsEl.querySelectorAll('.db-tab').forEach(b => b.classList.toggle('active', b === btn));
        const isGlobal = tab === 'global';
        if (globalPane) globalPane.style.display = isGlobal ? '' : 'none';
        if (toolsPane) toolsPane.style.display = isGlobal ? 'none' : '';
      };
    });
  }

  function valueDisplay(cfg) {
    if (cfg.sensitive) {
      return cfg.hasValue
        ? '<span class="num" style="color:var(--success)">●</span>'
        : '<span style="color:var(--text-muted)">○</span>';
    }
    if (cfg.hasValue && cfg.value) {
      return '<span class="num">' + esc(cfg.value) + '</span>';
    }
    if (cfg.default) {
      return '<span style="color:var(--text-muted)">' + esc(cfg.default) + '</span>';
    }
    return '<span style="color:var(--text-muted)">—</span>';
  }

  function orderedGlobalConfigs() {
    if (!globalOrder.length) return globalConfigs;
    const byKey = {};
    for (const c of globalConfigs) byKey[c.key] = c;
    const ordered = [];
    for (const k of globalOrder) {
      if (byKey[k]) { ordered.push(byKey[k]); delete byKey[k]; }
    }
    for (const c of globalConfigs) {
      if (byKey[c.key]) ordered.push(c);
    }
    return ordered;
  }

  function orderedTools() {
    if (!toolOrder.length) return tools;
    const byId = {};
    for (const t of tools) byId[t.id] = t;
    const ordered = [];
    for (const id of toolOrder) {
      if (byId[id]) { ordered.push(byId[id]); delete byId[id]; }
    }
    for (const t of tools) {
      if (byId[t.id]) ordered.push(t);
    }
    return ordered;
  }

  function renderGlobal() {
    if (!globalConfigs.length) {
      globalList.innerHTML = '<div class="empty">无配置项</div>';
      return;
    }
    const list = orderedGlobalConfigs();
    globalList.innerHTML = list.map((cfg, i) => {
      const tag = cfg.sensitive ? ' <span class="badge badge-err">密</span>' : '';
      const upDisabled = i === 0 ? ' disabled' : '';
      const downDisabled = i === list.length - 1 ? ' disabled' : '';
      // 排序模式：右侧显示 ↑↓；非排序模式：显示 编辑/清除
      const actions = sortMode
        ? '<button class="icon-btn"' + upDisabled + ' onclick="moveConfigItem(\\'global\\',-1,\\'' + esc(cfg.key) + '\\')">↑</button>' +
          '<button class="icon-btn"' + downDisabled + ' onclick="moveConfigItem(\\'global\\',1,\\'' + esc(cfg.key) + '\\')">↓</button>'
        : '<button class="btn btn-outline btn-sm" onclick="editConfig(\\'app\\',null,\\'' + esc(cfg.key) + '\\')">编辑</button>' +
          (cfg.hasValue ? '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="clearConfig(\\'app\\',null,\\'' + esc(cfg.key) + '\\')">清除</button>' : '');
      return '<div class="file-item">' +
        '<div class="file-info"><div class="file-name">' + esc(cfg.key) + tag + '</div>' +
        '<div class="file-meta">' + esc(cfg.desc) + '</div></div>' +
        '<div style="margin-right:12px;font-size:13px">' + valueDisplay(cfg) + '</div>' +
        '<div class="file-actions" style="display:flex;gap:6px;align-items:center">' + actions + '</div>' +
        '</div>';
    }).join('');
  }

  function renderTools() {
    if (!tools.length) {
      toolList.innerHTML = '<div class="empty">无工具</div>';
      return;
    }
    const list = orderedTools();
    toolList.innerHTML = list.map((t, i) => {
      const overrides = toolOverrides[t.id] || [];
      let chips = '';
      if (overrides.length) {
        chips = overrides.map(o => {
          const valText = o.sensitive ? '●' : (o.value ? esc(o.value) : '●');
          return '<span class="saved-config" onclick="editConfig(\\'tool\\',\\'' + t.id + '\\',\\'' + esc(o.key) + '\\')">' + esc(o.key) + ': ' + valText +
            '<span class="del" onclick="event.stopPropagation();clearConfig(\\'tool\\',\\'' + t.id + '\\',\\'' + esc(o.key) + '\\')">✕</span></span>';
        }).join('');
      }
      const existing = new Set(overrides.map(o => o.key));
      const available = schema.filter(f => !existing.has(f.key) && (!f.tools || f.tools.includes(t.id)));
      const upDisabled = i === 0 ? ' disabled' : '';
      const downDisabled = i === list.length - 1 ? ' disabled' : '';
      // 排序模式：右侧显示 ↑↓；非排序模式：显示 + 添加
      const actions = sortMode
        ? '<button class="icon-btn"' + upDisabled + ' onclick="moveConfigItem(\\'tool\\',-1,\\'' + esc(t.id) + '\\')">↑</button>' +
          '<button class="icon-btn"' + downDisabled + ' onclick="moveConfigItem(\\'tool\\',1,\\'' + esc(t.id) + '\\')">↓</button>'
        : (available.length ? '<button class="btn btn-outline btn-sm" onclick="addToolOverride(\\'' + t.id + '\\')">+ 添加</button>' : '');
      return '<div class="file-item" style="display:block;padding:10px 14px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="font-weight:600;font-size:14px;flex:1">' + esc(t.name) + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' + actions + '</div>' +
        '</div>' +
        (chips ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + chips + '</div>' : '') +
        '</div>';
    }).join('');
  }

  async function saveOrder() {
    try {
      await api('/api/preferences/config_order', {
        method: 'PUT',
        body: JSON.stringify({ value: { app: globalOrder, tools: toolOrder } }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) { if (e.message !== 'UNAUTHORIZED') toast('顺序保存失败', 'error'); }
  }

  window.moveConfigItem = function(scope, dir, id) {
    if (scope === 'global') {
      const order = orderedGlobalConfigs().map(c => c.key);
      const i = order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      globalOrder = order;
      renderGlobal();
      saveOrder();
    } else {
      const order = orderedTools().map(t => t.id);
      const i = order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      toolOrder = order;
      renderTools();
      saveOrder();
    }
  };

  async function loadAll() {
    try {
      const [schemaData, globalData] = await Promise.all([
        api('/api/config/schema'),
        api('/api/config'),
      ]);
      schema = schemaData.schema || [];
      tools = schemaData.tools || [];
      globalConfigs = globalData.configs || [];

      const results = await Promise.all(
        tools.map(t => api('/api/config/tools/' + t.id).catch(() => ({ overrides: [] })))
      );
      toolOverrides = {};
      tools.forEach((t, i) => {
        toolOverrides[t.id] = results[i].overrides || [];
      });

      try {
        const orderData = await api('/api/preferences/config_order');
        if (orderData.value) {
          if (Array.isArray(orderData.value.app)) globalOrder = orderData.value.app;
          if (Array.isArray(orderData.value.tools)) toolOrder = orderData.value.tools;
        }
      } catch { /* 无偏好则用默认顺序 */ }

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

    modalTitle.textContent = scope === 'app' ? '编辑全局配置' : '编辑工具配置';
    modalLabel.textContent = field.key + ' — ' + field.desc + (field.sensitive ? ' （敏感）' : '');
    modalInput.placeholder = field.placeholder || (field.default ? '默认: ' + field.default : '');
    modalInput.value = '';
    modalInput.type = field.sensitive ? 'password' : 'text';
    let hint = '';
    if (field.sensitive) hint = '敏感字段已加密存储，留空保存将清除。';
    else if (field.default) hint = '留空将回退到默认值：' + field.default;
    else hint = '留空将清除该配置。';
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
    const overrides = toolOverrides[tool] || [];
    const existing = new Set(overrides.map(o => o.key));
    const available = schema.filter(f => !existing.has(f.key) && (!f.tools || f.tools.includes(tool)));
    if (!available.length) { toast('已无可添加的配置项', 'info'); return; }
    pickBody.innerHTML = available.map(f => {
      const sensitiveTag = f.sensitive ? ' <span class="badge badge-err">密</span>' : '';
      const defaultTag = f.default ? ' <span style="color:var(--text-muted);font-size:11px">默认 ' + esc(f.default) + '</span>' : '';
      return '<div class="file-item" style="padding:10px 14px;cursor:pointer" onclick="pickOverride(\\'' + esc(tool) + '\\',\\'' + esc(f.key) + '\\')">' +
        '<div class="file-info"><div class="file-name">' + esc(f.key) + sensitiveTag + '</div>' +
        '<div class="file-meta">' + esc(f.desc) + ' ' + defaultTag + '</div></div></div>';
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
    if (!confirm('确认清除 ' + key + '？')) return;
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

// ─── DB 管理工具（adminer 风格） ───
function renderDbAdminTool() {
  return \`
<h2>🗄️ DB 管理</h2>

<div class="db-topbar">
  <select id="dbConnSelect"><option value="">— 选择连接 —</option></select>
  <button class="btn btn-outline btn-sm" id="dbManageBtn">⚙ 连接</button>
  <button class="btn btn-outline btn-sm" id="dbRefreshBtn">🔄 刷新</button>
  <span class="db-meta" id="dbCurConnLabel">未选择连接</span>
</div>

<div class="db-layout">
  <div class="db-sidebar" id="dbSidebar">
    <div class="db-sidebar-title">
      <span class="db-sidebar-toggle" id="dbSidebarToggle">表</span>
      <span class="db-new-table" id="dbNewTableBtn" title="新建表">+ 新建</span>
    </div>
    <div class="db-empty-hint" id="dbTablesEmpty" style="padding:20px 8px">选择连接后加载</div>
    <div id="dbTablesList"></div>
  </div>
  <div class="db-main" id="dbMain">
    <div class="db-empty-hint" id="dbMainEmpty">点击左侧表名开始浏览，或切换到 SQL 命令 tab 执行任意查询</div>
    <div id="dbMainContent" style="display:none">
      <div class="db-tabs" id="dbTabs">
        <button class="db-tab active" data-tab="data">选择数据</button>
        <button class="db-tab" data-tab="schema">表结构</button>
        <button class="db-tab" data-tab="sql">SQL 命令</button>
        <button class="db-tab" data-tab="insert">新建项</button>
      </div>

      <!-- 选择数据 -->
      <div class="db-panel active" id="dbPanel-data">
        <div class="db-filter-row" id="dbFilterRow">
          <input id="dbFilterCol" placeholder="列名" style="width:120px">
          <input id="dbFilterVal" placeholder="值" style="width:160px">
          <button class="btn btn-outline btn-sm" id="dbFilterBtn">过滤</button>
          <button class="btn btn-outline btn-sm" id="dbFilterClearBtn">清除</button>
        </div>
        <div class="db-results-wrap">
          <div class="db-results-head">
            <span id="dbDataTitle">数据</span>
            <span id="dbDataMeta"></span>
          </div>
          <div class="db-results-scroll" id="dbDataScroll"></div>
          <div class="db-pagination" id="dbPagination"></div>
        </div>
      </div>

      <!-- 表结构 -->
      <div class="db-panel" id="dbPanel-schema">
        <div class="db-results-wrap">
          <div class="db-results-head">
            <span id="dbSchemaTitle">字段</span>
            <span id="dbSchemaMeta"></span>
          </div>
          <div id="dbSchemaBody" style="padding:0"></div>
        </div>
        <div class="section-title">索引</div>
        <div id="dbIndexesBody"></div>
        <div class="section-title">建表 SQL</div>
        <pre class="db-ddl" id="dbDdl"></pre>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" id="dbExportDdlBtn">复制 DDL</button>
          <button class="btn btn-outline btn-sm" id="dbDropTableBtn" style="color:var(--danger)">删除表</button>
        </div>
      </div>

      <!-- SQL 命令 -->
      <div class="db-panel" id="dbPanel-sql">
        <div class="db-toolbar">
          <button class="btn btn-primary btn-sm" id="dbRunBtn">▶ 执行</button>
          <button class="btn btn-outline btn-sm" id="dbClearBtn">清空</button>
          <span class="db-meta" id="dbSqlMeta"></span>
        </div>
        <textarea class="db-editor" id="dbSqlEditor" placeholder="-- Ctrl/Cmd + Enter 执行&#10;SELECT * FROM 表名 LIMIT 10;" spellcheck="false"></textarea>
        <div class="db-results-wrap" id="dbSqlResultsWrap" style="display:none;margin-top:12px">
          <div class="db-results-head">
            <span id="dbSqlResultsTitle">结果</span>
            <span id="dbSqlResultsMeta"></span>
          </div>
          <div class="db-results-scroll" id="dbSqlResultsScroll"></div>
        </div>
      </div>

      <!-- 新建项 -->
      <div class="db-panel" id="dbPanel-insert">
        <div id="dbInsertForm"></div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" id="dbInsertSubmitBtn">插入</button>
          <span class="db-meta" id="dbInsertMeta"></span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 连接管理弹层 -->
<div class="disk-modal-overlay" id="dbConnOverlay">
  <div class="disk-modal" style="max-width:640px">
    <div class="disk-modal-header">
      <h3>连接管理</h3>
      <button class="disk-modal-close" onclick="closeDbConnModal()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="db-conn-list" id="dbConnList"></div>
      <div class="section-title" id="dbConnFormTitle">添加连接</div>
      <div class="form-group">
        <label>名称</label>
        <input id="dbConnName" placeholder="如：ocean / forest / 本地测试">
      </div>
      <div class="form-group">
        <label>地址</label>
        <input id="dbConnBaseUrl" placeholder="https://db.example.com">
      </div>
      <div class="form-group">
        <label>数据库 <span style="font-weight:400;color:var(--text-muted)">（可选）</span></label>
        <input id="dbConnDatabase" placeholder="留空则使用默认库">
      </div>
      <div class="result-box" id="dbConnFormResult"></div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" id="dbConnTestBtn" style="margin-right:auto">测试连接</button>
      <button class="btn btn-outline" style="color:var(--danger);display:none" id="dbConnDeleteBtn">删除</button>
      <button class="btn btn-outline" onclick="closeDbConnModal()">取消</button>
      <button class="btn btn-primary" id="dbConnSaveBtn">保存</button>
    </div>
  </div>
</div>

<!-- 行编辑弹层 -->
<div class="disk-modal-overlay" id="dbRowOverlay">
  <div class="disk-modal" style="max-width:680px">
    <div class="disk-modal-header">
      <h3 id="dbRowModalTitle">编辑行</h3>
      <button class="disk-modal-close" onclick="closeDbRowModal()">✕</button>
    </div>
    <div class="disk-modal-body" id="dbRowModalBody"></div>
    <div class="disk-modal-footer">
      <span class="db-meta" id="dbRowModalMeta" style="margin-right:auto"></span>
      <button class="btn btn-outline" onclick="closeDbRowModal()">取消</button>
      <button class="btn btn-primary" id="dbRowSaveBtn">保存</button>
    </div>
  </div>
</div>

<!-- 新建表弹层 -->
<div class="disk-modal-overlay" id="dbCreateTableOverlay">
  <div class="disk-modal" style="max-width:860px">
    <div class="disk-modal-header">
      <h3>新建表</h3>
      <button class="disk-modal-close" onclick="closeDbCreateTableModal()">✕</button>
    </div>
    <div class="disk-modal-body">
      <div class="form-group">
        <label>表名</label>
        <input id="dbNewTableName" placeholder="如：my_table">
      </div>
      <div class="db-cols-head">
        <span>列名</span>
        <span>类型</span>
        <span>长度</span>
        <span>属性</span>
        <span>默认值</span>
        <span></span>
      </div>
      <div id="dbColsList"></div>
      <button class="btn btn-outline btn-sm" id="dbAddColBtn" style="margin-top:8px">+ 添加列</button>
      <div class="form-group" style="margin-top:14px">
        <label>生成 SQL 预览</label>
        <pre class="db-ddl" id="dbCreateSqlPreview" style="min-height:60px;max-height:200px;overflow:auto"></pre>
      </div>
      <div class="result-box" id="dbNewTableResult"></div>
    </div>
    <div class="disk-modal-footer">
      <button class="btn btn-outline" onclick="closeDbCreateTableModal()">取消</button>
      <button class="btn btn-primary" id="dbNewTableSubmitBtn">创建</button>
    </div>
  </div>
</div>
\`;
}

function mountDbAdminTool() {
  // ─── DOM 引用 ───
  const connSelect = $('dbConnSelect');
  const manageBtn = $('dbManageBtn');
  const refreshBtn = $('dbRefreshBtn');
  const curConnLabel = $('dbCurConnLabel');
  const tablesList = $('dbTablesList');
  const tablesEmpty = $('dbTablesEmpty');
  const mainEmpty = $('dbMainEmpty');
  const mainContent = $('dbMainContent');
  const tabsEl = $('dbTabs');
  const newTableBtn = $('dbNewTableBtn');
  const sidebarEl = $('dbSidebar');
  const sidebarToggle = $('dbSidebarToggle');

  // 移动端判定：窄屏走竖向折叠交互
  function isMobile() { return window.innerWidth <= 768; }
  function collapseSidebar() { sidebarEl.classList.add('collapsed'); }
  function expandSidebar() { sidebarEl.classList.remove('collapsed'); }
  // 标题点击折叠/展开
  if (sidebarToggle) {
    sidebarToggle.onclick = (e) => {
      e.stopPropagation();
      sidebarEl.classList.toggle('collapsed');
    };
  }
  // 移动端默认收起表列表，避免占据首屏
  if (isMobile()) collapseSidebar();

  // 选择数据面板
  const filterCol = $('dbFilterCol');
  const filterVal = $('dbFilterVal');
  const filterBtn = $('dbFilterBtn');
  const filterClearBtn = $('dbFilterClearBtn');
  const dataTitle = $('dbDataTitle');
  const dataMeta = $('dbDataMeta');
  const dataScroll = $('dbDataScroll');
  const paginationEl = $('dbPagination');

  // 表结构面板
  const schemaTitle = $('dbSchemaTitle');
  const schemaMeta = $('dbSchemaMeta');
  const schemaBody = $('dbSchemaBody');
  const indexesBody = $('dbIndexesBody');
  const ddlEl = $('dbDdl');
  const exportDdlBtn = $('dbExportDdlBtn');
  const dropTableBtn = $('dbDropTableBtn');

  // SQL 命令面板
  const sqlEditor = $('dbSqlEditor');
  const runBtn = $('dbRunBtn');
  const clearBtn = $('dbClearBtn');
  const sqlMeta = $('dbSqlMeta');
  const sqlResultsWrap = $('dbSqlResultsWrap');
  const sqlResultsTitle = $('dbSqlResultsTitle');
  const sqlResultsMeta = $('dbSqlResultsMeta');
  const sqlResultsScroll = $('dbSqlResultsScroll');

  // 新建项面板
  const insertForm = $('dbInsertForm');
  const insertSubmitBtn = $('dbInsertSubmitBtn');
  const insertMeta = $('dbInsertMeta');

  // 连接管理弹层
  const connOverlay = $('dbConnOverlay');
  const connList = $('dbConnList');
  const connFormTitle = $('dbConnFormTitle');
  const connName = $('dbConnName');
  const connBaseUrl = $('dbConnBaseUrl');
  const connDatabase = $('dbConnDatabase');
  const connTestBtn = $('dbConnTestBtn');
  const connDeleteBtn = $('dbConnDeleteBtn');
  const connSaveBtn = $('dbConnSaveBtn');
  const connFormResult = $('dbConnFormResult');

  // 行编辑弹层
  const rowOverlay = $('dbRowOverlay');
  const rowModalTitle = $('dbRowModalTitle');
  const rowModalBody = $('dbRowModalBody');
  const rowModalMeta = $('dbRowModalMeta');
  const rowSaveBtn = $('dbRowSaveBtn');

  // 新建表弹层
  const createTableOverlay = $('dbCreateTableOverlay');
  const newTableName = $('dbNewTableName');
  const colsList = $('dbColsList');
  const addColBtn = $('dbAddColBtn');
  const sqlPreview = $('dbCreateSqlPreview');
  const newTableResult = $('dbNewTableResult');
  const newTableSubmitBtn = $('dbNewTableSubmitBtn');

  // ─── 状态 ───
  let connections = [];
  let activeConnId = '';
  let editingConnId = null;
  let activeTable = '';
  let activeTab = 'data';
  let schemaCache = null;       // 当前表 schema 缓存
  let dataState = { limit: 50, offset: 0, sort: '', order: 'ASC', filter: null };
  let rowEditingState = null;   // { mode: 'edit'|'insert', where: {} }

  // 新建表列状态：[{ name, type, length, notNull, pk, autoincr, unique, def }]
  const COL_TYPES = ['INTEGER', 'TEXT', 'REAL', 'NUMERIC', 'BLOB', 'VARCHAR', 'DATETIME', 'DATE', 'BOOLEAN'];
  let createCols = [];

  // ─── 工具函数 ───
  function showResult(el, msg, type) {
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    el.textContent = msg;
    el.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'ok' ? 'rgba(34,197,94,0.1)' : 'var(--bg)';
    el.style.color = type === 'error' ? '#ef4444' : type === 'ok' ? '#22c55e' : 'var(--text)';
  }

  function escapeAttr(s) { return esc(s == null ? '' : String(s)); }

  function renderCell(v) {
    if (v == null) return '<span class="db-cell-null">NULL</span>';
    let s = v;
    if (typeof v === 'object') s = JSON.stringify(v);
    else s = String(v);
    if (typeof v === 'number') {
      return '<td class="db-cell-num" title="' + escapeAttr(s) + '">' + esc(s) + '</td>';
    }
    return '<td title="' + escapeAttr(s) + '">' + esc(s) + '</td>';
  }

  function switchTab(tab) {
    activeTab = tab;
    tabsEl.querySelectorAll('.db-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    ['data', 'schema', 'sql', 'insert'].forEach(t => {
      $('dbPanel-' + t).classList.toggle('active', t === tab);
    });
    if (tab === 'schema' && activeTable) loadSchema();
    if (tab === 'insert' && activeTable && !insertForm.innerHTML) loadInsertForm();
  }

  tabsEl.querySelectorAll('.db-tab').forEach(b => {
    b.onclick = () => switchTab(b.getAttribute('data-tab'));
  });

  // ─── 连接选择 ───
  async function loadConnSelect() {
    try {
      const data = await api('/api/tools/db-admin/connections');
      connections = data.results || [];
      const prev = activeConnId;
      connSelect.innerHTML = '<option value="">— 选择连接 —</option>' +
        connections.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
      if (prev && connections.find(c => c.id === prev)) {
        connSelect.value = prev;
      } else {
        activeConnId = '';
        curConnLabel.textContent = '未选择连接';
        tablesList.innerHTML = '';
        tablesEmpty.style.display = 'block';
        tablesEmpty.textContent = '选择连接后加载';
        mainContent.style.display = 'none';
        mainEmpty.style.display = 'block';
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      connSelect.innerHTML = '<option value="">加载失败</option>';
    }
  }

  connSelect.onchange = () => {
    activeConnId = connSelect.value;
    activeTable = '';
    schemaCache = null;
    if (!activeConnId) {
      curConnLabel.textContent = '未选择连接';
      tablesList.innerHTML = '';
      tablesEmpty.style.display = 'block';
      tablesEmpty.textContent = '选择连接后加载';
      mainContent.style.display = 'none';
      mainEmpty.style.display = 'block';
      return;
    }
    const c = connections.find(x => x.id === activeConnId);
    curConnLabel.textContent = c ? ('当前：' + c.name) : '';
    // 切换连接后展开表列表，方便选择
    expandSidebar();
    loadTables();
  };

  // ─── 左侧表列表 ───
  async function loadTables() {
    if (!activeConnId) return;
    tablesEmpty.style.display = 'block';
    tablesEmpty.textContent = '加载中…';
    tablesList.innerHTML = '';
    try {
      const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables');
      const tables = (data.results || []).filter(r => r.name);
      if (tables.length === 0) {
        tablesEmpty.textContent = '该库暂无表，点右上新建';
        return;
      }
      tablesEmpty.style.display = 'none';
      tablesList.innerHTML = tables.map(t =>
        '<div class="db-table-item' + (t.name === activeTable ? ' active' : '') + '" data-table="' + escapeAttr(t.name) + '">' +
          '<span>' + esc(t.name) + '</span>' +
        '</div>'
      ).join('');
      tablesList.querySelectorAll('.db-table-item').forEach(el => {
        el.onclick = () => selectTable(el.getAttribute('data-table'));
      });
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      tablesEmpty.textContent = '加载失败：' + e.message;
    }
  }

  function selectTable(tname) {
    activeTable = tname;
    schemaCache = null;
    dataState = { limit: 50, offset: 0, sort: '', order: 'ASC', filter: null };
    filterCol.value = '';
    filterVal.value = '';
    tablesList.querySelectorAll('.db-table-item').forEach(x => x.classList.remove('active'));
    const el = tablesList.querySelector('.db-table-item[data-table="' + CSS.escape(tname) + '"]');
    if (el) el.classList.add('active');
    mainEmpty.style.display = 'none';
    mainContent.style.display = 'block';
    insertForm.innerHTML = '';
    switchTab('data');
    loadData();
    // 移动端选表后收起 sidebar，把空间让给主区
    if (isMobile()) collapseSidebar();
  }

  // ─── 选择数据 ───
  async function loadData() {
    if (!activeConnId || !activeTable) return;
    dataTitle.textContent = activeTable;
    dataMeta.textContent = '加载中…';
    dataScroll.innerHTML = '';
    paginationEl.innerHTML = '';
    try {
      const params = new URLSearchParams();
      params.set('limit', dataState.limit);
      params.set('offset', dataState.offset);
      if (dataState.sort) { params.set('sort', dataState.sort); params.set('order', dataState.order); }
      if (dataState.filter) {
        params.set(dataState.filter.col, dataState.filter.val);
      }
      const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/data?' + params.toString());
      const rows = data.results || [];
      const total = data.count;
      const cols = rows.length > 0 ? Object.keys(rows[0]) : (schemaCache?.columns?.map(c => c.name) || []);

      dataMeta.textContent = '共 ' + (total != null ? total : '?') + ' 行 · 当前 ' + rows.length + ' 行';

      if (rows.length === 0) {
        dataScroll.innerHTML = '<div class="db-empty-hint">无数据</div>';
      } else {
        // 主键列（用于行编辑/删除定位）
        const pkCols = (schemaCache?.columns || []).filter(c => c.pk).map(c => c.name);
        dataScroll.innerHTML = '<table class="db-results-table">' +
          '<thead><tr>' +
            cols.map(c => {
              const sorted = dataState.sort === c;
              const cls = sorted ? 'db-th-sort' + (dataState.order === 'DESC' ? ' desc' : '') : '';
              return '<th class="' + cls + '" data-col="' + escapeAttr(c) + '">' + esc(c) + '</th>';
            }).join('') +
            '<th class="db-th-actions">操作</th>' +
          '</tr></thead>' +
          '<tbody>' + rows.map(r => {
            // 行定位 key：优先主键，无主键用所有列
            const where = {};
            if (pkCols.length > 0) {
              pkCols.forEach(k => { where[k] = r[k]; });
            } else {
              cols.forEach(k => { where[k] = r[k]; });
            }
            const whereStr = escapeAttr(JSON.stringify(where));
            return '<tr>' +
              cols.map(c => renderCell(r[c])).join('') +
              '<td class="db-td-actions"><div class="db-row-actions">' +
                '<a data-action="edit" data-where="' + whereStr + '">编辑</a>' +
                '<a class="db-del" data-action="del" data-where="' + whereStr + '">删除</a>' +
              '</div></td>' +
            '</tr>';
          }).join('') + '</tbody>' +
          '</table>';

        // 列头排序
        dataScroll.querySelectorAll('th[data-col]').forEach(th => {
          th.onclick = () => {
            const col = th.getAttribute('data-col');
            if (dataState.sort === col) {
              dataState.order = dataState.order === 'ASC' ? 'DESC' : 'ASC';
            } else {
              dataState.sort = col;
              dataState.order = 'ASC';
            }
            loadData();
          };
        });
        // 行操作
        dataScroll.querySelectorAll('.db-row-actions a').forEach(a => {
          a.onclick = (ev) => {
            ev.preventDefault();
            const action = a.getAttribute('data-action');
            const where = JSON.parse(a.getAttribute('data-where'));
            if (action === 'edit') openRowModal('edit', where);
            else if (action === 'del') deleteRow(where);
          };
        });
      }

      // 分页
      renderPagination(total);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      dataMeta.textContent = '加载失败';
      dataScroll.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  function renderPagination(total) {
    const limit = dataState.limit;
    const offset = dataState.offset;
    const totalPages = total != null ? Math.ceil(total / limit) : null;
    const curPage = Math.floor(offset / limit) + 1;
    let html = '';
    html += '<button id="dbPageFirst" ' + (offset === 0 ? 'disabled' : '') + '>首页</button>';
    html += '<button id="dbPagePrev" ' + (offset === 0 ? 'disabled' : '') + '>上一页</button>';
    html += '<span>第 ' + curPage + ' 页' + (totalPages ? ' / ' + totalPages : '') + '</span>';
    const nextDisabled = total != null ? (offset + limit >= total) : false;
    html += '<button id="dbPageNext" ' + (nextDisabled ? 'disabled' : '') + '>下一页</button>';
    html += '<select class="db-page-size" id="dbPageSize">';
    [25, 50, 100, 200].forEach(n => {
      html += '<option value="' + n + '"' + (n === limit ? ' selected' : '') + '>' + n + ' / 页</option>';
    });
    html += '</select>';
    paginationEl.innerHTML = html;
    const firstBtn = $('dbPageFirst'), prevBtn = $('dbPagePrev'), nextBtn = $('dbPageNext'), pageSizeSel = $('dbPageSize');
    if (firstBtn) firstBtn.onclick = () => { dataState.offset = 0; loadData(); };
    if (prevBtn) prevBtn.onclick = () => { dataState.offset = Math.max(0, offset - limit); loadData(); };
    if (nextBtn) nextBtn.onclick = () => { dataState.offset = offset + limit; loadData(); };
    if (pageSizeSel) pageSizeSel.onchange = () => { dataState.limit = parseInt(pageSizeSel.value); dataState.offset = 0; loadData(); };
  }

  filterBtn.onclick = () => {
    const col = filterCol.value.trim();
    const val = filterVal.value.trim();
    if (!col || !val) { toast('请填写列名和值', 'error'); return; }
    dataState.filter = { col, val };
    dataState.offset = 0;
    loadData();
  };
  filterClearBtn.onclick = () => {
    dataState.filter = null;
    filterCol.value = '';
    filterVal.value = '';
    dataState.offset = 0;
    loadData();
  };

  // ─── 表结构 ───
  async function loadSchema() {
    if (!activeConnId || !activeTable) return;
    if (schemaCache && schemaCache._table === activeTable) {
      renderSchema(schemaCache);
      return;
    }
    schemaMeta.textContent = '加载中…';
    try {
      const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
      schemaCache = { ...data, _table: activeTable };
      renderSchema(data);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      schemaMeta.textContent = '加载失败';
      schemaBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  function renderSchema(data) {
    const cols = data.columns || [];
    const indexes = data.indexes || [];
    const count = data.count;
    schemaTitle.textContent = activeTable + ' · 字段';
    schemaMeta.textContent = (count != null ? count + ' 行 · ' : '') + cols.length + ' 列';
    if (cols.length === 0) {
      schemaBody.innerHTML = '<div class="db-empty-hint">无字段信息</div>';
    } else {
      schemaBody.innerHTML = '<table class="db-schema-table">' +
        '<thead><tr><th>字段</th><th>类型</th><th>非空</th><th>默认</th><th>主键</th></tr></thead>' +
        '<tbody>' + cols.map(c =>
          '<tr>' +
            '<td class="' + (c.pk ? 'db-pk' : '') + '">' + esc(c.name) + '</td>' +
            '<td class="db-type">' + esc(c.type || '') + '</td>' +
            '<td>' + (c.notnull ? '是' : '否') + '</td>' +
            '<td>' + (c.dflt_value != null ? esc(String(c.dflt_value)) : '<span class="db-cell-null">NULL</span>') + '</td>' +
            '<td>' + (c.pk ? '★' : '') + '</td>' +
          '</tr>'
        ).join('') + '</tbody>' +
        '</table>';
    }
    if (indexes.length === 0) {
      indexesBody.innerHTML = '<div class="db-empty-hint">无索引</div>';
    } else {
      indexesBody.innerHTML = '<table class="db-schema-table">' +
        '<thead><tr><th>索引名</th><th>列</th><th>唯一</th></tr></thead>' +
        '<tbody>' + indexes.map(i =>
          '<tr><td>' + esc(i.name) + '</td><td class="db-type">' + esc((i.columns || []).join(', ')) + '</td><td>' + (i.unique ? '是' : '否') + '</td></tr>'
        ).join('') + '</tbody>' +
        '</table>';
    }
    ddlEl.textContent = data.sql || '(无 DDL)';
  }

  exportDdlBtn.onclick = () => {
    const sql = ddlEl.textContent;
    if (!sql) return;
    navigator.clipboard.writeText(sql).then(() => toast('DDL 已复制', 'success')).catch(() => toast('复制失败', 'error'));
  };

  dropTableBtn.onclick = async () => {
    if (!activeConnId || !activeTable) return;
    if (!confirm('确认删除表 \`' + activeTable + '\`？此操作不可恢复！')) return;
    try {
      await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable), { method: 'DELETE' });
      toast('表已删除', 'success');
      activeTable = '';
      schemaCache = null;
      mainContent.style.display = 'none';
      mainEmpty.style.display = 'block';
      loadTables();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  // ─── SQL 命令 ───
  async function runQuery() {
    if (!activeConnId) { toast('请先选择连接', 'error'); return; }
    const sql = sqlEditor.value.trim();
    if (!sql) { toast('请输入 SQL', 'error'); return; }
    runBtn.disabled = true; runBtn.textContent = '执行中…';
    sqlResultsWrap.style.display = 'none';
    sqlMeta.textContent = '执行中…';
    const t0 = performance.now();
    try {
      const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/query', {
        method: 'POST',
        body: JSON.stringify({ query: sql, params: [] }),
        headers: { 'Content-Type': 'application/json' },
      });
      const elapsed = Math.round(performance.now() - t0);
      const results = data.results || [];
      const changes = data.meta?.changes ?? 0;
      const read = data.meta?.rows_read ?? null;
      const duration = data.meta?.duration != null ? (data.meta.duration * 1000).toFixed(1) + 'ms' : elapsed + 'ms';

      if (results.length > 0) {
        const cols = Object.keys(results[0]);
        sqlResultsTitle.textContent = '结果（' + results.length + ' 行）';
        sqlResultsMeta.textContent = '耗时 ' + duration + (read != null ? ' · 读 ' + read + ' 行' : '');
        sqlResultsScroll.innerHTML = '<table class="db-results-table">' +
          '<thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>' +
          '<tbody>' + results.map(r => '<tr>' + cols.map(c => renderCell(r[c])).join('') + '</tr>').join('') + '</tbody>' +
          '</table>';
      } else {
        sqlResultsTitle.textContent = '执行结果';
        sqlResultsMeta.textContent = '耗时 ' + duration;
        sqlResultsScroll.innerHTML = '<div class="db-empty-hint">✓ 执行成功' +
          (changes > 0 ? '，影响 ' + changes + ' 行' : '') +
          (read != null ? ' · 读 ' + read + ' 行' : '') + '</div>';
      }
      sqlResultsWrap.style.display = 'block';
      sqlMeta.textContent = '✓ ' + (results.length > 0 ? results.length + ' 行' : (changes > 0 ? changes + ' 行受影响' : 'OK')) + ' · ' + duration;
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      sqlMeta.textContent = '✗ 失败';
      sqlResultsTitle.textContent = '错误';
      sqlResultsMeta.textContent = '';
      sqlResultsScroll.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
      sqlResultsWrap.style.display = 'block';
    } finally {
      runBtn.disabled = false; runBtn.textContent = '▶ 执行';
    }
  }

  runBtn.onclick = runQuery;
  clearBtn.onclick = () => {
    sqlEditor.value = '';
    sqlResultsWrap.style.display = 'none';
    sqlMeta.textContent = '';
  };
  sqlEditor.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = sqlEditor.selectionStart, en = sqlEditor.selectionEnd;
      sqlEditor.value = sqlEditor.value.slice(0, s) + '  ' + sqlEditor.value.slice(en);
      sqlEditor.selectionStart = sqlEditor.selectionEnd = s + 2;
    }
  });

  // ─── 新建项 ───
  async function loadInsertForm() {
    if (!activeConnId || !activeTable) return;
    insertForm.innerHTML = '<div class="db-empty-hint">加载字段中…</div>';
    try {
      if (!schemaCache || schemaCache._table !== activeTable) {
        const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...data, _table: activeTable };
      }
      const cols = schemaCache.columns || [];
      if (cols.length === 0) {
        insertForm.innerHTML = '<div class="db-empty-hint">无字段信息</div>';
        return;
      }
      insertForm.innerHTML = '<div class="db-form-grid">' + cols.map(c => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const placeholder = auto ? '（自增，留空）' : (c.dflt_value != null ? '默认: ' + c.dflt_value : '');
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          '<input data-col="' + escapeAttr(c.name) + '" placeholder="' + escapeAttr(placeholder) + '"' + (auto ? ' disabled' : '') + '>';
      }).join('') + '</div>';
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      insertForm.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  insertSubmitBtn.onclick = async () => {
    if (!activeConnId || !activeTable) return;
    const inputs = insertForm.querySelectorAll('input[data-col]:not(:disabled)');
    const values = {};
    inputs.forEach(inp => {
      const col = inp.getAttribute('data-col');
      const v = inp.value;
      if (v !== '') values[col] = v;
    });
    if (Object.keys(values).length === 0) { toast('请至少填写一个字段', 'error'); return; }
    insertSubmitBtn.disabled = true; insertSubmitBtn.textContent = '插入中…';
    insertMeta.textContent = '';
    try {
      const res = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
        method: 'POST',
        body: JSON.stringify({ values }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('已插入' + (res.last_row_id ? '，ID=' + res.last_row_id : ''), 'success');
      // 清空表单
      inputs.forEach(inp => inp.value = '');
      // 刷新数据
      switchTab('data');
      loadData();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      insertMeta.textContent = '✗ ' + e.message;
      insertMeta.style.color = '#ef4444';
    } finally {
      insertSubmitBtn.disabled = false; insertSubmitBtn.textContent = '插入';
    }
  };

  // ─── 行编辑弹层 ───
  function openRowModal(mode, where) {
    rowEditingState = { mode, where };
    rowModalTitle.textContent = (mode === 'edit' ? '编辑行：' : '新建行：') + activeTable;
    rowModalMeta.textContent = '';
    rowModalBody.innerHTML = '<div class="db-empty-hint">加载中…</div>';
    rowOverlay.classList.add('show');
    if (mode === 'edit') loadRowForm(where);
    else loadInsertFormInModal();
  }
  window.closeDbRowModal = function() { rowOverlay.classList.remove('show'); };

  async function loadRowForm(where) {
    try {
      if (!schemaCache || schemaCache._table !== activeTable) {
        const sd = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...sd, _table: activeTable };
      }
      const params = new URLSearchParams(where);
      const data = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row?' + params.toString());
      const row = data.row;
      if (!row) {
        rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">行未找到</div>';
        return;
      }
      const cols = schemaCache.columns || [];
      rowModalBody.innerHTML = '<div class="db-form-grid">' + cols.map(c => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const val = row[c.name] != null ? String(row[c.name]) : '';
        const disabled = auto ? ' disabled' : '';
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          '<input data-col="' + escapeAttr(c.name) + '" value="' + escapeAttr(val) + '"' + disabled + '>';
      }).join('') + '</div>';
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { closeDbRowModal(); return; }
      rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  async function loadInsertFormInModal() {
    try {
      if (!schemaCache || schemaCache._table !== activeTable) {
        const sd = await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...sd, _table: activeTable };
      }
      const cols = schemaCache.columns || [];
      rowModalBody.innerHTML = '<div class="db-form-grid">' + cols.map(c => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const placeholder = auto ? '（自增，留空）' : (c.dflt_value != null ? '默认: ' + c.dflt_value : '');
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          '<input data-col="' + escapeAttr(c.name) + '" placeholder="' + escapeAttr(placeholder) + '"' + (auto ? ' disabled' : '') + '>';
      }).join('') + '</div>';
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') { closeDbRowModal(); return; }
      rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  rowSaveBtn.onclick = async () => {
    if (!rowEditingState) return;
    const inputs = rowModalBody.querySelectorAll('input[data-col]:not(:disabled)');
    const set = {};
    inputs.forEach(inp => {
      const col = inp.getAttribute('data-col');
      set[col] = inp.value;
    });
    if (Object.keys(set).length === 0) { toast('请至少填写一个字段', 'error'); return; }
    rowSaveBtn.disabled = true; rowSaveBtn.textContent = '保存中…';
    rowModalMeta.textContent = '';
    try {
      if (rowEditingState.mode === 'edit') {
        await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
          method: 'PUT',
          body: JSON.stringify({ set, where: rowEditingState.where }),
          headers: { 'Content-Type': 'application/json' },
        });
        toast('已保存', 'success');
      } else {
        const values = {};
        Object.keys(set).forEach(k => { if (set[k] !== '') values[k] = set[k]; });
        await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
          method: 'POST',
          body: JSON.stringify({ values }),
          headers: { 'Content-Type': 'application/json' },
        });
        toast('已插入', 'success');
      }
      closeDbRowModal();
      loadData();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      rowModalMeta.textContent = '✗ ' + e.message;
      rowModalMeta.style.color = '#ef4444';
    } finally {
      rowSaveBtn.disabled = false; rowSaveBtn.textContent = '保存';
    }
  };

  async function deleteRow(where) {
    if (!confirm('确认删除此行？')) return;
    try {
      const params = new URLSearchParams(where);
      await api('/api/tools/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row?' + params.toString(), { method: 'DELETE' });
      toast('已删除', 'success');
      loadData();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  }

  // ─── 新建表（可视化列编辑器，自动生成 SQL） ───
  function defaultCreateCols() {
    return [
      { name: 'id', type: 'INTEGER', length: '', notNull: true, pk: true, autoincr: true, unique: false, def: '' },
    ];
  }

  function renderCreateCols() {
    colsList.innerHTML = createCols.map((c, i) => {
      const typeOpts = COL_TYPES.map(t => '<option value="' + t + '"' + (t === c.type ? ' selected' : '') + '>' + t + '</option>').join('');
      return '<div class="db-col-row">' +
        '<input data-idx="' + i + '" data-field="name" value="' + escapeAttr(c.name) + '" placeholder="列名">' +
        '<select data-idx="' + i + '" data-field="type">' + typeOpts + '</select>' +
        '<input data-idx="' + i + '" data-field="length" value="' + escapeAttr(c.length) + '" placeholder="-">' +
        '<div class="db-col-attrs">' +
          '<label><input type="checkbox" data-idx="' + i + '" data-field="notNull"' + (c.notNull ? ' checked' : '') + '>非空</label>' +
          '<label><input type="checkbox" data-idx="' + i + '" data-field="pk"' + (c.pk ? ' checked' : '') + '>主键</label>' +
          '<label><input type="checkbox" data-idx="' + i + '" data-field="autoincr"' + (c.autoincr ? ' checked' : '') + '>自增</label>' +
          '<label><input type="checkbox" data-idx="' + i + '" data-field="unique"' + (c.unique ? ' checked' : '') + '>唯一</label>' +
        '</div>' +
        '<input data-idx="' + i + '" data-field="def" value="' + escapeAttr(c.def) + '" placeholder="默认值">' +
        '<button class="db-col-del" data-del="' + i + '" title="删除列">✕</button>' +
      '</div>';
    }).join('');
    // 绑定输入事件：实时更新状态 + 预览
    colsList.querySelectorAll('input[data-field], select[data-field]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-idx'));
      const field = el.getAttribute('data-field');
      const handler = () => {
        if (el.type === 'checkbox') createCols[idx][field] = el.checked;
        else createCols[idx][field] = el.value;
        updateCreatePreview();
      };
      el.oninput = handler;
      el.onchange = handler;
    });
    colsList.querySelectorAll('button[data-del]').forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.getAttribute('data-del'));
        createCols.splice(idx, 1);
        renderCreateCols();
        updateCreatePreview();
      };
    });
  }

  function buildCreateSql() {
    const name = newTableName.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const valid = createCols.filter(c => c.name.trim().replace(/[^a-zA-Z0-9_]/g, ''));
    if (!name || valid.length === 0) return '';
    const parts = valid.map(c => {
      const cname = c.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
      let s = '\`' + cname + '\` ';
      let t = c.type;
      const len = c.length.trim();
      if (len && (c.type === 'VARCHAR' || c.type === 'NUMERIC')) t += '(' + len.replace(/[^0-9]/g, '') + ')';
      s += t;
      if (c.pk) s += ' PRIMARY KEY';
      if (c.autoincr) s += ' AUTOINCREMENT';
      if (c.notNull) s += ' NOT NULL';
      if (c.unique) s += ' UNIQUE';
      const d = c.def.trim();
      if (d) {
        if (/^-?\\d+(\\.\\d+)?$/.test(d) || /^(CURRENT_TIMESTAMP|CURRENT_TIME|CURRENT_DATE|NULL|TRUE|FALSE)$/i.test(d) || /^(datetime|date|time)\\(/i.test(d)) {
          s += ' DEFAULT ' + d;
        } else {
          s += ' DEFAULT \\'' + d.replace(/'/g, "''") + '\\'';
        }
      }
      return s;
    });
    return 'CREATE TABLE \`' + name + '\` (\\n  ' + parts.join(',\\n  ') + '\\n)';
  }

  function updateCreatePreview() {
    sqlPreview.textContent = buildCreateSql() || '— 填写表名和至少一列后生成 —';
  }

  function openCreateTableModal() {
    if (!activeConnId) { toast('请先选择连接', 'error'); return; }
    newTableName.value = '';
    createCols = defaultCreateCols();
    renderCreateCols();
    updateCreatePreview();
    showResult(newTableResult, '', '');
    createTableOverlay.classList.add('show');
  }
  window.closeDbCreateTableModal = function() { createTableOverlay.classList.remove('show'); };

  newTableBtn.onclick = openCreateTableModal;
  addColBtn.onclick = () => {
    createCols.push({ name: '', type: 'TEXT', length: '', notNull: false, pk: false, autoincr: false, unique: false, def: '' });
    renderCreateCols();
    updateCreatePreview();
  };
  newTableName.oninput = updateCreatePreview;
  newTableSubmitBtn.onclick = async () => {
    const name = newTableName.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!name) { showResult(newTableResult, '请填写表名', 'error'); return; }
    const fullSql = buildCreateSql();
    if (!fullSql) { showResult(newTableResult, '请至少填写一列的列名', 'error'); return; }
    newTableSubmitBtn.disabled = true; newTableSubmitBtn.textContent = '创建中…';
    try {
      await api('/api/tools/db-admin/connections/' + activeConnId + '/query', {
        method: 'POST',
        body: JSON.stringify({ query: fullSql, params: [] }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('表已创建', 'success');
      closeDbCreateTableModal();
      await loadTables();
      selectTable(name);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      showResult(newTableResult, '创建失败：' + e.message, 'error');
    } finally {
      newTableSubmitBtn.disabled = false; newTableSubmitBtn.textContent = '创建';
    }
  };

  // ─── 连接管理 ───
  function showConnModal() {
    connOverlay.classList.add('show');
    resetConnForm();
    loadConnectionsList();
  }
  window.closeDbConnModal = function() { connOverlay.classList.remove('show'); };

  function resetConnForm() {
    editingConnId = null;
    connFormTitle.textContent = '添加连接';
    connName.value = '';
    connBaseUrl.value = '';
    connDatabase.value = '';
    connDeleteBtn.style.display = 'none';
    showResult(connFormResult, '', '');
  }

  async function loadConnectionsList() {
    connList.innerHTML = '<div class="db-empty-hint">加载中…</div>';
    try {
      const data = await api('/api/tools/db-admin/connections');
      connections = data.results || [];
      renderConnList();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      connList.innerHTML = '<div class="db-empty-hint">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function renderConnList() {
    if (connections.length === 0) {
      connList.innerHTML = '<div class="db-empty-hint">暂无连接，下方添加</div>';
      return;
    }
    connList.innerHTML = connections.map(c => {
      const url = c.database ? c.base_url + '/' + c.database : c.base_url;
      return '<div class="db-conn-row">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="db-conn-name">' + esc(c.name) + '</div>' +
          '<div class="db-conn-url">' + esc(url) + '</div>' +
        '</div>' +
        '<div class="db-conn-actions">' +
          '<button class="btn btn-outline btn-sm" data-edit="' + c.id + '">编辑</button>' +
        '</div>' +
      '</div>';
    }).join('');
    connList.querySelectorAll('button[data-edit]').forEach(b => {
      b.onclick = () => {
        const id = b.getAttribute('data-edit');
        const c = connections.find(x => x.id === id);
        if (!c) return;
        editingConnId = id;
        connFormTitle.textContent = '编辑连接';
        connName.value = c.name;
        connBaseUrl.value = c.base_url;
        connDatabase.value = c.database || '';
        connDeleteBtn.style.display = 'inline-block';
        showResult(connFormResult, '', '');
      };
    });
  }

  connDeleteBtn.onclick = async () => {
    if (!editingConnId) return;
    if (!confirm('确认删除此连接？')) return;
    try {
      await api('/api/tools/db-admin/connections/' + editingConnId, { method: 'DELETE' });
      toast('已删除', 'success');
      resetConnForm();
      loadConnectionsList();
      loadConnSelect();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  connTestBtn.onclick = async () => {
    const name = connName.value.trim();
    const baseUrl = connBaseUrl.value.trim();
    const database = connDatabase.value.trim();
    if (!name || !baseUrl) { showResult(connFormResult, '请填写名称和 Base URL', 'error'); return; }
    connTestBtn.disabled = true; connTestBtn.textContent = '测试中…';
    try {
      let result;
      if (editingConnId) {
        result = await api('/api/tools/db-admin/connections/' + editingConnId + '/test', { method: 'POST' });
      } else {
        const url = database ? baseUrl.replace(/\\/+$/, '') + '/' + database + '/query' : baseUrl.replace(/\\/+$/, '') + '/query';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'SELECT 1 AS ok', params: [] }),
        });
        let data; try { data = await res.json(); } catch { data = null; }
        result = { ok: res.ok, status: res.status, error: data?.error, sample: data?.results?.[0] };
      }
      if (result.ok) showResult(connFormResult, '✓ 连接成功 ' + (result.sample ? JSON.stringify(result.sample) : ''), 'ok');
      else showResult(connFormResult, '✗ ' + (result.error || ('HTTP ' + result.status)), 'error');
    } catch (e) {
      showResult(connFormResult, '✗ ' + e.message, 'error');
    } finally {
      connTestBtn.disabled = false; connTestBtn.textContent = '测试连接';
    }
  };

  connSaveBtn.onclick = async () => {
    const name = connName.value.trim();
    const baseUrl = connBaseUrl.value.trim();
    const database = connDatabase.value.trim();
    if (!name || !baseUrl) { showResult(connFormResult, '请填写名称和 Base URL', 'error'); return; }
    const body = { name, base_url: baseUrl, database };
    connSaveBtn.disabled = true; connSaveBtn.textContent = '保存中…';
    try {
      if (editingConnId) {
        await api('/api/tools/db-admin/connections/' + editingConnId, {
          method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
        });
      } else {
        await api('/api/tools/db-admin/connections', {
          method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
        });
      }
      toast('已保存', 'success');
      resetConnForm();
      loadConnectionsList();
      loadConnSelect();
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      showResult(connFormResult, '保存失败：' + e.message, 'error');
    } finally {
      connSaveBtn.disabled = false; connSaveBtn.textContent = '保存';
    }
  };

  // ─── 顶部按钮 ───
  manageBtn.onclick = showConnModal;
  refreshBtn.onclick = () => {
    if (!activeConnId) { toast('请先选择连接', 'error'); return; }
    loadTables();
  };

  // ─── 弹层点击外部关闭 ───
  connOverlay.onclick = (e) => { if (e.target === connOverlay) closeDbConnModal(); };
  rowOverlay.onclick = (e) => { if (e.target === rowOverlay) closeDbRowModal(); };
  createTableOverlay.onclick = (e) => { if (e.target === createTableOverlay) closeDbCreateTableModal(); };

  loadConnSelect();
}

// ─── 初始化 ───
initTheme();
bindFloatMenu();
verifyBtn.onclick = verifyToken;
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyToken(); });

// 自动验证已保存的令牌
if (token) {
  setBtnStatus('验证中…', 'loading', true);
  fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => {
      if (res.ok) {
        setVerifiedState();
        mainContent.classList.add('active');
        initTools();
      } else {
        resetVerifiedState();
        localStorage.removeItem('kbox_token');
        token = '';
      }
    })
    .catch(() => resetVerifiedState());
} else {
  resetVerifiedState();
}

// ═══ 工具：Cron 任务管理 ═══
function renderCronTool() {
  return \`
    <h2>⏰ 定时任务</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="cronNewBtn">+ 新建任务</button>
      <button class="btn btn-outline" id="cronRefreshBtn">刷新</button>
    </div>
    <div id="cronList"></div>
    <div class="disk-modal-overlay" id="cronModalOverlay">
      <div class="disk-modal" style="max-width:480px">
        <div class="disk-modal-header">
          <h3 id="cronModalTitle">新建任务</h3>
          <button class="disk-modal-close" onclick="closeCronModal()">✕</button>
        </div>
        <div class="disk-modal-body" id="cronModalBody"></div>
        <div class="disk-modal-footer">
          <button class="btn btn-primary" id="cronSaveBtn">保存</button>
          <button class="btn btn-outline" onclick="closeCronModal()">取消</button>
        </div>
      </div>
    </div>
  \`;
}

function mountCronTool() {
  const newBtn = $('cronNewBtn');
  const refreshBtn = $('cronRefreshBtn');
  if (newBtn) newBtn.onclick = () => renderCronEditor(null);
  if (refreshBtn) refreshBtn.onclick = () => loadCronTasks();
  loadCronTasks();
}

const CRON_ACTIONS = { news_crawl: '新闻抓取' };

async function loadCronTasks() {
  const list = $('cronList');
  if (!list) return;
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const data = await api('/api/cron-tasks');
    if (!data.tasks || data.tasks.length === 0) {
      list.innerHTML = '<div class="empty">暂无任务</div>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>名称</th><th>类型</th><th>触发小时</th><th>启用</th><th>上次执行</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    for (const t of data.tasks) {
      const statusBadge = t.lastStatus === 'ok' ? '<span class="badge badge-ok">OK</span>'
        : t.lastStatus === 'error' ? '<span class="badge badge-err">ERR</span>'
        : '<span class="badge">-</span>';
      const lastRun = t.lastRunAt ? new Date(t.lastRunAt).toLocaleString('zh-CN') : '从未';
      const errTip = t.lastError ? ' title="' + esc(t.lastError) + '"' : '';
      const actionLabel = CRON_ACTIONS[t.action] || t.action || '-';
      const hours = Array.isArray(t.hours) ? t.hours : [];
      const hoursText = hours.length === 0 ? '每小时' : hours.map(h => String(h).padStart(2, '0')).join(',');
      html += '<tr' + errTip + '><td>' + esc(t.name) + '</td><td>' + esc(actionLabel) + '</td><td>' + esc(hoursText) + '</td><td>' + (t.enabled ? '✓' : '✗') + '</td><td>' + esc(lastRun) + '</td><td>' + statusBadge + '</td><td class="row-actions"><button class="btn btn-outline btn-sm" onclick="triggerCronTask(\\'' + t.id + '\\')">运行</button><button class="btn btn-outline btn-sm" onclick="renderCronEditor(\\'' + t.id + '\\')">编辑</button><button class="btn btn-sm btn-danger" onclick="deleteCronTask(\\'' + t.id + '\\')">删除</button></td></tr>';
    }
    html += '</tbody></table>';
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

window.triggerCronTask = async function(id) {
  toast('执行中...', 'info');
  try {
    const r = await api('/api/cron-tasks/' + id + '/trigger', { method: 'POST' });
    if (r.ok) toast('执行成功', 'success');
    else toast('执行失败：' + (r.error || '未知错误'), 'error');
  } catch (e) {
    toast('执行失败：' + e.message, 'error');
  }
  loadCronTasks();
}

window.deleteCronTask = async function(id) {
  if (!confirm('确认删除该任务？')) return;
  try {
    await api('/api/cron-tasks/' + id, { method: 'DELETE' });
    toast('已删除', 'success');
    loadCronTasks();
  } catch (e) {
    toast('删除失败：' + e.message, 'error');
  }
}

window.closeCronModal = function() {
  const ov = $('cronModalOverlay');
  if (ov) ov.classList.remove('show');
};

window.renderCronEditor = async function(id) {
  const ov = $('cronModalOverlay');
  const body = $('cronModalBody');
  const title = $('cronModalTitle');
  if (!ov || !body) return;
  let task = null;
  if (id) {
    try {
      const data = await api('/api/cron-tasks');
      task = data.tasks.find(t => t.id === id);
    } catch (e) { toast('加载失败：' + e.message, 'error'); return; }
  }
  title.textContent = task ? '编辑任务' : '新建任务';
  let actionOptions = '';
  for (const k in CRON_ACTIONS) {
    actionOptions += '<option value="' + k + '"' + (task && task.action === k ? ' selected' : '') + '>' + esc(CRON_ACTIONS[k]) + '</option>';
  }
  const curHours = (task && Array.isArray(task.hours)) ? task.hours : [];
  let hoursCheckboxes = '';
  for (let h = 0; h < 24; h++) {
    const checked = curHours.includes(h) ? ' checked' : '';
    hoursCheckboxes += '<label class="hour-chip"><input type="checkbox" value="' + h + '"' + checked + '><span>' + String(h).padStart(2, '0') + '</span></label>';
  }
  body.innerHTML = \`
    <div class="form-group">
      <label>名称</label>
      <input type="text" id="cronName" value="\${task ? esc(task.name) : ''}" placeholder="任务名">
    </div>
    <div class="form-group">
      <label>类型</label>
      <select id="cronAction">\${actionOptions}</select>
    </div>
    <div class="form-group">
      <label>触发小时（北京时间，不选则每小时）</label>
      <div class="hour-grid" id="cronHours">\${hoursCheckboxes}</div>
    </div>
    <div class="form-group">
      <label class="check-row"><input type="checkbox" id="cronEnabled" \${(!task || task.enabled) ? 'checked' : ''}> 启用</label>
    </div>
  \`;
  ov.classList.add('show');
  $('cronSaveBtn').onclick = async () => {
    const hours = Array.from(document.querySelectorAll('#cronHours input:checked')).map(el => Number(el.value));
    const body = {
      name: $('cronName').value.trim() || '未命名任务',
      action: $('cronAction').value,
      hours,
      enabled: $('cronEnabled').checked,
    };
    try {
      if (task) {
        await api('/api/cron-tasks/' + task.id, { method: 'PUT', body: JSON.stringify(body), headers: {'Content-Type':'application/json'} });
      } else {
        await api('/api/cron-tasks', { method: 'POST', body: JSON.stringify(body), headers: {'Content-Type':'application/json'} });
      }
      toast('已保存', 'success');
      closeCronModal();
      loadCronTasks();
    } catch (e) {
      toast('保存失败：' + e.message, 'error');
    }
  };
}

// ═══ 工具：JS 运行工具 ═══
function renderJsTool() {
  return \`
    <h2>📜 JS 运行工具</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="jsNewBtn">+ 新建脚本</button>
      <button class="btn btn-outline" id="jsRefreshBtn">刷新</button>
    </div>
    <div class="section-title">脚本列表</div>
    <div id="jsScriptsList"></div>
    <div class="section-title" style="margin-top:24px">临时运行</div>
    <details style="margin-bottom:12px">
      <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);padding:4px 0">使用说明 / kbox API</summary>
      <div style="padding:12px 14px;background:var(--card);border-radius:8px;margin-top:8px;font-size:13px;line-height:1.7;color:var(--text-secondary)">
        <p style="color:var(--text);font-weight:600;margin-bottom:6px">可直接使用</p>
        <p><code>console.log(...)</code> — 输出到下方结果区</p>
        <p><code>await kbox.log(...)</code> — 同上</p>
        <p><code>await kbox.fetch(url, opts)</code> — 发起 HTTP 请求</p>
        <p><code>await kbox.sleep(ms)</code> — 等待</p>
        <p><code>kbox.now()</code> — 当前时间</p>
        <p style="color:var(--text);font-weight:600;margin:10px 0 6px">数据读写</p>
        <p><code>await kbox.kv.get(ns, key)</code> · <code>kbox.kv.set(ns, key, val)</code></p>
        <p><code>await kbox.kv.list(ns)</code> · <code>kbox.kv.delete(ns, key)</code></p>
        <p style="color:var(--text-muted);font-size:12px">系统 namespace 不可写入</p>
        <p style="color:var(--text);font-weight:600;margin:10px 0 6px">内置数据源</p>
        <p><code>await kbox.news.list(10)</code> — 返回新闻数组</p>
        <p><code>await kbox.news.top()</code> — 返回热词数组</p>
        <p><code>await kbox.stock.funds()</code> — 返回基金数组</p>
        <p><code>await kbox.disk.files()</code> — 返回文件数组</p>
        <p><code>await kbox.disk.stats()</code> — 返回容量统计</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:10px">执行超时 5s，可用 return 返回值</p>
      </div>
    </details>
    <textarea id="jsCodeInput" class="sql-editor" rows="10" placeholder="// 试试：console.log('hello world')" style="margin-top:8px"></textarea>
    <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap">
      <button class="btn btn-primary" id="jsRunTmpBtn">▶ 运行</button>
      <button class="btn btn-outline" id="jsSaveAsBtn">存为脚本</button>
    </div>
    <div class="result-box" id="jsTmpResult"></div>
    <div class="disk-modal-overlay" id="jsModalOverlay">
      <div class="disk-modal" style="max-width:680px">
        <div class="disk-modal-header">
          <h3 id="jsModalTitle">新建脚本</h3>
          <button class="disk-modal-close" onclick="closeJsModal()">✕</button>
        </div>
        <div class="disk-modal-body" id="jsModalBody"></div>
        <div class="disk-modal-footer">
          <button class="btn btn-primary" id="jsSaveBtn">保存</button>
          <button class="btn btn-outline" onclick="closeJsModal()">取消</button>
        </div>
      </div>
    </div>
  \`;
}

function mountJsTool() {
  const newBtn = $('jsNewBtn');
  const refreshBtn = $('jsRefreshBtn');
  if (newBtn) newBtn.onclick = () => renderJsEditor(null);
  if (refreshBtn) refreshBtn.onclick = () => loadJsScripts();
  const runBtn = $('jsRunTmpBtn');
  if (runBtn) runBtn.onclick = () => runJsTmp();
  const saveAsBtn = $('jsSaveAsBtn');
  if (saveAsBtn) saveAsBtn.onclick = () => saveAsScript();
  loadJsScripts();
}

async function loadJsScripts() {
  const list = $('jsScriptsList');
  if (!list) return;
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const data = await api('/api/tools/js/scripts');
    if (!data.scripts || data.scripts.length === 0) {
      list.innerHTML = '<div class="empty">暂无脚本</div>';
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>名称</th><th>已发布</th><th>上次运行</th><th>操作</th></tr></thead><tbody>';
    for (const s of data.scripts) {
      const lastRun = s.last_run ? new Date(s.last_run.at).toLocaleString('zh-CN') + ' (' + (s.last_run.status === 'ok' ? 'OK' : 'ERR') + ')' : '从未';
      html += '<tr><td>' + esc(s.icon) + ' ' + esc(s.name) + '</td><td>' + (s.published ? '✓' : '✗') + '</td><td>' + esc(lastRun) + '</td><td class="row-actions"><button class="btn btn-outline btn-sm" onclick="runJsScript(\\'' + s.id + '\\')">运行</button><button class="btn btn-outline btn-sm" onclick="toggleJsPublish(\\'' + s.id + '\\', ' + !s.published + ')">' + (s.published ? '取消发布' : '发布') + '</button><button class="btn btn-outline btn-sm" onclick="renderJsEditor(\\'' + s.id + '\\')">编辑</button><button class="btn btn-sm btn-danger" onclick="deleteJsScript(\\'' + s.id + '\\')">删除</button></td></tr>';
    }
    html += '</tbody></table>';
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

// ─── 前端 JS 执行引擎（Workers 禁止 eval/new Function，故在浏览器执行） ───
function formatLogArg(a) {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
  return String(a);
}

function buildFrontendKbox(logs) {
  const log = (...args) => logs.push(args.map(formatLogArg).join(' '));
  return {
    log,
    now: () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    fetch: (url, opts) => fetch(url, opts),
    kv: {
      get: async (ns, key) => {
        const d = await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key));
        return d.value;
      },
      set: async (ns, key, value) => {
        await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key), {
          method: 'POST', body: JSON.stringify({ value }), headers: { 'Content-Type': 'application/json' },
        });
      },
      delete: async (ns, key) => {
        await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key), { method: 'DELETE' });
      },
      list: async (ns) => {
        const d = await api('/api/tools/js/kv/' + encodeURIComponent(ns));
        return d.items || [];
      },
    },
    news: {
      list: async (limit) => {
        const d = await api('/api/tools/news/list' + (limit ? '?limit=' + limit : ''));
        return d.results || [];
      },
      top: async () => {
        const d = await api('/api/tools/news/top');
        return d.keywords || [];
      },
    },
    stock: { funds: async () => (await api('/api/tools/stock/funds')).results || [] },
    disk: {
      files: async () => (await api('/api/tools/disk/files')).files || [],
      stats: async () => api('/api/tools/disk/stats'),
    },
  };
}

async function executeJsCode(code, params = {}) {
  const logs = [];
  const kbox = buildFrontendKbox(logs);
  const sandboxConsole = { log: kbox.log, info: kbox.log, warn: kbox.log, error: kbox.log, debug: kbox.log };
  const started = Date.now();
  const paramNames = Object.keys(params);
  const wrapped = \`
    const { log, fetch, kv, news, stock, disk, now, sleep } = kbox;
    const { \${paramNames.join(', ')} } = params;
    return (async () => {
      \${code}
    })();
  \`;
  try {
    const fn = new Function('kbox', 'console', 'params', wrapped);
    const result = await Promise.race([
      fn(kbox, sandboxConsole, params),
      new Promise((_, rej) => setTimeout(() => rej(new Error('执行超时（5s）')), 5000)),
    ]);
    return { logs, result: result === undefined ? null : result };
  } catch (e) {
    return { logs, error: { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined } };
  }
}

async function runJsTmp() {
  const code = ($('jsCodeInput')?.value) || '';
  const resultBox = $('jsTmpResult');
  if (!resultBox) return;
  resultBox.classList.add('show');
  resultBox.innerHTML = '<div class="empty">运行中…</div>';
  const r = await executeJsCode(code, {});
  resultBox.innerHTML = formatJsResult(r);
}

window.runJsScript = async function(id) {
  const resultBox = $('jsTmpResult');
  if (resultBox) {
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="empty">运行中…</div>';
  }
  try {
    const data = await api('/api/tools/js/scripts/' + id);
    const script = data.script;
    if (!script) { toast('脚本不存在', 'error'); return; }
    const r = await executeJsCode(script.code, {});
    if (resultBox) resultBox.innerHTML = formatJsResult(r);
    // 记录 last_run
    api('/api/tools/js/scripts/' + id + '/record-run', {
      method: 'POST',
      body: JSON.stringify({ status: r.error ? 'error' : 'ok', error: r.error?.message }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
    toast(r.error ? '执行出错' : '执行完成', r.error ? 'error' : 'success');
    loadJsScripts();
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return;
    if (resultBox) resultBox.innerHTML = formatJsResult({ logs: [], error: { message: e.message } });
    toast('运行失败', 'error');
  }
}

window.toggleJsPublish = async function(id, publish) {
  try {
    await api('/api/tools/js/scripts/' + id + '/publish', { method: 'POST', body: JSON.stringify({ published: publish }), headers: {'Content-Type':'application/json'} });
    toast(publish ? '已发布到首页' : '已取消发布', 'success');
    loadJsScripts();
    loadPublishedScripts();
  } catch (e) {
    toast('操作失败：' + e.message, 'error');
  }
}

window.deleteJsScript = async function(id) {
  if (!confirm('确认删除该脚本？')) return;
  try {
    await api('/api/tools/js/scripts/' + id, { method: 'DELETE' });
    toast('已删除', 'success');
    loadJsScripts();
    loadPublishedScripts();
  } catch (e) {
    toast('删除失败：' + e.message, 'error');
  }
}

async function saveAsScript() {
  const code = ($('jsCodeInput')?.value) || '';
  if (!code.trim()) { toast('代码不能为空', 'error'); return; }
  const name = prompt('脚本名称：', '未命名脚本');
  if (name === null) return;
  try {
    await api('/api/tools/js/scripts', { method: 'POST', body: JSON.stringify({ name: name || '未命名脚本', code, icon: '📝', published: false }), headers: {'Content-Type':'application/json'} });
    toast('已保存', 'success');
    loadJsScripts();
  } catch (e) {
    toast('保存失败：' + e.message, 'error');
  }
}

window.closeJsModal = function() {
  const ov = $('jsModalOverlay');
  if (ov) ov.classList.remove('show');
};

window.renderJsEditor = async function(id) {
  const ov = $('jsModalOverlay');
  const body = $('jsModalBody');
  const title = $('jsModalTitle');
  if (!ov || !body) return;
  let script = null;
  if (id) {
    try {
      const data = await api('/api/tools/js/scripts/' + id);
      script = data.script;
    } catch (e) { toast('加载失败：' + e.message, 'error'); return; }
  }
  title.textContent = script ? '编辑脚本' : '新建脚本';
  body.innerHTML = \`
    <div class="form-group">
      <label>名称</label>
      <input type="text" id="jsName" value="\${script ? esc(script.name) : ''}" placeholder="脚本名">
    </div>
    <div class="form-group">
      <label>描述</label>
      <input type="text" id="jsDesc" value="\${script ? esc(script.desc) : ''}" placeholder="简短描述">
    </div>
    <div class="form-group">
      <label>图标（emoji）</label>
      <input type="text" id="jsIcon" value="\${script ? esc(script.icon) : '📝'}" maxlength="4">
    </div>
    <div class="form-group">
      <label>代码</label>
      <textarea id="jsCode" class="sql-editor" rows="12" placeholder="// 输入代码">\${script ? esc(script.code) : ''}</textarea>
    </div>
    <div class="form-group">
      <label class="check-row"><input type="checkbox" id="jsPublished" \${script && script.published ? 'checked' : ''}> 发布到首页</label>
    </div>
  \`;
  ov.classList.add('show');
  $('jsSaveBtn').onclick = async () => {
    const payload = {
      name: $('jsName').value.trim() || '未命名脚本',
      desc: $('jsDesc').value.trim(),
      icon: $('jsIcon').value.trim() || '📝',
      code: $('jsCode').value,
      published: $('jsPublished').checked,
    };
    try {
      if (script) {
        await api('/api/tools/js/scripts/' + script.id, { method: 'PUT', body: JSON.stringify(payload), headers: {'Content-Type':'application/json'} });
      } else {
        await api('/api/tools/js/scripts', { method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type':'application/json'} });
      }
      toast('已保存', 'success');
      closeJsModal();
      loadJsScripts();
      loadPublishedScripts();
    } catch (e) {
      toast('保存失败：' + e.message, 'error');
    }
  };
}

function formatJsResult(r) {
  // 输出区：使用和输入框一样的 sql-editor 风格，只读显示
  const lines = [];
  if (r.logs && r.logs.length > 0) {
    lines.push(...r.logs);
  }
  if (r.result !== null && r.result !== undefined) {
    lines.push('▶ 返回值: ' + JSON.stringify(r.result, null, 2));
  }
  if (r.error) {
    lines.push('✗ 错误: ' + r.error.message);
    if (r.error.stack) lines.push(r.error.stack);
  }
  if (lines.length === 0) {
    lines.push('（无输出）');
  }
  let html = '<div class="section-title">输出</div>';
  html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:80px;cursor:default;color:' + (r.error ? '#ef4444' : 'var(--text)') + '">' + esc(lines.join('\\n')) + '</div>';
  if (r.truncated) html += '<p class="subtitle">输出已截断</p>';
  return html;
}

// ─── 已发布脚本动态注入首页 ───
async function loadPublishedScripts() {
  try {
    const data = await api('/api/tools/js/published');
    publishedScripts = data.scripts || [];
  } catch {
    publishedScripts = [];
  }
  // 重新渲染首页（合并静态 TOOLS + 动态脚本）
  renderToolGrid();
  // 为每个已发布脚本挂载 view
  ensureScriptViews();
}

function ensureScriptViews() {
  for (const s of publishedScripts) {
    const viewId = 'view-script:' + s.id;
    if ($(viewId)) continue;
    const div = document.createElement('div');
    div.className = 'tool-view';
    div.id = viewId;
    div.innerHTML = renderScriptRunView(s);
    toolViews.appendChild(div);
    mountScriptRunView(s.id);
  }
}

function renderScriptRunView(s) {
  return \`
    <h2>\${esc(s.icon)} \${esc(s.name)}</h2>
    <div style="margin:12px 0">
      <button class="btn btn-primary" id="scriptRunBtn-\${s.id}">▶ 运行</button>
    </div>
    <div class="result-box" id="scriptResult-\${s.id}"></div>
  \`;
}

function mountScriptRunView(scriptId) {
  const btn = $('scriptRunBtn-' + scriptId);
  if (!btn) return;
  btn.onclick = async () => {
    const resultBox = $('scriptResult-' + scriptId);
    if (!resultBox) return;
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="empty">运行中…</div>';
    try {
      const data = await api('/api/tools/js/scripts/' + scriptId);
      const script = data.script;
      if (!script) { resultBox.innerHTML = formatJsResult({ logs: [], error: { message: '脚本不存在' } }); return; }
      const r = await executeJsCode(script.code, {});
      resultBox.innerHTML = formatJsResult(r);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.innerHTML = formatJsResult({ logs: [], error: { message: e.message } });
    }
  };
}
</script>
</body>
</html>`;
}
