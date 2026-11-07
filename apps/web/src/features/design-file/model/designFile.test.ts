import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDraft, saveDraft } from '@/entities/draft/model/draftStore';
import {
  ACTIVE_KEY,
  DESIGN_FILE_FORMAT,
  MAX_DESIGN_FILE_BYTES,
  applyDesignFile,
  buildDesignFile,
  parseDesignFile,
} from '@/features/design-file/model/designFile';
import {
  loadCustomRegulators,
  saveCustomRegulators,
} from '@/entities/regulator/model/regulatorData';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { APP_VERSION } from '@/shared/config/constants';

const UNIT_SYSTEM_KEY = STORAGE_KEYS.unitSystem;

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

function designJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: DESIGN_FILE_FORMAT,
    version: 1,
    exportedAt: '2026-10-30T00:00:00.000Z',
    appVersion: APP_VERSION,
    unitSystem: 'metric',
    active: 'via',
    drafts: { via: { hole: '0.5' } },
    customRegulators: [],
    ...overrides,
  });
}

describe('设计文件导出/导入', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('导出包含草稿、单位制与自定义稳压器，并可重新导入', () => {
    saveDraft('via', { hole: '0.4', ruleId: 'standard' });
    localStorage.setItem(UNIT_SYSTEM_KEY, 'imperial');
    localStorage.setItem(ACTIVE_KEY, 'via');
    saveCustomRegulators([
      { name: 'TPS7A47', custom: true, vrefTyp: 1.25, iadjTyp: 20, vrefMin: 1.0, vrefMax: 1.5 },
    ]);

    const file = buildDesignFile('via', new Date(2026, 9, 30, 10, 0));
    expect(file.drafts).toEqual({ via: { hole: '0.4', ruleId: 'standard' } });
    expect(file.unitSystem).toBe('imperial');
    expect(file.customRegulators).toHaveLength(1);

    const parsed = parseDesignFile(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    saveDraft('via', { hole: '0.9' });
    localStorage.setItem(UNIT_SYSTEM_KEY, 'metric');
    const applied = applyDesignFile(parsed.file, (id) => id === 'via');
    expect(applied).toMatchObject({
      draftCount: 1,
      regulatorCount: 1,
      unitSystem: 'imperial',
      active: 'via',
    });
    expect(loadDraft('via')).toEqual({ hole: '0.4', ruleId: 'standard' });
    expect(localStorage.getItem(UNIT_SYSTEM_KEY)).toBe('imperial');
    expect(loadCustomRegulators()).toHaveLength(1);
  });

  it('拒绝未来版本、错误格式与非法 active', () => {
    expect(parseDesignFile(designJson({ version: 2 }))).toMatchObject({ ok: false });
    expect(parseDesignFile(designJson({ format: 'other' }))).toMatchObject({ ok: false });
    expect(parseDesignFile(designJson({ active: '../../etc/passwd' }))).toMatchObject({
      ok: false,
    });
    expect(parseDesignFile(designJson({ unitSystem: 'cgs' }))).toMatchObject({ ok: false });
  });

  it('拒绝原型污染键与危险嵌套', () => {
    const protoDrafts = Object.create(null) as Record<string, unknown>;
    protoDrafts.__proto__ = { polluted: true };
    expect(parseDesignFile(designJson({ drafts: protoDrafts }))).toMatchObject({ ok: false });

    expect(
      parseDesignFile(
        designJson({ drafts: { via: { constructor: { prototype: { polluted: true } } } } }),
      ),
    ).toMatchObject({ ok: false });
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('拒绝超大文件、过多草稿与非对象草稿', () => {
    const huge = designJson({ padding: 'x'.repeat(MAX_DESIGN_FILE_BYTES + 1) });
    expect(parseDesignFile(huge)).toMatchObject({ ok: false });

    const many = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`d${i}`, { value: i }]));
    expect(parseDesignFile(designJson({ drafts: many }))).toMatchObject({ ok: false });
    expect(parseDesignFile(designJson({ drafts: { via: 'text' } }))).toMatchObject({
      ok: false,
    });
  });

  it('拒绝非有限数值与超长字符串', () => {
    const nonFinite = designJson({ drafts: { via: { hole: 0 } } }).replace(
      '"hole":0',
      '"hole":1e999',
    );
    expect(parseDesignFile(nonFinite)).toMatchObject({ ok: false });
    expect(
      parseDesignFile(designJson({ drafts: { via: { remark: 'x'.repeat(20_001) } } })),
    ).toMatchObject({ ok: false });
  });

  it('active 不存在时忽略，但草稿仍然导入', () => {
    const parsed = parseDesignFile(designJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const applied = applyDesignFile(parsed.file, () => false);
    expect(applied.active).toBeUndefined();
    expect(loadDraft('via')).toEqual({ hole: '0.5' });
  });
});
