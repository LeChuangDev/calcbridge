import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CUSTOM_STACKUP,
  STACKUP_PRESETS,
  isStackupId,
  presetFields,
  resolveStackup,
  stackupSummary,
} from '@/features/calculator-impedance/model/impedanceStackup';

describe('微带线叠层输入', () => {
  it('预设叠层提供 h / t / εr', () => {
    expect(STACKUP_PRESETS['four-layer'].hMm).toBe(0.2);
    expect(STACKUP_PRESETS['four-layer'].tMm).toBe(0.035);
    expect(STACKUP_PRESETS['four-layer'].er).toBe(4.2);
    expect(STACKUP_PRESETS['six-layer'].hMm).toBe(0.15);
    expect(STACKUP_PRESETS.hdi.hMm).toBe(0.08);
  });

  it('预设字段按当前单位制输出', () => {
    expect(presetFields(STACKUP_PRESETS['four-layer'], 'metric')).toEqual({
      h: '0.2',
      t: '0.035',
      er: '4.2',
    });
    const imperial = presetFields(STACKUP_PRESETS['four-layer'], 'imperial');
    expect(imperial.h).toBe('7.874');
    expect(imperial.t).toBe('1.378');
  });

  it('自定义叠层按当前单位制换算到 mm', () => {
    const metric = resolveStackup('custom', DEFAULT_CUSTOM_STACKUP, 'metric');
    expect(metric.hMm).toBeCloseTo(0.2, 10);
    expect(metric.tMm).toBeCloseTo(0.035, 10);
    expect(metric.er).toBe(4.2);

    const imperial = resolveStackup('custom', { h: '7.874', t: '1.378', er: '4.2' }, 'imperial');
    expect(imperial.hMm).toBeCloseTo(0.2, 4);
    expect(imperial.tMm).toBeCloseTo(0.035, 4);
  });

  it('叠层摘要随单位制变化', () => {
    const stackup = resolveStackup('four-layer', DEFAULT_CUSTOM_STACKUP, 'metric');
    expect(stackupSummary(stackup, 'metric')).toContain('h 0.2 mm');
    expect(stackupSummary(stackup, 'imperial')).toContain('h 7.874 mil');
  });

  it('叠层 id 校验', () => {
    expect(isStackupId('four-layer')).toBe(true);
    expect(isStackupId('custom')).toBe(true);
    expect(isStackupId('unknown')).toBe(false);
  });
});
