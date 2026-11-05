/**
 * 量纲系统（FR-A1：量纲安全输入）。
 *
 * 量纲用 7 个基量的指数向量表示：
 *   [M, L, T, I, Θ, N, J] = 质量、长度、时间、电流、温度、物质的量、发光强度
 * 所有单位通过 factor 折算到 SI 基准单位；摄氏度为唯一带偏移（offset）的单位。
 */

export const DIM = {
  M: 0,
  L: 1,
  T: 2,
  I: 3,
  TH: 4,
  N: 5,
  J: 6,
} as const;

export const DIM_COUNT = 7;

export type DimVec = readonly number[];

/** 无量纲（纯数） */
export const DIMLESS: DimVec = [0, 0, 0, 0, 0, 0, 0];

export function dimEq(a: DimVec, b: DimVec): boolean {
  for (let i = 0; i < DIM_COUNT; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function dimAdd(a: DimVec, b: DimVec): DimVec {
  return a.map((v, i) => v + b[i]);
}

export function dimSub(a: DimVec, b: DimVec): DimVec {
  return a.map((v, i) => v - b[i]);
}

export function dimScale(a: DimVec, n: number): DimVec {
  return a.map((v) => v * n);
}

/** 人类可读的量纲字符串，如 "L T^-1"、"M L^2 T^-3 I^-2"（电阻） */
export function dimToString(d: DimVec): string {
  const parts: string[] = [];
  const names = ['M', 'L', 'T', 'I', 'Θ', 'N', 'J'];
  for (let i = 0; i < DIM_COUNT; i++) {
    const e = d[i];
    if (e === 0) continue;
    parts.push(e === 1 ? names[i] : `${names[i]}^${e}`);
  }
  return parts.length === 0 ? '1' : parts.join(' ');
}

export interface UnitDef {
  /** 内部 id，如 'mm'、'celsius'、'mohm' */
  id: string;
  /** 显示符号，如 'Ω'、'µm'、'°C' */
  symbol: string;
  /** 别名（含符号变体），用于解析 */
  aliases: string[];
  dims: DimVec;
  /** 乘数：value_si = value * factor + offset */
  factor: number;
  /** 加性偏移（仅摄氏度） */
  offset?: number;
}

const L = DIM.L;
const M = DIM.M;
const T = DIM.T;
const I = DIM.I;
const TH = DIM.TH;

/** 基量简写向量 */
const v = (dims: Record<number, number>): DimVec => {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const k of Object.keys(dims)) out[Number(k)] = dims[Number(k)];
  return out;
};

export const UNITS: UnitDef[] = [
  // ── 长度 ──
  { id: 'm', symbol: 'm', aliases: ['m', 'meter', 'meters'], dims: v({ [L]: 1 }), factor: 1 },
  { id: 'mm', symbol: 'mm', aliases: ['mm'], dims: v({ [L]: 1 }), factor: 1e-3 },
  { id: 'cm', symbol: 'cm', aliases: ['cm'], dims: v({ [L]: 1 }), factor: 1e-2 },
  {
    id: 'um',
    symbol: 'µm',
    aliases: ['um', 'µm', 'micron', 'microns'],
    dims: v({ [L]: 1 }),
    factor: 1e-6,
  },
  { id: 'nm', symbol: 'nm', aliases: ['nm'], dims: v({ [L]: 1 }), factor: 1e-9 },
  {
    id: 'in',
    symbol: 'in',
    aliases: ['in', 'inch', 'inches'],
    dims: v({ [L]: 1 }),
    factor: 0.0254,
  },
  { id: 'mil', symbol: 'mil', aliases: ['mil', 'mils'], dims: v({ [L]: 1 }), factor: 2.54e-5 },
  { id: 'ft', symbol: 'ft', aliases: ['ft', 'foot', 'feet'], dims: v({ [L]: 1 }), factor: 0.3048 },

  // ── 面积 ──
  { id: 'm2', symbol: 'm²', aliases: ['m2', 'm^2', 'm²'], dims: v({ [L]: 2 }), factor: 1 },
  { id: 'mm2', symbol: 'mm²', aliases: ['mm2', 'mm^2', 'mm²'], dims: v({ [L]: 2 }), factor: 1e-6 },
  {
    id: 'mil2',
    symbol: 'mil²',
    aliases: ['mil2', 'mil^2', 'mil²'],
    dims: v({ [L]: 2 }),
    factor: 6.4516e-10,
  },
  { id: 'cm2', symbol: 'cm²', aliases: ['cm2', 'cm^2', 'cm²'], dims: v({ [L]: 2 }), factor: 1e-4 },
  {
    id: 'in2',
    symbol: 'in²',
    aliases: ['in2', 'in^2', 'in²'],
    dims: v({ [L]: 2 }),
    factor: 6.4516e-4,
  },

  // ── 电流 ──
  { id: 'A', symbol: 'A', aliases: ['A', 'amp', 'amps'], dims: v({ [I]: 1 }), factor: 1 },
  { id: 'mA', symbol: 'mA', aliases: ['mA'], dims: v({ [I]: 1 }), factor: 1e-3 },
  { id: 'uA', symbol: 'µA', aliases: ['uA', 'µA'], dims: v({ [I]: 1 }), factor: 1e-6 },
  { id: 'kA', symbol: 'kA', aliases: ['kA'], dims: v({ [I]: 1 }), factor: 1e3 },

  // ── 时间 ──
  {
    id: 's',
    symbol: 's',
    aliases: ['s', 'sec', 'secs', 'second', 'seconds'],
    dims: v({ [T]: 1 }),
    factor: 1,
  },
  { id: 'ms', symbol: 'ms', aliases: ['ms'], dims: v({ [T]: 1 }), factor: 1e-3 },
  { id: 'us', symbol: 'µs', aliases: ['us', 'µs'], dims: v({ [T]: 1 }), factor: 1e-6 },
  { id: 'ns', symbol: 'ns', aliases: ['ns'], dims: v({ [T]: 1 }), factor: 1e-9 },
  {
    id: 'min',
    symbol: 'min',
    aliases: ['min', 'minute', 'minutes'],
    dims: v({ [T]: 1 }),
    factor: 60,
  },
  {
    id: 'h',
    symbol: 'h',
    aliases: ['h', 'hr', 'hour', 'hours'],
    dims: v({ [T]: 1 }),
    factor: 3600,
  },

  // ── 温度（摄氏度为唯一带偏移单位）──
  { id: 'kelvin', symbol: 'K', aliases: ['K', 'kelvin'], dims: v({ [TH]: 1 }), factor: 1 },
  {
    id: 'celsius',
    symbol: '°C',
    aliases: ['celsius', 'degC', '°C', '℃'],
    dims: v({ [TH]: 1 }),
    factor: 1,
    offset: 273.15,
  },

  // ── 质量 ──
  { id: 'kg', symbol: 'kg', aliases: ['kg'], dims: v({ [M]: 1 }), factor: 1 },
  { id: 'g', symbol: 'g', aliases: ['g'], dims: v({ [M]: 1 }), factor: 1e-3 },
  { id: 'mg', symbol: 'mg', aliases: ['mg'], dims: v({ [M]: 1 }), factor: 1e-6 },

  // ── 电阻 ──
  {
    id: 'ohm',
    symbol: 'Ω',
    aliases: ['ohm', 'Ω', 'Ohm'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -2 }),
    factor: 1,
  },
  {
    id: 'mohm',
    symbol: 'mΩ',
    aliases: ['mohm', 'mΩ'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -2 }),
    factor: 1e-3,
  },
  {
    id: 'kohm',
    symbol: 'kΩ',
    aliases: ['kohm', 'kΩ'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -2 }),
    factor: 1e3,
  },
  {
    id: 'Mohm',
    symbol: 'MΩ',
    aliases: ['Mohm', 'MΩ'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -2 }),
    factor: 1e6,
  },

  // ── 电压 ──
  {
    id: 'V',
    symbol: 'V',
    aliases: ['V', 'volt', 'volts'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -1 }),
    factor: 1,
  },
  {
    id: 'mV',
    symbol: 'mV',
    aliases: ['mV'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -1 }),
    factor: 1e-3,
  },
  {
    id: 'kV',
    symbol: 'kV',
    aliases: ['kV'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -1 }),
    factor: 1e3,
  },
  {
    id: 'uV',
    symbol: 'µV',
    aliases: ['uV', 'µV'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3, [I]: -1 }),
    factor: 1e-6,
  },

  // ── 功率 ──
  {
    id: 'W',
    symbol: 'W',
    aliases: ['W', 'watt', 'watts'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3 }),
    factor: 1,
  },
  { id: 'mW', symbol: 'mW', aliases: ['mW'], dims: v({ [M]: 1, [L]: 2, [T]: -3 }), factor: 1e-3 },
  { id: 'kW', symbol: 'kW', aliases: ['kW'], dims: v({ [M]: 1, [L]: 2, [T]: -3 }), factor: 1e3 },
  {
    id: 'uW',
    symbol: 'µW',
    aliases: ['uW', 'µW'],
    dims: v({ [M]: 1, [L]: 2, [T]: -3 }),
    factor: 1e-6,
  },

  // ── 能量 ──
  {
    id: 'J',
    symbol: 'J',
    aliases: ['J', 'joule', 'joules'],
    dims: v({ [M]: 1, [L]: 2, [T]: -2 }),
    factor: 1,
  },
  { id: 'mJ', symbol: 'mJ', aliases: ['mJ'], dims: v({ [M]: 1, [L]: 2, [T]: -2 }), factor: 1e-3 },

  // ── 电容 ──
  {
    id: 'F',
    symbol: 'F',
    aliases: ['F', 'farad', 'farads'],
    dims: v({ [M]: -1, [L]: -2, [T]: 4, [I]: 2 }),
    factor: 1,
  },
  {
    id: 'uF',
    symbol: 'µF',
    aliases: ['uF', 'µF'],
    dims: v({ [M]: -1, [L]: -2, [T]: 4, [I]: 2 }),
    factor: 1e-6,
  },
  {
    id: 'nF',
    symbol: 'nF',
    aliases: ['nF'],
    dims: v({ [M]: -1, [L]: -2, [T]: 4, [I]: 2 }),
    factor: 1e-9,
  },
  {
    id: 'pF',
    symbol: 'pF',
    aliases: ['pF'],
    dims: v({ [M]: -1, [L]: -2, [T]: 4, [I]: 2 }),
    factor: 1e-12,
  },
  {
    id: 'mF',
    symbol: 'mF',
    aliases: ['mF'],
    dims: v({ [M]: -1, [L]: -2, [T]: 4, [I]: 2 }),
    factor: 1e-3,
  },

  // ── 电感 ──
  {
    id: 'H',
    symbol: 'H',
    aliases: ['H', 'henry', 'henries'],
    dims: v({ [M]: 1, [L]: 2, [T]: -2, [I]: -2 }),
    factor: 1,
  },
  {
    id: 'uH',
    symbol: 'µH',
    aliases: ['uH', 'µH'],
    dims: v({ [M]: 1, [L]: 2, [T]: -2, [I]: -2 }),
    factor: 1e-6,
  },
  {
    id: 'mH',
    symbol: 'mH',
    aliases: ['mH'],
    dims: v({ [M]: 1, [L]: 2, [T]: -2, [I]: -2 }),
    factor: 1e-3,
  },
  {
    id: 'nH',
    symbol: 'nH',
    aliases: ['nH'],
    dims: v({ [M]: 1, [L]: 2, [T]: -2, [I]: -2 }),
    factor: 1e-9,
  },

  // ── 频率 ──
  { id: 'Hz', symbol: 'Hz', aliases: ['Hz', 'hz'], dims: v({ [T]: -1 }), factor: 1 },
  { id: 'kHz', symbol: 'kHz', aliases: ['kHz'], dims: v({ [T]: -1 }), factor: 1e3 },
  { id: 'MHz', symbol: 'MHz', aliases: ['MHz'], dims: v({ [T]: -1 }), factor: 1e6 },
  { id: 'GHz', symbol: 'GHz', aliases: ['GHz'], dims: v({ [T]: -1 }), factor: 1e9 },

  // ── 铜箔厚度：1oz = 35µm（IPC 常用 1.378 mil ≈ 35µm，换算为长度量纲）──
  { id: 'oz', symbol: 'oz', aliases: ['oz', 'ounce', 'oz_cu'], dims: v({ [L]: 1 }), factor: 35e-6 },

  // ── 电阻率 ──
  {
    id: 'ohm_m',
    symbol: 'Ω·m',
    aliases: ['ohm_m', 'ohm.m'],
    dims: v({ [M]: 1, [L]: 3, [T]: -3, [I]: -2 }),
    factor: 1,
  },

  // ── 无量纲（纯数，如介电常数、占空比）──
  { id: 'dimless', symbol: '—', aliases: ['', '1', 'dimensionless'], dims: DIMLESS, factor: 1 },
];

const byId = new Map<string, UnitDef>();
const byAlias = new Map<string, UnitDef>();

for (const u of UNITS) {
  byId.set(u.id, u);
  byAlias.set(u.id, u);
  for (const a of u.aliases) byAlias.set(a, u);
}

/** 规范化用户输入的单位字符串（处理 unicode 与上标） */
export function normalizeUnitToken(s: string): string {
  return s
    .replace(/µ/g, 'u')
    .replace(/μ/g, 'u')
    .replace(/Ω/g, 'ohm')
    .replace(/Ω/g, 'ohm')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/°C/g, 'celsius')
    .replace(/℃/g, 'celsius')
    .replace(/\^2/g, '2')
    .replace(/\^3/g, '3')
    .trim();
}

export function getUnit(idOrAlias: string): UnitDef | undefined {
  return byId.get(idOrAlias) ?? byAlias.get(normalizeUnitToken(idOrAlias));
}

export function unitByDim(dims: DimVec): UnitDef[] {
  return UNITS.filter((u) => dimEq(u.dims, dims));
}

/** 将值从单位 a 换算到单位 b；量纲不一致抛错（FR-A1 不允许静默换算） */
export function convert(value: number, from: UnitDef, to: UnitDef): number {
  if (!dimEq(from.dims, to.dims)) {
    throw new Error(
      `量纲不匹配：无法从 ${from.symbol} (${dimToString(from.dims)}) 换算到 ${to.symbol} (${dimToString(to.dims)})`,
    );
  }
  const si = value * from.factor + (from.offset ?? 0);
  return (si - (to.offset ?? 0)) / to.factor;
}
