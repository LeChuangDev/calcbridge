import { describe, expect, it } from 'vitest';
import { UNIT_CATEGORIES, convertUnit, findCategory, findUnit } from '../src/unit_converter/units';

function unit(categoryId: string, unitId: string) {
  const category = findCategory(categoryId);
  if (!category) throw new Error(`缺少类别 ${categoryId}`);
  const target = findUnit(category, unitId);
  if (!target) throw new Error(`缺少单位 ${unitId}`);
  return target;
}

describe('单位换算目录与精确换算', () => {
  it('长度：1 in = 25.4 mm，1 mil = 0.0254 mm', () => {
    expect(convertUnit(1, unit('length', 'in'), unit('length', 'mm'))).toBeCloseTo(25.4, 12);
    expect(convertUnit(1, unit('length', 'mil'), unit('length', 'mm'))).toBeCloseTo(0.0254, 12);
  });

  it('质量：1 oz = 28.349523125 g', () => {
    expect(convertUnit(1, unit('mass', 'oz'), unit('mass', 'g'))).toBeCloseTo(28.349523125, 9);
  });

  it('压力：1 atm = 101325 Pa', () => {
    expect(convertUnit(1, unit('pressure', 'atm'), unit('pressure', 'Pa'))).toBeCloseTo(101325, 6);
  });

  it('力：1 kgf = 9.80665 N', () => {
    expect(convertUnit(1, unit('force', 'kgf'), unit('force', 'N'))).toBeCloseTo(9.80665, 9);
  });

  it('温度：32 °F = 0 °C，100 °C = 212 °F', () => {
    expect(
      convertUnit(32, unit('temperature', 'fahrenheit'), unit('temperature', 'celsius')),
    ).toBeCloseTo(0, 9);
    expect(
      convertUnit(100, unit('temperature', 'celsius'), unit('temperature', 'fahrenheit')),
    ).toBeCloseTo(212, 9);
  });

  it('体积与能量：1 gal = 3.785411784 L，1 kWh = 3.6e6 J', () => {
    expect(convertUnit(1, unit('volume', 'gal'), unit('volume', 'L'))).toBeCloseTo(3.785411784, 9);
    expect(convertUnit(1, unit('energy', 'kWh'), unit('energy', 'J'))).toBeCloseTo(3.6e6, 3);
  });

  it('未知类别返回 undefined', () => {
    expect(findCategory('not-a-category')).toBeUndefined();
  });

  it('每个类别至少有 2 个单位', () => {
    for (const category of UNIT_CATEGORIES) {
      expect(category.units.length, category.id).toBeGreaterThanOrEqual(2);
    }
  });
});
