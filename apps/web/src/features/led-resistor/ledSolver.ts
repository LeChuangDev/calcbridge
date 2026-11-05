/**
 * LED 限流电阻与功率估算（纯函数，便于单独校验）。
 *
 * 模型：
 *   R = (Vin − n·Vf) / If
 *   P_R = If²·R，P_LED = n·Vf·If
 * 标准阻值：按所选 E 系列取最接近的标准值，并回算实际电流与偏差。
 * 选型建议按 2 倍裕度给出额定功率档（1/8、1/4、1/2、1、2 W）。
 */

export type LedSeriesId = 'E12' | 'E24';

export interface LedInput {
  /** V，供电电压 */
  vin: number;
  /** V，单颗正向压降 */
  vf: number;
  /** mA，目标正向电流 */
  ifMa: number;
  /** 串联颗数 */
  count: number;
  series: LedSeriesId;
}

export interface LedChoice {
  /** Ω，标准阻值 */
  value: number;
  /** mA，采用标准值后的实际电流 */
  currentMa: number;
  /** %，相对目标电流偏差 */
  errorPct: number;
  /** W，电阻实际功耗 */
  powerW: number;
  /** W，建议额定功率档 */
  suggestedRatingW: number;
}

export interface LedResult {
  /** Ω，理论所需阻值 */
  requiredOhm: number;
  /** V，电阻两端压降 */
  headroomV: number;
  /** W，电阻理论功耗 */
  resistorPowerW: number;
  /** W，LED 串总功耗 */
  ledPowerW: number;
  /** W，整串总功耗 */
  totalPowerW: number;
  /** 最接近的标准阻值方案 */
  choice: LedChoice | null;
}

const MANTISSAS: Record<LedSeriesId, number[]> = {
  E12: [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82],
  E24: [
    10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
  ],
};

const DECADES = [1e-2, 1e-1, 1, 10, 1e2, 1e3, 1e4, 1e5, 1e6];
const RATINGS_W = [0.125, 0.25, 0.5, 1, 2, 5];

/** 取不小于目标值的最小标准阻值（宁可电流偏小，也避免过流）。 */
export function nearestStandard(target: number, series: LedSeriesId): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  let best = Infinity;
  for (const decade of DECADES) {
    for (const m of MANTISSAS[series]) {
      const v = m * decade;
      if (v >= target && v < best) best = v;
    }
  }
  // 超出 9.1 MΩ 时取最大值；同时比较最后一个候选与最大档，避免返回 Infinity
  if (!Number.isFinite(best)) {
    const max = MANTISSAS[series][MANTISSAS[series].length - 1]! * DECADES[DECADES.length - 1]!;
    return max >= target ? max : null;
  }
  return Math.round(best * 1e6) / 1e6;
}

function ratingFor(powerW: number): number {
  return RATINGS_W.find((r) => r >= powerW * 2) ?? RATINGS_W[RATINGS_W.length - 1]!;
}

export function solveLedResistor(input: LedInput): { result: LedResult | null; error?: string } {
  const { vin, vf, ifMa, count, series } = input;
  if ([vin, vf, ifMa, count].some((v) => !Number.isFinite(v))) {
    return { result: null, error: '请填写有效的数值。' };
  }
  if (!Number.isInteger(count) || count < 1) {
    return { result: null, error: '串联颗数必须为不小于 1 的整数。' };
  }
  if (ifMa <= 0) {
    return { result: null, error: '目标电流必须为正数。' };
  }
  if (vf <= 0 || vin <= 0) {
    return { result: null, error: '供电电压与正向压降必须为正数。' };
  }

  const headroomV = vin - count * vf;
  if (headroomV <= 0) {
    return {
      result: null,
      error: `供电电压需大于 ${count} 颗串联的正向压降（${(count * vf).toFixed(2)} V）。`,
    };
  }

  const currentA = ifMa / 1000;
  const requiredOhm = headroomV / currentA;
  const resistorPowerW = headroomV * currentA;
  const ledPowerW = count * vf * currentA;

  const standard = nearestStandard(requiredOhm, series);
  const choice: LedChoice | null = standard
    ? (() => {
        const actualMa = (headroomV / standard) * 1000;
        const powerW = (headroomV * headroomV) / standard;
        return {
          value: standard,
          currentMa: actualMa,
          errorPct: ((actualMa - ifMa) / ifMa) * 100,
          powerW,
          suggestedRatingW: ratingFor(powerW),
        };
      })()
    : null;

  return {
    result: {
      requiredOhm,
      headroomV,
      resistorPowerW,
      ledPowerW,
      totalPowerW: resistorPowerW + ledPowerW,
      choice,
    },
  };
}
