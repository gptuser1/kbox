// 工具：定时任务（Cron）管理
// 独立模块，由 shell 在点击时动态 import('/js/plugins/cron.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

const CRON_ACTIONS: Record<string, string> = { news_crawl: '新闻抓取' };

export function render(): string {
  return `
    <h2>⏰ 定时任务</h2>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="cronNewBtn">+ 新建任务</button>
      <button class="btn btn-outline" id="cronRefreshBtn">刷新</button>
    </div>
    <div id="cronList"></div>
    <div class="modal-overlay" id="cronModalOverlay">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 id="cronModalTitle">新建任务</h3>
          <button class="modal-close" onclick="closeCronModal()">✕</button>
        </div>
        <div class="modal-body" id="cronModalBody"></div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="cronSaveBtn">保存</button>
          <button class="btn btn-outline" onclick="closeCronModal()">取消</button>
        </div>
      </div>
    </div>
  `;
}

export function mount(): void {
  const newBtn = $('cronNewBtn');
  const refreshBtn = $('cronRefreshBtn');
  if (newBtn) newBtn.onclick = () => (window as any).renderCronEditor(null);
  if (refreshBtn) refreshBtn.onclick = () => loadCronTasks();
  // 事件委托：避免内联 onclick 的引号转义陷阱
  const list = $('cronList');
  if (list) {
    list.addEventListener('click', (e: Event) => {
      const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
      if (!btn) return;
      const act = btn.getAttribute('data-act') || '';
      const id = btn.getAttribute('data-id') || '';
      if (act === 'run') (window as any).triggerCronTask(id);
      else if (act === 'edit') (window as any).renderCronEditor(id);
      else if (act === 'delete') (window as any).deleteCronTask(id);
    });
  }
  loadCronTasks();
}

async function loadCronTasks(): Promise<void> {
  const list = $('cronList');
  if (!list) return;
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const data = await api('/api/cron-tasks');
    if (!data.tasks || data.tasks.length === 0) {
      list.innerHTML = '<div class="empty">暂无任务</div>';
      return;
    }
    let html = '<div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl-table">' +
      '<thead><tr><th>名称</th><th>Action</th><th>触发小时</th><th>启用</th><th>上次执行</th><th>状态</th><th class="tbl-th-actions">操作</th></tr></thead><tbody>';
    for (const t of data.tasks) {
      const statusBadge = t.lastStatus === 'ok' ? '<span class="badge badge-ok">OK</span>'
        : t.lastStatus === 'error' ? '<span class="badge badge-err">ERR</span>'
        : '<span class="badge">-</span>';
      const lastRun = t.lastRunAt ? new Date(t.lastRunAt).toLocaleString('zh-CN') : '从未';
      const errTip = t.lastError ? ' title="' + esc(t.lastError) + '"' : '';
      const hours = Array.isArray(t.hours) ? t.hours : [];
      const hoursText = hours.length === 0 ? '每小时' : hours.map((h: number) => String(h).padStart(2, '0')).join(',');
      const tid = esc(t.id);
      const actionLabel = t.action ? esc(t.action) : '-';
      html += '<tr' + errTip + '><td>' + esc(t.name) + '</td><td><code>' + actionLabel + '</code></td><td>' + esc(hoursText) + '</td><td>' + (t.enabled ? '✓' : '✗') + '</td><td>' + esc(lastRun) + '</td><td>' + statusBadge + '</td><td class="tbl-td-actions"><div class="tbl-row-actions">' +
        '<button class="btn btn-outline btn-sm" data-act="run" data-id="' + tid + '">运行</button>' +
        '<button class="btn btn-outline btn-sm" data-act="edit" data-id="' + tid + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-act="delete" data-id="' + tid + '">删除</button>' +
        '</div></td></tr>';
    }
    html += '</tbody></table></div></div>';
    list.innerHTML = html;
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

(window as any).triggerCronTask = async function (id: string) {
  toast('执行中...', 'info');
  try {
    const r = await api('/api/cron-tasks/' + id + '/trigger', { method: 'POST' });
    if (r.ok) toast('执行成功', 'success');
    else toast('执行失败：' + (r.error || '未知错误'), 'error');
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return;
    toast('执行失败：' + e.message, 'error');
  }
  loadCronTasks();
};

(window as any).deleteCronTask = function (id: string) {
  (window as any).showConfirm('确认删除该任务？', async () => {
    try {
      await api('/api/cron-tasks/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      loadCronTasks();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  });
};

(window as any).closeCronModal = function () {
  const ov = $('cronModalOverlay');
  if (ov) ov.classList.remove('show');
};

(window as any).renderCronEditor = async function (id: string | null) {
  const ov = $('cronModalOverlay');
  const body = $('cronModalBody');
  const title = $('cronModalTitle');
  if (!ov || !body) return;
  let task: any = null;
  if (id) {
    try {
      const data = await api('/api/cron-tasks');
      task = data.tasks.find((t: any) => t.id === id);
    } catch (e: any) { toast('加载失败：' + e.message, 'error'); return; }
  }
  title.textContent = task ? '编辑任务' : '新建任务';
  let actionOptions = '';
  for (const k in CRON_ACTIONS) {
    actionOptions += '<option value="' + k + '"' + (task && task.action === k ? ' selected' : '') + '>' + esc(k) + '</option>';
  }
  const curHours = (task && Array.isArray(task.hours)) ? task.hours : [];
  let hoursCheckboxes = '';
  for (let h = 0; h < 24; h++) {
    const checked = curHours.includes(h) ? ' checked' : '';
    hoursCheckboxes += '<label class="hour-chip"><input type="checkbox" value="' + h + '"' + checked + '><span>' + String(h).padStart(2, '0') + '</span></label>';
  }
  body.innerHTML = `
    <div class="form-group">
      <label>名称</label>
      <input type="text" id="cronName" value="${task ? esc(task.name) : ''}" placeholder="任务名">
    </div>
    <div class="form-group">
      <label>Action</label>
      <select id="cronAction">${actionOptions}</select>
    </div>
    <div class="form-group">
      <label>触发小时（北京时间，不选则每小时）</label>
      <div class="hour-grid" id="cronHours">${hoursCheckboxes}</div>
    </div>
    <div class="form-group">
      <label class="check-row"><input type="checkbox" id="cronEnabled" ${(!task || task.enabled) ? 'checked' : ''}> 启用</label>
    </div>
  `;
  ov.classList.add('show');
  $('cronSaveBtn').onclick = async () => {
    const hours = Array.from(document.querySelectorAll('#cronHours input:checked')).map((el: any) => Number(el.value));
    const payload = {
      name: ($('cronName') as HTMLInputElement).value.trim() || '未命名任务',
      action: ($('cronAction') as HTMLSelectElement).value,
      hours,
      enabled: ($('cronEnabled') as HTMLInputElement).checked,
    };
    try {
      if (task) {
        await api('/api/cron-tasks/' + task.id, { method: 'PUT', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      } else {
        await api('/api/cron-tasks', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      }
      toast('已保存', 'success');
      (window as any).closeCronModal();
      loadCronTasks();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    }
  };
};

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };
