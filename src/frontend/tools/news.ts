// 工具：AI 新闻锐评
// 独立模块，由 shell 在点击时动态 import('/js/tools/news.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api } from '../shared.js';

export function render(): string {
  return `
<h2>📰 AI 新闻锐评</h2>

<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-primary" id="newsTriggerBtn">📡 立即抓取</button>
  <button class="btn btn-outline" id="newsTopBtn">🎯 生成 Top 10</button>
  <button class="btn btn-outline" id="newsReloadBtn">🔄 刷新</button>
  <button class="btn btn-outline" id="newsToggleBtn">📋 查看全部</button>
</div>

<div class="result-box" id="newsResult"></div>

<div class="section-title" id="newsSectionTitle">🔥 Top 10 热门关键词</div>
<div class="file-list" id="newsList">
  <div class="empty">加载中…</div>
</div>
`;
}

export function mount(): void {
  const list = $('newsList');
  const triggerBtn = $('newsTriggerBtn') as HTMLButtonElement;
  const topBtn = $('newsTopBtn') as HTMLButtonElement;
  const reloadBtn = $('newsReloadBtn');
  const toggleBtn = $('newsToggleBtn');
  const sectionTitle = $('newsSectionTitle');
  const resultBox = $('newsResult');

  // 视图模式：'top' = Top10 关键词，'all' = 全部新闻列表
  let viewMode = 'top';

  function renderNewsCard(item) {
    const time = formatNewsTime(item.crawled_at);
    return '<div class="file-item" style="align-items:flex-start;flex-direction:column;gap:4px">' +
      '<div style="display:flex;gap:6px;font-size:11px;color:var(--text-muted);align-items:center;width:100%">' +
        '<span style="color:var(--primary);font-weight:600">' + esc(item.source) + '</span>' +
        '<span style="background:var(--tag-bg);padding:1px 6px;border-radius:3px">' + esc(item.category) + '</span>' +
        '<span style="margin-left:auto">' + esc(time) + '</span>' +
      '</div>' +
      '<a href="' + esc(item.url) + '" target="_blank" rel="noopener" style="color:var(--text);font-weight:500;font-size:14px;text-decoration:none;line-height:1.4">' + esc(item.title) + '</a>' +
      (item.summary ? '<div style="color:var(--text-secondary);font-size:13px;line-height:1.5;margin-top:2px">' + esc(item.summary) + '</div>' : '') +
    '</div>';
  }

  async function loadTop() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/news/top');
      const keywords = data.keywords || [];
      if (!keywords.length) {
        list.innerHTML = '<div class="empty">暂无统计，点击「🎯 生成 Top 10」生成</div>';
        return;
      }
      const generatedAt = data.generated_at ? ' · 生成于 ' + formatNewsTime(data.generated_at) : '';
      list.innerHTML = keywords.map((kw, i) => {
        const rank = i + 1;
        const rankStyle = rank <= 3 ? 'color:#fff;background:var(--primary)' : 'color:var(--text-muted);background:var(--tag-bg)';
        const articlesHtml = (kw.articles || []).map(a => renderNewsCard(a)).join('');
        const heatBadge = (kw.heat_score != null)
          ? '<span style="color:#fff;background:linear-gradient(135deg,#ff6b6b,#ee5a6f);padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600">🔥 ' + kw.heat_score + '</span>'
          : '';
        const catBadge = kw.category
          ? '<span style="color:var(--text-muted);background:var(--tag-bg);padding:1px 8px;border-radius:10px;font-size:11px">' + esc(kw.category) + '</span>'
          : '';
        const countText = kw.count > 0 ? kw.count + ' 条' : '';
        return '<div class="file-item" style="align-items:flex-start;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:8px;align-items:center;width:100%;flex-wrap:wrap">' +
            '<span style="' + rankStyle + ';width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + rank + '</span>' +
            '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(kw.keyword) + '</span>' +
            heatBadge + catBadge +
            '<span style="margin-left:auto;color:var(--text-muted);font-size:12px">' + countText + generatedAt + '</span>' +
          '</div>' +
          '<div style="width:100%;display:flex;flex-direction:column;gap:6px">' + articlesHtml + '</div>' +
        '</div>';
      }).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  async function loadAllNews() {
    list.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/news/list?limit=60');
      const items = data.results || [];
      if (!items.length) {
        list.innerHTML = '<div class="empty">暂无新闻，点击「立即抓取」开始</div>';
        return;
      }
      list.innerHTML = items.map(renderNewsCard).join('');
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      list.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  function loadCurrent() {
    if (viewMode === 'top') loadTop();
    else loadAllNews();
  }

  function setView(mode) {
    viewMode = mode;
    if (mode === 'top') {
      sectionTitle.textContent = '🔥 Top 10 热门关键词';
      toggleBtn.textContent = '📋 查看全部';
    } else {
      sectionTitle.textContent = '最近新闻（全部）';
      toggleBtn.textContent = '🔥 返回 Top 10';
    }
    loadCurrent();
  }

  function formatNewsTime(ts) {
    try {
      if (ts == null || ts === 0 || ts === '0') return '未知';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts || '';
      const pad = (n) => String(n).padStart(2, '0');
      const cst = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      return (cst.getUTCMonth() + 1) + '/' + pad(cst.getUTCDate()) + ' ' + pad(cst.getUTCHours()) + ':' + pad(cst.getUTCMinutes());
    } catch { return ts || ''; }
  }

  triggerBtn.onclick = async () => {
    triggerBtn.disabled = true; triggerBtn.textContent = '📡 抓取中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在抓取新闻并由 AI 写锐评，可能需要 30-60 秒…';
    try {
      const data = await api('/api/tools/news/trigger', { method: 'POST' });
      if (data.success) {
        resultBox.className = 'result-box show success';
        resultBox.textContent = '✓ 抓取完成：新增 ' + data.articles_count + ' 条' + (data.error ? ' · ' + data.error : '');
        toast('抓取完成', 'success');
        loadCurrent();
      } else {
        resultBox.className = 'result-box show error';
        resultBox.textContent = '✗ ' + (data.error || '抓取失败');
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('抓取失败', 'error');
    } finally {
      triggerBtn.disabled = false; triggerBtn.textContent = '📡 立即抓取';
    }
  };

  topBtn.onclick = async () => {
    topBtn.disabled = true; topBtn.textContent = '🎯 生成中…';
    resultBox.className = 'result-box';
    resultBox.textContent = '⏳ 正在基于当前新闻生成 Top 10 关键词…';
    try {
      const data = await api('/api/tools/news/top/refresh', { method: 'POST' });
      if (data.success) {
        resultBox.className = 'result-box show success';
        resultBox.textContent = '✓ 生成完成：' + data.count + ' 个关键词' + (data.generated_at ? ' · ' + formatNewsTime(data.generated_at) : '');
        toast('Top 10 生成完成', 'success');
        viewMode = 'top';
        setView('top');
        loadTop();
      } else {
        resultBox.className = 'result-box show error';
        resultBox.textContent = '✗ ' + (data.error || '生成失败');
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      resultBox.className = 'result-box show error';
      resultBox.textContent = '✗ ' + e.message;
      toast('生成失败', 'error');
    } finally {
      topBtn.disabled = false; topBtn.textContent = '🎯 生成 Top 10';
    }
  };

  reloadBtn.onclick = loadCurrent;
  toggleBtn.onclick = () => setView(viewMode === 'top' ? 'all' : 'top');

  loadTop();
}
