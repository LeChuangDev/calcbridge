import { describe, expect, it } from 'vitest';
import { parseQuantity } from '../src/unit/quantity';
import { dimToString, getUnit } from '../src/unit/dimensions';

describe('量纲系统（FR-A-1）', () => {
  it('解析 "3 A"', () => {
    const q = parseQuantity('3 A');
    expect(q.value).toBe(3);
    expect(q.unit.id).toBe('A');
  });

  it('inch → mm 换算', () => {
    expect(parseQuantity('1 in').to('mm').value).toBeCloseTo(25.4, 10);
  });

  it('mil → mm 换算', () => {
    expect(parseQuantity('39.37 mil').to('mm').value).toBeCloseTo(1, 1);
  });

  it('摄氏度 ↔ 开尔文（偏移换算）', () => {
    expect(parseQuantity('25 °C').to('kelvin').value).toBeCloseTo(298.15, 10);
    expect(parseQuantity('298.15 kelvin').to('celsius').value).toBeCloseTo(25, 10);
  });

  it('1oz 铜厚 ≈ 35µm', () => {
    expect(parseQuantity('1 oz').to('um').value).toBeCloseTo(35, 10);
  });

  it('毫米加毫米合法', () => {
    const a = parseQuantity('1 mm');
    const b = parseQuantity('2 mm');
    expect(a.add(b).to('mm').value).toBeCloseTo(3, 10);
  });

  it('毫米加安培必须抛错（不静默换算）', () => {
    expect(() => parseQuantity('1 mm').add(parseQuantity('2 A'))).toThrow(/量纲不匹配/);
  });

  it('未知单位抛错', () => {
    expect(() => parseQuantity('3 光年')).toThrow(/未知单位/);
  });

  it('量纲可读字符串', () => {
    expect(dimToString(getUnit('ohm')!.dims)).toContain('I');
  });

  it('无量纲：纯数解析为 dimless', () => {
    const q = parseQuantity('4.2');
    expect(q.unit.id).toBe('dimless');
    expect(q.to('dimless').value).toBeCloseTo(4.2, 10);
  });
});
