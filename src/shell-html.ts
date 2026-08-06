export function renderShellHTML(): string {
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

/* ─── 加载层（首屏全屏 + 工具区，统一视觉）─── */
/* 首屏：inline 在 body 最前，DOM 解析即渲染，不依赖 JS；z-index 9999 盖住一切 */
.app-loader {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px;
  background: var(--bg);
  transition: opacity 0.3s ease;
}
.app-loader.hide { opacity: 0; pointer-events: none; }
.app-loader__mark {
  font-size: 26px; font-weight: 700; letter-spacing: 3px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: appLoaderPulse 1.8s ease-in-out infinite;
}
.app-loader__bar {
  width: 120px; height: 3px; border-radius: 2px;
  background: var(--border); position: relative; overflow: hidden;
}
.app-loader__bar::after {
  content: ''; position: absolute; top: 0; left: -40%;
  width: 40%; height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  animation: appLoaderSweep 1.4s ease-in-out infinite;
}
@keyframes appLoaderPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
@keyframes appLoaderSweep { 0% { left: -40%; } 100% { left: 100%; } }

/* 工具视图加载（区域级，不全屏，保留 token 栏与浮动按钮）*/
.tool-loader {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 100px 0;
}
.tool-loader .app-loader__bar { width: 80px; }
.tool-loader__text { color: var(--text-muted); font-size: 13px; letter-spacing: 0.5px; }
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

<!-- 首屏加载层：body 最前，DOM 解析即渲染，盖住一切；后端响应+前端渲染完成后由 shell.ts 淡出 -->
<div class="app-loader" id="appLoader">
  <div class="app-loader__mark">kbox</div>
  <div class="app-loader__bar"></div>
</div>

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

<script type="module" src="/js/shell.js"></script>
</body>
</html>`;
}
