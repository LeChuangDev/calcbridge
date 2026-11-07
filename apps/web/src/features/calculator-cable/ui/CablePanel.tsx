import { useLayoutEffect, useRef, useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import type { VariableSpec } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { solveCable, type CableMaterial } from '@/features/calculator-cable/model/cableSolver';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  convertLongLengthString,
  formatLongLength,
  longLengthUnit,
  toMetres,
  type UnitSystem,
} from '@/shared/lib/unitSystem';

/** 工程建议范围：超出时提示，不阻断计算。 */
const CABLE_LIMITS = {
  voltage: {
    id: 'voltage',
    unit: 'V',
    label: '系统电压',
    limits: { min: 1, max: 600, note: '常见 5–48 V' },
  },
  drop: {
    id: 'drop',
    unit: '%',
    label: '允许压降',
    limits: { min: 0.5, max: 10, note: '常用 2–5%' },
  },
  current: {
    id: 'current',
    unit: 'A',
    label: '负载电流',
    limits: { min: 0.01, max: 100, note: '常见 0.1–20 A' },
  },
} satisfies Record<string, VariableSpec>;

function CableArt({
  area,
  lengthM,
  system,
}: {
  area: number;
  lengthM: number;
  system: UnitSystem;
}) {
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="线缆截面示意">
      <circle cx="150" cy="68" r="52" fill="none" stroke="var(--border)" strokeWidth="2" />
      <circle cx="132" cy="68" r="17" fill="var(--accent)" opacity="0.55" />
      <circle cx="168" cy="68" r="17" fill="var(--accent)" opacity="0.55" />
      <text x="150" y="136" className="f-txt mono" textAnchor="middle">
        2 × {fmtNum(area)} mm² · L {formatLongLength(lengthM, system)}
      </text>
    </svg>
  );
}

interface CableDraft {
  material: CableMaterial;
  voltage: string;
  drop: string;
  current: string;
  length: string;
  unitSystem?: UnitSystem;
}

export function CablePanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<CableDraft>('cable_size');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const [material, setMaterial] = useState<CableMaterial>(() =>
    draft?.material === 'al' ? 'al' : 'cu',
  );
  const [voltage, setVoltage] = useState(() =>
    typeof draft?.voltage === 'string' ? draft.voltage : '12',
  );
  const [drop, setDrop] = useState(() => (typeof draft?.drop === 'string' ? draft.drop : '5'));
  const [current, setCurrent] = useState(() =>
    typeof draft?.current === 'string' ? draft.current : '1',
  );
  const [length, setLength] = useState(() => {
    const saved = typeof draft?.length === 'string' ? draft.length : '10';
    return savedSystem === system ? saved : convertLongLengthString(saved, savedSystem, system);
  });
  const previousSystem = useRef(system);

  useDraft('cable_size', { material, voltage, drop, current, length, unitSystem: system });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setLength((value) => convertLongLengthString(value, previous, system));
    previousSystem.current = system;
  }, [system]);

  const lengthM = toMetres(Number(length), longLengthUnit(system));
  const { result, error } = solveCable({
    voltageV: Number(voltage),
    dropPct: Number(drop),
    currentA: Number(current),
    lengthM,
    material,
  });

  const reset = () => {
    setMaterial('cu');
    setVoltage('12');
    setDrop('5');
    setCurrent('1');
    setLength(convertLongLengthString('10', 'metric', system));
  };

  const rows = result
    ? [
        { label: '所需截面', note: '2ρLI / ΔV', value: `${fmtNum(result.requiredArea)} mm²` },
        {
          label: '选定标准截面',
          note: '标准公制线径',
          value: `${fmtNum(result.selectedArea)} mm²`,
        },
        { label: '回路电阻', note: '2ρL / A', value: `${fmtNum(result.resistance)} Ω` },
        { label: '电压降', note: 'I × R', value: `${fmtNum(result.voltageDrop)} V` },
        { label: '实际压降', note: 'ΔV / V', value: `${fmtNum(result.actualDropPct)} %` },
        { label: '线损', note: 'I² × R', value: `${fmtNum(result.powerLoss)} W` },
      ]
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '导体', value: material === 'cu' ? '铜' : '铝' },
        { label: '系统电压', value: `${voltage} V` },
        { label: '允许压降', value: `${drop} %` },
        { label: '负载电流', value: `${current} A` },
        { label: '单程长度', value: `${length} ${longLengthUnit(system)}` },
      ],
    },
  ];
  if (result) reportSections.push({ title: '计算结果', rows });
  if (error) reportSections.push({ title: '校验', rows: [{ label: '错误', value: error }] });

  useReport({
    id: 'cable_size',
    title: '线缆尺寸',
    subtitle: '直流双线回路，按允许电压降选型',
    sections: reportSections,
    assumptions: [
      '按直流双线回路电压降选择标准公制截面。',
      '仅按电压降选型，不含载流量、绝缘耐压、敷设方式与环境温度修正。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '电路与电源'}</span>
          <h2>线缆尺寸</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result ? [{ label: '选定截面', value: fmtNum(result.selectedArea), unit: 'mm²' }] : []
            }
            badge={
              result ? (
                <em className={`badge ${result.actualDropPct <= Number(drop) ? 'ok' : 'warn'}`}>
                  压降 {fmtNum(result.actualDropPct)}%
                </em>
              ) : undefined
            }
            meta={
              result ? (
                <>
                  {material === 'cu' ? '铜' : '铝'} · {voltage} V · {current} A ·{' '}
                  {formatLongLength(lengthM, system)}
                </>
              ) : (
                '输入电源、电流与线长。'
              )
            }
            figure={
              result ? (
                <CableArt area={result.selectedArea} lengthM={lengthM} system={system} />
              ) : (
                <div className="figure-empty">参数无效</div>
              )
            }
            caption="双线回路、20°C 电阻率；仅按电压降选型。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MATERIAL · 导体</div>
              <select
                className="inp"
                value={material}
                onChange={(e) => setMaterial(e.target.value as CableMaterial)}
              >
                <option value="cu">铜（0.0175 Ω·mm²/m）</option>
                <option value="al">铝（0.0282 Ω·mm²/m）</option>
              </select>
              <p className="card-note">电阻率取 20°C 典型值，不含温度修正。</p>
            </div>

            <div className="card">
              <div className="card-title">METHOD · 选型方法</div>
              <code className="card-formula">A = 2ρLI / ΔV</code>
              <p className="card-note">按允许电压降选择最小标准截面。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 选定截面</div>
              <div className="scope-value">
                {result ? fmtNum(result.selectedArea) : '—'}
                <span>mm²</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? `压降 ${fmtNum(result.actualDropPct)}%` : '待输入'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 线路参数</span>
              <span className="section-note">长度按单程计，回路自动 ×2</span>
            </div>
            <div className="grid">
              <div className="field">
                <label htmlFor="cb-v">系统电压</label>
                <div className="field-row">
                  <input
                    id="cb-v"
                    value={voltage}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setVoltage(e.target.value)}
                  />
                  <span className="uc-unit">V</span>
                </div>
                <FieldWarn value={voltage} spec={CABLE_LIMITS.voltage} />
              </div>
              <div className="field">
                <label htmlFor="cb-drop">允许压降</label>
                <div className="field-row">
                  <input
                    id="cb-drop"
                    value={drop}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDrop(e.target.value)}
                  />
                  <span className="uc-unit">%</span>
                </div>
                <FieldWarn value={drop} spec={CABLE_LIMITS.drop} />
              </div>
              <div className="field">
                <label htmlFor="cb-i">负载电流</label>
                <div className="field-row">
                  <input
                    id="cb-i"
                    value={current}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                  <span className="uc-unit">A</span>
                </div>
                <FieldWarn value={current} spec={CABLE_LIMITS.current} />
              </div>
              <div className="field">
                <label htmlFor="cb-l">单程长度</label>
                <div className="field-row">
                  <input
                    id="cb-l"
                    value={length}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setLength(e.target.value)}
                  />
                  <span className="uc-unit">{longLengthUnit(system)}</span>
                </div>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            {result?.exceeded && (
              <div className="error">所需截面超过 240 mm²，请提高电压或放宽压降。</div>
            )}
          </section>

          {result && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 计算结果</span>
                <span className="section-note">直流双线回路</span>
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
            <summary>选型说明</summary>
            <p className="action-note">
              按直流双线回路电压降选择标准公制截面；所需截面 A =
              2ρLI/ΔV，选定不小于该值的标准线径。仅按电压降选型，不含载流量、绝缘耐压、敷设方式、并绕/多芯校正与环境温度修正；实际工程需同时按载流量与标准复核。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">标准公制线径：0.5 – 240 mm²。</p>
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
