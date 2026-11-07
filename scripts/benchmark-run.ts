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
import {
  Quantity,
  parseImpedanceJson,
  solveForward,
  validateImpedanceDataset,
  type CalcSpec,
  type NamedInputs,
} from '@calcbridge/core';
import {
  BUCK_INDUCTOR_SPEC,
  REGULATOR_SPEC,
  RESISTOR_SPEC,
  traceCurrentSpec,
} from '@calcbridge/calculators';
import { clearanceGap } from '../apps/web/src/features/calculator-clearance/model/clearanceTable';
import { solveSkinDepth } from '../apps/web/src/features/calculator-skin-depth/model/skinDepthSolver';
import { solveWaveguide } from '../apps/web/src/features/calculator-waveguide/model/waveguideSolver';
import {
  designRf,
  type RfType,
} from '../apps/web/src/features/calculator-rf-attenuator/model/rfSolver';
import { solveCable } from '../apps/web/src/features/calculator-cable/model/cableSolver';
import { solveLedResistor } from '../apps/web/src/features/calculator-led-resistor/model/ledSolver';
import {
  solveESeries,
  type ESeriesId,
} from '../apps/web/src/features/calculator-e-series/model/eSeriesSolver';
import {
  solveGalvanic,
  type Environment,
} from '../apps/web/src/features/calculator-galvanic/model/galvanicSolver';
import { solveVia } from '../apps/web/src/features/calculator-via/model/viaSolver';
import { solveFuse } from '../apps/web/src/features/calculator-fuse/model/fuseSolver';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casesFile = join(root, 'validation', 'benchmarks', 'cases.json');
const impedanceFile = join(root, 'validation', 'impedance', 'golden.json');
const reportFile = join(root, 'validation', 'benchmarks', 'run-report.md');
const reportOnly = process.argv.includes('--report-only');

interface BenchmarkCase {
  moduleId: string;
  id: string;
  model?: string;
  source?: string;
  sourceVersion?: string;
  sourceUrl?: string;
  evidence?: string;
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

interface ImpedanceSummary {
  cases: number;
  checks: number;
  failures: number;
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
      source: typeof raw.source === 'string' ? raw.source : undefined,
      sourceVersion: typeof raw.sourceVersion === 'string' ? raw.sourceVersion : undefined,
      sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
      evidence: typeof raw.evidence === 'string' ? raw.evidence : undefined,
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

/** 将求解器输出表与 expected 表按 key 对齐，任一输出缺失即视为执行失败。 */
function numericChecks(item: BenchmarkCase, actuals: Record<string, number | undefined>): Check[] {
  return Object.entries(item.expected).map(([key, expected]) => {
    const actual = actuals[key];
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      throw new Error(`用例 ${item.id} 未输出 ${key}`);
    }
    return { variable: key, expected, actual, tolPct: item.tolerancePct };
  });
}

function num(item: BenchmarkCase, key: string, fallback?: number): number {
  const raw = item.inputs[key];
  if (raw === undefined && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`用例 ${item.id} 输入 ${key} 不是有效数字`);
  return value;
}

function str(item: BenchmarkCase, key: string, fallback?: string): string {
  const raw = item.inputs[key];
  if (raw === undefined && fallback !== undefined) return fallback;
  if (typeof raw !== 'string') throw new Error(`用例 ${item.id} 输入 ${key} 不是字符串`);
  return raw;
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
  resistor_calc: (item) =>
    solveSpecChecks(RESISTOR_SPEC, item, item.model, {
      seriesOhm: 'Rs',
      parallelOhm: 'Rp',
      vdivV: 'Vdiv',
    }),
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
  skin_depth: (item) => {
    const { result, error } = solveSkinDepth({
      freqHz: num(item, 'freqHz'),
      thicknessMm: num(item, 'thicknessMm', 0.035),
      widthMm: num(item, 'widthMm', 1),
      tempC: num(item, 'tempC', 20),
    });
    if (!result) throw new Error(error ?? '趋肤深度求解失败');
    return numericChecks(item, {
      skinDepthMm: result.skinDepthMm,
      skinDepthUm: result.skinDepthUm,
      effectiveThicknessMm: result.effectiveThicknessMm,
      acDcRatio: result.acDcRatio,
      criticalFreqHz: result.criticalFreqHz,
    });
  },
  waveguide: (item) => {
    const { result, error } = solveWaveguide({
      aMm: num(item, 'aMm'),
      freqGHz: num(item, 'freqGHz'),
    });
    if (!result) throw new Error(error ?? '波导求解失败');
    return numericChecks(item, {
      fcGHz: result.fcGHz,
      lambdaGMm: result.lambdaGMm,
      zteOhm: result.zteOhm,
      te20GHz: result.te20GHz,
    });
  },
  rf_attenuator: (item) => {
    const design = designRf(
      str(item, 'type', 'pi') as RfType,
      num(item, 'attenuationDb'),
      num(item, 'zin', 50),
      num(item, 'zout', 50),
    );
    if (!design.values) throw new Error(design.error ?? '衰减器设计失败');
    return numericChecks(item, {
      r1: design.values.r1,
      r2: design.values.r2,
      r3: design.values.r3,
    });
  },
  cable_size: (item) => {
    const { result, error } = solveCable({
      voltageV: num(item, 'voltageV'),
      dropPct: num(item, 'dropPct'),
      currentA: num(item, 'currentA'),
      lengthM: num(item, 'lengthM'),
      material: str(item, 'material', 'cu') as 'cu' | 'al',
    });
    if (!result) throw new Error(error ?? '线缆求解失败');
    return numericChecks(item, {
      requiredArea: result.requiredArea,
      selectedArea: result.selectedArea,
      resistance: result.resistance,
      voltageDrop: result.voltageDrop,
      actualDropPct: result.actualDropPct,
      powerLoss: result.powerLoss,
    });
  },
  led_resistor: (item) => {
    const { result, error } = solveLedResistor({
      vin: num(item, 'vin'),
      vf: num(item, 'vf'),
      ifMa: num(item, 'ifMa'),
      count: num(item, 'count', 1),
      series: str(item, 'series', 'E24') as 'E12' | 'E24',
    });
    if (!result) throw new Error(error ?? 'LED 限流求解失败');
    return numericChecks(item, {
      requiredOhm: result.requiredOhm,
      resistorPowerW: result.resistorPowerW,
      ledPowerW: result.ledPowerW,
      totalPowerW: result.totalPowerW,
      choiceOhm: result.choice?.value,
      choiceCurrentMa: result.choice?.currentMa,
      choiceErrorPct: result.choice?.errorPct,
    });
  },
  e_series: (item) => {
    const result = solveESeries(
      str(item, 'series', 'E24') as ESeriesId,
      num(item, 'targetOhm'),
      [],
      num(item, 'maxComponents', 4) as 2 | 3 | 4,
    );
    return numericChecks(item, {
      simpleOhm: result.simple?.value,
      simpleErrorPct: result.simple?.error,
      threeOhm: result.three?.value,
      threeErrorPct: result.three?.error,
      fourOhm: result.four?.value,
      fourErrorPct: result.four?.error,
    });
  },
  galvanic: (item) => {
    const result = solveGalvanic({
      metalA: str(item, 'metalA'),
      metalB: str(item, 'metalB'),
      environment: str(item, 'environment') as Environment,
    });
    return numericChecks(item, {
      difference: result.difference,
      allowed: result.allowed,
      ratio: result.ratio,
    });
  },
  via: (item) => {
    const { result, error } = solveVia({
      holeMm: num(item, 'holeMm'),
      platingMm: num(item, 'platingMm'),
      lengthMm: num(item, 'lengthMm'),
      padMm: num(item, 'padMm'),
      z0: num(item, 'z0', 50),
      currentA: num(item, 'currentA', 1),
      rho: num(item, 'rho', 1.72e-8),
      er: num(item, 'er', 4.2),
      dT: num(item, 'dT', 10),
      riseNs: num(item, 'riseNs', 0),
      freqMHz: num(item, 'freqMHz', 100),
    });
    if (!result) throw new Error(error ?? '过孔求解失败');
    return numericChecks(item, {
      areaMm2: result.areaMm2,
      resistance: result.resistance,
      currentEstimate: result.currentEstimate,
      capacitancePf: result.capacitancePf,
      inductanceNh: result.inductanceNh,
      riseTimePs: result.riseTimePs,
    });
  },
  fuse: (item) => {
    const { result, error } = solveFuse({
      ambientC: num(item, 'ambientC', 25),
      meltC: num(item, 'meltC', 1085),
      widthMm: num(item, 'widthMm'),
      thicknessMm: num(item, 'thicknessMm'),
      currentA: num(item, 'currentA'),
      timeS: num(item, 'timeS'),
    });
    if (!result) throw new Error(error ?? '熔断求解失败');
    return numericChecks(item, {
      fusingCurrentA: result.fusingCurrentA,
      meltTimeS: result.meltTimeS,
      energyRequired: result.energyRequired,
      resistancePerMm: result.resistancePerMm,
    });
  },
};

const SKIPPED_MODULES: Record<string, string> = {
  impedance_microstrip: '由 validation/impedance/golden.json 统一执行，请勿在 cases.json 重复录入',
  pcb_class: '规范参考类，无数值求解器可执行',
  substrate: '材料典型值参考类，无数值求解器可执行',
  unit_converter: '精确 SI 换算，当前由面板实现，未接入基准执行器',
  color_code: 'IEC 60062 查表，当前由面板实现，未接入基准执行器',
};

function errorPct(actual: number, expected: number): number {
  // 期望值为 0 时改用绝对误差（百分点），避免浮点尾差被放大成无穷大误差。
  const scale = Math.abs(expected) >= 1e-9 ? Math.abs(expected) : 1;
  return (Math.abs(actual - expected) / scale) * 100;
}

/** Markdown 表格单元格转义，避免来源文本里的竖线破坏表格。 */
function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function sourceLabelOf(item: BenchmarkCase): string {
  return item.sourceVersion ?? item.source ?? '—';
}

/** 执行微带阻抗 golden 数据集，把每个模型的结果并入同一份报告。 */
function runImpedanceGolden(): ImpedanceSummary {
  if (!existsSync(impedanceFile)) return { cases: 0, checks: 0, failures: 0 };
  const goldenCases = parseImpedanceJson(readFileSync(impedanceFile, 'utf8'));
  const validation = validateImpedanceDataset(goldenCases);
  let checks = 0;
  let failures = 0;

  for (const result of validation.cases) {
    const applicable = result.models.filter((model) => model.applicable && model.value !== null);
    if (applicable.length === 0) {
      skipped.push(`impedance_microstrip（${result.case.id} 无适用模型）`);
      continue;
    }
    for (const model of applicable) {
      checks += 1;
      const actual = model.value ?? Number.NaN;
      const err = model.errorPct ?? errorPct(actual, result.case.expected);
      const pass = model.passed;
      if (!pass) failures += 1;
      rows.push(
        `| impedance_microstrip | ${result.case.id} | ${
          result.case.mode === 'z0' ? 'Z0' : 'width'
        }·${model.modelId} | ${result.case.expected} | ${
          Number.isFinite(actual) ? actual.toPrecision(6) : 'NaN'
        } | ${err.toFixed(3)}% | ${result.case.tolerancePct}% | ${mdCell(
          result.case.sourceVersion ?? result.case.source ?? '—',
        )} | ${pass ? '通过' : '失败'} |`,
      );
    }
  }

  return { cases: goldenCases.length, checks, failures };
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
      `| ${item.moduleId} | ${item.id} | — | — | — | — | ${mdCell(
        sourceLabelOf(item),
      )} | 执行失败：${(error as Error).message} |`,
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
      } | ${err.toFixed(3)}% | ${check.tolPct}% | ${mdCell(sourceLabelOf(item))} | ${
        pass ? '通过' : '失败'
      } |`,
    );
  }
}

const impedance = runImpedanceGolden();
totalChecks += impedance.checks;
failedChecks += impedance.failures;

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
  `- 执行用例：${cases.length + impedance.cases}（校验项 ${totalChecks}）`,
  `- 其中阻抗 golden：${impedance.cases} 例 / ${impedance.checks} 项`,
  `- 结果：通过 ${passedChecks}，失败 ${failedChecks}`,
  skipped.length > 0 ? `- 跳过：${skipped.join('；')}` : '',
  '',
  '| 模块 | 用例 | 变量 | 期望 | 实际 | 误差 | 容差 | 依据 | 结果 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
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
