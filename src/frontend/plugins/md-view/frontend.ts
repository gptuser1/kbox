// 插件：MD 阅读
// 纯前端、本地解析。用户选择本地的 .md/.markdown/.txt 文件后，
// 在浏览器里用内置的 snarkdown 解析器渲染成 HTML，不上传任何内容到服务器。
// 支持「渲染 / 原文」切换。
//
// 解析器：snarkdown (developit) —— MIT，约 1KB，单函数 parse(md) -> html。
// 为契合 es2022 与无依赖约束，源码内联于此。snarkdown 不覆盖表格语法。
import { $, toast } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

// ─── snarkdown 解析器（内联，自 developit/snarkdown，MIT）───
const TAGS: Record<string, string[]> = {
  '': ['<em>', '</em>'],
  _: ['<strong>', '</strong>'],
  '*': ['<strong>', '</strong>'],
  '~': ['<s>', '</s>'],
  '\n': ['<br />'],
  ' ': ['<br />'],
  '-': ['<hr />'],
};

/** 按首个缩进行的前导空白整体去缩进。 */
function outdent(str: string): string {
  const m = str.match(/^(\t| )+/);
  return m ? str.replace(RegExp('^' + m[0], 'gm'), '') : str;
}

/** 编码字符串中的特殊属性字符为 HTML 实体。 */
function encodeAttr(str: string): string {
  return (str + '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 将 Markdown 字符串解析为 HTML 字符串。 */
function snarkdown(md: string, prevLinks?: Record<string, string>): string {
  const tokenizer = /((?:^|\n+)(?:\n---+|\* \*(?: \*)+)\n)|(?:^``` *(\w*)\n([\s\S]*?)\n```$)|((?:(?:^|\n+)(?:\t|  {2,}).+)+\n*)|((?:(?:^|\n)([>*+-]|\d+\.)\s+.*)+)|(?:!\[([^\]]*?)\]\(([^)]+?)\))|(\[)|(\](?:\(([^)]+?)\))?)|(?:(?:^|\n+)([^\s].*)\n(-{3,}|={3,})(?:\n+|$))|(?:(?:^|\n+)(#{1,6})\s*(.+)(?:\n+|$))|(?:`([^`].*?)`)|(  \n\n*|\n{2,}|__|\*\*|[_*]|~~)/gm;
  const context: string[] = [];
  const links: Record<string, string> = prevLinks || {};
  let out = '';
  let last = 0;
  let token: RegExpExecArray | null;
  let chunk: string;
  let prev: string;
  let t: string;

  const tag = (tok: RegExpExecArray | string): string => {
    const tokenText = typeof tok === 'string' ? tok : (tok[1] || '');
    const desc = TAGS[tokenText] || null;
    const end = context[context.length - 1] === tokenText;
    if (!desc) return tokenText;
    if (!desc[1]) return desc[0];
    if (end) context.pop();
    else context.push(tokenText);
    return desc[end ? 1 : 0];
  };
  const flush = (): string => {
    let str = '';
    while (context.length) str += tag(context[context.length - 1]);
    return str;
  };

  md = md
    .replace(/^\[(.+?)\]:\s*(.+)$/gm, (s, name, url) => {
      links[name.toLowerCase()] = url;
      return '';
    })
    .replace(/^\n+|\n+$/g, '');

  while ((token = tokenizer.exec(md))) {
    prev = md.substring(last, token.index);
    last = tokenizer.lastIndex;
    chunk = token[0];
    if (prev.match(/[^\\](\\\\)*\\$/)) {
      // 反斜杠转义，跳过
    } else if ((t = token[3] || token[4])) {
      // 代码 / 缩进块
      chunk =
        '<pre class="code ' + (token[4] ? 'poetry' : token[2].toLowerCase()) + '"><code' +
        (token[2] ? ' class="language-' + token[2].toLowerCase() + '"' : '') + '>' +
        outdent(encodeAttr(t).replace(/^\n+|\n+$/g, '')) + '</code></pre>';
    } else if ((t = token[6])) {
      // 引用 / 列表
      if (t.match(/\./)) token[5] = token[5].replace(/^\d+/gm, '');
      let inner = snarkdown(outdent(token[5].replace(/^\s*[>*+.-]/gm, '')), links);
      let tagName: string;
      if (t === '>') tagName = 'blockquote';
      else {
        tagName = t.match(/\./) ? 'ol' : 'ul';
        inner = inner.replace(/^(.*)(\n|$)/gm, '<li>$1</li>');
      }
      chunk = '<' + tagName + '>' + inner + '</' + tagName + '>';
    } else if (token[8]) {
      // 图片
      chunk = `<img src="${encodeAttr(token[8])}" alt="${encodeAttr(token[7])}">`;
    } else if (token[10]) {
      // 链接闭合
      out = out.replace('<a>', `<a href="${encodeAttr(token[11] || links[prev.toLowerCase()])}">`);
      chunk = flush() + '</a>';
    } else if (token[9]) {
      // 链接开始
      chunk = '<a>';
    } else if (token[12] || token[14]) {
      // 标题（setext / atx）
      t = 'h' + (token[14] ? token[14].length : token[13] > '=' ? 1 : 2);
      chunk = '<' + t + '>' + snarkdown(token[12] || token[15], links) + '</' + t + '>';
    } else if (token[16]) {
      // 行内代码
      chunk = '<code>' + encodeAttr(token[16]) + '</code>';
    } else if (token[17] || token[1]) {
      // 行内格式：粗体、斜体等
      chunk = tag(token[17] || '--');
    }
    out += prev;
    out += chunk;
  }
  return (out + md.substring(last) + flush()).replace(/^\n+|\n+$/g, '');
}

// ─── 插件 UI ───
export function render(): string {
  return `
    <h2>📖 MD 阅读</h2>
    <p style="margin-bottom:12px">选择本地的 Markdown 文件，仅在本机解析渲染，不会上传到服务器。</p>
    <div class="form-group">
      <input type="file" id="mdFile" accept=".md,.markdown,.txt,text/markdown,text/plain">
    </div>
    <div class="form-group" style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-outline btn-sm" id="mdToggle" type="button" disabled>原文</button>
      <span id="mdMeta" style="font-size:12px;color:var(--text-muted)">未选择文件</span>
    </div>
    <div class="result-box" id="mdOutput">
      <div class="section-title">内容</div>
      <div id="mdContent"></div>
    </div>
  `;
}

export function mount(): void {
  const fileEl = $('mdFile') as HTMLInputElement;
  const toggle = $('mdToggle') as HTMLButtonElement;
  const output = $('mdOutput');
  const content = $('mdContent');
  if (!fileEl || !toggle || !output || !content) return;

  let rawText = '';
  let showRaw = false;

  function refresh() {
    if (!rawText) return;
    content.innerHTML = showRaw
      ? '<div class="sql-editor" style="white-space:pre-wrap;word-break:break-all;cursor:default;margin:0">' + escapeHtml(rawText) + '</div>'
      : snarkdown(rawText);
    toggle.textContent = showRaw ? '渲染' : '原文';
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  fileEl.addEventListener('change', () => {
    const f = fileEl.files && fileEl.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      rawText = String(reader.result || '');
      if (!rawText) { toast('文件为空', 'error'); return; }
      showRaw = false;
      output.classList.add('show');
      ($('mdMeta') as HTMLElement).textContent = f.name + ' · ' + (f.size / 1024).toFixed(1) + ' KB';
      toggle.disabled = false;
      refresh();
    };
    reader.onerror = () => toast('文件读取失败', 'error');
    reader.readAsText(f, 'utf-8');
  });

  toggle.addEventListener('click', () => {
    showRaw = !showRaw;
    refresh();
  });
}

// 编译期校验：确保符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };