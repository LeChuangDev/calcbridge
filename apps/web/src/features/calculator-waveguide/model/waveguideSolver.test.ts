import { describe, expect, it } from 'vitest';
import { solveWaveguide } from '@/features/calculator-waveguide/model/waveguideSolver';

describe('矩形波导 TE10', () => {
  it('WR-90 / 10GHz 的截止与导波波长', () => {
    const r = solveWaveguide({ aMm: 22.86, freqGHz: 10 }).result;
    expect(r).not.toBeNull();
    expect(r!.fcGHz).toBeCloseTo(6.557, 2);
    expect(r!.lambda0Mm).toBeCloseTo(29.979, 1);
    expect(r!.lambdaGMm).toBeCloseTo(39.75, 0);
    expect(r!.singleMode).toBe(true);
  });

  it('10GHz 时相速/群速与 TE 波阻抗关系正确', () => {
    const r = solveWaveguide({ aMm: 22.86, freqGHz: 10 }).result!;
    expect(r.vpOverC).toBeCloseTo(1.326, 2);
    expect(r.vgOverC).toBeCloseTo(0.754, 2);
    expect(r.zteOhm).toBeCloseTo(498.97, 1);
    expect(r.vpOverC * r.vgOverC).toBeCloseTo(1, 10);
  });

  it('低于截止频率应报错', () => {
    const r = solveWaveguide({ aMm: 22.86, freqGHz: 5 });
    expect(r.result).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
