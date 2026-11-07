/**
 * 工程建议范围校验：与反解搜索域（domain）分开。
 * 超出 limits 时默认给出警告，不直接拦截；level=blocker 时由调用方阻止计算。
 */
import type { VariableSpec } from '../spec/spec';

export interface LimitIssue {
  level: 'warning' | 'blocker';
  message: string;
}

export function checkEngineeringLimits(
  value: number,
  vs: VariableSpec,
): LimitIssue | null {
  const limits = vs.limits;
  if (!limits || !Number.isFinite(value)) return null;

  const { min, max, note, level = 'warning' } = limits;
  if (min === undefined && max === undefined) return null;
  if ((min === undefined || value >= min) && (max === undefined || value <= max)) return null;

  const range =
    min !== undefined && max !== undefined
      ? `${min}–${max}`
      : min !== undefined
        ? `≥ ${min}`
        : `≤ ${max}`;
  const label = vs.label ?? vs.id;
  const suffix = note ? `：${note}` : '，结果可能超出工程适用范围';

  return {
    level,
    message: `${label} 超出建议范围（${range} ${vs.unit}）${suffix}`,
  };
}
