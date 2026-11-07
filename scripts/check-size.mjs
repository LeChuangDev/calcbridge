/**
 * 首屏体积门禁：只统计 dist/index.html 直接引用的脚本/样式（含 modulepreload）。
 * 面板切片是动态加载，不进入首屏预算。
 *
 * 用法：node scripts/check-size.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps', 'web', 'dist');
const htmlPath = join(dist, 'index.html');

const JS_BUDGET_KB = 100;
const CSS_BUDGET_KB = 15;

if (!existsSync(htmlPath)) {
  console.error('缺少 apps/web/dist/index.html，请先执行 npm run build:web');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const refs = new Set();
const tagRe = /<(script|link)\b[^>]*?(?:src|href)="([^"]+)"/g;
let match;
while ((match = tagRe.exec(html))) {
  const url = match[2];
  if (url.startsWith('/assets/')) refs.add(url.slice(1));
}

const rows = [...refs].sort().map((rel) => {
  const raw = readFileSync(join(dist, rel));
  return { rel, raw: raw.length, gzip: gzipSync(raw).length };
});

let jsGzip = 0;
let cssGzip = 0;
for (const row of rows) {
  if (row.rel.endsWith('.css')) cssGzip += row.gzip;
  else jsGzip += row.gzip;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
for (const row of rows) {
  console.log(`${row.rel.padEnd(46)} raw ${kb(row.raw).padStart(9)}  gzip ${kb(row.gzip).padStart(9)}`);
}
console.log(
  `\n首屏总计：JS gzip ${kb(jsGzip)} / CSS gzip ${kb(cssGzip)}（预算 ${JS_BUDGET_KB} KB / ${CSS_BUDGET_KB} KB）`,
);

const failures = [];
if (jsGzip > JS_BUDGET_KB * 1024) failures.push(`首屏 JS 超出预算：${kb(jsGzip)} > ${JS_BUDGET_KB} KB`);
if (cssGzip > CSS_BUDGET_KB * 1024) failures.push(`首屏 CSS 超出预算：${kb(cssGzip)} > ${CSS_BUDGET_KB} KB`);

if (failures.length > 0) {
  for (const message of failures) console.error(`\n[体积门禁失败] ${message}`);
  console.error('如确需放宽，请同步调整 scripts/check-size.mjs 中的预算值并在 PR 中说明原因。');
  process.exit(1);
}
