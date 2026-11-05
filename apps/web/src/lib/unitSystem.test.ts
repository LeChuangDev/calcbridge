import { describe, expect, it } from 'vitest';
import {
  areaUnit,
  convertLengthString,
  convertLongLengthString,
  formatArea,
  formatLength,
  formatLongLength,
  fromMillimetres,
  lengthUnit,
  longLengthUnit,
  toMillimetres,
} from './unitSystem';

describe('全局单位制', () => {
  it('单位映射', () => {
    expect(lengthUnit('metric')).toBe('mm');
    expect(lengthUnit('imperial')).toBe('mil');
    expect(longLengthUnit('metric')).toBe('m');
    expect(longLengthUnit('imperial')).toBe('ft');
    expect(areaUnit('metric')).toBe('mm²');
    expect(areaUnit('imperial')).toBe('mil²');
  });

  it('mm / mil 换算与显示', () => {
    expect(toMillimetres(15.748, 'mil')).toBeCloseTo(0.3999992, 7);
    expect(fromMillimetres(0.4, 'mil')).toBeCloseTo(15.748031, 5);
    expect(formatLength(0.4, 'metric')).toBe('0.4 mm');
    expect(formatLength(0.4, 'imperial')).toBe('15.748 mil');
  });

  it('m / ft 换算与显示', () => {
    expect(formatLongLength(10, 'metric')).toBe('10 m');
    expect(formatLongLength(10, 'imperial')).toBe('32.808 ft');
    expect(convertLongLengthString('10', 'metric', 'imperial')).toBe('32.808');
    expect(convertLongLengthString('32.808', 'imperial', 'metric')).toBe('10');
  });

  it('面积 mm² / mil² 显示', () => {
    expect(formatArea(1, 'metric')).toBe('1 mm²');
    expect(formatArea(1, 'imperial')).toBe('1550.003 mil²');
  });

  it('长度输入切换保持物理值并保留非法输入', () => {
    expect(convertLengthString('0.4', 'metric', 'imperial')).toBe('15.748');
    expect(convertLengthString('15.748', 'imperial', 'metric')).toBe('0.4');
    expect(convertLengthString('', 'metric', 'imperial')).toBe('');
    expect(convertLengthString('abc', 'metric', 'imperial')).toBe('abc');
  });
});
