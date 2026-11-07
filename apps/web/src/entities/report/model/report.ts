/** 工程计算报告：纯构建函数 + 浏览器下载。 */
import { csvCell } from '@/shared/lib/csv';
import { APP_VERSION } from '@/shared/config/constants';
import { downloadTextFile } from '@/shared/lib/download';

export type ReportFormat = 'md' | 'csv';

export interface ReportRow {
  label: string;
  value: string;
  note?: string;
}

export interface ReportSection {
  title: string;
  rows: ReportRow[];
}

export interface ReportSnapshot {
  /** 计算器 id，用于文件名校验 */
  id: string;
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  assumptions?: string[];
  disclaimer?: string;
}

export interface ReportMeta {
  generatedAt?: Date;
  version?: string;
  pageUrl?: string;
  /** 计算依据（标准/手册 + 条款），随报告一起归档。 */
  standard?: string;
  /** 可信度分级与误差带。 */
  confidence?: string;
}

const DEFAULT_DISCLAIMER = '本报告为工程估算，非认证、非实测结论；安全相关项必须实测或送认证。';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function mdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function markdownTable(rows: ReportRow[]): string[] {
  if (rows.length === 0) return ['（无）'];
  const lines = ['| 项目 | 数值 | 备注 |', '| --- | --- | --- |'];
  for (const row of rows) {
    lines.push(`| ${mdCell(row.label)} | ${mdCell(row.value)} | ${mdCell(row.note ?? '')} |`);
  }
  return lines;
}

export function buildReportMarkdown(snapshot: ReportSnapshot, meta: ReportMeta = {}): string {
  const generatedAt = meta.generatedAt ?? new Date();
  const lines: string[] = [
    `# 工程计算报告 · ${snapshot.title}`,
    '',
    `- 生成时间：${formatDateTime(generatedAt)}`,
    `- 应用版本：${meta.version ?? APP_VERSION}`,
    `- 页面：${meta.pageUrl ?? `#/${snapshot.id}`}`,
  ];
  if (snapshot.subtitle) lines.push(`- 说明：${snapshot.subtitle}`);
  if (meta.standard) lines.push(`- 计算依据：${meta.standard}`);
  if (meta.confidence) lines.push(`- 可信度：${meta.confidence}`);
  lines.push('');

  for (const section of snapshot.sections) {
    lines.push(`## ${section.title}`, '', ...markdownTable(section.rows), '');
  }

  if (snapshot.assumptions && snapshot.assumptions.length > 0) {
    lines.push('## 假设与边界', '');
    for (const assumption of snapshot.assumptions) lines.push(`- ${assumption}`);
    lines.push('');
  }

  lines.push('---', '', `> ${snapshot.disclaimer ?? DEFAULT_DISCLAIMER}`, '');
  return lines.join('\n');
}

export function buildReportCsv(snapshot: ReportSnapshot, meta: ReportMeta = {}): string {
  const generatedAt = meta.generatedAt ?? new Date();
  const rows: string[][] = [
    ['报告信息', '页面', snapshot.title, snapshot.subtitle ?? ''],
    ['报告信息', '生成时间', formatDateTime(generatedAt), ''],
    ['报告信息', '应用版本', meta.version ?? APP_VERSION, ''],
    ['报告信息', '地址', meta.pageUrl ?? `#/${snapshot.id}`, ''],
  ];
  if (meta.standard) rows.push(['报告信息', '计算依据', meta.standard, '']);
  if (meta.confidence) rows.push(['报告信息', '可信度', meta.confidence, '']);

  for (const section of snapshot.sections) {
    for (const row of section.rows) {
      rows.push([section.title, row.label, row.value, row.note ?? '']);
    }
  }
  for (const assumption of snapshot.assumptions ?? []) {
    rows.push(['假设与边界', '假设', assumption, '']);
  }
  rows.push(['免责声明', '说明', snapshot.disclaimer ?? DEFAULT_DISCLAIMER, '']);

  return ['区块,项目,数值,备注', ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

export function reportFileName(
  snapshot: ReportSnapshot,
  format: ReportFormat,
  date = new Date(),
): string {
  const safeId = snapshot.id.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(
    date.getHours(),
  )}${pad2(date.getMinutes())}`;
  return `calcbridge-${safeId}-${stamp}.${format}`;
}

export function downloadReport(
  snapshot: ReportSnapshot,
  format: ReportFormat,
  meta: ReportMeta = {},
): void {
  const generatedAt = meta.generatedAt ?? new Date();
  const content =
    format === 'md'
      ? buildReportMarkdown(snapshot, { ...meta, generatedAt })
      : `\uFEFF${buildReportCsv(snapshot, { ...meta, generatedAt })}`;
  const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8';
  downloadTextFile(reportFileName(snapshot, format, generatedAt), content, mime);
}
