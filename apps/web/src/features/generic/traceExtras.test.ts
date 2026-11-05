import { describe, expect, it } from 'vitest';
import { computeTraceExtras } from './traceExtrasSolver';

describe('走线电阻与压降扩展', () => {
  it('外层 0.300387mm / 0.035mm 铜厚 / 20mm 的电阻与截图一致', () => {
    const r = computeTraceExtras(0.300387, 0.035, 20, 1.72e-8, 1);
    expect(r).not.toBeNull();
    expect(r!.areaMm2).toBeCloseTo(0.0105135, 6);
    expect(r!.resistance).toBeCloseTo(0.0327197, 6);
    expect(r!.drop).toBeCloseTo(0.0327197, 6);
    expect(r!.power).toBeCloseTo(0.0327197, 6);
  });

  it('内层 0.781437mm / 0.035mm 铜厚 / 20mm 的电阻与截图一致', () => {
    const r = computeTraceExtras(0.781437, 0.035, 20, 1.72e-8, 1);
    expect(r).not.toBeNull();
    expect(r!.areaMm2).toBeCloseTo(0.0273503, 6);
    expect(r!.resistance).toBeCloseTo(0.0125776, 6);
  });

  it('无效线宽返回 null', () => {
    expect(computeTraceExtras(0, 0.035, 20, 1.72e-8, 1)).toBeNull();
  });
});
