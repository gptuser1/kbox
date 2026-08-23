import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'md-view',
  name: 'MD 阅读',
  icon: '📖',
  desc: '本地渲染 Markdown 文档',
  version: '1.0.0',
  entry: {
    frontend: 'md-view',
    // 无 backend，纯前端插件（文件仅在浏览器本地读取）
  },
};