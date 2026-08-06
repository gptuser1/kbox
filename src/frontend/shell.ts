// 壳：浏览器端全局逻辑。令牌/主题/菜单/首页网格/工具懒加载调度。
// 关键：showTool 动态 import 工具模块并 try-catch 包裹——单工具 JS 出错只 toast，
// 不影响壳和其他工具，实现故障隔离。
import { $, esc, toast, api, setToken, setUnauthorizedHandler, initToast } from './shared.js';
import { TOOL_REGISTRY } from './registry.js';

export interface ToolModule {
  render(id?: string): string;
  mount(id?: string): void;
}

// ─── 全局状态 ───
const THEME_KEY = 'kbox_theme';
let homeLayout: { viewMode: string; order: string[]; overrides: Record<string, any> } = { viewMode: 'grid', order: [], overrides: {} };
let editMode = false;
let publishedScripts: any[] = [];
let editingToolId: string | null = null;
const toolModuleCache: Record<string, ToolModule> = {};

// DOM 引用（script type=module 自带 defer，DOM 已就绪）
const tokenInput = $('tokenInput') as HTMLInputElement;
const verifyBtn = $('verifyBtn') as HTMLButtonElement;
const mainContent = $('mainContent');
const toolGrid = $('toolGrid');
const toolViews = $('toolViews');

const EMOJI_CHOICES = ['⚡','☁️','💰','📰','🗄️','⚙️','🔧','📊','📅','🎯','🚀','📦','🔍','📈','💡','🛠️','🌐','📝','🔔','📁'];

function errMsg(e: any): string { return e instanceof Error ? e.message : String(e); }

// ─── 主题 ───
function applyTheme(theme: string) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}
function updateThemeButtons(theme: string) {
  document.querySelectorAll('[id$="ThemeSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-theme') === theme);
    });
  });
}
function setTheme(theme: string) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  updateThemeButtons(theme);
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(saved);
  updateThemeButtons(saved);
}

// ─── 浮动菜单（按钮自身膨胀展开 + 主题切换） ───
function bindFloatMenu() {
  document.querySelectorAll('[id$="ThemeSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => setTheme(b.getAttribute('data-theme') || 'auto'));
    });
  });
  const fmc = $('floatMenuBtn');
  if (fmc) {
    fmc.addEventListener('click', (e) => {
      if (fmc.classList.contains('open')) return; // 展开后点击菜单项由各自 handler 处理
      e.stopPropagation();
      fmc.classList.add('open');
    });
    document.addEventListener('click', (e) => {
      if (!fmc.classList.contains('open')) return;
      if (fmc.contains(e.target as Node)) return;
      fmc.classList.remove('open');
    });
  }
}

// ─── 令牌 ───
function setBtnStatus(text: string, cls: string, disabled?: boolean) {
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
    setToken('');
    resetVerifiedState();
    mainContent.classList.remove('active');
    toast('已退出', 'info');
  }
}
async function verifyToken() {
  const t = tokenInput.value.trim();
  if (!t) { setBtnStatus('请输入', 'err'); tokenInput.focus(); return; }
  setBtnStatus('验证中…', 'loading', true);
  try {
    const res = await fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + t } });
    if (res.ok) {
      localStorage.setItem('kbox_token', t);
      setToken(t);
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

// ─── 首页布局偏好 ───
async function saveHomeLayout() {
  try {
    await api('/api/preferences/home_layout', {
      method: 'PUT',
      body: JSON.stringify({ value: homeLayout }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    if (e.message !== 'UNAUTHORIZED') toast('布局保存失败：' + errMsg(e), 'error');
  }
}
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
  } catch (e: any) {
    if (e.message !== 'UNAUTHORIZED') console.error('load home layout failed', e);
  }
  document.querySelectorAll('[id$="ViewSwitcher"] button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === homeLayout.viewMode);
  });
  await loadPublishedScripts();
}

// ─── 已发布脚本（动态注入首页卡片） ───
async function loadPublishedScripts() {
  try {
    const data = await api('/api/tools/js/published');
    publishedScripts = data.scripts || [];
  } catch {
    publishedScripts = [];
  }
  renderToolGrid();
}

// ─── 工具元数据查询（应用用户覆盖） ───
function findScriptById(id: string): any {
  const m = id.match(/^script:(.+)$/);
  if (!m) return null;
  return publishedScripts.find(s => s.id === m[1]) || null;
}
function toolName(id: string): string {
  if (homeLayout.overrides[id]?.name) return homeLayout.overrides[id].name;
  const t = TOOL_REGISTRY.find(t => t.id === id);
  if (t) return t.name;
  const s = findScriptById(id);
  if (s) return s.name;
  return id;
}
function toolIcon(id: string): string {
  if (homeLayout.overrides[id]?.icon) return homeLayout.overrides[id].icon;
  const t = TOOL_REGISTRY.find(t => t.id === id);
  if (t) return t.icon;
  const s = findScriptById(id);
  if (s) return s.icon;
  return '□';
}
function toolHidden(id: string): boolean { return !!homeLayout.overrides[id]?.hidden; }
function toolDesc(id: string): string {
  const t = TOOL_REGISTRY.find(t => t.id === id);
  if (t) return t.desc;
  const s = findScriptById(id);
  if (s) return s.desc || '用户脚本';
  return '';
}
function allToolIds(): string[] {
  const ids = TOOL_REGISTRY.map(t => t.id);
  for (const s of publishedScripts) ids.push('script:' + s.id);
  return ids;
}
function orderedTools(): string[] {
  const ids = allToolIds();
  const ordered: string[] = [];
  for (const id of homeLayout.order) if (ids.includes(id)) ordered.push(id);
  for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
}

// ─── 首页网格 ───
function renderToolGrid() {
  toolGrid.className = 'tool-grid view-' + homeLayout.viewMode;
  const ids = orderedTools();
  let html = '';
  for (const id of ids) {
    const name = esc(toolName(id));
    const icon = toolIcon(id);
    const desc = esc(toolDesc(id));
    const hiddenCls = toolHidden(id) ? ' hidden-tool' : '';
    const editCls = editMode ? ' editing' : '';
    const clickAttr = editMode ? '' : ' onclick="showTool(\'' + id + '\')"';
    const actions = editMode
      ? '<div class="tool-card-actions">' +
        '<button title="编辑" onclick="event.stopPropagation();openToolEdit(\'' + id + '\')">✎</button>' +
        '<button title="上移" onclick="event.stopPropagation();moveTool(\'' + id + '\',-1)">↑</button>' +
        '<button title="下移" onclick="event.stopPropagation();moveTool(\'' + id + '\',1)">↓</button>' +
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

// ─── 工具卡片编辑 ───
(window as any).openToolEdit = function(id: string) {
  editingToolId = id;
  const defaultName = toolName(id);
  const hasOverride = !!homeLayout.overrides[id]?.name;
  const nameEl = $('toolEditName') as HTMLInputElement;
  nameEl.value = hasOverride ? defaultName : '';
  nameEl.placeholder = defaultName;
  ($('toolEditIconInput') as HTMLInputElement).value = (homeLayout.overrides[id]?.icon) || '';
  ($('toolEditHidden') as HTMLInputElement).checked = toolHidden(id);
  $('toolEditIconPicker').innerHTML = EMOJI_CHOICES.map(e =>
    '<span style="font-size:22px;cursor:pointer;padding:4px 6px;border-radius:6px" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'none\'" onclick="pickEmoji(\'' + e + '\')">' + e + '</span>'
  ).join('');
  $('toolEditOverlay').classList.add('show');
};
(window as any).pickEmoji = function(e: string) {
  ($('toolEditIconInput') as HTMLInputElement).value = e;
};
(window as any).closeToolEdit = function() {
  $('toolEditOverlay').classList.remove('show');
  editingToolId = null;
};
(window as any).moveTool = function(id: string, dir: number) {
  const order = orderedTools();
  const i = order.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  homeLayout.order = order;
  saveHomeLayout();
  renderToolGrid();
};
$('toolEditOverlay')?.addEventListener('click', (e) => { if (e.target === $('toolEditOverlay')) (window as any).closeToolEdit(); });
$('toolEditSave')?.addEventListener('click', async () => {
  if (!editingToolId) return;
  const id = editingToolId;
  const name = ($('toolEditName') as HTMLInputElement).value.trim();
  const icon = ($('toolEditIconInput') as HTMLInputElement).value.trim();
  const hidden = ($('toolEditHidden') as HTMLInputElement).checked;
  let origName = toolName(id), origIcon = toolIcon(id);
  const t = TOOL_REGISTRY.find(t => t.id === id);
  if (t) { origName = t.name; origIcon = t.icon; }
  else { const s = findScriptById(id); if (s) { origName = s.name; origIcon = s.icon; } }
  const ov: any = {};
  if (name && name !== origName) ov.name = name;
  if (icon && icon !== origIcon) ov.icon = icon;
  if (hidden) ov.hidden = true;
  if (Object.keys(ov).length === 0) delete homeLayout.overrides[id];
  else homeLayout.overrides[id] = ov;
  await saveHomeLayout();
  (window as any).closeToolEdit();
  renderToolGrid();
  toast('已保存', 'success');
});

// ─── 视图切换 / 编辑模式 ───
function bindHomeToolbar() {
  function onViewModeChange(mode: string) {
    homeLayout.viewMode = mode;
    document.querySelectorAll('[id$="ViewSwitcher"] button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    saveHomeLayout();
    renderToolGrid();
  }
  document.querySelectorAll('[id$="ViewSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => onViewModeChange(btn.getAttribute('data-mode') || 'grid'));
    });
  });
  function setEditModeUI(on: boolean) {
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
}

// ─── 工具懒加载（核心隔离机制） ───
// 动态 import 工具模块；render/mount 各自 try-catch，单工具失败只 toast，不波及壳与其他工具。
// 进入时立即显示 tool-loader 覆盖工具区，掩盖 import/render/mount 的延迟。
async function showTool(id: string) {
  toolGrid.style.display = 'none';
  const hgw = $('homeGridWrap'); if (hgw) hgw.style.display = 'none';
  toolViews.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'tool-view active';
  view.id = 'view-' + id;
  toolViews.appendChild(view);
  $('floatBack').classList.add('show');
  $('floatMenuBtn')?.classList.remove('open');
  // 进入工具页：隐藏首页菜单按钮（视图切换/自定义布局仅对首页有意义，避免在工具页误点）
  const fmb = $('floatMenuBtn'); if (fmb) fmb.style.display = 'none';

  // 立即显示工具加载层（区域级，不全屏，保留 token 栏与浮动按钮）
  view.innerHTML = '<div class="tool-loader"><div class="app-loader__bar"></div><div class="tool-loader__text">加载中…</div></div>';

  // script:xxx 复用 js 工具模块渲染
  const realId = id.startsWith('script:') ? 'js' : id;

  let mod = toolModuleCache[realId];
  if (!mod) {
    try {
      mod = (await import('/js/tools/' + realId + '.js')) as ToolModule;
      toolModuleCache[realId] = mod;
    } catch (e) {
      toast('工具加载失败：' + errMsg(e), 'error');
      view.innerHTML = '<div style="padding:24px;color:var(--danger)">工具加载失败：' + esc(errMsg(e)) + '</div>';
      return;
    }
  }
  try {
    view.innerHTML = mod.render(id);
  } catch (e) {
    toast('工具渲染失败：' + errMsg(e), 'error');
    view.innerHTML = '<div style="padding:24px;color:var(--danger)">工具渲染失败：' + esc(errMsg(e)) + '</div>';
    return;
  }
  try {
    mod.mount(id);
  } catch (e) {
    toast('工具初始化失败：' + errMsg(e), 'error');
    // mount 失败不抛出：壳与其他工具继续可用
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToGrid() {
  toolViews.innerHTML = '';
  toolGrid.style.display = 'grid';
  const hgw = $('homeGridWrap'); if (hgw) hgw.style.display = '';
  $('floatBack').classList.remove('show');
  $('floatMenuBtn')?.classList.remove('open');
  // 回到首页：恢复菜单按钮显示
  const fmb = $('floatMenuBtn'); if (fmb) fmb.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── 首屏加载层 ───
// appLoader 在 HTML 中 inline 于 body 最前，DOM 解析即渲染（最高优先级，盖住一切）。
// token 验证通过 + 主页布局加载渲染完成后淡出；验证失败/无 token 时立即淡出露出 token 栏。
function hideAppLoader() {
  const loader = $('appLoader');
  if (!loader || loader.classList.contains('hide')) return;
  loader.classList.add('hide');
  setTimeout(() => loader.remove(), 350);
}

// ─── 初始化工具区 ───
function initTools() {
  bindHomeToolbar();
  // 先在网格区显示加载层，掩盖布局偏好加载期间的空白与布局跳变
  toolGrid.innerHTML = '<div class="tool-loader" style="grid-column:1/-1"><div class="app-loader__bar"></div><div class="tool-loader__text">加载中…</div></div>';
  loadHomeLayout().finally(() => {
    // loadHomeLayout 内部正常会 renderToolGrid；此处兜底确保渲染
    if (toolGrid.querySelector('.tool-loader')) renderToolGrid();
    hideAppLoader();
  });
}

// ─── 浮动按钮定位（返回按钮钉在可视区域底部） ───
(function pinFloatButtons() {
  const fb = document.getElementById('floatBack');
  if (!fb) return;
  function pin() {
    const top = window.innerHeight - 48 - 24;
    const pinTop = Math.max(24, top) + 'px';
    if (fb.classList.contains('show')) fb.style.top = pinTop;
  }
  window.addEventListener('scroll', pin, { passive: true });
  window.addEventListener('resize', pin);
  const obs = new MutationObserver(pin);
  obs.observe(fb, { attributes: true, attributeFilter: ['class'] });
  pin();
})();

// ─── 入口 ───
initToast($('toastContainer'));
setUnauthorizedHandler(() => {
  localStorage.removeItem('kbox_token');
  setToken('');
  resetVerifiedState();
  mainContent.classList.remove('active');
  toast('令牌已失效，请重新验证', 'error');
});
initTheme();
bindFloatMenu();
verifyBtn.onclick = verifyToken;
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyToken(); });

// 暴露给 inline onclick
(window as any).showTool = showTool;
(window as any).backToGrid = backToGrid;

// 监听工具发出的脚本变更事件（js 工具发布/删除脚本后触发首页刷新，避免工具直接依赖壳内部函数）
window.addEventListener('kbox:scripts-changed', () => loadPublishedScripts());

// 自动验证已保存的令牌
const savedToken = localStorage.getItem('kbox_token') || '';
if (savedToken) {
  setToken(savedToken);
  setBtnStatus('验证中…', 'loading', true);
  fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + savedToken } })
    .then(res => {
      if (res.ok) {
        setVerifiedState();
        mainContent.classList.add('active');
        initTools(); // 内部 loadHomeLayout 完成后 hideAppLoader
      } else {
        resetVerifiedState();
        localStorage.removeItem('kbox_token');
        setToken('');
        hideAppLoader(); // token 失效，露出 token 栏让用户重新输入
      }
    })
    .catch(() => {
      resetVerifiedState();
      hideAppLoader(); // 网络错误，露出 token 栏
    });
} else {
  resetVerifiedState();
  hideAppLoader(); // 无保存 token，直接显示 token 栏
}
