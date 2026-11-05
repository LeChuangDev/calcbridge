/**
 * 过孔页单位制：公制 mm，英制长度 mil、镀层 oz。
 * 内部计算统一用 mm；oz 与 mm 的换算复用内核 Quantity（1 oz = 35 µm）。
 */
import { Quantity } from '@calcbridge/core';

export type ViaUnitSystem = 'metric' | 'imperial';
export type ViaLengthUnit = 'mm' | 'mil';
export type ViaPlatingUnit = 'mm' | 'oz';
export type ViaMeasurementUnit = ViaLengthUnit | ViaPlatingUnit;
export type ViaGeometryKey = 'hole' | 'plating' | 'length' | 'pad';

export interface ViaGeometryInput {
  hole: string;
  plating: string;
  length: string;
  pad: string;
}

export interface ViaGeometryMm {
  holeMm: number;
  platingMm: number;
  lengthMm: number;
  padMm: number;
}

export const GEOMETRY_KEYS: ViaGeometryKey[] = ['hole', 'plating', 'length', 'pad'];

export function lengthUnit(system: ViaUnitSystem): ViaLengthUnit {
  return system === 'imperial' ? 'mil' : 'mm';
}

export function platingUnit(system: ViaUnitSystem): ViaPlatingUnit {
  return system === 'imperial' ? 'oz' : 'mm';
}

export function geometryUnit(key: ViaGeometryKey, system: ViaUnitSystem): ViaMeasurementUnit {
  return key === 'plating' ? platingUnit(system) : lengthUnit(system);
}

export function fromMillimetres(valueMm: number, unit: ViaMeasurementUnit): number {
  return new Quantity(valueMm, 'mm').to(unit).value;
}

export function toMillimetres(value: number, unit: ViaMeasurementUnit): number {
  return new Quantity(value, unit).to('mm').value;
}

/** mm 保留 4 位，mil/oz 保留 3 位；仍能保证往返不产生可见漂移。 */
function fixed(value: number, unit: ViaMeasurementUnit): string {
  return Number(value.toFixed(unit === 'mm' ? 4 : 3)).toString();
}

export function formatMeasurementValue(valueMm: number, unit: ViaMeasurementUnit): string {
  if (!Number.isFinite(valueMm)) return '—';
  return fixed(fromMillimetres(valueMm, unit), unit);
}

export function formatMeasurement(valueMm: number, unit: ViaMeasurementUnit): string {
  if (!Number.isFinite(valueMm)) return '—';
  return `${formatMeasurementValue(valueMm, unit)} ${unit}`;
}

/** 按字段类型输出带单位的标注，如 "15.748 mil"、"1 oz"。 */
export function formatViaMeasurement(
  valueMm: number,
  key: ViaGeometryKey,
  system: ViaUnitSystem,
): string {
  return formatMeasurement(valueMm, geometryUnit(key, system));
}

/** 切换单位制时转换已输入的四项几何值；空值/非法值原样保留。 */
export function convertGeometryForm(
  form: ViaGeometryInput,
  from: ViaUnitSystem,
  to: ViaUnitSystem,
): ViaGeometryInput {
  const out = { ...form };
  for (const key of GEOMETRY_KEYS) {
    const raw = form[key].trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const fromUnit = geometryUnit(key, from);
    const toUnit = geometryUnit(key, to);
    out[key] = fixed(fromMillimetres(toMillimetres(value, fromUnit), toUnit), toUnit);
  }
  return out;
}

function rawToMm(raw: string, unit: ViaMeasurementUnit): number {
  const text = raw.trim();
  if (!text) return Number.NaN;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return toMillimetres(value, unit);
}

/** 当前单位制下的输入 → 求解器需要的 mm 值。 */
export function geometryToMillimetres(
  form: ViaGeometryInput,
  system: ViaUnitSystem,
): ViaGeometryMm {
  const length = lengthUnit(system);
  const plating = platingUnit(system);

  return {
    holeMm: rawToMm(form.hole, length),
    platingMm: rawToMm(form.plating, plating),
    lengthMm: rawToMm(form.length, length),
    padMm: rawToMm(form.pad, length),
  };
}
