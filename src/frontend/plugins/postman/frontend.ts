// 插件：轻量 Postman
// 独立模块，由 shell 在点击时动态 import('/js/plugins/postman.js') 加载。
// 请求由浏览器本地 fetch 直接发出，不经过 worker 后端。
// 支持自定义请求头（如 Bearer token）、请求体与多种请求方法。
import { $, esc, toast } from '../../shared.js';
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
      <label>请求头（每行一个：Key: Value）</label>
      <textarea id="pmHeaders" class="sql-editor" rows="4" placeholder="Authorization: Bearer xxx&#10;Content-Type: application/json" autocorrect="off" spellcheck="false" autocapitalize="off"></textarea>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">示例：<code>Authorization: Bearer &lt;token&gt;</code>、<code>X-Custom: foo</code>。跨域自定义头会触发浏览器 CORS 预检。</div>
    </div>
    <div class="form-group">
      <label>请求体（仅 POST/PUT/PATCH）</label>
      <textarea id="pmBody" class="sql-editor" rows="6" placeholder='{"key": "value"}' autocorrect="off" spellcheck="false" autocapitalize="off"></textarea>
    </div>
    <div class="result-box" id="pmResult"></div>
  `;
}

export function mount(id?: string): void {
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

// 解析请求头文本（每行 Key: Value），忽略空行与 # 注释
function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
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
  const headersText = (($('pmHeaders') as HTMLTextAreaElement)?.value || '');
  const bodyText = (($('pmBody') as HTMLTextAreaElement)?.value || '');

  const resultBox = $('pmResult');
  if (!resultBox) return;

  if (!url) { toast('请输入 URL', 'error'); return; }

  const headers = parseHeaders(headersText);
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const hasBodyContent = bodyText.trim() !== '';

  resultBox.classList.add('show');
  resultBox.innerHTML = '<div class="empty">发送中…</div>';

  const started = Date.now();
  try {
    const init: RequestInit = { method, headers };
    if (hasBody && hasBodyContent) {
      init.body = bodyText;
      // 未显式指定 Content-Type 且 body 是 JSON 时自动补一个（便于服务端解析）
      if (!headers['Content-Type'] && /^\s*[\[{]/.test(bodyText)) {
        (headers as any)['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(url, init);
    const elapsed = Date.now() - started;
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => { resHeaders[key] = value; });

    let body = '';
    try { body = await res.text(); } catch { /* CORS 限制无法读取 body */ }

    const statusColor = res.ok ? 'var(--text)' : '#ef4444';
    let html = '<div class="section-title">响应</div>';
    html += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">';
    html += '<span style="font-size:18px;font-weight:700;color:' + statusColor + '">' + res.status + ' ' + esc(res.statusText) + '</span>';
    html += '<span style="font-size:12px;color:var(--text-muted)">' + elapsed + ' ms</span>';
    html += '</div>';

    const headerKeys = Object.keys(resHeaders);
    html += '<div class="section-title">响应头</div>';
    if (headerKeys.length > 0) {
      html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:60px;cursor:default">' +
        esc(headerKeys.map(k => k + ': ' + resHeaders[k]).join('\n')) + '</div>';
    } else {
      html += '<div class="empty">（无响应头 / 受 CORS 限制）</div>';
    }

    html += '<div class="section-title">响应体</div>';
    if (body) {
      html += '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:120px;cursor:default">' + esc(formatBody(body)) + '</div>';
    } else {
      html += '<div class="empty">（无响应体 或 受 CORS 限制无法读取）</div>';
    }

    resultBox.innerHTML = html;
  } catch (e: any) {
    const elapsed = Date.now() - started;
    resultBox.innerHTML = '<div class="section-title">响应</div>' +
      '<div style="color:#ef4444;font-size:14px;margin-bottom:8px">请求失败（' + elapsed + ' ms）</div>' +
      '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;min-height:60px;cursor:default;color:#ef4444">' +
      esc(e instanceof TypeError ? '网络错误或 CORS 拦截：' + e.message : e.message) + '</div>';
  }
}

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };