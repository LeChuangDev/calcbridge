import { describe, expect, it } from 'vitest';
import { runCalculation } from '../src/solver/solver';
import { traceCurrentSpec } from '@calcbridge/calculators';

describe('求解器（FR-A-3 正/反向 + A-8 可行域）', () => {
  it('正向：3A/10K/1oz 外层 → 约 1.37mm（验收 1 前半）', () => {
    const run = runCalculation(
      traceCurrentSpec,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { modelIds: ['ipc2221_external'] },
    );
    const w = run.results[0]!.outputs.w!;
    expect(w.value).toBeCloseTo(1.368, 2);
    expect(w.unit).toBe('mm');
    expect(w.source?.docId).toBe('IPC-2221B'); // E-2 来源可追溯
  });

  it('双标准并存：外层公式法与内层公式法结果不同（FR-A-4）', () => {
    const run = runCalculation(
      traceCurrentSpec,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { modelIds: ['ipc2221_external', 'ipc2221_internal'] },
    );
    const external = run.results.find((r) => r.modelId === 'ipc2221_external')!;
    const internal = run.results.find((r) => r.modelId === 'ipc2221_internal')!;
    expect(internal.outputs.w!.value).toBeGreaterThan(external.outputs.w!.value * 2);
  });

  it('铜厚改为 2oz 后线宽变小（验收 1 后半：方向正确）', () => {
    const run1oz = runCalculation(
      traceCurrentSpec,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { modelIds: ['ipc2221_external'] },
    );
    const run2oz = runCalculation(
      traceCurrentSpec,
      { I: '3 A', dT: '10 K', cu: '2 oz' },
      { modelIds: ['ipc2221_external'] },
    );
    expect(run2oz.results[0]!.outputs.w!.value).toBeLessThan(run1oz.results[0]!.outputs.w!.value);
  });

  it('反向求解：给定 w=1.368mm 求 I ≈ 3A（FR-A-3）', () => {
    const run = runCalculation(
      traceCurrentSpec,
      { w: '1.368 mm', dT: '10 K', cu: '1 oz' },
      { target: 'I', modelIds: ['ipc2221_external'] },
    );
    const I = run.results[0]!.outputs.I!;
    expect(I.value).toBeCloseTo(3, 1);
  });

  it('可行域：计算线宽 vs 工厂最小线宽 → 不可制造并高亮冲突（验收 2）', () => {
    // 0.5A/10K/1oz 外层 → w≈0.116mm，≥ 工厂 0.10mm → 可制造
    const run = runCalculation(
      traceCurrentSpec,
      { I: '0.5 A', dT: '10 K', cu: '1 oz', min_width: '0.1 mm' },
      { modelIds: ['ipc2221_external'] },
    );
    const r = run.results[0]!;
    expect(r.verdict.status).toBe('manufacturable');
    // 1A/1K/0.25oz 外层 → w≈4.86mm，< 工厂 5mm → 不可制造
    const run2 = runCalculation(
      traceCurrentSpec,
      { I: '1 A', dT: '1 K', cu: '0.25 oz', min_width: '5 mm' },
      { modelIds: ['ipc2221_external'] },
    );
    expect(run2.results[0]!.verdict.status).toBe('not-manufacturable');
    expect(run2.results[0]!.verdict.conflicts[0]!.constraintId).toBe('min_width_ok');
  });

  it('A-10：结果携带数字代入行', () => {
    const run = runCalculation(
      traceCurrentSpec,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { modelIds: ['ipc2221_external'] },
    );
    expect(run.results[0]!.substituted).toContain('3');
    expect(run.results[0]!.substituted).toContain('0.048');
  });

  it('量纲不匹配输入直接报错（A-1）', () => {
    expect(() =>
      runCalculation(
        traceCurrentSpec,
        { I: '3 mm', dT: '10 K', cu: '1 oz' },
        { modelIds: ['ipc2221_external'] },
      ),
    ).toThrow(/量纲不兼容/);
  });

  it('温升 ΔT 不允许用 °C（温差不能用绝对温度偏移换算）', () => {
    expect(() =>
      runCalculation(
        traceCurrentSpec,
        { I: '3 A', dT: '10 °C', cu: '1 oz' },
        { modelIds: ['ipc2221_external'] },
      ),
    ).toThrow(/不允许使用单位/);
  });
});
