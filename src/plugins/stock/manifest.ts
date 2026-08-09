import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'stock',
  name: '基金估值',
  icon: '💰',
  desc: '多市场基金持仓估值',
  version: '1.0.0',
  entry: {
    frontend: 'stock',
    backend: '/api/tools/stock',
  },
};
