import { describe, expect, it } from 'vitest';
import { designRf, rfResponse } from './rfSolver';

describe('RF 无源衰减器设计', () => {
  it('50Ω / 6dB Pi 网络应为 150.5 / 37.35 / 150.5 Ω', () => {
    const d = designRf('pi', 6, 50, 50);
    expect(d.values).not.toBeNull();
    expect(d.values!.r1).toBeCloseTo(150.5, 1);
    expect(d.values!.r2).toBeCloseTo(37.35, 1);
    expect(d.values!.r3).toBeCloseTo(150.5, 1);
  });

  it('50Ω / 6dB T 网络应为 16.61 / 66.93 / 16.61 Ω', () => {
    const d = designRf('t', 6, 50, 50);
    expect(d.values).not.toBeNull();
    expect(d.values!.r1).toBeCloseTo(16.61, 1);
    expect(d.values!.r2).toBeCloseTo(66.93, 1);
    expect(d.values!.r3).toBeCloseTo(16.61, 1);
  });

  it('Pi 网络在等阻抗端接下匹配且衰减正确', () => {
    const d = designRf('pi', 10, 50, 50);
    expect(d.values).not.toBeNull();
    const r = rfResponse('pi', d.values!, 50, 50);
    expect(r.zin).toBeCloseTo(50, 6);
    expect(r.zout).toBeCloseTo(50, 6);
    expect(r.attenuationDb).toBeCloseTo(10, 6);
  });

  it('T 网络在不等阻抗端接下匹配且衰减正确', () => {
    const d = designRf('t', 6, 50, 75);
    expect(d.values).not.toBeNull();
    const r = rfResponse('t', d.values!, 50, 75);
    expect(r.zin).toBeCloseTo(50, 6);
    expect(r.zout).toBeCloseTo(75, 6);
    expect(r.attenuationDb).toBeCloseTo(6, 6);
  });

  it('不可实现的组合应返回错误而不是负数电阻', () => {
    const d = designRf('pi', 0.1, 50, 5);
    if (d.values) {
      expect(d.values.r1).toBeGreaterThan(0);
      expect(d.values.r2).toBeGreaterThan(0);
      expect(d.values.r3).toBeGreaterThan(0);
    } else {
      expect(d.error).toBeTruthy();
    }
  });
});
