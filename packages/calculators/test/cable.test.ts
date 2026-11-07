import { describe, expect, it } from 'vitest';
import { solveCable } from '../src/cable/solver';

describe('线缆电压降选型', () => {
  it('12V / 5% / 1A / 10m 铜线应选 0.75mm²', () => {
    const r = solveCable({
      voltageV: 12,
      dropPct: 5,
      currentA: 1,
      lengthM: 10,
      material: 'cu',
    }).result;
    expect(r).not.toBeNull();
    expect(r!.requiredArea).toBeCloseTo(0.5833, 3);
    expect(r!.selectedArea).toBe(0.75);
    expect(r!.voltageDrop).toBeCloseTo(0.4667, 3);
    expect(r!.actualDropPct).toBeCloseTo(3.889, 2);
  });

  it('24V / 3% / 5A / 20m 铜线应选 6mm²', () => {
    const r = solveCable({
      voltageV: 24,
      dropPct: 3,
      currentA: 5,
      lengthM: 20,
      material: 'cu',
    }).result;
    expect(r).not.toBeNull();
    expect(r!.requiredArea).toBeCloseTo(4.861, 2);
    expect(r!.selectedArea).toBe(6);
  });

  it('铝线所需截面应大于铜线', () => {
    const cu = solveCable({
      voltageV: 12,
      dropPct: 5,
      currentA: 10,
      lengthM: 10,
      material: 'cu',
    }).result!;
    const al = solveCable({
      voltageV: 12,
      dropPct: 5,
      currentA: 10,
      lengthM: 10,
      material: 'al',
    }).result!;
    expect(al.requiredArea).toBeGreaterThan(cu.requiredArea);
  });
});
