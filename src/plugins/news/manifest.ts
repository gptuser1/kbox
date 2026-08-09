import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'news',
  name: 'AI 新闻锐评',
  icon: '📰',
  desc: '抓取科技新闻并由 AI 写锐评',
  version: '1.0.0',
  entry: {
    frontend: 'news',
    backend: '/api/plugins/news',
  },
};
