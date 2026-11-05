/**
 * 不确定度与容差传播（FR-A-6）+ 敏感度分析（FR-E-3）。
 *
 * 蒙特卡洛：对带容差的输入采样（截断均匀分布），多次求解，
 * 输出 P10/P50/P90 三档，并用 Spearman 秩相关给出“最敏感的 3 个输入”。
 */
import { collectVars, parseExpr } from '../expr/parser';
import { type CalcSpec, type ModelSpec, varById } from '../spec/spec';
import { Quantity } from '../unit/quantity';
import {
  type NamedInputs,
  primaryOutput,
  solveBackward,
  solveForward,
  toQuantity,
} from '../solver/solver';

export interface McOptions {
  samples?: number;
  seed?: number;
}

export interface McStats {
  samples: number;
  outputVar: string;
  p10: number;
  p50: number;
  p90: number;
  /** 敏感度：Spearman 秩相关系数（绝对值降序），取前 3 */
  topSensitivity: Array<{ varId: string; rho: number }>;
}

/** 可复现伪随机（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleInput(
  v: number,
  tol: { type: 'abs' | 'pct'; value: number },
  rnd: () => number,
): number {
  const half = tol.type === 'pct' ? v * tol.value : tol.value;
  return v + (rnd() * 2 - 1) * half;
}

function rank(vals: number[]): number[] {
  const idx = vals.map((_, i) => i);
  idx.sort((a, b) => vals[a] - vals[b]);
  const ranks = new Array(vals.length);
  idx.forEach((i, pos) => (ranks[i] = pos + 1));
  return ranks;
}

function spearman(xs: number[], ys: number[]): number {
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * 对单个模型做不确定度传播。
 * @param targetVar 追踪的输出变量（默认模型输出）
 * @param targetSolve 反向求解时指定目标变量
 */
export function runMonteCarlo(
  spec: CalcSpec,
  model: ModelSpec,
  inputs: NamedInputs,
  opts: McOptions = {},
  process: NamedInputs = {},
  targetVar?: string,
  targetSolve?: string,
): McStats {
  const samples = opts.samples ?? 2000;
  const rnd = mulberry32(opts.seed ?? 42);

  const track = targetVar ?? primaryOutput(model);
  // 表达式体：单输出 expr 拆右侧；exprs 取全部键的右侧按序求值
  const bodies: string[] = model.exprs ? Object.values(model.exprs) : [model.expr!.split('=')[1]!];
  const used = new Set<string>();
  for (const body of bodies) {
    for (const v of collectVars(parseExpr(body))) used.add(v);
  }

  // 带容差的输入
  const varied: Array<{
    id: string;
    nominal: number;
    tol: { type: 'abs' | 'pct'; value: number };
  }> = [];
  const fixed: NamedInputs = {};
  for (const id of used) {
    const vs = varById(spec, id);
    const raw = inputs[id];
    if (raw === undefined) continue;
    const q = toQuantity(raw).to(vs.unit);
    fixed[id] = q;
    if (vs.tolerance && raw !== undefined) {
      varied.push({ id, nominal: q.value, tol: vs.tolerance });
    }
  }
  if (varied.length === 0) {
    // 无容差输入：退化为单点
    const env = runOnce(spec, model, inputs, process, targetSolve);
    const v = env[track];
    return {
      samples: 1,
      outputVar: track,
      p10: v,
      p50: v,
      p90: v,
      topSensitivity: [],
    };
  }

  const ys: number[] = [];
  const xs: Record<string, number[]> = Object.fromEntries(varied.map((v) => [v.id, []]));
  for (let s = 0; s < samples; s++) {
    const sampleInputs: NamedInputs = { ...fixed };
    for (const v of varied) {
      const sv = sampleInput(v.nominal, v.tol, rnd);
      sampleInputs[v.id] = new Quantity(sv, varById(spec, v.id).unit);
      xs[v.id]!.push(sv);
    }
    const env = runOnce(spec, model, sampleInputs, process, targetSolve);
    ys.push(env[track]);
  }

  const sorted = [...ys].sort((a, b) => a - b);
  const sensitivities = varied
    .map((v) => ({ varId: v.id, rho: Math.abs(spearman(xs[v.id]!, ys)) }))
    .sort((a, b) => b.rho - a.rho)
    .slice(0, 3);

  return {
    samples,
    outputVar: track,
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    topSensitivity: sensitivities,
  };
}

function runOnce(
  spec: CalcSpec,
  model: ModelSpec,
  inputs: NamedInputs,
  process: NamedInputs,
  targetSolve?: string,
): Record<string, number> {
  if (targetSolve) return solveBackward(spec, model, targetSolve, inputs, process).env;
  return solveForward(spec, model, inputs, process).env;
}
