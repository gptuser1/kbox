import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'sys-monitor',
  name: '系统监控',
  icon: '📊',
  desc: '多主机系统状态监控看板',
  version: '1.0.0',
  entry: {
    frontend: 'sys-monitor',
    backend: '/api/plugins/sys-monitor',
  },
};
