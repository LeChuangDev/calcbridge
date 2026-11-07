import { describe, expect, it } from 'vitest';
import { checkEngineeringLimits } from '../src/validation/limits';
import type { VariableSpec } from '../src/spec/spec';

const vs: VariableSpec = {
  id: 'thickness',
  unit: 'mm',
  label: '铜厚',
  limits: { min: 0.017, max: 0.105, note: '常见 0.5–3 oz' },
};

describe('工程建议范围校验', () => {
  it('范围内返回 null', () => {
    expect(checkEngineeringLimits(0.035, vs)).toBeNull();
  });

  it('超出范围返回警告并带来源说明', () => {
    const issue = checkEngineeringLimits(0.2, vs);
    expect(issue?.level).toBe('warning');
    expect(issue?.message).toContain('铜厚');
    expect(issue?.message).toContain('0.017–0.105 mm');
    expect(issue?.message).toContain('常见 0.5–3 oz');
  });

  it('可配置为 blocker', () => {
    const issue = checkEngineeringLimits(-1, {
      ...vs,
      limits: { min: 0, level: 'blocker' },
    });
    expect(issue?.level).toBe('blocker');
  });

  it('未声明 limits 或非有限值时跳过', () => {
    expect(checkEngineeringLimits(1, { id: 'x', unit: 'mm' })).toBeNull();
    expect(checkEngineeringLimits(Number.NaN, vs)).toBeNull();
  });
});
