import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import {
  loadFavorites,
  loadRecent,
  pushRecent,
  saveFavorites,
  toggleFavorite,
} from '@/entities/preferences/model/prefsStore';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('收藏与最近使用', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('收藏可切换：加入后置顶，再次切换即移除', () => {
    expect(loadFavorites()).toEqual([]);
    expect(toggleFavorite('via')).toEqual(['via']);
    expect(toggleFavorite('fuse')).toEqual(['fuse', 'via']);
    expect(toggleFavorite('via')).toEqual(['fuse']);
  });

  it('保存收藏会覆盖旧值并按传入顺序保留', () => {
    saveFavorites(['a', 'b']);
    saveFavorites(['b']);
    expect(loadFavorites()).toEqual(['b']);
  });

  it('最近使用去重、置顶并截断到 8 条', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) pushRecent(id);
    expect(loadRecent()).toHaveLength(8);
    expect(loadRecent()[0]).toBe('i');
    pushRecent('c');
    expect(loadRecent()[0]).toBe('c');
    expect(loadRecent().filter((x) => x === 'c')).toHaveLength(1);
  });

  it('脏数据不会抛错：非 JSON / 非数组 / 混入非字符串', () => {
    localStorage.setItem(STORAGE_KEYS.favorites, '{oops');
    expect(loadFavorites()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.favorites, '{"a":1}');
    expect(loadFavorites()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.favorites, '["a",1,null,"b"]');
    expect(loadFavorites()).toEqual(['a', 'b']);
  });
});
