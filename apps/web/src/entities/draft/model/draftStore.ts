/**
 * 输入草稿持久化：每个计算器一份 localStorage 草稿，切换页面或刷新后自动恢复。
 * 只保存可序列化的输入状态；结果可随输入重新计算，手动计算页会一并保存结果。
 *
 * 输入过程中把同步 localStorage 写入合并到一次（300ms），减少每次按键的写盘；
 * 切换页面、关闭标签页或触发重置时都会先落盘，避免丢失最后一次输入。
 */
import { useEffect, useMemo } from 'react';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export const DRAFT_PREFIX = `${STORAGE_KEYS.draft}.`;
const VERSION = 1;
const SAVE_DELAY_MS = 300;

export function draftKey(id: string): string {
  return `${DRAFT_PREFIX}${id}`;
}

export function loadDraft<T>(id: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const env = JSON.parse(raw) as { v?: number; data?: unknown };
    if (env.v !== VERSION || env.data == null || typeof env.data !== 'object') return null;
    return env.data as T;
  } catch {
    return null;
  }
}

function writeDraftPayload(id: string, payload: string): boolean {
  try {
    localStorage.setItem(draftKey(id), `{"v":${VERSION},"at":${Date.now()},"data":${payload}}`);
    return true;
  } catch {
    /* 本地存储不可用或配额不足时忽略，不影响计算 */
    return false;
  }
}

interface PendingWrite {
  timer: ReturnType<typeof setTimeout>;
  payload: string;
}

const pendingWrites = new Map<string, PendingWrite>();

function cancelPending(id: string): void {
  const pending = pendingWrites.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingWrites.delete(id);
}

function scheduleDraftSave(id: string, payload: string): void {
  cancelPending(id);
  const timer = setTimeout(() => {
    pendingWrites.delete(id);
    writeDraftPayload(id, payload);
  }, SAVE_DELAY_MS);
  pendingWrites.set(id, { timer, payload });
}

/** 立即写入尚未落盘的草稿；没有待写内容时什么都不做。 */
function flushPending(id: string): void {
  const pending = pendingWrites.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingWrites.delete(id);
  writeDraftPayload(id, pending.payload);
}

/** 立即落盘所有待写草稿（导出设计文件或页面进入后台前调用）。 */
export function flushAllDrafts(): void {
  for (const id of [...pendingWrites.keys()]) flushPending(id);
}

// 页面进入后台或被关闭时，把合并窗口内的草稿写回。
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('pagehide', flushAllDrafts);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllDrafts();
  });
}

/** 立即保存（供非 React 场景与测试使用）。 */
export function saveDraft<T>(id: string, data: T): void {
  cancelPending(id);
  writeDraftPayload(id, JSON.stringify(data));
}

export function clearDraft(id: string): void {
  cancelPending(id);
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* 忽略 */
  }
}

/** 清除某页面的主草稿及其附属草稿（如走线页的扩展参数）。 */
export function clearPanelDrafts(id: string): void {
  try {
    const prefix = draftKey(id);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === prefix || key.startsWith(`${prefix}_`))) keys.push(key);
    }
    // 除已落盘的键，还要取消尚未写盘的同前缀草稿，避免清除后又被异步写回。
    for (const pendingId of [...pendingWrites.keys()]) {
      const key = draftKey(pendingId);
      if (key === prefix || key.startsWith(`${prefix}_`)) cancelPending(pendingId);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    for (const pendingId of [...pendingWrites.keys()]) {
      if (draftKey(pendingId).startsWith(DRAFT_PREFIX)) cancelPending(pendingId);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

const DRAFT_ID = /^[a-z0-9_-]{1,64}$/i;
const FORBIDDEN_DRAFT_ID = new Set(['__proto__', 'constructor', 'prototype']);

function isDraftId(id: string): boolean {
  return DRAFT_ID.test(id) && !FORBIDDEN_DRAFT_ID.has(id.toLowerCase());
}

/**
 * 导出用快照：先落盘待写草稿，再读取所有合法草稿。
 * 该函数不做业务字段校验；设计文件导入时由 designFile 统一校验。
 */
export function snapshotDrafts(): Record<string, unknown> {
  flushAllDrafts();
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
      const id = key.slice(DRAFT_PREFIX.length);
      if (!isDraftId(id)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const env = JSON.parse(raw) as { v?: number; data?: unknown };
      if (env.v !== VERSION || env.data == null || typeof env.data !== 'object') continue;
      out[id] = env.data;
    }
  } catch {
    return out;
  }
  return out;
}

/** 读取现有草稿的原始字符串，用于导入失败时回滚。 */
function rawDraftEntries(): Array<[string, string]> {
  flushAllDrafts();
  const out: Array<[string, string]> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (raw !== null) out.push([key, raw]);
    }
  } catch {
    /* 读取失败时返回已收集的部分，导入仍会尝试写入 */
  }
  return out;
}

/**
 * 用已校验的草稿集合整体替换本机草稿（设计文件导入）。
 * 先序列化全部条目，再写盘；任一写入失败则恢复导入前的原始草稿并抛出，
 * 避免配额不足时只导入一半、把旧草稿也丢掉。
 */
export function restoreDrafts(drafts: Record<string, unknown>): void {
  const payloads: Array<[string, string]> = [];
  for (const [id, data] of Object.entries(drafts)) {
    if (!isDraftId(id)) continue;
    const payload = JSON.stringify(data);
    if (payload !== undefined) payloads.push([id, payload]);
  }

  const backup = rawDraftEntries();
  clearAllDrafts();
  for (const [id, payload] of payloads) {
    if (!writeDraftPayload(id, payload)) {
      // 回滚：清掉可能已写入的部分草稿，恢复导入前的原始内容。
      clearAllDrafts();
      for (const [key, raw] of backup) {
        try {
          localStorage.setItem(key, raw);
        } catch {
          /* 回滚也可能受配额限制，尽力而为 */
        }
      }
      throw new Error(`无法写入草稿「${id}」，已恢复导入前的本机草稿`);
    }
  }
}

/** 只读取一次草稿；组件卸载/重挂载时重新读取。 */
export function useDraftData<T>(id: string): T | null {
  return useMemo(() => loadDraft<T>(id), [id]);
}

/** 状态变化后同步写入草稿；字符串化后的依赖可避免对象引用变化导致重复写入。 */
export function useDraft<T>(id: string, data: T): void {
  const serialized = JSON.stringify(data);

  useEffect(() => {
    scheduleDraftSave(id, serialized);
  }, [id, serialized]);

  // 切换页面 / 重置导致卸载时立即落盘，合并窗口内不会丢数据。
  useEffect(() => () => flushPending(id), [id]);
}

/** 合并字符串表单草稿：只接受字符串字段，避免损坏的本地数据破坏表单。 */
export function mergeStringDraft<T extends object>(defaults: T, saved: Partial<T> | null): T {
  const out = { ...defaults };
  if (!saved) return out;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = saved[key];
    if (typeof value === 'string') out[key] = value as T[keyof T];
  }
  return out;
}
