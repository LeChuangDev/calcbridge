/**
 * 计算依据与可信度元数据（任务 1.1 / 1.5 的基础设施）。
 *
 * 每个模块登记：主要依据、条款/公式、模型类别、可信度等级与误差带。
 * 界面、报告与后续对标用例都从这里读取，避免“文档一套、界面一套”。
 */
export type ModelClass = 'analytic' | 'empirical' | 'lookup' | 'reference';
export type ConfidenceLevel = 'theoretical' | 'estimate' | 'reference';

export interface ModuleStandard {
  /** 与 navModel 的 calcId 一致 */
  id: string;
  /** 主要依据（标准号 / 手册 / 经典文献） */
  basis: string;
  /** 条款或核心公式 */
  clause: string;
  modelClass: ModelClass;
  confidence: ConfidenceLevel;
  /** 与外部基准对比时的可接受误差带；查表/规范类用文字说明 */
  errorBand: string;
  /** 适用边界与已知局限 */
  boundary: string;
}

export const MODULE_STANDARDS: Record<string, ModuleStandard> = {
  regulator_3term: {
    id: 'regulator_3term',
    basis: '三端可调稳压器厂商数据手册（LM317 / LM1117-ADJ 系列）',
    clause: 'Vout = Vref × (1 + R2/R1) + Iadj × R2',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤1%',
    boundary: '不含压差、结温与散热设计；Vref/Iadj 取数据手册典型值。',
  },
  resistor_calc: {
    id: 'resistor_calc',
    basis: '欧姆定律与串并联网络理论',
    clause: 'R = U/I；串联求和、并联倒数和',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤1%',
    boundary: '分压按空载计算，不含负载效应与电阻容差。',
  },
  buck_inductor: {
    id: 'buck_inductor',
    basis: 'TI AN-1192 Buck 电感选型方法',
    clause: 'L = (Vin − Vout) × Vout / (fsw × r × Iout × Vin)',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤2%',
    boundary: '仅覆盖 CCM；忽略开关管与二极管压降、开关损耗与磁芯饱和特性。',
  },
  cable_size: {
    id: 'cable_size',
    basis: '双线回路电压降公式（基础电路理论）',
    clause: 'ΔV = 2 × I × ρ × L / A',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤2%',
    boundary: '仅按允许压降选型，不含载流量、绝缘耐压、敷设与温度校正。',
  },
  led_resistor: {
    id: 'led_resistor',
    basis: '欧姆定律 + IEC 60063 E 系列标准值',
    clause: 'R = (Vin − n × Vf) / If',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤2%',
    boundary: '恒压降模型，不含 Vf 随电流/温度漂移与批次离散；并联 LED 必须各自串阻。',
  },
  trace_current: {
    id: 'trace_current',
    basis: 'IPC-2221B 表 6-1 公式法 + IPC-2152 图表法（近似）',
    clause: 'I = k × ΔT^0.44 × A^0.725（外层 k=0.048 / 内层 k=0.024）',
    modelClass: 'empirical',
    confidence: 'estimate',
    errorBand: '±10%~20%（经验公式与图表插值）',
    boundary: 'IPC-2152 曲线为近似数据；不含铜面散热、阻焊、气流与叠层差异。',
  },
  clearance: {
    id: 'clearance',
    basis: 'IPC-2221B 表 6-1 最小电气间隙',
    clause: '按电压档位与 B1–B4 / A5–A7 条件查表',
    modelClass: 'lookup',
    confidence: 'reference',
    errorBand: '逐档一致（不适用百分比）',
    boundary: '仅覆盖 IPC-2221 电气间隙；安规爬电距离需按 IEC 60664-1 / GB/T 16935.1。',
  },
  via: {
    id: 'via',
    basis: 'IPC-2221B / IPC-2152 工程估算',
    clause: '镀层电阻、热阻、载流与寄生参数近似式',
    modelClass: 'empirical',
    confidence: 'estimate',
    errorBand: '±15%',
    boundary: '不含镀层体系差异、实际散热与高频场分布；工艺规则为示例阈值。',
  },
  fuse: {
    id: 'fuse',
    basis: '绝热能量平衡 I²t 模型',
    clause: 'I²t = A² × t（绝热假设）',
    modelClass: 'empirical',
    confidence: 'estimate',
    errorBand: '±20%',
    boundary: '不含散热、镀层体系与实际介质；熔断时间需实测确认。',
  },
  impedance_microstrip: {
    id: 'impedance_microstrip',
    basis: 'IPC-2141A + Hammerstad–Jensen 闭式模型',
    clause: '单端微带线 Z0、εeff 闭式解与厚度修正',
    modelClass: 'empirical',
    confidence: 'estimate',
    errorBand: '±5%（对场解算）；闭式模型标称 ±1%~2%',
    boundary: '准静态模型，不含阻焊、铜箔粗糙度、频变 Dk/Df 与差分/共面结构。',
  },
  rf_attenuator: {
    id: 'rf_attenuator',
    basis: 'Pi / T 无源衰减网络理论',
    clause: '按端接阻抗求解串联/并联元件值',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤1%',
    boundary: '仅覆盖可实现的 Pi / T 无源网络，不含寄生与宽带匹配。',
  },
  waveguide: {
    id: 'waveguide',
    basis: '矩形波导 TE10 单模公式',
    clause: 'fc = c / (2a)；λg、vp、vg、ZTE 由 fc 与 f 推导',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤1%',
    boundary: '仅空气填充、理想导体壁，忽略壁损与高次模。',
  },
  skin_depth: {
    id: 'skin_depth',
    basis: '经典电磁学趋肤效应公式',
    clause: 'δ = √(ρ / (π × f × μ))',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '≤1%',
    boundary: '单侧趋肤近似（铜 μr≈1），不含粗糙度、邻近效应与差分耦合。',
  },
  pcb_class: {
    id: 'pcb_class',
    basis: 'IPC-6012 性能类别（Class 1/2/3）',
    clause: '按性能类别与验收要求对照',
    modelClass: 'reference',
    confidence: 'reference',
    errorBand: '不适用（规范参考）',
    boundary: '仅作类别概要参考，不替代标准原文与认证结论。',
  },
  substrate: {
    id: 'substrate',
    basis: 'IPC-4101 基材分类与厂商典型值',
    clause: '按基材类别对照 Tg、Dk、Df、CTE、导热率',
    modelClass: 'reference',
    confidence: 'reference',
    errorBand: '不适用（典型范围）',
    boundary: '材料参数随厂家牌号、频率与工艺变化，不可直接作为验收依据。',
  },
  galvanic: {
    id: 'galvanic',
    basis: '电偶序与阳极指数差值法',
    clause: 'Δ 阳极指数 + 环境阈值评估',
    modelClass: 'empirical',
    confidence: 'estimate',
    errorBand: '定性参考',
    boundary: '不含实际电解液浓度、温度、面积比与涂层完整性。',
  },
  unit_converter: {
    id: 'unit_converter',
    basis: '国际单位制（SI）与温度偏移定义',
    clause: '换算系数与温标偏移',
    modelClass: 'analytic',
    confidence: 'theoretical',
    errorBand: '精确',
    boundary: '仅单位换算，不含工程舍入规则。',
  },
  color_code: {
    id: 'color_code',
    basis: 'IEC 60062 色环编码',
    clause: '4 环 / 5 环色码解码与容差',
    modelClass: 'lookup',
    confidence: 'reference',
    errorBand: '精确',
    boundary: '仅标准色环编码，不含厂商特殊标识。',
  },
  e_series: {
    id: 'e_series',
    basis: 'IEC 60063 优先数系列',
    clause: 'E1 / E3 / E6 / E12 / E24 标准值',
    modelClass: 'lookup',
    confidence: 'reference',
    errorBand: '精确',
    boundary: '当前仅覆盖电阻串并联组合，电容/电感扩展需另行声明系列范围。',
  },
};

export function standardOf(moduleId: string | null | undefined): ModuleStandard | undefined {
  return moduleId ? MODULE_STANDARDS[moduleId] : undefined;
}

export const MODEL_CLASS_LABEL: Record<ModelClass, string> = {
  analytic: '理论公式',
  empirical: '经验/近似',
  lookup: '标准查表',
  reference: '规范参考',
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  theoretical: '理论计算值',
  estimate: '工程估算值',
  reference: '规范参考值',
};
