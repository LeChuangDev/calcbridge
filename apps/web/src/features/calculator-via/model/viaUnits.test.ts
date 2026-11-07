import { describe, expect, it } from 'vitest';
import {
  convertGeometryForm,
  formatMeasurement,
  formatMeasurementValue,
  formatViaMeasurement,
  geometryToMillimetres,
  lengthUnit,
  platingUnit,
  type ViaGeometryInput,
} from '@/features/calculator-via/model/viaUnits';

const metricForm: ViaGeometryInput = {
  hole: '0.4',
  plating: '0.035',
  length: '1.6',
  pad: '0.6',
};

describe('过孔页单位换算', () => {
  it('公制/英制单位映射', () => {
    expect(lengthUnit('metric')).toBe('mm');
    expect(lengthUnit('imperial')).toBe('mil');
    expect(platingUnit('metric')).toBe('mm');
    expect(platingUnit('imperial')).toBe('oz');
  });

  it('mm 保留 4 位、mil/oz 保留 3 位并去除尾零', () => {
    expect(formatMeasurement(0.4, 'mil')).toBe('15.748 mil');
    expect(formatMeasurement(0.05, 'mil')).toBe('1.969 mil');
    expect(formatMeasurement(0.035, 'oz')).toBe('1 oz');
    expect(formatMeasurementValue(0.1, 'mil')).toBe('3.937');
  });

  it('按字段类型选择显示单位', () => {
    expect(formatViaMeasurement(0.4, 'hole', 'imperial')).toBe('15.748 mil');
    expect(formatViaMeasurement(1.6, 'length', 'imperial')).toBe('62.992 mil');
    expect(formatViaMeasurement(0.035, 'plating', 'imperial')).toBe('1 oz');
    expect(formatViaMeasurement(0.035, 'plating', 'metric')).toBe('0.035 mm');
  });

  it('切换单位制时保持几何量的物理值', () => {
    const imperial = convertGeometryForm(metricForm, 'metric', 'imperial');

    expect(imperial).toEqual({
      hole: '15.748',
      plating: '1',
      length: '62.992',
      pad: '23.622',
    });

    const back = convertGeometryForm(imperial, 'imperial', 'metric');
    expect(back).toEqual(metricForm);
  });

  it('切换单位制时保留空值与非法输入', () => {
    const partial = convertGeometryForm(
      { hole: '', plating: 'abc', length: '1.6', pad: '0.6' },
      'metric',
      'imperial',
    );

    expect(partial.hole).toBe('');
    expect(partial.plating).toBe('abc');
    expect(partial.length).toBe('62.992');
    expect(partial.pad).toBe('23.622');
  });

  it('公制输入直接转换为 mm', () => {
    const mm = geometryToMillimetres(metricForm, 'metric');

    expect(mm.holeMm).toBeCloseTo(0.4, 10);
    expect(mm.platingMm).toBeCloseTo(0.035, 10);
    expect(mm.lengthMm).toBeCloseTo(1.6, 10);
    expect(mm.padMm).toBeCloseTo(0.6, 10);
  });

  it('英制输入转换为 mm，空值返回 NaN', () => {
    const mm = geometryToMillimetres(
      { hole: '15.748', plating: '1', length: '62.992', pad: '23.622' },
      'imperial',
    );

    expect(mm.holeMm).toBeCloseTo(0.3999992, 6);
    expect(mm.platingMm).toBeCloseTo(0.035, 10);
    expect(mm.lengthMm).toBeCloseTo(1.5999968, 6);
    expect(mm.padMm).toBeCloseTo(0.5999988, 6);

    const missing = geometryToMillimetres({ ...metricForm, hole: '', pad: 'abc' }, 'imperial');
    expect(Number.isNaN(missing.holeMm)).toBe(true);
    expect(Number.isNaN(missing.padMm)).toBe(true);
  });
});
