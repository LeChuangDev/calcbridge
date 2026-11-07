import { describe, expect, it } from 'vitest';
import { solveVia, type ViaInput } from '../src/via/solver';

const base: ViaInput = {
  holeMm: 0.4,
  platingMm: 0.035,
  lengthMm: 1.6,
  padMm: 0.6,
  z0: 50,
  currentA: 1,
  rho: 1.72e-8,
  er: 4.5,
  dT: 10,
  riseNs: 1,
  freqMHz: 500,
};

describe('过孔参数估算', () => {
  it('按 D=0.4 / T=0.035 / L=1.6 计算镀层电阻与电感', () => {
    const { result } = solveVia(base);
    expect(result).not.toBeNull();
    expect(result!.resistance).toBeCloseTo(5.7536e-4, 7);
    expect(result!.inductanceNh).toBeCloseTo(1.2072, 3);
    expect(result!.aspectRatio).toBeCloseTo(4, 10);
    expect(result!.annularRing).toBeCloseTo(0.1, 10);
  });

  it('IPC-2221 外层载流估算约 3A', () => {
    const { result } = solveVia(base);
    expect(result).not.toBeNull();
    expect(result!.currentEstimate).toBeCloseTo(2.999, 1);
  });

  it('感抗在 500MHz 约 3.79Ω', () => {
    const { result } = solveVia(base);
    expect(result).not.toBeNull();
    expect(result!.reactanceOhm).toBeCloseTo(3.792, 2);
  });

  it('焊盘不大于孔径时应报错', () => {
    const r = solveVia({ ...base, padMm: 0.4 });
    expect(r.result).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
