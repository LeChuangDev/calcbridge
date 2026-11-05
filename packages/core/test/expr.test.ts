import { describe, expect, it } from 'vitest';
import { parseExpr, collectVars } from '../src/expr/parser';
import { evalExpr, substituteExpr } from '../src/expr/eval';

describe('表达式引擎（FR-A-10）', () => {
  it('运算符优先级：2 + 3 * 4 = 14', () => {
    expect(evalExpr(parseExpr('2 + 3 * 4'), { values: {} })).toBe(14);
  });

  it('幂右结合：2^3^2 = 2^9 = 512', () => {
    expect(evalExpr(parseExpr('2^3^2'), { values: {} })).toBe(512);
  });

  it('函数与常量：sqrt(16) + ln(e)', () => {
    expect(evalExpr(parseExpr('sqrt(16) + ln(e)'), { values: { e: Math.E } })).toBeCloseTo(5, 10);
  });

  it('收集变量', () => {
    expect([...collectVars(parseExpr('(I / (0.048 * dT^0.44))'))]).toEqual(
      expect.arrayContaining(['I', 'dT']),
    );
  });

  it('数字代入行回显（FR-A-10）', () => {
    const body = '(I / (0.048 * dT^0.44))^(1 / 0.725)';
    const s = substituteExpr(parseExpr(body), { I: 3, dT: 10 });
    expect(s).toContain('3');
    expect(s).toContain('10');
  });

  it('曲线查表：双对数插值（FR-A-5）', () => {
    const ast = parseExpr('curve(c, x)');
    const v = evalExpr(ast, {
      values: { x: 3 },
      curves: { c: { id: 'c', x: [1, 10], y: [10, 100], interp: 'loglog' } },
    });
    // x=3 在对数轴上位于 1..10 的 0.477 处，y = 10^(1 + 0.477) ≈ 30.0
    expect(v).toBeCloseTo(30.0, 3);
  });

  it('除零抛错', () => {
    expect(() => evalExpr(parseExpr('1/0'), { values: {} })).toThrow(/除数为零/);
  });
});
