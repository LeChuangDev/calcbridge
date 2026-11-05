import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CUSTOM_RULE_FIELDS,
  VIA_RULE_PRESETS,
  resolveViaRules,
  ruleLabel,
  viaRuleSummary,
} from './viaRules';

describe('过孔工艺规则', () => {
  it('内置预置规则与标签', () => {
    expect(VIA_RULE_PRESETS.standard.rules).toEqual({
      maxAspectRatio: 10,
      minAnnularRingMm: 0.05,
      minHoleMm: 0.2,
    });
    expect(VIA_RULE_PRESETS.hdi.rules).toEqual({
      maxAspectRatio: 8,
      minAnnularRingMm: 0.05,
      minHoleMm: 0.1,
    });
    expect(ruleLabel('standard')).toBe('常规板');
    expect(ruleLabel('hdi')).toBe('高密度板');
    expect(ruleLabel('custom')).toBe('自定义');
  });

  it('自定义规则覆盖预置值', () => {
    expect(
      resolveViaRules('custom', {
        maxAspectRatio: '12',
        minAnnularRingMm: '0.08',
        minHoleMm: '0.15',
      }),
    ).toEqual({
      maxAspectRatio: 12,
      minAnnularRingMm: 0.08,
      minHoleMm: 0.15,
    });
  });

  it('自定义规则非法时回退到常规板阈值', () => {
    expect(
      resolveViaRules('custom', {
        maxAspectRatio: 'abc',
        minAnnularRingMm: '-1',
        minHoleMm: '',
      }),
    ).toEqual(VIA_RULE_PRESETS.standard.rules);

    expect(resolveViaRules('custom', DEFAULT_CUSTOM_RULE_FIELDS)).toEqual(
      VIA_RULE_PRESETS.standard.rules,
    );
  });

  it('规则摘要按当前单位制显示', () => {
    expect(viaRuleSummary(VIA_RULE_PRESETS.standard.rules, 'metric')).toBe(
      'AR ≤ 10 · 环宽 ≥ 0.05 mm · 孔径 ≥ 0.2 mm',
    );
    expect(viaRuleSummary(VIA_RULE_PRESETS.standard.rules, 'imperial')).toBe(
      'AR ≤ 10 · 环宽 ≥ 1.969 mil · 孔径 ≥ 7.874 mil',
    );
  });
});
