/**
 * IEC 60062 色环编码数据与解码纯函数。
 * 4 环：两位有效数字 + 乘数 + 精度；5 环：三位有效数字 + 乘数 + 精度。
 */

export interface ColorDef {
  id: string;
  name: string;
  en: string;
  hex: string;
  digit?: number;
  mult?: number;
  tol?: number;
}

export const COLORS: ColorDef[] = [
  { id: 'black', name: '黑', en: 'Black', hex: '#20242a', digit: 0, mult: 1 },
  { id: 'brown', name: '棕', en: 'Brown', hex: '#7a4a21', digit: 1, mult: 10, tol: 1 },
  { id: 'red', name: '红', en: 'Red', hex: '#d0342c', digit: 2, mult: 100, tol: 2 },
  { id: 'orange', name: '橙', en: 'Orange', hex: '#e07b1a', digit: 3, mult: 1e3 },
  { id: 'yellow', name: '黄', en: 'Yellow', hex: '#f2d33b', digit: 4, mult: 1e4 },
  { id: 'green', name: '绿', en: 'Green', hex: '#2e9e5b', digit: 5, mult: 1e5, tol: 0.5 },
  { id: 'blue', name: '蓝', en: 'Blue', hex: '#2f6fd0', digit: 6, mult: 1e6, tol: 0.25 },
  { id: 'violet', name: '紫', en: 'Violet', hex: '#7b4bc4', digit: 7, mult: 1e7, tol: 0.1 },
  { id: 'gray', name: '灰', en: 'Gray', hex: '#8b949e', digit: 8, mult: 1e8, tol: 0.05 },
  { id: 'white', name: '白', en: 'White', hex: '#f2f4f6', digit: 9, mult: 1e9 },
  { id: 'gold', name: '金', en: 'Gold', hex: '#c9a227', mult: 0.1, tol: 5 },
  { id: 'silver', name: '银', en: 'Silver', hex: '#b8bec4', mult: 0.01, tol: 10 },
];

export const MULT_LABEL: Record<string, string> = {
  black: '1',
  brown: '10',
  red: '100',
  orange: '1k',
  yellow: '10k',
  green: '100k',
  blue: '1M',
  violet: '10M',
  gray: '100M',
  white: '1G',
  gold: '0.1',
  silver: '0.01',
};

export const DIGIT_COLORS = COLORS.filter((color) => color.digit !== undefined);
export const MULT_COLORS = COLORS.filter((color) => color.mult !== undefined);
export const TOL_STD = ['gold', 'silver'];
export const TOL_PREC = ['brown', 'red', 'green', 'blue', 'violet', 'gray'];

export function colorById(id: string): ColorDef {
  return COLORS.find((color) => color.id === id) ?? COLORS[0]!;
}

export interface ColorCodeInput {
  bands: 4 | 5;
  d1: string;
  d2: string;
  d3?: string;
  mult: string;
  tol: string;
}

export interface ColorCodeResult {
  /** Ω */
  resistance: number;
  /** % */
  tolerancePct: number;
  /** Ω */
  min: number;
  /** Ω */
  max: number;
  /** 两位/三位有效数字组成的基数 */
  base: number;
}

/** 解码色环组合；颜色 id 无效时按黑色兜底，与面板的历史行为一致。 */
export function decodeColorCode(input: ColorCodeInput): ColorCodeResult {
  const c1 = colorById(input.d1);
  const c2 = colorById(input.d2);
  const c3 = colorById(input.d3 ?? 'black');
  const cm = colorById(input.mult);
  const ct = colorById(input.tol);

  const base =
    input.bands === 4
      ? (c1.digit ?? 0) * 10 + (c2.digit ?? 0)
      : (c1.digit ?? 0) * 100 + (c2.digit ?? 0) * 10 + (c3.digit ?? 0);
  const resistance = base * (cm.mult ?? 1);
  const tolerancePct = ct.tol ?? 20;
  return {
    resistance,
    tolerancePct,
    min: resistance * (1 - tolerancePct / 100),
    max: resistance * (1 + tolerancePct / 100),
    base,
  };
}
