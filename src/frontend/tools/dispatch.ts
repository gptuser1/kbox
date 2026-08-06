// 工具：GitHub Actions 触发
// 独立模块，由 shell 在点击时动态 import('/js/tools/dispatch.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api, formatDate } from '../shared.js';

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
    if (!run) { runCard.innerHTML = '<div class="empty">暂无执行记录</div>'; return; }
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
  }

  async function fetchRuns() {
    if (!pollOwner || !pollRepo || !pollWf) return;
    try {
      const data = await api('/api/tools/workflow-runs?owner=' + encodeURIComponent(pollOwner) + '&repo=' + encodeURIComponent(pollRepo) + '&workflow_id=' + encodeURIComponent(pollWf) + '&per_page=5');
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
      const data = await api('/api/tools/dispatch-configs');
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
      await api('/api/tools/dispatch-configs/' + encodeURIComponent(c.id), { method: 'DELETE' });
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
        api('/api/tools/workflows?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/tools/branches?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName)),
        api('/api/tools/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(defaultBranch)),
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
        api('/api/tools/branch-commit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repoName) + '&branch=' + encodeURIComponent(selectedBranch))
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
          api('/api/tools/workflow-inputs?owner=' + encodeURIComponent(owner2) + '&repo=' + encodeURIComponent(repoName2) + '&path=' + encodeURIComponent(selectedWfPath))
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
      const data = await api('/api/tools/dispatch', {
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
      await api('/api/tools/dispatch-configs', {
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
