/**
 * 无源电阻衰减器设计（Pi / T），支持 Zin ≠ Zout。
 *
 * Pi 网络：R1 输入并联、R2 串联、R3 输出并联。
 * T 网络：R1 输入串联、R2 并联、R3 输出串联。
 *
 * 设计方程（Pi）：
 *   K = 10^(A/20), gS = 1/Zin, gL = 1/Zout
 *   G2 = 2·gS·gL / (K·gS - gL/K)
 *   G1 = gS - G2 + G2/K
 *   G3 = (K-1)·G2 - gL
 * T 网络由 Pi 网络经 Y-Δ 变换得到，二者对同一端接条件等效。
 */

export type RfType = 'pi' | 't';

export interface RfValues {
  r1: number;
  r2: number;
  r3: number;
}

export interface RfDesign {
  values: RfValues | null;
  error?: string;
  k: number;
}

export interface RfResponse {
  zin: number;
  zout: number;
  attenuationDb: number;
}

function parallel(a: number, b: number): number {
  return (a * b) / (a + b);
}

export function designRf(type: RfType, attenuationDb: number, zin: number, zout: number): RfDesign {
  const k = Math.pow(10, attenuationDb / 20);
  if (
    !Number.isFinite(attenuationDb) ||
    attenuationDb <= 0 ||
    !Number.isFinite(zin) ||
    zin <= 0 ||
    !Number.isFinite(zout) ||
    zout <= 0
  ) {
    return { values: null, error: '衰减量与阻抗必须为正数。', k };
  }

  const gs = 1 / zin;
  const gl = 1 / zout;
  const denom = k * gs - gl / k;
  if (denom <= 0) {
    return { values: null, error: '该衰减量与阻抗组合无法用无源 Pi/T 网络实现。', k };
  }

  const g2 = (2 * gl * gs) / denom;
  const g3 = (k - 1) * g2 - gl;
  const g1 = gs - g2 + g2 / k;

  if (g1 <= 0 || g2 <= 0 || g3 <= 0) {
    return { values: null, error: '计算出的电阻为非正数，请调整衰减量或阻抗。', k };
  }

  const pi: RfValues = { r1: 1 / g1, r2: 1 / g2, r3: 1 / g3 };
  if (type === 'pi') {
    return { values: pi, k };
  }

  const sum = pi.r1 + pi.r2 + pi.r3;
  const t: RfValues = {
    r1: (pi.r1 * pi.r2) / sum,
    r2: (pi.r1 * pi.r3) / sum,
    r3: (pi.r2 * pi.r3) / sum,
  };
  return { values: t, k };
}

/** 用于校验：在给定源/负载阻抗下计算输入、输出阻抗与实际衰减。 */
export function rfResponse(
  type: RfType,
  values: RfValues,
  zinSource: number,
  zoutLoad: number,
): RfResponse {
  const { r1, r2, r3 } = values;
  if (type === 'pi') {
    const zp = parallel(r3, zoutLoad);
    const zin = parallel(r1, r2 + zp);
    const zout = parallel(r3, r2 + parallel(r1, zinSource));
    const ratio = zp / (r2 + zp);
    return { zin, zout, attenuationDb: -20 * Math.log10(ratio) };
  }

  const zp = parallel(r2, r3 + zoutLoad);
  const zin = r1 + zp;
  const zout = r3 + parallel(r2, r1 + zinSource);
  const ratio = (zp / (r1 + zp)) * (zoutLoad / (r3 + zoutLoad));
  return { zin, zout, attenuationDb: -20 * Math.log10(ratio) };
}
