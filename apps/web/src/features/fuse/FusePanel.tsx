import { useLayoutEffect, useRef, useState } from 'react';
import { OutputDisplay } from '@/components/OutputDisplay';
import { fmtNum } from '@/lib/bridge';
import { mergeStringDraft, useDraft, useDraftData } from '@/lib/draftStore';
import { solveFuse } from './fuseSolver';
import { useUnitSystem } from '@/providers/UnitSystemProvider';
import { useReport } from '@/lib/reportStore';
import type { ReportSection } from '@/lib/report';
import { convertLengthString, lengthUnit, toMillimetres, type UnitSystem } from '@/lib/unitSystem';

interface Form {
  ambient: string;
  melt: string;
  width: string;
  thickness: string;
  current: string;
  time: string;
}

interface FuseDraft extends Partial<Form> {
  unitSystem?: UnitSystem;
}

const DEFAULTS: Form = {
  ambient: '25',
  melt: '1084',
  width: '0.1',
  thickness: '0.035',
  current: '10',
  time: '0.01',
};

function FuseArt({ melt, current }: { melt: boolean; current: string }) {
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="走线熔断示意">
      <rect x="20" y="58" width="46" height="28" className="f-box" />
      <rect x="234" y="58" width="46" height="28" className="f-box" />
      <line x1="66" y1="72" x2="118" y2="72" className="f-signal" />
      <rect
        x="118"
        y="66"
        width="64"
        height="12"
        fill={melt ? 'var(--bad)' : 'var(--accent)'}
        opacity="0.8"
      />
      <line x1="182" y1="72" x2="234" y2="72" className="f-signal" />
      <text x="150" y="46" className="f-txt mono" textAnchor="middle">
        {current} A
      </text>
      <text x="150" y="104" className="f-txt mono small" textAnchor="middle">
        {melt ? '达到熔化能量' : '未达到熔化能量'}
      </text>
      <text x="20" y="126" className="f-txt small">
        走线（单位长度模型）
      </text>
    </svg>
  );
}

export function FusePanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<FuseDraft>('fuse');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const [form, setForm] = useState<Form>(() => {
    const base = mergeStringDraft(DEFAULTS, draft);
    if (savedSystem === system) return base;
    return {
      ...base,
      width: convertLengthString(base.width, savedSystem, system),
      thickness: convertLengthString(base.thickness, savedSystem, system),
    };
  });
  const previousSystem = useRef(system);

  useDraft('fuse', { ...form, unitSystem: system });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setForm((current) => ({
      ...current,
      width: convertLengthString(current.width, previous, system),
      thickness: convertLengthString(current.thickness, previous, system),
    }));
    previousSystem.current = system;
  }, [system]);

  const set = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const { result, error } = solveFuse({
    ambientC: Number(form.ambient),
    meltC: Number(form.melt),
    widthMm: toMillimetres(Number(form.width), lengthUnit(system)),
    thicknessMm: toMillimetres(Number(form.thickness), lengthUnit(system)),
    currentA: Number(form.current),
    timeS: Number(form.time),
  });

  const reset = () =>
    setForm({
      ...DEFAULTS,
      width: convertLengthString(DEFAULTS.width, 'metric', system),
      thickness: convertLengthString(DEFAULTS.thickness, 'metric', system),
    });

  const rows = result
    ? [
        {
          label: '单位长度电阻',
          note: 'ρ(T_avg)/(w·h)',
          value: `${fmtNum(result.resistancePerMm * 1e3)} mΩ/mm`,
        },
        {
          label: '熔化所需能量',
          note: 'm(cpΔT + Lf)',
          value: `${fmtNum(result.energyRequired * 1e3)} mJ/mm`,
        },
        {
          label: '施加能量',
          note: 'I²R·t',
          value: `${fmtNum(result.energyDelivered * 1e3)} mJ/mm`,
        },
        { label: '能量裕度', note: '施加 / 所需', value: `${fmtNum(result.margin * 100)} %` },
        {
          label: '熔断电流',
          note: `在 ${form.time} s 内`,
          value: `${fmtNum(result.fusingCurrentA)} A`,
        },
        {
          label: '预计熔断时间',
          note: '所需 / 功率',
          value: `${fmtNum(result.meltTimeS * 1e3)} ms`,
        },
        { label: '判定', note: '绝热估算', value: result.melt ? '会熔断' : '不会熔断' },
      ]
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '环境温度', value: `${form.ambient} °C` },
        { label: '铜熔点', value: `${form.melt} °C` },
        { label: '走线宽度', value: `${form.width} ${lengthUnit(system)}` },
        { label: '铜层厚度', value: `${form.thickness} ${lengthUnit(system)}` },
        { label: '电流', value: `${form.current} A` },
        { label: '熔断时间', value: `${form.time} s` },
      ],
    },
  ];
  if (result) reportSections.push({ title: '计算结果', rows });
  if (error) reportSections.push({ title: '校验', rows: [{ label: '错误', value: error }] });

  useReport({
    id: 'fuse',
    title: '熔断电流',
    subtitle: '绝热能量平衡，单位长度模型',
    sections: reportSections,
    assumptions: [
      '铜密度 8.96 g/cm³、比热 0.385 J/(g·K)、熔化潜热 205 J/g。',
      '电阻率按 0.00393 /K 取平均温度修正；不含散热、阻焊与基材热传导。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? 'PCB 与高速'}</span>
          <h2>熔断电流</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result
                ? [
                    { label: '熔断电流', value: fmtNum(result.fusingCurrentA), unit: 'A' },
                    { label: '预计熔断时间', value: fmtNum(result.meltTimeS * 1e3), unit: 'ms' },
                  ]
                : []
            }
            badge={
              result ? (
                <em className={`badge ${result.melt ? 'bad' : 'ok'}`}>
                  {result.melt ? '会熔断' : '不会熔断'}
                </em>
              ) : undefined
            }
            meta={
              result ? (
                <>
                  I {form.current} A · t {form.time} s · 能量裕度 {fmtNum(result.margin * 100)}%
                </>
              ) : (
                '输入走线与电流参数。'
              )
            }
            figure={<FuseArt melt={!!result?.melt} current={form.current} />}
            caption="绝热能量平衡；按单位长度，不含散热与阻焊影响。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODEL · 绝热能量</div>
              <code className="card-formula">E = m(cpΔT + Lf)</code>
              <p className="card-note">铜密度、比热与熔化潜热采用标准值。</p>
            </div>

            <div className="card">
              <div className="card-title">SCOPE · 单位长度</div>
              <div className="scope-value">
                1<span>mm</span>
              </div>
              <div className="scope-status">
                <i />
                长度在能量/功率中抵消
              </div>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 熔断电流</div>
              <div className="scope-value">
                {result ? fmtNum(result.fusingCurrentA) : '—'}
                <span>A</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? (result.melt ? '会熔断' : '不会熔断') : '待输入'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 走线与电流参数</span>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="fu-ambient">环境温度</label>
                <div className="field-row">
                  <input
                    id="fu-ambient"
                    value={form.ambient}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('ambient', e.target.value)}
                  />
                  <span className="uc-unit">°C</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fu-melt">铜熔点</label>
                <div className="field-row">
                  <input
                    id="fu-melt"
                    value={form.melt}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('melt', e.target.value)}
                  />
                  <span className="uc-unit">°C</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fu-width">走线宽度</label>
                <div className="field-row">
                  <input
                    id="fu-width"
                    value={form.width}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('width', e.target.value)}
                  />
                  <span className="uc-unit">{lengthUnit(system)}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fu-thickness">铜层厚度</label>
                <div className="field-row">
                  <input
                    id="fu-thickness"
                    value={form.thickness}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('thickness', e.target.value)}
                  />
                  <span className="uc-unit">{lengthUnit(system)}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fu-current">电流</label>
                <div className="field-row">
                  <input
                    id="fu-current"
                    value={form.current}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('current', e.target.value)}
                  />
                  <span className="uc-unit">A</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fu-time">熔断时间</label>
                <div className="field-row">
                  <input
                    id="fu-time"
                    value={form.time}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set('time', e.target.value)}
                  />
                  <span className="uc-unit">s</span>
                </div>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
          </section>

          {result && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 计算结果</span>
                <span className="section-note">单位长度</span>
              </div>
              <div className="panel rf-panel">
                {rows.map((r) => (
                  <div className="rf-row" key={r.label}>
                    <span className="rf-label">
                      <b>{r.label}</b>
                      <span>{r.note}</span>
                    </span>
                    <span className="rf-role" />
                    <span className="rf-value">{r.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <details className="ref-block">
            <summary>模型与假设</summary>
            <p className="action-note">
              采用绝热能量平衡：铜密度 8.96 g/cm³，比热 0.385 J/(g·K)，熔化潜热 205 J/g，电阻率
              1.72×10⁻⁸ Ω·m 并按 0.00393 /K 取平均温度修正。结果为
              工程估算，不包含散热、阻焊、铜箔与基材热传导等实际因素；安全相关设计需实测或按标准复核。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">绝热能量平衡；结果与走线长度无关。</p>
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
