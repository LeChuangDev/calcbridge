/**
 * UI ↔ 计算内核 的薄适配层。
 * 所有计算仍由 @calcbridge/core 完成，本层只做：输入序列化、兼容单位枚举、结果显示单位换算。
 */
import { Quantity, unitByDim, type NamedInputs, type VariableSpec } from '@calcbridge/core';

export interface InputState {
  /** 数值文本（可为空 = 未提供） */
  v: string;
  /** 单位 id（dimensions.ts 的 UNITS） */
  unit: string;
}

export function emptyInputs(vs: VariableSpec): InputState {
  return { v: vs.default !== undefined ? String(vs.default) : '', unit: vs.unit };
}

/** 序列化为内核 NamedInputs（"3 A" 形式） */
export function buildInputs(st: Record<string, InputState>): NamedInputs {
  const out: NamedInputs = {};
  for (const [k, s] of Object.entries(st)) {
    const t = s.v.trim();
    if (t !== '') out[k] = `${t} ${s.unit}`;
  }
  return out;
}

/** 铜厚常用的兼容单位；oz 与其他长度单位同量纲，但不应出现在普通长度变量中。 */
const COPPER_THICKNESS_UNITS = new Set(['oz', 'mm', 'um', 'mil']);

/** 某变量可选的显示/输入单位（与其声明量纲兼容） */
export function compatibleUnits(vs: VariableSpec) {
  const dims = new Quantity(vs.default ?? 1, vs.unit).dims;
  const units = unitByDim(dims);
  if (vs.units) {
    const allow = new Set(vs.units);
    return units.filter((u) => u.id === vs.unit || allow.has(u.id));
  }
  if (vs.unit === 'oz') return units.filter((u) => COPPER_THICKNESS_UNITS.has(u.id));
  return units.filter((u) => u.id !== 'oz');
}

/** 结果显示单位换算 */
export function convertDisplay(value: number, fromUnit: string, toUnit: string): number {
  return new Quantity(value, fromUnit).to(toUnit).value;
}

export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return Number(v.toPrecision(6)).toString();
}

/**
 * 草稿反序列化：只接受结构与单位白名单都合法的 InputState，否则回退默认值。
 * 草稿来自 localStorage，可能是旧版本或手工篡改的数据，必须逐字段校验。
 */
export function draftInput(
  saved: unknown,
  fallback: InputState,
  allowedUnits?: readonly string[],
): InputState {
  if (
    saved &&
    typeof saved === 'object' &&
    typeof (saved as InputState).v === 'string' &&
    typeof (saved as InputState).unit === 'string' &&
    (!allowedUnits || allowedUnits.includes((saved as InputState).unit))
  ) {
    return saved as InputState;
  }
  return fallback;
}
