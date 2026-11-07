/**
 * 外部基准覆盖率报告（默认不阻断 CI）。
 *
 * 数据来源：
 *  - validation/benchmarks/cases.json
 *  - validation/impedance/golden.json（自动归入 impedance_microstrip）
 *
 * 用法：
 *   npm run benchmark:coverage
 *   npm run benchmark:coverage:strict   # 任一模块没有任何外部用例时非零退出
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TOOLS } from '../apps/web/src/entities/calculator/model/navModel';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const benchFile = join(root, 'validation', 'benchmarks', 'cases.json');
const goldenFile = join(root, 'validation', 'impedance', 'golden.json');
const reportFile = join(root, 'validation', 'benchmarks', 'coverage.md');
const strict = process.argv.includes('--strict');

const TOOL_SOURCES = new Set(['polar', 'sigrity', 'field-solver', 'test-coupon']);
const KNOWN_SOURCES = new Set([...TOOL_SOURCES, 'published']);

const modules = new Map<string, string>();
for (const tool of ALL_TOOLS) {
  if (!modules.has(tool.calcId)) modules.set(tool.calcId, tool.label);
}

interface ExternalCase {
  moduleId: string;
  id: string;
  source: string;
}

const warnings: string[] = [];
const seen = new Set<string>();
const entries: ExternalCase[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCases(file: string): unknown[] {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
    throw new Error(`${file} 缺少 cases 数组`);
  }
  return parsed.cases;
}

function addCase(raw: unknown, moduleOverride?: string): void {
  if (!isRecord(raw)) {
    warnings.push('已跳过非对象用例');
    return;
  }
  const moduleId = moduleOverride ?? raw.moduleId;
  const id = raw.id;
  const source = raw.source;

  if (typeof moduleId !== 'string' || typeof id !== 'string' || typeof source !== 'string') {
    warnings.push('已跳过缺少 moduleId / id / source 的用例');
    return;
  }
  if (!modules.has(moduleId)) {
    warnings.push(`未知模块 ${moduleId}（用例 ${id}）`);
    return;
  }
  if (!KNOWN_SOURCES.has(source)) {
    warnings.push(`未知来源 ${source}（用例 ${id}）`);
  }

  const key = `${moduleId}:${id}`;
  if (seen.has(key)) {
    warnings.push(`重复用例 ${key}`);
    return;
  }
  seen.add(key);
  entries.push({ moduleId, id, source });
}

if (existsSync(benchFile)) {
  for (const item of readCases(benchFile)) addCase(item);
} else {
  warnings.push(`缺少 ${benchFile}`);
}

if (existsSync(goldenFile)) {
  for (const item of readCases(goldenFile)) addCase(item, 'impedance_microstrip');
}

interface Stats {
  count: number;
  sources: Set<string>;
  toolSources: Set<string>;
}

const stats = new Map<string, Stats>();
for (const id of modules.keys()) {
  stats.set(id, { count: 0, sources: new Set(), toolSources: new Set() });
}

for (const entry of entries) {
  const stat = stats.get(entry.moduleId);
  if (!stat) continue;
  stat.count += 1;
  stat.sources.add(entry.source);
  if (TOOL_SOURCES.has(entry.source)) stat.toolSources.add(entry.source);
}

function statusOf(stat: Stats): 'ready' | 'partial' | 'missing' {
  if (stat.count === 0) return 'missing';
  if (stat.count >= 10 && stat.toolSources.size >= 2) return 'ready';
  return 'partial';
}

const STATUS_LABEL = { ready: '达标', partial: '部分', missing: '缺失' } as const;

let ready = 0;
let partial = 0;
let missing = 0;
const rows: string[] = [];

for (const [id, label] of modules) {
  const stat = stats.get(id)!;
  const status = statusOf(stat);
  if (status === 'ready') ready += 1;
  else if (status === 'partial') partial += 1;
  else missing += 1;

  const sources = stat.sources.size > 0 ? [...stat.sources].sort().join(', ') : '—';
  rows.push(
    `| ${label} | \`${id}\` | ${stat.count} | ${sources} | ${stat.toolSources.size} | ${STATUS_LABEL[status]} |`,
  );
}

const summary = `合计：${ready}/${modules.size} 达标，${partial} 部分，${missing} 缺失`;
const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
  now.getDate(),
).padStart(
  2,
  '0',
)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const markdown = [
  '# 外部基准覆盖率报告',
  '',
  `- 生成时间：${stamp}`,
  `- 口径：用例数 ≥ 10 且 ≥ 2 个工具来源（polar / sigrity / field-solver / test-coupon）为“达标”；published 只算公开参考`,
  `- ${summary}`,
  '',
  '| 模块 | id | 用例数 | 来源 | 工具来源数 | 状态 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  warnings.length > 0 ? `> 警告：${warnings.join('；')}` : '> 无格式警告',
  '',
].join('\n');

writeFileSync(reportFile, markdown, 'utf8');

console.log(markdown);
console.log(`\n报告已写入：${reportFile}`);

if (warnings.length > 0) {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

if (strict && missing > 0) {
  console.error(`\n[严格模式] ${missing} 个模块没有任何外部用例。`);
  process.exit(1);
}
