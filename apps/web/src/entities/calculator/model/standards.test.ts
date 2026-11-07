import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from './navModel';
import { CONFIDENCE_LABEL, MODEL_CLASS_LABEL, MODULE_STANDARDS, standardOf } from './standards';

describe('计算依据元数据', () => {
  it('19 个模块全部登记依据', () => {
    const ids = ALL_TOOLS.map((tool) => tool.calcId);
    expect(ids.length).toBe(19);
    for (const id of ids) {
      expect(standardOf(id), `缺少依据登记：${id}`).toBeDefined();
    }
  });

  it('每条依据都有可展示的字段与合法枚举', () => {
    for (const entry of Object.values(MODULE_STANDARDS)) {
      expect(entry.basis.length).toBeGreaterThan(0);
      expect(entry.clause.length).toBeGreaterThan(0);
      expect(entry.errorBand.length).toBeGreaterThan(0);
      expect(entry.boundary.length).toBeGreaterThan(0);
      expect(MODEL_CLASS_LABEL[entry.modelClass]).toBeTruthy();
      expect(CONFIDENCE_LABEL[entry.confidence]).toBeTruthy();
    }
  });

  it('未登记模块返回 undefined，不抛错', () => {
    expect(standardOf('not-a-module')).toBeUndefined();
    expect(standardOf(null)).toBeUndefined();
  });
});
