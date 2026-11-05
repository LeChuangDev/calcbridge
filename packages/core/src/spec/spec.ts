/**
 * 计算器即数据（FR-A-2/A-3/A-4/A-7/A-9/A-10，需求文档约束 #3）。
 *
 * 一个计算器 = 一份 CalcSpec：变量清单、并列的多个模型（多标准并存）、
 * 可行域约束、内置算例（回归用例）。新增或修改计算器不触发主版本发布。
 */
import { type CurveData } from '../expr/eval';
import { type SourceRef } from '../provenance/traced';

export interface VariableSpec {
  id: string;
  /** 声明单位（求解时输入一律换算到该单位） */
  unit: string;
  /** input/output/any：仅作元数据，不影响求解（A-3 任意变量可作已知量） */
  role?: 'input' | 'output' | 'any';
  label?: string;
  /** 缺省值（缺省值必须带声明单位） */
  default?: number;
  /** 容差（不确定度传播用） */
  tolerance?: { type: 'abs' | 'pct'; value: number };
  /** 可选的输入/显示单位 id 白名单；缺省按量纲给出全部兼容单位 */
  units?: string[];
  /** 求解域（反解搜索范围） */
  domain?: { min?: number; max?: number; minExclusive?: boolean; maxExclusive?: boolean };
  description?: string;
}

export interface ModelSpec {
  id: string;
  name: string;
  /** 依据标准，如 "IPC-2221B"、"IPC-2152" */
  standard: string;
  /** 条款号 */
  clause?: string;
  description: string;
  /** 单输出表达式：`<输出变量> = <表达式>`，变量已为声明单位下的数值 */
  expr?: string;
  /**
   * 多输出表达式（器件类计算器，如 Buck 电感）：按声明顺序求值，
   * 后序表达式可引用先序输出。输出 = 全部键。
   */
  exprs?: Record<string, string>;
  /** 主输出（反向求解/不确定度追踪用），缺省为 exprs 首键 或 expr 左侧 */
  primary?: string;
  /** 曲线表（curve() 函数引用） */
  curves?: Record<string, CurveData>;
  /** 适用范围（越界必须拒绝或强提示，见 solver） */
  applicable?: { note: string; check?: Record<string, { min?: number; max?: number }> };
  /** 数据是否待验证（如曲线表为近似数据时置 true，跳过回归断言） */
  pendingVerification?: boolean;
  /** 依据来源 */
  source?: SourceRef;
}

export type ConstraintLevel = 'info' | 'warning' | 'blocker';

export interface ConstraintSpec {
  id: string;
  op: 'le' | 'ge' | 'lt' | 'gt';
  /** 左侧表达式（引用变量，数值在变量声明单位下） */
  lhs: string;
  rhs: string;
  /** blocker：冲突即判定“不可制造”；warning：提示；info：仅展示 */
  level: ConstraintLevel;
  label?: string;
}

export interface ExampleSpec {
  /** 模型 id 列表，为空表示所有模型 */
  models?: string[];
  /** 输入：变量 id → 声明单位下的数值 */
  in: Record<string, number>;
  /** 期望输出：变量 id → 声明单位下的数值 */
  expect: Record<string, number>;
  /** 相对误差阈值 */
  tol?: number;
  /** 说明（如“IPC-2221B 表 6-1 示例”） */
  note?: string;
}

export interface CalcSpec {
  id: string;
  version: string;
  title: string;
  /** 必须展示的固定假设（FR-E-1，可折叠但不可隐藏） */
  assumptions: string[];
  variables: VariableSpec[];
  models: ModelSpec[];
  constraints: ConstraintSpec[];
  examples: ExampleSpec[];
}

export const DEFAULT_TOL = 0.02;

export function varById(spec: CalcSpec, id: string): VariableSpec {
  const vs = spec.variables.find((v) => v.id === id);
  if (!vs) throw new Error(`变量 ${id} 未在计算器 ${spec.id} 中声明`);
  return vs;
}
