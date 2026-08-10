// 前端构建脚本
// 处理所有前端插件的构建，输出到 public/js/
// 每个插件目录下的 frontend.ts 是入口，子模块在同一目录内

import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PLUGINS = ['config', 'cron', 'db-admin', 'disk', 'dispatch', 'js', 'news', 'stock', 'sys-monitor'];

// ─── 1. 构建 shell, shared, registry ───
await build({
  entryPoints: [
    'src/frontend/shell.ts',
    'src/frontend/shared.ts',
    'src/frontend/registry.ts',
  ],
  format: 'esm',
  target: 'es2022',
  outdir: 'public/js',
  outbase: 'src/frontend',
  allowOverwrite: true,
  logLevel: 'warning',
});

// ─── 2. 构建普通插件（无 bundle，外部引用 shared.js） ───
for (const id of PLUGINS) {
  await build({
    entryPoints: [`src/frontend/plugins/${id}/frontend.ts`],
    format: 'esm',
    target: 'es2022',
    outfile: `public/js/plugins/${id}.js`,
    allowOverwrite: true,
    logLevel: 'warning',
  });
}

// ─── 3. 构建 QR 传输（bundle 子模块，外部引用 shared.js） ───
await build({
  entryPoints: ['src/frontend/plugins/qr-transfer/frontend.ts'],
  bundle: true,
  external: ['../../shared.js'],
  format: 'esm',
  target: 'es2022',
  outfile: 'public/js/plugins/qr-transfer.js',
  logLevel: 'warning',
});

// ─── 4. 修正 shared.js 引用路径 ───
// 源代码中 shared.js 的引用是 ../../shared.js（相对于 plugins/<name>/frontend.ts）
// 但构建产物在 public/js/plugins/<name>.js，实际需要 ../shared.js
function fixSharedPath(file) {
  if (!existsSync(file)) return;
  let content = readFileSync(file, 'utf8');
  content = content.replaceAll("../../shared.js", "../shared.js");
  writeFileSync(file, content);
}

for (const id of PLUGINS) {
  fixSharedPath(`public/js/plugins/${id}.js`);
}
fixSharedPath('public/js/plugins/qr-transfer.js');

console.log('[build-frontend] done');