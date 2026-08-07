// 工具：系统状态监控
import { $, esc, toast, api } from '../shared.js';

interface HostInfo {
  id: string;
  hostname: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  data: Record<string, any>;
}

interface HistoryPoint {
  timestamp: string;
  data: Record<string, any>;
}

let currentHost: HostInfo | null = null;

export function render(): string {
  return `
    <h2>📊 系统状态监控</h2>
    <div class="subtitle">多主机系统指标看板，客户端主动上报</div>
    <div id="smHostList"></div>
    <div id="smDetail" style="display:none">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-outline" id="smBackBtn" style="font-size:13px">← 返回列表</button>
        <span id="smDetailTitle" style="font-size:18px;font-weight:600"></span>
        <input type="text" id="smRenameInput" placeholder="新名称" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);font-size:13px;width:160px;display:none">
        <button class="btn btn-outline btn-sm" id="smRenameBtn" style="font-size:12px">✎ 重命名</button>
        <button class="btn btn-danger btn-sm" id="smDeleteBtn" style="font-size:12px;margin-left:auto">删除</button>
      </div>
      <div id="smLatestData" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px"></div>
      <div id="smHistoryChart"></div>
    </div>
  `;
}

export function mount(): void {
  loadHosts();

  $('smBackBtn')?.addEventListener('click', () => {
    currentHost = null;
    $('smDetail')!.style.display = 'none';
    $('smHostList')!.style.display = '';
    loadHosts();
  });

  const renameBtn = $('smRenameBtn');
  const renameInput = $('smRenameInput') as HTMLInputElement;
  renameBtn?.addEventListener('click', () => {
    if (renameInput!.style.display === 'none') {
      renameInput!.style.display = '';
      renameInput!.value = currentHost?.name || '';
      renameInput!.focus();
    } else {
      doRename(renameInput!.value.trim());
    }
  });
  renameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doRename(renameInput.value.trim());
  });

  $('smDeleteBtn')?.addEventListener('click', async () => {
    if (!currentHost) return;
    if (!confirm(`确定删除主机「${currentHost.name}」及其所有历史数据？`)) return;
    try {
      await api(`/api/tools/sys-monitor/hosts/${encodeURIComponent(currentHost.id)}`, { method: 'DELETE' });
      toast('已删除', 'success');
      $('smDetail')!.style.display = 'none';
      $('smHostList')!.style.display = '';
      currentHost = null;
      loadHosts();
    } catch (e: any) {
      toast('删除失败：' + e.message, 'error');
    }
  });
}

async function doRename(name: string) {
  if (!currentHost || !name) return;
  try {
    await api(`/api/tools/sys-monitor/hosts/${encodeURIComponent(currentHost.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
      headers: { 'Content-Type': 'application/json' },
    });
    currentHost.name = name;
    $('smDetailTitle')!.textContent = name;
    ($('smRenameInput') as HTMLInputElement).style.display = 'none';
    toast('已重命名', 'success');
  } catch (e: any) {
    toast('重命名失败：' + e.message, 'error');
  }
}

async function loadHosts() {
  const el = $('smHostList');
  if (!el) return;
  el.innerHTML = '<div class="tool-loader"><div class="app-loader__bar"></div></div>';

  try {
    const data = await api('/api/tools/sys-monitor/hosts') as { hosts: HostInfo[] };
    const hosts = data.hosts || [];
    if (hosts.length === 0) {
      el.innerHTML = '<div class="empty">暂无已注册的主机，请先在客户端运行上报脚本</div>';
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:10px">';
    for (const host of hosts) {
      const ago = timeAgo(host.lastSeen);
      const status = isRecent(host.lastSeen) ? '🟢' : '🔴';
      html += `
        <div class="wf-item" data-id="${esc(host.id)}" style="cursor:pointer">
          <div class="wf-info">
            <div class="wf-name">${esc(host.name)}</div>
            <div class="wf-path" style="color:var(--text-muted);font-size:12px;margin-top:2px">
              主机名: ${esc(host.hostname)} · 最后上报: ${ago}
            </div>
          </div>
          <div class="wf-state" style="font-size:16px">${status}</div>
        </div>
      `;
    }
    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll('.wf-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id')!;
        showHostDetail(id);
      });
    });
  } catch (e: any) {
    el.innerHTML = `<div class="empty" style="color:var(--danger)">加载失败：${esc(e.message)}</div>`;
  }
}

async function showHostDetail(id: string) {
  try {
    const data = await api(`/api/tools/sys-monitor/hosts/${encodeURIComponent(id)}`) as { host: HostInfo; history: HistoryPoint[] };
    currentHost = data.host;
    $('smHostList')!.style.display = 'none';
    const detail = $('smDetail')!;
    detail.style.display = '';
    $('smDetailTitle')!.textContent = data.host.name;
    ($('smRenameInput') as HTMLInputElement).style.display = 'none';

    // 最新数据
    const latestEl = $('smLatestData')!;
    latestEl.innerHTML = renderMetrics(data.host.data);

    // 历史
    renderHistory(data.history);
  } catch (e: any) {
    toast('加载详情失败：' + e.message, 'error');
  }
}

function renderMetrics(data: Record<string, any>): string {
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (entries.length === 0) return '<div class="empty">暂无上报数据</div>';

  return entries.map(([key, val]) => {
    const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `
      <div style="background:var(--card);border-radius:10px;padding:14px 18px;box-shadow:var(--shadow);min-width:150px;flex:1">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${esc(key)}</div>
        <div style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums">${esc(display)}</div>
      </div>
    `;
  }).join('');
}

function renderHistory(history: HistoryPoint[]) {
  const el = $('smHistoryChart')!;
  if (history.length === 0) {
    el.innerHTML = '';
    return;
  }

  // 找出所有数值字段
  const numericFields = new Set<string>();
  for (const pt of history) {
    for (const [k, v] of Object.entries(pt.data)) {
      if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
        numericFields.add(k);
      }
    }
  }

  if (numericFields.size === 0) {
    el.innerHTML = '';
    return;
  }

  let html = '<div class="section-title">历史趋势</div>';
  html += '<div style="display:flex;flex-direction:column;gap:16px">';

  for (const field of numericFields) {
    const values = history
      .map(pt => ({ ts: pt.timestamp, val: parseFloat(pt.data[field]) }))
      .filter(v => !isNaN(v.val));

    if (values.length < 2) continue;

    const max = Math.max(...values.map(v => v.val));
    const min = Math.min(...values.map(v => v.val));
    const range = max - min || 1;

    // 迷你条形图
    let bars = '';
    for (const v of values) {
      const pct = ((v.val - min) / range) * 100;
      const time = v.ts.slice(11, 19);
      bars += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;height:${Math.max(pct * 0.6, 2)}px;background:var(--primary);border-radius:2px;min-height:2px;transition:height 0.2s" title="${time} ${v.val}"></div>
        <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;writing-mode:vertical-lr;text-orientation:mixed;height:16px;overflow:hidden">${time}</div>
      </div>`;
    }

    html += `
      <div style="background:var(--card);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600">${esc(field)}</div>
        <div style="display:flex;align-items:flex-end;gap:1px;height:60px">
          ${bars}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:4px">
          <span>${min}</span>
          <span>${max}</span>
        </div>
      </div>
    `;
  }

  html += '</div>';
  el.innerHTML = html;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + ' 秒前';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' 分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' 小时前';
  const day = Math.floor(hr / 24);
  return day + ' 天前';
}

function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}