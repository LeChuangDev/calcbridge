/**
 * 设计文件（.json）：整包导出/导入各页面草稿、单位制、当前页面与自定义稳压器。
 *
 * 导入文件属于不可信输入，因此本模块只负责“解析并净化为已知结构”：
 * - 限制文件大小、草稿条目数、单条草稿体积与嵌套深度；
 * - 只接受普通对象/数组/有限数字/字符串/布尔/null；
 * - 拒绝 __proto__ / constructor / prototype 等原型污染键；
 * - 稳压器参数复用 regulatorData 的严格校验。
 */
import { restoreDrafts, snapshotDrafts } from './draftStore';
import { downloadTextFile } from './download';
import {
  loadCustomRegulators,
  saveCustomRegulators,
  normalizeRegulatorList,
  type RegulatorEntry,
} from './regulatorData';
import type { UnitSystem } from './unitSystem';
import { STORAGE_KEYS } from './storageKeys';
import { APP_VERSION } from './constants';

export const DESIGN_FILE_FORMAT = 'calcbridge-design';
export const DESIGN_FILE_VERSION = 1;
export const DESIGN_FILE_APP_VERSION = APP_VERSION;
export const MAX_DESIGN_FILE_BYTES = 1024 * 1024;
export const MAX_DESIGN_DRAFTS = 100;
export const MAX_DRAFT_BYTES = 200 * 1024;
export const MAX_TOTAL_DRAFT_BYTES = 600 * 1024;
export const ACTIVE_KEY = STORAGE_KEYS.active;

const DESIGN_ID = /^[a-z0-9_-]{1,64}$/i;
// eslint-disable-next-line no-control-regex -- 有意检测控制字符，导入文本必须被净化
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

export interface DesignFilePayload {
  format: typeof DESIGN_FILE_FORMAT;
  version: typeof DESIGN_FILE_VERSION;
  exportedAt: string;
  appVersion: string;
  unitSystem: UnitSystem;
  active?: string;
  drafts: Record<string, unknown>;
  customRegulators: RegulatorEntry[];
}

export type DesignParseResult =
  { ok: true; file: DesignFilePayload; warnings: string[] } | { ok: false; error: string };

export function isSafeDesignId(value: unknown): value is string {
  return (
    typeof value === 'string' && DESIGN_ID.test(value) && !FORBIDDEN_KEYS.has(value.toLowerCase())
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function readUnitSystem(): UnitSystem {
  try {
    return localStorage.getItem(STORAGE_KEYS.unitSystem) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

/** 递归净化 JSON 数据；任何不支持/超限/危险结构都直接拒绝整份文件。 */
function sanitizeTree(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new Error('数据嵌套层级过深');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 20_000) throw new Error('单个字符串超过 20000 字符');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('包含非有限数字');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error('数组长度超过 1000');
    return value.map((item) => sanitizeTree(item, depth + 1));
  }
  if (!isPlainObject(value)) throw new Error('包含不支持的数据类型');

  const keys = Object.keys(value);
  if (keys.length > 200) throw new Error('对象字段超过 200 个');
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key.length > 128) throw new Error('字段名超过 128 字符');
    if (CONTROL_CHARS.test(key)) throw new Error('字段名包含控制字符');
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new Error(`拒绝危险字段名：${key}`);
    }
    out[key] = sanitizeTree(value[key], depth + 1);
  }
  return out;
}

function sanitizeDrafts(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) throw new Error('drafts 必须是对象');

  const entries = Object.entries(raw);
  if (entries.length > MAX_DESIGN_DRAFTS) {
    throw new Error(`草稿条目不能超过 ${MAX_DESIGN_DRAFTS} 个`);
  }

  const drafts: Record<string, unknown> = {};
  let totalBytes = 0;
  for (const [id, value] of entries) {
    if (!isSafeDesignId(id)) throw new Error(`非法草稿 id：${id}`);
    if (!isPlainObject(value) && !Array.isArray(value)) {
      throw new Error(`草稿「${id}」必须是对象或数组`);
    }
    const clean = sanitizeTree(value);
    const size = utf8Bytes(JSON.stringify(clean));
    if (size > MAX_DRAFT_BYTES) {
      throw new Error(`草稿「${id}」超过 ${MAX_DRAFT_BYTES / 1024} KB`);
    }
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_DRAFT_BYTES) {
      throw new Error(`草稿总体积超过 ${MAX_TOTAL_DRAFT_BYTES / 1024} KB`);
    }
    drafts[id] = clean;
  }
  return drafts;
}

function parseRegulators(raw: unknown): RegulatorEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error('customRegulators 必须是数组');
  if (raw.length === 0) return [];
  const result = normalizeRegulatorList(raw);
  if (!result.ok) throw new Error(result.error);
  return result.entries;
}

function parseActive(raw: unknown): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (!isSafeDesignId(raw)) throw new Error('active 页面 id 非法');
  return raw;
}

export function parseDesignFile(text: string): DesignParseResult {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: '文件为空' };
  }
  if (utf8Bytes(text) > MAX_DESIGN_FILE_BYTES) {
    return { ok: false, error: `文件超过 ${MAX_DESIGN_FILE_BYTES / 1024} KB 限制` };
  }

  let root: unknown;
  try {
    root = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: 'JSON 格式无效' };
  }
  if (!isPlainObject(root)) return { ok: false, error: 'JSON 顶层必须是对象' };
  if (root.format !== DESIGN_FILE_FORMAT) {
    return { ok: false, error: `不是 CalcBridge 设计文件（缺少 format: ${DESIGN_FILE_FORMAT}）` };
  }
  if (root.version !== DESIGN_FILE_VERSION) {
    return {
      ok: false,
      error:
        typeof root.version === 'number' && root.version > DESIGN_FILE_VERSION
          ? `文件版本 ${root.version} 高于当前应用支持的版本 ${DESIGN_FILE_VERSION}`
          : `设计文件版本无效：${String(root.version)}`,
    };
  }
  if (root.unitSystem !== 'metric' && root.unitSystem !== 'imperial') {
    return { ok: false, error: 'unitSystem 必须是 metric 或 imperial' };
  }

  const warnings: string[] = [];
  try {
    const drafts = sanitizeDrafts(root.drafts);
    const customRegulators = parseRegulators(root.customRegulators);
    const active = parseActive(root.active);
    if (root.exportedAt !== undefined && typeof root.exportedAt !== 'string') {
      warnings.push('exportedAt 字段无效，已忽略');
    }
    if (root.appVersion !== undefined && typeof root.appVersion !== 'string') {
      warnings.push('appVersion 字段无效，已忽略');
    }
    return {
      ok: true,
      warnings,
      file: {
        format: DESIGN_FILE_FORMAT,
        version: DESIGN_FILE_VERSION,
        exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : '',
        appVersion: typeof root.appVersion === 'string' ? root.appVersion : '',
        unitSystem: root.unitSystem,
        active,
        drafts,
        customRegulators,
      },
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export interface ApplyDesignResult {
  draftCount: number;
  regulatorCount: number;
  unitSystem: UnitSystem;
  active?: string;
}

/**
 * 应用已校验的设计文件。先整体替换草稿，再写单位制、当前页面与自定义稳压器。
 * `isPanelId` 由调用方提供，确保导入的 active 只指向真实存在的计算器。
 */
export function applyDesignFile(
  file: DesignFilePayload,
  isPanelId: (id: string) => boolean = () => true,
): ApplyDesignResult {
  restoreDrafts(file.drafts);
  saveCustomRegulators(file.customRegulators);
  try {
    localStorage.setItem(STORAGE_KEYS.unitSystem, file.unitSystem);
  } catch {
    /* 本地存储不可用时仍返回结果，由界面提示 */
  }

  const active = file.active && isPanelId(file.active) ? file.active : undefined;
  if (active) {
    try {
      localStorage.setItem(ACTIVE_KEY, active);
    } catch {
      /* 忽略 */
    }
  }

  return {
    draftCount: Object.keys(file.drafts).length,
    regulatorCount: file.customRegulators.length,
    unitSystem: file.unitSystem,
    active,
  };
}

/** 从当前浏览器状态构建设计文件（导出前会把待写草稿落盘）。 */
export function buildDesignFile(active: string, date = new Date()): DesignFilePayload {
  return {
    format: DESIGN_FILE_FORMAT,
    version: DESIGN_FILE_VERSION,
    exportedAt: date.toISOString(),
    appVersion: DESIGN_FILE_APP_VERSION,
    unitSystem: readUnitSystem(),
    active: isSafeDesignId(active) ? active : undefined,
    drafts: snapshotDrafts(),
    customRegulators: loadCustomRegulators(),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function designFileName(date = new Date()): string {
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(
    date.getHours(),
  )}${pad2(date.getMinutes())}`;
  return `calcbridge-design-${stamp}.json`;
}

export function downloadDesignFile(active: string, date = new Date()): DesignFilePayload {
  const file = buildDesignFile(active, date);
  downloadTextFile(
    designFileName(date),
    JSON.stringify(file, null, 2),
    'application/json;charset=utf-8',
  );
  return file;
}
