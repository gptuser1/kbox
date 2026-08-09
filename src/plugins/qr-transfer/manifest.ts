import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'qr-transfer',
  name: 'QR 传输',
  icon: '📡',
  desc: '通过 QR 码在设备间传输文件，无需网络',
  version: '1.0.0',
  entry: {
    frontend: 'qr-transfer',
    // 无 backend，纯前端插件
  },
};