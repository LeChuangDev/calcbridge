import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import { type EngineeringLimit } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { mergeStringDraft, useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import { solveLedResistor, type LedSeriesId } from '@calcbridge/calculators/led_resistor';

interface Form {
  vin: string;
  vf: string;
  current: string;
  count: string;
  series: LedSeriesId;
}

/** 工程建议范围：超出时提示，不阻断计算。 */
const LED_LIMITS: Record<string, EngineeringLimit> = {
  vin: { min: 1, max: 48, note: '常见 3–24 V' },
  vf: { min: 1.2, max: 5, note: '单颗 LED 常见 1.8–3.4 V' },
  current: { min: 1, max: 100, note: '小功率 LED 常见 5–20 mA' },
  count: { min: 1, max: 20, note: '串联颗数建议 1–20' },
};

const DEFAULTS: Form = {
  vin: '12',
  vf: '2.1',
  current: '20',
  count: '3',
  series: 'E24',
};

const ASSUMPTIONS = [
  'LED 按恒压降模型（Vf 固定）处理，不含 Vf 随电流/温度的漂移与批次离散。',
  '未计入电源纹波、线压降与 LED 并联均流问题；并联必须各自串电阻。',
  '标准阻值取「不小于理论值」的最近档，实际电流不大于目标值。',
  '额定功率档按 2 倍裕度推荐；高温环境或密闭外壳需进一步降额。',
];

function LedArt({ count }: { count: number }) {
  const n = Math.max(1, Math.min(5, Math.floor(count) || 1));
  const LEFT = 44;
  const RIGHT = 296;
  const TOP = 54;
  const BOT = 130;
  const R_START = 78;
  const R_END = 118;
  const LED_START = 128;
  const LED_END = 288;
  const step = (LED_END - LED_START) / n;
  const centers = Array.from({ length: n }, (_, i) => LED_START + step * (i + 0.5));

  return (
    <svg viewBox="0 0 340 170" className="figure" role="img" aria-label="LED 串联限流电路">
      {/* 左侧电源：长板为正极，电流经 R 与 LED 后回到负极 */}
      <line x1={LEFT} y1={TOP} x2={LEFT} y2="86" className="f-signal" />
      <line x1="30" y1="86" x2="58" y2="86" className="f-signal" />
      <line x1="36" y1="94" x2="52" y2="94" className="f-signal" />
      <line x1={LEFT} y1="94" x2={LEFT} y2={BOT} className="f-signal" />
      <text x="24" y="90" className="f-txt small end">
        Vin
      </text>

      {/* 顶部走线：限流电阻 + n 颗串联 LED */}
      <line x1={LEFT} y1={TOP} x2={R_START} y2={TOP} className="f-signal" />
      <rect x={R_START} y={TOP - 8} width={R_END - R_START} height="16" rx="2" className="f-res" />
      <text x={(R_START + R_END) / 2} y="34" className="f-txt small mid">
        R
      </text>
      <line x1={R_END} y1={TOP} x2={centers[0] - 7} y2={TOP} className="f-signal" />

      {centers.map((cx, i) => (
        <g key={i}>
          <polygon
            points={`${cx - 7},${TOP - 8} ${cx - 7},${TOP + 8} ${cx + 7},${TOP}`}
            className="f-copper"
          />
          <line x1={cx + 7} y1={TOP - 9} x2={cx + 7} y2={TOP + 9} className="f-signal" />
          {/* 发光箭头 */}
          <g className="f-signal" opacity="0.55">
            <line x1={cx - 4} y1={TOP - 13} x2={cx + 2} y2={TOP - 19} />
            <line x1={cx + 2} y1={TOP - 11} x2={cx + 8} y2={TOP - 17} />
          </g>
          {i < n - 1 && (
            <line x1={cx + 7} y1={TOP} x2={centers[i + 1] - 7} y2={TOP} className="f-signal" />
          )}
        </g>
      ))}
      <line x1={centers[n - 1] + 7} y1={TOP} x2={RIGHT} y2={TOP} className="f-signal" />

      {/* 右侧下行与底部回流，形成完整回路 */}
      <line x1={RIGHT} y1={TOP} x2={RIGHT} y2={BOT} className="f-signal" />
      <line x1={RIGHT} y1={BOT} x2={LEFT} y2={BOT} className="f-signal" />

      {/* 回路电流方向 */}
      <line x1="246" y1="118" x2="206" y2="118" className="f-signal" opacity="0.7" />
      <path d="M214 113 L206 118 L214 123" className="f-signal" opacity="0.7" />
      <text x="255" y="122" className="f-txt small">
        If
      </text>

      <text x="170" y="158" className="f-txt small mid">
        {n} 颗串联 · 限流电阻位于电源侧
      </text>
    </svg>
  );
}

export function LedResistorPanel({ group }: { group?: string }) {
  const draft = useDraftData<Partial<Form>>('led_resistor');
  const [form, setForm] = useState<Form>(() => {
    const merged = mergeStringDraft(DEFAULTS, draft);
    return {
      ...merged,
      series: merged.series === 'E12' || merged.series === 'E24' ? merged.series : 'E24',
    };
  });

  useDraft('led_resistor', form);

  const set = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const { result, error } = solveLedResistor({
    vin: Number(form.vin),
    vf: Number(form.vf),
    ifMa: Number(form.current),
    count: Number(form.count),
    series: form.series,
  });

  const reset = () => setForm(DEFAULTS);

  const rows = result
    ? [
        { label: '电阻压降', note: 'Vin − n·Vf', value: `${fmtNum(result.headroomV)} V` },
        { label: '理论阻值', note: '压降 / If', value: `${fmtNum(result.requiredOhm)} Ω` },
        ...(result.choice
          ? [
              {
                label: `${form.series} 标准值`,
                note: '不小于理论值',
                value: `${fmtNum(result.choice.value)} Ω`,
              },
              {
                label: '实际电流',
                note: '采用标准值后',
                value: `${fmtNum(result.choice.currentMa)} mA`,
              },
              { label: '电流偏差', note: '相对目标', value: `${fmtNum(result.choice.errorPct)} %` },
              { label: '电阻功耗', note: '压降² / R', value: `${fmtNum(result.choice.powerW)} W` },
              {
                label: '建议额定功率',
                note: '2 倍裕度',
                value: `${result.choice.suggestedRatingW} W`,
              },
            ]
          : []),
        { label: 'LED 串功耗', note: 'n·Vf·If', value: `${fmtNum(result.ledPowerW)} W` },
        { label: '总功耗', note: '电阻 + LED', value: `${fmtNum(result.totalPowerW)} W` },
      ]
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '供电电压 Vin', value: `${form.vin} V` },
        { label: '正向压降 Vf', value: `${form.vf} V` },
        { label: '目标电流 If', value: `${form.current} mA` },
        { label: '串联颗数', value: form.count },
        { label: '标准值系列', value: form.series },
      ],
    },
  ];
  if (result) reportSections.push({ title: '计算结果', rows });

  useReport({
    id: 'led_resistor',
    title: 'LED 限流电阻',
    subtitle: `${form.vin} V · ${form.count} 颗 · ${form.current} mA`,
    sections: reportSections,
    assumptions: ASSUMPTIONS,
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          {group && <span className="ch-kicker">{group}</span>}
          <h2>LED 限流电阻</h2>
        </div>
        <span className="calc-ver">EST · 估算</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result?.choice
                ? [
                    { label: '标准阻值', value: fmtNum(result.choice.value), unit: 'Ω' },
                    { label: '实际电流', value: fmtNum(result.choice.currentMa), unit: 'mA' },
                  ]
                : []
            }
            badge={result?.choice ? <em className="badge ok">已选型</em> : undefined}
            meta={
              result?.choice
                ? `${form.series} · 功耗 ${fmtNum(result.choice.powerW)} W · 建议 ${result.choice.suggestedRatingW} W 档`
                : (error ?? '填写供电电压与正向压降后自动计算。')
            }
            figure={<LedArt count={Number(form.count) || 1} />}
            caption="R = (Vin − n·Vf) / If；标准值取不小于理论值的最近档。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODEL · 计算模型</div>
              <code className="card-formula">R = (Vin − n · Vf) / If</code>
              <p className="card-note">恒压降模型；标准值取不小于理论值的最近档，避免过流。</p>
            </div>
            <div className="card">
              <div className="card-title">SERIES · 标准值系列</div>
              <select
                className="inp"
                value={form.series}
                onChange={(e) => set('series', e.target.value as LedSeriesId)}
              >
                <option value="E24">E24（±5% 常用）</option>
                <option value="E12">E12（±10% 常用）</option>
              </select>
              <p className="card-note">用于给出可直接采购的阻值档位。</p>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入（输入即算）</span>
              <span className="section-note">单位：V / mA</span>
            </div>
            <div className="grid grid-2">
              {(
                [
                  ['vin', '供电电压 Vin', 'V'],
                  ['vf', '正向压降 Vf', 'V'],
                  ['current', '目标电流 If', 'mA'],
                  ['count', '串联颗数 n', '颗'],
                ] as const
              ).map(([key, label, unit]) => {
                const limits: EngineeringLimit | undefined = LED_LIMITS[key];
                return (
                  <div className="field" key={key}>
                    <label htmlFor={`led-${key}`}>{label}</label>
                    <div className="field-row">
                      <input
                        id={`led-${key}`}
                        value={form[key]}
                        inputMode="decimal"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set(key, e.target.value)}
                      />
                      <span className="uc-unit">{unit}</span>
                    </div>
                    <FieldWarn value={form[key]} spec={{ id: key, unit, label, limits }} />
                  </div>
                );
              })}
            </div>
          </section>

          {error && <div className="error">{error}</div>}

          {result && (
            <section className="card">
              <div className="card-title">RESULT · 详细结果</div>
              <div className="outputs">
                {rows.map((r) => (
                  <div className="output-row" key={r.label + r.note}>
                    <span className="oid">{r.label}</span>
                    <span className="ovalue">{r.value}</span>
                    <span className="src">{r.note}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">输入即算，结果实时更新。并联 LED 请各自串电阻。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>

          <details className="assumptions">
            <summary>假设清单（{ASSUMPTIONS.length}）— 必须展示，可折叠</summary>
            <ul>
              {ASSUMPTIONS.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
