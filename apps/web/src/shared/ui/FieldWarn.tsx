import { checkEngineeringLimits, type VariableSpec } from '@calcbridge/core';

/** 输入工程范围提示：只展示警告，不阻断输入。 */
export function FieldWarn({ value, spec }: { value: string | number; spec: VariableSpec }) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const issue = checkEngineeringLimits(numeric, spec);
  if (!issue) return null;
  return (
    <p className={`field-warn ${issue.level}`} role="status">
      {issue.message}
    </p>
  );
}
