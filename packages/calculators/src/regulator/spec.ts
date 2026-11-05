/**
 * 稳压器（三端可调）计算器。
 *
 * 数据手册典型应用电路：
 *   Vout = Vref × (1 + R2 / R1) + Iadj × R2
 * R1、R2 以 kΩ 声明，Iadj 以 µA 声明；Iadj·R2 = (µA × kΩ) = mV，
 * 故公式内 Iadj * R2 / 1000 换算为 V。
 *
 * 反向求解（R1 / R2）由内核数值求根完成，不写反向公式。
 */
import { type CalcSpec } from '@calcbridge/core';

export const REGULATOR_SPEC: CalcSpec = {
  id: 'regulator_3term',
  version: '0.1.0',
  title: '稳压器（三端可调）',
  assumptions: [
    '三端可调线性稳压器（如 LM317 / LM1117-ADJ），Vref 与 Iadj 取自器件数据手册',
    '按数据手册典型应用电路计算：Vout = Vref × (1 + R2/R1) + Iadj × R2',
    'R1 为基准电阻（LM317 手册典型 240 Ω），R2 为调整电阻',
    '忽略压差（Dropout）、温漂、负载调整率与最小负载电流限制，工程估算需结合手册与实测',
  ],
  variables: [
    { id: 'Vout', unit: 'V', role: 'output', label: '输出电压 Vout' },
    { id: 'Vref', unit: 'V', role: 'input', label: '基准电压 Vref', default: 1.25 },
    {
      id: 'R1',
      unit: 'kohm',
      role: 'input',
      label: '基准电阻 R1',
      default: 0.24,
      domain: { min: 1e-4, max: 1e3 },
      description: 'LM317 手册典型 240 Ω，过小会增加静态电流',
    },
    {
      id: 'R2',
      unit: 'kohm',
      role: 'input',
      label: '调整电阻 R2',
      default: 0.72,
      domain: { min: 1e-4, max: 1e4 },
      description: '由目标输出电压决定',
    },
    {
      id: 'Iadj',
      unit: 'uA',
      role: 'input',
      label: '调整端电流 Iadj',
      default: 50,
      description: 'LM317 典型 50 µA、最大 100 µA',
    },
  ],
  models: [
    {
      id: 'three_terminal',
      name: '三端可调稳压器',
      standard: '器件数据手册典型应用',
      clause: 'Vout = Vref × (1 + R2/R1) + Iadj × R2',
      description: '可调端分压公式，含调整端电流影响项',
      expr: 'Vout = Vref * (1 + R2 / R1) + Iadj * R2 / 1000',
      source: { kind: 'datasheet', docId: 'LM317 / LM1117-ADJ', clause: 'Typical Application' },
    },
  ],
  constraints: [
    {
      id: 'r1_min',
      op: 'ge',
      lhs: 'R1',
      rhs: '0.1',
      level: 'warning',
      label: 'R1 < 0.1 kΩ：静态电流偏大，且可能低于最小负载要求',
    },
  ],
  examples: [
    {
      note: 'LM317 典型：Vref=1.25 V，R1=240 Ω，R2=720 Ω，Iadj=50 µA → 5.036 V',
      in: { Vref: 1.25, R1: 0.24, R2: 0.72, Iadj: 50 },
      expect: { Vout: 5.036 },
    },
    {
      note: 'Vref=1.25 V，R1=240 Ω，R2=1 kΩ，Iadj=50 µA → 6.508 V',
      in: { Vref: 1.25, R1: 0.24, R2: 1.0, Iadj: 50 },
      expect: { Vout: 6.5083 },
    },
  ],
};
