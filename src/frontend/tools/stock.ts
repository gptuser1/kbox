// 工具：基金估值
// 独立模块，由 shell 在点击时动态 import('/js/tools/stock.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api } from '../shared.js';

export function render(): string {
  return `
<div class="tool-title-row">
  <h2>💰 基金估值</h2>
  <div class="ttr-stats" id="stockStats"><span class="ttr-refresh">上次刷新: <span id="stockLastTime">-</span></span></div>
</div>

<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-primary" id="stockRefreshBtn">🔄 刷新全部估值</button>
  <button class="btn btn-outline" id="stockAddBtn">➕ 添加基金</button>
</div>

<div class="result-box" id="stockResult"></div>

<div class="section-title">基金列表</div>
<div class="file-list" id="stockList">
  <div class="empty">加载中…</div>
</div>

<!-- 添加/编辑基金弹层 -->
<div class="modal-overlay" id="stockModalOverlay">
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3 id="stockModalTitle">添加基金</h3>
          <button class="btn btn-outline btn-sm" id="stockGotoImportBtn" style="margin-right:auto;display:none">📥 自动导入</button>
          <button class="modal-close" onclick="closeStockModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>基金名称</label>
            <input id="stockFundName" placeholder="如：华夏沪深300ETF">
          </div>
          <div class="form-group">
            <label>基金代码（可选）</label>
            <input id="stockFundCode" placeholder="如：510300">
          </div>
          <div class="form-group">
            <label>持仓明细 <button type="button" class="btn btn-outline btn-sm" onclick="addStockHolding()" style="margin-left:8px">+ 添加持仓</button></label>
            <div id="stockHoldingsList"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="stockModalExportBtn" style="display:none;margin-right:auto">导出</button>
          <button class="btn btn-outline" style="color:var(--danger);display:none" id="stockModalDeleteBtn">删除</button>
          <button class="btn btn-outline" onclick="closeStockModal()">取消</button>
          <button class="btn btn-primary" id="stockModalSave">保存</button>
        </div>
      </div>
    </div>

<!-- 自动导入弹层 -->
<div class="modal-overlay" id="stockImportOverlay">
  <div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3>📥 自动导入基金</h3>
      <button class="modal-close" onclick="closeStockImport()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>JSON 数据 <span style="font-weight:400;color:var(--text-muted)">（最外层为数组，支持一次导入多个基金）</span></label>
        <textarea id="stockImportText" class="code-input" placeholder='粘贴 JSON 列表，例如：&#10;[&#10;  { "fund_name": "华夏沪深300ETF", "fund_code": "510300", "holdings": [{"name":"贵州茅台","code":"600519","market":"A","weight":5.23}] }&#10;]' spellcheck="false" style="width:100%;min-height:160px;font-family:var(--font-mono,monospace);font-size:12px;resize:vertical"></textarea>
      </div>
      <div class="form-group">
        <label>模板示例 <span style="font-weight:400;color:var(--text-muted)">（点击下方按钮填入输入框）</span></label>
        <button class="btn btn-outline btn-sm" id="stockFillTemplateBtn">填入模板</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeStockImport()">取消</button>
      <button class="btn btn-primary" id="stockImportSubmit">导入</button>
    </div>
  </div>
</div>
`;
}

export function mount(): void {
  const list = $('stockList');
  const refreshBtn = $('stockRefreshBtn') as HTMLButtonElement;
  const addBtn = $('stockAddBtn') as HTMLButtonElement;
  const gotoImportBtn = $('stockGotoImportBtn') as HTMLButtonElement;
  const resultBox = $('stockResult');
  const modalOverlay = $('stockModalOverlay');
  const modalSave = $('stockModalSave') as HTMLButtonElement;
  const modalDeleteBtn = $('stockModalDeleteBtn') as HTMLButtonElement;
  const modalExportBtn = $('stockModalExportBtn') as HTMLButtonElement;
  const holdingsList = $('stockHoldingsList');
  const importOverlay = $('stockImportOverlay');
  const importText = $('stockImportText') as HTMLTextAreaElement;
  const importSubmit = $('stockImportSubmit') as HTMLButtonElement;
  let editingId: string | null = null;
  let fundsCache: any[] = [];

  const MARKET_LABELS: any = { A: '内地', HK: '香港', US: '美国', KR: '韩国', TW: '台湾', JP: '日本' };

  const IMPORT_TEMPLATE = [
    {
      fund_name: "华夏沪深300ETF",
      fund_code: "510300",
      holdings: [
        { name: "贵州茅台", code: "600519", market: "A", weight: 5.23 },
        { name: "腾讯控股", code: "700", market: "HK", weight: 8.10 },
        { name: "苹果", code: "AAPL", market: "US", weight: 4.50 }
      ]
    }
  ];

  async function loadFunds() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/stock/funds');
      fundsCache = data.results || [];
      $('stockLastTime').textContent = fundsCache[0]?.estimated_time || '-';
      if (!fundsCache.length) {
        list.innerHTML = '<div class="empty">暂无基金，点击「添加基金」开始</div>';
        return;
      }
      list.innerHTML = fundsCache.map((f: any) => {
        const chg = f.estimated_change;
        const chgClass = chg > 0.01 ? 'change-up' : chg < -0.01 ? 'change-down' : 'change-flat';
        const chgText = chg == null || chg === 0 ? '—' : ((chg > 0 ? '+' : '') + Number(chg).toFixed(2) + '%');
        let holdCount = 0;
        try { holdCount = JSON.parse(f.holdings || '[]').length; } catch {}
        return '<div class="file-item" onclick="openStockDetail(\'' + f.id + '\')">' +
          '<div class="file-icon">📊</div>' +
          '<div class="file-info"><div class="file-name">' + esc(f.fund_name) + (f.fund_code ? ' <span style="color:var(--text-muted);font-weight:400;font-size:12px">' + esc(f.fund_code) + '</span>' : '') + '</div>' +
          '<div class="file-meta">' + holdCount + ' 只持仓</div></div>' +
          '<div class="file-actions"><span class="num ' + chgClass + '" style="font-weight:600;font-size:14px">' + chgText + '</span>' +
          '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editStockFund(\'' + f.id + '\')">编辑</button></div>' +
          '</div>';
      }).join('');
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function addStockHolding(name?: string, code?: string, market?: string, weight?: any) {
    const div = document.createElement('div');
    div.className = 'form-inline';
    div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
    div.innerHTML =
      '<input class="h-name" placeholder="名称" value="' + esc(name||'') + '" style="flex:1">' +
      '<input class="h-code" placeholder="代码" value="' + esc(code||'') + '" style="width:90px" spellcheck="false">' +
      '<select class="h-market" style="width:80px">' +
        '<option value="A"' + (market==='A'?' selected':'') + '>内地</option>' +
        '<option value="HK"' + (market==='HK'?' selected':'') + '>香港</option>' +
        '<option value="US"' + (market==='US'?' selected':'') + '>美国</option>' +
        '<option value="KR"' + (market==='KR'?' selected':'') + '>韩国</option>' +
        '<option value="TW"' + (market==='TW'?' selected':'') + '>台湾</option>' +
        '<option value="JP"' + (market==='JP'?' selected':'') + '>日本</option>' +
      '</select>' +
      '<input class="h-weight" type="number" placeholder="%" value="' + (weight||'') + '" step="0.01" style="width:70px">' +
      '<button class="btn btn-outline btn-sm" onclick="this.parentElement.remove()">✕</button>';
    holdingsList.appendChild(div);
  }

  (window as any).addStockHolding = addStockHolding;

  function openStockModal(isEdit: boolean) {
    $('stockModalTitle').textContent = isEdit ? '编辑基金' : '添加基金';
    modalDeleteBtn.style.display = isEdit ? '' : 'none';
    modalExportBtn.style.display = isEdit ? '' : 'none';
    gotoImportBtn.style.display = isEdit ? 'none' : '';
    modalOverlay.classList.add('show');
  }
  function closeStockModal() {
    modalOverlay.classList.remove('show');
    editingId = null;
  }
  (window as any).openStockModal = openStockModal;
  (window as any).closeStockModal = closeStockModal;
  modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeStockModal(); };

  modalDeleteBtn.onclick = () => {
    if (!editingId) return;
    (window as any).showConfirm('确定删除此基金？', async () => {
      try {
        await api('/api/tools/stock/funds/' + editingId, { method: 'DELETE' });
        toast('已删除', 'success');
        closeStockModal();
        loadFunds();
      } catch (e: any) {
        if (e.message === 'UNAUTHORIZED') return;
        toast('删除失败：' + e.message, 'error');
      }
    });
  };

  modalExportBtn.onclick = () => {
    const name = ($('stockFundName') as HTMLInputElement).value.trim();
    const code = ($('stockFundCode') as HTMLInputElement).value.trim();
    const rows = holdingsList.querySelectorAll('.form-inline');
    const holdings: any[] = [];
    rows.forEach((row: any) => {
      const n = row.querySelector('.h-name').value.trim();
      const c = row.querySelector('.h-code').value.trim();
      const m = row.querySelector('.h-market').value;
      const w = parseFloat(row.querySelector('.h-weight').value) || 0;
      if (!n && !c) return;
      holdings.push({ name: n, code: c, market: m, weight: w });
    });
    const json = JSON.stringify({ fund_name: name, fund_code: code, holdings }, null, 2);
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    toast(ok ? 'JSON 已复制到剪贴板' : '复制失败，请手动复制', ok ? 'success' : 'error');
  };

  (window as any).editStockFund = function(id: string) {
    const f = fundsCache.find(x => x.id === id);
    if (!f) return;
    editingId = id;
    ($('stockFundName') as HTMLInputElement).value = f.fund_name || '';
    ($('stockFundCode') as HTMLInputElement).value = f.fund_code || '';
    holdingsList.innerHTML = '';
    let holdings: any[] = [];
    try { holdings = JSON.parse(f.holdings || '[]'); } catch {}
    if (!holdings.length) addStockHolding();
    else holdings.forEach((h: any) => addStockHolding(h.name, h.code, h.market, h.weight));
    openStockModal(true);
  };

  (window as any).openStockDetail = function(id: string) {
    const f = fundsCache.find(x => x.id === id);
    if (!f) return;
    let details: any[] = [];
    try { details = JSON.parse(f.holdings_detail || '[]'); } catch {}
    if (!details.length) {
      toast('暂无估值详情，请先点击「刷新全部估值」', 'info');
      return;
    }
    let html = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-muted)">' + esc(f.fund_name) + ' · ' + (f.estimated_time ? esc(f.estimated_time) : '') + '</div>';
    html += '<table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:4px">持仓</th><th>市场</th><th class="num">权重</th><th class="num">涨跌</th><th class="num">贡献</th><th>状态</th></tr></thead><tbody>';
    for (const d of details) {
      const cp = d.changePct;
      const chgClass = cp == null ? 'change-flat' : cp > 0.01 ? 'change-up' : cp < -0.01 ? 'change-down' : 'change-flat';
      const chgText = cp == null ? '—' : ((cp > 0 ? '+' : '') + Number(cp).toFixed(2) + '%');
      const contribText = d.contribution == null ? '—' : ((d.contribution > 0 ? '+' : '') + Number(d.contribution).toFixed(2) + '%');
      html += '<tr style="border-top:1px solid var(--border)"><td style="padding:4px">' + esc(d.name) + '<div style="color:var(--text-muted);font-size:11px">' + esc(d.code) + '</div></td>' +
        '<td style="text-align:center">' + esc(MARKET_LABELS[d.market] || d.market) + '</td>' +
        '<td class="num" style="text-align:right">' + (d.weight||0) + '%</td>' +
        '<td class="num ' + chgClass + '" style="text-align:right">' + chgText + '</td>' +
        '<td class="num ' + chgClass + '" style="text-align:right">' + contribText + '</td>' +
        '<td style="text-align:center;font-size:11px">' + esc(d.statusLabel || '—') + '</td></tr>';
    }
    html += '</tbody></table>';
    const detailOverlay = document.createElement('div');
    detailOverlay.className = 'modal-overlay show';
    detailOverlay.innerHTML = '<div class="modal" style="max-width:560px"><div class="modal-header"><h3>估值详情</h3><button class="modal-close">✕</button></div><div class="modal-body">' + html + '</div></div>';
    detailOverlay.onclick = (e) => { if (e.target === detailOverlay || (e.target as HTMLElement).className === 'modal-close') detailOverlay.remove(); };
    document.body.appendChild(detailOverlay);
  };

  addBtn.onclick = () => {
    editingId = null;
    ($('stockFundName') as HTMLInputElement).value = '';
    ($('stockFundCode') as HTMLInputElement).value = '';
    holdingsList.innerHTML = '';
    addStockHolding();
    openStockModal(false);
  };

  modalSave.onclick = async () => {
    const name = ($('stockFundName') as HTMLInputElement).value.trim();
    if (!name) { toast('请输入基金名称', 'error'); return; }
    const code = ($('stockFundCode') as HTMLInputElement).value.trim();
    const rows = holdingsList.querySelectorAll('.form-inline');
    const holdings: any[] = [];
    rows.forEach((row: any) => {
      const n = row.querySelector('.h-name').value.trim();
      const c = row.querySelector('.h-code').value.trim();
      const m = row.querySelector('.h-market').value;
      const w = parseFloat(row.querySelector('.h-weight').value) || 0;
      if (!n && !c) return;
      if (!n) { toast('请填写持仓名称', 'error'); return; }
      if (!c) { toast('请填写持仓代码', 'error'); return; }
      holdings.push({ name: n, code: c, market: m, weight: w });
    });
    if (!holdings.length) { toast('请至少添加一条持仓明细', 'error'); return; }
    const body = { fund_name: name, fund_code: code, holdings: JSON.stringify(holdings) };
    modalSave.disabled = true; modalSave.textContent = '保存中…';
    try {
      if (editingId) {
        await api('/api/tools/stock/funds/' + editingId, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
        toast('已更新', 'success');
      } else {
        await api('/api/tools/stock/funds', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
        toast('已添加', 'success');
      }
      closeStockModal();
      loadFunds();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('保存失败：' + e.message, 'error');
    } finally {
      modalSave.disabled = false; modalSave.textContent = '保存';
    }
  };

  refreshBtn.onclick = async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = '🔄 刷新中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在抓取行情并计算估值…';
    try {
      const data = await api('/api/tools/stock/refresh', { method: 'POST' });
      const s = data.stats || {};
      resultBox.className = 'result-box show success';
      resultBox.textContent = '✓ 已刷新 ' + (s.updated_funds || 0) + '/' + (s.total_funds || 0) + ' 只基金估值';
      toast('估值已刷新', 'success');
      loadFunds();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('刷新失败', 'error');
    } finally {
      refreshBtn.disabled = false; refreshBtn.textContent = '🔄 刷新全部估值';
    }
  };

  // ─── 自动导入 ───
  function closeStockImport() {
    importOverlay.classList.remove('show');
  }
  (window as any).closeStockImport = closeStockImport;
  importOverlay.onclick = (e) => { if (e.target === importOverlay) closeStockImport(); };

  gotoImportBtn.onclick = () => {
    closeStockModal();
    importText.value = '';
    importOverlay.classList.add('show');
  };

  $('stockFillTemplateBtn').onclick = () => {
    importText.value = JSON.stringify(IMPORT_TEMPLATE, null, 2);
  };

  importSubmit.onclick = async () => {
    const raw = importText.value.trim();
    if (!raw) { toast('请输入 JSON 数据', 'error'); return; }
    let data: any;
    try { data = JSON.parse(raw); }
    catch (e: any) { toast('JSON 格式错误：' + e.message, 'error'); return; }
    if (!Array.isArray(data)) { toast('最外层必须是数组', 'error'); return; }

    importSubmit.disabled = true; importSubmit.textContent = '导入中…';
    try {
      const result = await api('/api/tools/stock/funds/batch', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = result.success || 0, fail = result.failed || 0;
      if (fail === 0) {
        toast('成功导入 ' + ok + ' 只基金', 'success');
      } else if (ok > 0) {
        toast('导入完成：成功 ' + ok + '，失败 ' + fail, 'info');
      } else {
        toast('导入失败：' + (result.errors?.[0]?.error || '未知错误'), 'error');
      }
      closeStockImport();
      loadFunds();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('导入失败：' + e.message, 'error');
    } finally {
      importSubmit.disabled = false; importSubmit.textContent = '导入';
    }
  };

  loadFunds();
}
