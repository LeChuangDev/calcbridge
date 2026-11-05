/**
 * 微带线阻抗多模型：
 * 1) IPC-2141 经典近似式（含铜厚 t）
 * 2) Hammerstad–Jensen 分段近似（零铜厚）
 *
 * 两个模型不做“谁绝对正确”的假设：显示各自结果、适用域和模型间差异，
 * 差异过大时提示使用 2D 场解算或测试 coupon，而不是伪造单点精度。
 */
export type ImpedanceMode = 'forward' | 'reverse';

export interface MicrostripParams {
  /** 线宽，mm */
  wMm: number;
  /** 介质厚度，mm */
  hMm: number;
  /** 铜厚，mm */
  tMm: number;
  /** 介电常数 */
  er: number;
  /** 目标阻抗，Ω */
  targetOhm: number;
}

export interface ImpedanceModel {
  id: string;
  name: string;
  standard: string;
  note: string;
  /** 适用域检查 */
  applicability(params: MicrostripParams, widthMm: number): string | null;
  /** 给定线宽 → 阻抗；超出适用域返回 null */
  z0(params: MicrostripParams, widthMm: number): number | null;
  /** 给定目标阻抗 → 线宽；无解返回 null */
  widthFor(params: MicrostripParams, target: number): number | null;
}

const MODEL_EPS = 1e-9;

function ratio(params: MicrostripParams, widthMm: number): number {
  return widthMm / params.hMm;
}

function finitePositive(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v) && v > 0);
}

/* ── IPC-2141 ─────────────────────────────────────────── */

function ipc2141Z0(params: MicrostripParams, widthMm: number): number | null {
  if (!finitePositive(widthMm, params.hMm, params.tMm, params.er)) return null;
  const u = ratio(params, widthMm);
  if (u < 0.1 - MODEL_EPS || u > 3 + MODEL_EPS || params.er < 1 || params.er > 15) return null;
  return (
    (87 / Math.sqrt(params.er + 1.41)) *
    Math.log((5.98 * params.hMm) / (0.8 * widthMm + params.tMm))
  );
}

function ipc2141Applicability(params: MicrostripParams, widthMm: number): string | null {
  if (!finitePositive(widthMm, params.hMm, params.tMm, params.er)) return '参数必须为正数';
  const u = ratio(params, widthMm);
  if (u < 0.1 || u > 3) return `w/h = ${u.toFixed(2)}，超出 0.1–3 适用域`;
  if (params.er < 1 || params.er > 15) return `εr = ${params.er}，超出 1–15 适用域`;
  return null;
}

/* ── Hammerstad–Jensen（含厚度修正） ─────────────────── */

function hammerstadZ0(params: MicrostripParams, widthMm: number): number | null {
  if (!finitePositive(widthMm, params.hMm, params.er)) return null;
  const u = ratio(params, widthMm);
  if (u < 0.1 - MODEL_EPS || u > 10 + MODEL_EPS || params.er < 1 || params.er > 15) return null;

  const tOverH = params.tMm > 0 ? params.tMm / params.hMm : 0;
  const uEff =
    tOverH > 0
      ? u +
        (tOverH / Math.PI) *
          Math.log(1 + (4 * Math.E) / (tOverH * Math.pow(1 / Math.tanh(Math.sqrt(6.517 * u)), 2)))
      : u;

  const eeff = (params.er + 1) / 2 + (params.er - 1) / 2 / Math.sqrt(1 + 12 / uEff);
  if (uEff <= 1) {
    return (60 / Math.sqrt(eeff)) * Math.log(8 / uEff + uEff / 4);
  }
  return (120 * Math.PI) / Math.sqrt(eeff) / (uEff + 1.393 + 0.667 * Math.log(uEff + 1.444));
}

function hammerstadApplicability(params: MicrostripParams, widthMm: number): string | null {
  if (!finitePositive(widthMm, params.hMm, params.er)) return '参数必须为正数';
  const u = ratio(params, widthMm);
  if (u < 0.1 || u > 10) return `w/h = ${u.toFixed(2)}，超出 0.1–10 适用域`;
  if (params.er < 1 || params.er > 15) return `εr = ${params.er}，超出 1–15 适用域`;
  if (params.tMm < 0) return '铜厚不能为负';
  return null;
}

/** 二分求线宽；Z0 对 w 单调递减。搜索边界必须落在模型适用域内。 */
function solveWidth(
  params: MicrostripParams,
  target: number,
  z0At: (p: MicrostripParams, w: number) => number | null,
  lowerU: number,
  upperU: number,
): number | null {
  if (!finitePositive(target, params.hMm, params.er)) return null;
  const low = Math.max(0.001, params.hMm * lowerU);
  const high = Math.max(low + 0.001, params.hMm * upperU);
  const zLow = z0At(params, low);
  const zHigh = z0At(params, high);
  if (zLow == null || zHigh == null) return null;
  if (target > zLow || target < zHigh) return null;

  let lo = low;
  let hi = high;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const z = z0At(params, mid);
    if (z == null) return null;
    if (z > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const IMPEDANCE_MODELS: ImpedanceModel[] = [
  {
    id: 'ipc2141_microstrip',
    name: 'IPC-2141 微带线近似式',
    standard: 'IPC-2141',
    note: '含铜厚 t；适用 0.1 ≤ w/h ≤ 3、1 ≤ εr ≤ 15。',
    applicability: ipc2141Applicability,
    z0: ipc2141Z0,
    widthFor: (params, target) =>
      solveWidth(params, target, ipc2141Z0, 0.1 + MODEL_EPS, 3 - MODEL_EPS),
  },
  {
    id: 'hammerstad_jensen',
    name: 'Hammerstad–Jensen 含厚度修正',
    standard: 'Hammerstad & Jensen (1980)',
    note: '分段式 + Hammerstad 厚度修正；适用 0.1 ≤ w/h ≤ 10。',
    applicability: hammerstadApplicability,
    z0: hammerstadZ0,
    widthFor: (params, target) =>
      solveWidth(params, target, hammerstadZ0, 0.1 + MODEL_EPS, 10 - MODEL_EPS),
  },
];

export interface ImpedanceEvaluation {
  model: ImpedanceModel;
  /** 正向：Z0；反向：null */
  z0: number | null;
  /** 反向：线宽；正向：null */
  widthMm: number | null;
  /** 目标偏差 %（阻抗或线宽相对目标/中位线宽） */
  errorPct: number | null;
  applicable: boolean;
  reason: string | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export interface ImpedanceSummary {
  mode: ImpedanceMode;
  evaluations: ImpedanceEvaluation[];
  /** 参与统计的模型数 */
  count: number;
  median: number | null;
  min: number | null;
  max: number | null;
  /** (max-min)/median*100，单位 % */
  spreadPct: number | null;
  confidence: 'high' | 'medium' | 'low' | 'single' | 'none';
}

export function evaluateImpedance(
  mode: ImpedanceMode,
  params: MicrostripParams,
  widthMm: number,
): ImpedanceSummary {
  const evaluations: ImpedanceEvaluation[] = IMPEDANCE_MODELS.map((model) => {
    if (mode === 'forward') {
      const z0 = model.z0(params, widthMm);
      const reason = model.applicability(params, widthMm);
      return {
        model,
        z0,
        widthMm: null,
        errorPct: z0 == null ? null : ((z0 - params.targetOhm) / params.targetOhm) * 100,
        applicable: z0 != null && reason == null,
        reason,
      };
    }

    const width = model.widthFor(params, params.targetOhm);
    const reason = width == null ? '目标阻抗无法由该模型求解' : model.applicability(params, width);
    return {
      model,
      z0: null,
      widthMm: width,
      errorPct: null,
      applicable: width != null && reason == null,
      reason,
    };
  });

  const values = evaluations
    .filter((e) => e.applicable)
    .map((e) => (mode === 'forward' ? e.z0! : e.widthMm!))
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) {
    return {
      mode,
      evaluations,
      count: 0,
      median: null,
      min: null,
      max: null,
      spreadPct: null,
      confidence: 'none',
    };
  }

  const mid = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spreadPct = ((max - min) / mid) * 100;
  const confidence =
    values.length < 2 ? 'single' : spreadPct <= 3 ? 'high' : spreadPct <= 8 ? 'medium' : 'low';

  return {
    mode,
    evaluations,
    count: values.length,
    median: mid,
    min,
    max,
    spreadPct,
    confidence,
  };
}

export function confidenceLabel(confidence: ImpedanceSummary['confidence']): string {
  switch (confidence) {
    case 'high':
      return '模型一致性高';
    case 'medium':
      return '模型一致性一般';
    case 'low':
      return '模型差异较大，建议场解算';
    case 'single':
      return '仅一个模型适用';
    default:
      return '无适用模型';
  }
}

export function confidenceTone(confidence: ImpedanceSummary['confidence']): 'ok' | 'warn' | 'bad' {
  if (confidence === 'high') return 'ok';
  if (confidence === 'medium' || confidence === 'single') return 'warn';
  return 'bad';
}
