/**
 * 走线电阻 / 压降 / 功耗扩展计算（纯函数，便于单独校验）。
 * 铜厚按 oz 声明，1 oz = 0.035 mm（与 IPC-2221 的 1.378 mil 一致）。
 */
export interface TraceExtrasResult {
  areaMm2: number;
  resistance: number;
  drop: number;
  power: number;
}

/** 铜厚按 oz 声明，1oz = 0.035mm（与 IPC-2221 的 1.378mil 一致）。 */
export const MM_PER_OZ = 0.035;

/** 由线宽、铜厚（mm）、走线长度、电阻率与电流计算单位走线电阻等参数。 */
export function computeTraceExtras(
  widthMm: number,
  thicknessMm: number,
  lengthMm: number,
  rho: number,
  currentA: number,
): TraceExtrasResult | null {
  if (
    [widthMm, thicknessMm, lengthMm, rho, currentA].some((v) => !Number.isFinite(v)) ||
    widthMm <= 0 ||
    thicknessMm <= 0 ||
    lengthMm <= 0 ||
    rho <= 0 ||
    currentA < 0
  ) {
    return null;
  }
  const areaMm2 = widthMm * thicknessMm;
  const resistance = (rho * (lengthMm / 1000)) / (areaMm2 * 1e-6);
  return {
    areaMm2,
    resistance,
    drop: currentA * resistance,
    power: currentA * currentA * resistance,
  };
}
