/**
 * 电偶腐蚀快速评估：基于常用阳极指数（Anodic Index）差值。
 * 指数值越高越阳极；差值越大，电偶腐蚀风险越高。
 * 环境允许差值：受控 0.60V，一般 0.50V，海洋/严苛 0.25V。
 * 数据为工程参考值，具体设计应按 ASTM G82 / 实际环境与镀层体系复核。
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
  { id: 'brass', name: '黄铜', symbol: 'CuZn', index: 0.4 },
  { id: 'tin', name: '锡（镀锡）', symbol: 'Sn', index: 0.4 },
  { id: 'lead', name: '铅', symbol: 'Pb', index: 0.45 },
  { id: 'steel', name: '钢 / 铁', symbol: 'Fe', index: 0.55 },
  { id: 'aluminum', name: '铝', symbol: 'Al', index: 0.75 },
  { id: 'zinc', name: '锌（镀锌）', symbol: 'Zn', index: 0.95 },
];

export type Environment = 'controlled' | 'normal' | 'harsh';

export const ENV_THRESHOLDS: Record<Environment, number> = {
  controlled: 0.6,
  normal: 0.5,
  harsh: 0.25,
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
