import { describe, expect, it } from 'vitest';
import {
  solveESeries,
  type ESeriesResult,
  type ESeriesSolution,
} from '@/features/calculator-e-series/model/eSeriesSolver';

function best(result: ESeriesResult): ESeriesSolution {
  const list = [result.simple, result.three, result.four].filter(
    (s): s is ESeriesSolution => s !== null,
  );
  return list.sort((a, b) => Math.abs(a.error) - Math.abs(b.error))[0]!;
}

describe('E 系列组合搜索', () => {
  it('E24 目标 1kΩ 应命中单个标准值', () => {
    const r = solveESeries('E24', 1000, [], 4);
    expect(r.simple).not.toBeNull();
    expect(r.simple!.value).toBeCloseTo(1000, 6);
    expect(r.simple!.count).toBe(1);
    expect(Math.abs(r.simple!.error)).toBeLessThan(1e-9);
  });

  it('E24 目标 500Ω 应命中两个电阻并联', () => {
    const r = solveESeries('E24', 500, [], 4);
    expect(r.simple).not.toBeNull();
    expect(r.simple!.value).toBeCloseTo(500, 6);
    expect(r.simple!.count).toBe(2);
  });

  it('排除 1kΩ 后简单方案不应再使用 1kΩ 单值', () => {
    const r = solveESeries('E24', 1000, [1000], 4);
    expect(r.simple).not.toBeNull();
    expect(r.simple!.value).toBeCloseTo(1000, 6);
    expect(r.simple!.count).toBeGreaterThan(1);
    expect(r.simple!.expr.includes('(1 kΩ')).toBe(false);
  });

  it('E24 目标 1.234kΩ 应能找到 3R / 4R 组合', () => {
    const r = solveESeries('E24', 1234, [], 4);
    expect(r.three).not.toBeNull();
    expect(r.four).not.toBeNull();
    expect(Math.abs(best(r).error)).toBeLessThan(0.01);
  });

  it('E1 目标 2kΩ 应使用两个 1kΩ 串联', () => {
    const r = solveESeries('E1', 2000, [], 4);
    expect(r.simple).not.toBeNull();
    expect(r.simple!.value).toBeCloseTo(2000, 6);
    expect(r.simple!.count).toBe(2);
  });

  it('标准值池应覆盖 0.1Ω 与 1MΩ 档位', () => {
    const low = solveESeries('E24', 0.1, [], 4);
    expect(low.simple).not.toBeNull();
    expect(low.simple!.value).toBeCloseTo(0.1, 10);
    expect(low.simple!.count).toBe(1);

    const high = solveESeries('E24', 1e6, [], 4);
    expect(high.simple).not.toBeNull();
    expect(high.simple!.value).toBeCloseTo(1e6, 4);
    expect(high.simple!.count).toBe(1);
  });
});
