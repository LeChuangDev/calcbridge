/**
 * 电阻计算器：串联 / 并联 / 分压（空载）。
 *
 * 三个并列模型（FR-A-4 多标准并存）：同一组输入可切换模型求不同结果。
 */
import { type CalcSpec } from '@calcbridge/core';

export const RESISTOR_SPEC: CalcSpec = {
  id: 'resistor_calc',
  version: '0.1.0',
  title: '电阻计算器',
  assumptions: [
    '理想电阻，忽略引线电阻、寄生电感/电容与温度系数',
    '串联/并联按直流等效阻值计算；分压按空载输出（不带负载）计算',
    '实际电路需另行校核功率（P = I²R 或 U²/R）与耐压',
  ],
  variables: [
    { id: 'R1', unit: 'ohm', role: 'input', label: '电阻 R1', default: 1000 },
    { id: 'R2', unit: 'ohm', role: 'input', label: '电阻 R2', default: 2000 },
    { id: 'Vin', unit: 'V', role: 'input', label: '输入电压 Vin', default: 12 },
    { id: 'Rs', unit: 'ohm', role: 'output', label: '串联阻值 Rs' },
    { id: 'Rp', unit: 'ohm', role: 'output', label: '并联阻值 Rp' },
    { id: 'Vdiv', unit: 'V', role: 'output', label: '分压输出 Vout' },
  ],
  models: [
    {
      id: 'series',
      name: '串联',
      standard: '欧姆定律',
      description: 'Rs = R1 + R2',
      expr: 'Rs = R1 + R2',
    },
    {
      id: 'parallel',
      name: '并联',
      standard: '欧姆定律',
      description: 'Rp = R1 × R2 / (R1 + R2)',
      expr: 'Rp = R1 * R2 / (R1 + R2)',
    },
    {
      id: 'divider',
      name: '分压',
      standard: '串联分压',
      description: 'Vout = Vin × R2 / (R1 + R2)',
      expr: 'Vdiv = Vin * R2 / (R1 + R2)',
    },
  ],
  constraints: [],
  examples: [
    {
      note: '1 kΩ 与 2 kΩ 串联 → 3 kΩ',
      models: ['series'],
      in: { R1: 1000, R2: 2000 },
      expect: { Rs: 3000 },
    },
    {
      note: '1 kΩ 与 2 kΩ 并联 → 666.67 Ω',
      models: ['parallel'],
      in: { R1: 1000, R2: 2000 },
      expect: { Rp: 666.6667 },
    },
    {
      note: '12 V 经 1 kΩ/2 kΩ 分压 → 8 V',
      models: ['divider'],
      in: { Vin: 12, R1: 1000, R2: 2000 },
      expect: { Vdiv: 8 },
    },
  ],
};
