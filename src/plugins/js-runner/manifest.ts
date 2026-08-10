import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'js-runner',
  name: 'JS 运行工具',
  icon: '📜',
  desc: '运行自定义 JS 脚本',
  version: '1.0.0',
  entry: {
    frontend: 'js-runner',
    backend: '/api/plugins/js',
  },
};
