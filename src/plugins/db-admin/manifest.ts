import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'db-admin',
  name: 'DB 管理',
  icon: '🗄️',
  desc: '浏览与编辑数据库',
  version: '1.0.0',
  entry: {
    frontend: 'db-admin',
    backend: '/api/plugins/db-admin',
  },
};
