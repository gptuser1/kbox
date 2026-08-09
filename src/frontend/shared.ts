// 前端公共工具：壳(shell)与各工具模块共享的单向依赖层。
// 本模块不依赖 shell，状态/回调由 shell 通过 setter 注入，避免循环依赖。

// ─── 前端插件接口（与 src/adaptation/types.ts 中 FrontendPlugin 定义保持一致） ───
// 所有前端工具模块必须实现此接口，由 tsc --noEmit 在构建期强制校验。
export interface FrontendPlugin {
  render(id?: string): string;   // 渲染 HTML
  mount(id?: string): void;      // 挂载事件
  unmount?(): void;              // 卸载清理（可选）
}

// ─── EventBus：前端插件间发布/订阅通信 ───
// 接口预留，当前仅 js 工具通过 kbox:scripts-changed 事件与壳通信。
// 后续插件间联动可复用此总线，避免插件直接互相 import。
interface EventBus {
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
  emit(event: string, data?: any): void;
}

const handlers: Record<string, Array<(data: any) => void>> = {};

export const eventBus: EventBus = {
  on(event, handler) {
    (handlers[event] ||= []).push(handler);
  },
  off(event, handler) {
    const arr = handlers[event];
    if (!arr) return;
    const i = arr.indexOf(handler);
    if (i >= 0) arr.splice(i, 1);
  },
  emit(event, data?) {
    const arr = handlers[event];
    if (!arr) return;
    // 复制一份，防止 handler 内部 off 导致迭代错位
    for (const h of arr.slice()) {
      try { h(data); } catch (e) { console.error('[eventBus]', event, e); }
    }
  },
};

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
