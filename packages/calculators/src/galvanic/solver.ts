/**
 * 电偶腐蚀快速评估：基于 MIL-STD-889 系列阳极指数（Anodic Index）差值。
 * 指数值越高越阳极；差值越大，电偶腐蚀风险越高。
 * 环境允许差值：受控 0.50V，一般 0.25V，海洋/严苛 0.15V。
 * 指数表转录自 AZOM / Engineers Edge 公开表；具体设计仍应按 ASTM G82、
 * MIL-STD-889C 原文与实际镀层体系复核。
 */

export interface Metal {
  id: string;
  name: string;
  symbol: string;
  index: number;
}

export const METALS: Metal[] = [
  { id: 'gold', name: '金（镀金）', symbol: 'Au', index: 0.0 },
  { id: 'silver', name: '银', symbol: 'Ag', index: 0.15 },
  { id: 'nickel', name: '镍', symbol: 'Ni', index: 0.3 },
  { id: 'copper', name: '铜', symbol: 'Cu', index: 0.35 },
  { id: 'brass', name: '黄铜 / 青铜', symbol: 'CuZn', index: 0.4 },
  { id: 'tin', name: '锡（镀锡 / 焊锡）', symbol: 'Sn', index: 0.65 },
  { id: 'lead', name: '铅（含铅合金）', symbol: 'Pb', index: 0.7 },
  { id: 'aluminum', name: '铝（2xxx 系锻铝）', symbol: 'Al', index: 0.75 },
  { id: 'steel', name: '钢 / 铁（低碳钢）', symbol: 'Fe', index: 0.85 },
  { id: 'zinc', name: '锌（热镀锌）', symbol: 'Zn', index: 1.25 },
];

export type Environment = 'controlled' | 'normal' | 'harsh';

/** MIL-STD-889 常用筛选阈值：受控 0.50 V、一般 0.25 V、海洋/严苛 0.15 V。 */
export const ENV_THRESHOLDS: Record<Environment, number> = {
  controlled: 0.5,
  normal: 0.25,
  harsh: 0.15,
};

export type RiskLevel = '低' | '中' | '高';

export interface GalvanicInput {
  metalA: string;
  metalB: string;
  environment: Environment;
}

export interface GalvanicResult {
  metalA: Metal;
  metalB: Metal;
  anode: Metal;
  cathode: Metal;
  difference: number;
  allowed: number;
  ratio: number;
  risk: RiskLevel;
}

export function metalById(id: string): Metal {
  return METALS.find((m) => m.id === id) ?? METALS[0]!;
}

export function solveGalvanic(input: GalvanicInput): GalvanicResult {
  const metalA = metalById(input.metalA);
  const metalB = metalById(input.metalB);
  const anode = metalA.index >= metalB.index ? metalA : metalB;
  const cathode = metalA.index >= metalB.index ? metalB : metalA;
  const difference = Math.abs(metalA.index - metalB.index);
  const allowed = ENV_THRESHOLDS[input.environment];
  const ratio = difference / allowed;
  const risk: RiskLevel = ratio <= 0.75 ? '低' : ratio <= 1 ? '中' : '高';
  return { metalA, metalB, anode, cathode, difference, allowed, ratio, risk };
}
