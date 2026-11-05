/**
 * 走线熔断估算（绝热能量平衡，按单位长度计算）。
 *
 * 单位长度：
 *   m' = w·h·ρ_Cu
 *   E_req = m'·(cp·ΔT + Lf)
 *   R' = ρ_e(T_avg)/(w·h)
 *   E_in = I²·R'·t
 * ΔT = T_melt - T_ambient；长度在能量与功率中同时出现，因此结果与长度无关。
 */

export interface FuseInput {
  ambientC: number;
  meltC: number;
  widthMm: number;
  thicknessMm: number;
  currentA: number;
  timeS: number;
}

export interface FuseResult {
  /** Ω/mm */
  resistancePerMm: number;
  /** J/mm */
  energyRequired: number;
  /** J/mm */
  energyDelivered: number;
  /** 施加能量 / 所需能量 */
  margin: number;
  /** s */
  meltTimeS: number;
  /** A，在给定时间内达到熔化能量所需的最小电流 */
  fusingCurrentA: number;
  melt: boolean;
}

const DENSITY_G_MM3 = 8.96e-3;
const CP_J_GK = 0.385;
const LF_J_G = 205;
const RHO20_OHM_MM = 1.72e-5;
const ALPHA_PER_K = 0.00393;

export function solveFuse(input: FuseInput): { result: FuseResult | null; error?: string } {
  const { ambientC, meltC, widthMm, thicknessMm, currentA, timeS } = input;
  if (
    [ambientC, meltC, widthMm, thicknessMm, currentA, timeS].some((v) => !Number.isFinite(v)) ||
    widthMm <= 0 ||
    thicknessMm <= 0 ||
    currentA <= 0 ||
    timeS <= 0
  ) {
    return { result: null, error: '宽度、铜厚、电流与时间必须为正数。' };
  }
  const dT = meltC - ambientC;
  if (dT <= 0) {
    return { result: null, error: '熔点必须高于环境温度。' };
  }

  const area = widthMm * thicknessMm;
  const massPerMm = area * DENSITY_G_MM3;
  const energyRequired = massPerMm * (CP_J_GK * dT + LF_J_G);

  const avgC = (ambientC + meltC) / 2;
  const rhoAvg = RHO20_OHM_MM * (1 + ALPHA_PER_K * (avgC - 20));
  const resistancePerMm = rhoAvg / area;
  const powerPerMm = currentA * currentA * resistancePerMm;
  const energyDelivered = powerPerMm * timeS;
  const meltTimeS = energyRequired / powerPerMm;
  // 反解 I：E_req = I²·R'·t
  const fusingCurrentA = Math.sqrt(energyRequired / (resistancePerMm * timeS));
  const margin = energyDelivered / energyRequired;

  return {
    result: {
      resistancePerMm,
      energyRequired,
      energyDelivered,
      margin,
      meltTimeS,
      fusingCurrentA,
      melt: margin >= 1,
    },
  };
}
