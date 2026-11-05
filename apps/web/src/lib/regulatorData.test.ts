import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_REGULATOR_FILE_BYTES,
  buildRegulatorsCsv,
  buildRegulatorsJson,
  loadCustomRegulators,
  normalizeRegulatorEntry,
  parseRegulatorsFile,
  parseRegulatorsJson,
  saveCustomRegulators,
  type RegulatorEntry,
} from './regulatorData';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

const valid: RegulatorEntry = {
  name: 'TPS7A47',
  custom: true,
  vrefMin: 1.0,
  vrefTyp: 1.25,
  vrefMax: 1.5,
  iadjMin: 10,
  iadjTyp: 20,
  iadjMax: 30,
};

describe('稳压器参数校验', () => {
  it('接受完整的 min/typ/max 参数', () => {
    const result = normalizeRegulatorEntry(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry.name).toBe('TPS7A47');
  });

  it('拒绝空名称、非有限数值与错误范围', () => {
    expect(normalizeRegulatorEntry({ ...valid, name: '  ' })).toMatchObject({ ok: false });
    expect(normalizeRegulatorEntry({ ...valid, vrefTyp: Number.NaN })).toMatchObject({ ok: false });
    expect(normalizeRegulatorEntry({ ...valid, vrefMin: 2, vrefTyp: 1.25 })).toMatchObject({
      ok: false,
    });
    expect(normalizeRegulatorEntry({ ...valid, vrefTyp: 30 })).toMatchObject({ ok: false });
  });

  it('拒绝与内置型号重名', () => {
    const result = normalizeRegulatorEntry({ ...valid, name: 'lm317' });
    expect(result.ok).toBe(false);
  });

  it('忽略未知字段与 __proto__ 自有属性，不污染原型', () => {
    const raw = JSON.parse(JSON.stringify({ ...valid, unknown: 'x' })) as Record<string, unknown>;
    Object.defineProperty(raw, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    });
    const result = normalizeRegulatorEntry(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entry).not.toHaveProperty('unknown');
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe('稳压器 JSON / CSV 导入导出', () => {
  it('JSON 导出后可重新导入，且带格式与版本标记', () => {
    const json = buildRegulatorsJson([valid], new Date(2026, 9, 30, 10, 0));
    const parsed = parseRegulatorsJson(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]).toMatchObject({ name: 'TPS7A47', custom: true });
    }
  });

  it('CSV 导出后可重新导入（含引号与逗号名称）', () => {
    const tricky: RegulatorEntry = { ...valid, name: 'TPS,"7A"' };
    const csv = buildRegulatorsCsv([tricky]);
    const parsed = parseRegulatorsFile(csv, 'regs.csv');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.entries[0]!.name).toBe('TPS,"7A"');
  });

  it('CSV 公式前缀在导出时被编码为文本', () => {
    const csv = buildRegulatorsCsv([{ ...valid, name: '=cmd' }]);
    expect(csv).toContain("'=cmd");
  });

  it('CSV 拒绝缺少必需列与非法数字', () => {
    expect(parseRegulatorsFile('name,vref_typ\nx,1.25', 'regs.csv')).toMatchObject({ ok: false });
    expect(parseRegulatorsFile('name,vref_typ,iadj_typ\nx,1.25,NaN', 'regs.csv')).toMatchObject({
      ok: false,
    });
  });

  it('拒绝重复名称（不区分大小写）', () => {
    const parsed = parseRegulatorsJson(buildRegulatorsJson([valid, { ...valid, name: 'tps7a47' }]));
    expect(parsed.ok).toBe(false);
  });

  it('拒绝超大文件', () => {
    const padding = 'x'.repeat(MAX_REGULATOR_FILE_BYTES + 1);
    const text = JSON.stringify({
      format: 'calcbridge-regulators',
      version: 1,
      regulators: [valid],
      padding,
    });
    expect(parseRegulatorsJson(text)).toMatchObject({ ok: false });
  });

  it('拒绝错误格式与版本', () => {
    expect(parseRegulatorsJson(JSON.stringify({ regulators: [valid] }))).toMatchObject({
      ok: false,
    });
    expect(
      parseRegulatorsJson(
        JSON.stringify({ format: 'calcbridge-regulators', version: 2, regulators: [valid] }),
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('稳压器本地存储', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('保存后读取，并跳过损坏项', () => {
    saveCustomRegulators([valid]);
    expect(loadCustomRegulators()).toHaveLength(1);
    localStorage.setItem(
      'calcbridge.regulators',
      JSON.stringify([{ name: 'ok', vrefTyp: 1.25, iadjTyp: 50 }, { name: 'bad' }]),
    );
    expect(loadCustomRegulators()).toHaveLength(1);
  });
});
