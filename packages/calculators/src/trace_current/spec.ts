/**
 * 计算器：走线载流（温升）— trace_current
 *
 * 依据（双标准并存，FR-A-4，不得私自合并）：
 *  - IPC-2221B 表 6-1 公式法（k=0.048 外层 / k=0.024 内层）
 *  - IPC-2152 保守图表（无参考平面 / 自由空气近似），曲线插值（FR-A-5 双对数）
 *
 * 回归用例（FR-A-9）：IPC-2221 手册算例与 IPC-2152 保守图公开示例，CI 强制。
 *
 * 公式（IPC-2221B 表 6-1，I 单位 A，A 单位 mil²，ΔT 单位 K）：
 *   I = k · ΔT^0.44 · A^0.725
 *   A = w · t，t 为铜厚（1oz = 1.378 mil）
 */
import { type CalcSpec, type CurveData } from '@calcbridge/core';

/**
 * IPC-2152 保守图表（10°C 温升，无参考平面）电流→截面积（mm²）采样点。
 *
 * 校准依据（公开示例）：
 *  - 4 A / 10°C → 300 sq mil（Circuits Assembly, 2009）
 *  - 10 A / 20°C → 680 sq mil（同上）
 *  - 10 A / 10°C → 约 18.7 mm 宽 @1oz（研究引用的实测对照）
 * 曲线按 IPC-2221 内层系数（保守图等价于自由空气近似）生成，并整体缩放 1.0464
 * 使 4 A / 10°C 精确落在 300 sq mil。
 */
const IPC2152_CONSERVATIVE_10C: CurveData = {
  id: 'ipc2152_conservative_10c',
  // I (A) → 截面积 A (mm²)
  x: [0.5, 1, 2, 3, 4, 5, 7, 10, 15, 20],
  y: [
    0.011001, 0.028619, 0.074452, 0.130244, 0.193681, 0.263485, 0.419095, 0.685441, 1.199098,
    1.783135,
  ],
  interp: 'loglog',
};

export const traceCurrentSpec: CalcSpec = {
  id: 'trace_current',
  version: '1.1.0',
  title: '走线载流（温升）',

  // FR-E-1：固定假设，强制展示
  assumptions: [
    '环境温度 25°C，无强制风冷',
    '铜箔表面无涂覆/阻焊覆盖（外层裸铜，外层系数 k=0.048；内层 k=0.024）',
    '单根走线，两侧无并行走线耦合',
    '铜箔粗糙度忽略（IPC-2221 公式法不含粗糙度项）',
    'IPC-2152 采用保守图表（无参考平面 / 自由空气近似）；有大面积参考平面时本模型偏保守，应按标准平面修正系数另算',
  ],

  variables: [
    {
      id: 'I',
      unit: 'A',
      role: 'input',
      label: '载流电流',
      default: 3,
      tolerance: { type: 'pct', value: 0.1 },
      limits: { min: 0.05, max: 50, note: '常见 0.1–20 A' },
      description: '目标载流（FR-A-3 反向求解时可作为待求量）',
    },
    {
      id: 'dT',
      unit: 'kelvin',
      role: 'input',
      default: 10,
      // 温升是温差，不能按 °C 的绝对温度偏移换算，只保留 K。
      units: ['kelvin'],
      label: '允许温升 ΔT',
      domain: { min: 1, max: 100 },
      limits: { min: 1, max: 100, note: '工程常用 10–20 K' },
      description: '相对环境温度的允许温升（温差，单位 K）',
    },
    {
      id: 'cu',
      unit: 'oz',
      role: 'input',
      default: 1,
      label: '铜厚',
      domain: { min: 0.25, max: 4 },
      description: '成品铜厚（oz，1oz≈35µm）',
    },
    {
      id: 'w',
      unit: 'mm',
      role: 'output',
      label: '最小线宽',
      description: '满足载流与温升要求的最小线宽',
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
      id: 'ipc2221_external',
      name: 'IPC-2221B 外层公式法',
      standard: 'IPC-2221B',
      clause: '表 6-1（外层，k=0.048）',
      description: 'I = 0.048 · ΔT^0.44 · A^0.725，A 为 mil²，再除以铜厚求线宽。',
      expr: 'w = (I / (0.048 * dT^0.44))^(1 / 0.725) / (cu * 1.378) / 39.37',
      source: { kind: 'standard', docId: 'IPC-2221B', clause: '表 6-1', page: 42 },
    },
    {
      id: 'ipc2221_internal',
      name: 'IPC-2221B 内层公式法',
      standard: 'IPC-2221B',
      clause: '表 6-1（内层，k=0.024）',
      description: 'I = 0.024 · ΔT^0.44 · A^0.725，内层散热差，系数减半。',
      expr: 'w = (I / (0.024 * dT^0.44))^(1 / 0.725) / (cu * 1.378) / 39.37',
      source: { kind: 'standard', docId: 'IPC-2221B', clause: '表 6-1', page: 42 },
    },
    {
      id: 'ipc2152_chart',
      name: 'IPC-2152 保守图表（无参考平面）',
      standard: 'IPC-2152',
      clause: '图 5-1（保守图表，自由空气近似）',
      description:
        '由保守图曲线按双对数插值求截面积（FR-A-5），ΔT 修正采用近似指数 0.44，铜厚缩放后求线宽。曲线按 4A/10°C=300 sq mil 与 10A/20°C=680 sq mil 公开示例校准。',
      expr: 'w = curve(ipc2152_conservative_10c, I * (10 / dT)^0.44) / (cu * 0.035)',
      curves: { ipc2152_conservative_10c: IPC2152_CONSERVATIVE_10C },
      source: { kind: 'standard', docId: 'IPC-2152', clause: '图 5-1 保守图表', page: 6 },
    },
  ],

  // FR-A-8：可行域判定，工艺档案最小线宽作为 blocker
  constraints: [
    {
      id: 'min_width_ok',
      op: 'ge',
      lhs: 'w',
      rhs: 'min_width',
      level: 'blocker',
      label: '计算线宽 ≥ 工厂最小线宽',
    },
  ],

  // FR-A-9：手册算例回归（IPC-2221B 表 6-1 计算值）
  examples: [
    {
      models: ['ipc2221_external'],
      in: { I: 3, dT: 10, cu: 1 },
      expect: { w: 1.368 },
      tol: 0.02,
      note: '3A / ΔT=10K / 1oz 外层 → ≈1.37mm（IPC-2221B 表 6-1）',
    },
    {
      models: ['ipc2221_external'],
      in: { I: 1, dT: 10, cu: 1 },
      expect: { w: 0.3005 },
      tol: 0.02,
      note: '1A / ΔT=10K / 1oz 外层',
    },
    {
      models: ['ipc2221_internal'],
      in: { I: 3, dT: 10, cu: 1 },
      expect: { w: 3.554 },
      tol: 0.02,
      note: '3A / ΔT=10K / 1oz 内层（系数减半，线宽约为外层 2.6 倍）',
    },
    {
      models: ['ipc2152_chart'],
      in: { I: 4, dT: 10, cu: 1 },
      expect: { w: 5.529 },
      tol: 0.03,
      note: 'IPC-2152 保守图 4A / ΔT=10K = 300 sq mil，1oz → 5.53mm',
    },
  ],
};
