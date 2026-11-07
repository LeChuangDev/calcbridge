/**
 * 外部基准统一执行器：读取 validation/benchmarks/cases.json，调用各模块求解器，
 * 按用例 tolerancePct 判定通过/失败，并生成 Markdown 报告。
 *
 * 用法：
 *   npm run benchmark:run                 # 有失败则非零退出
 *   npm run benchmark:run -- --report-only # 只报告，不阻断
 *
 * 说明：阻抗模块由 npm run validate:impedance 执行，本脚本不重复实现。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Quantity, solveForward, type CalcSpec, type NamedInputs } from '@calcbridge/core';
import { BUCK_INDUCTOR_SPEC, REGULATOR_SPEC, traceCurrentSpec } from '@calcbridge/calculators';
import { clearanceGap } from '../apps/web/src/features/calculator-clearance/model/clearanceTable';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casesFile = join(root, 'validation', 'benchmarks', 'cases.json');
const reportFile = join(root, 'validation', 'benchmarks', 'run-report.md');
const reportOnly = process.argv.includes('--report-only');

interface BenchmarkCase {
  moduleId: string;
  id: string;
  model?: string;
  inputs: Record<string, number | string>;
  expected: Record<string, number>;
  tolerancePct: number;
  notes?: string;
}

interface Check {
  variable: string;
  expected: number;
  actual: number;
  tolPct: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCases(): BenchmarkCase[] {
  if (!existsSync(casesFile)) throw new Error(`缺少 ${casesFile}`);
  const parsed: unknown = JSON.parse(readFileSync(casesFile, 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
    throw new Error('cases.json 缺少 cases 数组');
  }

  return parsed.cases.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`cases[${index}] 不是对象`);
    const { moduleId, id, inputs, expected } = raw;
    if (typeof moduleId !== 'string' || typeof id !== 'string') {
      throw new Error(`cases[${index}] 缺少 moduleId / id`);
    }
    if (!isRecord(inputs) || !isRecord(expected)) {
      throw new Error(`用例 ${id} 缺少 inputs / expected`);
    }
    const tolerancePct = typeof raw.tolerancePct === 'number' ? raw.tolerancePct : 2;
    const numericInputs: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new Error(`用例 ${id} 的输入 ${key} 必须是数字或字符串`);
      }
      numericInputs[key] = value;
    }
    const numericExpected: Record<string, number> = {};
    for (const [key, value] of Object.entries(expected)) {
      if (typeof value !== 'number') throw new Error(`用例 ${id} 的期望 ${key} 必须是数字`);
      numericExpected[key] = value;
    }
    return {
      moduleId,
      id,
      model: typeof raw.model === 'string' ? raw.model : undefined,
      inputs: numericInputs,
      expected: numericExpected,
      tolerancePct,
      notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    };
  });
}

function solveSpecChecks(
  spec: CalcSpec,
  item: BenchmarkCase,
  modelId: string | undefined,
  keyMap: Record<string, string>,
): Check[] {
  const inputs: NamedInputs = {};
  for (const [key, value] of Object.entries(item.inputs)) {
    const vs = spec.variables.find((variable) => variable.id === key);
    if (!vs) throw new Error(`变量 ${key} 未在 ${spec.id} 中声明`);
    inputs[key] = new Quantity(Number(value), vs.unit);
  }

  const model = spec.models.find((candidate) => candidate.id === modelId) ?? spec.models[0];
  if (!model) throw new Error(`${spec.id} 没有任何模型`);

  const { env } = solveForward(spec, model, inputs);
  return Object.entries(item.expected).map(([key, expected]) => {
    const variable = keyMap[key] ?? key;
    const actual = env[variable];
    if (typeof actual !== 'number') throw new Error(`模型 ${model.id} 未输出变量 ${variable}`);
    return { variable, expected, actual, tolPct: item.tolerancePct };
  });
}

const RUNNERS: Record<string, (item: BenchmarkCase) => Check[]> = {
  trace_current: (item) =>
    solveSpecChecks(traceCurrentSpec, item, item.model ?? 'ipc2221_external', { wMm: 'w' }),
  buck_inductor: (item) =>
    solveSpecChecks(BUCK_INDUCTOR_SPEC, item, item.model, {
      LMh: 'L',
      deltaIA: 'deltaI',
      iPeakA: 'iPeak',
      iRmsA: 'iRms',
      isatReqA: 'isatReq',
    }),
  regulator_3term: (item) => solveSpecChecks(REGULATOR_SPEC, item, item.model, { VoutV: 'Vout' }),
  clearance: (item) => {
    const voltage = Number(item.inputs.voltageV);
    const column = String(item.inputs.column ?? '');
    const actual = clearanceGap(voltage, column);
    return Object.entries(item.expected).map(([key, expected]) => ({
      variable: key,
      expected,
      actual: actual ?? Number.NaN,
      tolPct: item.tolerancePct,
    }));
  },
};

const SKIPPED_MODULES: Record<string, string> = {
  impedance_microstrip: '由 npm run validate:impedance 执行（golden.json）',
};

function errorPct(actual: number, expected: number): number {
  return (Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12)) * 100;
}

const cases = parseCases();
const rows: string[] = [];
const skipped: string[] = [];
let totalChecks = 0;
let failedChecks = 0;

for (const item of cases) {
  const runner = RUNNERS[item.moduleId];
  if (!runner) {
    if (SKIPPED_MODULES[item.moduleId])
      skipped.push(`${item.moduleId}（${SKIPPED_MODULES[item.moduleId]}）`);
    else skipped.push(`${item.moduleId}（无执行器）`);
    continue;
  }

  let checks: Check[];
  try {
    checks = runner(item);
  } catch (error) {
    failedChecks += 1;
    totalChecks += 1;
    rows.push(
      `| ${item.moduleId} | ${item.id} | — | — | — | — | 执行失败：${(error as Error).message} |`,
    );
    continue;
  }

  for (const check of checks) {
    totalChecks += 1;
    const err = errorPct(check.actual, check.expected);
    const pass = Number.isFinite(check.actual) && err <= check.tolPct + 1e-9;
    if (!pass) failedChecks += 1;
    rows.push(
      `| ${item.moduleId} | ${item.id} | ${check.variable} | ${check.expected} | ${
        Number.isFinite(check.actual) ? check.actual.toPrecision(6) : 'NaN'
      } | ${err.toFixed(3)}% | ${check.tolPct}% | ${pass ? '通过' : '失败'} |`,
    );
  }
}

const passedChecks = totalChecks - failedChecks;
const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
  now.getDate(),
).padStart(
  2,
  '0',
)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const markdown = [
  '# 外部基准执行报告',
  '',
  `- 生成时间：${stamp}`,
  `- 执行用例：${cases.length}（校验项 ${totalChecks}）`,
  `- 结果：通过 ${passedChecks}，失败 ${failedChecks}`,
  skipped.length > 0 ? `- 跳过：${skipped.join('；')}` : '',
  '',
  '| 模块 | 用例 | 变量 | 期望 | 实际 | 误差 | 容差 | 结果 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
].join('\n');

writeFileSync(reportFile, markdown, 'utf8');
console.log(markdown);
console.log(`报告已写入：${reportFile}`);

if (failedChecks > 0 && !reportOnly) {
  console.error(`\n[基准执行失败] ${failedChecks} 个校验项未通过。`);
  process.exit(1);
}
