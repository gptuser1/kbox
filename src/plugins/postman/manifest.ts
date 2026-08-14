import type { PluginManifest } from '../../adaptation/types';

export const manifest: PluginManifest = {
  id: 'postman',
  name: '轻量 Postman',
  icon: '🚀',
  desc: '发送 HTTP 请求的轻量级工具',
  version: '1.0.0',
  entry: {
    frontend: 'postman',
    // 无 backend：请求由浏览器本地 fetch 直接发出，不经过 worker
  },
};