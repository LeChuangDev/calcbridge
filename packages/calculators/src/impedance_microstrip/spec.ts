/**
 * 计算器：受控阻抗（微带线）— impedance_microstrip
 *
 * 场景（需求文档：“PCB SI 工程师：阻抗算完发现工厂做不出来”闭环）：
 *   选叠层 → 求 50Ω 线宽 → 撞到工艺最小线宽，立刻提示换叠层。
 *
 * 依据：IPC-2141 微带线近似式（经典教科书公式，适用 0.1 < w/h < 3，1 < εr < 15）：
 *   Z0 = 87 / √(εr + 1.41) · ln( 5.98·h / (0.8·w + t) )
 *
 * 反向求解（FR-A-3）：给定目标阻抗 Z0 求线宽 w（撞工艺约束即判定不可制造）。
 */
import { type CalcSpec } from '@calcbridge/core';

export const impedanceMicrostripSpec: CalcSpec = {
  id: 'impedance_microstrip',
  version: '1.0.0',
  title: '受控阻抗（微带线）',

  // FR-E-1：强制展示的假设
  assumptions: [
    '微带线模型（IPC-2141 近似式），适用 0.1 < w/h < 3、1 < εr < 15；超出范围须用场解算器复核',
    'εr 为板材标称介电常数（叠层库参考值），随频率升高略降，未计入频率修正',
    '忽略介质损耗与铜箔粗糙度对 Z0 的影响',
    '未计入阻焊/油墨覆盖层（涂覆后阻抗会降低数 Ω）',
    '阻抗公差 ±10% 为工艺档案默认值，需按板厂实际能力复核（FR-D-1）',
  ],

  variables: [
    {
      id: 'w',
      unit: 'mm',
      role: 'input',
      label: '线宽 w',
      default: 0.3,
      tolerance: { type: 'pct', value: 0.1 },
      domain: { min: 0.01, max: 10 },
      description: '待求/已知的走线宽度（FR-A-3 反向求解时可作待求量）',
    },
    {
      id: 'h',
      unit: 'mm',
      role: 'input',
      label: '介质厚度 h',
      default: 0.2,
      domain: { min: 0.05, max: 5 },
      description: '叠层中信号层到参考平面间介质厚度（叠层库取值）',
    },
    {
      id: 't',
      unit: 'mm',
      role: 'input',
      label: '铜厚 t',
      default: 0.035,
      units: ['mm', 'um', 'mil', 'oz'],
      domain: { min: 0.005, max: 0.2 },
      description: '成品铜厚（1oz≈0.035mm）',
    },
    {
      id: 'Er',
      unit: 'dimless',
      role: 'input',
      label: '介电常数 εr',
      default: 4.2,
      tolerance: { type: 'pct', value: 0.05 },
      domain: { min: 1, max: 15 },
      description: '板材 Dk（如 FR4≈4.2，叠层库参考值）',
    },
    {
      id: 'Z0',
      unit: 'ohm',
      role: 'output',
      label: '特性阻抗 Z0',
      description: '由线宽/叠层计算得到的特性阻抗',
    },
    {
      id: 'z0_target',
      unit: 'ohm',
      role: 'input',
      label: '目标阻抗',
      default: 50,
      description: '设计要求（如 50Ω 单端、100Ω 差分的一半）',
    },
    {
      id: 'min_width',
      unit: 'mm',
      role: 'input',
      default: 0.1,
      label: '工厂最小线宽',
      description: '工艺档案约束（FR-D-1）：制造能力下限，由工艺档案注入',
    },
  ],

  models: [
    {
      id: 'ipc2141_microstrip',
      name: 'IPC-2141 微带线近似式',
      standard: 'IPC-2141',
      clause: '经典近似式',
      description: 'Z0 = 87/√(εr+1.41) · ln(5.98h/(0.8w+t))，w/h∈(0.1,3)。',
      expr: 'Z0 = (87 / sqrt(Er + 1.41)) * ln(5.98 * h / (0.8 * w + t))',
      source: { kind: 'standard', docId: 'IPC-2141', clause: '微带线近似式' },
    },
  ],

  // FR-A-8：工艺最小线宽为 blocker；阻抗超公差为 warning（可制造但需换叠层）
  constraints: [
    {
      id: 'min_width_ok',
      op: 'ge',
      lhs: 'w',
      rhs: 'min_width',
      level: 'blocker',
      label: '线宽 ≥ 工厂最小线宽',
    },
    {
      id: 'z0_in_tol',
      op: 'ge',
      lhs: 'Z0',
      rhs: 'z0_target * 0.9',
      level: 'warning',
      label: '阻抗 ≥ 目标 -10%',
    },
    {
      id: 'z0_in_tol_hi',
      op: 'le',
      lhs: 'Z0',
      rhs: 'z0_target * 1.1',
      level: 'warning',
      label: '阻抗 ≤ 目标 +10%',
    },
  ],

  // FR-A-9：算例回归（IPC-2141 近似式数值）
  examples: [
    {
      in: { w: 0.3, h: 0.2, t: 0.035, Er: 4.2 },
      expect: { Z0: 53.995 },
      tol: 0.005,
      note: '0.3mm/0.2mm 介质/1oz，FR4 → ≈54Ω',
    },
    {
      in: { w: 0.34, h: 0.2, t: 0.035, Er: 4.2 },
      expect: { Z0: 49.94 },
      tol: 0.005,
      note: '0.34mm 线宽 → ≈50Ω',
    },
  ],
};
