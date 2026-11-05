/**
 * 镀铜过孔参数估算。
 *
 * 采用标准一阶模型：
 *   A = π(D+T)T                       镀层环形截面积
 *   R = ρL/A                          直流电阻
 *   Rθ = L/(k·A), k_Cu = 401 W/(m·K)  轴向热阻
 *   I ≈ 0.048·ΔT^0.44·A_mil²^0.725   IPC-2221 外层载流估算
 *   C ≈ 1.41·εr·T_in·D_in/(D_pad-D)  pF（长度按英寸）
 *   L ≈ 5.08·h_in·(ln(4h/d)+1) nH
 *   tr_via ≈ 1.1·Z0·C ps
 */

export interface ViaInput {
  /** 最终孔径 D，mm */
  holeMm: number;
  /** 镀层厚度 T，mm */
  platingMm: number;
  /** 过孔长度 / 板厚，mm */
  lengthMm: number;
  /** 焊盘直径，mm */
  padMm: number;
  /** 目标阻抗，Ω */
  z0: number;
  /** 应用电流，A */
  currentA: number;
  /** 镀层电阻率，Ω·m */
  rho: number;
  /** 基板相对介电常数 */
  er: number;
  /** 允许温升，°C */
  dT: number;
  /** 输入上升时间，ns */
  riseNs: number;
  /** 评估频率，MHz */
  freqMHz: number;
}

export interface ViaResult {
  areaMm2: number;
  /** 深径比 L / D（制造工艺关注项） */
  aspectRatio: number;
  /** 环宽 (焊盘直径 - 孔径) / 2，mm */
  annularRing: number;
  /** Ω */
  resistance: number;
  /** V */
  voltageDrop: number;
  /** W */
  power: number;
  /** °C/W */
  thermalResistance: number;
  /** A */
  currentEstimate: number;
  /** pF */
  capacitancePf: number;
  /** ps */
  riseTimePs: number;
  /** nH */
  inductanceNh: number;
  /** Ω at freq */
  reactanceOhm: number;
  /** ps, 输入与过孔上升沿的方和根 */
  systemRisePs: number;
}

const CU_K = 401;
const MIL2_MM2 = 0.00064516;

export function solveVia(input: ViaInput): { result: ViaResult | null; error?: string } {
  const { holeMm, platingMm, lengthMm, padMm, z0, currentA, rho, er, dT, riseNs, freqMHz } = input;

  const nums = [holeMm, platingMm, lengthMm, padMm, z0, currentA, rho, er, dT, riseNs, freqMHz];
  if (nums.some((v) => !Number.isFinite(v))) {
    return { result: null, error: '所有参数必须为有效数字。' };
  }
  if (
    holeMm <= 0 ||
    platingMm <= 0 ||
    lengthMm <= 0 ||
    z0 <= 0 ||
    currentA < 0 ||
    rho <= 0 ||
    er <= 0 ||
    dT <= 0 ||
    riseNs < 0 ||
    freqMHz < 0
  ) {
    return { result: null, error: '孔径、镀层、长度、阻抗、电阻率、介电常数与温升必须为正数。' };
  }
  if (padMm <= holeMm) {
    return { result: null, error: '焊盘直径必须大于孔径。' };
  }

  const areaMm2 = Math.PI * (holeMm + platingMm) * platingMm;
  const areaM2 = areaMm2 * 1e-6;
  const lengthM = lengthMm / 1000;
  const aspectRatio = lengthMm / holeMm;
  const annularRing = (padMm - holeMm) / 2;

  const resistance = (rho * lengthM) / areaM2;
  const voltageDrop = currentA * resistance;
  const power = currentA * currentA * resistance;
  const thermalResistance = lengthM / (CU_K * areaM2);

  const areaMil2 = areaMm2 / MIL2_MM2;
  const currentEstimate = 0.048 * Math.pow(dT, 0.44) * Math.pow(areaMil2, 0.725);

  const tIn = lengthMm / 25.4;
  const dIn = holeMm / 25.4;
  const padIn = padMm / 25.4;
  const capacitancePf = (1.41 * er * tIn * dIn) / (padIn - dIn);

  const riseTimePs = 1.1 * z0 * capacitancePf;
  const inductanceNh = 5.08 * tIn * (Math.log((4 * tIn) / dIn) + 1);
  const reactanceOhm = 2 * Math.PI * freqMHz * 1e6 * inductanceNh * 1e-9;
  const systemRisePs = Math.hypot(riseNs * 1000, riseTimePs);

  return {
    result: {
      areaMm2,
      aspectRatio,
      annularRing,
      resistance,
      voltageDrop,
      power,
      thermalResistance,
      currentEstimate,
      capacitancePf,
      riseTimePs,
      inductanceNh,
      reactanceOhm,
      systemRisePs,
    },
  };
}
