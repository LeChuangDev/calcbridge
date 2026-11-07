import { describe, expect, it } from 'vitest';
import { clearanceGap, clearanceRow } from './clearanceTable';

describe('IPC-2221B 电气间隙查表', () => {
  it('按电压档位查询典型间隙', () => {
    expect(clearanceGap(100, 'B1')).toBe(0.1);
    expect(clearanceGap(100, 'B2')).toBe(0.6);
    expect(clearanceGap(250, 'B4')).toBe(0.4);
    expect(clearanceGap(500, 'B3')).toBe(12.5);
  });

  it('边界与超范围电压使用对应档位', () => {
    expect(clearanceRow(15)?.label).toBe('0 – 15 V');
    expect(clearanceRow(800)?.label).toBe('> 500 V');
    expect(clearanceGap(800, 'B1')).toBe(0.25);
  });

  it('非法电压或列 id 返回 null', () => {
    expect(clearanceRow(0)).toBeNull();
    expect(clearanceRow(-1)).toBeNull();
    expect(clearanceGap(100, 'X1')).toBeNull();
  });
});
