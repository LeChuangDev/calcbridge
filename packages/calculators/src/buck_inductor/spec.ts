/**
 * Buck 电感计算器（CCM 连续导通模式）。
 *
 * 多输出表达式（exprs）：后序表达式可引用先序输出（如 isatReq 引用 iPeak）。
 * primary = L：反向求解（已知 L 求 fsw 等）与不确定度追踪均以 L 为准。
 *
 * 公式依据 TI AN-1192（Buck 电感选型）：
 *   L(µH) = (Vin - Vout) × Vout / (fsw[Hz] × r × Iout × Vin) × 1e6
 *   ΔI = r × Iout；Ipeak = Iout × (1 + r/2)；Irms = Iout × √(1 + r²/12)
 *   Isat 要求 = Ipeak × derate（饱和电流降额）
 */
import { type CalcSpec } from '@calcbridge/core';

export const BUCK_INDUCTOR_SPEC: CalcSpec = {
  id: 'buck_inductor',
  version: '0.1.0',
  title: 'Buck 电感选型（CCM）',
  assumptions: [
    '连续导通模式（CCM），忽略开关管与二极管压降',
    '电感电流纹波系数 r 取典型值 0.2~0.4（默认 0.3）',
    '饱和电流按峰值电流 × 降额系数（默认 1.2）选取',
    '计算结果为理论参考值，最终需结合器件手册与实测确认（C-3-1）',
  ],
  variables: [
    {
      id: 'Vin',
      unit: 'V',
      role: 'input',
      label: '输入电压',
      default: 12,
      description: 'Buck 输入电压',
    },
    {
      id: 'Vout',
      unit: 'V',
      role: 'input',
      label: '输出电压',
      default: 5,
      description: 'Buck 输出电压',
    },
    {
      id: 'Iout',
      unit: 'A',
      role: 'input',
      label: '输出电流',
      default: 2,
      description: '额定输出电流',
    },
    {
      id: 'fsw',
      unit: 'kHz',
      role: 'input',
      label: '开关频率',
      default: 500,
      domain: { min: 10, max: 5000 },
      description: '开关频率（公式内换算为 Hz）',
    },
    {
      id: 'r',
      unit: 'dimless',
      role: 'input',
      label: '电流纹波系数',
      default: 0.3,
      tolerance: { type: 'pct', value: 0.1 },
      description: '纹波电流与输出电流之比，典型 0.2~0.4',
    },
    {
      id: 'derate',
      unit: 'dimless',
      role: 'input',
      label: '饱和电流降额系数',
      default: 1.2,
      description: 'Isat ≥ 峰值电流 × derate，避免饱和',
    },
    { id: 'L', unit: 'uH', role: 'output', label: '电感量 L', description: '所需电感量' },
    { id: 'deltaI', unit: 'A', role: 'output', label: '纹波电流 ΔI', description: '峰峰纹波电流' },
    {
      id: 'iPeak',
      unit: 'A',
      role: 'output',
      label: '峰值电流 Ipeak',
      description: '电感峰值电流',
    },
    {
      id: 'iRms',
      unit: 'A',
      role: 'output',
      label: '纹波有效值 Irms',
      description: '电感电流有效值（热选型依据）',
    },
    {
      id: 'isatReq',
      unit: 'A',
      role: 'output',
      label: '饱和电流要求 Isat≥',
      description: '电感饱和电流下限',
    },
  ],
  models: [
    {
      id: 'buck_ccm',
      name: 'Buck CCM 电感设计',
      standard: 'TI AN-1192',
      description: '按伏秒平衡推导的电感量公式，含纹波/峰值/有效值/饱和电流要求',
      primary: 'L',
      exprs: {
        L: '(Vin - Vout) * Vout / (fsw * 1000 * r * Iout * Vin) * 1e6',
        deltaI: 'r * Iout',
        iPeak: 'Iout * (1 + r / 2)',
        iRms: 'Iout * sqrt(1 + r^2 / 12)',
        isatReq: 'iPeak * derate',
      },
      source: { kind: 'appnote', docId: 'TI AN-1192', clause: 'CCM 电感选型' },
    },
  ],
  constraints: [
    {
      id: 'r_lo',
      op: 'ge',
      lhs: 'r',
      rhs: '0.2',
      level: 'warning',
      label: '纹波系数过小（r < 0.2，电感偏大）',
    },
    {
      id: 'deltaI_hi',
      op: 'le',
      lhs: 'deltaI',
      rhs: '0.5 * Iout',
      level: 'warning',
      label: '纹波电流偏大（ΔI > 50% Iout）',
    },
  ],
  examples: [
    {
      note: '12V→5V / 2A / 500kHz / r=0.3 典型例',
      in: { Vin: 12, Vout: 5, Iout: 2, fsw: 500, r: 0.3, derate: 1.2 },
      expect: { L: 9.722, deltaI: 0.6, iPeak: 2.3, iRms: 2.0075, isatReq: 2.76 },
    },
    {
      note: '12V→3.3V / 1A / 400kHz / r=0.25',
      in: { Vin: 12, Vout: 3.3, Iout: 1, fsw: 400, r: 0.25, derate: 1.2 },
      expect: { L: 23.925, deltaI: 0.25, iPeak: 1.125, isatReq: 1.35 },
    },
  ],
};
