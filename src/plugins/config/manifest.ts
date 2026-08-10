import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'config',
  name: '配置管理',
  icon: '⚙️',
  desc: '管理 API 密钥与插件配置',
  version: '1.0.0',
  entry: {
    frontend: 'config',
    backend: '/api/config',
  },
};
