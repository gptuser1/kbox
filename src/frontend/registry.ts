// 本文件由 script/gen-registry.mjs 从 src/plugins/*/manifest.ts 自动生成。
// 请勿手动编辑——修改 manifest.ts 后运行 npm run gen:registry 重新生成。
// name/icon 为默认值，用户 home_layout.overrides 会覆盖。
// render/mount 由 shell 在点击工具时动态 import('/js/tools/<id>.js') 懒加载，
// 从而实现单工具故障隔离（一个工具 JS 出错不影响主页和其他工具）。

export interface ToolMeta {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  { id: 'dispatch', name: 'GitHub Actions', icon: '⚡', desc: '触发 GitHub 工作流' },
  { id: 'disk', name: '微型云盘', icon: '☁️', desc: '轻量文件存储，单文件 10MB' },
  { id: 'stock', name: '基金估值', icon: '💰', desc: '多市场基金持仓估值' },
  { id: 'news', name: 'AI 新闻锐评', icon: '📰', desc: '抓取科技新闻并由 AI 写锐评' },
  { id: 'db-admin', name: 'DB 管理', icon: '🗄️', desc: '浏览与编辑数据库' },
  { id: 'js', name: 'JS 运行工具', icon: '📜', desc: '运行自定义 JS 脚本' },
  { id: 'cron', name: '定时任务', icon: '⏰', desc: '定时执行任务' },
  { id: 'config', name: '配置管理', icon: '⚙️', desc: '管理 API 密钥与工具配置' },
  { id: 'sys-monitor', name: '系统监控', icon: '📊', desc: '多主机系统状态监控看板' },
];
