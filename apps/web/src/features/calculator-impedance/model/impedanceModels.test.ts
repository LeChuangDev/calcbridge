import { describe, expect, it } from 'vitest';
import {
  IMPEDANCE_MODELS,
  confidenceLabel,
  confidenceTone,
  evaluateImpedance,
  type MicrostripParams,
} from '@/features/calculator-impedance/model/impedanceModels';

const params: MicrostripParams = {
  wMm: 0.3,
  hMm: 0.2,
  tMm: 0.035,
  er: 4.2,
  targetOhm: 50,
};

function model(id: string) {
  const found = IMPEDANCE_MODELS.find((m) => m.id === id);
  if (!found) throw new Error(`missing model ${id}`);
  return found;
}

describe('微带线多模型阻抗', () => {
  it('IPC-2141 与已知算例一致', () => {
    expect(model('ipc2141_microstrip').z0(params, 0.3)).toBeCloseTo(53.994, 2);
  });

  it('Hammerstad–Jensen 含厚度修正后与 IPC 接近', () => {
    const z = model('hammerstad_jensen').z0(params, 0.3)!;
    expect(z).toBeCloseTo(54.393, 2);
    expect(Math.abs(z - 53.994) / 53.994).toBeLessThan(0.02);
  });

  it('增加铜厚会降低两种模型的阻抗', () => {
    const thin = { ...params, tMm: 0.018 };
    const thick = { ...params, tMm: 0.07 };
    expect(model('ipc2141_microstrip').z0(thick, 0.3)!).toBeLessThan(
      model('ipc2141_microstrip').z0(thin, 0.3)!,
    );
    expect(model('hammerstad_jensen').z0(thick, 0.3)!).toBeLessThan(
      model('hammerstad_jensen').z0(thin, 0.3)!,
    );
  });

  it('超出适用域时返回 null 并给出原因', () => {
    const ipc = model('ipc2141_microstrip');
    expect(ipc.z0({ ...params, wMm: 0.01 }, 0.01)).toBeNull();
    expect(ipc.applicability(params, 0.01)).toContain('超出');

    const hj = model('hammerstad_jensen');
    expect(hj.applicability({ ...params, wMm: 0.001 }, 0.001)).toContain('超出');
  });

  it('反向求解线宽后再正算应回到目标阻抗', () => {
    for (const m of IMPEDANCE_MODELS) {
      const width = m.widthFor(params, 50);
      expect(width).not.toBeNull();
      const z = m.z0(params, width!);
      expect(z).not.toBeNull();
      expect(z!).toBeCloseTo(50, 2);
      expect(m.applicability(params, width!)).toBeNull();
    }
  });

  it('正向汇总给出中位数、范围和一致性等级', () => {
    const summary = evaluateImpedance('forward', params, 0.3);
    expect(summary.count).toBe(2);
    expect(summary.median).toBeCloseTo(54.19, 1);
    expect(summary.min).toBeCloseTo(53.994, 2);
    expect(summary.max).toBeCloseTo(54.393, 2);
    expect(summary.spreadPct).toBeLessThan(1);
    expect(summary.confidence).toBe('high');
    expect(confidenceLabel(summary.confidence)).toBe('模型一致性高');
    expect(confidenceTone(summary.confidence)).toBe('ok');
  });

  it('反向汇总给出两种模型的目标线宽范围', () => {
    const summary = evaluateImpedance('reverse', params, 0.3);
    expect(summary.count).toBe(2);
    expect(summary.median).toBeGreaterThan(0.3);
    expect(summary.min).toBeLessThan(summary.max!);
    // 反向求解对模型差异更敏感：线宽的相对差异会被放大，
    // 因此默认例在此为 medium 而非 high，这是预期的科学性提示。
    expect(summary.spreadPct!).toBeGreaterThan(3);
    expect(summary.spreadPct!).toBeLessThan(8);
    expect(summary.confidence).toBe('medium');
  });

  it('无适用模型时返回 none', () => {
    const summary = evaluateImpedance(
      'forward',
      { ...params, wMm: 0.001, hMm: 0.2, er: 4.2 },
      0.001,
    );
    expect(summary.count).toBe(0);
    expect(summary.confidence).toBe('none');
    expect(confidenceTone(summary.confidence)).toBe('bad');
  });

  it('模型差异较大时降级为 low', () => {
    // 人为放大差异：用一个极薄铜厚让 IPC 与 HJ 的修正路径分离。
    const extreme = evaluateImpedance('forward', { ...params, tMm: 0.18 }, 0.15);
    expect(extreme.spreadPct).not.toBeNull();
    expect(extreme.spreadPct!).toBeGreaterThan(8);
    expect(extreme.confidence).toBe('low');
    expect(confidenceLabel(extreme.confidence)).toContain('场解算');
  });
});
