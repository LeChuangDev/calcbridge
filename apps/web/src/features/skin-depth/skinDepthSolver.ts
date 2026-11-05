/**
 * 趋肤深度与高频交流电阻估算（纯函数，便于单独校验）。
 *
 * 模型：
 *   ρ(T) = ρ20 · [1 + α(T − 20)]
 *   δ    = √(ρ / (π·f·μ0·μr))            —— 单侧趋肤近似，μr(Cu) ≈ 1
 *   δeff = δ · (1 − e^(−t/δ))            —— 有效导电厚度
 *   Rac/Rdc = t / δeff
 *   Rac' = ρ / (w · δeff)                —— 单位长度交流电阻
 *
 * 适用：单端走线、参考平面完整、非磁性导体。不含粗糙度、邻近效应与差分耦合。
 */

export interface SkinDepthInput {
  /** Hz */
  freqHz: number;
  /** mm */
  thicknessMm: number;
  /** mm，用于单位长度电阻 */
  widthMm: number;
  /** °C */
  tempC: number;
}

export interface SkinDepthResult {
  /** mm */
  skinDepthMm: number;
  /** µm */
  skinDepthUm: number;
  /** mil */
  skinDepthMil: number;
  /** mm，有效导电厚度 δeff */
  effectiveThicknessMm: number;
  /** Rac / Rdc */
  acDcRatio: number;
  /** Ω/mm */
  acResistancePerMm: number;
  /** Ω/mm */
  dcResistancePerMm: number;
  /** Hz，δ = 铜厚 时的频率；高于此值铜厚不再有直流收益 */
  criticalFreqHz: number;
  /** 铜厚超过 2δ：继续加厚几乎不降交流电阻 */
  thicknessSaturated: boolean;
}

const RHO20_OHM_M = 1.72e-8;
const ALPHA_PER_K = 0.00393;
const MU0 = 4 * Math.PI * 1e-7;
const MM_PER_M = 1000;
const MIL_PER_MM = 39.37007874;

export function solveSkinDepth(input: SkinDepthInput): {
  result: SkinDepthResult | null;
  error?: string;
} {
  const { freqHz, thicknessMm, widthMm, tempC } = input;
  if (
    [freqHz, thicknessMm, widthMm, tempC].some((v) => !Number.isFinite(v)) ||
    freqHz <= 0 ||
    thicknessMm <= 0 ||
    widthMm <= 0
  ) {
    return { result: null, error: '频率、铜厚与线宽必须为正数。' };
  }
  if (tempC < -273.15) {
    return { result: null, error: '温度不能低于绝对零度。' };
  }

  const rho = RHO20_OHM_M * (1 + ALPHA_PER_K * (tempC - 20));
  const skinDepthM = Math.sqrt(rho / (Math.PI * freqHz * MU0));
  const skinDepthMm = skinDepthM * MM_PER_M;
  const effectiveThicknessMm = skinDepthMm * (1 - Math.exp(-thicknessMm / skinDepthMm));

  const rhoOhmMm = rho * MM_PER_M;
  const dcResistancePerMm = rhoOhmMm / (widthMm * thicknessMm);
  const acResistancePerMm = rhoOhmMm / (widthMm * effectiveThicknessMm);

  // δ = t 反解频率：f = ρ / (π·μ0·t²)
  const criticalFreqHz = rho / (Math.PI * MU0 * (thicknessMm / MM_PER_M) ** 2);

  return {
    result: {
      skinDepthMm,
      skinDepthUm: skinDepthMm * 1000,
      skinDepthMil: skinDepthMm * MIL_PER_MM,
      effectiveThicknessMm,
      acDcRatio: thicknessMm / effectiveThicknessMm,
      acResistancePerMm,
      dcResistancePerMm,
      criticalFreqHz,
      thicknessSaturated: thicknessMm > 2 * skinDepthMm,
    },
  };
}
