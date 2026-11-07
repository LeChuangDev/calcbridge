import { describe, expect, it } from 'vitest';
import { fmtNum } from '@/shared/lib/bridge';
import { VIA_RULE_PRESETS, type ViaRuleSet } from '@/features/calculator-via/model/viaRules';
import { solveVia, type ViaInput } from '@/features/calculator-via/model/viaSolver';
import {
  buildViaChecks,
  buildViaFigureGeometry,
  buildViaMetricGroups,
  formatAspectRatio,
  type ViaCheckOptions,
} from '@/features/calculator-via/model/viaViewModel';
import type { ViaUnitSystem } from '@/features/calculator-via/model/viaUnits';

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

function resultOf(patch: Partial<ViaInput> = {}) {
  const { result, error } = solveVia({ ...base, ...patch });
  if (!result) throw new Error(error ?? '测试输入未产生结果');
  return result;
}

const standardRules = VIA_RULE_PRESETS.standard.rules;

function checkOptions(
  holeMm = 0.4,
  rules: ViaRuleSet = standardRules,
  unitSystem: ViaUnitSystem = 'metric',
): ViaCheckOptions {
  return { holeMm, rules, unitSystem };
}

describe('过孔页视觉模型', () => {
  it('工艺检查：默认参数为 3 项 ok + 1 项 neutral', () => {
    const checks = buildViaChecks(resultOf(), checkOptions());

    expect(checks.map((c) => c.id)).toEqual(['aspect', 'ring', 'hole', 'area']);
    expect(checks.map((c) => c.tone)).toEqual(['ok', 'ok', 'ok', 'neutral']);
    expect(checks[0]).toMatchObject({
      label: '深径比',
      value: fmtNum(4),
      unit: 'L / D',
    });
    expect(checks[1]).toMatchObject({
      label: '环宽',
      value: fmtNum(0.1),
      unit: 'mm',
    });
    expect(checks[2]).toMatchObject({
      label: '成品孔径',
      value: '0.4',
      unit: 'mm',
    });
    expect(checks[3].label).toBe('镀层截面');
    expect(checks[3].unit).toBe('mm²');
    expect(checks[3].note).toContain('π(D + T)·T');
    expect(checks[1].note).toContain('≥ 0.05 mm');
    expect(checks[2].note).toContain('≥ 0.2 mm');
  });

  it('工艺检查：深径比 > 10 且环宽 < 0.05 时转为 warn', () => {
    const checks = buildViaChecks(
      resultOf({ holeMm: 0.2, padMm: 0.22, lengthMm: 3.2 }),
      checkOptions(0.2),
    );

    expect(checks[0].tone).toBe('warn');
    expect(checks[1].tone).toBe('warn');
    expect(checks[0].note).toContain('需与板厂复核');
    expect(checks[1].note).toContain('需与板厂复核');
    expect(checks.filter((c) => c.tone === 'warn')).toHaveLength(2);
  });

  it('工艺检查：成品孔径低于规则下限时告警', () => {
    const checks = buildViaChecks(
      resultOf({ holeMm: 0.15, padMm: 0.3, lengthMm: 1.5 }),
      checkOptions(0.15),
    );

    expect(checks[0].tone).toBe('ok');
    expect(checks[1].tone).toBe('ok');
    expect(checks[2].tone).toBe('warn');
    expect(checks[2].note).toContain('< 0.2 mm');
  });

  it('工艺检查：阈值边界按 ≤ 10 / ≥ 0.05 / ≥ 0.2 判定', () => {
    expect(VIA_RULE_PRESETS.standard.rules).toEqual({
      maxAspectRatio: 10,
      minAnnularRingMm: 0.05,
      minHoleMm: 0.2,
    });

    const aspectAtLimit = buildViaChecks(resultOf({ holeMm: 0.3, lengthMm: 3 }), checkOptions(0.3));
    expect(aspectAtLimit[0].tone).toBe('ok');

    const ringAtLimit = buildViaChecks(resultOf({ padMm: 0.5 }), checkOptions());
    expect(ringAtLimit[1].tone).toBe('ok');

    const holeAtLimit = buildViaChecks(resultOf({ holeMm: 0.2, padMm: 0.5 }), checkOptions(0.2));
    expect(holeAtLimit[2].tone).toBe('ok');
  });

  it('工艺检查：英制显示 mil 与对应阈值', () => {
    const checks = buildViaChecks(resultOf(), checkOptions(0.4, standardRules, 'imperial'));

    expect(checks[1]).toMatchObject({ label: '环宽', value: '3.937', unit: 'mil' });
    expect(checks[2]).toMatchObject({ label: '成品孔径', value: '15.748', unit: 'mil' });
    expect(checks[1].note).toContain('≥ 1.969 mil');
    expect(checks[2].note).toContain('≥ 7.874 mil');
    expect(checks[3].unit).toBe('mm²');
  });

  it('工艺检查：自定义规则会改变选中状态', () => {
    const customRules: ViaRuleSet = {
      maxAspectRatio: 12,
      minAnnularRingMm: 0.15,
      minHoleMm: 0.35,
    };
    const checks = buildViaChecks(resultOf(), checkOptions(0.4, customRules));

    expect(checks.map((c) => c.tone)).toEqual(['ok', 'warn', 'ok', 'neutral']);
    expect(checks[1].note).toContain('< 0.15 mm');
  });

  it('深径比显示消除 mm↔mil 往返噪声', () => {
    expect(formatAspectRatio(4.00001)).toBe('4');
    expect(formatAspectRatio(6.3456)).toBe('6.346');
    expect(formatAspectRatio(Number.NaN)).toBe('—');
  });

  it('指标分组：两组各 6 项，标签不重复，保证 3×2 卡片网格完整', () => {
    const groups = buildViaMetricGroups(resultOf(), { z0: '50', dT: '10', freq: '500' });

    expect(groups.map((g) => g.id)).toEqual(['dc', 'highspeed']);
    expect(groups.map((g) => g.label)).toEqual(['DC / THERMAL', 'HIGH-SPEED']);
    expect(groups.every((g) => g.items.length === 6)).toBe(true);

    const labels = groups.flatMap((g) => g.items.map((m) => m.label));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('指标值来自求解结果，频率与输入条件正确映射', () => {
    const result = resultOf();
    const groups = buildViaMetricGroups(result, { z0: '50', dT: '10', freq: '500' });
    const dc = groups[0]!.items;
    const hs = groups[1]!.items;

    expect(dc[0]).toMatchObject({
      label: '镀层电阻',
      value: fmtNum(result.resistance * 1e3),
      unit: 'mΩ',
    });
    expect(dc[1]!.value).toBe(fmtNum(result.voltageDrop * 1e3));
    expect(dc[2]!.value).toBe(fmtNum(result.power * 1e3));
    expect(dc[3]!.value).toBe(fmtNum(result.thermalResistance));
    expect(dc[4]!.value).toBe(fmtNum(result.currentEstimate));
    expect(hs[2]).toMatchObject({
      label: '感抗',
      note: '@ 500 MHz',
      value: fmtNum(result.reactanceOhm),
    });
    expect(hs[4]!.value).toBe(fmtNum(result.systemRisePs));
  });

  it('输入条件卡弱化显示；空值显示占位符', () => {
    const groups = buildViaMetricGroups(resultOf(), { z0: '', dT: '', freq: '500' });
    const dt = groups[0]!.items.find((m) => m.label === '允许温升')!;
    const z0 = groups[1]!.items.find((m) => m.label === '目标阻抗')!;

    expect(dt).toMatchObject({ value: '—', unit: '°C', muted: true });
    expect(z0).toMatchObject({ value: '—', unit: 'Ω', muted: true });
    expect(groups.flatMap((g) => g.items).filter((m) => m.muted)).toHaveLength(2);
    expect(groups.flatMap((g) => g.items).filter((m) => !m.muted)).toHaveLength(10);
  });

  it('剖面几何：默认孔径/焊盘/镀层比例', () => {
    const g = buildViaFigureGeometry(0.4, 0.6, 0.035);

    expect(g.padRadius).toBe(31);
    expect(g.barrelLeft).toBe(92);
    expect(g.barrelRight).toBe(116);
    expect(g.holeRadius).toBeCloseTo((31 * 0.4) / 0.6, 10);
    expect(g.wall).toBeCloseTo(2.1, 10);
    expect(g.innerLeft).toBeCloseTo(94.1, 10);
    expect(g.innerRight).toBeCloseTo(113.9, 10);
    expect(g.innerWidth).toBeCloseTo(19.8, 10);
  });

  it('剖面几何：孔半径与镀层厚度夹紧在可读范围', () => {
    expect(buildViaFigureGeometry(0.01, 10, 0.001).holeRadius).toBe(3);
    expect(buildViaFigureGeometry(0.59, 0.6, 0.035).holeRadius).toBe(27);
    expect(buildViaFigureGeometry(0.4, 0.6, 0.001).wall).toBe(2);
    expect(buildViaFigureGeometry(0.4, 0.6, 1).wall).toBe(6);
  });

  it('剖面几何：非法数值也保持可渲染', () => {
    const g = buildViaFigureGeometry(Number.NaN, Number.NaN, Number.NaN);

    expect(g.holeRadius).toBe(3);
    expect(g.wall).toBe(2);
    expect(g.innerWidth).toBeGreaterThanOrEqual(1);
  });
});
