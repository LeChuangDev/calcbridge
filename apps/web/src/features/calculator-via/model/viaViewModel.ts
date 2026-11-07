/**
 * 过孔页视觉模型：把计算结果整理成工艺检查卡、分组指标卡和工程图几何。
 * 纯函数，便于单元测试；ViaPanel 只负责布局与渲染。
 */
import { fmtNum } from '@/shared/lib/bridge';
import type { ViaResult } from '@/features/calculator-via/model/viaSolver';
import type { ViaRuleSet } from '@/features/calculator-via/model/viaRules';
import {
  formatMeasurement,
  formatMeasurementValue,
  lengthUnit,
  type ViaUnitSystem,
} from '@/features/calculator-via/model/viaUnits';

/** 浮点边界容差：0.5 − 0.4 在 JS 中略小于 0.05，不能因此误判 */
const LIMIT_EPSILON = 1e-9;

/** 深径比显示到 3 位小数，避免 mm→mil 往返产生 4.00001 之类的噪声。 */
export function formatAspectRatio(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toFixed(3)).toString();
}

export interface ViaMetric {
  label: string;
  note: string;
  value: string;
  unit?: string;
  /** 输入条件而非计算结果，数值用次级色显示 */
  muted?: boolean;
}

export interface ViaMetricGroup {
  id: string;
  label: string;
  title: string;
  items: ViaMetric[];
}

export type ViaCheckTone = 'ok' | 'warn' | 'neutral';

export interface ViaCheck {
  id: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone: ViaCheckTone;
}

export interface ViaMetricForm {
  z0: string;
  dT: string;
  freq: string;
}

export interface ViaCheckOptions {
  /** 当前输入的成品孔径，mm */
  holeMm: number;
  rules: ViaRuleSet;
  unitSystem: ViaUnitSystem;
}

/** 工艺检查：深径比、环宽、孔径、镀层截面；前三项按规则给出 ok / warn。 */
export function buildViaChecks(result: ViaResult, options: ViaCheckOptions): ViaCheck[] {
  const { holeMm, rules, unitSystem } = options;
  const lenUnit = lengthUnit(unitSystem);

  const aspectOk = result.aspectRatio <= rules.maxAspectRatio + LIMIT_EPSILON;
  const ringOk = result.annularRing >= rules.minAnnularRingMm - LIMIT_EPSILON;
  const holeOk = holeMm >= rules.minHoleMm - LIMIT_EPSILON;

  return [
    {
      id: 'aspect',
      label: '深径比',
      value: formatAspectRatio(result.aspectRatio),
      unit: 'L / D',
      note: `${aspectOk ? '≤' : '>'} ${rules.maxAspectRatio} · ${
        aspectOk ? '常规可加工' : '需与板厂复核'
      }`,
      tone: aspectOk ? 'ok' : 'warn',
    },
    {
      id: 'ring',
      label: '环宽',
      value: formatMeasurementValue(result.annularRing, lenUnit),
      unit: lenUnit,
      note: `${ringOk ? '≥' : '<'} ${formatMeasurement(
        rules.minAnnularRingMm,
        lenUnit,
      )} · ${ringOk ? '常规可加工' : '需与板厂复核'}`,
      tone: ringOk ? 'ok' : 'warn',
    },
    {
      id: 'hole',
      label: '成品孔径',
      value: formatMeasurementValue(holeMm, lenUnit),
      unit: lenUnit,
      note: `${holeOk ? '≥' : '<'} ${formatMeasurement(
        rules.minHoleMm,
        lenUnit,
      )} · ${holeOk ? '常规可加工' : '需与板厂复核'}`,
      tone: holeOk ? 'ok' : 'warn',
    },
    {
      id: 'area',
      label: '镀层截面',
      value: fmtNum(result.areaMm2),
      unit: 'mm²',
      note: 'π(D + T)·T · 铜镀层',
      tone: 'neutral',
    },
  ];
}

/** 结果指标分两组；最后一格用输入条件补足 3×2 网格。 */
export function buildViaMetricGroups(result: ViaResult, form: ViaMetricForm): ViaMetricGroup[] {
  return [
    {
      id: 'dc',
      label: 'DC / THERMAL',
      title: '直流与热',
      items: [
        {
          label: '镀层电阻',
          note: 'R = ρL/A',
          value: fmtNum(result.resistance * 1e3),
          unit: 'mΩ',
        },
        {
          label: '压降',
          note: 'I × R',
          value: fmtNum(result.voltageDrop * 1e3),
          unit: 'mV',
        },
        {
          label: '功耗',
          note: 'I² × R',
          value: fmtNum(result.power * 1e3),
          unit: 'mW',
        },
        {
          label: '轴向热阻',
          note: 'L / (k·A)',
          value: fmtNum(result.thermalResistance),
          unit: '°C/W',
        },
        {
          label: '估计载流量',
          note: 'IPC-2221 外层',
          value: fmtNum(result.currentEstimate),
          unit: 'A',
        },
        {
          label: '允许温升',
          note: '输入条件 · ΔT',
          value: form.dT || '—',
          unit: '°C',
          muted: true,
        },
      ],
    },
    {
      id: 'highspeed',
      label: 'HIGH-SPEED',
      title: '高速寄生',
      items: [
        {
          label: '过孔电容',
          note: '标准 via 模型',
          value: fmtNum(result.capacitancePf),
          unit: 'pF',
        },
        {
          label: '过孔电感',
          note: '5.08·h·(ln(4h/d)+1)',
          value: fmtNum(result.inductanceNh),
          unit: 'nH',
        },
        {
          label: '感抗',
          note: `@ ${fmtNum(Number(form.freq))} MHz`,
          value: fmtNum(result.reactanceOhm),
          unit: 'Ω',
        },
        {
          label: '上升时间下降',
          note: '1.1·Z0·C',
          value: fmtNum(result.riseTimePs),
          unit: 'ps',
        },
        {
          label: '系统上升时间',
          note: '√(tr_in² + tr_via²)',
          value: fmtNum(result.systemRisePs),
          unit: 'ps',
        },
        {
          label: '目标阻抗',
          note: '输入条件 · Z0',
          value: form.z0 || '—',
          unit: 'Ω',
          muted: true,
        },
      ],
    },
  ];
}

/* ── 工程图几何 ───────────────────────────────────────── */

const PAD_RADIUS = 31;
const BARREL_LEFT = 92;
const BARREL_RIGHT = 116;
const BARREL_SPAN = 24;

export interface ViaFigureGeometry {
  padRadius: number;
  holeRadius: number;
  barrelLeft: number;
  barrelRight: number;
  /** 孔壁镀层在示意图中的像素厚度（2–6） */
  wall: number;
  innerLeft: number;
  innerRight: number;
  /** 孔内净宽，至少 1 */
  innerWidth: number;
}

/**
 * 按输入比例计算剖面/俯视示意图的几何。
 * 孔径与镀层均为示意值：孔径限制在焊盘半径内，镀层厚度夹在 2–6。
 */
export function buildViaFigureGeometry(
  hole: number,
  pad: number,
  plating: number,
): ViaFigureGeometry {
  const safeHole = Number.isFinite(hole) ? Math.max(hole, 0) : 0;
  const safePad = Number.isFinite(pad) ? Math.max(pad, 0) : 0;
  const safePlating = Number.isFinite(plating) ? Math.max(plating, 0) : 0;

  const ratio = (PAD_RADIUS * safeHole) / Math.max(safePad, safeHole, 1e-6);
  const holeRadius = Math.min(PAD_RADIUS - 4, Math.max(3, ratio));
  const wall = Math.max(2, Math.min(6, (safePlating / Math.max(safeHole, 1e-6)) * BARREL_SPAN));
  const innerLeft = BARREL_LEFT + wall;
  const innerRight = BARREL_RIGHT - wall;

  return {
    padRadius: PAD_RADIUS,
    holeRadius,
    barrelLeft: BARREL_LEFT,
    barrelRight: BARREL_RIGHT,
    wall,
    innerLeft,
    innerRight,
    innerWidth: Math.max(1, innerRight - innerLeft),
  };
}
