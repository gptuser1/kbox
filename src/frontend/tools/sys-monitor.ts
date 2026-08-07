// 工具：系统状态监控
import { $, esc, toast, api } from '../shared.js';

interface MetricItem {
  key: string;
  label: string;
  type: string;
  value: any;
  unit?: string;
  warn?: number;
  crit?: number;
}

interface CategoryGroup {
  label: string;
  metrics: MetricItem[];
}

interface HostListItem {
  id: string;
  hostname: string;
  name: string;
  firstSeen: number;
  lastSeen: number;
  online: boolean;
  summary: MetricItem[];
  hasExtra: boolean;
}

interface HostDetail {
  id: string;
  hostname: string;
  name: string;
  firstSeen: number;
  lastSeen: number;
  online: boolean;
  categories: Record<string, CategoryGroup>;
  extra: string | null;
}

interface HistoryPoint {
  ts: number;
  data: Record<string, any>;
}

let currentHost: HostDetail | null = null;

export function render(): string {
  return `
    <h2>📊 系统状态监控</h2>
    <div id="smHostList"></div>
    <div id="smDetail" style="display:none">
      <div class="sm-detail-bar">
        <button class="btn btn-outline btn-sm" id="smBackBtn">← 返回</button>
        <span id="smDetailTitle" class="sm-detail-title sm-clickable-name"></span>
        <span id="smStatusBadge" class="sm-status-badge"></span>
        <input type="text" id="smRenameInput" class="sm-rename-input" placeholder="新名称" style="display:none">
        <button class="btn btn-outline btn-sm" id="smExtraBtn" style="display:none">📝 附加信息</button>
        <button class="btn btn-outline btn-sm" id="smDeleteBtn" style="margin-left:auto;color:var(--danger)">删除</button>
      </div>
      <div id="smMetrics"></div>
      <div id="smHistory"></div>
    </div>
    <!-- extra 弹窗 -->
    <div class="dl-overlay" id="smExtraOverlay">
      <div class="dl-popup" style="width:400px;max-width:90vw">
        <div class="dlp-title">📝 附加信息</div>
        <pre id="smExtraContent" style="white-space:pre-wrap;word-break:break-all;font-size:13px;line-height:1.6;max-height:300px;overflow-y:auto;margin:8px 0"></pre>
        <button class="btn btn-outline" id="smExtraClose" style="width:100%;font-size:12px">关闭</button>
      </div>
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

  const titleEl = $('smDetailTitle');
  const renameInput = $('smRenameInput') as HTMLInputElement;
  titleEl?.addEventListener('click', () => {
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
    if (e.key === 'Escape') renameInput.style.display = 'none';
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

  // extra 弹窗
  const extraOverlay = $('smExtraOverlay')!;
  const extraBtn = $('smExtraBtn')!;
  extraBtn.addEventListener('click', () => {
    $('smExtraContent')!.textContent = currentHost?.extra || '';
    extraOverlay.classList.add('show');
  });
  $('smExtraClose')!.addEventListener('click', () => {
    extraOverlay.classList.remove('show');
  });
  extraOverlay.addEventListener('click', (e) => {
    if (e.target === extraOverlay) extraOverlay.classList.remove('show');
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

// ─── 主机列表 ───
async function loadHosts() {
  const el = $('smHostList');
  if (!el) return;
  el.innerHTML = '<div class="tool-loader"><div class="app-loader__bar"></div></div>';

  try {
    const data = await api('/api/tools/sys-monitor/hosts') as { hosts: HostListItem[] };
    const hosts = data.hosts || [];
    if (hosts.length === 0) {
      el.innerHTML = '<div class="empty">暂无已注册的主机，请先在客户端运行上报脚本</div>';
      return;
    }

    let html = '<div class="sm-host-grid">';
    for (const host of hosts) {
      const ago = timeAgo(host.lastSeen);
      const statusClass = host.online ? 'sm-dot-online' : 'sm-dot-offline';
      const statusText = host.online ? '在线' : '离线';

      // 摘要指标迷你条
      let summaryHtml = '';
      for (const m of host.summary) {
        if (m.type === 'percent' || m.type === 'temp') {
          const val = parseFloat(m.value) || 0;
          const pct = m.type === 'temp' ? Math.min(100, (val / 100) * 100) : val;
          const colorClass = metricColorClass(val, m.warn, m.crit);
          summaryHtml += `<div class="sm-mini-metric">
            <span class="sm-mini-label">${esc(m.label)}</span>
            <div class="sm-mini-bar"><div class="sm-mini-fill ${colorClass}" style="width:${pct}%"></div></div>
            <span class="sm-mini-val">${val}${esc(m.unit || '')}</span>
          </div>`;
        }
      }

      const extraBadge = host.hasExtra ? '<span class="sm-extra-badge" title="有附加信息">📝</span>' : '';

      html += `<div class="sm-host-card" data-id="${esc(host.id)}">
        <div class="sm-card-header">
          <span class="sm-dot ${statusClass}"></span>
          <span class="sm-card-name">${esc(host.name)}</span>
          ${extraBadge}
          <span class="sm-card-status">${statusText}</span>
        </div>
        <div class="sm-card-meta">${esc(host.hostname)} · ${ago}</div>
        ${summaryHtml ? `<div class="sm-card-summary">${summaryHtml}</div>` : ''}
      </div>`;
    }
    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll('.sm-host-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id')!;
        showHostDetail(id);
      });
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    el.innerHTML = `<div class="empty" style="color:var(--danger)">加载失败：${esc(e.message)}</div>`;
  }
}

// ─── 主机详情 ───
async function showHostDetail(id: string) {
  try {
    const data = await api(`/api/tools/sys-monitor/hosts/${encodeURIComponent(id)}`) as { host: HostDetail; history: HistoryPoint[] };
    currentHost = data.host;
    $('smHostList')!.style.display = 'none';
    const detail = $('smDetail')!;
    detail.style.display = '';
    $('smDetailTitle')!.textContent = data.host.name;
    ($('smRenameInput') as HTMLInputElement).style.display = 'none';

    // 状态徽章
    const badge = $('smStatusBadge')!;
    badge.className = 'sm-status-badge ' + (data.host.online ? 'sm-badge-online' : 'sm-badge-offline');
    badge.textContent = data.host.online ? '在线' : '离线';

    // extra 按钮
    const extraBtn = $('smExtraBtn')!;
    extraBtn.style.display = data.host.extra ? '' : 'none';

    // 指标
    const metricsEl = $('smMetrics')!;
    metricsEl.innerHTML = renderCategories(data.host.categories);

    // 历史
    renderHistory(data.history);
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    toast('加载详情失败：' + e.message, 'error');
  }
}

function renderCategories(categories: Record<string, CategoryGroup>): string {
  const catEntries = Object.entries(categories);
  if (catEntries.length === 0) return '<div class="empty">暂无上报数据</div>';

  let html = '<div class="sm-cat-grid">';
  for (const [catKey, cat] of catEntries) {
    let metricsHtml = '';
    for (const m of cat.metrics) {
      metricsHtml += renderMetricCard(m);
    }
    html += `<div class="sm-cat-card">
      <div class="sm-cat-title">${esc(cat.label)}</div>
      <div class="sm-cat-body">${metricsHtml}</div>
    </div>`;
  }
  html += '</div>';
  return html;
}

function renderMetricCard(m: MetricItem): string {
  if (m.type === 'percent') {
    const val = parseFloat(m.value) || 0;
    const colorClass = metricColorClass(val, m.warn, m.crit);
    return `<div class="sm-metric sm-metric-bar">
      <div class="sm-metric-head">
        <span class="sm-metric-label">${esc(m.label)}</span>
        <span class="sm-metric-value ${colorClass}">${val}${esc(m.unit || '%')}</span>
      </div>
      <div class="sm-progress"><div class="sm-progress-fill ${colorClass}" style="width:${Math.min(100, val)}%"></div></div>
    </div>`;
  }

  if (m.type === 'temp') {
    const val = parseFloat(m.value) || 0;
    const colorClass = metricColorClass(val, m.warn, m.crit);
    const pct = Math.min(100, (val / 120) * 100);
    return `<div class="sm-metric sm-metric-bar">
      <div class="sm-metric-head">
        <span class="sm-metric-label">${esc(m.label)}</span>
        <span class="sm-metric-value ${colorClass}">${val}${esc(m.unit || '°C')}</span>
      </div>
      <div class="sm-progress"><div class="sm-progress-fill ${colorClass}" style="width:${pct}%"></div></div>
    </div>`;
  }

  // 格式化数值
  let displayVal: string;
  if (m.type === 'bytes') {
    displayVal = formatBytes(parseFloat(m.value) || 0);
  } else if (m.type === 'kb') {
    displayVal = formatKB(parseFloat(m.value) || 0);
  } else if (m.type === 'mb') {
    displayVal = formatMB(parseFloat(m.value) || 0);
  } else if (m.type === 'float') {
    displayVal = (parseFloat(m.value) || 0).toFixed(2);
  } else if (m.key === 'uptime_seconds') {
    displayVal = formatUptime(parseFloat(m.value) || 0);
  } else {
    displayVal = String(m.value);
  }

  return `<div class="sm-metric">
    <span class="sm-metric-label">${esc(m.label)}</span>
    <span class="sm-metric-value">${esc(displayVal)}</span>
  </div>`;
}

// ─── 历史趋势 ───
function renderHistory(history: HistoryPoint[]) {
  const el = $('smHistory')!;
  if (history.length === 0) {
    el.innerHTML = '';
    return;
  }

  // 静态/累加型指标不参与历史趋势
  const excludeFromHistory = new Set([
    'cpu_cores', 'mem_total_mb', 'uptime_seconds', 'net_iface',
  ]);

  // 找出所有数值字段
  const numericFields = new Map<string, string>();
  const knownLabels: Record<string, string> = {
    cpu_usage: 'CPU 使用率', cpu_temp: 'CPU 温度',
    mem_usage: '内存使用率', mem_used_mb: '内存已用', swap_usage: 'Swap 使用率',
    disk_usage: '磁盘使用率', disk_total_kb: '磁盘总量', disk_used_kb: '磁盘已用',
    load_1m: '1分钟负载', load_5m: '5分钟负载', load_15m: '15分钟负载', processes: '进程数',
    net_rx_bytes: '接收总量', net_tx_bytes: '发送总量',
  };

  for (const pt of history) {
    for (const [k, v] of Object.entries(pt.data)) {
      if (excludeFromHistory.has(k)) continue;
      if (v != null && (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))))) {
        if (!numericFields.has(k)) {
          numericFields.set(k, knownLabels[k] || k);
        }
      }
    }
  }

  if (numericFields.size === 0) {
    el.innerHTML = '';
    return;
  }

  let html = '<div class="section-title" style="margin-top:20px">历史趋势</div>';
  html += '<div class="sm-chart-grid">';

  for (const [field, label] of numericFields) {
    const values = history
      .map(pt => ({ ts: pt.ts, val: parseFloat(pt.data[field]) }))
      .filter(v => !isNaN(v.val));

    if (values.length < 2) continue;

    const max = Math.max(...values.map(v => v.val));
    const min = Math.min(...values.map(v => v.val));
    const range = max - min || 1;

    // 生成 SVG 折线图
    const w = 100;
    const h = 40;
    const step = w / (values.length - 1);
    let pathD = '';
    let areaD = '';
    values.forEach((v, i) => {
      const x = i * step;
      const y = h - ((v.val - min) / range) * h;
      if (i === 0) {
        pathD += `M${x},${y}`;
        areaD += `M${x},${h} L${x},${y}`;
      } else {
        pathD += ` L${x},${y}`;
        areaD += ` L${x},${y}`;
      }
    });
    areaD += ` L${w},${h} Z`;

    html += `<div class="sm-chart-card">
      <div class="sm-chart-head">
        <span class="sm-chart-label">${esc(label)}</span>
        <span class="sm-chart-range">${formatNum(min)} ~ ${formatNum(max)}</span>
      </div>
      <svg class="sm-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <path d="${areaD}" class="sm-spark-area"/>
        <path d="${pathD}" class="sm-spark-line"/>
      </svg>
    </div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

// ─── 工具函数 ───
function metricColorClass(val: number, warn?: number, crit?: number): string {
  if (crit != null && val >= crit) return 'sm-crit';
  if (warn != null && val >= warn) return 'sm-warn';
  return 'sm-ok';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function formatKB(kb: number): string {
  if (kb < 1024) return kb + ' KB';
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB';
  return (kb / 1024 / 1024).toFixed(2) + ' GB';
}

function formatMB(mb: number): string {
  if (mb < 1024) return mb + ' MB';
  return (mb / 1024).toFixed(2) + ' GB';
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}天${h}小时`;
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return sec + ' 秒前';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' 分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' 小时前';
  const day = Math.floor(hr / 24);
  return day + ' 天前';
}
