import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'gh-dispatch',
  name: 'GitHub Actions',
  icon: '⚡',
  desc: '触发 GitHub 工作流',
  version: '1.0.0',
  entry: {
    frontend: 'gh-dispatch',
    backend: '/api/plugins',
  },
};
