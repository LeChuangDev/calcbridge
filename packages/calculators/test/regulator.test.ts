import { describe, expect, it } from 'vitest';
import { runCalculation } from '@calcbridge/core';
import { REGULATOR_SPEC, RESISTOR_SPEC } from '../src';

describe('稳压器（三端可调）', () => {
  it('正向：LM317 典型参数 → 5.036 V', () => {
    const run = runCalculation(REGULATOR_SPEC, {
      Vref: '1.25 V',
      R1: '0.24 kohm',
      R2: '0.72 kohm',
      Iadj: '50 uA',
    });
    expect(run.results[0]!.outputs.Vout!.value).toBeCloseTo(5.036, 4);
  });

  it('反向：给定 Vout=5.036 V 求 R1 ≈ 0.24 kΩ', () => {
    const run = runCalculation(
      REGULATOR_SPEC,
      { Vout: '5.036 V', R2: '0.72 kohm', Vref: '1.25 V', Iadj: '50 uA' },
      { target: 'R1' },
    );
    expect(run.results[0]!.outputs.R1!.value).toBeCloseTo(0.24, 4);
  });

  it('反向：给定 Vout=5.036 V 求 R2 ≈ 0.72 kΩ', () => {
    const run = runCalculation(
      REGULATOR_SPEC,
      { Vout: '5.036 V', R1: '0.24 kohm', Vref: '1.25 V', Iadj: '50 uA' },
      { target: 'R2' },
    );
    expect(run.results[0]!.outputs.R2!.value).toBeCloseTo(0.72, 4);
  });

  it('R1 过小触发警告（可行域 boundary）', () => {
    const run = runCalculation(REGULATOR_SPEC, {
      Vref: '1.25 V',
      R1: '0.05 kohm',
      R2: '0.15 kohm',
      Iadj: '50 uA',
    });
    expect(run.results[0]!.verdict.status).toBe('boundary');
  });
});

describe('电阻计算器', () => {
  it('并联：1k ∥ 2k ≈ 666.67 Ω', () => {
    const run = runCalculation(
      RESISTOR_SPEC,
      { R1: '1 kohm', R2: '2 kohm' },
      { modelIds: ['parallel'] },
    );
    expect(run.results[0]!.outputs.Rp!.value).toBeCloseTo(666.667, 2);
  });

  it('分压：12V 经 1k/2k → 8 V', () => {
    const run = runCalculation(
      RESISTOR_SPEC,
      { Vin: '12 V', R1: '1 kohm', R2: '2 kohm' },
      { modelIds: ['divider'] },
    );
    expect(run.results[0]!.outputs.Vdiv!.value).toBeCloseTo(8, 6);
  });
});
