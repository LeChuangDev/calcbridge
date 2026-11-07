/**
 * 微带线示例叠层：预设只用于快速输入，不代表任何板厂官方叠层。
 * 内部统一用 mm；显示单位由页面按全局单位制转换。
 */
import {
  convertLengthString,
  lengthUnit,
  toMillimetres,
  type UnitSystem,
} from '@/shared/lib/unitSystem';

export type StackupId = 'four-layer' | 'six-layer' | 'two-layer' | 'hdi' | 'custom';

export interface StackupPreset {
  id: Exclude<StackupId, 'custom'>;
  name: string;
  hMm: number;
  tMm: number;
  er: number;
  df: number;
  note: string;
}

export const STACKUP_PRESETS: Record<Exclude<StackupId, 'custom'>, StackupPreset> = {
  'four-layer': {
    id: 'four-layer',
    name: '4 层 · 1.6 mm · 常规 FR-4',
    hMm: 0.2,
    tMm: 0.035,
    er: 4.2,
    df: 0.02,
    note: '示例：信号到参考平面 0.2 mm，1 oz 铜。',
  },
  'six-layer': {
    id: 'six-layer',
    name: '6 层 · 1.6 mm · 常规 FR-4',
    hMm: 0.15,
    tMm: 0.035,
    er: 4.2,
    df: 0.02,
    note: '示例：更薄介质，适合较细线宽。',
  },
  'two-layer': {
    id: 'two-layer',
    name: '2 层 · 1.6 mm',
    hMm: 1.5,
    tMm: 0.035,
    er: 4.2,
    df: 0.02,
    note: '示例：双面板微带线，介质较厚。',
  },
  hdi: {
    id: 'hdi',
    name: 'HDI · 薄介质示例',
    hMm: 0.08,
    tMm: 0.018,
    er: 4.0,
    df: 0.02,
    note: '示例：薄介质/薄铜，需按实际 HDI 叠层复核。',
  },
};

export interface StackupFields {
  h: string;
  t: string;
  er: string;
}

export interface ResolvedStackup {
  id: StackupId;
  name: string;
  hMm: number;
  tMm: number;
  er: number;
  df?: number;
  note?: string;
}

export const DEFAULT_CUSTOM_STACKUP: StackupFields = {
  h: '0.2',
  t: '0.035',
  er: '4.2',
};

export function isStackupId(value: unknown): value is StackupId {
  return (
    value === 'four-layer' ||
    value === 'six-layer' ||
    value === 'two-layer' ||
    value === 'hdi' ||
    value === 'custom'
  );
}

export function presetFields(preset: StackupPreset, system: UnitSystem): StackupFields {
  return {
    h: convertLengthString(String(preset.hMm), 'metric', system),
    t: convertLengthString(String(preset.tMm), 'metric', system),
    er: String(preset.er),
  };
}

export function resolveStackup(
  id: StackupId,
  fields: StackupFields,
  system: UnitSystem,
): ResolvedStackup {
  if (id !== 'custom') {
    const preset = STACKUP_PRESETS[id];
    return { ...preset, id };
  }
  const hMm = toMillimetres(Number(fields.h), lengthUnit(system));
  const tMm = toMillimetres(Number(fields.t), lengthUnit(system));
  const er = Number(fields.er);
  return {
    id: 'custom',
    name: '自定义叠层',
    hMm,
    tMm,
    er,
    note: '自定义参数；请以实际叠层报告为准。',
  };
}

export function stackupSummary(stackup: ResolvedStackup, system: UnitSystem): string {
  const unit = lengthUnit(system);
  return `h ${convertLengthString(String(stackup.hMm), 'metric', system)} ${unit} · t ${convertLengthString(
    String(stackup.tMm),
    'metric',
    system,
  )} ${unit} · εr ${stackup.er}`;
}
