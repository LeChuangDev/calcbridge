/**
 * CalcBridge CLI：用于验证计算内核（无 UI 依赖，CI 可跑）。
 *   npm run demo        演示走线载流双标准计算 + 反解 + 蒙特卡洛
 *   npm run regression  跑全部计算器内置算例回归（失败即非 0 退出，阻断发布）
 */
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  formatResult,
  formatValidationMarkdown,
  parseImpedanceCsv,
  parseImpedanceJson,
  runCalculation,
  runMonteCarlo,
  runSpecExamples,
  summarize,
  validateImpedanceDataset,
} from '@calcbridge/core';
import { CALCULATOR_REGISTRY, traceCurrentSpec } from '@calcbridge/calculators';

function demo(): void {
  const spec = traceCurrentSpec;
  console.log(`# ${spec.title}（${spec.id} v${spec.version}）\n`);
  console.log('## 固定假设（FR-E-1）');
  for (const a of spec.assumptions) console.log(`- ${a}`);

  // 正向：给定电流求最小线宽（工艺约束：工厂最小线宽 0.10mm）
  console.log('\n## 正向求解：I=3A, ΔT=10K, 1oz 外层（工厂最小线宽 0.10mm）');
  const run = runCalculation(spec, { I: '3 A', dT: '10 K', cu: '1 oz' });
  for (const r of run.results) {
    console.log('\n' + formatResult(r));
    if (r.verdict.status === 'not-manufacturable') {
      console.log('  → 结论：不可制造（需换叠层/加铜厚/放宽温升）');
    }
  }

  // 反向：给定线宽求最大电流（FR-A-3 任意变量可作待求量）
  console.log('\n## 反向求解：给定 w=1.368mm, ΔT=10K, 1oz，求最大载流 I');
  const back = runCalculation(
    spec,
    { w: '1.368 mm', dT: '10 K', cu: '1 oz' },
    { target: 'I', modelIds: ['ipc2221_external'] },
  );
  console.log(formatResult(back.results[0]!));

  // 不确定度 + 敏感度（FR-A-6 / E-3）
  console.log('\n## 不确定度（I ±10%，2000 样本，seed=42）');
  const mc = runMonteCarlo(
    spec,
    spec.models[0]!,
    { I: '3 A', dT: '10 K', cu: '1 oz' },
    { samples: 2000, seed: 42 },
  );
  console.log(
    `w P10/P50/P90 = ${mc.p10.toFixed(4)} / ${mc.p50.toFixed(4)} / ${mc.p90.toFixed(4)} mm`,
  );
  console.log(
    '最敏感输入:',
    mc.topSensitivity.map((s) => `${s.varId} (ρ=${s.rho.toFixed(3)})`).join(', '),
  );

  // 回归
  console.log('\n## 算例回归');
  console.log(summarize([runSpecExamples(spec)]));
}

function regression(): void {
  const results = Object.values(CALCULATOR_REGISTRY).map(runSpecExamples);
  console.log(summarize(results));
  const failed = results.some((r) => !r.passed);
  process.exitCode = failed ? 1 : 0;
}

function validateImpedance(args: string[]): void {
  const flags = args.filter((arg) => arg.startsWith('--'));
  const file = args.find((arg) => !arg.startsWith('--')) ?? 'validation/impedance/golden.json';
  const requirePolarSigrity = flags.includes('--require-polar-sigrity');
  const text = readFileSync(resolve(file), 'utf8');
  const cases =
    extname(file).toLowerCase() === '.csv' ? parseImpedanceCsv(text) : parseImpedanceJson(text);
  const report = validateImpedanceDataset(cases, { requirePolarSigrity });
  console.log(formatValidationMarkdown(report));
  process.exitCode = report.gate.passed ? 0 : 1;
}

const cmd = process.argv[2] ?? 'demo';
try {
  if (cmd === 'demo') demo();
  else if (cmd === 'regression') regression();
  else if (cmd === 'list') console.log(Object.keys(CALCULATOR_REGISTRY).join('\n'));
  else if (cmd === 'validate-impedance') validateImpedance(process.argv.slice(3));
  else throw new Error(`未知命令：${cmd}（可用：demo | regression | list | validate-impedance）`);
} catch (e) {
  console.error(`[calcbridge] 错误：${(e as Error).message}`);
  process.exit(1);
}
