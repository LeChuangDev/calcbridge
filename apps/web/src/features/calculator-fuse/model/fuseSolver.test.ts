import { describe, expect, it } from 'vitest';
import { solveFuse } from '@/features/calculator-fuse/model/fuseSolver';

const base = {
  ambientC: 25,
  meltC: 1084,
  widthMm: 0.1,
  thicknessMm: 0.035,
  currentA: 10,
  timeS: 0.01,
};

describe('走线熔断估算', () => {
  it('默认参数下 10ms 不足以熔断', () => {
    const r = solveFuse(base).result;
    expect(r).not.toBeNull();
    expect(r!.melt).toBe(false);
    expect(r!.meltTimeS).toBeGreaterThan(0.01);
    expect(r!.margin).toBeLessThan(1);
  });

  it('延长到 20ms 后应熔断', () => {
    const r = solveFuse({ ...base, timeS: 0.02 }).result;
    expect(r).not.toBeNull();
    expect(r!.melt).toBe(true);
    expect(r!.margin).toBeGreaterThan(1);
  });

  it('熔点低于环境温度应报错', () => {
    const r = solveFuse({ ...base, meltC: 20 });
    expect(r.result).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it('10ms 内熔断所需电流约 11.23A，且与熔断时间互为反解', () => {
    const r = solveFuse(base).result!;
    expect(r.fusingCurrentA).toBeCloseTo(11.23, 1);
    expect(r.fusingCurrentA ** 2 * r.resistancePerMm * base.timeS).toBeCloseTo(
      r.energyRequired,
      10,
    );
    // 用该电流代入时，预计熔断时间应等于设定时间
    const atFusing = solveFuse({ ...base, currentA: r.fusingCurrentA }).result!;
    expect(atFusing.meltTimeS).toBeCloseTo(base.timeS, 10);
  });
});
