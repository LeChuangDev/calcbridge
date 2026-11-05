/**
 * 全局单位制：公制 / 英制。
 * 目前用于长度与铜厚相关字段；电流、电压、阻抗、频率等电气单位保持 SI。
 * 换算统一通过内核 Quantity，避免各页面各写一套系数。
 */
import { Quantity } from '@calcbridge/core';

export type UnitSystem = 'metric' | 'imperial';
export type LengthUnit = 'mm' | 'mil';
export type LongLengthUnit = 'm' | 'ft';
export type AreaUnit = 'mm²' | 'mil²';

export function lengthUnit(system: UnitSystem): LengthUnit {
  return system === 'imperial' ? 'mil' : 'mm';
}

export function longLengthUnit(system: UnitSystem): LongLengthUnit {
  return system === 'imperial' ? 'ft' : 'm';
}

export function areaUnit(system: UnitSystem): AreaUnit {
  return system === 'imperial' ? 'mil²' : 'mm²';
}

function formatted(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toFixed(digits)).toString();
}

/* ── 短长度：mm / mil ───────────────────────────────── */

export function toMillimetres(value: number, unit: LengthUnit): number {
  return new Quantity(value, unit).to('mm').value;
}

export function fromMillimetres(valueMm: number, unit: LengthUnit): number {
  return new Quantity(valueMm, 'mm').to(unit).value;
}

export function formatLengthValue(valueMm: number, system: UnitSystem): string {
  const unit = lengthUnit(system);
  return formatted(fromMillimetres(valueMm, unit), unit === 'mm' ? 4 : 3);
}

export function formatLength(valueMm: number, system: UnitSystem): string {
  const unit = lengthUnit(system);
  return `${formatLengthValue(valueMm, system)} ${unit}`;
}

export function convertLengthString(raw: string, from: UnitSystem, to: UnitSystem): string {
  const text = raw.trim();
  if (!text) return raw;
  const value = Number(text);
  if (!Number.isFinite(value)) return raw;
  const fromUnit = lengthUnit(from);
  const toUnit = lengthUnit(to);
  const mm = toMillimetres(value, fromUnit);
  return formatted(fromMillimetres(mm, toUnit), toUnit === 'mm' ? 4 : 3);
}

/* ── 长长度：m / ft ─────────────────────────────────── */

export function toMetres(value: number, unit: LongLengthUnit): number {
  return new Quantity(value, unit).to('m').value;
}

export function fromMetres(valueM: number, unit: LongLengthUnit): number {
  return new Quantity(valueM, 'm').to(unit).value;
}

export function formatLongLengthValue(valueM: number, system: UnitSystem): string {
  return formatted(fromMetres(valueM, longLengthUnit(system)), 3);
}

export function formatLongLength(valueM: number, system: UnitSystem): string {
  const unit = longLengthUnit(system);
  return `${formatLongLengthValue(valueM, system)} ${unit}`;
}

export function convertLongLengthString(raw: string, from: UnitSystem, to: UnitSystem): string {
  const text = raw.trim();
  if (!text) return raw;
  const value = Number(text);
  if (!Number.isFinite(value)) return raw;
  const fromUnit = longLengthUnit(from);
  const toUnit = longLengthUnit(to);
  return formatted(fromMetres(toMetres(value, fromUnit), toUnit), 3);
}

/* ── 面积：mm² / mil² ───────────────────────────────── */

export function toSquareMillimetres(value: number, unit: AreaUnit): number {
  return new Quantity(value, unit === 'mm²' ? 'mm2' : 'mil2').to('mm2').value;
}

export function fromSquareMillimetres(valueMm2: number, unit: AreaUnit): number {
  return new Quantity(valueMm2, 'mm2').to(unit === 'mm²' ? 'mm2' : 'mil2').value;
}

export function formatAreaValue(valueMm2: number, system: UnitSystem): string {
  const unit = areaUnit(system);
  return formatted(fromSquareMillimetres(valueMm2, unit), unit === 'mm²' ? 4 : 3);
}

export function formatArea(valueMm2: number, system: UnitSystem): string {
  return `${formatAreaValue(valueMm2, system)} ${areaUnit(system)}`;
}
