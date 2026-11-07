import { describe, expect, it } from 'vitest';
import { nearestStandard, solveLedResistor } from '../src/led_resistor/solver';

const base = { vin: 12, vf: 2.1, ifMa: 20, count: 3, series: 'E24' as const };

describe('LED 限流电阻求解', () => {
  it('12V / 3 颗 2.1V / 20mA → 285 Ω', () => {
    const { result, error } = solveLedResistor(base);
    expect(error).toBeUndefined();
    expect(result!.headroomV).toBeCloseTo(5.7, 6);
    expect(result!.requiredOhm).toBeCloseTo(285, 3);
  });

  it('标准值取不小于理论值的最小档，实际电流不大于目标电流', () => {
    const { result } = solveLedResistor(base);
    expect(result!.choice!.value).toBeGreaterThanOrEqual(result!.requiredOhm);
    expect(result!.choice!.currentMa).toBeLessThanOrEqual(base.ifMa);
  });

  it('功耗与额定档：电阻功耗 = 压降²/R，额定按 2 倍裕度', () => {
    const { result } = solveLedResistor(base);
    const c = result!.choice!;
    expect(c.powerW).toBeCloseTo((5.7 * 5.7) / c.value, 6);
    expect(c.suggestedRatingW).toBeGreaterThanOrEqual(c.powerW * 2);
  });

  it('LED 串总功耗与总功耗守恒', () => {
    const { result } = solveLedResistor(base);
    expect(result!.ledPowerW).toBeCloseTo(3 * 2.1 * 0.02, 6);
    expect(result!.totalPowerW).toBeCloseTo(result!.ledPowerW + result!.resistorPowerW, 9);
  });

  it('E12 的标准值不比 E24 更接近（E12 是 E24 子集）', () => {
    const a = solveLedResistor({ ...base, series: 'E12' });
    const b = solveLedResistor({ ...base, series: 'E24' });
    expect(a.result!.choice!.errorPct).toBeLessThanOrEqual(0);
    expect(b.result!.choice!.errorPct).toBeGreaterThanOrEqual(a.result!.choice!.errorPct);
  });

  it('供电不足时报错', () => {
    expect(solveLedResistor({ ...base, vin: 5 }).error).toContain('供电电压');
  });

  it('拒绝非法的颗数与电流', () => {
    expect(solveLedResistor({ ...base, count: 0 }).error).toBeTruthy();
    expect(solveLedResistor({ ...base, count: 1.5 }).error).toBeTruthy();
    expect(solveLedResistor({ ...base, ifMa: 0 }).error).toBeTruthy();
  });

  it('标准值取值：10 Ω 目标给 10 Ω，123 Ω 给 130 Ω', () => {
    expect(nearestStandard(10, 'E24')).toBe(10);
    expect(nearestStandard(123, 'E24')).toBe(130);
    expect(nearestStandard(1, 'E12')).toBe(1);
  });
});
