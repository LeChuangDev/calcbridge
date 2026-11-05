import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllDrafts,
  clearDraft,
  clearPanelDrafts,
  draftKey,
  loadDraft,
  mergeStringDraft,
  restoreDrafts,
  saveDraft,
  snapshotDrafts,
} from './draftStore';

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

describe('草稿存储', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('保存后可读取，并按计算器 id 隔离', () => {
    saveDraft('via', { hole: '0.5' });
    saveDraft('fuse', { width: '0.2' });
    expect(loadDraft<{ hole: string }>('via')).toEqual({ hole: '0.5' });
    expect(loadDraft<{ width: string }>('fuse')).toEqual({ width: '0.2' });
    expect(loadDraft('missing')).toBeNull();
  });

  it('版本不匹配或内容损坏时返回 null', () => {
    localStorage.setItem(draftKey('via'), JSON.stringify({ v: 99, data: { hole: '0.5' } }));
    expect(loadDraft('via')).toBeNull();
    localStorage.setItem(draftKey('via'), '{bad json');
    expect(loadDraft('via')).toBeNull();
  });

  it('清除单个草稿与全部草稿，不影响其他本地数据', () => {
    saveDraft('via', { hole: '0.5' });
    saveDraft('fuse', { width: '0.2' });
    localStorage.setItem('calcbridge.active', 'via');
    clearDraft('via');
    expect(loadDraft('via')).toBeNull();
    expect(loadDraft('fuse')).toEqual({ width: '0.2' });

    clearAllDrafts();
    expect(loadDraft('fuse')).toBeNull();
    expect(localStorage.getItem('calcbridge.active')).toBe('via');
  });

  it('清除本页草稿时同时清除附属草稿', () => {
    saveDraft('trace_current', { I: '3' });
    saveDraft('trace_current_extras', { length: '50' });
    saveDraft('trace_current_other', { x: '1' });
    saveDraft('via', { hole: '0.5' });

    clearPanelDrafts('trace_current');
    expect(loadDraft('trace_current')).toBeNull();
    expect(loadDraft('trace_current_extras')).toBeNull();
    expect(loadDraft('trace_current_other')).toBeNull();
    expect(loadDraft('via')).toEqual({ hole: '0.5' });
  });

  it('快照包含全部合法草稿，恢复时整体替换', () => {
    saveDraft('via', { hole: '0.5' });
    saveDraft('fuse', { width: '0.2' });
    const snapshot = snapshotDrafts();
    expect(snapshot).toEqual({ via: { hole: '0.5' }, fuse: { width: '0.2' } });

    restoreDrafts({ via: { hole: '0.9' } });
    expect(loadDraft('via')).toEqual({ hole: '0.9' });
    expect(loadDraft('fuse')).toBeNull();
  });

  it('快照忽略非法草稿键与损坏内容', () => {
    saveDraft('via', { hole: '0.5' });
    localStorage.setItem('calcbridge.draft.__proto__', '{"v":1,"data":{"x":1}}');
    localStorage.setItem('calcbridge.draft.bad key', '{"v":1,"data":{"x":1}}');
    localStorage.setItem('calcbridge.draft.fuse', '{bad json');
    expect(snapshotDrafts()).toEqual({ via: { hole: '0.5' } });
  });

  it('表单合并只接受字符串字段', () => {
    const defaults = { a: '1', b: '2' };
    expect(mergeStringDraft(defaults, { a: '3' })).toEqual({ a: '3', b: '2' });
    expect(
      mergeStringDraft(defaults, { a: 4 as unknown as string, b: null as unknown as string }),
    ).toEqual(defaults);
  });
});
