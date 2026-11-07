import { describe, expect, it } from 'vitest';
import { solveSkinDepth } from '@/features/calculator-skin-depth/model/skinDepthSolver';

describe('趋肤深度求解', () => {
  it('铜在 20°C / 1 GHz 的趋肤深度约为 2.09 µm', () => {
    const { result, error } = solveSkinDepth({
      freqHz: 1e9,
      thicknessMm: 0.035,
      widthMm: 0.2,
      tempC: 20,
    });
    expect(error).toBeUndefined();
    expect(result!.skinDepthUm).toBeCloseTo(2.09, 1);
  });

  it('频率升高 100 倍，趋肤深度变为 1/10', () => {
    const a = solveSkinDepth({ freqHz: 1e6, thicknessMm: 0.035, widthMm: 0.2, tempC: 20 });
    const b = solveSkinDepth({ freqHz: 1e8, thicknessMm: 0.035, widthMm: 0.2, tempC: 20 });
    expect(a.result!.skinDepthMm / b.result!.skinDepthMm).toBeCloseTo(10, 2);
  });

  it('交流电阻不小于直流电阻，且比值随频率增大', () => {
    const low = solveSkinDepth({ freqHz: 1e5, thicknessMm: 0.035, widthMm: 0.2, tempC: 20 });
    const high = solveSkinDepth({ freqHz: 1e9, thicknessMm: 0.035, widthMm: 0.2, tempC: 20 });
    expect(low.result!.acDcRatio).toBeGreaterThanOrEqual(1);
    expect(high.result!.acDcRatio).toBeGreaterThan(low.result!.acDcRatio);
  });

  it('临界频率处趋肤深度等于铜厚', () => {
    const { result } = solveSkinDepth({
      freqHz: 1e6,
      thicknessMm: 0.07,
      widthMm: 0.5,
      tempC: 20,
    });
    const atCritical = solveSkinDepth({
      freqHz: result!.criticalFreqHz,
      thicknessMm: 0.07,
      widthMm: 0.5,
      tempC: 20,
    });
    expect(atCritical.result!.skinDepthMm).toBeCloseTo(0.07, 6);
  });

  it('铜厚超过 2δ 时提示加厚无收益', () => {
    const { result } = solveSkinDepth({
      freqHz: 5e9,
      thicknessMm: 0.07,
      widthMm: 0.3,
      tempC: 20,
    });
    expect(result!.thicknessSaturated).toBe(true);
  });

  it('拒绝非正数输入', () => {
    expect(
      solveSkinDepth({ freqHz: 0, thicknessMm: 0.035, widthMm: 0.2, tempC: 20 }).error,
    ).toBeTruthy();
    expect(
      solveSkinDepth({ freqHz: 1e6, thicknessMm: -1, widthMm: 0.2, tempC: 20 }).error,
    ).toBeTruthy();
    expect(
      solveSkinDepth({ freqHz: 1e6, thicknessMm: 0.035, widthMm: 0, tempC: 20 }).error,
    ).toBeTruthy();
  });
});
