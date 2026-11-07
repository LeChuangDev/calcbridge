/**
 * 用户偏好持久化：收藏与最近使用的计算器。
 * 只读写 localStorage，不引入 React 依赖，便于在纯逻辑层与测试中复用。
 */
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const MAX_RECENT = 8;

/** 读取字符串数组；非数组、非字符串的脏数据一律丢弃。 */
function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* 本地存储不可用时忽略 */
  }
}

export function loadFavorites(): string[] {
  return readList(STORAGE_KEYS.favorites);
}

export function saveFavorites(ids: string[]): void {
  writeList(STORAGE_KEYS.favorites, ids);
}

export function toggleFavorite(id: string): string[] {
  const current = loadFavorites();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
  saveFavorites(next);
  return next;
}

export function loadRecent(): string[] {
  return readList(STORAGE_KEYS.recent);
}

/** 记录一次访问：最新访问的排在最前，去重并截断。 */
export function pushRecent(id: string): string[] {
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
  writeList(STORAGE_KEYS.recent, next);
  return next;
}
