// 工具：微型云盘
// 独立模块，由 shell 在点击时动态 import('/js/tools/disk.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api, formatDate } from '../shared.js';

const DISK_CHUNK_SIZE = 1.4 * 1024 * 1024;
const DISK_MAX_SIZE = 10 * 1024 * 1024;

function fileIcon(mime: string): string {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) return '🗜️';
  if (mime.includes('json') || mime.includes('text') || mime.includes('javascript') || mime.includes('xml')) return '📝';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️';
  if (mime.includes('word') || mime.includes('document')) return '📃';
  return '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function render(): string {
  return `
    <div class="tool-title-row">
      <h2>☁️ 微型云盘</h2>
      <div class="ttr-stats" id="diskStats"></div>
    </div>
    <div class="section-title">文件列表</div>
    <div id="diskFileList"></div>
    <div class="section-title" style="margin-top:20px">上传文件</div>
    <div class="disk-upload">
      <div class="disk-drop-zone" id="diskDropZone">
        <span class="drop-icon">📁</span>
        <span class="drop-text">点击选择或拖拽文件到此处</span>
        <span class="drop-hint">· 单文件最大 10MB</span>
      </div>
      <input type="file" id="diskFileInput" style="display:none" multiple>
      <div class="disk-pending" id="diskPending"></div>
      <div class="disk-upload-actions" id="diskUploadActions" style="display:none">
        <button class="btn btn-outline btn-sm" id="diskClearBtn">清空</button>
        <button class="btn btn-primary btn-sm" id="diskUploadBtn">确认上传</button>
      </div>
      <div class="disk-upload-progress" id="diskProgress"></div>
    </div>
    <details class="disk-api-docs" style="margin-top:16px">
      <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary);padding:10px 14px;background:var(--card);border-radius:8px;box-shadow:var(--shadow)">📋 API 接口文档</summary>
      <div style="padding:14px;background:var(--card);border-radius:8px;margin-top:6px;box-shadow:var(--shadow);font-size:12px;line-height:1.8;color:var(--text-secondary);overflow-x:auto">
        <p style="color:var(--text);font-weight:600">所有接口需鉴权，支持两种方式：</p>
        <p>① Header: <code>Authorization: Bearer &lt;token&gt;</code></p>
        <p>② Query: <code>?token=&lt;token&gt;</code>（仅下载链接推荐）</p>
        <hr style="border:none;border-top:1px solid var(--border);margin:10px 0">
        <p><b>GET</b> <code>/api/tools/disk/stats</code> — 容量统计</p>
        <p><b>GET</b> <code>/api/tools/disk/files</code> — 文件列表</p>
        <p><b>POST</b> <code>/api/tools/disk/files</code> — 创建文件记录<br>
        <span style="color:var(--text-muted)">body: { name, size, mime_type }</span></p>
        <p><b>POST</b> <code>/api/tools/disk/files/:id/chunks</code> — 上传分片<br>
        <span style="color:var(--text-muted)">body: { chunk_index, content(base64), chunk_size }</span></p>
        <p><b>GET</b> <code>/api/tools/disk/files/:id/download?token=xxx</code> — 下载文件</p>
        <p><b>DELETE</b> <code>/api/tools/disk/files/:id</code> — 删除文件</p>
      </div>
    </details>
    <!-- 下载弹窗 -->
    <div class="disk-dl-overlay" id="diskDlOverlay">
      <div class="disk-dl-popup" id="diskDlPopup">
        <div class="dlp-title">下载文件</div>
        <button class="btn btn-primary" id="diskDlDirectBtn">⬇ 直接下载</button>
        <button class="btn btn-outline" id="diskDlCopyBtn">🔗 复制链接</button>
        <button class="btn btn-outline" id="diskDlCancelBtn" style="font-size:12px">取消</button>
      </div>
    </div>
    <!-- 文件详情弹窗 -->
    <div class="disk-dl-overlay" id="diskDetailOverlay">
      <div class="disk-dl-popup" id="diskDetailPopup" style="width:320px">
        <div class="dlp-title" id="diskDetailTitle">文件详情</div>
        <div id="diskDetailBody" style="font-size:13px;line-height:1.8"></div>
        <button class="btn btn-primary" id="diskDetailClose" style="margin-top:12px">关闭</button>
      </div>
    </div>
  `;
}

export function mount(): void {
  const statsBox = $('diskStats');
  const fileList = $('diskFileList');
  const dropZone = $('diskDropZone');
  const fileInput = $('diskFileInput') as HTMLInputElement;
  const progressBox = $('diskProgress');
  const pendingBox = $('diskPending');
  const uploadActions = $('diskUploadActions');
  const uploadBtn = $('diskUploadBtn') as HTMLButtonElement;
  const clearBtn = $('diskClearBtn') as HTMLButtonElement;
  const dlOverlay = $('diskDlOverlay');
  const dlPopup = $('diskDlPopup');
  const dlDirectBtn = $('diskDlDirectBtn') as HTMLButtonElement;
  const dlCopyBtn = $('diskDlCopyBtn') as HTMLButtonElement;
  const dlCancelBtn = $('diskDlCancelBtn') as HTMLButtonElement;
  const detailOverlay = $('diskDetailOverlay');
  const detailTitle = $('diskDetailTitle');
  const detailBody = $('diskDetailBody');
  const detailCloseBtn = $('diskDetailClose') as HTMLButtonElement;

  let pendingFiles: File[] = [];
  let dlFileId: number = 0;

  async function loadStats() {
    try {
      const s = await api('/api/tools/disk/stats');
      const usagePct = s.max_db_size > 0 ? Math.min(100, (s.db_size / s.max_db_size) * 100) : 0;
      statsBox.innerHTML =
        '<span class="ttr-storage">存储 ' + formatSize(s.db_size) + ' / ' + formatSize(s.max_db_size) + '</span>' +
        '<div class="ttr-bar"><div class="ttr-fill' + (usagePct > 80 ? ' warn' : '') + '" style="width:' + usagePct + '%"></div></div>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      statsBox.innerHTML = '';
    }
  }

  async function loadFiles() {
    fileList.innerHTML = '<div class="empty" style="padding:20px 0">加载中…</div>';
    try {
      const data = await api('/api/tools/disk/files');
      const files = data.files || [];
      fileCache = {};
      for (const f of files) fileCache[f.id] = f;
      if (!files.length) {
        fileList.innerHTML = '<div class="empty" style="padding:20px 0">暂无文件</div>';
        return;
      }
      fileList.innerHTML =
        '<table class="file-table">' +
        '<tbody>' +
        files.map((f: any) =>
          '<tr>' +
          '<td class="ftd-name"><span class="disk-file-link" onclick="showFileDetail(' + f.id + ')" title="' + esc(f.name) + '">' + esc(f.name) + '</span></td>' +
          '<td class="ftd-actions">' +
          '<button class="dl-btn" onclick="event.stopPropagation();openDlPopup(' + f.id + ')">下载</button>' +
          ' <button class="dl-btn dl-del" onclick="deleteFile(' + f.id + ',\'' + esc(f.name) + '\')">删除</button>' +
          '</td>' +
          '</tr>'
        ).join('') +
        '</tbody></table>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      fileList.innerHTML = '<div class="empty" style="padding:20px 0;color:var(--danger)">加载失败：' + esc(e.message) + '</div>';
    }
  }

  // ─── 下载弹窗 ───
  (window as any).openDlPopup = function(id: number) {
    dlFileId = id;
    dlOverlay.classList.add('show');
  };

  function closeDlPopup() {
    dlOverlay.classList.remove('show');
  }

  dlOverlay.addEventListener('click', (e) => {
    if (e.target === dlOverlay) closeDlPopup();
  });
  dlCancelBtn.addEventListener('click', closeDlPopup);

  dlDirectBtn.addEventListener('click', async () => {
    if (!dlFileId) return;
    closeDlPopup();
    try {
      const data = await api('/api/tools/disk/files/' + dlFileId + '/download-token', { method: 'POST' });
      if (!data.dt) throw new Error('未获取到下载令牌');
      const a = document.createElement('a');
      a.href = '/api/tools/disk/files/' + dlFileId + '/download?dt=' + encodeURIComponent(data.dt);
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('下载失败：' + e.message, 'error');
    }
  });

  dlCopyBtn.addEventListener('click', async () => {
    if (!dlFileId) return;
    closeDlPopup();
    try {
      const data = await api('/api/tools/disk/files/' + dlFileId + '/download-token', { method: 'POST' });
      if (!data.dt) throw new Error('未获取到下载令牌');
      const link = window.location.origin + '/api/tools/disk/files/' + dlFileId + '/download?dt=' + encodeURIComponent(data.dt);
      await navigator.clipboard.writeText(link);
      toast('下载链接已复制', 'success');
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('复制失败：' + e.message, 'error');
    }
  });

  // ─── 删除文件 ───
  (window as any).deleteFile = async function(id: any, name: string) {
    if (!confirm('确认删除「' + name + '」？')) return;
    try {
      await api('/api/tools/disk/files/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      loadStats();
      loadFiles();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('删除失败：' + e.message, 'error');
    }
  };

  // ─── 文件详情弹窗 ───
  let fileCache: Record<number, any> = {};

  (window as any).showFileDetail = function(id: number) {
    const f = fileCache[id];
    if (!f) return;
    detailTitle.textContent = '文件详情';
    detailBody.innerHTML =
      '<div><strong>文件名：</strong>' + esc(f.name) + '</div>' +
      '<div><strong>类型：</strong>' + esc(f.mime_type || '未知') + '</div>' +
      '<div><strong>大小：</strong>' + formatSize(f.size) + '</div>' +
      '<div><strong>上传时间：</strong>' + formatDate(f.created_at) + '</div>' +
      (f.chunk_count ? '<div><strong>分片数：</strong>' + f.chunk_count + '</div>' : '');
    detailOverlay.classList.add('show');
  };

  function closeDetailPopup() {
    detailOverlay.classList.remove('show');
  }

  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) closeDetailPopup();
  });
  detailCloseBtn.addEventListener('click', closeDetailPopup);

  // ─── 上传逻辑 ───
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    let added = 0;
    for (const file of arr) {
      if (file.size > DISK_MAX_SIZE) {
        toast('「' + file.name + '」超过 10MB 限制', 'error');
        continue;
      }
      const dup = pendingFiles.find(p => p.name === file.name && p.size === file.size);
      if (dup) { toast('「' + file.name + '」已在队列中', 'info'); continue; }
      pendingFiles.push(file);
      added++;
    }
    if (added) renderPending();
  }

  function renderPending() {
    if (!pendingFiles.length) {
      pendingBox.innerHTML = '';
      uploadActions.style.display = 'none';
      return;
    }
    pendingBox.innerHTML = pendingFiles.map((f, i) =>
      '<div class="disk-pending-item">' +
        '<span class="pn">' + esc(f.name) + '</span>' +
        '<span class="ps">' + formatSize(f.size) + '</span>' +
        '<span class="px" onclick="removePendingFile(' + i + ')">✕</span>' +
      '</div>'
    ).join('');
    uploadActions.style.display = '';
  }

  (window as any).removePendingFile = function(i: number) {
    pendingFiles.splice(i, 1);
    renderPending();
  };

  clearBtn.onclick = () => {
    pendingFiles = [];
    renderPending();
  };

  uploadBtn.onclick = async () => {
    if (!pendingFiles.length) return;
    const batch = pendingFiles.slice();
    pendingFiles = [];
    renderPending();
    uploadBtn.disabled = true; uploadBtn.textContent = '上传中…';
    for (const f of batch) {
      await uploadFile(f);
    }
    uploadBtn.disabled = false; uploadBtn.textContent = '确认上传';
  };

  async function uploadFile(file: File) {
    const chunkCount = Math.ceil(file.size / DISK_CHUNK_SIZE);

    const row = document.createElement('div');
    row.className = 'progress-row';
    row.innerHTML = '<span style="flex-shrink:0;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(file.name) + '</span><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><span style="flex-shrink:0;font-size:12px;color:var(--text-muted)">0%</span>';
    progressBox.appendChild(row);
    const fill = row.querySelector('.progress-fill') as HTMLElement;
    const status = row.querySelectorAll('span')[1];

    try {
      const createRes = await api('/api/tools/disk/files', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, size: file.size, mime_type: file.type || '' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const fileId = createRes.id;

      for (let i = 0; i < chunkCount; i++) {
        const start = i * DISK_CHUNK_SIZE;
        const end = Math.min(start + DISK_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const buf = await chunk.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        const base64 = btoa(binary);

        await api('/api/tools/disk/files/' + fileId + '/chunks', {
          method: 'POST',
          body: JSON.stringify({ chunk_index: i, content: base64, chunk_size: end - start }),
          headers: { 'Content-Type': 'application/json' },
        });

        const pct = Math.round(((i + 1) / chunkCount) * 100);
        fill.style.width = pct + '%';
        status.textContent = pct + '%';
      }

      (row.querySelector('span') as HTMLElement).textContent = '✓ ' + file.name;
      status.textContent = '完成';
      toast('「' + file.name + '」上传完成', 'success');
      loadStats();
      loadFiles();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      (row.querySelector('span') as HTMLElement).textContent = '✗ ' + file.name;
      status.textContent = '失败';
      fill.style.background = 'var(--danger)';
      toast('「' + file.name + '」上传失败：' + e.message, 'error');
    }
  }

  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files && fileInput.files.length) addFiles(fileInput.files); fileInput.value = ''; };
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'var(--primary-light)'; };
  dropZone.ondragleave = () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; };
  dropZone.ondrop = (e) => { e.preventDefault(); dropZone.style.borderColor = ''; dropZone.style.background = ''; if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  loadStats();
  loadFiles();
}