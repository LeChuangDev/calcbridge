/**
 * 微带线阻抗校验体系：导入 Polar / Sigrity / 场解算 / 测试 coupon 数据，
 * 对每个模型分别计算误差、适用域覆盖率与发布门槛。
 *
 * 不伪造参考值：没有导入 Polar/Sigrity 数据时，报告会明确标注“待导入”。
 */
import { IMPEDANCE_MODELS, type ImpedanceModel } from '../impedance/models';

export type ImpedanceValidationSource =
  | 'polar'
  | 'sigrity'
  | 'field-solver'
  | 'test-coupon'
  | 'jlc'
  | 'published'
  | 'template'
  | 'unknown';

export type ImpedanceValidationMode = 'z0' | 'width';

export interface ImpedanceGoldenCase {
  id: string;
  source: ImpedanceValidationSource;
  sourceVersion?: string;
  date?: string;
  notes?: string;
  mode: ImpedanceValidationMode;
  wMm: number;
  hMm: number;
  tMm: number;
  er: number;
  /** width 模式必填 */
  targetOhm?: number;
  /** 参考 Z0（Ω）或参考线宽（mm） */
  expected: number;
  /** 允许相对误差，% */
  tolerancePct: number;
  /** 是否纳入发布门槛；缺省 true */
  required?: boolean;
}

export interface CaseModelResult {
  modelId: string;
  modelName: string;
  applicable: boolean;
  value: number | null;
  errorPct: number | null;
  passed: boolean;
  reason: string | null;
}

export interface CaseValidationResult {
  case: ImpedanceGoldenCase;
  models: CaseModelResult[];
  status: 'pass' | 'fail' | 'not-applicable';
}

export interface ModelValidationSummary {
  modelId: string;
  modelName: string;
  totalCases: number;
  applicableCases: number;
  passed: number;
  failed: number;
  coveragePct: number;
  meanAbsErrorPct: number | null;
  maxAbsErrorPct: number | null;
  passRate: number;
}

export interface SourceValidationSummary {
  source: ImpedanceValidationSource;
  cases: number;
  passed: number;
  failed: number;
  notApplicable: number;
}

export interface ModelGateResult {
  modelId: string;
  modelName: string;
  meanAbsErrorPct: number | null;
  passRate: number;
  passed: boolean;
  reasons: string[];
}

export interface ValidationGateOptions {
  /** 每个模型的平均绝对误差上限，默认 5% */
  maxMeanAbsErrorPct?: number;
  /** 每个模型的适用案例通过率下限，默认 0.8 */
  minPassRate?: number;
  /** 是否要求存在 Polar/Sigrity 案例，默认 false */
  requirePolarSigrity?: boolean;
  /** Polar 与 Sigrity 各至少需要的案例数，默认 1 */
  minPolarSigrityCases?: number;
}

export interface ImpedanceValidationGate {
  passed: boolean;
  modelChecks: ModelGateResult[];
  polarSigrityCases: number;
  polarSigrityComplete: boolean;
  requirePolarSigrity: boolean;
  reasons: string[];
}

export interface ImpedanceValidationReport {
  generatedAt: string;
  cases: CaseValidationResult[];
  modelSummaries: ModelValidationSummary[];
  sourceSummaries: SourceValidationSummary[];
  gate: ImpedanceValidationGate;
}

const MODEL_EPS = 1e-9;

function normSource(raw: unknown): ImpedanceValidationSource {
  const text = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (text === 'polar' || text === 'polarinstruments') return 'polar';
  if (text === 'sigrity' || text === 'cadencesigrity') return 'sigrity';
  if (text === 'fieldsolver' || text === 'field' || text === '2d' || text === '3d') {
    return 'field-solver';
  }
  if (text === 'testcoupon' || text === 'coupon' || text === 'measurement') return 'test-coupon';
  if (text === 'jlc' || text === 'jlcpcb' || text === 'jialichuang') return 'jlc';
  if (text === 'published' || text === 'textbook' || text === 'paper') return 'published';
  if (text === 'template') return 'template';
  return 'unknown';
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireNumber(value: unknown, field: string, caseId: string): number {
  if (!finite(value) || value <= 0) {
    throw new Error(`用例 ${caseId} 的 ${field} 必须是正数`);
  }
  return value;
}

/** 校验并规范化从 JSON 读入的对象。 */
export function normalizeImpedanceCase(raw: unknown, index = 0): ImpedanceGoldenCase {
  if (!raw || typeof raw !== 'object') throw new Error(`第 ${index + 1} 个用例不是对象`);
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `case-${index + 1}`;
  const source = normSource(r.source);
  const mode = r.mode === 'width' ? 'width' : r.mode === 'z0' ? 'z0' : null;
  if (!mode) throw new Error(`用例 ${id} 的 mode 必须是 z0 或 width`);
  const wMm = requireNumber(r.wMm ?? r.w_mm, 'wMm', id);
  const hMm = requireNumber(r.hMm ?? r.h_mm, 'hMm', id);
  const tMm = requireNumber(r.tMm ?? r.t_mm, 'tMm', id);
  const er = requireNumber(r.er, 'er', id);
  const expected = requireNumber(r.expected, 'expected', id);
  const tolerancePct =
    finite(r.tolerancePct) && r.tolerancePct > 0
      ? r.tolerancePct
      : finite(r.tolerance_pct) && r.tolerance_pct > 0
        ? r.tolerance_pct
        : 5;
  const targetOhm =
    finite(r.targetOhm) && r.targetOhm > 0
      ? r.targetOhm
      : finite(r.target_ohm) && r.target_ohm > 0
        ? r.target_ohm
        : undefined;
  if (mode === 'width' && targetOhm == null) {
    throw new Error(`用例 ${id} 为 width 模式，必须提供 targetOhm`);
  }

  return {
    id,
    source,
    sourceVersion:
      typeof r.sourceVersion === 'string'
        ? r.sourceVersion
        : typeof r.source_version === 'string'
          ? r.source_version
          : undefined,
    date: typeof r.date === 'string' ? r.date : undefined,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    mode,
    wMm,
    hMm,
    tMm,
    er,
    targetOhm,
    expected,
    tolerancePct,
    required: r.required !== false,
  };
}

/** 从 JSON 文本解析；支持数组或 { cases: [...] }。 */
export function parseImpedanceJson(text: string): ImpedanceGoldenCase[] {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cases?: unknown }).cases)
      ? (parsed as { cases: unknown[] }).cases
      : null;
  if (!list) throw new Error('JSON 必须是用例数组或 { "cases": [...] }');
  return list.map((item, index) => normalizeImpedanceCase(item, index));
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else quoted = false;
      } else current += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim());
}

/** CSV 表头：id,source,source_version,date,mode,w_mm,h_mm,t_mm,er,target_ohm,expected,tolerance_pct,notes */
export function parseImpedanceCsv(text: string): ImpedanceGoldenCase[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error('CSV 至少需要表头和数据行');
  const header = parseCsvLine(lines[0]!);
  const indexOf = (name: string) => header.indexOf(name);
  const requiredColumns = ['id', 'source', 'mode', 'w_mm', 'h_mm', 't_mm', 'er', 'expected'];
  for (const name of requiredColumns) {
    if (indexOf(name) < 0) throw new Error(`CSV 缺少列：${name}`);
  }
  const cell = (row: string[], name: string) => {
    const index = indexOf(name);
    return index >= 0 ? row[index] ?? '' : '';
  };
  const parse = (row: string[], name: string): number | undefined => {
    const textValue = cell(row, name);
    if (textValue === '') return undefined;
    const value = Number(textValue);
    if (!Number.isFinite(value)) throw new Error(`CSV 行 ${name}=${textValue} 不是数字`);
    return value;
  };

  return lines.slice(1).map((line, index) => {
    const row = parseCsvLine(line);
    const id = cell(row, 'id') || `case-${index + 1}`;
    const source = cell(row, 'source');
    const mode = cell(row, 'mode');
    const expected = parse(row, 'expected');
    if (expected == null) throw new Error(`CSV 用例 ${id} 缺少 expected`);
    return normalizeImpedanceCase(
      {
        id,
        source,
        source_version: cell(row, 'source_version') || undefined,
        date: cell(row, 'date') || undefined,
        mode,
        w_mm: parse(row, 'w_mm'),
        h_mm: parse(row, 'h_mm'),
        t_mm: parse(row, 't_mm'),
        er: parse(row, 'er'),
        target_ohm: parse(row, 'target_ohm'),
        expected,
        tolerance_pct: parse(row, 'tolerance_pct') ?? 5,
        notes: cell(row, 'notes') || undefined,
      },
      index,
    );
  });
}

function evaluateCase(
  golden: ImpedanceGoldenCase,
  model: ImpedanceModel,
): CaseModelResult {
  const params = {
    wMm: golden.wMm,
    hMm: golden.hMm,
    tMm: golden.tMm,
    er: golden.er,
    targetOhm: golden.targetOhm ?? 50,
  };

  let value: number | null = null;
  let reason: string | null = null;
  if (golden.mode === 'z0') {
    value = model.z0(params, golden.wMm);
    reason = model.applicability(params, golden.wMm);
  } else {
    value = model.widthFor(params, golden.targetOhm!);
    reason = value == null ? '目标阻抗无法由该模型求解' : model.applicability(params, value);
  }

  const applicable = value != null && reason == null;
  const errorPct = value == null ? null : ((value - golden.expected) / golden.expected) * 100;
  return {
    modelId: model.id,
    modelName: model.name,
    applicable,
    value,
    errorPct,
    passed:
      applicable &&
      errorPct != null &&
      Math.abs(errorPct) <= golden.tolerancePct + MODEL_EPS,
    reason,
  };
}

function modelSummary(
  model: ImpedanceModel,
  results: CaseValidationResult[],
  totalCases: number,
): ModelValidationSummary {
  const applicable = results
    .flatMap((r) => r.models)
    .filter((r) => r.modelId === model.id && r.applicable && r.errorPct != null);
  const passed = applicable.filter((r) => r.passed).length;
  const errors = applicable.map((r) => Math.abs(r.errorPct!));
  const meanAbsErrorPct =
    errors.length === 0 ? null : errors.reduce((a, b) => a + b, 0) / errors.length;
  const maxAbsErrorPct = errors.length === 0 ? null : Math.max(...errors);
  return {
    modelId: model.id,
    modelName: model.name,
    totalCases,
    applicableCases: applicable.length,
    passed,
    failed: applicable.length - passed,
    coveragePct: totalCases === 0 ? 0 : (applicable.length / totalCases) * 100,
    meanAbsErrorPct,
    maxAbsErrorPct,
    passRate: applicable.length === 0 ? 0 : passed / applicable.length,
  };
}

function sourceSummaries(results: CaseValidationResult[]): SourceValidationSummary[] {
  const sources: ImpedanceValidationSource[] = [
    'polar',
    'sigrity',
    'field-solver',
    'test-coupon',
    'published',
    'template',
    'unknown',
  ];
  return sources
    .map((source) => {
      const cases = results.filter((r) => r.case.source === source);
      return {
        source,
        cases: cases.length,
        passed: cases.filter((r) => r.status === 'pass').length,
        failed: cases.filter((r) => r.status === 'fail').length,
        notApplicable: cases.filter((r) => r.status === 'not-applicable').length,
      };
    })
    .filter((s) => s.cases > 0);
}

export function validateImpedanceDataset(
  cases: ImpedanceGoldenCase[],
  options: ValidationGateOptions = {},
): ImpedanceValidationReport {
  const results: CaseValidationResult[] = cases.map((golden) => {
    const modelResults = IMPEDANCE_MODELS.map((model) => evaluateCase(golden, model));
    const applicable = modelResults.filter((r) => r.applicable);
    const status: CaseValidationResult['status'] =
      applicable.length === 0
        ? 'not-applicable'
        : applicable.every((r) => r.passed)
          ? 'pass'
          : 'fail';
    return { case: golden, models: modelResults, status };
  });

  const modelSummaries = IMPEDANCE_MODELS.map((model) =>
    modelSummary(model, results, cases.length),
  );
  const sources = sourceSummaries(results);
  const polarSigrityCases =
    (sources.find((s) => s.source === 'polar')?.cases ?? 0) +
    (sources.find((s) => s.source === 'sigrity')?.cases ?? 0);
  const minPolarCases = options.minPolarSigrityCases ?? 1;
  const polarSigrityComplete =
    (sources.find((s) => s.source === 'polar')?.cases ?? 0) >= minPolarCases &&
    (sources.find((s) => s.source === 'sigrity')?.cases ?? 0) >= minPolarCases;
  const maxMean = options.maxMeanAbsErrorPct ?? 5;
  const minPass = options.minPassRate ?? 0.8;

  const modelChecks: ModelGateResult[] = modelSummaries.map((summary) => {
    const reasons: string[] = [];
    if (summary.applicableCases === 0) reasons.push('没有适用案例');
    if (summary.meanAbsErrorPct == null || summary.meanAbsErrorPct > maxMean) {
      reasons.push(`平均绝对误差超过 ${maxMean}%`);
    }
    if (summary.passRate < minPass) reasons.push(`通过率低于 ${minPass * 100}%`);
    return {
      modelId: summary.modelId,
      modelName: summary.modelName,
      meanAbsErrorPct: summary.meanAbsErrorPct,
      passRate: summary.passRate,
      passed: reasons.length === 0,
      reasons,
    };
  });

  const reasons: string[] = [];
  for (const check of modelChecks) {
    if (!check.passed) reasons.push(`${check.modelName}: ${check.reasons.join('；')}`);
  }
  if (options.requirePolarSigrity && !polarSigrityComplete) {
    reasons.push('缺少 Polar / Sigrity 对照数据');
  }

  return {
    generatedAt: new Date().toISOString(),
    cases: results,
    modelSummaries,
    sourceSummaries: sources,
    gate: {
      passed: reasons.length === 0,
      modelChecks,
      polarSigrityCases,
      polarSigrityComplete,
      requirePolarSigrity: options.requirePolarSigrity === true,
      reasons,
    },
  };
}

export function formatValidationMarkdown(report: ImpedanceValidationReport): string {
  const lines = [
    '# 微带线阻抗校验报告',
    '',
    `- 生成时间：${report.generatedAt}`,
    `- 用例总数：${report.cases.length}`,
    `- Polar/Sigrity 用例：${report.gate.polarSigrityCases}（${
      report.gate.polarSigrityComplete ? '已导入' : '待导入'
    }）`,
    `- 发布门槛：${report.gate.passed ? '通过' : '未通过'}`,
    '',
    '## 模型汇总',
    '',
    '| 模型 | 适用案例 | 覆盖率 | 通过率 | 平均绝对误差 | 最大误差 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const s of report.modelSummaries) {
    lines.push(
      `| ${s.modelName} | ${s.applicableCases}/${s.totalCases} | ${s.coveragePct.toFixed(
        1,
      )}% | ${(s.passRate * 100).toFixed(1)}% | ${
        s.meanAbsErrorPct == null ? '—' : `${s.meanAbsErrorPct.toFixed(2)}%`
      } | ${s.maxAbsErrorPct == null ? '—' : `${s.maxAbsErrorPct.toFixed(2)}%`} |`,
    );
  }

  lines.push('', '## 数据来源', '', '| 来源 | 用例 | 通过 | 失败 | 不适用 |', '| --- | ---: | ---: | ---: | ---: |');
  for (const s of report.sourceSummaries) {
    lines.push(`| ${s.source} | ${s.cases} | ${s.passed} | ${s.failed} | ${s.notApplicable} |`);
  }

  lines.push('', '## 明细', '', '| 用例 | 来源 | 模型 | 结果 | 误差 | 判定 |', '| --- | --- | --- | ---: | ---: | --- |');
  for (const item of report.cases) {
    for (const m of item.models) {
      const value = m.value == null ? '—' : m.value.toFixed(item.case.mode === 'z0' ? 3 : 4);
      const error = m.errorPct == null ? '—' : `${m.errorPct.toFixed(2)}%`;
      const verdict = !m.applicable ? (m.reason ?? '不适用') : m.passed ? '通过' : '失败';
      lines.push(
        `| ${item.case.id} | ${item.case.source} | ${m.modelName} | ${value} | ${error} | ${verdict} |`,
      );
    }
  }

  lines.push('', '## 门槛判定', '');
  for (const check of report.gate.modelChecks) {
    lines.push(
      `- ${check.passed ? '✓' : '✗'} ${check.modelName}：平均绝对误差 ${
        check.meanAbsErrorPct == null ? '—' : `${check.meanAbsErrorPct.toFixed(2)}%`
      }，通过率 ${(check.passRate * 100).toFixed(1)}%${
        check.reasons.length ? `（${check.reasons.join('；')}）` : ''
      }`,
    );
  }
  if (!report.gate.polarSigrityComplete) {
    lines.push('- ⚠ 尚未导入完整的 Polar / Sigrity 对照数据；当前结果不能用于宣称“已通过 Polar/Sigrity 校验”。');
  }
  if (report.gate.reasons.length > 0) {
    lines.push('', '**未通过原因**：');
    for (const reason of report.gate.reasons) lines.push(`- ${reason}`);
  }
  lines.push(
    '',
    '> 校验数据必须来自实际 Polar/Sigrity 导出、场解算结果或测试 coupon；不得用模型自身输出伪造对照数据。',
    '',
  );
  return lines.join('\n');
}
