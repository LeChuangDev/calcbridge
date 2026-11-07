/**
 * 过孔工艺规则：预设 + 自定义。规则阈值统一按 mm 存储，
 * 展示时再按当前单位制换算。
 */
import { formatMeasurement, type ViaUnitSystem } from '@/features/calculator-via/model/viaUnits';

export type ViaRuleId = 'standard' | 'hdi' | 'custom';

export interface ViaRuleSet {
  /** 最大深径比 L / D */
  maxAspectRatio: number;
  /** 最小环宽，mm */
  minAnnularRingMm: number;
  /** 最小成品孔径，mm */
  minHoleMm: number;
}

export interface ViaRulePreset {
  id: Exclude<ViaRuleId, 'custom'>;
  label: string;
  rules: ViaRuleSet;
}

export const VIA_RULE_PRESETS: Record<Exclude<ViaRuleId, 'custom'>, ViaRulePreset> = {
  standard: {
    id: 'standard',
    label: '常规板',
    rules: { maxAspectRatio: 10, minAnnularRingMm: 0.05, minHoleMm: 0.2 },
  },
  hdi: {
    id: 'hdi',
    label: '高密度板',
    rules: { maxAspectRatio: 8, minAnnularRingMm: 0.05, minHoleMm: 0.1 },
  },
};

export interface ViaCustomRuleFields {
  maxAspectRatio: string;
  minAnnularRingMm: string;
  minHoleMm: string;
}

export const DEFAULT_CUSTOM_RULE_FIELDS: ViaCustomRuleFields = {
  maxAspectRatio: String(VIA_RULE_PRESETS.standard.rules.maxAspectRatio),
  minAnnularRingMm: String(VIA_RULE_PRESETS.standard.rules.minAnnularRingMm),
  minHoleMm: String(VIA_RULE_PRESETS.standard.rules.minHoleMm),
};

export function ruleLabel(id: ViaRuleId): string {
  return id === 'custom' ? '自定义' : VIA_RULE_PRESETS[id].label;
}

function positive(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** 自定义规则非法或为空时回退到常规板对应阈值。 */
export function resolveViaRules(id: ViaRuleId, custom: ViaCustomRuleFields): ViaRuleSet {
  if (id === 'standard') return VIA_RULE_PRESETS.standard.rules;
  if (id === 'hdi') return VIA_RULE_PRESETS.hdi.rules;

  const fallback = VIA_RULE_PRESETS.standard.rules;
  return {
    maxAspectRatio: positive(custom.maxAspectRatio, fallback.maxAspectRatio),
    minAnnularRingMm: positive(custom.minAnnularRingMm, fallback.minAnnularRingMm),
    minHoleMm: positive(custom.minHoleMm, fallback.minHoleMm),
  };
}

/** 规则卡片摘要，环宽/孔径按当前单位制显示。 */
export function viaRuleSummary(rules: ViaRuleSet, system: ViaUnitSystem): string {
  return [
    `AR ≤ ${rules.maxAspectRatio}`,
    `环宽 ≥ ${formatMeasurement(rules.minAnnularRingMm, system === 'imperial' ? 'mil' : 'mm')}`,
    `孔径 ≥ ${formatMeasurement(rules.minHoleMm, system === 'imperial' ? 'mil' : 'mm')}`,
  ].join(' · ');
}
