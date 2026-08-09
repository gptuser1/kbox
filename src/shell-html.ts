export function renderShellHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kbox</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/responsive.css">
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

<!-- 右侧浮动菜单（按钮自身膨胀展开） -->
<div class="float-menu-container" id="floatMenuBtn">
  <svg class="fm-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/>
  </svg>
  <div class="fm-items">
    <div class="fm-section">
      <div class="fm-label">主题</div>
      <div class="fm-btn-group" id="fmThemeSwitcher">
        <button data-theme="light" title="亮色">☀️</button>
        <button data-theme="auto" title="跟随">🖥️</button>
        <button data-theme="dark" title="暗色">🌙</button>
      </div>
    </div>
    <div class="fm-section">
      <div class="fm-label">视图</div>
      <div class="fm-btn-group" id="fmViewSwitcher">
        <button data-mode="grid" title="大图标">▦</button>
        <button data-mode="compact" title="小图标">≡</button>
        <button data-mode="list" title="详细">☰</button>
      </div>
    </div>
    <div class="fm-section">
      <div class="fm-label">操作</div>
      <div class="fm-btn-group">
        <button id="fmEditBtn">✎ 自定义布局</button>
        <button id="fmExitEditBtn" style="display:none">✓ 完成编辑</button>
      </div>
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
<div class="modal-overlay" id="toolEditOverlay">
  <div class="modal" style="max-width:420px">
    <div class="modal-header">
      <h3>编辑工具</h3>
      <button class="modal-close" onclick="closeToolEdit()">✕</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeToolEdit()">取消</button>
      <button class="btn btn-primary" id="toolEditSave">保存</button>
    </div>
  </div>
</div>

<!-- 通用确认弹窗（替代浏览器原生 confirm）-->
<div class="modal-overlay" id="confirmOverlay">
  <div class="modal" style="max-width:400px">
    <div class="modal-header">
      <h3 id="confirmTitle">确认</h3>
      <button class="modal-close" id="confirmCloseBtn">✕</button>
    </div>
    <div class="modal-body" id="confirmBody"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" id="confirmCancelBtn">取消</button>
      <button class="btn btn-danger" id="confirmOkBtn">确认</button>
    </div>
  </div>
</div>

<script src="/lib/light-chart.min.js"></script>
<script type="module" src="/js/shell.js"></script>
</body>
</html>`;
}
