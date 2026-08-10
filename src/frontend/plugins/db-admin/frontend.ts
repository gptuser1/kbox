// 工具：DB 管理
// 独立模块，由 shell 在点击时动态 import('/js/plugins/db-admin.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api, getToken } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

export function render(): string {
  return `
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
      <div class="tabs" id="dbTabs">
        <button class="tab active" data-tab="data">选择数据</button>
        <button class="tab" data-tab="schema">表结构</button>
        <button class="tab" data-tab="sql">SQL 命令</button>
        <button class="tab" data-tab="insert">新建项</button>
      </div>

      <!-- 选择数据 -->
      <div class="db-panel active" id="dbPanel-data">
        <div class="db-filter-row" id="dbFilterRow">
          <input id="dbFilterCol" placeholder="列名">
          <input id="dbFilterVal" placeholder="值">
          <button class="btn btn-outline btn-sm" id="dbFilterBtn">过滤</button>
          <button class="btn btn-outline btn-sm" id="dbFilterClearBtn">清除</button>
        </div>
        <div class="tbl-wrap">
          <div class="db-results-head">
            <span id="dbDataTitle">数据</span>
            <span id="dbDataMeta"></span>
          </div>
          <div class="tbl-scroll" id="dbDataScroll"></div>
          <div class="db-pagination" id="dbPagination"></div>
        </div>
      </div>

      <!-- 表结构 -->
      <div class="db-panel" id="dbPanel-schema">
        <div class="tbl-wrap">
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
        <div class="tbl-wrap" id="dbSqlResultsWrap" style="display:none;margin-top:12px">
          <div class="db-results-head">
            <span id="dbSqlResultsTitle">结果</span>
            <span id="dbSqlResultsMeta"></span>
          </div>
          <div class="tbl-scroll" id="dbSqlResultsScroll"></div>
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
<div class="modal-overlay" id="dbConnOverlay">
  <div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3>连接管理</h3>
      <button class="modal-close" onclick="closeDbConnModal()">✕</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-outline" id="dbConnTestBtn" style="margin-right:auto">测试连接</button>
      <button class="btn btn-outline" style="color:var(--danger);display:none" id="dbConnDeleteBtn">删除</button>
      <button class="btn btn-outline" onclick="closeDbConnModal()">取消</button>
      <button class="btn btn-primary" id="dbConnSaveBtn">保存</button>
    </div>
  </div>
</div>

<!-- 行编辑弹层 -->
<div class="modal-overlay" id="dbRowOverlay">
  <div class="modal" style="max-width:680px">
    <div class="modal-header">
      <h3 id="dbRowModalTitle">编辑行</h3>
      <button class="modal-close" onclick="closeDbRowModal()">✕</button>
    </div>
    <div class="modal-body" id="dbRowModalBody"></div>
    <div class="modal-footer">
      <span class="db-meta" id="dbRowModalMeta" style="margin-right:auto"></span>
      <button class="btn btn-outline" onclick="closeDbRowModal()">取消</button>
      <button class="btn btn-primary" id="dbRowSaveBtn">保存</button>
    </div>
  </div>
</div>

<!-- 新建表弹层 -->
<div class="modal-overlay" id="dbCreateTableOverlay">
  <div class="modal" style="max-width:860px">
    <div class="modal-header">
      <h3>新建表</h3>
      <button class="modal-close" onclick="closeDbCreateTableModal()">✕</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeDbCreateTableModal()">取消</button>
      <button class="btn btn-primary" id="dbNewTableSubmitBtn">创建</button>
    </div>
  </div>
</div>
`;
}

export function mount(): void {
  // ─── DOM 引用 ───
  const connSelect = $('dbConnSelect') as HTMLSelectElement;
  const manageBtn = $('dbManageBtn') as HTMLButtonElement;
  const refreshBtn = $('dbRefreshBtn') as HTMLButtonElement;
  const curConnLabel = $('dbCurConnLabel');
  const tablesList = $('dbTablesList');
  const tablesEmpty = $('dbTablesEmpty');
  const mainEmpty = $('dbMainEmpty');
  const mainContent = $('dbMainContent');
  const tabsEl = $('dbTabs');
  const newTableBtn = $('dbNewTableBtn');
  const sidebarEl = $('dbSidebar');
  const sidebarToggle = $('dbSidebarToggle');

  function isMobile() { return window.innerWidth <= 768; }
  function collapseSidebar() { sidebarEl.classList.add('collapsed'); }
  function expandSidebar() { sidebarEl.classList.remove('collapsed'); }
  if (sidebarToggle) {
    sidebarToggle.onclick = (e) => {
      e.stopPropagation();
      sidebarEl.classList.toggle('collapsed');
    };
  }
  if (isMobile()) collapseSidebar();

  // 选择数据面板
  const filterCol = $('dbFilterCol') as HTMLInputElement;
  const filterVal = $('dbFilterVal') as HTMLInputElement;
  const filterBtn = $('dbFilterBtn') as HTMLButtonElement;
  const filterClearBtn = $('dbFilterClearBtn') as HTMLButtonElement;
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
  const exportDdlBtn = $('dbExportDdlBtn') as HTMLButtonElement;
  const dropTableBtn = $('dbDropTableBtn') as HTMLButtonElement;

  // SQL 命令面板
  const sqlEditor = $('dbSqlEditor') as HTMLTextAreaElement;
  const runBtn = $('dbRunBtn') as HTMLButtonElement;
  const clearBtn = $('dbClearBtn') as HTMLButtonElement;
  const sqlMeta = $('dbSqlMeta');
  const sqlResultsWrap = $('dbSqlResultsWrap');
  const sqlResultsTitle = $('dbSqlResultsTitle');
  const sqlResultsMeta = $('dbSqlResultsMeta');
  const sqlResultsScroll = $('dbSqlResultsScroll');

  // 新建项面板
  const insertForm = $('dbInsertForm');
  const insertSubmitBtn = $('dbInsertSubmitBtn') as HTMLButtonElement;
  const insertMeta = $('dbInsertMeta');

  // 连接管理弹层
  const connOverlay = $('dbConnOverlay');
  const connList = $('dbConnList');
  const connFormTitle = $('dbConnFormTitle');
  const connName = $('dbConnName') as HTMLInputElement;
  const connBaseUrl = $('dbConnBaseUrl') as HTMLInputElement;
  const connDatabase = $('dbConnDatabase') as HTMLInputElement;
  const connTestBtn = $('dbConnTestBtn') as HTMLButtonElement;
  const connDeleteBtn = $('dbConnDeleteBtn') as HTMLButtonElement;
  const connSaveBtn = $('dbConnSaveBtn') as HTMLButtonElement;
  const connFormResult = $('dbConnFormResult');

  // 行编辑弹层
  const rowOverlay = $('dbRowOverlay');
  const rowModalTitle = $('dbRowModalTitle');
  const rowModalBody = $('dbRowModalBody');
  const rowModalMeta = $('dbRowModalMeta');
  const rowSaveBtn = $('dbRowSaveBtn') as HTMLButtonElement;

  // 新建表弹层
  const createTableOverlay = $('dbCreateTableOverlay');
  const newTableName = $('dbNewTableName') as HTMLInputElement;
  const colsList = $('dbColsList');
  const addColBtn = $('dbAddColBtn') as HTMLButtonElement;
  const sqlPreview = $('dbCreateSqlPreview');
  const newTableResult = $('dbNewTableResult');
  const newTableSubmitBtn = $('dbNewTableSubmitBtn') as HTMLButtonElement;

  // ─── 状态 ───
  let connections: any[] = [];
  let activeConnId = '';
  let editingConnId: string | null = null;
  let activeTable = '';
  let activeTab = 'data';
  let schemaCache: any = null;
  let dataState: any = { limit: 50, offset: 0, sort: '', order: 'ASC', filter: null };
  let rowEditingState: any = null;

  const COL_TYPES = ['INTEGER', 'TEXT', 'REAL', 'NUMERIC', 'BLOB', 'VARCHAR', 'DATETIME', 'DATE', 'BOOLEAN'];
  let createCols: any[] = [];

  // ─── 工具函数 ───
  function showResult(el: HTMLElement, msg: string, type: string) {
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    el.textContent = msg;
    el.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : type === 'ok' ? 'rgba(34,197,94,0.1)' : 'var(--bg)';
    el.style.color = type === 'error' ? '#ef4444' : type === 'ok' ? '#22c55e' : 'var(--text)';
  }

  function escapeAttr(s: any) { return esc(s == null ? '' : String(s)); }

  function renderDbField(col: any, value: string, placeholder: string, disabled: boolean): string {
    const colName = escapeAttr(col.name);
    const val = escapeAttr(value);
    const ph = escapeAttr(placeholder);
    const disabledAttr = disabled ? ' disabled' : '';
    if (disabled) {
      return '<input data-col="' + colName + '" value="' + val + '" placeholder="' + ph + '"' + disabledAttr + '>';
    }
    return '<div class="db-field-wrap"><input data-col="' + colName + '" class="db-field-input" value="' + val + '" placeholder="' + ph + '"><button type="button" class="db-field-expand" onclick="toggleDbField(this)" title="展开多行编辑">⛶</button></div>';
  }

  (window as any).toggleDbField = function(btn: HTMLElement) {
    const wrap = btn.parentNode as HTMLElement;
    if (!wrap || !wrap.classList.contains('db-field-wrap')) return;
    const field = wrap.querySelector('.db-field-input') as HTMLInputElement;
    if (!field) return;
    const col = field.getAttribute('data-col') || '';
    const val = field.value;
    const ph = field.getAttribute('placeholder') || '';

    // 移除已存在的弹窗
    const existing = document.querySelector('.modal-overlay.db-field-modal');
    if (existing) existing.remove();

    // 创建弹窗
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay db-field-modal';
    overlay.innerHTML = '<div class="modal" style="max-width:min(94vw, 1600px)">' +
      '<div class="modal-header">' +
        '<h3>编辑 — ' + esc(col) + '</h3>' +
        '<button type="button" class="modal-close db-field-close" title="完成">✓</button>' +
      '</div>' +
      '<div class="modal-body" style="display:flex;flex:1;padding:0;overflow:hidden">' +
        '<textarea class="db-field-textarea" placeholder="' + esc(ph) + '">' + esc(val) + '</textarea>' +
      '</div>' +
    '</div>';

    overlay.classList.add('show');
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('.db-field-textarea') as HTMLTextAreaElement;
    const closeBtn = overlay.querySelector('.db-field-close') as HTMLElement;

    // 关闭弹窗：将 input 替换为 textarea 以保留换行
    function closePopup() {
      const fullVal = textarea.value;
      // 替换原 input 为 textarea，使其能保存换行
      const ta = document.createElement('textarea');
      ta.className = field.className;
      ta.rows = 1;
      ta.value = fullVal;
      for (const attr of field.attributes) {
        if (attr.name !== 'class' && attr.name !== 'value' && attr.name !== 'style') {
          ta.setAttribute(attr.name, attr.value);
        }
      }
      ta.style.cssText = field.style.cssText;
      field.parentNode!.replaceChild(ta, field);
      overlay.remove();
    }
    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });

    // 快捷键：Ctrl+Enter 或 Escape 关闭
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePopup(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { closePopup(); }
    });

    // 自动聚焦
    setTimeout(() => textarea.focus(), 50);
  };

  function renderCell(v: any): string {
    if (v == null) return '<td><span class="db-cell-null">NULL</span></td>';
    let s: string;
    if (typeof v === 'object') s = JSON.stringify(v);
    else s = String(v);
    if (typeof v === 'number') {
      return '<td class="db-cell-num" title="' + escapeAttr(s) + '">' + esc(s) + '</td>';
    }
    return '<td title="' + escapeAttr(s) + '">' + esc(s) + '</td>';
  }

  function switchTab(tab: string) {
    activeTab = tab;
    tabsEl.querySelectorAll('.tab').forEach((b: any) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    ['data', 'schema', 'sql', 'insert'].forEach(t => {
      $('dbPanel-' + t).classList.toggle('active', t === tab);
    });
    if (tab === 'schema' && activeTable) loadSchema();
    if (tab === 'insert' && activeTable && !insertForm.innerHTML) loadInsertForm();
  }

  tabsEl.querySelectorAll('.tab').forEach((b: any) => {
    b.onclick = () => switchTab(b.getAttribute('data-tab'));
  });

  // ─── 连接选择 ───
  async function loadConnSelect() {
    try {
      const data = await api('/api/plugins/db-admin/connections');
      connections = data.results || [];
      const prev = activeConnId;
      connSelect.innerHTML = '<option value="">— 选择连接 —</option>' +
        connections.map((c: any) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
      if (prev && connections.find((c: any) => c.id === prev)) {
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
    } catch (e: any) {
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
    const c = connections.find((x: any) => x.id === activeConnId);
    curConnLabel.textContent = c ? ('当前：' + c.name) : '';
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
      const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables');
      const tables = (data.results || []).filter((r: any) => r.name);
      if (tables.length === 0) {
        tablesEmpty.textContent = '该库暂无表，点右上新建';
        return;
      }
      tablesEmpty.style.display = 'none';
      tablesList.innerHTML = tables.map((t: any) =>
        '<div class="db-table-item' + (t.name === activeTable ? ' active' : '') + '" data-table="' + escapeAttr(t.name) + '">' +
          '<span>' + esc(t.name) + '</span>' +
        '</div>'
      ).join('');
      tablesList.querySelectorAll('.db-table-item').forEach((el: any) => {
        el.onclick = () => selectTable(el.getAttribute('data-table'));
      });
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      tablesEmpty.textContent = '加载失败：' + e.message;
    }
  }

  function selectTable(tname: string) {
    activeTable = tname;
    schemaCache = null;
    dataState = { limit: 50, offset: 0, sort: '', order: 'ASC', filter: null };
    filterCol.value = '';
    filterVal.value = '';
    tablesList.querySelectorAll('.db-table-item').forEach((x: any) => x.classList.remove('active'));
    const el = tablesList.querySelector('.db-table-item[data-table="' + CSS.escape(tname) + '"]');
    if (el) el.classList.add('active');
    mainEmpty.style.display = 'none';
    mainContent.style.display = 'block';
    insertForm.innerHTML = '';
    switchTab('data');
    loadData();
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
      const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/data?' + params.toString());
      const rows = data.results || [];
      const total = data.count;
      const cols = rows.length > 0 ? Object.keys(rows[0]) : (schemaCache?.columns?.map((c: any) => c.name) || []);

      dataMeta.textContent = '共 ' + (total != null ? total : '?') + ' 行 · 当前 ' + rows.length + ' 行';

      if (rows.length === 0) {
        dataScroll.innerHTML = '<div class="db-empty-hint">无数据</div>';
      } else {
        const pkCols = (schemaCache?.columns || []).filter((c: any) => c.pk).map((c: any) => c.name);
        dataScroll.innerHTML = '<table class="tbl-table">' +
          '<thead><tr>' +
            cols.map((c: string) => {
              const sorted = dataState.sort === c;
              const cls = sorted ? 'db-th-sort' + (dataState.order === 'DESC' ? ' desc' : '') : '';
              return '<th class="' + cls + '" data-col="' + escapeAttr(c) + '">' + esc(c) + '</th>';
            }).join('') +
            '<th class="tbl-th-actions">操作</th>' +
          '</tr></thead>' +
          '<tbody>' + rows.map((r: any) => {
            const where: any = {};
            if (pkCols.length > 0) {
              pkCols.forEach((k: string) => { where[k] = r[k]; });
            } else {
              cols.forEach((k: string) => { where[k] = r[k]; });
            }
            const whereStr = escapeAttr(JSON.stringify(where));
            return '<tr>' +
              cols.map((c: string) => renderCell(r[c])).join('') +
              '<td class="tbl-td-actions"><div class="tbl-row-actions">' +
                '<a data-action="edit" data-where="' + whereStr + '">编辑</a>' +
                '<a class="db-del" data-action="del" data-where="' + whereStr + '">删除</a>' +
              '</div></td>' +
            '</tr>';
          }).join('') + '</tbody>' +
          '</table>';

        dataScroll.querySelectorAll('th[data-col]').forEach((th: any) => {
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
        dataScroll.querySelectorAll('.tbl-row-actions a').forEach((a: any) => {
          a.onclick = (ev: Event) => {
            ev.preventDefault();
            const action = a.getAttribute('data-action');
            const where = JSON.parse(a.getAttribute('data-where'));
            if (action === 'edit') openRowModal('edit', where);
            else if (action === 'del') deleteRow(where);
          };
        });
      }

      renderPagination(total);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      dataMeta.textContent = '加载失败';
      dataScroll.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  function renderPagination(total: any) {
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
    const firstBtn = $('dbPageFirst'), prevBtn = $('dbPagePrev'), nextBtn = $('dbPageNext'), pageSizeSel = $('dbPageSize') as HTMLSelectElement;
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
      const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
      schemaCache = { ...data, _table: activeTable };
      renderSchema(data);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      schemaMeta.textContent = '加载失败';
      schemaBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  function renderSchema(data: any) {
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
        '<tbody>' + cols.map((c: any) =>
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
        '<tbody>' + indexes.map((i: any) =>
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

  dropTableBtn.onclick = () => {
    if (!activeConnId || !activeTable) return;
    (window as any).showConfirm('确认删除表 `' + activeTable + '`？此操作不可恢复！', async () => {
      try {
        await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable), { method: 'DELETE' });
        toast('表已删除', 'success');
        activeTable = '';
        schemaCache = null;
        mainContent.style.display = 'none';
        mainEmpty.style.display = 'block';
        loadTables();
      } catch (e: any) {
        if (e.message === 'UNAUTHORIZED') return;
        toast('删除失败：' + e.message, 'error');
      }
    });
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
      const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/query', {
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
        sqlResultsScroll.innerHTML = '<table class="tbl-table">' +
          '<thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>' +
          '<tbody>' + results.map((r: any) => '<tr>' + cols.map(c => renderCell(r[c])).join('') + '</tr>').join('') + '</tbody>' +
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
    } catch (e: any) {
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
        const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...data, _table: activeTable };
      }
      const cols = schemaCache.columns || [];
      if (cols.length === 0) {
        insertForm.innerHTML = '<div class="db-empty-hint">无字段信息</div>';
        return;
      }
      insertForm.innerHTML = '<div class="db-form-grid">' + cols.map((c: any) => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const placeholder = auto ? '（自增，留空）' : (c.dflt_value != null ? '默认: ' + c.dflt_value : '');
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          renderDbField(c, '', placeholder, auto);
      }).join('') + '</div>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      insertForm.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  insertSubmitBtn.onclick = async () => {
    if (!activeConnId || !activeTable) return;
    const inputs = insertForm.querySelectorAll('[data-col]:not(:disabled)');
    const values: any = {};
    inputs.forEach((inp: any) => {
      const col = inp.getAttribute('data-col');
      const v = inp.value;
      if (v !== '') values[col] = v;
    });
    if (Object.keys(values).length === 0) { toast('请至少填写一个字段', 'error'); return; }
    insertSubmitBtn.disabled = true; insertSubmitBtn.textContent = '插入中…';
    insertMeta.textContent = '';
    try {
      const res = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
        method: 'POST',
        body: JSON.stringify({ values }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('已插入' + (res.last_row_id ? '，ID=' + res.last_row_id : ''), 'success');
      inputs.forEach((inp: any) => inp.value = '');
      switchTab('data');
      loadData();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      insertMeta.textContent = '✗ ' + e.message;
      insertMeta.style.color = '#ef4444';
    } finally {
      insertSubmitBtn.disabled = false; insertSubmitBtn.textContent = '插入';
    }
  };

  // ─── 行编辑弹层 ───
  function openRowModal(mode: string, where: any) {
    rowEditingState = { mode, where };
    rowModalTitle.textContent = (mode === 'edit' ? '编辑行：' : '新建行：') + activeTable;
    rowModalMeta.textContent = '';
    rowModalBody.innerHTML = '<div class="db-empty-hint">加载中…</div>';
    rowOverlay.classList.add('show');
    if (mode === 'edit') loadRowForm(where);
    else loadInsertFormInModal();
  }
  function closeDbRowModal() { rowOverlay.classList.remove('show'); }
  (window as any).closeDbRowModal = closeDbRowModal;

  async function loadRowForm(where: any) {
    try {
      if (!schemaCache || schemaCache._table !== activeTable) {
        const sd = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...sd, _table: activeTable };
      }
      const params = new URLSearchParams(where);
      const data = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row?' + params.toString());
      const row = data.row;
      if (!row) {
        rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">行未找到</div>';
        return;
      }
      const cols = schemaCache.columns || [];
      rowModalBody.innerHTML = '<div class="db-form-grid">' + cols.map((c: any) => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const val = row[c.name] != null ? String(row[c.name]) : '';
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          renderDbField(c, val, '', auto);
      }).join('') + '</div>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') { closeDbRowModal(); return; }
      rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  async function loadInsertFormInModal() {
    try {
      if (!schemaCache || schemaCache._table !== activeTable) {
        const sd = await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/schema');
        schemaCache = { ...sd, _table: activeTable };
      }
      const cols = schemaCache.columns || [];
      rowModalBody.innerHTML = '<div class="db-form-grid">' + cols.map((c: any) => {
        const pkHint = c.pk ? '<span class="db-form-pk-hint">★ 主键</span>' : '';
        const auto = c.pk && /integer/i.test(c.type || '');
        const placeholder = auto ? '（自增，留空）' : (c.dflt_value != null ? '默认: ' + c.dflt_value : '');
        return '<label>' + esc(c.name) + pkHint + '</label>' +
          renderDbField(c, '', placeholder, auto);
      }).join('') + '</div>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') { closeDbRowModal(); return; }
      rowModalBody.innerHTML = '<div class="db-empty-hint" style="color:#ef4444">' + esc(e.message) + '</div>';
    }
  }

  rowSaveBtn.onclick = async () => {
    if (!rowEditingState) return;
    const inputs = rowModalBody.querySelectorAll('[data-col]:not(:disabled)');
    const set: any = {};
    inputs.forEach((inp: any) => {
      const col = inp.getAttribute('data-col');
      set[col] = inp.value;
    });
    if (Object.keys(set).length === 0) { toast('请至少填写一个字段', 'error'); return; }
    rowSaveBtn.disabled = true; rowSaveBtn.textContent = '保存中…';
    rowModalMeta.textContent = '';
    try {
      if (rowEditingState.mode === 'edit') {
        await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
          method: 'PUT',
          body: JSON.stringify({ set, where: rowEditingState.where }),
          headers: { 'Content-Type': 'application/json' },
        });
        toast('已保存', 'success');
      } else {
        const values: any = {};
        Object.keys(set).forEach(k => { if (set[k] !== '') values[k] = set[k]; });
        await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row', {
          method: 'POST',
          body: JSON.stringify({ values }),
          headers: { 'Content-Type': 'application/json' },
        });
        toast('已插入', 'success');
      }
      closeDbRowModal();
      loadData();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      rowModalMeta.textContent = '✗ ' + e.message;
      rowModalMeta.style.color = '#ef4444';
    } finally {
      rowSaveBtn.disabled = false; rowSaveBtn.textContent = '保存';
    }
  };

  function deleteRow(where: any) {
    (window as any).showConfirm('确认删除此行？', async () => {
      try {
        const params = new URLSearchParams(where);
        await api('/api/plugins/db-admin/connections/' + activeConnId + '/tables/' + encodeURIComponent(activeTable) + '/row?' + params.toString(), { method: 'DELETE' });
        toast('已删除', 'success');
        loadData();
      } catch (e: any) {
        if (e.message === 'UNAUTHORIZED') return;
        toast('删除失败：' + e.message, 'error');
      }
    });
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
    colsList.querySelectorAll('input[data-field], select[data-field]').forEach((el: any) => {
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
    colsList.querySelectorAll('button[data-del]').forEach((b: any) => {
      b.onclick = () => {
        const idx = parseInt(b.getAttribute('data-del'));
        createCols.splice(idx, 1);
        renderCreateCols();
        updateCreatePreview();
      };
    });
  }

  function buildCreateSql(): string {
    const name = newTableName.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const valid = createCols.filter(c => c.name.trim().replace(/[^a-zA-Z0-9_]/g, ''));
    if (!name || valid.length === 0) return '';
    const parts = valid.map(c => {
      const cname = c.name.trim().replace(/[^a-zA-Z0-9_]/g, '');
      let s = '`' + cname + '` ';
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
        if (/^-?\d+(\.\d+)?$/.test(d) || /^(CURRENT_TIMESTAMP|CURRENT_TIME|CURRENT_DATE|NULL|TRUE|FALSE)$/i.test(d) || /^(datetime|date|time)\(/i.test(d)) {
          s += ' DEFAULT ' + d;
        } else {
          s += " DEFAULT '" + d.replace(/'/g, "''") + "'";
        }
      }
      return s;
    });
    return 'CREATE TABLE `' + name + '` (\n  ' + parts.join(',\n  ') + '\n)';
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
  function closeDbCreateTableModal() { createTableOverlay.classList.remove('show'); }
  (window as any).closeDbCreateTableModal = closeDbCreateTableModal;

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
      await api('/api/plugins/db-admin/connections/' + activeConnId + '/query', {
        method: 'POST',
        body: JSON.stringify({ query: fullSql, params: [] }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('表已创建', 'success');
      closeDbCreateTableModal();
      await loadTables();
      selectTable(name);
    } catch (e: any) {
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
  function closeDbConnModal() { connOverlay.classList.remove('show'); }
  (window as any).closeDbConnModal = closeDbConnModal;

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
      const data = await api('/api/plugins/db-admin/connections');
      connections = data.results || [];
      renderConnList();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      connList.innerHTML = '<div class="db-empty-hint">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function renderConnList() {
    if (connections.length === 0) {
      connList.innerHTML = '<div class="db-empty-hint">暂无连接，下方添加</div>';
      return;
    }
    connList.innerHTML = connections.map((c: any) => {
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
    connList.querySelectorAll('button[data-edit]').forEach((b: any) => {
      b.onclick = () => {
        const id = b.getAttribute('data-edit');
        const c = connections.find((x: any) => x.id === id);
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

  connDeleteBtn.onclick = () => {
    if (!editingConnId) return;
    (window as any).showConfirm('确认删除此连接？', async () => {
      try {
        await api('/api/plugins/db-admin/connections/' + editingConnId, { method: 'DELETE' });
        toast('已删除', 'success');
        resetConnForm();
        loadConnectionsList();
        loadConnSelect();
      } catch (e: any) {
        if (e.message === 'UNAUTHORIZED') return;
        toast('删除失败：' + e.message, 'error');
      }
    });
  };

  connTestBtn.onclick = async () => {
    const name = connName.value.trim();
    const baseUrl = connBaseUrl.value.trim();
    const database = connDatabase.value.trim();
    if (!name || !baseUrl) { showResult(connFormResult, '请填写名称和 Base URL', 'error'); return; }
    connTestBtn.disabled = true; connTestBtn.textContent = '测试中…';
    try {
      let result: any;
      if (editingConnId) {
        result = await api('/api/plugins/db-admin/connections/' + editingConnId + '/test', { method: 'POST' });
      } else {
        const url = database ? baseUrl.replace(/\/+$/, '') + '/' + database + '/query' : baseUrl.replace(/\/+$/, '') + '/query';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'SELECT 1 AS ok', params: [] }),
        });
        let data: any; try { data = await res.json(); } catch { data = null; }
        result = { ok: res.ok, status: res.status, error: data?.error, sample: data?.results?.[0] };
      }
      if (result.ok) showResult(connFormResult, '✓ 连接成功 ' + (result.sample ? JSON.stringify(result.sample) : ''), 'ok');
      else showResult(connFormResult, '✗ ' + (result.error || ('HTTP ' + result.status)), 'error');
    } catch (e: any) {
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
        await api('/api/plugins/db-admin/connections/' + editingConnId, {
          method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
        });
      } else {
        await api('/api/plugins/db-admin/connections', {
          method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
        });
      }
      toast('已保存', 'success');
      resetConnForm();
      loadConnectionsList();
      loadConnSelect();
    } catch (e: any) {
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

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };
