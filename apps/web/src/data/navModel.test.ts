import { describe, expect, it } from 'vitest';
import { ALL_TOOLS, CALC_TREE, HOME_ID, groupOf, searchTools, toolOf } from './navModel';

describe('工具目录元数据', () => {
  it('每个计算器都有唯一 id、说明与至少一个关键词', () => {
    const ids = ALL_TOOLS.map((t) => t.calcId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ALL_TOOLS) {
      expect(t.desc.length).toBeGreaterThan(4);
      expect(t.keywords?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('HOME_ID 不出现在工具清单里，避免与首页路由冲突', () => {
    expect(ALL_TOOLS.some((t) => t.calcId === HOME_ID)).toBe(false);
  });

  it('groupOf / toolOf 能按计算器 id 反查分类与元数据', () => {
    expect(groupOf('via')).toBe('PCB 与制造');
    expect(toolOf('via')?.label).toBe('过孔参数');
    expect(groupOf('not_exist')).toBeUndefined();
  });

  it('检索命中标签、关键词与标准号', () => {
    expect(searchTools('过孔')[0]?.calcId).toBe('via');
    expect(searchTools('IPC-2152').some((t) => t.calcId === 'trace_current')).toBe(true);
    expect(searchTools('skin depth').some((t) => t.calcId === 'skin_depth')).toBe(true);
    expect(searchTools('E24').some((t) => t.calcId === 'led_resistor')).toBe(true);
  });

  it('空查询与无匹配返回空数组，且结果数量受限', () => {
    expect(searchTools('   ')).toEqual([]);
    expect(searchTools('zzzz-not-a-tool')).toEqual([]);
    expect(searchTools('e', 3).length).toBeLessThanOrEqual(3);
  });

  it('分类树里每个条目都在扁平清单中', () => {
    for (const g of CALC_TREE) {
      for (const it of g.items) {
        expect(ALL_TOOLS.find((t) => t.calcId === it.calcId)).toBeTruthy();
      }
    }
  });
});
