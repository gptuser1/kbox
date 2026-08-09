// QR 传输插件 — 主入口
// 通过 QR 码在设备间传输文件，无需网络
// 发送端：文件 → 喷泉码 → QR 码动画
// 接收端：摄像头 → QR 解码 → 喷泉码恢复 → 文件下载

import QRCode from 'qrcode';
import { LTEncoder, LTDecoder } from './fountain';
import { packFile, unpackFile, verifyFile, packFrame, parseFrame, fnv1a, streamIdentity } from './protocol';
import { blockLength, fitsInOneStream } from './frame-capacity';
import { rasterizeQr } from './qr-raster';
import type { FrontendPlugin } from '../../shared.js';

// ─── 工具函数 ───
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

// ─── 渲染 HTML ───
export function render(): string {
  return `
    <div class="tool-title-row">
      <h2>📡 QR 传输</h2>
    </div>
    <div class="qr-tabs">
      <button class="qr-tab active" data-tab="send">📤 发送</button>
      <button class="qr-tab" data-tab="receive">📥 接收</button>
    </div>
    <div id="qrSendPanel" class="qr-panel">
      <div class="section-title">文件来源</div>
      <div class="qr-source-options">
        <label class="qr-source-btn" id="qrLocalBtn">
          <input type="file" id="qrFileInput" style="display:none">
          <span>📁 从本地选择</span>
        </label>
      </div>
      <div id="qrFileInfo" class="qr-file-info" style="display:none">
        <span id="qrFileName"></span>
        <span id="qrFileSize"></span>
        <button class="btn btn-sm btn-outline" id="qrClearFileBtn">✕ 清除</button>
      </div>
      <div class="section-title" style="margin-top:16px">传输设置</div>
      <div class="qr-settings-row">
        <label>帧大小: <select id="qrFrameBytes">
          <option value="500">500 B</option>
          <option value="1000">1 KB</option>
          <option value="1465" selected>1465 B (V27)</option>
          <option value="2000">2 KB</option>
          <option value="2953">2953 B (V40)</option>
        </select></label>
        <label>帧率: <select id="qrFps">
          <option value="15">15 fps</option>
          <option value="24" selected>24 fps</option>
          <option value="30">30 fps</option>
          <option value="60">60 fps</option>
        </select></label>
      </div>
      <button class="btn btn-primary" id="qrStartSendBtn" disabled>📤 开始传输</button>
      <div id="qrSendStage" class="qr-stage" style="display:none">
        <canvas id="qrCanvas"></canvas>
        <div id="qrSendProgress" class="qr-progress">
          <div class="qr-progress-bar" id="qrSendBar"></div>
          <span id="qrSendStatus"></span>
        </div>
        <button class="btn btn-outline btn-sm" id="qrStopSendBtn">⏹ 停止传输</button>
      </div>
    </div>
    <div id="qrReceivePanel" class="qr-panel" style="display:none">
      <div class="section-title">摄像头</div>
      <div class="qr-camera-box">
        <video id="qrVideo" autoplay playsinline></video>
        <canvas id="qrOverlay" class="qr-overlay"></canvas>
        <div id="qrCameraStatus" class="qr-camera-status">等待启动…</div>
      </div>
      <button class="btn btn-primary" id="qrStartCameraBtn">📷 启动摄像头</button>
      <button class="btn btn-outline" id="qrStopCameraBtn" style="display:none">⏹ 停止接收</button>
      <div id="qrReceiveProgress" class="qr-progress" style="display:none">
        <div class="qr-progress-bar" id="qrReceiveBar"></div>
        <span id="qrReceiveStatus"></span>
      </div>
      <div id="qrReceiveResult" class="qr-result" style="display:none"></div>
    </div>
    <div class="modal-overlay" id="qrConfirmOverlay">
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <h3>检测到文件传输</h3>
        </div>
        <div class="modal-body" id="qrConfirmBody"></div>
        <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px">
          <button class="btn btn-outline" id="qrRejectBtn">❌ 拒绝</button>
          <button class="btn btn-primary" id="qrAcceptBtn">✅ 接收</button>
        </div>
      </div>
    </div>
  `;
}

// ─── 挂载事件 ───
export function mount(): void {
  // DOM 引用
  const sendPanel = $('qrSendPanel');
  const receivePanel = $('qrReceivePanel');
  const tabs = document.querySelectorAll('.qr-tab');
  const fileInput = $('qrFileInput') as HTMLInputElement;
  const localBtn = $('qrLocalBtn');
  const fileInfo = $('qrFileInfo');
  const fileName = $('qrFileName');
  const fileSize = $('qrFileSize');
  const clearFileBtn = $('qrClearFileBtn');
  const startSendBtn = $('qrStartSendBtn') as HTMLButtonElement;
  const stopSendBtn = $('qrStopSendBtn') as HTMLButtonElement;
  const sendStage = $('qrSendStage');
  const canvas = $('qrCanvas') as HTMLCanvasElement;
  const sendBar = $('qrSendBar');
  const sendStatus = $('qrSendStatus');
  const frameBytesSelect = $('qrFrameBytes') as HTMLSelectElement;
  const fpsSelect = $('qrFps') as HTMLSelectElement;
  const startCameraBtn = $('qrStartCameraBtn') as HTMLButtonElement;
  const stopCameraBtn = $('qrStopCameraBtn') as HTMLButtonElement;
  const video = $('qrVideo') as HTMLVideoElement;
  const overlay = $('qrOverlay') as HTMLCanvasElement;
  const cameraStatus = $('qrCameraStatus');
  const receiveBar = $('qrReceiveBar');
  const receiveStatus = $('qrReceiveStatus');
  const receiveProgress = $('qrReceiveProgress');
  const receiveResult = $('qrReceiveResult');
  const confirmOverlay = $('qrConfirmOverlay');
  const confirmBody = $('qrConfirmBody');
  const acceptBtn = $('qrAcceptBtn') as HTMLButtonElement;
  const rejectBtn = $('qrRejectBtn') as HTMLButtonElement;

  // 状态
  let selectedFile: { name: string; bytes: Uint8Array; type: string } | null = null;
  let sendGeneration = 0;
  let stream: MediaStream | null = null;
  let captureGen = 0;
  let decoder: LTDecoder | null = null;
  let streamKey = '';
  let receiveDone = false;
  let pendingFileInfo: { name: string; size: number; type: string } | null = null;
  let pendingContainer: Uint8Array | null = null;
  let acceptTransfer = false;

  // ─── Tab 切换 ───
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = (tab as HTMLElement).dataset.tab;
      sendPanel.style.display = target === 'send' ? '' : 'none';
      receivePanel.style.display = target === 'receive' ? '' : 'none';
    });
  });

  // ─── 文件选择 ───
  localBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (!fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (file.size === 0) { alert('文件为空'); return; }
    if (file.size > 64 * 1024 * 1024) { alert('文件超过 64 MB 限制'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      selectedFile = { name: file.name, bytes: new Uint8Array(reader.result as ArrayBuffer), type: file.type };
      fileName.textContent = '📄 ' + file.name;
      fileSize.textContent = formatSize(file.size);
      fileInfo.style.display = 'flex';
      startSendBtn.disabled = false;
    };
    reader.readAsArrayBuffer(file);
  });
  clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInfo.style.display = 'none';
    startSendBtn.disabled = true;
    fileInput.value = '';
  });

  // ─── 发送端 ───
  // 使用 BarcodeDetector 检测 canvas 上的 QR 码
  // 为了兼容性，我们使用 qrcode 库生成 QR 码并直接显示在 canvas 上
  let sendAnimFrame = 0;
  let encoder: LTEncoder | null = null;
  let sessionId = 0;
  let nextSeq = 0;
  let header: any = null;

  async function startSend() {
    if (!selectedFile) return;
    const gen = ++sendGeneration;
    sendStage.style.display = 'block';
    startSendBtn.disabled = true;
    stopSendBtn.style.display = '';

    try {
      const packed = await packFile(selectedFile.name, selectedFile.type, selectedFile.bytes);
      const frameBytes = Number(frameBytesSelect.value);
      const fps = Number(fpsSelect.value);
      const blockLen = blockLength(frameBytes);

      if (!fitsInOneStream(packed.container.length, frameBytes)) {
        sendStatus.textContent = '文件过大，请增大帧大小';
        return;
      }

      sessionId = (Math.floor(Math.random() * 0xffff) + 1) & 0xffff;
      encoder = new LTEncoder(packed.container, blockLen, sessionId);
      header = { sessionId, seq: 0, k: encoder.k, blockLen, totalLen: packed.container.length, payloadFnv: fnv1a(packed.container) };
      nextSeq = 0;
      const totalFrames = encoder.k * 2; // 一个完整周期

      let version: number | undefined;
      const MARGIN = 4;
      sendStatus.textContent = `K=${encoder.k} · 发送中…`;

      // 动画循环
      const frameInterval = 1000 / fps;
      let lastFrameTime = 0;
      let framesSent = 0;

      function tick(timestamp: number) {
        if (gen !== sendGeneration) return;
        if (timestamp - lastFrameTime < frameInterval) {
          sendAnimFrame = requestAnimationFrame(tick);
          return;
        }
        lastFrameTime = timestamp;
        framesSent++;

        // 生成 QR 码
        const seq = nextSeq++;
        const block = encoder!.encode(seq);
        const frameData = packFrame({ ...header!, seq }, block);

        // 使用 qrcode 库生成 QR 码
        const qr = QRCode.create([{ data: frameData, mode: 'byte' }], {
          errorCorrectionLevel: 'L',
          version,
          maskPattern: 4,
        });
        if (version === undefined) {
          version = qr.version;
          // 调整 canvas 大小
          const cell = qr.modules.size + 2 * MARGIN;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = cell * dpr;
          canvas.height = cell * dpr;
          canvas.style.width = cell + 'px';
          canvas.style.height = cell + 'px';
          canvas.style.maxWidth = '100%';
        }

        // 绘制 QR 码
        const raster = rasterizeQr(qr.modules.size, qr.modules.data, MARGIN);
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;
        const imgData = new ImageData(new Uint8ClampedArray(raster.pixels.buffer), raster.size, raster.size);
        ctx.imageSmoothingEnabled = false;
        // 创建临时 canvas 缩放
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = raster.size;
        tempCanvas.height = raster.size;
        tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

        // 更新进度
        const pct = Math.min(100, (framesSent / totalFrames) * 100);
        sendBar.style.width = pct + '%';
        sendStatus.textContent = `K=${encoder!.k} · 已发送 ${framesSent} 帧` + (version ? ` · V${version}` : '');

        sendAnimFrame = requestAnimationFrame(tick);
      }

      sendAnimFrame = requestAnimationFrame(tick);
    } catch (e: any) {
      sendStatus.textContent = '发送失败: ' + (e.message || String(e));
      startSendBtn.disabled = false;
      stopSendBtn.style.display = 'none';
    }
  }

  function stopSend() {
    sendGeneration++;
    cancelAnimationFrame(sendAnimFrame);
    sendStage.style.display = 'none';
    startSendBtn.disabled = false;
    stopSendBtn.style.display = 'none';
    encoder = null;
    header = null;
  }

  startSendBtn.addEventListener('click', startSend);
  stopSendBtn.addEventListener('click', stopSend);

  // ─── 接收端 ───
  const overlayCtx = overlay.getContext('2d')!;
  let barcodeDetector: any = null;
  let scanTimer = 0;

  // 检查浏览器是否支持 BarcodeDetector
  const BarcodeDetector = (window as any).BarcodeDetector;

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = '浏览器不支持摄像头';
      return;
    }
    startCameraBtn.disabled = true;
    startCameraBtn.textContent = '启动中…';
    receiveDone = false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err: any) {
      cameraStatus.textContent = '摄像头启动失败: ' + (err.message || String(err));
      startCameraBtn.disabled = false;
      startCameraBtn.textContent = '📷 启动摄像头';
      return;
    }

    video.srcObject = stream;
    startCameraBtn.style.display = 'none';
    stopCameraBtn.style.display = '';
    cameraStatus.textContent = '等待二维码中…';

    // 初始化 BarcodeDetector
    if (BarcodeDetector) {
      try {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      } catch { barcodeDetector = null; }
    }

    if (!barcodeDetector) {
      cameraStatus.textContent = '浏览器不支持 QR 码检测，请使用 Chrome 或 Edge';
    }

    // 开始扫描循环
    captureGen++;
    receiveProgress.style.display = 'block';
    receiveBar.style.width = '0%';
    receiveStatus.textContent = '扫描中…';
    receiveResult.style.display = 'none';
    decoder = null;
    streamKey = '';

    scanLoop(captureGen);
  }

  async function scanLoop(gen: number) {
    if (receiveDone || gen !== captureGen || !stream) return;

    if (barcodeDetector && video.readyState >= 2) {
      try {
        const barcodes = await barcodeDetector.detect(video);
        for (const bc of barcodes) {
          if (!bc.rawValue) continue;
          // 将 base64 或二进制数据转换为 Uint8Array
          const raw = bc.rawValue;
          const bytes = strToUint8(raw);
          if (!bytes) continue;

          const parsed = parseFrame(bytes);
          if (!parsed || receiveDone) continue;
          const { header: h, block } = parsed;

          const identity = streamIdentity(h);
          if (!decoder || streamKey !== identity) {
            // 新流，弹出确认框
            if (!acceptTransfer) {
              pendingFileInfo = { name: `文件 (${formatSize(h.totalLen)})`, size: h.totalLen, type: 'application/octet-stream' };
              pendingContainer = null;
              showConfirm(h);
            }
            decoder = new LTDecoder(h.k, h.blockLen, h.sessionId, h.totalLen);
            streamKey = identity;
            cameraStatus.textContent = '接收中…';
          }

          decoder.addFrame(h.seq, block);
          receiveBar.style.width = Math.min(100, (decoder.framesNew / (h.k * 1.5)) * 100) + '%';
          receiveStatus.textContent = `${decoder.framesNew} 帧 · ${decoder.solvedCount}/${decoder.k} 块`;

          if (decoder.isComplete) {
            const payload = decoder.assemble()!;
            const ok = fnv1a(payload) === h.payloadFnv;
            if (ok) {
              await finishReceive(payload);
            } else {
              receiveStatus.textContent = '校验失败，请重试';
            }
            return;
          }
        }
      } catch { /* 检测失败，继续 */ }
    }

    scanTimer = window.setTimeout(() => scanLoop(gen), 200);
  }

  function strToUint8(s: string): Uint8Array | null {
    try {
      // 尝试作为二进制字符串处理
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
      return bytes;
    } catch { return null; }
  }

  function showConfirm(h: any) {
    pendingContainer = null;
    confirmBody.innerHTML = `
      <p>检测到来自发送端的文件传输请求</p>
      <p style="margin-top:12px">
        <strong>📏 大小:</strong> ${formatSize(h.totalLen)}<br>
        <strong>🔢 块数:</strong> K = ${h.k}<br>
        <strong>📦 块大小:</strong> ${h.blockLen} B
      </p>
    `;
    confirmOverlay.classList.add('show');
  }

  function closeConfirm() {
    confirmOverlay.classList.remove('show');
    pendingFileInfo = null;
    acceptTransfer = false;
  }

  function handleAccept() {
    acceptTransfer = true;
    closeConfirm();
  }

  function handleReject() {
    decoder = null;
    streamKey = '';
    receiveStatus.textContent = '已拒绝';
    closeConfirm();
  }

  acceptBtn.addEventListener('click', handleAccept);
  rejectBtn.addEventListener('click', handleReject);
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) handleReject();
  });

  async function finishReceive(container: Uint8Array) {
    receiveDone = true;
    captureGen++;
    stopCamera();

    try {
      const file = await unpackFile(container);
      const verified = await verifyFile(file);
      if (!verified) throw new Error('SHA-256 校验失败');

      // 触发下载
      const blob = new Blob([file.bytes as BlobPart], { type: file.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      receiveResult.style.display = 'block';
      receiveResult.innerHTML = `
        <div class="qr-success">✅ 传输完成</div>
        <p>📄 ${file.name} (${formatSize(file.bytes.length)})</p>
        <p>文件已保存到浏览器下载目录</p>
        <button class="btn btn-primary" id="qrReceiveAnotherBtn">📥 继续接收</button>
      `;
      receiveStatus.textContent = '传输完成';
      receiveBar.style.width = '100%';
      $('qrReceiveAnotherBtn')?.addEventListener('click', () => {
        receiveResult.style.display = 'none';
        startCamera();
      });
    } catch (e: any) {
      receiveStatus.textContent = '恢复失败: ' + (e.message || String(e));
      receiveResult.style.display = 'block';
      receiveResult.innerHTML = `
        <div class="qr-error">❌ 传输失败</div>
        <p>${e.message || '文件恢复失败'}</p>
        <button class="btn btn-primary" id="qrRetryBtn">📥 重试</button>
      `;
      $('qrRetryBtn')?.addEventListener('click', () => {
        receiveResult.style.display = 'none';
        startCamera();
      });
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    startCameraBtn.style.display = '';
    stopCameraBtn.style.display = 'none';
    startCameraBtn.disabled = false;
    startCameraBtn.textContent = '📷 启动摄像头';
    cameraStatus.textContent = '已停止';
    clearTimeout(scanTimer);
  }

  startCameraBtn.addEventListener('click', startCamera);
  stopCameraBtn.addEventListener('click', () => {
    receiveDone = true;
    captureGen++;
    stopCamera();
  });
}

// 编译期校验
const _typeCheck: FrontendPlugin = { render, mount };