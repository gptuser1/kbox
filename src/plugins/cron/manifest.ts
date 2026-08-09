import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'cron',
  name: '定时任务',
  icon: '⏰',
  desc: '定时执行任务',
  version: '1.0.0',
  entry: {
    frontend: 'cron',
    backend: '/api/cron-tasks',
  },
};
