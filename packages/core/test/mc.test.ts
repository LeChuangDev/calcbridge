import { describe, expect, it } from 'vitest';
import { runMonteCarlo } from '../src/uncertainty/mc';
import { traceCurrentSpec } from '@calcbridge/calculators';

describe('不确定度与敏感度（FR-A-6 / E-3）', () => {
  it('I±10% 时输出 P10 < P50 < P90', () => {
    const mc = runMonteCarlo(
      traceCurrentSpec,
      traceCurrentSpec.models[0]!,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { samples: 2000, seed: 42 },
    );
    expect(mc.p10).toBeLessThan(mc.p50);
    expect(mc.p50).toBeLessThan(mc.p90);
    expect(mc.p50).toBeCloseTo(1.368, 1);
  });

  it('最敏感输入为 I（Spearman 秩相关最高）', () => {
    const mc = runMonteCarlo(
      traceCurrentSpec,
      traceCurrentSpec.models[0]!,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { samples: 500, seed: 7 },
    );
    expect(mc.topSensitivity[0]!.varId).toBe('I');
    expect(mc.topSensitivity[0]!.rho).toBeGreaterThan(0.9);
  });

  it('seed 相同则结果可复现（快照一致性）', () => {
    const a = runMonteCarlo(
      traceCurrentSpec,
      traceCurrentSpec.models[0]!,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { samples: 300, seed: 123 },
    );
    const b = runMonteCarlo(
      traceCurrentSpec,
      traceCurrentSpec.models[0]!,
      { I: '3 A', dT: '10 K', cu: '1 oz' },
      { samples: 300, seed: 123 },
    );
    expect(a.p50).toBe(b.p50);
  });
});
