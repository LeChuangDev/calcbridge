import { useState } from 'react';
import { OutputDisplay } from '@/components/OutputDisplay';
import { fmtNum } from '@/lib/bridge';
import { useDraft, useDraftData } from '@/lib/draftStore';
import { useReport } from '@/lib/reportStore';
import type { ReportSection } from '@/lib/report';

/* ── 单位定义 ─────────────────────────────────────────── */

interface ConvUnit {
  id: string;
  symbol: string;
  name: string;
  /** value_si = value * factor + offset */
  factor: number;
  offset?: number;
}

interface ConvCategory {
  id: string;
  label: string;
  units: ConvUnit[];
}

const CATEGORIES: ConvCategory[] = [
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

/* ── 换算逻辑 ─────────────────────────────────────────── */

function convertUnit(value: number, from: ConvUnit, to: ConvUnit): number {
  const si = value * from.factor + (from.offset ?? 0);
  return (si - (to.offset ?? 0)) / to.factor;
}

function UnitTable({
  category,
  from,
  value,
}: {
  category: ConvCategory;
  from: ConvUnit;
  value: number | null;
}) {
  return (
    <div className="unit-table">
      {category.units.map((u) => {
        const v = value != null ? convertUnit(value, from, u) : null;
        return (
          <div key={u.id} className={`unit-row${u.id === from.id ? ' base' : ''}`}>
            <span className="unit-sym">{u.symbol}</span>
            <span className="unit-name">{u.name}</span>
            <span className="unit-val">{v != null ? fmtNum(v) : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 单位换算面板 ─────────────────────────────────────── */

interface UnitDraft {
  catId: string;
  fromId: string;
  toId: string;
  value: string;
}

export function UnitConverterPanel({ group }: { group?: string }) {
  const draft = useDraftData<UnitDraft>('unit_converter');
  const initialCategory = CATEGORIES.find((c) => c.id === draft?.catId) ?? CATEGORIES[0]!;
  const [catId, setCatId] = useState(initialCategory.id);
  const [fromId, setFromId] = useState(() =>
    initialCategory.units.some((u) => u.id === draft?.fromId)
      ? draft!.fromId!
      : initialCategory.units[0]!.id,
  );
  const [toId, setToId] = useState(() =>
    initialCategory.units.some((u) => u.id === draft?.toId)
      ? draft!.toId!
      : (initialCategory.units[1] ?? initialCategory.units[0]!).id,
  );
  const [value, setValue] = useState(() => (typeof draft?.value === 'string' ? draft.value : '1'));

  useDraft('unit_converter', { catId, fromId, toId, value });

  const category = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]!;

  const from = category.units.find((u) => u.id === fromId) ?? category.units[0]!;
  const to = category.units.find((u) => u.id === toId) ?? category.units[1] ?? category.units[0]!;

  const num = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(num);
  const result = valid ? convertUnit(num, from, to) : null;

  const pickCategory = (id: string) => {
    const c = CATEGORIES.find((x) => x.id === id) ?? CATEGORIES[0]!;
    setCatId(c.id);
    setFromId(c.units[0]!.id);
    setToId((c.units[1] ?? c.units[0]!).id);
  };

  const swap = () => {
    setFromId(to.id);
    setToId(from.id);
  };

  const reset = () => {
    setCatId('length');
    setFromId('m');
    setToId('mm');
    setValue('1');
  };

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '换算类别', value: category.label },
        { label: '源单位', value: `${from.name}（${from.symbol}）` },
        { label: '目标单位', value: `${to.name}（${to.symbol}）` },
        { label: '数值', value: `${value || '—'} ${from.symbol}` },
      ],
    },
    ...(result != null
      ? [
          {
            title: '计算结果',
            rows: [
              { label: '换算结果', value: `${fmtNum(result)} ${to.symbol}` },
              {
                label: '单位比例',
                value: `1 ${from.symbol} = ${fmtNum(convertUnit(1, from, to))} ${to.symbol}`,
              },
            ],
          },
          {
            title: '同类单位对照',
            rows: category.units.map((unit) => ({
              label: `${unit.name}（${unit.symbol}）`,
              value: valid ? fmtNum(convertUnit(num, from, unit)) : '—',
            })),
          },
        ]
      : [{ title: '校验', rows: [{ label: '错误', value: '输入数值无效' }] }]),
  ];

  useReport({
    id: 'unit_converter',
    title: '单位换算',
    subtitle: `${category.label} · ${from.symbol} → ${to.symbol}`,
    sections: reportSections,
    assumptions: ['十进制精确换算；温度按 °C / °F / K 偏移换算。'],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '实用工具'}</span>
          <h2>单位换算</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>
      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result != null ? [{ label: '换算结果', value: fmtNum(result), unit: to.symbol }] : []
            }
            badge={result != null ? <em className="badge ok">实时换算</em> : undefined}
            meta={
              result != null ? (
                <>
                  1 {from.symbol} = {fmtNum(convertUnit(1, from, to))} {to.symbol} ·{' '}
                  {category.label}
                </>
              ) : (
                '输入有效数值后实时换算。'
              )
            }
            figure={<UnitTable category={category} from={from} value={valid ? num : null} />}
            caption="同类单位对照，按当前数值换算。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">CATEGORY · 换算类别</div>
              <select
                className="inp"
                value={category.id}
                onChange={(e) => pickCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="card">
              <div className="card-title">FROM · 源单位</div>
              <select className="inp" value={from.id} onChange={(e) => setFromId(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.symbol}）
                  </option>
                ))}
              </select>
            </div>
            <div className="card">
              <div className="card-title">TO · 目标单位</div>
              <select className="inp" value={to.id} onChange={(e) => setToId(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.symbol}）
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入数值</span>
              <button className="btn" onClick={swap}>
                ⇄ 交换单位
              </button>
            </div>
            <div className="uc-input">
              <label htmlFor="uc-value">数值</label>
              <div className="field-row">
                <input
                  id="uc-value"
                  value={value}
                  inputMode="decimal"
                  placeholder="1"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setValue(e.target.value)}
                />
                <span className="uc-unit">{from.symbol}</span>
              </div>
            </div>
          </section>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">十进制精确换算；温度按 °C / °F / K 偏移换算。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
