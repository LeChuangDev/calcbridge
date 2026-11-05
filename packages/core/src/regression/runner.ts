/**
 * 回归运行器（FR-A-9：算例自检）。
 * 每个计算器内置的手册算例作为回归用例；公式或数据变更后自动比对，
 * 偏差超阈值即阻断发布（CI 中跑 `npm run regression`）。
 */
import { type CalcSpec, DEFAULT_TOL } from '../spec/spec';
import { Quantity } from '../unit/quantity';
import { solveForward } from '../solver/solver';

export interface ExampleFailure {
  exampleIndex: number;
  modelId: string;
  variable: string;
  expected: number;
  actual: number;
  tol: number;
  note?: string;
}

export interface RegressionResult {
  specId: string;
  passed: boolean;
  checked: number;
  failures: ExampleFailure[];
  skipped: string[];
}

export function runSpecExamples(spec: CalcSpec): RegressionResult {
  const failures: ExampleFailure[] = [];
  let checked = 0;
  const skipped: string[] = [];

  spec.examples.forEach((ex, idx) => {
    const targetModels =
      ex.models && ex.models.length > 0
        ? spec.models.filter((m) => ex.models!.includes(m.id))
        : spec.models;

    for (const model of targetModels) {
      if (model.pendingVerification) {
        skipped.push(`${model.id}#示例${idx}（待验证数据）`);
        continue;
      }
      const inputs: Record<string, Quantity | number> = {};
      for (const [k, v] of Object.entries(ex.in)) {
        const vs = spec.variables.find((x) => x.id === k)!;
        inputs[k] = new Quantity(v, vs.unit);
      }
      try {
        const { env } = solveForward(spec, model, inputs);
        for (const [varId, expected] of Object.entries(ex.expect)) {
          const tol = ex.tol ?? DEFAULT_TOL;
          const actual = env[varId];
          checked++;
          const err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12);
          if (err > tol) {
            failures.push({
              exampleIndex: idx,
              modelId: model.id,
              variable: varId,
              expected,
              actual,
              tol,
              note: ex.note,
            });
          }
        }
      } catch (e) {
        failures.push({
          exampleIndex: idx,
          modelId: model.id,
          variable: '(抛错)',
          expected: 0,
          actual: 0,
          tol: 0,
          note: `${ex.note ?? ''} ${String(e)}`,
        });
      }
    }
  });

  return {
    specId: spec.id,
    passed: failures.length === 0,
    checked,
    failures,
    skipped,
  };
}

export function summarize(results: RegressionResult[]): string {
  const lines: string[] = [];
  let totalChecked = 0;
  let totalFailed = 0;
  for (const r of results) {
    totalChecked += r.checked;
    totalFailed += r.failures.length;
    lines.push(`${r.passed ? 'PASS' : 'FAIL'} ${r.specId}: 校验 ${r.checked} 项`);
    for (const f of r.failures) {
      lines.push(
        `   ✗ ${f.modelId} 示例${f.exampleIndex + 1} ${f.variable}: 期望 ${f.expected}, 实际 ${f.actual}, 偏差超 ${f.tol}`,
      );
    }
    for (const s of r.skipped) lines.push(`   - 跳过: ${s}`);
  }
  lines.push(
    `共 ${results.length} 个计算器, 校验 ${totalChecked} 项, 失败 ${totalFailed} 项 → ${totalFailed === 0 ? '全部通过' : '阻断发布'}`,
  );
  return lines.join('\n');
}
