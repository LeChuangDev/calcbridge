/**
 * IPC-2221B 表 6-1 最小电气间隙表（mm）。
 * 表格与查询逻辑集中在这里，面板与基准执行器共用同一份实现。
 */
export interface GapColumn {
  id: string;
  short: string;
  desc: string;
}

export interface GapRow {
  label: string;
  max: number;
  values: number[];
}

export const CLEARANCE_COLUMNS: GapColumn[] = [
  { id: 'B1', short: '内部导体', desc: '内部导体' },
  { id: 'B2', short: '外部无浸渍 ≤3050m', desc: '外部导体，无浸渍处理，海拔高度 3050 米及以下' },
  { id: 'B3', short: '外部无浸渍 >3050m', desc: '外部导体，无浸渍处理，海拔高度 3050 米以上' },
  { id: 'B4', short: '外部永久浸渍', desc: '外部导体，永久性的聚合物浸渍处理（任何海拔高度）' },
  { id: 'A5', short: '外部 conformal', desc: '外部导体，进行 conformal 浸渍处理（任何海拔高度）' },
  { id: 'A6', short: '引线/缠绕 无浸渍', desc: '外部组件引线/缠绕，无浸渍处理' },
  {
    id: 'A7',
    short: '引线/缠绕 conformal',
    desc: '外部组件引线/缠绕，进行 conformal 浸渍处理（任何海拔高度）',
  },
];

export const CLEARANCE_ROWS: GapRow[] = [
  { label: '0 – 15 V', max: 15, values: [0.05, 0.1, 0.1, 0.05, 0.13, 0.13, 0.13] },
  { label: '16 – 30 V', max: 30, values: [0.05, 0.1, 0.1, 0.05, 0.13, 0.25, 0.13] },
  { label: '31 – 50 V', max: 50, values: [0.1, 0.6, 0.6, 0.13, 0.13, 0.4, 0.13] },
  { label: '51 – 100 V', max: 100, values: [0.1, 0.6, 0.6, 0.13, 0.13, 0.5, 0.13] },
  { label: '101 – 150 V', max: 150, values: [0.2, 0.6, 3.2, 0.4, 0.4, 0.8, 0.4] },
  { label: '151 – 170 V', max: 170, values: [0.2, 1.25, 3.2, 0.4, 0.4, 0.8, 0.4] },
  { label: '171 – 250 V', max: 250, values: [0.2, 1.25, 6.4, 0.4, 0.4, 0.8, 0.4] },
  { label: '251 – 300 V', max: 300, values: [0.2, 1.25, 12.5, 0.4, 0.4, 0.8, 0.8] },
  { label: '301 – 500 V', max: 500, values: [0.25, 2.5, 12.5, 0.8, 0.8, 1.5, 0.8] },
  { label: '> 500 V', max: Infinity, values: [0.25, 2.5, 12.5, 0.8, 0.8, 1.5, 0.8] },
];

/** 按电压选择档位；非法电压返回 null。 */
export function clearanceRow(voltageV: number): GapRow | null {
  if (!Number.isFinite(voltageV) || voltageV <= 0) return null;
  return CLEARANCE_ROWS.find((row) => voltageV <= row.max) ?? null;
}

/** 查询指定档位的间隙值（mm）；列 id 无效时返回 null。 */
export function clearanceGap(voltageV: number, columnId: string): number | null {
  const row = clearanceRow(voltageV);
  if (!row) return null;
  const index = CLEARANCE_COLUMNS.findIndex((column) => column.id === columnId);
  if (index === -1) return null;
  return row.values[index] ?? null;
}
