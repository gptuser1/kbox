// 壳：浏览器端全局逻辑。令牌/主题/菜单/首页网格/插件懒加载调度。
// 关键：showPlugin 动态 import 插件模块并 try-catch 包裹——单插件 JS 出错只 toast，
// 不影响壳和其他插件，实现故障隔离。
import { $, esc, toast, api, setToken, setUnauthorizedHandler, initToast, eventBus } from './shared.js';
import type { FrontendPlugin } from './shared.js';
import { PLUGIN_REGISTRY } from './registry.js';

// 前端插件模块统一接口，由 shared.ts 的 FrontendPlugin 强制约束
export type PluginModule = FrontendPlugin;

// ─── 全局状态 ───
const THEME_KEY = 'kbox_theme';
let homeLayout: { viewMode: string; order: string[]; overrides: Record<string, any> } = { viewMode: 'grid', order: [], overrides: {} };
let editMode = false;
let publishedScripts: any[] = [];
let editingPluginId: string | null = null;
const pluginModuleCache: Record<string, PluginModule> = {};

// DOM 引用（script type=module 自带 defer，DOM 已就绪）
const tokenInput = $('tokenInput') as HTMLInputElement;
const verifyBtn = $('verifyBtn') as HTMLButtonElement;
const mainContent = $('mainContent');
const pluginGrid = $('pluginGrid');
const pluginViews = $('pluginViews');

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

// ─── 浮动菜单 ───
let inPluginPage = false;

function closeFloatMenu() {
  const fmc = $('floatMenuBtn');
  if (!fmc) return;
  fmc.classList.remove('open');
  fmc.style.width = '';
  fmc.style.height = '';
}

function syncFloatMenuVisibility() {
  const fmc = $('floatMenuBtn');
  if (!fmc) return;
  if (!mainContent.classList.contains('active')) {
    fmc.classList.remove('show');
    return;
  }
  if (inPluginPage) {
    if (pluginMenuSections.length > 0) fmc.classList.add('show');
    else fmc.classList.remove('show');
  } else {
    fmc.classList.add('show');
  }
}

function measureMenuSize() {
  const fmc = $('floatMenuBtn');
  if (!fmc || !fmc.classList.contains('open')) return;
  requestAnimationFrame(() => {
    const items = fmc.querySelector('.fm-items') as HTMLElement;
    if (!items) return;
    let maxW = 0;
    let totalH = 0;
    Array.from(items.children).forEach(child => {
      const el = child as HTMLElement;
      totalH += el.offsetHeight;
      el.querySelectorAll('.fm-btn-group, .fm-label').forEach(inner => {
        const w = (inner as HTMLElement).offsetWidth;
        if (w > maxW) maxW = w;
      });
    });
    const padW = 32, padH = 28;
    const w = Math.min(Math.max(maxW + padW, 100), 220);
    const h = Math.min(Math.max(totalH + padH, 80), 360);
    fmc.style.width = w + 'px';
    fmc.style.height = h + 'px';
  });
}

function bindFloatMenu() {
  document.querySelectorAll('[id$="ThemeSwitcher"]').forEach(sw => {
    sw.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => setTheme(b.getAttribute('data-theme') || 'auto'));
    });
  });
  const fmc = $('floatMenuBtn');
  if (fmc) {
    fmc.addEventListener('click', (e) => {
      if (fmc.classList.contains('open')) return;
      e.stopPropagation();
      fmc.classList.add('open');
      measureMenuSize();
    });
    document.addEventListener('click', (e) => {
      if (!fmc.classList.contains('open')) return;
      if (fmc.contains(e.target as Node)) return;
      closeFloatMenu();
    });
  }
}

// ─── 浮动返回按钮行为栈 ───
let floatBackStack: Array<() => void> = [];

// 插件调用：push 一个返回行为，覆盖默认的 backToGrid
function pushFloatBack(action: () => void) {
  floatBackStack.push(action);
  const fb = $('floatBack');
  if (fb) fb.onclick = action;
}

// 插件调用：pop 当前行为，恢复到上一个或默认 backToGrid
function popFloatBack() {
  floatBackStack.pop();
  const action = floatBackStack.length > 0
    ? floatBackStack[floatBackStack.length - 1]
    : backToGrid;
  const fb = $('floatBack');
  if (fb) fb.onclick = action;
}

// 进入插件时由 showPlugin 调用，重置栈
function resetFloatBack() {
  floatBackStack = [];
  const fb = $('floatBack');
  if (fb) fb.onclick = backToGrid;
}

// ─── 浮动菜单（插件注册菜单项） ───
interface PluginMenuSection {
  label: string;
  html: string;
}

let pluginMenuSections: PluginMenuSection[] = [];

function renderPluginMenu() {
  const container = $('fmPluginSections');
  if (!container) return;
  if (pluginMenuSections.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
  } else {
    container.style.display = '';
    container.innerHTML = pluginMenuSections.map(s =>
      '<div class="fm-section">' +
      '<div class="fm-label">' + s.label + '</div>' +
      '<div class="fm-btn-group">' + s.html + '</div>' +
      '</div>'
    ).join('');
  }
  syncFloatMenuVisibility();
  measureMenuSize();
}

function setPluginMenu(sections: PluginMenuSection[]) {
  pluginMenuSections = sections;
  renderPluginMenu();
}

function clearPluginMenu() {
  pluginMenuSections = [];
  renderPluginMenu();
}

// 暴露给插件模块（通过 window 或者直接 import）
(window as any).pushFloatBack = pushFloatBack;
(window as any).popFloatBack = popFloatBack;
(window as any).setPluginMenu = setPluginMenu;
(window as any).clearPluginMenu = clearPluginMenu;

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
  (window as any).showConfirm('是否退出？', () => {
    localStorage.removeItem('kbox_token');
    setToken('');
    resetVerifiedState();
    mainContent.classList.remove('active');
    syncFloatMenuVisibility();
    toast('已退出', 'info');
  });
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
      syncFloatMenuVisibility();
      initPlugins();
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
    const data = await api('/api/plugins/js/published');
    publishedScripts = data.scripts || [];
  } catch {
    publishedScripts = [];
  }
  renderPluginGrid();
}

// ─── 插件元数据查询（应用用户覆盖） ───
function findScriptById(id: string): any {
  const m = id.match(/^script:(.+)$/);
  if (!m) return null;
  return publishedScripts.find(s => s.id === m[1]) || null;
}
function pluginName(id: string): string {
  if (homeLayout.overrides[id]?.name) return homeLayout.overrides[id].name;
  const t = PLUGIN_REGISTRY.find(t => t.id === id);
  if (t) return t.name;
  const s = findScriptById(id);
  if (s) return s.name;
  return id;
}
function pluginIcon(id: string): string {
  if (homeLayout.overrides[id]?.icon) return homeLayout.overrides[id].icon;
  const t = PLUGIN_REGISTRY.find(t => t.id === id);
  if (t) return t.icon;
  const s = findScriptById(id);
  if (s) return s.icon;
  return '□';
}
function pluginHidden(id: string): boolean { return !!homeLayout.overrides[id]?.hidden; }
function pluginDesc(id: string): string {
  const t = PLUGIN_REGISTRY.find(t => t.id === id);
  if (t) return t.desc;
  const s = findScriptById(id);
  if (s) return s.desc || '用户脚本';
  return '';
}
function allPluginIds(): string[] {
  const ids = PLUGIN_REGISTRY.map(t => t.id);
  for (const s of publishedScripts) ids.push('script:' + s.id);
  return ids;
}
function orderedPlugins(): string[] {
  const ids = allPluginIds();
  const ordered: string[] = [];
  for (const id of homeLayout.order) if (ids.includes(id)) ordered.push(id);
  for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
}

// ─── 首页网格 ───
function renderPluginGrid() {
  pluginGrid.className = 'plugin-grid view-' + homeLayout.viewMode;
  const ids = orderedPlugins();
  let html = '';
  for (const id of ids) {
    const name = esc(pluginName(id));
    const icon = pluginIcon(id);
    const desc = esc(pluginDesc(id));
    const hiddenCls = pluginHidden(id) ? ' hidden-plugin' : '';
    const editCls = editMode ? ' editing' : '';
    const clickAttr = editMode ? '' : ' onclick="showPlugin(\'' + id + '\')"';
    const actions = editMode
      ? '<div class="plugin-card-actions">' +
        '<button title="编辑" onclick="event.stopPropagation();openPluginEdit(\'' + id + '\')">✎</button>' +
        '<button title="上移" onclick="event.stopPropagation();movePlugin(\'' + id + '\',-1)">↑</button>' +
        '<button title="下移" onclick="event.stopPropagation();movePlugin(\'' + id + '\',1)">↓</button>' +
        '</div>'
      : '';
    html += '<div class="plugin-card' + hiddenCls + editCls + '" data-id="' + id + '"' + clickAttr + '>' +
      '<div class="plugin-icon">' + icon + '</div>' +
      '<div class="plugin-name">' + name + '</div>' +
      '<div class="plugin-desc">' + desc + '</div>' +
      actions +
      '</div>';
  }
  pluginGrid.innerHTML = html;
}

// ─── 插件卡片编辑 ───
(window as any).openPluginEdit = function(id: string) {
  editingPluginId = id;
  const defaultName = pluginName(id);
  const hasOverride = !!homeLayout.overrides[id]?.name;
  const nameEl = $('pluginEditName') as HTMLInputElement;
  nameEl.value = hasOverride ? defaultName : '';
  nameEl.placeholder = defaultName;
  ($('pluginEditIconInput') as HTMLInputElement).value = (homeLayout.overrides[id]?.icon) || '';
  ($('pluginEditHidden') as HTMLInputElement).checked = pluginHidden(id);
  $('pluginEditIconPicker').innerHTML = EMOJI_CHOICES.map(e =>
    '<span style="font-size:22px;cursor:pointer;padding:4px 6px;border-radius:6px" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'none\'" onclick="pickEmoji(\'' + e + '\')">' + e + '</span>'
  ).join('');
  $('pluginEditOverlay').classList.add('show');
};
(window as any).pickEmoji = function(e: string) {
  ($('pluginEditIconInput') as HTMLInputElement).value = e;
};
(window as any).closePluginEdit = function() {
  $('pluginEditOverlay').classList.remove('show');
  editingPluginId = null;
};
(window as any).movePlugin = function(id: string, dir: number) {
  const order = orderedPlugins();
  const i = order.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  homeLayout.order = order;
  saveHomeLayout();
  renderPluginGrid();
};
$('pluginEditOverlay')?.addEventListener('click', (e) => { if (e.target === $('pluginEditOverlay')) (window as any).closePluginEdit(); });
$('pluginEditSave')?.addEventListener('click', async () => {
  if (!editingPluginId) return;
  const id = editingPluginId;
  const name = ($('pluginEditName') as HTMLInputElement).value.trim();
  const icon = ($('pluginEditIconInput') as HTMLInputElement).value.trim();
  const hidden = ($('pluginEditHidden') as HTMLInputElement).checked;
  let origName = pluginName(id), origIcon = pluginIcon(id);
  const t = PLUGIN_REGISTRY.find(t => t.id === id);
  if (t) { origName = t.name; origIcon = t.icon; }
  else { const s = findScriptById(id); if (s) { origName = s.name; origIcon = s.icon; } }
  const ov: any = {};
  if (name && name !== origName) ov.name = name;
  if (icon && icon !== origIcon) ov.icon = icon;
  if (hidden) ov.hidden = true;
  if (Object.keys(ov).length === 0) delete homeLayout.overrides[id];
  else homeLayout.overrides[id] = ov;
  await saveHomeLayout();
  (window as any).closePluginEdit();
  renderPluginGrid();
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
    renderPluginGrid();
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
    renderPluginGrid();
  }
  const fmEditBtn = $('fmEditBtn');
  const fmExitEditBtn = $('fmExitEditBtn');
  if (fmEditBtn) fmEditBtn.addEventListener('click', () => setEditModeUI(true));
  if (fmExitEditBtn) fmExitEditBtn.addEventListener('click', () => setEditModeUI(false));
}

// ─── 插件懒加载（核心隔离机制） ───
// 动态 import 插件模块；render/mount 各自 try-catch，单插件失败只 toast，不波及壳与其他插件。
// 进入时立即显示 plugin-loader 覆盖插件区，掩盖 import/render/mount 的延迟。
async function showPlugin(id: string) {
  pluginGrid.style.display = 'none';
  const hgw = $('homeGridWrap'); if (hgw) hgw.style.display = 'none';
  pluginViews.innerHTML = '';
  window.scrollTo(0, 0);
  const view = document.createElement('div');
  view.className = 'plugin-view active';
  view.id = 'view-' + id;
  pluginViews.appendChild(view);
  $('floatBack').classList.add('show');
  closeFloatMenu();
  // 进入插件页：重置返回栈，清除插件菜单
  inPluginPage = true;
  resetFloatBack();
  clearPluginMenu();
  const fmb = $('floatMenuBtn'); if (fmb) { fmb.classList.add('in-plugin'); }

  // 立即显示插件加载层（区域级，不全屏，保留 token 栏与浮动按钮）
  view.innerHTML = '<div class="plugin-loader"><div class="app-loader__bar"></div><div class="plugin-loader__text">加载中…</div></div>';

  // script:xxx 复用 js-runner 插件模块渲染
  const realId = id.startsWith('script:') ? 'js-runner' : id;

  let mod = pluginModuleCache[realId];
  if (!mod) {
    try {
      mod = (await import('/js/plugins/' + realId + '.js')) as PluginModule;
      pluginModuleCache[realId] = mod;
    } catch (e) {
      toast('插件加载失败：' + errMsg(e), 'error');
      view.innerHTML = '<div style="padding:24px;color:var(--danger)">插件加载失败：' + esc(errMsg(e)) + '</div>';
      return;
    }
  }
  try {
    view.innerHTML = mod.render(id);
  } catch (e) {
    toast('插件渲染失败：' + errMsg(e), 'error');
    view.innerHTML = '<div style="padding:24px;color:var(--danger)">插件渲染失败：' + esc(errMsg(e)) + '</div>';
    return;
  }
  try {
    mod.mount(id);
  } catch (e) {
    toast('插件初始化失败：' + errMsg(e), 'error');
    // mount 失败不抛出：壳与其他插件继续可用
  }
}

function backToGrid() {
  pluginViews.innerHTML = '';
  pluginGrid.style.display = 'grid';
  const hgw = $('homeGridWrap'); if (hgw) hgw.style.display = '';
  $('floatBack').classList.remove('show');
  closeFloatMenu();
  // 回到首页：恢复首页菜单
  inPluginPage = false;
  clearPluginMenu();
  const fmb = $('floatMenuBtn'); if (fmb) { fmb.classList.remove('in-plugin'); }
  syncFloatMenuVisibility();
  window.scrollTo(0, 0);
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

// ─── 初始化插件区 ───
function initPlugins() {
  bindHomeToolbar();
  // 先在网格区显示加载层，掩盖布局偏好加载期间的空白与布局跳变
  pluginGrid.innerHTML = '<div class="plugin-loader" style="grid-column:1/-1"><div class="app-loader__bar"></div><div class="plugin-loader__text">加载中…</div></div>';
  loadHomeLayout().finally(() => {
    // loadHomeLayout 内部正常会 renderPluginGrid；此处兜底确保渲染
    if (pluginGrid.querySelector('.plugin-loader')) renderPluginGrid();
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
  syncFloatMenuVisibility();
  toast('令牌已失效，请重新验证', 'error');
});
initTheme();
bindFloatMenu();
verifyBtn.onclick = verifyToken;
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyToken(); });

// ─── 通用确认弹窗 ───
let confirmCallback: (() => void) | null = null;
(window as any).showConfirm = function(message: string, onConfirm: () => void, title?: string) {
  if (title) ($('confirmTitle') as HTMLElement).textContent = title;
  ($('confirmBody') as HTMLElement).textContent = message;
  confirmCallback = onConfirm;
  $('confirmOverlay').classList.add('show');
};
(window as any).closeConfirmModal = function() {
  $('confirmOverlay').classList.remove('show');
  confirmCallback = null;
};

$('confirmOverlay')?.addEventListener('click', (e) => {
  if (e.target === $('confirmOverlay')) (window as any).closeConfirmModal();
});
$('confirmCloseBtn')?.addEventListener('click', () => (window as any).closeConfirmModal());
$('confirmCancelBtn')?.addEventListener('click', () => (window as any).closeConfirmModal());
$('confirmOkBtn')?.addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  (window as any).closeConfirmModal();
});

// 暴露给 inline onclick
(window as any).showPlugin = showPlugin;
(window as any).backToGrid = backToGrid;

// 监听插件发出的脚本变更事件（js 运行插件发布/删除脚本后触发首页刷新，避免插件直接依赖壳内部函数）
// 通过 eventBus 订阅；同时兼容旧的 window 事件（过渡期）
eventBus.on('kbox:scripts-changed', () => loadPublishedScripts());
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
        syncFloatMenuVisibility();
        initPlugins(); // 内部 loadHomeLayout 完成后 hideAppLoader
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
