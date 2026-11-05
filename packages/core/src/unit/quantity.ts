/**
 * Quantity：带单位的数值（FR-A1 量纲安全输入的核心载体）。
 * 任意输入都必须携带单位；混用不一致单位在运算时直接抛错，绝不静默换算。
 */
import {
  type DimVec,
  type UnitDef,
  convert,
  dimEq,
  dimToString,
  getUnit,
  normalizeUnitToken,
} from './dimensions';

const NUM_RE = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([^\s]*)\s*$/;

export class Quantity {
  readonly value: number;
  readonly unit: UnitDef;

  constructor(value: number, unit: string | UnitDef) {
    this.value = value;
    this.unit = typeof unit === 'string' ? requireUnit(unit) : unit;
  }

  get dims(): DimVec {
    return this.unit.dims;
  }

  /** 换算到其他单位（量纲不一致抛错） */
  to(unit: string | UnitDef): Quantity {
    const target = typeof unit === 'string' ? requireUnit(unit) : unit;
    return new Quantity(convert(this.value, this.unit, target), target);
  }

  /** 转成 SI 基准值 */
  siValue(): number {
    return this.value * this.unit.factor + (this.unit.offset ?? 0);
  }

  private op(b: Quantity, fn: (a: number, b: number) => number): Quantity {
    if (!dimEq(this.dims, b.dims)) {
      throw new Error(
        `量纲不匹配：${this} 与 ${b} 的运算非法（${dimToString(this.dims)} vs ${dimToString(b.dims)}）`,
      );
    }
    return new Quantity(fn(this.value, b.value), {
      ...this.unit,
      offset: 0,
    });
  }

  add(b: Quantity): Quantity {
    return this.op(b, (a, c) => a + c);
  }

  sub(b: Quantity): Quantity {
    return this.op(b, (a, c) => a - c);
  }

  mul(b: Quantity): Quantity {
    return new Quantity(this.siValue() * b.siValue(), {
      id: '*',
      symbol: '*',
      aliases: [],
      dims: dimMul(this.dims, b.dims),
      factor: 1,
    });
  }

  div(b: Quantity): Quantity {
    if (Math.abs(b.siValue()) < 1e-300) throw new Error('除数为零');
    return new Quantity(this.siValue() / b.siValue(), {
      id: '/',
      symbol: '/',
      aliases: [],
      dims: dimSub(this.dims, b.dims),
      factor: 1,
    });
  }

  isCompatibleWith(b: Quantity): boolean {
    return dimEq(this.dims, b.dims);
  }

  toString(): string {
    return `${fmtNum(this.value)} ${this.unit.symbol}`;
  }
}

function dimMul(a: DimVec, b: DimVec): DimVec {
  return a.map((x, i) => x + b[i]);
}

function dimSub(a: DimVec, b: DimVec): DimVec {
  return a.map((x, i) => x - b[i]);
}

export function fmtNum(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return String(v);
  return Number(v.toPrecision(digits)).toString();
}

export function requireUnit(unit: string): UnitDef {
  const u = getUnit(unit);
  if (!u) throw new Error(`未知单位：${unit}`);
  return u;
}

/**
 * 解析形如 "3 A"、"1.368 mm"、"10 °C"、"100 mΩ" 的输入。
 * 单位缺失视为无量纲（纯数），后续量纲检查仍会拦截错误用法。
 */
export function parseQuantity(input: string | number): Quantity {
  if (typeof input === 'number') return new Quantity(input, DIMLESS_UNIT);
  const m = NUM_RE.exec(input);
  if (!m) throw new Error(`无法解析为“数值+单位”：${JSON.stringify(input)}`);
  const num = Number(m[1]);
  const token = normalizeUnitToken(m[2]);
  if (token === '') return new Quantity(num, DIMLESS_UNIT);
  return new Quantity(num, token);
}

const DIMLESS_UNIT: UnitDef = {
  id: 'dimless',
  symbol: '',
  aliases: [],
  dims: [0, 0, 0, 0, 0, 0, 0],
  factor: 1,
};
