import { describe, expect, it } from 'vitest';
import { solveGalvanic } from '../src/galvanic/solver';

describe('电偶腐蚀阳极指数评估', () => {
  it('铜/金在受控环境为低风险', () => {
    const r = solveGalvanic({ metalA: 'copper', metalB: 'gold', environment: 'controlled' });
    expect(r.difference).toBeCloseTo(0.35, 6);
    expect(r.anode.id).toBe('copper');
    expect(r.cathode.id).toBe('gold');
    expect(r.risk).toBe('低');
  });

  it('铜/铝在一般环境为高风险（0.40 V > 0.25 V）', () => {
    const r = solveGalvanic({ metalA: 'copper', metalB: 'aluminum', environment: 'normal' });
    expect(r.difference).toBeCloseTo(0.4, 6);
    expect(r.risk).toBe('高');
  });

  it('镍/黄铜在海洋环境为低风险（0.10 V < 0.15 V）', () => {
    const r = solveGalvanic({ metalA: 'nickel', metalB: 'brass', environment: 'harsh' });
    expect(r.difference).toBeCloseTo(0.1, 6);
    expect(r.risk).toBe('低');
  });

  it('锌/金在海洋环境为高风险', () => {
    const r = solveGalvanic({ metalA: 'zinc', metalB: 'gold', environment: 'harsh' });
    expect(r.difference).toBeCloseTo(1.25, 6);
    expect(r.anode.id).toBe('zinc');
    expect(r.risk).toBe('高');
  });

  it('同种金属差值为零', () => {
    const r = solveGalvanic({ metalA: 'tin', metalB: 'tin', environment: 'normal' });
    expect(r.difference).toBe(0);
    expect(r.risk).toBe('低');
  });
});
