/**
 * 工具目录的单一数据源：左侧分类树、首页工具卡片、命令面板共用同一份元数据。
 * 这里只放数据（不含 React 组件），便于 Fast Refresh 稳定工作。
 */

export interface ToolMeta {
  /** 导航项 id（同一计算器在不同分类下可复用） */
  id: string;
  label: string;
  /** 计算器 id，对应 CALCULATOR_REGISTRY 或独立面板 */
  calcId: string;
  /** 一句话说明，用于首页卡片与搜索结果 */
  desc: string;
  /** 搜索关键词（标准号、别名、英文缩写等） */
  keywords?: string[];
}

export interface TreeGroup {
  id: string;
  label: string;
  items: ToolMeta[];
}

/** 首页「工具目录」的路由 id */
export const HOME_ID = 'home';

export const CALC_TREE: TreeGroup[] = [
  {
    id: 'circuit',
    label: '电路与电源',
    items: [
      {
        id: 'reg',
        label: '稳压器',
        calcId: 'regulator_3term',
        desc: '三端可调稳压器 Vout 与 R1/R2 正反解，含最小/典型/最大与精度容差',
        keywords: ['LDO', 'LM317', '分压', 'regulator'],
      },
      {
        id: 'res',
        label: '电阻计算器',
        calcId: 'resistor_calc',
        desc: '串联 / 并联 / 分压（空载）等效阻值与分压比',
        keywords: ['串并联', '分压', 'resistor'],
      },
      {
        id: 'buck',
        label: 'Buck 电感选型',
        calcId: 'buck_inductor',
        desc: 'CCM 电感量、纹波、峰值/有效值与饱和电流要求',
        keywords: ['DCDC', '纹波', 'inductor'],
      },
      {
        id: 'cable',
        label: '线缆尺寸',
        calcId: 'cable_size',
        desc: '按允许电压降选择标准公制线径（铜/铝，双线回路）',
        keywords: ['线径', '压降', 'cable', 'AWG'],
      },
      {
        id: 'led',
        label: 'LED 限流电阻',
        calcId: 'led_resistor',
        desc: '串联 LED 限流阻值、E12/E24 标准值选型与功耗降额',
        keywords: ['LED', '限流', '电阻', 'E24'],
      },
    ],
  },
  {
    id: 'pcb',
    label: 'PCB 与制造',
    items: [
      {
        id: 'trace',
        label: '走线宽度（载流）',
        calcId: 'trace_current',
        desc: 'IPC-2221B 公式法与 IPC-2152 图表法，并给出电阻、压降、功耗',
        keywords: ['载流', '线宽', 'IPC-2221', 'IPC-2152', 'ampacity'],
      },
      {
        id: 'clr',
        label: '电气间隙',
        calcId: 'clearance',
        desc: 'IPC-2221 最小电气间隙查表（B1–B4 / A5–A7）',
        keywords: ['间距', 'clearance', 'IPC-2221'],
      },
      {
        id: 'via',
        label: '过孔参数',
        calcId: 'via',
        desc: '镀层电阻、压降、功耗、热阻、载流估算与工艺规则检查',
        keywords: ['过孔', 'via', '载流', '镀层'],
      },
      {
        id: 'fuse',
        label: '熔断电流',
        calcId: 'fuse',
        desc: '绝热能量平衡估算熔断电流与熔断时间',
        keywords: ['熔断', 'fuse', 'OCP'],
      },
    ],
  },
  {
    id: 'highspeed',
    label: '高速与射频',
    items: [
      {
        id: 'imp',
        label: '传输线（受控阻抗）',
        calcId: 'impedance_microstrip',
        desc: '单端微带线多模型并列，支持正向 Z0 与反向线宽求解',
        keywords: ['阻抗', '微带线', 'impedance', 'IPC-2141', 'Z0'],
      },
      {
        id: 'rf',
        label: '射频衰减器',
        calcId: 'rf_attenuator',
        desc: 'Pi / T 无源衰减网络设计，含实际端接阻抗与衰减校验',
        keywords: ['衰减', 'Pi', 'T', 'attenuator', 'RF'],
      },
      {
        id: 'wg',
        label: '矩形波导',
        calcId: 'waveguide',
        desc: '空气填充矩形波导 TE10 截止频率、导波波长与波阻抗',
        keywords: ['波导', 'waveguide', 'TE10'],
      },
      {
        id: 'skin',
        label: '趋肤深度',
        calcId: 'skin_depth',
        desc: '高频趋肤深度、有效导电厚度与 Rac/Rdc 比值估算',
        keywords: ['趋肤', 'skin depth', '高频', 'Rac'],
      },
    ],
  },
  {
    id: 'reference',
    label: '参考与规范',
    items: [
      {
        id: 'pcbclass',
        label: '电路板类别',
        calcId: 'pcb_class',
        desc: 'IPC-6012 Class 1/2/3 性能类别概要参考',
        keywords: ['IPC-6012', 'class', '性能类别'],
      },
      {
        id: 'substrate',
        label: '板材分类',
        calcId: 'substrate',
        desc: 'FR-4 / CEM / 金属基 / 高频 / 陶瓷 / 柔性基材对照',
        keywords: ['板材', 'FR-4', 'Tg', 'Dk', 'substrate'],
      },
      {
        id: 'galvanic',
        label: '电偶腐蚀',
        calcId: 'galvanic',
        desc: '常用阳极指数差值法与环境阈值快速评估',
        keywords: ['腐蚀', '阳极指数', 'galvanic'],
      },
    ],
  },
  {
    id: 'tools',
    label: '实用工具',
    items: [
      {
        id: 'unit',
        label: '单位换算',
        calcId: 'unit_converter',
        desc: '18 类常用工程单位，含温度偏移换算',
        keywords: ['单位', '换算', 'mm', 'mil', 'oz'],
      },
      {
        id: 'color',
        label: '色环电阻',
        calcId: 'color_code',
        desc: '4/5 环 IEC 60062 解码、容差范围与色环对照表',
        keywords: ['色环', 'IEC-60062', 'color code'],
      },
      {
        id: 'eseries',
        label: 'E 系列组合',
        calcId: 'e_series',
        desc: 'E1/E3/E6/E12/E24 标准值，1–4 个电阻串并联组合搜索',
        keywords: ['E24', 'E96', '标准阻值', '组合'],
      },
    ],
  },
];

export interface FlatTool extends ToolMeta {
  group: string;
  groupId: string;
}

/** 扁平化工具清单（首页目录、命令面板、收藏与最近使用共用） */
export const ALL_TOOLS: FlatTool[] = CALC_TREE.flatMap((g) =>
  g.items.map((it) => ({ ...it, group: g.label, groupId: g.id })),
);

/** 根据计算器 id 找到所属分类名（用于面板顶部面包屑） */
export function groupOf(calcId: string): string | undefined {
  return CALC_TREE.find((g) => g.items.some((it) => it.calcId === calcId))?.label;
}

/** 根据计算器 id 取工具元数据 */
export function toolOf(calcId: string): FlatTool | undefined {
  return ALL_TOOLS.find((t) => t.calcId === calcId);
}

/**
 * 工具全文检索：标签、说明、关键词、分类名与计算器 id 依次加权。
 * 返回按相关度排序的结果（空查询返回空数组）。
 */
export function searchTools(query: string, limit = 12): FlatTool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { tool: FlatTool; score: number }[] = [];
  for (const tool of ALL_TOOLS) {
    let score = 0;
    if (tool.label.toLowerCase().includes(q)) score += 10;
    if (tool.calcId.toLowerCase().includes(q)) score += 8;
    if (tool.keywords?.some((k) => k.toLowerCase().includes(q))) score += 6;
    if (tool.desc.toLowerCase().includes(q)) score += 3;
    if (tool.group.toLowerCase().includes(q)) score += 2;
    if (score > 0) scored.push({ tool, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.tool.label.localeCompare(b.tool.label))
    .slice(0, limit)
    .map((s) => s.tool);
}
