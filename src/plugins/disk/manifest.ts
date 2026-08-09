import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'disk',
  name: '微型云盘',
  icon: '☁️',
  desc: '轻量文件存储，单文件 10MB',
  version: '1.0.0',
  entry: {
    frontend: 'disk',
    backend: '/api/tools/disk',
  },
};
