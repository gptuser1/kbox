// 工具：微型云盘
// 独立模块，由 shell 在点击时动态 import('/js/tools/disk.js') 加载。
// 即使本模块出错，只影响本工具，不波及壳与其他工具。
import { $, esc, toast, api, formatDate } from '../shared.js';

const DISK_CHUNK_SIZE = 1.4 * 1024 * 1024; // 1.4MB，与后端一致
const DISK_MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
    <h2>☁️ 微型云盘</h2>
    <div class="disk-stats" id="diskStats"></div>
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
    <div class="section-title">文件列表</div>
    <div class="file-list" id="diskFileList"></div>
    <details class="disk-api-docs" style="margin-top:24px">
      <summary style="cursor:pointer;font-size:14px;font-weight:600;color:var(--text-secondary);padding:12px;background:var(--card);border-radius:8px;box-shadow:var(--shadow)">📋 API 接口文档</summary>
      <div style="padding:16px;background:var(--card);border-radius:8px;margin-top:8px;box-shadow:var(--shadow);font-size:13px;line-height:1.8;color:var(--text-secondary);overflow-x:auto">
        <p style="color:var(--text);font-weight:600">所有接口需鉴权，支持两种方式：</p>
        <p>① Header: <code>Authorization: Bearer &lt;token&gt;</code></p>
        <p>② Query: <code>?token=&lt;token&gt;</code>（仅下载链接推荐）</p>
        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
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

  let pendingFiles: File[] = [];

  async function loadStats() {
    try {
      const s = await api('/api/tools/disk/stats');
      const usagePct = s.max_db_size > 0 ? Math.min(100, (s.db_size / s.max_db_size) * 100) : 0;
      statsBox.innerHTML =
        '<div class="disk-stat-card"><div class="stat-label">文件数</div><div class="stat-value">' + s.file_count + '</div></div>' +
        '<div class="disk-stat-card"><div class="stat-label">文件大小</div><div class="stat-value">' + formatSize(s.total_size) + '</div></div>' +
        '<div class="disk-stat-card"><div class="stat-label">存储占用</div><div class="stat-value">' + formatSize(s.db_size) + '</div><div class="stat-sub">上限 ' + formatSize(s.max_db_size) + '</div><div class="disk-usage-bar"><div class="disk-usage-fill ' + (usagePct > 80 ? 'warn' : '') + '" style="width:' + usagePct + '%"></div></div></div>';
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      statsBox.innerHTML = '<div class="empty">统计加载失败</div>';
    }
  }

  async function loadFiles() {
    fileList.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/tools/disk/files');
      const files = data.files || [];
      if (!files.length) {
        fileList.innerHTML = '<div class="empty">暂无文件</div>';
        return;
      }
      fileList.innerHTML = files.map((f: any) =>
        '<div class="file-item"><div class="file-icon">' + fileIcon(f.mime_type) + '</div>' +
        '<div class="file-info"><div class="file-name">' + esc(f.name) + '</div>' +
        '<div class="file-meta">' + formatSize(f.size) + ' · ' + formatDate(f.created_at) + '</div></div>' +
        '<div class="file-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="downloadFile(' + f.id + ',\'' + esc(f.name) + '\')">下载</button>' +
        '<button class="btn btn-outline btn-sm" onclick="deleteFile(' + f.id + ',\'' + esc(f.name) + '\')" style="color:var(--danger)">删除</button>' +
        '</div></div>'
      ).join('');
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      fileList.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    }
  }

  (window as any).downloadFile = async function(id: any, name: string) {
    try {
      const data = await api('/api/tools/disk/files/' + id + '/download-token', { method: 'POST' });
      if (!data.dt) throw new Error('未获取到下载令牌');
      const a = document.createElement('a');
      a.href = '/api/tools/disk/files/' + id + '/download?dt=' + encodeURIComponent(data.dt);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') return;
      toast('下载失败：' + e.message, 'error');
    }
  };

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
