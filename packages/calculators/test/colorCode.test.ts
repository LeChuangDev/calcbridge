import { describe, expect, it } from 'vitest';
import { COLORS, decodeColorCode } from '../src/color_code/colors';

describe('IEC 60062 色环解码', () => {
  it('4 环 棕-黑-红-金 = 1 kΩ ±5%', () => {
    const r = decodeColorCode({ bands: 4, d1: 'brown', d2: 'black', mult: 'red', tol: 'gold' });
    expect(r.resistance).toBe(1000);
    expect(r.tolerancePct).toBe(5);
    expect(r.min).toBeCloseTo(950, 9);
    expect(r.max).toBeCloseTo(1050, 9);
  });

  it('4 环 黄-紫-棕-金 = 470 Ω ±5%', () => {
    const r = decodeColorCode({ bands: 4, d1: 'yellow', d2: 'violet', mult: 'brown', tol: 'gold' });
    expect(r.resistance).toBe(470);
    expect(r.tolerancePct).toBe(5);
  });

  it('4 环 绿-蓝-黑-金 = 56 Ω ±5%', () => {
    const r = decodeColorCode({ bands: 4, d1: 'green', d2: 'blue', mult: 'black', tol: 'gold' });
    expect(r.resistance).toBe(56);
  });

  it('5 环 棕-黑-黑-棕-棕 = 1 kΩ ±1%', () => {
    const r = decodeColorCode({
      bands: 5,
      d1: 'brown',
      d2: 'black',
      d3: 'black',
      mult: 'brown',
      tol: 'brown',
    });
    expect(r.resistance).toBe(1000);
    expect(r.tolerancePct).toBe(1);
    expect(r.min).toBeCloseTo(990, 9);
    expect(r.max).toBeCloseTo(1010, 9);
  });

  it('5 环 棕-黑-黑-金-金 = 10 Ω ±5%', () => {
    const r = decodeColorCode({
      bands: 5,
      d1: 'brown',
      d2: 'black',
      d3: 'black',
      mult: 'gold',
      tol: 'gold',
    });
    expect(r.resistance).toBe(10);
  });

  it('每个颜色都有名称与十六进制色值', () => {
    for (const color of COLORS) {
      expect(color.name.length).toBeGreaterThan(0);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
