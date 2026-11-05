/**
 * 稳压器参数数据文件：内置型号、本地存储、JSON/CSV 导入导出。
 *
 * 文件来自用户本机，按不可信输入处理：限制文件大小、条目数与名称长度，
 * 只接受已知字段，拒绝非有限数值、非白名单键名与重名项。
 */
import { csvCell } from './csv';
import { downloadTextFile } from './download';
import { REG_LS } from './regulatorsStore';

export const REGULATOR_FILE_FORMAT = 'calcbridge-regulators';
export const REGULATOR_FILE_VERSION = 1;
export const MAX_REGULATOR_ENTRIES = 50;
export const MAX_REGULATOR_NAME_LENGTH = 60;
export const MAX_REGULATOR_FILE_BYTES = 256 * 1024;

export interface RegulatorEntry {
  name: string;
  custom: boolean;
  vrefMin?: number;
  vrefTyp: number;
  vrefMax?: number;
  iadjMin?: number;
  iadjTyp: number;
  iadjMax?: number;
}

export const BUILTIN_REGULATORS: RegulatorEntry[] = [
  {
    name: 'LM317',
    custom: false,
    vrefMin: 1.2,
    vrefTyp: 1.25,
    vrefMax: 1.3,
    iadjMin: 50,
    iadjTyp: 50,
    iadjMax: 100,
  },
  {
    name: 'LM1117-ADJ',
    custom: false,
    vrefMin: 1.238,
    vrefTyp: 1.25,
    vrefMax: 1.262,
    iadjMin: 50,
    iadjTyp: 60,
    iadjMax: 120,
  },
  {
    name: 'LM338',
    custom: false,
    vrefMin: 1.2,
    vrefTyp: 1.25,
    vrefMax: 1.3,
    iadjMin: 45,
    iadjTyp: 50,
    iadjMax: 100,
  },
  {
    name: 'TL317',
    custom: false,
    vrefMin: 1.2,
    vrefTyp: 1.25,
    vrefMax: 1.3,
    iadjMin: 50,
    iadjTyp: 65,
    iadjMax: 100,
  },
];

const BUILTIN_NAMES = new Set(BUILTIN_REGULATORS.map((entry) => entry.name.toLowerCase()));
// eslint-disable-next-line no-control-regex -- 有意检测控制字符，导入文本必须被净化
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export type RegulatorEntryResult =
  { ok: true; entry: RegulatorEntry } | { ok: false; error: string };

export type RegulatorListResult =
  { ok: true; entries: RegulatorEntry[] } | { ok: false; error: string };

export type RegulatorParseResult =
  { ok: true; entries: RegulatorEntry[]; warnings: string[] } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function readNumber(
  raw: unknown,
  label: string,
  required: boolean,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return required ? { ok: false, error: `${label} 不能为空` } : { ok: true, value: undefined };
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, error: `${label} 必须是有限数字` };
  }
  return { ok: true, value: raw };
}

function validateRange(
  min: number | undefined,
  typ: number,
  max: number | undefined,
  label: string,
): string | null {
  if (min !== undefined && min > typ) return `${label} 最小值不能大于典型值`;
  if (max !== undefined && max < typ) return `${label} 最大值不能小于典型值`;
  if (min !== undefined && max !== undefined && min > max) return `${label} 最小值不能大于最大值`;
  return null;
}

/** 单条稳压器参数校验；文件、localStorage 与手工编辑共用同一套规则。 */
export function normalizeRegulatorEntry(raw: unknown): RegulatorEntryResult {
  if (!isPlainObject(raw)) return { ok: false, error: '条目必须是对象' };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return { ok: false, error: '名称不能为空' };
  if (name.length > MAX_REGULATOR_NAME_LENGTH) {
    return { ok: false, error: `名称不能超过 ${MAX_REGULATOR_NAME_LENGTH} 个字符` };
  }
  if (CONTROL_CHARS.test(name)) return { ok: false, error: '名称不能包含控制字符' };

  const vrefMin = readNumber(raw.vrefMin, 'Vref 最小值', false);
  if (!vrefMin.ok) return vrefMin;
  const vrefTyp = readNumber(raw.vrefTyp, 'Vref 典型值', true);
  if (!vrefTyp.ok) return vrefTyp;
  const vrefMax = readNumber(raw.vrefMax, 'Vref 最大值', false);
  if (!vrefMax.ok) return vrefMax;
  const iadjMin = readNumber(raw.iadjMin, 'Iadj 最小值', false);
  if (!iadjMin.ok) return iadjMin;
  const iadjTyp = readNumber(raw.iadjTyp, 'Iadj 典型值', true);
  if (!iadjTyp.ok) return iadjTyp;
  const iadjMax = readNumber(raw.iadjMax, 'Iadj 最大值', false);
  if (!iadjMax.ok) return iadjMax;

  if (vrefTyp.value! <= 0 || vrefTyp.value! > 20) {
    return { ok: false, error: 'Vref 典型值应在 0–20 V 范围内' };
  }
  if (iadjTyp.value! < 0 || iadjTyp.value! > 5000) {
    return { ok: false, error: 'Iadj 典型值应在 0–5000 µA 范围内' };
  }
  for (const [value, label] of [
    [vrefMin.value, 'Vref 最小值'],
    [vrefMax.value, 'Vref 最大值'],
  ] as const) {
    if (value !== undefined && (value <= 0 || value > 20)) {
      return { ok: false, error: `${label}应在 0–20 V 范围内` };
    }
  }
  for (const [value, label] of [
    [iadjMin.value, 'Iadj 最小值'],
    [iadjMax.value, 'Iadj 最大值'],
  ] as const) {
    if (value !== undefined && (value < 0 || value > 5000)) {
      return { ok: false, error: `${label}应在 0–5000 µA 范围内` };
    }
  }

  const vrefRangeError = validateRange(vrefMin.value, vrefTyp.value!, vrefMax.value, 'Vref');
  if (vrefRangeError) return { ok: false, error: vrefRangeError };
  const iadjRangeError = validateRange(iadjMin.value, iadjTyp.value!, iadjMax.value, 'Iadj');
  if (iadjRangeError) return { ok: false, error: iadjRangeError };

  if (BUILTIN_NAMES.has(name.toLowerCase())) {
    return { ok: false, error: `「${name}」与内置型号重名，请换一个名称` };
  }

  return {
    ok: true,
    entry: {
      name,
      custom: true,
      vrefMin: vrefMin.value,
      vrefTyp: vrefTyp.value!,
      vrefMax: vrefMax.value,
      iadjMin: iadjMin.value,
      iadjTyp: iadjTyp.value!,
      iadjMax: iadjMax.value,
    },
  };
}

/** 校验列表：条目上限、重名（不区分大小写）与内置型号冲突。 */
export function normalizeRegulatorList(raw: unknown): RegulatorListResult {
  if (!Array.isArray(raw)) return { ok: false, error: '数据必须是一个稳压器数组' };
  if (raw.length === 0) return { ok: false, error: '文件中没有稳压器数据' };
  if (raw.length > MAX_REGULATOR_ENTRIES) {
    return { ok: false, error: `稳压器条目不能超过 ${MAX_REGULATOR_ENTRIES} 个` };
  }

  const entries: RegulatorEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const result = normalizeRegulatorEntry(raw[i]);
    if (!result.ok) return { ok: false, error: `第 ${i + 1} 条：${result.error}` };
    const key = result.entry.name.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `第 ${i + 1} 条：名称「${result.entry.name}」重复` };
    }
    seen.add(key);
    entries.push(result.entry);
  }
  return { ok: true, entries };
}

/** 读取本地自定义稳压器：跳过损坏/重名/与内置冲突的旧数据，避免面板崩溃。 */
export function loadCustomRegulators(): RegulatorEntry[] {
  try {
    const raw = localStorage.getItem(REG_LS);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: RegulatorEntry[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const result = normalizeRegulatorEntry(item);
      if (!result.ok) continue;
      const key = result.entry.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(result.entry);
      if (out.length >= MAX_REGULATOR_ENTRIES) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** 持久化自定义稳压器（内置项不写入，只写已知字段）。 */
export function saveCustomRegulators(list: RegulatorEntry[]): void {
  try {
    localStorage.setItem(
      REG_LS,
      JSON.stringify(
        list.slice(0, MAX_REGULATOR_ENTRIES).map((entry) => ({
          name: entry.name,
          vrefMin: entry.vrefMin,
          vrefTyp: entry.vrefTyp,
          vrefMax: entry.vrefMax,
          iadjMin: entry.iadjMin,
          iadjTyp: entry.iadjTyp,
          iadjMax: entry.iadjMax,
        })),
      ),
    );
  } catch {
    /* 本地存储不可用或配额不足时忽略，不阻断当前编辑 */
  }
}

/* ── CSV 解析 ─────────────────────────────────────────── */

/** RFC 4180 风格 CSV：支持引号、双引号转义、引号内逗号与换行。 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseDecimalCell(value: string): number | undefined | null {
  const text = value.trim();
  if (text === '') return undefined;
  if (!DECIMAL.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseRegulatorCsv(text: string): RegulatorParseResult {
  if (utf8Bytes(text) > MAX_REGULATOR_FILE_BYTES) {
    return { ok: false, error: `文件超过 ${MAX_REGULATOR_FILE_BYTES / 1024} KB 限制` };
  }
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { ok: false, error: 'CSV 文件为空' };
  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const required = ['name', 'vref_typ', 'iadj_typ'];
  for (const key of required) {
    if (index(key) < 0) return { ok: false, error: `CSV 缺少必需列：${key}` };
  }

  const known = new Set([
    'name',
    'vref_min',
    'vref_typ',
    'vref_max',
    'iadj_min',
    'iadj_typ',
    'iadj_max',
    'source',
    'notes',
  ]);
  const warnings = header
    .filter((key) => key !== '' && !known.has(key))
    .map((key) => `忽略未知列：${key}`);

  const entries: RegulatorEntry[] = [];
  const errors: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.every((cell) => cell.trim() === '')) continue;
    if (row.length > header.length) {
      errors.push(`第 ${i + 1} 行：列数超过表头`);
      continue;
    }
    const data: Record<string, unknown> = {};
    data.name = row[index('name')] ?? '';
    const fieldMap: Record<string, string> = {
      vref_min: 'vrefMin',
      vref_typ: 'vrefTyp',
      vref_max: 'vrefMax',
      iadj_min: 'iadjMin',
      iadj_typ: 'iadjTyp',
      iadj_max: 'iadjMax',
    };
    for (const [column, field] of Object.entries(fieldMap)) {
      const at = index(column);
      if (at < 0) continue;
      const parsed = parseDecimalCell(row[at] ?? '');
      if (parsed === null) {
        errors.push(`第 ${i + 1} 行：${column} 不是有效数字`);
        data[field] = Number.NaN;
      } else {
        data[field] = parsed;
      }
    }
    const result = normalizeRegulatorEntry(data);
    if (!result.ok) {
      errors.push(`第 ${i + 1} 行：${result.error}`);
      continue;
    }
    entries.push(result.entry);
    if (entries.length > MAX_REGULATOR_ENTRIES) {
      return { ok: false, error: `稳压器条目不能超过 ${MAX_REGULATOR_ENTRIES} 个` };
    }
  }

  if (errors.length > 0) return { ok: false, error: errors.slice(0, 4).join('；') };
  if (entries.length === 0) return { ok: false, error: 'CSV 中没有稳压器数据' };

  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `名称「${entry.name}」重复` };
    seen.add(key);
  }
  return { ok: true, entries, warnings };
}

export function parseRegulatorsJson(text: string): RegulatorParseResult {
  if (utf8Bytes(text) > MAX_REGULATOR_FILE_BYTES) {
    return { ok: false, error: `文件超过 ${MAX_REGULATOR_FILE_BYTES / 1024} KB 限制` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: 'JSON 格式无效' };
  }

  let list: unknown;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (isPlainObject(parsed)) {
    if (parsed.format !== REGULATOR_FILE_FORMAT) {
      return { ok: false, error: `缺少 format: ${REGULATOR_FILE_FORMAT} 标记` };
    }
    if (parsed.version !== REGULATOR_FILE_VERSION) {
      return { ok: false, error: `不支持的版本：${String(parsed.version)}` };
    }
    list = parsed.regulators;
  } else {
    return { ok: false, error: 'JSON 顶层必须是对象或数组' };
  }

  const result = normalizeRegulatorList(list);
  return result.ok
    ? { ok: true, entries: result.entries, warnings: [] }
    : { ok: false, error: result.error };
}

/** 按扩展名选择解析器；未知扩展名先按 JSON，再按 CSV 尝试。 */
export function parseRegulatorsFile(text: string, fileName: string): RegulatorParseResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return parseRegulatorsJson(text);
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return parseRegulatorCsv(text);
  const json = parseRegulatorsJson(text);
  if (json.ok) return json;
  return parseRegulatorCsv(text);
}

/* ── 导出 ─────────────────────────────────────────────── */

function publicEntry(entry: RegulatorEntry): Record<string, unknown> {
  return {
    name: entry.name,
    vrefMin: entry.vrefMin,
    vrefTyp: entry.vrefTyp,
    vrefMax: entry.vrefMax,
    iadjMin: entry.iadjMin,
    iadjTyp: entry.iadjTyp,
    iadjMax: entry.iadjMax,
  };
}

export function buildRegulatorsJson(entries: RegulatorEntry[], exportedAt = new Date()): string {
  return JSON.stringify(
    {
      format: REGULATOR_FILE_FORMAT,
      version: REGULATOR_FILE_VERSION,
      exportedAt: exportedAt.toISOString(),
      regulators: entries.map(publicEntry),
    },
    null,
    2,
  );
}

const CSV_HEADER = 'name,vref_min,vref_typ,vref_max,iadj_min,iadj_typ,iadj_max';

export function buildRegulatorsCsv(entries: RegulatorEntry[]): string {
  const lines = [CSV_HEADER];
  for (const entry of entries) {
    lines.push(
      [
        csvCell(entry.name),
        csvCell(entry.vrefMin !== undefined ? String(entry.vrefMin) : ''),
        csvCell(String(entry.vrefTyp)),
        csvCell(entry.vrefMax !== undefined ? String(entry.vrefMax) : ''),
        csvCell(entry.iadjMin !== undefined ? String(entry.iadjMin) : ''),
        csvCell(String(entry.iadjTyp)),
        csvCell(entry.iadjMax !== undefined ? String(entry.iadjMax) : ''),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function regulatorsFileName(format: 'json' | 'csv', date = new Date()): string {
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(
    date.getHours(),
  )}${pad2(date.getMinutes())}`;
  return `calcbridge-regulators-${stamp}.${format}`;
}

/** 导出当前自定义稳压器；空列表时由 UI 禁用按钮。 */
export function downloadRegulatorsFile(
  entries: RegulatorEntry[],
  format: 'json' | 'csv',
  date = new Date(),
): void {
  const content =
    format === 'json' ? buildRegulatorsJson(entries, date) : `\uFEFF${buildRegulatorsCsv(entries)}`;
  const mime = format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8';
  downloadTextFile(regulatorsFileName(format, date), content, mime);
}
