/**
 * 空气填充矩形波导 TE10 模标准公式。
 *   fc = c / (2a)
 *   λ0 = c / f
 *   λg = λ0 / √(1 - (fc/f)²)
 *   vp = c / √(...), vg = c·√(...)
 *   ZTE = η0 / √(...)
 * 下一个模式 TE20 截止频率 = c / a；f < c/a 时为单模。
 */

export interface WaveguideInput {
  aMm: number;
  freqGHz: number;
}

export interface WaveguideResult {
  fcGHz: number;
  lambda0Mm: number;
  lambdaCMm: number;
  lambdaGMm: number;
  vpOverC: number;
  vgOverC: number;
  zteOhm: number;
  te20GHz: number;
  singleMode: boolean;
}

const C = 299792458;
const ETA0 = 376.730313668;

export function solveWaveguide(input: WaveguideInput): {
  result: WaveguideResult | null;
  error?: string;
} {
  const { aMm, freqGHz } = input;
  if (!Number.isFinite(aMm) || !Number.isFinite(freqGHz) || aMm <= 0 || freqGHz <= 0) {
    return { result: null, error: '宽边 a 与频率必须为正数。' };
  }
  const a = aMm / 1000;
  const f = freqGHz * 1e9;
  const fc = C / (2 * a);
  if (f <= fc) {
    return {
      result: null,
      error: `频率低于 TE10 截止频率 ${(fc / 1e9).toFixed(3)} GHz。`,
    };
  }
  const s = Math.sqrt(1 - (fc / f) ** 2);
  const lambda0 = C / f;
  return {
    result: {
      fcGHz: fc / 1e9,
      lambda0Mm: lambda0 * 1000,
      lambdaCMm: 2 * a * 1000,
      lambdaGMm: (lambda0 / s) * 1000,
      vpOverC: 1 / s,
      vgOverC: s,
      zteOhm: ETA0 / s,
      te20GHz: C / a / 1e9,
      singleMode: f < C / a,
    },
  };
}
