import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import type { VariableSpec } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import {
  designRf,
  rfResponse,
  type RfType,
  type RfValues,
} from '@/features/calculator-rf-attenuator/model/rfSolver';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';

const ROLES: Record<RfType, [string, string, string]> = {
  pi: ['输入并联', '串联', '输出并联'],
  t: ['输入串联', '并联', '输出串联'],
};

function RfArt({ type, values }: { type: RfType; values: RfValues }) {
  const box = (x: number, y: number, w: number, h: number) => (
    <rect x={x} y={y} width={w} height={h} className="f-box" />
  );
  const ground = (x: number, y: number) => (
    <>
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} className="f-signal" />
      <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} className="f-signal" />
      <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} className="f-signal" />
    </>
  );

  if (type === 'pi') {
    return (
      <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="Pi 衰减器网络">
        <text x="16" y="46" className="f-txt">
          IN
        </text>
        <line x1="16" y1="56" x2="60" y2="56" className="f-signal" />
        <line x1="60" y1="56" x2="100" y2="56" className="f-signal" />
        {box(100, 50, 70, 12)}
        <line x1="170" y1="56" x2="210" y2="56" className="f-signal" />
        <line x1="210" y1="56" x2="280" y2="56" className="f-signal" />
        <text x="294" y="52" className="f-txt" textAnchor="end">
          OUT
        </text>
        <line x1="60" y1="56" x2="60" y2="74" className="f-signal" />
        {box(54, 74, 12, 32)}
        {ground(60, 106)}
        <text x="76" y="92" className="f-txt mono">
          R1
        </text>
        <text x="76" y="104" className="f-txt mono small">
          {fmtNum(values.r1)} Ω
        </text>
        <text x="126" y="42" className="f-txt mono">
          R2
        </text>
        <text x="126" y="74" className="f-txt mono small">
          {fmtNum(values.r2)} Ω
        </text>
        <line x1="210" y1="56" x2="210" y2="74" className="f-signal" />
        {box(204, 74, 12, 32)}
        {ground(210, 106)}
        <text x="226" y="92" className="f-txt mono">
          R3
        </text>
        <text x="226" y="104" className="f-txt mono small">
          {fmtNum(values.r3)} Ω
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="T 衰减器网络">
      <text x="10" y="46" className="f-txt">
        IN
      </text>
      <line x1="10" y1="56" x2="60" y2="56" className="f-signal" />
      {box(60, 50, 55, 12)}
      <line x1="115" y1="56" x2="150" y2="56" className="f-signal" />
      <line x1="150" y1="56" x2="150" y2="74" className="f-signal" />
      {box(144, 74, 12, 32)}
      {ground(150, 106)}
      <line x1="150" y1="56" x2="200" y2="56" className="f-signal" />
      {box(200, 50, 55, 12)}
      <line x1="255" y1="56" x2="290" y2="56" className="f-signal" />
      <text x="300" y="52" className="f-txt" textAnchor="end">
        OUT
      </text>
      <text x="88" y="42" className="f-txt mono">
        R1
      </text>
      <text x="88" y="74" className="f-txt mono small">
        {fmtNum(values.r1)} Ω
      </text>
      <text x="166" y="92" className="f-txt mono">
        R2
      </text>
      <text x="166" y="104" className="f-txt mono small">
        {fmtNum(values.r2)} Ω
      </text>
      <text x="228" y="42" className="f-txt mono">
        R3
      </text>
      <text x="228" y="74" className="f-txt mono small">
        {fmtNum(values.r3)} Ω
      </text>
    </svg>
  );
}

interface RfDraft {
  type: RfType;
  db: string;
  zin: string;
  zout: string;
}

/** 工程建议范围：超出时提示，不阻断计算。 */
const RF_LIMITS = {
  db: {
    id: 'db',
    unit: 'dB',
    label: '衰减量',
    limits: { min: 0.1, max: 60, note: '常用 1–30 dB' },
  },
  zin: {
    id: 'zin',
    unit: 'Ω',
    label: '输入阻抗 Zin',
    limits: { min: 10, max: 200, note: '射频常用 50 Ω' },
  },
  zout: {
    id: 'zout',
    unit: 'Ω',
    label: '输出阻抗 Zout',
    limits: { min: 10, max: 200, note: '射频常用 50 Ω' },
  },
} satisfies Record<string, VariableSpec>;

export function RfAttenuatorPanel({ group }: { group?: string }) {
  const draft = useDraftData<RfDraft>('rf_attenuator');
  const [type, setType] = useState<RfType>(() => (draft?.type === 't' ? 't' : 'pi'));
  const [db, setDb] = useState(() => (typeof draft?.db === 'string' ? draft.db : '6'));
  const [zin, setZin] = useState(() => (typeof draft?.zin === 'string' ? draft.zin : '50'));
  const [zout, setZout] = useState(() => (typeof draft?.zout === 'string' ? draft.zout : '50'));

  useDraft('rf_attenuator', { type, db, zin, zout });

  const a = Number(db);
  const z1 = Number(zin);
  const z2 = Number(zout);
  const design = designRf(type, a, z1, z2);
  const values = design.values;
  const error = design.error;
  const roles = ROLES[type];
  const actual = values ? rfResponse(type, values, z1, z2) : null;

  const reset = () => {
    setType('pi');
    setDb('6');
    setZin('50');
    setZout('50');
  };

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '网络类型', value: type === 'pi' ? 'Pi 型' : 'T 型' },
        { label: '设计衰减', value: `${db} dB` },
        { label: '输入阻抗 Zin', value: `${zin} Ω` },
        { label: '输出阻抗 Zout', value: `${zout} Ω` },
      ],
    },
  ];
  if (values) {
    reportSections.push({
      title: '计算结果',
      rows: [
        ...(['r1', 'r2', 'r3'] as const).map((key, index) => ({
          label: `R${index + 1} · ${roles[index]}`,
          value: `${fmtNum(values[key])} Ω`,
        })),
        ...(actual
          ? [
              { label: '实际输入阻抗', value: `${fmtNum(actual.zin)} Ω` },
              { label: '实际输出阻抗', value: `${fmtNum(actual.zout)} Ω` },
              { label: '实际衰减', value: `${fmtNum(actual.attenuationDb)} dB` },
            ]
          : []),
      ],
    });
  }
  if (error) reportSections.push({ title: '校验', rows: [{ label: '错误', value: error }] });

  useReport({
    id: 'rf_attenuator',
    title: '射频衰减器',
    subtitle: type === 'pi' ? 'Pi 网络' : 'T 网络',
    sections: reportSections,
    assumptions: [
      '按标准无源匹配方程计算；T 网络由 Pi 网络 Y-Δ 变换得到。',
      '仅覆盖可实现的 Pi / T 无源网络，不含寄生与频率响应。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? 'PCB 与高速'}</span>
          <h2>射频衰减器</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={values ? [{ label: '设计衰减', value: fmtNum(a), unit: 'dB' }] : []}
            badge={<em className="badge">{type === 'pi' ? 'Pi 网络' : 'T 网络'}</em>}
            meta={
              values ? (
                <>
                  Zin {fmtNum(z1)} Ω · Zout {fmtNum(z2)} Ω
                </>
              ) : (
                '输入衰减量与两端阻抗。'
              )
            }
            figure={
              values ? (
                <RfArt type={type} values={values} />
              ) : (
                <div className="figure-empty">无法实现</div>
              )
            }
            caption="按标准无源匹配方程计算；T 网络由 Pi 网络 Y-Δ 变换得到。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">TYPE · 网络类型</div>
              <select
                className="inp"
                value={type}
                onChange={(e) => setType(e.target.value as RfType)}
              >
                <option value="pi">Pi 型</option>
                <option value="t">T 型</option>
              </select>
              <p className="card-note">Pi：输入/输出并联；T：输入/输出串联。</p>
            </div>

            <div className="card">
              <div className="card-title">MATCH · 阻抗条件</div>
              <div className="scope-value">
                {fmtNum(z1)}
                <span>/ {fmtNum(z2)} Ω</span>
              </div>
              <div className="scope-status">
                <i />
                {z1 === z2 ? '等阻抗匹配' : '不等阻抗匹配'}
              </div>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 衰减</div>
              <div className="scope-value">
                {fmtNum(a)}
                <span>dB</span>
              </div>
              <div className="scope-status">
                <i />
                {values ? '可实现的电阻网络' : '无正阻解'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 设计参数</span>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="rf-db">衰减量</label>
                <div className="field-row">
                  <input
                    id="rf-db"
                    value={db}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDb(e.target.value)}
                  />
                  <span className="uc-unit">dB</span>
                </div>
                <FieldWarn value={db} spec={RF_LIMITS.db} />
              </div>
              <div className="field">
                <label htmlFor="rf-zin">输入阻抗 Zin</label>
                <div className="field-row">
                  <input
                    id="rf-zin"
                    value={zin}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setZin(e.target.value)}
                  />
                  <span className="uc-unit">Ω</span>
                </div>
                <FieldWarn value={zin} spec={RF_LIMITS.zin} />
              </div>
              <div className="field">
                <label htmlFor="rf-zout">输出阻抗 Zout</label>
                <div className="field-row">
                  <input
                    id="rf-zout"
                    value={zout}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setZout(e.target.value)}
                  />
                  <span className="uc-unit">Ω</span>
                </div>
                <FieldWarn value={zout} spec={RF_LIMITS.zout} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 电阻值</span>
              <span className="section-note">单位 Ω</span>
            </div>
            <div className="panel rf-panel">
              {(['r1', 'r2', 'r3'] as const).map((key, i) => (
                <div className="rf-row" key={key}>
                  <span className="rf-label">
                    <b>{key.toUpperCase()}</b>
                    <span>{roles[i]}</span>
                  </span>
                  <span className="rf-role">
                    {type === 'pi'
                      ? i === 1
                        ? '串联电阻'
                        : '并联到地'
                      : i === 1
                        ? '并联到地'
                        : '串联电阻'}
                  </span>
                  <span className="rf-value">{values ? `${fmtNum(values[key])} Ω` : '—'}</span>
                </div>
              ))}
            </div>
          </section>

          {actual && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 网络校验</span>
                <span className="section-note">由电阻值反算</span>
              </div>
              <div className="panel rf-panel">
                <div className="rf-row">
                  <span className="rf-label">
                    <b>实际输入阻抗</b>
                    <span>源端接 {fmtNum(z1)} Ω</span>
                  </span>
                  <span className="rf-role">Zin</span>
                  <span className="rf-value">{fmtNum(actual.zin)} Ω</span>
                </div>
                <div className="rf-row">
                  <span className="rf-label">
                    <b>实际输出阻抗</b>
                    <span>负载端接 {fmtNum(z2)} Ω</span>
                  </span>
                  <span className="rf-role">Zout</span>
                  <span className="rf-value">{fmtNum(actual.zout)} Ω</span>
                </div>
                <div className="rf-row">
                  <span className="rf-label">
                    <b>实际衰减</b>
                    <span>含端接条件</span>
                  </span>
                  <span className="rf-role">A</span>
                  <span className="rf-value">{fmtNum(actual.attenuationDb)} dB</span>
                </div>
              </div>
            </section>
          )}

          <details className="ref-block">
            <summary>设计公式与说明</summary>
            <p className="action-note">
              K = 10^(A/20)，gS = 1/Zin，gL = 1/Zout。Pi 网络：G2 = 2·gS·gL / (K·gS - gL/K)，G1 = gS
              - G2 + G2/K，G3 = (K-1)·G2 - gL。T 网络由 Pi 网络经 Y-Δ
              变换得到，二者对相同端接条件等效。仅支持可实现的 Pi / T
              无源网络；威尔金森型属于功分器，不作为衰减器计算。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">标准无源匹配方程；不等阻抗同样适用。</p>
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
