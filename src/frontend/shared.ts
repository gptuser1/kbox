// 前端公共工具：壳(shell)与各工具模块共享的单向依赖层。
// 本模块不依赖 shell，状态/回调由 shell 通过 setter 注入，避免循环依赖。

let currentToken = '';
let unauthorizedHandler: () => void = () => {};
let toastContainer: HTMLElement | null = null;

export function setToken(t: string): void { currentToken = t; }
export function getToken(): string { return currentToken; }
export function setUnauthorizedHandler(fn: () => void): void { unauthorizedHandler = fn; }
export function initToast(c: HTMLElement): void { toastContainer = c; }

// document.getElementById 简写
export function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

// HTML 转义
export function esc(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 日期格式化：'2026-08-06T08:39:00Z' → '2026-08-06 08:39'
export function formatDate(s: any): string {
  if (!s) return '';
  return String(s).replace('T', ' ').substring(0, 16);
}

// 轻提示
export function toast(msg: string, type?: string): void {
  type = type || 'info';
  if (!toastContainer) toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// 统一带鉴权的 API 调用；401 时触发 shell 注册的失效回调
export async function api(url: string, options?: any): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options?.headers || {}), 'Authorization': 'Bearer ' + currentToken },
  });
  if (res.status === 401) {
    unauthorizedHandler();
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    let msg = '请求失败';
    try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
