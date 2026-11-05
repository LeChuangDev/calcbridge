/**
 * 带证据链的值（FR-E2 来源引用 / B-5 参数可信度 / C-3-4 测试条件强绑定 / C-3-1 确认闸门）。
 *
 * 设计原则（对应需求文档约束 #2）：计算内核中不存在裸 number，
 * 所有数值都以 TracedValue 形式存在，来源、可信度、测试条件、确认状态随之传播。
 */

/** 参数可信度分级（B-5）：D=手册确认 S=标称值 M=实测 E=估算 */
export type Grade = 'D' | 'S' | 'M' | 'E';

export type SourceKind =
  | 'standard' // 标准条款（如 IPC-2221B 表 6-1）
  | 'datasheet' // 器件手册（文档号+页码）
  | 'appnote' // 应用笔记（如 TI AN-1192）
  | 'internal' // 公司内部规范
  | 'assumption' // 用户假设
  | 'derived'; // 由计算推导

export interface SourceRef {
  kind: SourceKind;
  /** 文档/标准编号，如 "IPC-2221B" */
  docId?: string;
  /** 条款号或表格号 */
  clause?: string;
  /** 页码 */
  page?: number;
  /** 图号 */
  figure?: string;
  url?: string;
  /** 取数时间戳（外部数据源取数时必带） */
  fetchedAt?: string;
  /** 数据/文档版本 */
  version?: string;
}

export interface ToleranceSpec {
  type: 'abs' | 'pct';
  value: number;
}

export interface TracedValue {
  value: number;
  /** 单位 id（见 dimensions.ts 的 UNITS） */
  unit: string;
  grade: Grade;
  source?: SourceRef;
  /** 测试条件（温度/频率/Vgs/判定阈值…），缺失即视为“条件未知”（C-3-4） */
  conditions?: Record<string, string | number | undefined>;
  tolerance?: ToleranceSpec;
  /** 人工确认闸门（C-3-1）：false 时只能用于“探索”，不得参与安全相关计算 */
  confirmed: boolean;
  note?: string;
}

export function traced(
  value: number,
  unit: string,
  opts: Partial<Omit<TracedValue, 'value' | 'unit'>> = {},
): TracedValue {
  return { value, unit, grade: opts.grade ?? 'E', confirmed: opts.confirmed ?? false, ...opts };
}

/** 安全相关计算使用未确认/估算数据时的警告（B-5） */
export function warnIfUnsafe(tv: TracedValue, safetyRelevant: boolean): string | null {
  if (!safetyRelevant) return null;
  if (!tv.confirmed) return `${tv.unit} 数据未确认（C-3-1），仅可用于探索`;
  if (tv.grade === 'S')
    return `${tv.unit} 为标称值，安全相关计算建议使用手册确认值（D）或实测值（M）`;
  if (tv.grade === 'E') return `${tv.unit} 为估算值，请勿作为安全依据`;
  return null;
}
