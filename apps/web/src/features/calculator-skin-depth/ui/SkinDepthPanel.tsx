import { useLayoutEffect, useRef, useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import type { VariableSpec } from '@calcbridge/core';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import { fmtNum } from '@/shared/lib/bridge';
import { mergeStringDraft, useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  convertLengthString,
  lengthUnit,
  toMillimetres,
  type UnitSystem,
} from '@/shared/lib/unitSystem';
import { solveSkinDepth } from '@/features/calculator-skin-depth/model/skinDepthSolver';

interface Form {
  freq: string;
  thickness: string;
  width: string;
  temp: string;
}

interface SkinDraft extends Partial<Form> {
  unitSystem?: UnitSystem;
}

const DEFAULTS: Form = {
  freq: '1000',
  thickness: '0.035',
  width: '0.2',
  temp: '20',
};

const ASSUMPTIONS = [
  '单端走线、参考平面完整、非磁性导体（铜 μr ≈ 1），单侧趋肤近似。',
  '不含铜箔粗糙度、邻近效应、差分耦合与阻焊影响，均为工程估算。',
  '电阻率按 20 °C 基准 1.72×10⁻⁸ Ω·m、温度系数 0.00393 /K 线性修正。',
  '实际高频损耗必须用场解算或实测 S 参数复核。',
];

function SkinArt({ ratio }: { ratio: number }) {
  const saturated = ratio > 2;
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="趋肤效应截面示意">
      <rect x="40" y="46" width="220" height="58" className="f-panel" />
      <rect x="60" y="46" width="180" height="26" className="f-copper" />
      <rect x="60" y="46" width="180" height="10" fill="var(--warn)" opacity="0.75" />
      <rect x="60" y="56" width="180" height="16" fill="var(--accent)" opacity="0.35" />
      <line x1="250" y1="46" x2="250" y2="72" className="f-dim" />
      <text x="256" y="62" className="f-txt small">
        δ
      </text>
      <line x1="270" y1="46" x2="270" y2="104" className="f-dim" />
      <text x="276" y="80" className="f-txt small">
        t
      </text>
      <text x="40" y="126" className="f-txt small">
        {saturated ? '铜厚已超过 2δ，加厚几乎不再降低交流电阻' : '电流主要集中在表层 δ 内'}
      </text>
    </svg>
  );
}

/** 工程建议范围：长度按 mm 判断，避免 mm/mil 切换误报。 */
const SKIN_LIMITS: Partial<Record<'freq' | 'thickness' | 'width' | 'temp', VariableSpec>> = {
  freq: {
    id: 'freq',
    unit: 'MHz',
    label: '频率',
    limits: { min: 0.001, max: 10000, note: '常见 1–1000 MHz' },
  },
  thickness: {
    id: 'thickness',
    unit: 'mm',
    label: '铜厚',
    limits: { min: 0.005, max: 1, note: '常见 0.017–0.105 mm（0.5–3 oz）' },
  },
  width: {
    id: 'width',
    unit: 'mm',
    label: '线宽',
    limits: { min: 0.01, max: 20, note: '常见 0.1–10 mm' },
  },
  temp: {
    id: 'temp',
    unit: '°C',
    label: '温度',
    limits: { min: -60, max: 300, note: '常见 -40–125 °C' },
  },
};

export function SkinDepthPanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<SkinDraft>('skin_depth');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const [form, setForm] = useState<Form>(() => {
    const base = mergeStringDraft(DEFAULTS, draft);
    if (savedSystem === system) return base;
    return {
      ...base,
      thickness: convertLengthString(base.thickness, savedSystem, system),
      width: convertLengthString(base.width, savedSystem, system),
    };
  });
  const previousSystem = useRef(system);

  useDraft('skin_depth', { ...form, unitSystem: system });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setForm((current) => ({
      ...current,
      thickness: convertLengthString(current.thickness, previous, system),
      width: convertLengthString(current.width, previous, system),
    }));
    previousSystem.current = system;
  }, [system]);

  const set = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const lengthSym = lengthUnit(system);
  const { result, error } = solveSkinDepth({
    freqHz: Number(form.freq) * 1e6,
    thicknessMm: toMillimetres(Number(form.thickness), lengthSym),
    widthMm: toMillimetres(Number(form.width), lengthSym),
    tempC: Number(form.temp),
  });

  const reset = () =>
    setForm({
      ...DEFAULTS,
      thickness: convertLengthString(DEFAULTS.thickness, 'metric', system),
      width: convertLengthString(DEFAULTS.width, 'metric', system),
    });

  const rows = result
    ? [
        { label: '趋肤深度 δ', note: '√(ρ / πfμ)', value: `${fmtNum(result.skinDepthUm)} µm` },
        ...(system === 'imperial'
          ? [{ label: '趋肤深度 δ', note: '英制', value: `${fmtNum(result.skinDepthMil)} mil` }]
          : []),
        {
          label: '有效导电厚度 δeff',
          note: 'δ(1 − e^(−t/δ))',
          value: `${fmtNum(result.effectiveThicknessMm * 1000)} µm`,
        },
        { label: 'Rac / Rdc', note: 't / δeff', value: `${fmtNum(result.acDcRatio)} ×` },
        {
          label: '单位长度交流电阻',
          note: 'ρ / (w·δeff)',
          value: `${fmtNum(result.acResistancePerMm * 1e3)} mΩ/mm`,
        },
        {
          label: '单位长度直流电阻',
          note: 'ρ / (w·t)',
          value: `${fmtNum(result.dcResistancePerMm * 1e3)} mΩ/mm`,
        },
        {
          label: '临界频率',
          note: 'δ = 铜厚',
          value: `${fmtNum(result.criticalFreqHz / 1e6)} MHz`,
        },
      ]
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '频率', value: `${form.freq} MHz` },
        { label: '铜厚', value: `${form.thickness} ${lengthSym}` },
        { label: '线宽', value: `${form.width} ${lengthSym}` },
        { label: '温度', value: `${form.temp} °C` },
      ],
    },
  ];
  if (result) reportSections.push({ title: '计算结果', rows });

  useReport({
    id: 'skin_depth',
    title: '趋肤深度',
    subtitle: `${form.freq} MHz · 铜厚 ${form.thickness} ${lengthSym}`,
    sections: reportSections,
    assumptions: ASSUMPTIONS,
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          {group && <span className="ch-kicker">{group}</span>}
          <h2>趋肤深度</h2>
        </div>
        <span className="calc-ver">EST · 估算</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result
                ? [
                    { label: '趋肤深度 δ', value: fmtNum(result.skinDepthUm), unit: 'µm' },
                    { label: 'Rac / Rdc', value: fmtNum(result.acDcRatio), unit: '×' },
                  ]
                : []
            }
            badge={
              result ? (
                <em className={`badge ${result.thicknessSaturated ? 'warn' : 'ok'}`}>
                  {result.thicknessSaturated ? '铜厚已饱和' : '铜厚有效'}
                </em>
              ) : undefined
            }
            meta={
              result
                ? `δeff ${fmtNum(result.effectiveThicknessMm * 1000)} µm · 临界频率 ${fmtNum(
                    result.criticalFreqHz / 1e6,
                  )} MHz`
                : (error ?? '填写频率与铜厚后自动计算。')
            }
            figure={<SkinArt ratio={result?.acDcRatio ?? 1} />}
            caption="高频下电流集中在表层 δ 内，铜厚超过 2δ 后继续加厚收益极小。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODEL · 计算模型</div>
              <code className="card-formula">δ = √(ρ / (π · f · μ₀))</code>
              <p className="card-note">ρ 按温度线性修正；铜 μr ≈ 1，忽略磁性材料。</p>
            </div>
            <div className="card">
              <div className="card-title">OUTPUT · 输出量</div>
              <div className="scope-value">
                δ<span>趋肤深度</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? '已计算 · 输入即算' : '待输入'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入（输入即算）</span>
              <span className="section-note">单位：MHz / {lengthSym} / °C</span>
            </div>
            <div className="grid grid-2">
              {(
                [
                  ['freq', '频率', 'MHz'],
                  ['thickness', '铜厚', lengthSym],
                  ['width', '线宽', lengthSym],
                  ['temp', '温度', '°C'],
                ] as const
              ).map(([key, label, unit]) => {
                const spec = SKIN_LIMITS[key];
                const value =
                  key === 'thickness' || key === 'width'
                    ? toMillimetres(Number(form[key]), lengthSym)
                    : form[key];
                return (
                  <div className="field" key={key}>
                    <label htmlFor={`skin-${key}`}>{label}</label>
                    <div className="field-row">
                      <input
                        id={`skin-${key}`}
                        value={form[key]}
                        inputMode="decimal"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set(key, e.target.value)}
                      />
                      <span className="uc-unit">{unit}</span>
                    </div>
                    {spec && <FieldWarn value={value} spec={spec} />}
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
              <p className="action-note">输入即算，结果实时更新；高频损耗需场解算或实测复核。</p>
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
