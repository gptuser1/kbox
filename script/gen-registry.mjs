// 从 src/plugins/*/manifest.ts 聚合生成 src/frontend/registry.ts
// 单一数据源：后端 manifest。前端 registry 不再手动维护元数据。
// 运行：npm run gen:registry

import { transform } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PLUGINS_DIR = 'src/plugins';
const REGISTRY_PATH = 'src/frontend/registry.ts';

// 首页工具展示顺序（与历史 registry 保持一致；未列出的追加到末尾）
const TOOL_ORDER = ['dispatch', 'disk', 'stock', 'news', 'db-admin', 'js', 'cron', 'config', 'sys-monitor'];

async function loadManifests() {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(PLUGINS_DIR, entry.name, 'manifest.ts');
    let source;
    try {
      source = await readFile(manifestPath, 'utf8');
    } catch {
      continue; // 无 manifest 的插件（share/preferences）跳过
    }
    const { code } = await transform(source, { loader: 'ts' });
    // 移除纯类型导入（transform 不会解析路径，data URL import 时路径无效）
    const js = code.replace(/^\s*import type.*;?\s*$/gm, '');
    const mod = await import('data:text/javascript,' + encodeURIComponent(js));
    manifests.push(mod.manifest);
  }
  return manifests;
}

function sortByOrder(manifests) {
  const fallback = TOOL_ORDER.length;
  const orderMap = new Map(TOOL_ORDER.map((id, i) => [id, i]));
  return manifests.sort((a, b) => {
    const ia = orderMap.has(a.id) ? orderMap.get(a.id) : fallback;
    const ib = orderMap.has(b.id) ? orderMap.get(b.id) : fallback;
    return ia - ib;
  });
}

function esc(s) {
  return String(s).replace(/'/g, "\\'");
}

async function main() {
  const manifests = sortByOrder(await loadManifests());
  const lines = manifests.map(m =>
    `  { id: '${esc(m.id)}', name: '${esc(m.name)}', icon: '${esc(m.icon)}', desc: '${esc(m.desc)}' },`
  );
  const content = `// 本文件由 script/gen-registry.mjs 从 src/plugins/*/manifest.ts 自动生成。
// 请勿手动编辑——修改 manifest.ts 后运行 npm run gen:registry 重新生成。
// name/icon 为默认值，用户 home_layout.overrides 会覆盖。
// render/mount 由 shell 在点击工具时动态 import('/js/plugins/<id>.js') 懒加载，
// 从而实现单工具故障隔离（一个工具 JS 出错不影响主页和其他工具）。

export interface ToolMeta {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const TOOL_REGISTRY: ToolMeta[] = [
${lines.join('\n')}
];
`;
  await writeFile(REGISTRY_PATH, content, 'utf8');
  console.log(`[gen-registry] generated ${manifests.length} plugins -> ${REGISTRY_PATH}`);
}

main().catch(e => { console.error('[gen-registry] failed:', e); process.exit(1); });
