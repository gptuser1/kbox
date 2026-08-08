// 工具：JS 运行工具
// 独立模块，由 shell 在点击时动态 import('/js/tools/js.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
// script:xxx 复用本模块：shell 传入 id='script:<scriptId>' 时渲染轻量运行视图。
import { $, esc, toast, api } from '../shared.js';

// ─── 判断是否为 script:xxx 运行视图 ───
function isScriptView(id?: string): boolean {
  return !!(id && id.startsWith('script:'));
}
function getScriptId(id?: string): string | null {
  const m = id?.match(/^script:(.+)$/);
  return m ? m[1] : null;
}

export function render(id?: string): string {
  if (isScriptView(id)) return renderScriptRunView();
  return renderJsTool();
}

export function mount(id?: string): void {
  if (isScriptView(id)) {
    mountScriptRunView(getScriptId(id));
  } else {
    mountJsTool();
  }
}

// ═══ 完整 JS 工具视图 ═══
function renderJsTool(): string {
  return `
    <h2>📜 JS 运行工具</h2>
    <div class="tabs" id="jsTabs" style="margin-bottom:16px">
      <button class="tab active" data-jstab="scripts">脚本</button>
      <button class="tab" data-jstab="playground">临时运行</button>
    </div>
    <div id="jsScriptsPane">
      <div id="jsScriptsList"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary" id="jsNewBtn">+ 新建脚本</button>
        <button class="btn btn-outline" id="jsRefreshBtn">刷新</button>
      </div>
      <div class="result-box" id="jsScriptResult"></div>
    </div>
    <div id="jsPlaygroundPane" style="display:none">
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
      <textarea id="jsCodeInput" class="sql-editor" rows="10" placeholder="// 试试：console.log('hello world')" style="margin-top:8px" autocorrect="off" spellcheck="false" autocapitalize="off"></textarea>
      <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap">
        <button class="btn btn-primary" id="jsRunTmpBtn">▶ 运行</button>
        <button class="btn btn-outline" id="jsSaveAsBtn">存为脚本</button>
      </div>
      <div class="result-box" id="jsTmpResult"></div>
    </div>
    <div class="modal-overlay" id="jsModalOverlay">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h3 id="jsModalTitle">新建脚本</h3>
          <button class="modal-close" onclick="closeJsModal()">✕</button>
        </div>
        <div class="modal-body" id="jsModalBody"></div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="jsSaveBtn">保存</button>
          <button class="btn btn-outline" onclick="closeJsModal()">取消</button>
        </div>
      </div>
    </div>
  `;
}

function mountJsTool(): void {
  // tab 切换
  const tabsEl = $('jsTabs');
  const scriptsPane = $('jsScriptsPane');
  const playgroundPane = $('jsPlaygroundPane');
  if (tabsEl) {
    tabsEl.querySelectorAll('.tab').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-jstab');
        tabsEl.querySelectorAll('.tab').forEach((b: Element) => b.classList.toggle('active', b === btn));
        const isScripts = tab === 'scripts';
        if (scriptsPane) scriptsPane.style.display = isScripts ? '' : 'none';
        if (playgroundPane) playgroundPane.style.display = isScripts ? 'none' : '';
      });
    });
  }

  const newBtn = $('jsNewBtn');
  const refreshBtn = $('jsRefreshBtn');
  if (newBtn) newBtn.onclick = () => (window as any).renderJsEditor(null);
  if (refreshBtn) refreshBtn.onclick = () => loadJsScripts();
  const runBtn = $('jsRunTmpBtn');
  if (runBtn) runBtn.onclick = () => runJsTmp();
  const saveAsBtn = $('jsSaveAsBtn');
  if (saveAsBtn) saveAsBtn.onclick = () => saveAsScript();
  // 事件委托：避免内联 onclick 的引号转义陷阱，刷新列表后无需重新绑定
  const list = $('jsScriptsList');
  if (list) {
    list.addEventListener('click', (e: Event) => {
      const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
      if (!btn) return;
      const act = btn.getAttribute('data-act') || '';
      const id = btn.getAttribute('data-id') || '';
      if (act === 'run') (window as any).runJsScript(id);
      else if (act === 'publish') (window as any).toggleJsPublish(id, btn.getAttribute('data-pub') === '1');
      else if (act === 'edit') (window as any).renderJsEditor(id);
      else if (act === 'delete') (window as any).deleteJsScript(id);
    });
  }
  loadJsScripts();
}

async function loadJsScripts(): Promise<void> {
  const list = $('jsScriptsList');
  if (!list) return;
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const data = await api('/api/tools/js/scripts');
    if (!data.scripts || data.scripts.length === 0) {
      list.innerHTML = '<div class="empty">暂无脚本</div>';
      return;
    }
    let html = '<div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl-table">' +
      '<thead><tr><th>名称</th><th>已发布</th><th>上次运行</th><th class="tbl-th-actions">操作</th></tr></thead><tbody>';
    for (const s of data.scripts) {
      const lastRun = s.last_run ? new Date(s.last_run.at).toLocaleString('zh-CN') + ' (' + (s.last_run.status === 'ok' ? 'OK' : 'ERR') + ')' : '从未';
      const sid = esc(s.id);
      const pubBtn = s.published
        ? '<button class="btn btn-outline btn-sm" data-act="publish" data-id="' + sid + '" data-pub="0">取消发布</button>'
        : '<button class="btn btn-outline btn-sm" data-act="publish" data-id="' + sid + '" data-pub="1">发布</button>';
      html += '<tr><td>' + esc(s.icon) + ' ' + esc(s.name) + '</td><td>' + (s.published ? '✓' : '✗') + '</td><td>' + esc(lastRun) + '</td><td class="tbl-td-actions"><div class="tbl-row-actions">' +
        '<button class="btn btn-outline btn-sm" data-act="run" data-id="' + sid + '">运行</button>' + pubBtn +
        '<button class="btn btn-outline btn-sm" data-act="edit" data-id="' + sid + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-act="delete" data-id="' + sid + '">删除</button>' +
        '</div></td></tr>';
    }
    html += '</tbody></table></div></div>';
    list.innerHTML = html;
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

// ─── 前端 JS 执行引擎（Workers 禁止 eval/new Function，故在浏览器执行） ───
function formatLogArg(a: any): string {
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
  return String(a);
}

function buildFrontendKbox(logs: string[]) {
  const log = (...args: any[]) => logs.push(args.map(formatLogArg).join(' '));
  return {
    log,
    now: () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    sleep: (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    fetch: (url: string, opts?: any) => fetch(url, opts),
    kv: {
      get: async (ns: string, key: string) => {
        const d = await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key));
        return d.value;
      },
      set: async (ns: string, key: string, value: any) => {
        await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key), {
          method: 'POST', body: JSON.stringify({ value }), headers: { 'Content-Type': 'application/json' },
        });
      },
      delete: async (ns: string, key: string) => {
        await api('/api/tools/js/kv/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key), { method: 'DELETE' });
      },
      list: async (ns: string) => {
        const d = await api('/api/tools/js/kv/' + encodeURIComponent(ns));
        return d.items || [];
      },
    },
    news: {
      list: async (limit?: number) => {
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

async function executeJsCode(code: string, params: any = {}): Promise<{ logs: string[]; result?: any; error?: { message: string; stack?: string } }> {
  const logs: string[] = [];
  const kbox = buildFrontendKbox(logs);
  const sandboxConsole = { log: kbox.log, info: kbox.log, warn: kbox.log, error: kbox.log, debug: kbox.log };
  const paramNames = Object.keys(params);
  const wrapped = `
    const { log, fetch, kv, news, stock, disk, now, sleep } = kbox;
    const { ${paramNames.join(', ')} } = params;
    return (async () => {
      ${code}
    })();
  `;
  try {
    const fn = new Function('kbox', 'console', 'params', wrapped);
    const result = await Promise.race([
      fn(kbox, sandboxConsole, params),
      new Promise((_, rej) => setTimeout(() => rej(new Error('执行超时（5s）')), 5000)),
    ]);
    return { logs, result: result === undefined ? null : result };
  } catch (e: any) {
    return { logs, error: { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined } };
  }
}

function formatJsResult(r: { logs: string[]; result?: any; error?: { message: string; stack?: string } }): string {
  const lines: string[] = [];
  if (r.logs && r.logs.length > 0) lines.push(...r.logs);
  if (r.result !== null && r.result !== undefined) {
    lines.push('▶ 返回值: ' + JSON.stringify(r.result, null, 2));
  }
  if (r.error) {
    lines.push('✗ 错误: ' + r.error.message);
    if (r.error.stack) lines.push(r.error.stack);
  }
  if (lines.length === 0) lines.push('（无输出）');
  let html = '<div class="section-title">输出</div>';
  html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:80px;cursor:default;color:' + (r.error ? '#ef4444' : 'var(--text)') + '">' + esc(lines.join('\n')) + '</div>';
  return html;
}

async function runJsTmp(): Promise<void> {
  const code = (($('jsCodeInput') as HTMLTextAreaElement)?.value) || '';
  const resultBox = $('jsTmpResult');
  if (!resultBox) return;
  resultBox.classList.add('show');
  resultBox.innerHTML = '<div class="empty">运行中…</div>';
  const r = await executeJsCode(code, {});
  resultBox.innerHTML = formatJsResult(r);
}

function notifyScriptsChanged(): void {
  window.dispatchEvent(new CustomEvent('kbox:scripts-changed'));
}

(window as any).runJsScript = async function (id: string) {
  const resultBox = $('jsScriptResult');
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
    api('/api/tools/js/scripts/' + id + '/record-run', {
      method: 'POST',
      body: JSON.stringify({ status: r.error ? 'error' : 'ok', error: r.error?.message }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
    toast(r.error ? '执行出错' : '执行完成', r.error ? 'error' : 'success');
    loadJsScripts();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    if (resultBox) resultBox.innerHTML = formatJsResult({ logs: [], error: { message: e.message } });
    toast('运行失败', 'error');
  }
};

(window as any).toggleJsPublish = async function (id: string, publish: boolean) {
  try {
    await api('/api/tools/js/scripts/' + id + '/publish', { method: 'POST', body: JSON.stringify({ published: publish }), headers: { 'Content-Type': 'application/json' } });
    toast(publish ? '已发布到首页' : '已取消发布', 'success');
    loadJsScripts();
    notifyScriptsChanged();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    toast('操作失败：' + e.message, 'error');
  }
};

(window as any).deleteJsScript = function (id: string) {
  (window as any).showConfirm('确认删除该脚本？', async () => {
    try {
      await api('/api/tools/js/scripts/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      loadJsScripts();
      notifyScriptsChanged();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  });
};

async function saveAsScript(): Promise<void> {
  const code = (($('jsCodeInput') as HTMLTextAreaElement)?.value) || '';
  if (!code.trim()) { toast('代码不能为空', 'error'); return; }
  const name = prompt('脚本名称：', '未命名脚本');
  if (name === null) return;
  try {
    await api('/api/tools/js/scripts', { method: 'POST', body: JSON.stringify({ name: name || '未命名脚本', code, icon: '📝', published: false }), headers: { 'Content-Type': 'application/json' } });
    toast('已保存', 'success');
    loadJsScripts();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    toast('保存失败：' + e.message, 'error');
  }
}

(window as any).closeJsModal = function () {
  const ov = $('jsModalOverlay');
  if (ov) ov.classList.remove('show');
};

(window as any).renderJsEditor = async function (id: string | null) {
  const ov = $('jsModalOverlay');
  const body = $('jsModalBody');
  const title = $('jsModalTitle');
  if (!ov || !body) return;
  let script: any = null;
  if (id) {
    try {
      const data = await api('/api/tools/js/scripts/' + id);
      script = data.script;
    } catch (e: any) { toast('加载失败：' + e.message, 'error'); return; }
  }
  title.textContent = script ? '编辑脚本' : '新建脚本';
  body.innerHTML = `
    <div class="form-group">
      <label>名称</label>
      <input type="text" id="jsName" value="${script ? esc(script.name) : ''}" placeholder="脚本名">
    </div>
    <div class="form-group">
      <label>描述</label>
      <input type="text" id="jsDesc" value="${script ? esc(script.desc) : ''}" placeholder="简短描述">
    </div>
    <div class="form-group">
      <label>图标（emoji）</label>
      <input type="text" id="jsIcon" value="${script ? esc(script.icon) : '📝'}" maxlength="4">
    </div>
    <div class="form-group">
      <label>代码</label>
      <textarea id="jsCode" class="sql-editor" rows="12" placeholder="// 输入代码" autocorrect="off" spellcheck="false" autocapitalize="off">${script ? esc(script.code) : ''}</textarea>
    </div>
    <div class="form-group">
      <label class="check-row"><input type="checkbox" id="jsPublished" ${script && script.published ? 'checked' : ''}> 发布到首页</label>
    </div>
  `;
  ov.classList.add('show');
  $('jsSaveBtn').onclick = async () => {
    const payload = {
      name: ($('jsName') as HTMLInputElement).value.trim() || '未命名脚本',
      desc: ($('jsDesc') as HTMLInputElement).value.trim(),
      icon: ($('jsIcon') as HTMLInputElement).value.trim() || '📝',
      code: ($('jsCode') as HTMLTextAreaElement).value,
      published: ($('jsPublished') as HTMLInputElement).checked,
    };
    try {
      if (script) {
        await api('/api/tools/js/scripts/' + script.id, { method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      } else {
        await api('/api/tools/js/scripts', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      }
      toast('已保存', 'success');
      (window as any).closeJsModal();
      loadJsScripts();
      notifyScriptsChanged();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    }
  };
};

// ═══ script:xxx 轻量运行视图 ═══
function renderScriptRunView(): string {
  return `
    <h2 id="scriptRunTitle">📜 脚本运行</h2>
    <div style="margin:12px 0">
      <button class="btn btn-primary" id="scriptRunBtn">▶ 运行</button>
    </div>
    <div class="result-box" id="scriptResult"></div>
  `;
}

function mountScriptRunView(scriptId: string | null): void {
  if (!scriptId) return;
  // 异步加载脚本元信息填充标题
  api('/api/tools/js/scripts/' + scriptId).then(data => {
    const s = data.script;
    if (s) {
      const titleEl = $('scriptRunTitle');
      if (titleEl) titleEl.textContent = (s.icon || '📜') + ' ' + s.name;
    }
  }).catch(() => {});
  const btn = $('scriptRunBtn');
  if (!btn) return;
  btn.onclick = async () => {
    const resultBox = $('scriptResult');
    if (!resultBox) return;
    resultBox.classList.add('show');
    resultBox.innerHTML = '<div class="empty">运行中…</div>';
    try {
      const data = await api('/api/tools/js/scripts/' + scriptId);
      const script = data.script;
      if (!script) { resultBox.innerHTML = formatJsResult({ logs: [], error: { message: '脚本不存在' } }); return; }
      const r = await executeJsCode(script.code, {});
      resultBox.innerHTML = formatJsResult(r);
      api('/api/tools/js/scripts/' + scriptId + '/record-run', {
        method: 'POST',
        body: JSON.stringify({ status: r.error ? 'error' : 'ok', error: r.error?.message }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.innerHTML = formatJsResult({ logs: [], error: { message: e.message } });
    }
  };
}
