// 插件：轻量 Postman
// 独立模块，由 shell 在点击时动态 import('/js/plugins/postman.js') 加载。
// 请求经 kbox worker 后端转发（/api/plugins/postman/request），绕开浏览器 CORS 限制。
// 支持自定义请求头（如 Bearer token）、请求体与多种请求方法。
import { $, esc, toast, api } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

export function render(id?: string): string {
  return `
    <h2>🚀 轻量 Postman</h2>
    <div class="form-group">
      <label>请求</label>
      <div style="display:flex;gap:8px">
        <select id="pmMethod" style="width:110px;flex:none">
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>PATCH</option>
          <option>DELETE</option>
          <option>HEAD</option>
          <option>OPTIONS</option>
        </select>
        <input type="text" id="pmUrl" placeholder="https://example.com/api" style="flex:1" autocomplete="off" spellcheck="false">
        <button class="btn btn-primary" id="pmSend" style="flex:none">发送</button>
      </div>
    </div>
    <div class="form-group">
      <label>请求头</label>
      <div id="pmHeaderRows"></div>
      <button class="btn btn-outline btn-sm" id="pmAddHeader" type="button">+ 增加一行</button>
    </div>
    <div class="form-group">
      <label>请求体（仅 POST/PUT/PATCH）</label>
      <textarea id="pmBody" class="sql-editor" rows="6" placeholder='{"key": "value"}' autocorrect="off" spellcheck="false" autocapitalize="off"></textarea>
    </div>
    <div class="result-box" id="pmResult"></div>
  `;
}

export function mount(id?: string): void {
  // 请求头：默认一行，点击 + 增加一行
  addHeaderRow();
  const addBtn = $('pmAddHeader');
  if (addBtn) addBtn.onclick = () => addHeaderRow();

  const sendBtn = $('pmSend');
  if (!sendBtn) return;
  sendBtn.onclick = () => runRequest();
  // 回车发送
  const urlEl = $('pmUrl');
  if (urlEl) {
    urlEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') runRequest();
    });
  }
}

// 新增一行请求头（左 K 右 V 两个输入框）
function addHeaderRow(k?: string, v?: string): void {
  const rows = $('pmHeaderRows');
  if (!rows) return;
  const row = document.createElement('div');
  row.className = 'pm-header-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = 'Key';
  keyInput.value = k || '';
  keyInput.style.cssText = 'flex:1;min-width:0';
  keyInput.autocomplete = 'off';
  keyInput.spellcheck = false;
  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.placeholder = 'Value';
  valInput.value = v || '';
  valInput.style.cssText = 'flex:1;min-width:0';
  valInput.autocomplete = 'off';
  valInput.spellcheck = false;
  row.appendChild(keyInput);
  row.appendChild(valInput);
  rows.appendChild(row);
}

// 从输入行收集请求头（忽略 Key 或 Value 为空的）
function collectHeaders(): Record<string, string> {
  const rows = $('pmHeaderRows');
  const headers: Record<string, string> = {};
  if (!rows) return headers;
  rows.querySelectorAll('.pm-header-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs.length < 2) return;
    const k = (inputs[0] as HTMLInputElement).value.trim();
    const v = (inputs[1] as HTMLInputElement).value.trim();
    if (k && v) headers[k] = v;
  });
  return headers;
}

// 响应体格式化：JSON 美化，否则原文
function formatBody(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.stringify(JSON.parse(trimmed), null, 2); } catch { /* 非 JSON */ }
  }
  return text;
}

async function runRequest(): Promise<void> {
  const url = (($('pmUrl') as HTMLInputElement)?.value || '').trim();
  const method = (($('pmMethod') as HTMLSelectElement)?.value || 'GET') as string;
  const bodyText = (($('pmBody') as HTMLTextAreaElement)?.value || '');

  const resultBox = $('pmResult');
  if (!resultBox) return;

  if (!url) { toast('请输入 URL', 'error'); return; }

  const headers = collectHeaders();
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const hasBodyContent = bodyText.trim() !== '';
  // 未显式指定 Content-Type 且 body 是 JSON 时自动补一个（便于服务端解析）
  if (hasBody && hasBodyContent && !headers['Content-Type'] && /^\s*[\[{]/.test(bodyText)) {
    headers['Content-Type'] = 'application/json';
  }

  resultBox.classList.add('show');
  resultBox.innerHTML = '<div class="empty">发送中…</div>';

  const started = Date.now();
  try {
    const data = await api('/api/plugins/postman/request', {
      method: 'POST',
      body: JSON.stringify({
        method,
        url,
        headers,
        body: hasBody && hasBodyContent ? bodyText : '',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const elapsed = Date.now() - started;

    const statusColor = data.status >= 200 && data.status < 300 ? 'var(--text)' : '#ef4444';
    let html = '<div class="section-title">响应</div>';
    html += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">';
    html += '<span style="font-size:18px;font-weight:700;color:' + statusColor + '">' + data.status + ' ' + esc(data.statusText || '') + '</span>';
    html += '<span style="font-size:12px;color:var(--text-muted)">' + elapsed + ' ms</span>';
    html += '</div>';

    const headerKeys = Object.keys(data.headers || {});
    html += '<div class="section-title">响应头</div>';
    if (headerKeys.length > 0) {
      html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:60px;cursor:default">' +
        esc(headerKeys.map(k => k + ': ' + data.headers[k]).join('\n')) + '</div>';
    } else {
      html += '<div class="empty">（无响应头）</div>';
    }

    html += '<div class="section-title">响应体</div>';
    if (data.body) {
      html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:120px;cursor:default">' + esc(formatBody(data.body)) + '</div>';
    } else {
      html += '<div class="empty">（无响应体）</div>';
    }

    resultBox.innerHTML = html;
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    const elapsed = Date.now() - started;
    resultBox.innerHTML = '<div class="section-title">响应</div>' +
      '<div style="color:#ef4444;font-size:14px;margin-bottom:8px">请求失败（' + elapsed + ' ms）</div>' +
      '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:60px;cursor:default;color:#ef4444">' +
      esc(e.message) + '</div>';
  }
}

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };