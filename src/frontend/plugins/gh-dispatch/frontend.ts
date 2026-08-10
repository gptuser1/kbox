// 工具：GitHub Actions 触发
// 独立模块，由 shell 在点击时动态 import('/js/plugins/dispatch.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api, formatDate } from '../../shared.js';
import type { FrontendPlugin } from '../../shared.js';

export function render(): string {
  return `
    <h2>⚡ GitHub Actions 触发</h2>
    <div class="saved-configs" id="dispatchSavedConfigs"></div>
    <div class="form-row">
      <div class="form-group">
        <label>仓库</label>
        <input type="text" id="dispatchRepo" placeholder="user/repo 或粘贴 GitHub 链接">
      </div>
      <button class="btn btn-outline" id="dispatchLoadBtn" style="margin-bottom:0">加载</button>
    </div>
    <div class="form-group" id="dispatchBranchGroup" style="display:none">
      <label>分支</label>
      <select id="dispatchBranch"></select>
      <div id="dispatchCommitInfo" style="font-size:12px;color:var(--text-muted);margin-top:6px"></div>
    </div>
    <div class="section-title" id="dispatchWfTitle" style="display:none">选择工作流</div>
    <div class="wf-list" id="dispatchWfList"></div>
    <div id="dispatchInputsSection" style="display:none">
      <div class="section-title" id="dispatchInputsTitle">输入参数</div>
      <div id="dispatchInputs"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="dispatchTriggerBtn" disabled>触发</button>
      <button class="btn btn-outline" id="dispatchSaveBtn">保存配置</button>
    </div>
    <div class="result-box" id="dispatchResult"></div>
    <div id="dispatchRunSection" style="display:none;margin-top:16px">
      <div class="section-title">执行状态</div>
      <div id="dispatchRunCard"></div>
      <div id="dispatchLogBtnRow" style="display:none;margin-top:8px">
        <button class="btn btn-outline btn-sm" id="dispatchLogBtn">📋 查看日志</button>
      </div>
    </div>
    <div id="dispatchLogSection" style="display:none;margin-top:12px">
      <div class="section-title">Job 日志</div>
      <div id="dispatchJobsList"></div>
      <div id="dispatchLogContent" style="display:none">
        <div class="section-title" id="dispatchLogJobTitle"></div>
        <pre class="wf-log-box" id="dispatchLogText"></pre>
      </div>
    </div>
  `;
}

// 解析仓库输入：支持 owner/repo、GitHub URL、SSH、.git 后缀
function parseRepo(input: string): string | null {
  input = (input || '').trim();
  if (!input) return null;
  const m = input.match(/github\.com[:/]([^/\s]+)\/([^/\s.#]+)(?:\.git)?/i);
  if (m) return m[1] + '/' + m[2];
  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return input;
  return null;
}

// ─── GitHub Actions 日志格式化 ───
// 解析 ANSI 颜色码、##[group]/##[error] 等命令标记、时间戳前缀，输出带样式的 HTML。

// ANSI 前景色码 → CSS color（GitHub Actions 常用色）
const ANSI_COLORS: Record<string, string> = {
  '30': '#6b7280', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
  '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#e5e7eb',
  '90': '#9ca3af', '91': '#f87171', '92': '#4ade80', '93': '#facc15',
  '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#f3f4f6',
};

// 渲染带 ANSI 颜色码的文本为 HTML（已 HTML 转义，span 包裹带色段）
function renderAnsi(text: string): string {
  const regex = /\u001b\[([\d;]*)m/g;
  const out: string[] = [];
  let last = 0;
  let color = '';
  let bold = false;
  const flush = (end: number) => {
    if (end <= last) return;
    const seg = esc(text.slice(last, end));
    if (!seg) return;
    const styles: string[] = [];
    if (color) styles.push('color:' + color);
    if (bold) styles.push('font-weight:600');
    out.push(styles.length ? '<span style="' + styles.join(';') + '">' + seg + '</span>' : seg);
  };
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    flush(m.index);
    const codes = m[1] === '' ? ['0'] : m[1].split(';');
    for (const c of codes) {
      if (c === '0') { color = ''; bold = false; }
      else if (ANSI_COLORS[c]) color = ANSI_COLORS[c];
      else if (c === '1') bold = true;
    }
    last = regex.lastIndex;
  }
  flush(text.length);
  return out.join('');
}

// 格式化整段 job 日志为 HTML：高亮 error/warning、时间戳淡显、解析 ANSI
function formatJobLog(raw: string): string {
  if (!raw) return '<div class="log-empty">（空日志）</div>';
  const lines = raw.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    // \r 用于进度条覆盖，取最后一次状态
    const crParts = line.split('\r');
    const content = crParts[crParts.length - 1];
    // 时间戳前缀：2026-08-09T04:19:50.3761360Z
    let ts = '';
    let body = content;
    const tsMatch = body.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s(.*)$/);
    if (tsMatch) {
      ts = '<span class="log-ts">' + esc(tsMatch[1]) + '</span> ';
      body = tsMatch[2];
    }
    // GitHub Actions 命令标记 ##[group]/##[endgroup]/##[error]/##[warning]/##[notice]/##[section]
    const cmdMatch = body.match(/^##\[(\w+)\](.*)$/);
    if (cmdMatch) {
      const cmd = cmdMatch[1].toLowerCase();
      const arg = cmdMatch[2];
      if (cmd === 'group' || cmd === 'section') {
        out.push('<div class="log-cmd log-cmd-section">' + ts + '<span class="log-cmd-icon">▸</span>' + renderAnsi(arg) + '</div>');
        continue;
      }
      if (cmd === 'endgroup') { continue; }
      const icons: Record<string, string> = { error: '✖', warning: '⚠', notice: 'ℹ' };
      const icon = icons[cmd] || '•';
      out.push('<div class="log-cmd log-cmd-' + esc(cmd) + '">' + ts + '<span class="log-cmd-icon">' + icon + '</span>' + renderAnsi(arg) + '</div>');
      continue;
    }
    out.push('<div class="log-line">' + ts + renderAnsi(body) + '</div>');
  }
  return out.join('');
}

export function mount(): void {
  const repoInput = $('dispatchRepo') as HTMLInputElement;
  const loadBtn = $('dispatchLoadBtn') as HTMLButtonElement;
  const wfList = $('dispatchWfList');
  const wfTitle = $('dispatchWfTitle');
  const branchGroup = $('dispatchBranchGroup');
  const branchSelect = $('dispatchBranch') as HTMLSelectElement;
  const inputsSection = $('dispatchInputsSection');
  const inputsTitle = $('dispatchInputsTitle');
  const inputsBox = $('dispatchInputs');
  const triggerBtn = $('dispatchTriggerBtn') as HTMLButtonElement;
  const saveBtn = $('dispatchSaveBtn') as HTMLButtonElement;
  const resultBox = $('dispatchResult');
  const savedConfigsBox = $('dispatchSavedConfigs');
  const runSection = $('dispatchRunSection');
  const runCard = $('dispatchRunCard');
  const logBtnRow = $('dispatchLogBtnRow');
  const logBtn = $('dispatchLogBtn') as HTMLButtonElement;
  const logSection = $('dispatchLogSection');
  const jobsList = $('dispatchJobsList');
  const logContent = $('dispatchLogContent');
  const logJobTitle = $('dispatchLogJobTitle');
  const logText = $('dispatchLogText');

  let selectedWf: string | null = null;
  let selectedWfPath: string | null = null;
  let wfInputs: any[] = [];

  // 执行状态轮询
  let runPollTimer: any = null;
  let trackingLive = false;    // true=正在跟踪一次新触发的实时执行；false=仅查看上次
  let lastRunId: any = null;   // 实时跟踪目标的 run id
  let pollOwner = '';
  let pollRepo = '';
  let pollWf = '';

  // 日志查看状态
  let currentRun: any = null;

  function runStatusText(status: string, conclusion: string): string {
    if (status === 'queued') return '⏳ 排队中';
    if (status === 'in_progress') return '🔄 运行中';
    if (status === 'completed') {
      if (conclusion === 'success') return '✅ 成功';
      if (conclusion === 'failure') return '❌ 失败';
      if (conclusion === 'cancelled') return '⚠️ 已取消';
      if (conclusion === 'skipped') return '⏭️ 已跳过';
      return '📦 ' + (conclusion || '完成');
    }
    return '未知';
  }
  function runStatusColor(status: string, conclusion: string): string {
    if (status === 'queued') return 'var(--text-muted)';
    if (status === 'in_progress') return 'var(--primary)';
    if (status === 'completed') {
      if (conclusion === 'success') return 'var(--success)';
      return 'var(--danger)';
    }
    return 'var(--text-secondary)';
  }

  function renderRunCard(run: any, isLive: boolean) {
    if (!run) { runCard.innerHTML = '<div class="empty">暂无执行记录</div>'; logBtnRow.style.display = 'none'; logSection.style.display = 'none'; return; }
    currentRun = run;
    const tag = isLive ? '<span style="font-size:11px;color:var(--primary);margin-left:6px">实时</span>' : '<span style="font-size:11px;color:var(--text-muted);margin-left:6px">上次</span>';
    const color = runStatusColor(run.status, run.conclusion);
    const created = run.created_at ? formatDate(run.created_at.replace('T', ' ').replace('Z', '')) : '';
    const branch = run.head_branch ? ' · ' + esc(run.head_branch) : '';
    const url = run.html_url ? '<a href="' + esc(run.html_url) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--primary);text-decoration:none;margin-left:6px">查看 ↗</a>' : '';
    runCard.innerHTML =
      '<div class="file-item" style="display:block;padding:14px 16px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="font-weight:600;font-size:14px">' + esc(run.name || pollWf) + tag + '</div>' +
          '<div style="font-size:13px;font-weight:600;color:' + color + '">' + runStatusText(run.status, run.conclusion) + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:6px">#' + run.id + branch + ' · ' + created + url + '</div>' +
      '</div>';
    // 已完成 run 显示日志按钮
    if (run.status === 'completed' && run.id) {
      logBtnRow.style.display = '';
    } else {
      logBtnRow.style.display = 'none';
      logSection.style.display = 'none';
    }
  }

  async function fetchRuns() {
    if (!pollOwner || !pollRepo || !pollWf) return;
    try {
      const data = await api('/api/plugins/workflow-runs?owner=' + encodeURIComponent(pollOwner) + '&repo=' + encodeURIComponent(pollRepo) + '&workflow_id=' + encodeURIComponent(pollWf) + '&per_page=5');
      const runs = data.runs || [];
      runSection.style.display = '';
      if (!runs.length) { renderRunCard(null, false); stopPoll(); return; }

      let target: any = null;
      if (trackingLive && lastRunId) target = runs.find((r: any) => String(r.id) === String(lastRunId));
      if (!target) target = runs[0];
      if (trackingLive) lastRunId = target.id;

      renderRunCard(target, trackingLive);

      if (trackingLive && (target.status === 'queued' || target.status === 'in_progress')) {
        startPoll();
      } else {
        stopPoll();
      }
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      runSection.style.display = '';
      runCard.innerHTML = '<div class="empty">获取状态失败：' + esc(e.message) + '</div>';
    }
  }

  function startPoll() {
    stopPoll();
    runPollTimer = setInterval(fetchRuns, 3000);
  }
  function stopPoll() {
    if (runPollTimer) { clearInterval(runPollTimer); runPollTimer = null; }
  }

  // ─── 日志查看 ───
  async function fetchJobs() {
    if (!currentRun || !pollOwner || !pollRepo) return;
    logSection.style.display = '';
    jobsList.innerHTML = '<div class="empty">加载 jobs 中…</div>';
    logContent.style.display = 'none';
    try {
      const data = await api('/api/plugins/workflow-run-jobs?owner=' + encodeURIComponent(pollOwner) + '&repo=' + encodeURIComponent(pollRepo) + '&run_id=' + currentRun.id);
      const jobs = data.jobs || [];
      if (!jobs.length) {
        jobsList.innerHTML = '<div class="empty">该 run 无 job 记录</div>';
        return;
      }
      let html = '';
      for (const j of jobs) {
        const statusColor = j.conclusion === 'success' ? 'var(--success)' : j.conclusion === 'failure' ? 'var(--danger)' : j.status === 'in_progress' ? 'var(--primary)' : 'var(--text-muted)';
        const statusIcon = j.conclusion === 'success' ? '✅' : j.conclusion === 'failure' ? '❌' : j.status === 'in_progress' ? '🔄' : '⏳';
        html += '<div class="wf-log-job" data-job-id="' + j.id + '" data-job-name="' + esc(j.name) + '">' +
          '<span class="wf-log-job-icon">' + statusIcon + '</span>' +
          '<span class="wf-log-job-name">' + esc(j.name) + '</span>' +
          '<span class="wf-log-job-status" style="color:' + statusColor + '">' + esc(j.conclusion || j.status) + '</span>' +
          '<span class="wf-log-job-arrow">▸</span>' +
        '</div>';
      }
      jobsList.innerHTML = html;
      // 点击 job 加载日志
      jobsList.querySelectorAll('.wf-log-job').forEach((el: any) => {
        el.onclick = () => {
          const jobId = el.getAttribute('data-job-id');
          const jobName = el.getAttribute('data-job-name');
          if (jobId) fetchJobLog(jobId, jobName);
          // 高亮当前
          jobsList.querySelectorAll('.wf-log-job').forEach((x: any) => x.classList.remove('active'));
          el.classList.add('active');
        };
      });
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      jobsList.innerHTML = '<div class="empty">加载 jobs 失败：' + esc(e.message) + '</div>';
    }
  }

  async function fetchJobLog(jobId: string, jobName: string) {
    logContent.style.display = '';
    logJobTitle.textContent = '日志 — ' + esc(jobName);
    logText.textContent = '加载中…';
    try {
      const data = await api('/api/plugins/workflow-run-logs?owner=' + encodeURIComponent(pollOwner) + '&repo=' + encodeURIComponent(pollRepo) + '&job_id=' + encodeURIComponent(jobId));
      logText.innerHTML = formatJobLog(data.log);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      logText.textContent = '加载日志失败：' + (e.message || '未知错误');
    }
  }

  logBtn.onclick = () => {
    if (logSection.style.display !== 'none') {
      // 已展开则折叠
      logSection.style.display = 'none';
      logBtn.textContent = '📋 查看日志';
    } else {
      logSection.style.display = '';
      logBtn.textContent = '📋 隐藏日志';
      fetchJobs();
    }
  };

  // 渲染分支最新 commit 信息
  const commitInfoEl = $('dispatchCommitInfo');
  function renderCommitInfo(commit: any) {
    if (!commit || !commit.sha) {
      commitInfoEl.textContent = '';
      return;
    }
    const sha = commit.sha.substring(0, 7);
    const date = commit.date ? formatDate(commit.date.replace('T', ' ').replace('Z', '')) : '';
    commitInfoEl.innerHTML =
      '<span style="opacity:0.7">最新</span> ' +
      esc(commit.message) + ' · ' +
      '<a href="' + esc(commit.url) + '" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">' + sha + '</a>' +
      (date ? ' · ' + date : '') +
      (commit.author ? ' · ' + esc(commit.author) : '');
  }

  // 从数据库加载已保存配置
  let savedConfigs: any[] = [];

  async function renderSavedConfigs() {
    try {
      const data = await api('/api/plugins/dispatch-configs');
      savedConfigs = data.configs || [];
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      savedConfigsBox.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">配置加载失败</span>';
      return;
    }
    if (!savedConfigs.length) { savedConfigsBox.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < savedConfigs.length; i++) {
      const c = savedConfigs[i];
      html += '<span class="saved-config" onclick="loadDispatchConfig(' + i + ')">' + esc(c.repo) + ' / ' + esc(c.workflow_id) + '<span class="del" onclick="delDispatchConfig(event,' + i + ')">✕</span></span>';
    }
    savedConfigsBox.innerHTML = html;
  }

  (window as any).loadDispatchConfig = function(i: number) {
    const c = savedConfigs[i];
    if (!c) return;
    repoInput.value = c.repo || '';
    loadBtn.click();
    setTimeout(() => {
      selectedWf = c.workflow_id;
      const items = wfList.querySelectorAll('.wf-item');
      items.forEach((item: any) => {
        if (item.dataset.wf === c.workflow_id) { item.classList.add('selected'); }
        else { item.classList.remove('selected'); }
      });
      triggerBtn.disabled = !selectedWf;
      if (selectedWf) {
        const selectedItem = wfList.querySelector('.wf-item.selected') as HTMLElement | null;
        if (selectedItem) selectedItem.click();
      }
      if (c.branch) {
        setTimeout(() => { branchSelect.value = c.branch; }, 800);
      }
    }, 1500);
  };

  (window as any).delDispatchConfig = async function(e: Event, i: number) {
    e.stopPropagation();
    const c = savedConfigs[i];
    if (!c || !c.id) return;
    try {
      await api('/api/plugins/dispatch-configs/' + encodeURIComponent(c.id), { method: 'DELETE' });
      toast('已删除', 'success');
      renderSavedConfigs();
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + err.message, 'error');
    }
  };

  loadBtn.onclick = async () => {
    const raw = repoInput.value.trim();
    const repo = parseRepo(raw);
    if (!repo) { toast('无法识别仓库，请输入 owner/repo 或 GitHub 链接', 'error'); repoInput.focus(); return; }
    if (raw !== repo) repoInput.value = repo;

    const [owner, repoName] = repo.split('/');
    loadBtn.disabled = true; loadBtn.textContent = '加载中…';
    wfList.innerHTML = '<div class="empty">加载中…</div>';
    wfTitle.style.display = '';
    inputsSection.style.display = 'none';
    branchGroup.style.display = 'none';
    selectedWf = null;
    triggerBtn.disabled = true;
    stopPoll();
    trackingLive = false;
    lastRunId = null;
    pollOwner = '';
    pollRepo = '';
    pollWf = '';
    runSection.style.display = 'none';

    try {
      const defaultBranch = 'main';
      const [wfData, branchData, commitData] = await Promise.all([
        api('/api/plugins/workflows?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/plugins/branches?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/plugins/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(defaultBranch)),
      ]);

      const branches = branchData.branches || [];
      if (branches.length) {
        branchGroup.style.display = '';
        branchSelect.innerHTML = branches.map((b: any) =>
          '<option value="' + esc(b.name) + '"' + (b.name === 'main' ? ' selected' : '') + '>' + esc(b.name) + '</option>'
        ).join('');
      }

      renderCommitInfo(commitData.commit);

      branchSelect.onchange = () => {
        const selectedBranch = branchSelect.value;
        api('/api/plugins/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(selectedBranch))
          .then((d: any) => renderCommitInfo(d.commit))
          .catch(() => {});
      };

      if (!wfData.workflows || !wfData.workflows.length) {
        wfList.innerHTML = '<div class="empty">该仓库没有 workflows</div>';
        return;
      }
      let html = '';
      for (const w of wfData.workflows) {
        html += '<div class="wf-item" data-wf="' + esc(w.filename) + '" data-path="' + esc(w.path) + '"><div class="wf-info"><div class="wf-name">' + esc(w.name) + '</div><div class="wf-path">' + esc(w.path) + '</div></div><span class="wf-state ' + (w.state === 'active' ? 'active' : '') + '">' + esc(w.state) + '</span></div>';
      }
      wfList.innerHTML = html;
      wfList.querySelectorAll('.wf-item').forEach((item: any) => {
        item.onclick = () => {
          wfList.querySelectorAll('.wf-item').forEach((i: any) => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedWf = item.dataset.wf;
          selectedWfPath = item.dataset.path;
          triggerBtn.disabled = false;

          inputsBox.innerHTML = '<div class="empty">加载参数定义中…</div>';
          inputsTitle.textContent = '输入参数';

          const [owner2, repoName2] = repoInput.value.split('/');
          api('/api/plugins/workflow-inputs?owner=' + encodeURIComponent(owner2) + '&repo=' + encodeURIComponent(repoName2) + '&path=' + encodeURIComponent(selectedWfPath))
            .then((inputData: any) => {
              wfInputs = inputData.inputs || [];
              renderInputs();
            })
            .catch((e: any) => {
              if (e.message === 'UNAUTHORIZED') return;
              inputsBox.innerHTML = '<div class="empty">获取参数失败：' + esc(e.message) + '</div>';
            });

          stopPoll();
          trackingLive = false;
          lastRunId = null;
          pollOwner = owner2;
          pollRepo = repoName2;
          pollWf = selectedWf;
          fetchRuns();
        };
      });
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      wfList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
      toast('加载失败', 'error');
    } finally {
      loadBtn.disabled = false; loadBtn.textContent = '加载';
    }
  };

  function renderInputs() {
    if (!wfInputs.length) {
      inputsSection.style.display = 'none';
      return;
    }
    inputsSection.style.display = '';
    let html = '';
    for (const inp of wfInputs) {
      const reqMark = inp.required ? ' <span class="input-required">*</span>' : '';
      const desc = inp.description ? '<div class="input-desc">' + esc(inp.description) + '</div>' : '';
      const label = esc(inp.name) + reqMark;
      if (inp.type === 'boolean') {
        html += '<div class="form-group"><label>' + label + '</label><select data-input="' + esc(inp.name) + '"><option value="false"' + (inp.default !== 'true' ? ' selected' : '') + '>false</option><option value="true"' + (inp.default === 'true' ? ' selected' : '') + '>true</option></select>' + desc + '</div>';
      } else if (inp.type === 'choice' && inp.options && inp.options.length) {
        html += '<div class="form-group"><label>' + label + '</label><select data-input="' + esc(inp.name) + '">' + inp.options.map((o: string) => '<option value="' + esc(o) + '"' + (o === inp.default ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' + desc + '</div>';
      } else {
        html += '<div class="form-group"><label>' + label + '</label><input type="text" data-input="' + esc(inp.name) + '" value="' + esc(inp.default) + '" placeholder="' + (inp.required ? '必填' : '可选') + '">' + desc + '</div>';
      }
    }
    inputsBox.innerHTML = html;
  }

  triggerBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo || !selectedWf) return;
    const [owner, repoName] = repo.split('/');

    const inputs: any = {};
    if (wfInputs.length) {
      inputsBox.querySelectorAll('[data-input]').forEach((el: any) => {
        const k = el.dataset.input;
        if (k) inputs[k] = el.value;
      });
    }

    triggerBtn.disabled = true; triggerBtn.textContent = '触发中…';
    resultBox.className = 'result-box';
    try {
      const ref = branchSelect.value || 'main';
      const data = await api('/api/plugins/dispatch', {
        method: 'POST',
        body: JSON.stringify({ owner, repo: repoName, workflow_id: selectedWf, ref, inputs }),
        headers: { 'Content-Type': 'application/json' },
      });
      resultBox.className = 'result-box show success';
      resultBox.textContent = '✓ ' + data.message + '（' + selectedWf + ' @ ' + ref + '）';
      toast('已触发，开始跟踪执行状态', 'success');

      stopPoll();
      trackingLive = true;
      lastRunId = null;
      pollOwner = owner;
      pollRepo = repoName;
      pollWf = selectedWf;
      runSection.style.display = '';
      runCard.innerHTML = '<div class="empty">⏳ 等待 GitHub 创建运行记录…</div>';
      setTimeout(() => { fetchRuns(); }, 2000);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('触发失败', 'error');
    } finally {
      triggerBtn.disabled = false; triggerBtn.textContent = '触发';
    }
  };

  saveBtn.onclick = async () => {
    const repo = repoInput.value.trim();
    if (!repo || !selectedWf) { toast('请先选择仓库和工作流', 'error'); return; }
    const inputs: any[] = [];
    if (wfInputs.length) {
      inputsBox.querySelectorAll('[data-input]').forEach((el: any) => {
        const k = el.dataset.input;
        const v = el.value;
        if (k) inputs.push([k, v]);
      });
    }
    try {
      await api('/api/plugins/dispatch-configs', {
        method: 'POST',
        body: JSON.stringify({ repo, workflow_id: selectedWf, branch: branchSelect.value || 'main', inputs }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast('配置已保存', 'success');
      renderSavedConfigs();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    }
  };

  renderSavedConfigs();
}

// 编译期校验：确保本模块符合 FrontendPlugin 接口
const _typeCheck: FrontendPlugin = { render, mount };
