// 工具：配置管理
// 独立模块，由 shell 在点击时动态 import('/js/plugins/config.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

export function render(): string {
  return `
<h2>⚙️ 配置管理</h2>

<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap">
  <div class="tabs" id="configTabs">
    <button class="tab active" data-ctab="global">全局配置</button>
    <button class="tab" data-ctab="tools">插件级</button>
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

<div class="modal-overlay" id="configModalOverlay">
  <div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3 id="configModalTitle">编辑配置</h3>
      <button class="modal-close" onclick="closeConfigModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label id="configModalLabel"></label>
        <input type="text" id="configModalInput" autocomplete="off" spellcheck="false">
        <div class="input-desc" id="configModalHint"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeConfigModal()">取消</button>
      <button class="btn btn-primary" id="configModalSave">保存</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="configPickOverlay">
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>选择配置项</h3>
      <button class="modal-close" onclick="closeConfigPick()">✕</button>
    </div>
    <div class="modal-body" id="configPickBody"></div>
  </div>
</div>
`;
}

export function mount(): void {
  const globalList = $('configGlobalList');
  const toolList = $('configToolList');
  const tabsEl = $('configTabs');
  const globalPane = $('configGlobalPane');
  const toolsPane = $('configToolsPane');
  const modalOverlay = $('configModalOverlay');
  const modalSave = $('configModalSave') as HTMLButtonElement;
  const modalInput = $('configModalInput') as HTMLInputElement;
  const modalLabel = $('configModalLabel');
  const modalHint = $('configModalHint');
  const modalTitle = $('configModalTitle');
  const pickOverlay = $('configPickOverlay');
  const pickBody = $('configPickBody');
  const sortBtn = $('configSortBtn');

  // 闭包状态：每次 mount 重新初始化
  let schema: any[] = [];
  let tools: any[] = [];
  let globalConfigs: any[] = [];
  let toolOverrides: Record<string, any[]> = {};
  let editing: { scope: string; tool: string | null; key: string; field: any } | null = null;
  let globalOrder: string[] = [];
  let toolOrder: string[] = [];
  let sortMode = false;

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
    tabsEl.querySelectorAll('.tab').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-ctab');
        tabsEl.querySelectorAll('.tab').forEach((b: Element) => b.classList.toggle('active', b === btn));
        const isGlobal = tab === 'global';
        if (globalPane) globalPane.style.display = isGlobal ? '' : 'none';
        if (toolsPane) toolsPane.style.display = isGlobal ? 'none' : '';
      });
    });
  }

  function valueDisplay(cfg: any): string {
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

  function orderedGlobalConfigs(): any[] {
    if (!globalOrder.length) return globalConfigs;
    const byKey: Record<string, any> = {};
    for (const c of globalConfigs) byKey[c.key] = c;
    const ordered: any[] = [];
    for (const k of globalOrder) {
      if (byKey[k]) { ordered.push(byKey[k]); delete byKey[k]; }
    }
    for (const c of globalConfigs) {
      if (byKey[c.key]) ordered.push(c);
    }
    return ordered;
  }

  function orderedToolsList(): any[] {
    if (!toolOrder.length) return tools;
    const byId: Record<string, any> = {};
    for (const t of tools) byId[t.id] = t;
    const ordered: any[] = [];
    for (const id of toolOrder) {
      if (byId[id]) { ordered.push(byId[id]); delete byId[id]; }
    }
    for (const t of tools) {
      if (byId[t.id]) ordered.push(t);
    }
    return ordered;
  }

  function renderGlobal() {
    if (!globalList) return;
    if (!globalConfigs.length) {
      globalList.innerHTML = '<div class="empty">无配置项</div>';
      return;
    }
    const list = orderedGlobalConfigs();
    globalList.innerHTML = list.map((cfg, i) => {
      const tag = cfg.sensitive ? ' <span class="badge badge-err">密</span>' : '';
      const upDisabled = i === 0 ? ' disabled' : '';
      const downDisabled = i === list.length - 1 ? ' disabled' : '';
      const actions = sortMode
        ? '<button class="icon-btn"' + upDisabled + ' onclick="moveConfigItem(\'global\',-1,\'' + esc(cfg.key) + '\')">↑</button>' +
          '<button class="icon-btn"' + downDisabled + ' onclick="moveConfigItem(\'global\',1,\'' + esc(cfg.key) + '\')">↓</button>'
        : '<button class="btn btn-outline btn-sm" onclick="editConfig(\'app\',null,\'' + esc(cfg.key) + '\')">编辑</button>' +
          (cfg.hasValue ? '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="clearConfig(\'app\',null,\'' + esc(cfg.key) + '\')">清除</button>' : '');
      return '<div class="file-item">' +
        '<div class="file-info"><div class="file-name">' + esc(cfg.key) + tag + '</div>' +
        '<div class="file-meta">' + esc(cfg.desc) + '</div></div>' +
        '<div style="margin-right:12px;font-size:13px">' + valueDisplay(cfg) + '</div>' +
        '<div class="file-actions" style="display:flex;gap:6px;align-items:center">' + actions + '</div>' +
        '</div>';
    }).join('');
  }

  function renderTools() {
    if (!toolList) return;
    if (!tools.length) {
      toolList.innerHTML = '<div class="empty">无工具</div>';
      return;
    }
    const list = orderedToolsList();
    toolList.innerHTML = list.map((t, i) => {
      const overrides = toolOverrides[t.id] || [];
      let chips = '';
      if (overrides.length) {
        chips = overrides.map((o: any) => {
          const valText = o.sensitive ? '●' : (o.value ? esc(o.value) : '●');
          return '<span class="saved-config" onclick="editConfig(\'tool\',\'' + t.id + '\',\'' + esc(o.key) + '\')">' + esc(o.key) + ': ' + valText +
            '<span class="del" onclick="event.stopPropagation();clearConfig(\'tool\',\'' + t.id + '\',\'' + esc(o.key) + '\')">✕</span></span>';
        }).join('');
      }
      const existing = new Set(overrides.map((o: any) => o.key));
      const available = schema.filter((f: any) => !existing.has(f.key) && (!f.plugins || f.plugins.includes(t.id)));
      const upDisabled = i === 0 ? ' disabled' : '';
      const downDisabled = i === list.length - 1 ? ' disabled' : '';
      const actions = sortMode
        ? '<button class="icon-btn"' + upDisabled + ' onclick="moveConfigItem(\'tool\',-1,\'' + esc(t.id) + '\')">↑</button>' +
          '<button class="icon-btn"' + downDisabled + ' onclick="moveConfigItem(\'tool\',1,\'' + esc(t.id) + '\')">↓</button>'
        : (available.length ? '<button class="btn btn-outline btn-sm" onclick="addToolOverride(\'' + t.id + '\')">+ 添加</button>' : '');
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
        body: JSON.stringify({ value: { app: globalOrder, plugins: toolOrder } }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) { if (e.message !== 'UNAUTHORIZED') toast('顺序保存失败', 'error'); }
  }

  (window as any).moveConfigItem = function (scope: string, dir: number, id: string) {
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
      const order = orderedToolsList().map(t => t.id);
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
      tools = schemaData.plugins || [];
      globalConfigs = globalData.configs || [];

      const results = await Promise.all(
        tools.map((t: any) => api('/api/config/plugins/' + t.id).catch(() => ({ overrides: [] })))
      );
      toolOverrides = {};
      tools.forEach((t: any, i: number) => {
        toolOverrides[t.id] = results[i].overrides || [];
      });

      try {
        const orderData = await api('/api/preferences/config_order');
        if (orderData.value) {
          if (Array.isArray(orderData.value.app)) globalOrder = orderData.value.app;
          if (Array.isArray(orderData.value.plugins)) toolOrder = orderData.value.plugins;
        }
      } catch { /* 无偏好则用默认顺序 */ }

      renderGlobal();
      renderTools();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      if (globalList) globalList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
      if (toolList) toolList.innerHTML = '';
    }
  }

  function openModal(scope: string, tool: string | null, key: string) {
    const field = schema.find((f: any) => f.key === key);
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

  (window as any).closeConfigModal = function () {
    modalOverlay.classList.remove('show');
    editing = null;
  };
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) (window as any).closeConfigModal(); };

  (window as any).editConfig = function (scope: string, tool: string | null, key: string) {
    openModal(scope, tool, key);
  };

  (window as any).addToolOverride = function (tool: string) {
    const overrides = toolOverrides[tool] || [];
    const existing = new Set(overrides.map((o: any) => o.key));
    const available = schema.filter((f: any) => !existing.has(f.key) && (!f.plugins || f.plugins.includes(tool)));
    if (!available.length) { toast('已无可添加的配置项', 'info'); return; }
    pickBody.innerHTML = available.map((f: any) => {
      const sensitiveTag = f.sensitive ? ' <span class="badge badge-err">密</span>' : '';
      const defaultTag = f.default ? ' <span style="color:var(--text-muted);font-size:11px">默认 ' + esc(f.default) + '</span>' : '';
      return '<div class="file-item" style="padding:10px 14px;cursor:pointer" onclick="pickOverride(\'' + esc(tool) + '\',\'' + esc(f.key) + '\')">' +
        '<div class="file-info"><div class="file-name">' + esc(f.key) + sensitiveTag + '</div>' +
        '<div class="file-meta">' + esc(f.desc) + ' ' + defaultTag + '</div></div></div>';
    }).join('');
    pickOverlay.classList.add('show');
  };

  (window as any).closeConfigPick = function () {
    pickOverlay.classList.remove('show');
  };
  pickOverlay.onclick = (e) => { if (e.target === pickOverlay) (window as any).closeConfigPick(); };

  (window as any).pickOverride = function (tool: string, key: string) {
    (window as any).closeConfigPick();
    openModal('tool', tool, key);
  };

  (window as any).clearConfig = function (scope: string, tool: string | null, key: string) {
    (window as any).showConfirm('确认清除 ' + key + '？', async () => {
      try {
        const url = scope === 'app'
          ? '/api/config/' + encodeURIComponent(key)
          : '/api/config/plugins/' + encodeURIComponent(tool!) + '/' + encodeURIComponent(key);
        await api(url, { method: 'PUT', body: JSON.stringify({ value: '' }), headers: { 'Content-Type': 'application/json' } });
        toast('已清除', 'success');
        loadAll();
      } catch (e: any) {
        if (e.message === 'UNAUTHORIZED') return;
        toast('清除失败：' + e.message, 'error');
      }
    });
  };

  modalSave.onclick = async () => {
    if (!editing) return;
    const { scope, tool, key } = editing;
    const value = modalInput.value;
    modalSave.disabled = true; modalSave.textContent = '保存中…';
    try {
      const url = scope === 'app'
        ? '/api/config/' + encodeURIComponent(key)
        : '/api/config/plugins/' + encodeURIComponent(tool!) + '/' + encodeURIComponent(key);
      await api(url, { method: 'PUT', body: JSON.stringify({ value }), headers: { 'Content-Type': 'application/json' } });
      toast('已保存', 'success');
      (window as any).closeConfigModal();
      loadAll();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    } finally {
      modalSave.disabled = false; modalSave.textContent = '保存';
    }
  };

  loadAll();
}

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };
