import { describe, expect, it } from 'vitest';
import { runCalculation } from '../src/solver/solver';
import { impedanceMicrostripSpec } from '@calcbridge/calculators';

describe('受控阻抗计算器（IPC-2141 微带线）', () => {
  it('正向：0.3mm/0.2mm/1oz/FR4 → ≈54Ω', () => {
    const run = runCalculation(
      impedanceMicrostripSpec,
      { w: '0.3 mm', h: '0.2 mm', t: '0.035 mm', Er: '4.2' },
      { modelIds: ['ipc2141_microstrip'] },
    );
    const z0 = run.results[0]!.outputs.Z0!;
    expect(z0.value).toBeCloseTo(53.995, 2);
    expect(z0.unit).toBe('ohm');
    expect(run.results[0]!.verdict.status).toBe('manufacturable');
  });

  it('反向：目标 50Ω → 线宽 ≈ 0.34mm（FR-A-3 求线宽场景）', () => {
    const run = runCalculation(
      impedanceMicrostripSpec,
      { Z0: '50 ohm', h: '0.2 mm', t: '0.035 mm', Er: '4.2' },
      { target: 'w', modelIds: ['ipc2141_microstrip'] },
    );
    const w = run.results[0]!.outputs.w!;
    expect(w.value).toBeCloseTo(0.3395, 2);
  });

  it('撞工艺最小线宽 → 不可制造（验收 2 的阻抗版）', () => {
    // 0.2mm 介质下 45Ω 需要约 0.45mm 线宽；若工厂只支持 0.5mm 起步则相反。
    // 这里直接给工艺下限 0.5mm，线宽 0.3mm → blocker
    const run = runCalculation(
      impedanceMicrostripSpec,
      { w: '0.3 mm', h: '0.2 mm', t: '0.035 mm', Er: '4.2', min_width: '0.5 mm' },
      { modelIds: ['ipc2141_microstrip'] },
    );
    expect(run.results[0]!.verdict.status).toBe('not-manufacturable');
    expect(run.results[0]!.verdict.conflicts[0]!.constraintId).toBe('min_width_ok');
  });

  it('εr 偏差导致阻抗超公差 → 边界（warning，需换叠层）', () => {
    // 用 2.4（高 Dk 板材）计算，Z0 将远低于 50Ω±10%
    const run = runCalculation(
      impedanceMicrostripSpec,
      { w: '0.34 mm', h: '0.2 mm', t: '0.035 mm', Er: '6.0' },
      { modelIds: ['ipc2141_microstrip'] },
    );
    expect(run.results[0]!.verdict.status).toBe('boundary');
    expect(run.results[0]!.verdict.conflicts.some((c) => c.constraintId === 'z0_in_tol')).toBe(
      true,
    );
  });

  it('单位切换：mil 输入线宽也能算（A-1）', () => {
    const run = runCalculation(
      impedanceMicrostripSpec,
      { w: '11.81 mil', h: '7.87 mil', t: '1.378 mil', Er: '4.2' },
      { modelIds: ['ipc2141_microstrip'] },
    );
    // 11.81mil=0.3mm, 7.87mil=0.2mm, 1.378mil=0.035mm
    expect(run.results[0]!.outputs.Z0!.value).toBeCloseTo(53.995, 1);
  });
});
