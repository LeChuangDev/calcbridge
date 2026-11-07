/**
 * E 系列电阻组合搜索（纯函数，便于单独校验）。
 *
 * 规则：
 * - 标准值覆盖 0.1Ω ~ 9.1MΩ，按十倍程展开所选 E 系列（含 0.1Ω 与 1MΩ 档）。
 * - 支持 1~4 个电阻的串联 / 并联组合；搜索覆盖所有二叉网络。
 * - 误差 = (合成值 - 目标值) / 目标值 × 100%。
 * - 排除值按相对 ±0.5% 从可用标准值中剔除。
 */

export type ESeriesId = 'E1' | 'E3' | 'E6' | 'E12' | 'E24';

const MANTISSAS: Record<ESeriesId, number[]> = {
  E1: [10],
  E3: [10, 22, 47],
  E6: [10, 15, 22, 33, 47, 68],
  E12: [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82],
  E24: [
    10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
  ],
};

/**
 * 十倍程覆盖 0.1Ω ~ 9.1MΩ：起始 1e-2 使 10×1e-2 = 0.1Ω，
 * 末位 1e5 提供 1MΩ 档，并向上展开至 9.1MΩ。
 */
const DECADES = [1e-2, 1e-1, 1, 10, 1e2, 1e3, 1e4, 1e5];

export interface ESeriesSolution {
  /** 合成阻值，单位 Ω */
  value: number;
  /** 相对目标值的误差，单位 % */
  error: number;
  /** 组合表达式，+ 表示串联，∥ 表示并联 */
  expr: string;
  /** 使用电阻个数 */
  count: number;
}

export interface ESeriesResult {
  simple: ESeriesSolution | null;
  three: ESeriesSolution | null;
  four: ESeriesSolution | null;
}

interface Pair {
  value: number;
  expr: string;
}

function trimNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return String(Math.round(v * 10) / 10);
  if (abs >= 1) return String(Math.round(v * 1000) / 1000);
  return String(Math.round(v * 10000) / 10000);
}

function fmtOhm(v: number): string {
  if (v >= 1e6) return `${trimNum(v / 1e6)} MΩ`;
  if (v >= 1e3) return `${trimNum(v / 1e3)} kΩ`;
  return `${trimNum(v)} Ω`;
}

function buildPool(series: ESeriesId, exclusions: number[]): number[] {
  const values = new Set<number>();
  for (const decade of DECADES) {
    for (const m of MANTISSAS[series]) {
      values.add(Math.round(m * decade * 1e6) / 1e6);
    }
  }
  const sorted = [...values].sort((a, b) => a - b);
  const ex = exclusions.filter((v) => Number.isFinite(v) && v > 0);
  return sorted.filter((v) => !ex.some((e) => Math.abs(v - e) / e < 0.005));
}

function buildPairs(pool: number[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i; j < pool.length; j++) {
      const a = pool[i]!;
      const b = pool[j]!;
      pairs.push({ value: a + b, expr: `(${fmtOhm(a)} + ${fmtOhm(b)})` });
      pairs.push({
        value: (a * b) / (a + b),
        expr: `(${fmtOhm(a)} ∥ ${fmtOhm(b)})`,
      });
    }
  }
  pairs.sort((a, b) => a.value - b.value);
  return pairs;
}

function lowerBound(pairs: Pair[], x: number): number {
  let lo = 0;
  let hi = pairs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pairs[mid]!.value < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function around(pairs: Pair[], x: number, visit: (p: Pair) => void): void {
  const i = lowerBound(pairs, x);
  const start = Math.max(0, i - 2);
  const end = Math.min(pairs.length - 1, i + 2);
  for (let k = start; k <= end; k++) visit(pairs[k]!);
}

export function solveESeries(
  series: ESeriesId,
  targetOhm: number,
  exclusions: number[],
  maxComponents: 2 | 3 | 4 = 4,
): ESeriesResult {
  const pool = buildPool(series, exclusions);
  const empty: ESeriesResult = { simple: null, three: null, four: null };
  if (pool.length < 2 || !Number.isFinite(targetOhm) || targetOhm <= 0) return empty;

  const pairs = buildPairs(pool);
  const errOf = (v: number) => ((v - targetOhm) / targetOhm) * 100;

  const makeBest = () => {
    let best: ESeriesSolution | null = null;
    const consider = (value: number, count: number, makeExpr: () => string) => {
      if (!Number.isFinite(value) || value <= 0) return;
      const error = errOf(value);
      const abs = Math.abs(error);
      if (!best || abs < Math.abs(best.error) - 1e-9) {
        best = { value, error, expr: makeExpr(), count };
      }
    };
    return { consider, get: () => best };
  };

  /* 简单方案：1R 或 2R */
  const simpleBest = makeBest();
  for (const r of pool) {
    simpleBest.consider(r, 1, () => fmtOhm(r));
  }
  around(pairs, targetOhm, (p) => {
    simpleBest.consider(p.value, 2, () => p.expr);
  });
  const simple = simpleBest.get();

  /* 3R：pair op single，覆盖全部三电阻二叉网络 */
  let three: ESeriesSolution | null = null;
  if (maxComponents >= 3) {
    const best = makeBest();
    for (const r of pool) {
      const needSeries = targetOhm - r;
      if (needSeries > 0) {
        around(pairs, needSeries, (p) => {
          best.consider(r + p.value, 3, () => `(${p.expr} + ${fmtOhm(r)})`);
        });
      }
      if (r > targetOhm) {
        const needParallel = (targetOhm * r) / (r - targetOhm);
        around(pairs, needParallel, (p) => {
          const value = (r * p.value) / (r + p.value);
          best.consider(value, 3, () => `(${p.expr} ∥ ${fmtOhm(r)})`);
        });
      }
    }
    three = best.get();
  }

  /* 4R：2+2 与 3+1 两种根拆分，覆盖全部四电阻二叉网络 */
  let four: ESeriesSolution | null = null;
  if (maxComponents >= 4) {
    const best = makeBest();

    /* 2+2 */
    for (const p1 of pairs) {
      const needSeries = targetOhm - p1.value;
      if (needSeries > 0) {
        around(pairs, needSeries, (p2) => {
          best.consider(p1.value + p2.value, 4, () => `(${p1.expr} + ${p2.expr})`);
        });
      }
      if (p1.value > targetOhm) {
        const needParallel = (targetOhm * p1.value) / (p1.value - targetOhm);
        around(pairs, needParallel, (p2) => {
          const value = (p1.value * p2.value) / (p1.value + p2.value);
          best.consider(value, 4, () => `(${p1.expr} ∥ ${p2.expr})`);
        });
      }
    }

    /* 3+1：((pair op1 r1) op2 r2) */
    for (const r1 of pool) {
      for (const r2 of pool) {
        /* 外层串联 */
        const needOuterSeries = targetOhm - r2;
        if (needOuterSeries > 0) {
          const needInnerSeries = needOuterSeries - r1;
          if (needInnerSeries > 0) {
            around(pairs, needInnerSeries, (p) => {
              const inner = `(${p.expr} + ${fmtOhm(r1)})`;
              best.consider(p.value + r1 + r2, 4, () => `(${inner} + ${fmtOhm(r2)})`);
            });
          }
          if (r1 > needOuterSeries) {
            const needInnerParallel = (needOuterSeries * r1) / (r1 - needOuterSeries);
            around(pairs, needInnerParallel, (p) => {
              const innerValue = (r1 * p.value) / (r1 + p.value);
              const inner = `(${p.expr} ∥ ${fmtOhm(r1)})`;
              best.consider(innerValue + r2, 4, () => `(${inner} + ${fmtOhm(r2)})`);
            });
          }
        }

        /* 外层并联 */
        if (r2 > targetOhm) {
          const needOuterParallel = (targetOhm * r2) / (r2 - targetOhm);
          const needInnerSeries = needOuterParallel - r1;
          if (needInnerSeries > 0) {
            around(pairs, needInnerSeries, (p) => {
              const innerValue = p.value + r1;
              const value = (r2 * innerValue) / (r2 + innerValue);
              const inner = `(${p.expr} + ${fmtOhm(r1)})`;
              best.consider(value, 4, () => `(${inner} ∥ ${fmtOhm(r2)})`);
            });
          }
          if (r1 > needOuterParallel) {
            const needInnerParallel = (needOuterParallel * r1) / (r1 - needOuterParallel);
            around(pairs, needInnerParallel, (p) => {
              const innerValue = (r1 * p.value) / (r1 + p.value);
              const value = (r2 * innerValue) / (r2 + innerValue);
              const inner = `(${p.expr} ∥ ${fmtOhm(r1)})`;
              best.consider(value, 4, () => `(${inner} ∥ ${fmtOhm(r2)})`);
            });
          }
        }
      }
    }

    four = best.get();
  }

  return { simple, three, four };
}
