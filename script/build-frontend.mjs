// 前端构建脚本
// 统一构建所有插件，无特殊处理
// - 所有插件用 bundle 模式（内联本地子模块和 npm 依赖）
// - shared.js 保持外部引用（运行时共享同一份 currentToken）
// - 后处理修正 shared.js 路径（源码层级 ../../ 与产物层级 ../ 的差异）

import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── 1. 构建核心模块（shell, shared, registry） ───
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

// ─── 2. 发现所有插件 ───
const pluginsDir = 'src/frontend/plugins';
const pluginDirs = readdirSync(pluginsDir).filter(name => {
  const dir = join(pluginsDir, name);
  return statSync(dir).isDirectory() && existsSync(join(dir, 'frontend.ts'));
});

// ─── 3. 统一构建所有插件 ───
// 所有插件用相同配置：bundle 内联依赖，shared.js 保持外部引用
for (const id of pluginDirs) {
  await build({
    entryPoints: [join(pluginsDir, id, 'frontend.ts')],
    bundle: true,
    external: ['../../shared.js'],
    format: 'esm',
    target: 'es2022',
    outfile: `public/js/plugins/${id}.js`,
    allowOverwrite: true,
    logLevel: 'warning',
  });
}

// ─── 4. 后处理：修正 shared.js 引用路径 ───
// 源码在 plugins/<id>/frontend.ts 引用 ../../shared.js（两层向上）
// 产物在 public/js/plugins/<id>.js 只需 ../shared.js（一层向上）
for (const id of pluginDirs) {
  const file = `public/js/plugins/${id}.js`;
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8').replaceAll('../../shared.js', '../shared.js');
  writeFileSync(file, content);
}

console.log(`[build-frontend] done: ${pluginDirs.length} plugins built`);