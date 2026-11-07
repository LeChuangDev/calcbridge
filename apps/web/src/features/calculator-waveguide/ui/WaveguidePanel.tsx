import { useLayoutEffect, useRef, useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import type { VariableSpec } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { solveWaveguide } from '@/features/calculator-waveguide/model/waveguideSolver';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  convertLengthString,
  formatLength,
  formatLengthValue,
  lengthUnit,
  toMillimetres,
  type UnitSystem,
} from '@/shared/lib/unitSystem';

function WaveguideArt() {
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="矩形波导截面">
      <rect x="60" y="32" width="180" height="86" className="f-box" />
      <line x1="150" y1="112" x2="150" y2="44" className="f-signal" />
      <path d="M150 44 l-5 8 h10 z" fill="var(--accent)" />
      <text x="150" y="28" className="f-txt mono small" textAnchor="middle">
        E
      </text>
      <line x1="60" y1="132" x2="240" y2="132" className="f-dim" />
      <text x="150" y="144" className="f-txt mono small" textAnchor="middle">
        a
      </text>
      <text x="150" y="80" className="f-txt mono small" textAnchor="middle">
        TE10
      </text>
    </svg>
  );
}

interface WaveguideDraft {
  a: string;
  freq: string;
  unitSystem?: UnitSystem;
}

/** 工程建议范围：长度按 mm 判断，避免 mm/mil 切换误报。 */
const WG_LIMITS = {
  a: {
    id: 'a',
    unit: 'mm',
    label: '宽边 a',
    limits: { min: 5, max: 500, note: '常见标准波导 22.86–122 mm' },
  },
  freq: {
    id: 'freq',
    unit: 'GHz',
    label: '工作频率',
    limits: { min: 0.1, max: 100, note: '常见 1–40 GHz' },
  },
} satisfies Record<string, VariableSpec>;

export function WaveguidePanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<WaveguideDraft>('waveguide');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const [a, setA] = useState(() => {
    const saved = typeof draft?.a === 'string' ? draft.a : '22.86';
    return savedSystem === system ? saved : convertLengthString(saved, savedSystem, system);
  });
  const [freq, setFreq] = useState(() => (typeof draft?.freq === 'string' ? draft.freq : '10'));
  const previousSystem = useRef(system);

  useDraft('waveguide', { a, freq, unitSystem: system });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setA((value) => convertLengthString(value, previous, system));
    previousSystem.current = system;
  }, [system]);

  const { result, error } = solveWaveguide({
    aMm: toMillimetres(Number(a), lengthUnit(system)),
    freqGHz: Number(freq),
  });

  const reset = () => {
    setA(convertLengthString('22.86', 'metric', system));
    setFreq('10');
  };

  const ratio = result ? Number(freq) / result.fcGHz : null;
  const rows = result
    ? [
        { label: '截止频率 fc', note: 'c / (2a)', value: `${fmtNum(result.fcGHz)} GHz` },
        { label: '截止波长 λc', note: '2a', value: formatLength(result.lambdaCMm, system) },
        { label: '自由空间波长 λ0', note: 'c / f', value: formatLength(result.lambda0Mm, system) },
        {
          label: '导波波长 λg',
          note: 'λ0 / √(1-(fc/f)²)',
          value: formatLength(result.lambdaGMm, system),
        },
        { label: '相速 vp', note: 'c / √(...)', value: `${fmtNum(result.vpOverC)} × c` },
        { label: '群速 vg', note: 'c · √(...)', value: `${fmtNum(result.vgOverC)} × c` },
        { label: 'TE 波阻抗', note: 'η0 / √(...)', value: `${fmtNum(result.zteOhm)} Ω` },
        { label: 'TE20 截止', note: 'c / a', value: `${fmtNum(result.te20GHz)} GHz` },
        { label: '模式判定', note: 'TE10', value: result.singleMode ? '单模' : '多模' },
      ]
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '宽边 a', value: `${a} ${lengthUnit(system)}` },
        { label: '工作频率', value: `${freq} GHz` },
      ],
    },
  ];
  if (result) reportSections.push({ title: '计算结果', rows });
  if (error) reportSections.push({ title: '校验', rows: [{ label: '错误', value: error }] });

  useReport({
    id: 'waveguide',
    title: '矩形波导',
    subtitle: '空气填充、理想导体壁、TE10',
    sections: reportSections,
    assumptions: [
      '仅适用于空气填充、理想导体壁的矩形波导 TE10 模。',
      'f < c/a 时单模；实际设计还需考虑壁厚、法兰、功率容量与加工公差。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '高速与射频'}</span>
          <h2>矩形波导</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result
                ? [
                    {
                      label: '导波波长',
                      value: formatLengthValue(result.lambdaGMm, system),
                      unit: lengthUnit(system),
                    },
                  ]
                : []
            }
            badge={<em className="badge">TE10</em>}
            meta={
              result ? (
                <>
                  a {formatLength(toMillimetres(Number(a), lengthUnit(system)), system)} · f{' '}
                  {fmtNum(Number(freq))} GHz
                </>
              ) : (
                '输入宽边与频率。'
              )
            }
            figure={<WaveguideArt />}
            caption="空气填充、理想导体壁；仅 TE10 单模公式。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODE · 传播模式</div>
              <code className="card-formula">TE10</code>
              <p className="card-note">空气填充矩形波导；宽边 a 决定截止频率。</p>
            </div>

            <div className="card">
              <div className="card-title">SCOPE · 单模条件</div>
              <div className="scope-value">
                {result && ratio ? fmtNum(ratio) : '—'}
                <span>× fc</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? (result.singleMode ? '单模传输' : '已出现多模') : '待输入'}
              </div>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 导波波长</div>
              <div className="scope-value">
                {result ? formatLengthValue(result.lambdaGMm, system) : '—'}
                <span>{lengthUnit(system)}</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? `λ0 ${formatLength(result.lambda0Mm, system)}` : '待输入'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 波导参数</span>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="wg-a">宽边 a</label>
                <div className="field-row">
                  <input
                    id="wg-a"
                    value={a}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setA(e.target.value)}
                  />
                  <span className="uc-unit">{lengthUnit(system)}</span>
                </div>
                <FieldWarn
                  value={toMillimetres(Number(a), lengthUnit(system))}
                  spec={WG_LIMITS.a}
                />
              </div>
              <div className="field">
                <label htmlFor="wg-f">工作频率</label>
                <div className="field-row">
                  <input
                    id="wg-f"
                    value={freq}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setFreq(e.target.value)}
                  />
                  <span className="uc-unit">GHz</span>
                </div>
                <FieldWarn value={freq} spec={WG_LIMITS.freq} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            {result && !result.singleMode && (
              <p className="action-note">
                已高于 TE20 截止频率 {fmtNum(result.te20GHz)} GHz，存在多模；结果仅作 TE10
                分量参考。
              </p>
            )}
          </section>

          {result && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 计算结果</span>
                <span className="section-note">空气填充</span>
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
            <summary>公式与适用条件</summary>
            <p className="action-note">
              fc = c/(2a)，λg = λ0/√(1-(fc/f)²)，vp = c/√(...)，vg = c·√(...)，ZTE =
              η0/√(...)。仅适用于空气填充、理想导体壁的矩形波导 TE10 模；f &lt; c/a
              时单模。实际设计还需考虑壁厚、法兰、功率容量与加工公差。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">TE10 · 空气填充 · 理想导体壁。</p>
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
