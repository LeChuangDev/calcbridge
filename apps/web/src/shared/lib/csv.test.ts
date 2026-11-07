import { describe, expect, it } from 'vitest';
import { csvCell } from '@/shared/lib/csv';

describe('CSV 单元格编码', () => {
  it('普通文本与纯数字保持原样', () => {
    expect(csvCell('LM317')).toBe('LM317');
    expect(csvCell('0.35')).toBe('0.35');
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell('1.2e-3')).toBe('1.2e-3');
  });

  it('逗号、引号与换行按 RFC 4180 转义', () => {
    expect(csvCell('R,1')).toBe('"R,1"');
    expect(csvCell('"0.5"')).toBe('"""0.5"""');
    expect(csvCell('多行\n备注')).toBe('"多行\n备注"');
  });

  it('公式开头单元格加单引号前缀，阻止 Excel/WPS 执行', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=cmd')).toBe("'\t=cmd");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell(' =cmd')).toBe("' =cmd");
  });

  it('公式单元格同时包含逗号时仍正确加引号', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
  });
});
