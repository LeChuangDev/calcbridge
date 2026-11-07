/**
 * 单位换算目录与纯换算函数。
 *
 * 换算定义：value_si = value × factor + offset；温度类单位使用 offset。
 * 长度/面积/质量等系数取自 SI 定义或 NIST SP 811 附录 B 的精确换算值。
 */

export interface ConvUnit {
  id: string;
  symbol: string;
  name: string;
  /** value_si = value * factor + offset */
  factor: number;
  offset?: number;
}

export interface ConvCategory {
  id: string;
  label: string;
  units: ConvUnit[];
}

export const UNIT_CATEGORIES: ConvCategory[] = [
  {
    id: 'length',
    label: '长度',
    units: [
      { id: 'm', symbol: 'm', name: '米', factor: 1 },
      { id: 'mm', symbol: 'mm', name: '毫米', factor: 1e-3 },
      { id: 'cm', symbol: 'cm', name: '厘米', factor: 1e-2 },
      { id: 'um', symbol: 'µm', name: '微米', factor: 1e-6 },
      { id: 'nm', symbol: 'nm', name: '纳米', factor: 1e-9 },
      { id: 'in', symbol: 'in', name: '英寸', factor: 0.0254 },
      { id: 'mil', symbol: 'mil', name: '密耳', factor: 2.54e-5 },
      { id: 'ft', symbol: 'ft', name: '英尺', factor: 0.3048 },
    ],
  },
  {
    id: 'area',
    label: '面积',
    units: [
      { id: 'm2', symbol: 'm²', name: '平方米', factor: 1 },
      { id: 'mm2', symbol: 'mm²', name: '平方毫米', factor: 1e-6 },
      { id: 'cm2', symbol: 'cm²', name: '平方厘米', factor: 1e-4 },
      { id: 'in2', symbol: 'in²', name: '平方英寸', factor: 6.4516e-4 },
      { id: 'mil2', symbol: 'mil²', name: '平方密耳', factor: 6.4516e-10 },
      { id: 'ft2', symbol: 'ft²', name: '平方英尺', factor: 0.09290304 },
    ],
  },
  {
    id: 'volume',
    label: '体积',
    units: [
      { id: 'm3', symbol: 'm³', name: '立方米', factor: 1 },
      { id: 'L', symbol: 'L', name: '升', factor: 1e-3 },
      { id: 'mL', symbol: 'mL', name: '毫升', factor: 1e-6 },
      { id: 'cm3', symbol: 'cm³', name: '立方厘米', factor: 1e-6 },
      { id: 'in3', symbol: 'in³', name: '立方英寸', factor: 1.6387064e-5 },
      { id: 'ft3', symbol: 'ft³', name: '立方英尺', factor: 0.028316846592 },
      { id: 'gal', symbol: 'gal', name: '加仑 (US)', factor: 3.785411784e-3 },
    ],
  },
  {
    id: 'mass',
    label: '质量',
    units: [
      { id: 'kg', symbol: 'kg', name: '千克', factor: 1 },
      { id: 'g', symbol: 'g', name: '克', factor: 1e-3 },
      { id: 'mg', symbol: 'mg', name: '毫克', factor: 1e-6 },
      { id: 't', symbol: 't', name: '吨', factor: 1e3 },
      { id: 'oz', symbol: 'oz', name: '盎司', factor: 0.028349523125 },
      { id: 'lb', symbol: 'lb', name: '磅', factor: 0.45359237 },
    ],
  },
  {
    id: 'temperature',
    label: '温度',
    units: [
      { id: 'celsius', symbol: '°C', name: '摄氏度', factor: 1, offset: 273.15 },
      { id: 'fahrenheit', symbol: '°F', name: '华氏度', factor: 5 / 9, offset: 255.3722222222222 },
      { id: 'kelvin', symbol: 'K', name: '开尔文', factor: 1 },
    ],
  },
  {
    id: 'current',
    label: '电流',
    units: [
      { id: 'A', symbol: 'A', name: '安', factor: 1 },
      { id: 'mA', symbol: 'mA', name: '毫安', factor: 1e-3 },
      { id: 'uA', symbol: 'µA', name: '微安', factor: 1e-6 },
      { id: 'kA', symbol: 'kA', name: '千安', factor: 1e3 },
    ],
  },
  {
    id: 'voltage',
    label: '电压',
    units: [
      { id: 'V', symbol: 'V', name: '伏', factor: 1 },
      { id: 'mV', symbol: 'mV', name: '毫伏', factor: 1e-3 },
      { id: 'uV', symbol: 'µV', name: '微伏', factor: 1e-6 },
      { id: 'kV', symbol: 'kV', name: '千伏', factor: 1e3 },
    ],
  },
  {
    id: 'resistance',
    label: '电阻',
    units: [
      { id: 'ohm', symbol: 'Ω', name: '欧姆', factor: 1 },
      { id: 'mohm', symbol: 'mΩ', name: '毫欧', factor: 1e-3 },
      { id: 'kohm', symbol: 'kΩ', name: '千欧', factor: 1e3 },
      { id: 'Mohm', symbol: 'MΩ', name: '兆欧', factor: 1e6 },
    ],
  },
  {
    id: 'power',
    label: '功率',
    units: [
      { id: 'W', symbol: 'W', name: '瓦', factor: 1 },
      { id: 'mW', symbol: 'mW', name: '毫瓦', factor: 1e-3 },
      { id: 'kW', symbol: 'kW', name: '千瓦', factor: 1e3 },
      { id: 'MW', symbol: 'MW', name: '兆瓦', factor: 1e6 },
    ],
  },
  {
    id: 'energy',
    label: '能量',
    units: [
      { id: 'J', symbol: 'J', name: '焦耳', factor: 1 },
      { id: 'mJ', symbol: 'mJ', name: '毫焦', factor: 1e-3 },
      { id: 'kJ', symbol: 'kJ', name: '千焦', factor: 1e3 },
      { id: 'Wh', symbol: 'Wh', name: '瓦时', factor: 3600 },
      { id: 'kWh', symbol: 'kWh', name: '千瓦时', factor: 3.6e6 },
    ],
  },
  {
    id: 'capacitance',
    label: '电容',
    units: [
      { id: 'F', symbol: 'F', name: '法', factor: 1 },
      { id: 'mF', symbol: 'mF', name: '毫法', factor: 1e-3 },
      { id: 'uF', symbol: 'µF', name: '微法', factor: 1e-6 },
      { id: 'nF', symbol: 'nF', name: '纳法', factor: 1e-9 },
      { id: 'pF', symbol: 'pF', name: '皮法', factor: 1e-12 },
    ],
  },
  {
    id: 'inductance',
    label: '电感',
    units: [
      { id: 'H', symbol: 'H', name: '亨', factor: 1 },
      { id: 'mH', symbol: 'mH', name: '毫亨', factor: 1e-3 },
      { id: 'uH', symbol: 'µH', name: '微亨', factor: 1e-6 },
      { id: 'nH', symbol: 'nH', name: '纳亨', factor: 1e-9 },
    ],
  },
  {
    id: 'frequency',
    label: '频率',
    units: [
      { id: 'Hz', symbol: 'Hz', name: '赫兹', factor: 1 },
      { id: 'kHz', symbol: 'kHz', name: '千赫', factor: 1e3 },
      { id: 'MHz', symbol: 'MHz', name: '兆赫', factor: 1e6 },
      { id: 'GHz', symbol: 'GHz', name: '吉赫', factor: 1e9 },
    ],
  },
  {
    id: 'pressure',
    label: '压力',
    units: [
      { id: 'Pa', symbol: 'Pa', name: '帕', factor: 1 },
      { id: 'kPa', symbol: 'kPa', name: '千帕', factor: 1e3 },
      { id: 'MPa', symbol: 'MPa', name: '兆帕', factor: 1e6 },
      { id: 'bar', symbol: 'bar', name: '巴', factor: 1e5 },
      { id: 'mbar', symbol: 'mbar', name: '毫巴', factor: 100 },
      { id: 'psi', symbol: 'psi', name: '磅/平方英寸', factor: 6894.757293168 },
      { id: 'atm', symbol: 'atm', name: '标准大气压', factor: 101325 },
      { id: 'mmHg', symbol: 'mmHg', name: '毫米汞柱', factor: 133.322387415 },
    ],
  },
  {
    id: 'force',
    label: '力',
    units: [
      { id: 'N', symbol: 'N', name: '牛', factor: 1 },
      { id: 'kN', symbol: 'kN', name: '千牛', factor: 1e3 },
      { id: 'kgf', symbol: 'kgf', name: '千克力', factor: 9.80665 },
      { id: 'lbf', symbol: 'lbf', name: '磅力', factor: 4.4482216152605 },
    ],
  },
  {
    id: 'speed',
    label: '速度',
    units: [
      { id: 'mps', symbol: 'm/s', name: '米/秒', factor: 1 },
      { id: 'kmh', symbol: 'km/h', name: '千米/时', factor: 1 / 3.6 },
      { id: 'mph', symbol: 'mph', name: '英里/时', factor: 0.44704 },
      { id: 'fps', symbol: 'ft/s', name: '英尺/秒', factor: 0.3048 },
    ],
  },
  {
    id: 'charge',
    label: '电荷',
    units: [
      { id: 'C', symbol: 'C', name: '库仑', factor: 1 },
      { id: 'mAh', symbol: 'mAh', name: '毫安时', factor: 3.6 },
      { id: 'Ah', symbol: 'Ah', name: '安时', factor: 3600 },
    ],
  },
  {
    id: 'time',
    label: '时间',
    units: [
      { id: 's', symbol: 's', name: '秒', factor: 1 },
      { id: 'ms', symbol: 'ms', name: '毫秒', factor: 1e-3 },
      { id: 'us', symbol: 'µs', name: '微秒', factor: 1e-6 },
      { id: 'ns', symbol: 'ns', name: '纳秒', factor: 1e-9 },
      { id: 'min', symbol: 'min', name: '分钟', factor: 60 },
      { id: 'h', symbol: 'h', name: '小时', factor: 3600 },
      { id: 'day', symbol: 'd', name: '天', factor: 86400 },
    ],
  },
];

export function findCategory(categoryId: string): ConvCategory | undefined {
  return UNIT_CATEGORIES.find((category) => category.id === categoryId);
}

export function findUnit(category: ConvCategory, unitId: string): ConvUnit | undefined {
  return category.units.find((unit) => unit.id === unitId);
}

/** 按 value_si = value × factor + offset 先归一到 SI，再换算到目标单位。 */
export function convertUnit(value: number, from: ConvUnit, to: ConvUnit): number {
  const si = value * from.factor + (from.offset ?? 0);
  return (si - (to.offset ?? 0)) / to.factor;
}
