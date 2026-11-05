import { useLayoutEffect, useRef, useState } from 'react';
import { OutputDisplay } from '@/components/OutputDisplay';
import { fmtNum } from '@/lib/bridge';
import { useUnitSystem } from '@/providers/UnitSystemProvider';
import { useReport } from '@/lib/reportStore';
import type { ReportSection } from '@/lib/report';
import { mergeStringDraft, useDraft, useDraftData } from '@/lib/draftStore';
import { solveVia } from './viaSolver';
import {
  buildViaChecks,
  buildViaFigureGeometry,
  buildViaMetricGroups,
  formatAspectRatio,
} from './viaViewModel';
import {
  convertGeometryForm,
  formatViaMeasurement,
  geometryToMillimetres,
  lengthUnit,
  platingUnit,
  type ViaUnitSystem,
} from './viaUnits';
import {
  DEFAULT_CUSTOM_RULE_FIELDS,
  resolveViaRules,
  ruleLabel,
  viaRuleSummary,
  type ViaCustomRuleFields,
  type ViaRuleId,
} from './viaRules';

interface FieldDef {
  key: keyof Form;
  label: string;
  unit: string;
  /** 参与单位制切换的几何字段 */
  unitKind?: 'length' | 'plating';
}

interface Form {
  hole: string;
  plating: string;
  length: string;
  pad: string;
  z0: string;
  current: string;
  rho: string;
  er: string;
  dT: string;
  rise: string;
  freq: string;
}

const DEFAULTS: Form = {
  hole: '0.4',
  plating: '0.035',
  length: '1.6',
  pad: '0.6',
  z0: '50',
  current: '1',
  rho: '1.72e-8',
  er: '4.5',
  dT: '10',
  rise: '1',
  freq: '500',
};

const FIELDS: FieldDef[] = [
  { key: 'hole', label: '最终孔径 D', unit: 'mm', unitKind: 'length' },
  { key: 'plating', label: '镀层厚度 T', unit: 'mm', unitKind: 'plating' },
  { key: 'length', label: '过孔长度 / 板厚', unit: 'mm', unitKind: 'length' },
  { key: 'pad', label: '焊盘直径', unit: 'mm', unitKind: 'length' },
  { key: 'z0', label: '目标阻抗 Z0', unit: 'Ω' },
  { key: 'current', label: '应用电流', unit: 'A' },
  { key: 'rho', label: '镀层电阻率', unit: 'Ω·m' },
  { key: 'er', label: '相对介电常数 εr', unit: '—' },
  { key: 'dT', label: '允许温升 ΔT', unit: '°C' },
  { key: 'rise', label: '输入上升时间', unit: 'ns' },
  { key: 'freq', label: '评估频率', unit: 'MHz' },
];

function fieldUnit(field: FieldDef, system: ViaUnitSystem): string {
  if (field.unitKind === 'plating') return platingUnit(system);
  if (field.unitKind === 'length') return lengthUnit(system);
  return field.unit;
}

interface ViaDraft extends Partial<Form> {
  unitSystem?: ViaUnitSystem;
  ruleId?: ViaRuleId;
  customRules?: Partial<ViaCustomRuleFields>;
}

function loadUnitSystem(saved: unknown): ViaUnitSystem {
  return saved === 'imperial' ? 'imperial' : 'metric';
}

function loadRuleId(saved: unknown): ViaRuleId {
  return saved === 'hdi' || saved === 'custom' ? saved : 'standard';
}

function loadCustomRules(saved: Partial<ViaCustomRuleFields> | undefined): ViaCustomRuleFields {
  const pick = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
  return {
    maxAspectRatio: pick(saved?.maxAspectRatio, DEFAULT_CUSTOM_RULE_FIELDS.maxAspectRatio),
    minAnnularRingMm: pick(saved?.minAnnularRingMm, DEFAULT_CUSTOM_RULE_FIELDS.minAnnularRingMm),
    minHoleMm: pick(saved?.minHoleMm, DEFAULT_CUSTOM_RULE_FIELDS.minHoleMm),
  };
}

/**
 * 过孔工程图：左侧为 A–A 剖面（板厚、孔径、镀层、焊盘），右侧为俯视（焊盘/孔/环宽）。
 * 几何按输入比例做示意，所有尺寸标注复用全站 mono 字体与主题色。
 */
function ViaFigure({
  hole,
  pad,
  length,
  plating,
  unitSystem,
}: {
  hole: number;
  pad: number;
  length: number;
  plating: number;
  unitSystem: ViaUnitSystem;
}) {
  const {
    padRadius: padR,
    holeRadius: holeR,
    barrelLeft,
    barrelRight,
    wall,
    innerLeft,
    innerRight,
    innerWidth,
  } = buildViaFigureGeometry(hole, pad, plating);
  const cxTop = 252;
  const cyTop = 94;
  const holeText = formatViaMeasurement(hole, 'hole', unitSystem);
  const padText = formatViaMeasurement(pad, 'pad', unitSystem);
  const lengthText = formatViaMeasurement(length, 'length', unitSystem);
  const platingText = formatViaMeasurement(plating, 'plating', unitSystem);

  return (
    <svg
      viewBox="0 0 300 196"
      className="figure via-figure"
      role="img"
      aria-label="过孔 A-A 剖面与俯视示意"
    >
      <line x1="206" y1="14" x2="206" y2="182" className="via-sep" />
      <text x="28" y="20" className="f-txt small strong">
        SECTION A–A
      </text>
      <text x={cxTop} y="20" className="f-txt small mid strong">
        TOP VIEW
      </text>

      {/* 剖面：基材、上下焊盘、孔壁镀层 */}
      <rect x="36" y="38" width="136" height="112" className="via-board" />
      <rect x="28" y="34" width="152" height="6" className="via-copper" />
      <rect x="28" y="148" width="152" height="6" className="via-copper" />
      <rect x={barrelLeft} y="34" width={wall} height="120" className="via-plating" />
      <rect x={barrelRight - wall} y="34" width={wall} height="120" className="via-plating" />
      <rect x={innerLeft} y="38" width={innerWidth} height="112" className="via-hole" />

      <line x1={innerLeft} y1="28" x2={innerRight} y2="28" className="via-dim" />
      <line x1={innerLeft} y1="24" x2={innerLeft} y2="32" className="via-dim" />
      <line x1={innerRight} y1="24" x2={innerRight} y2="32" className="via-dim" />
      <text x={innerRight + 8} y="27" className="f-txt small strong">
        D {holeText}
      </text>
      <text x="64" y="104" className="f-txt small mid via-material">
        FR-4
      </text>

      <line x1="28" y1="166" x2="180" y2="166" className="via-dim" />
      <line x1="28" y1="162" x2="28" y2="170" className="via-dim" />
      <line x1="180" y1="162" x2="180" y2="170" className="via-dim" />
      <text x="104" y="180" className="f-txt small mid">
        PAD {padText}
      </text>

      <line x1="20" y1="34" x2="20" y2="154" className="via-dim" />
      <line x1="16" y1="34" x2="24" y2="34" className="via-dim" />
      <line x1="16" y1="154" x2="24" y2="154" className="via-dim" />
      <text x="14" y="94" className="f-txt small" textAnchor="middle" transform="rotate(-90 14 94)">
        L {lengthText}
      </text>

      <line x1={barrelRight} y1="68" x2="146" y2="60" className="via-lead" />
      <text x="150" y="60" className="f-txt small">
        T {platingText}
      </text>
      <text x="150" y="72" className="f-txt small">
        PLATING
      </text>

      {/* 俯视：焊盘、孔、环宽 */}
      <circle cx={cxTop} cy={cyTop} r={padR} className="via-pad-soft" />
      <circle cx={cxTop} cy={cyTop} r={padR} className="via-pad-edge" />
      <circle cx={cxTop} cy={cyTop} r={holeR} className="via-hole-edge" />
      <circle cx={cxTop} cy={cyTop} r={holeR + 2} className="via-ring" />
      <line
        x1={cxTop - padR - 6}
        y1={cyTop}
        x2={cxTop + padR + 6}
        y2={cyTop}
        className="via-center"
      />
      <line
        x1={cxTop}
        y1={cyTop - padR - 6}
        x2={cxTop}
        y2={cyTop + padR + 6}
        className="via-center"
      />

      <line x1={cxTop - holeR} y1="48" x2={cxTop + holeR} y2="48" className="via-dim" />
      <line x1={cxTop - holeR} y1="44" x2={cxTop - holeR} y2="52" className="via-dim" />
      <line x1={cxTop + holeR} y1="44" x2={cxTop + holeR} y2="52" className="via-dim" />
      <text x={cxTop} y="42" className="f-txt small mid">
        D
      </text>

      <line x1={cxTop - padR} y1="142" x2={cxTop + padR} y2="142" className="via-dim" />
      <line x1={cxTop - padR} y1="138" x2={cxTop - padR} y2="146" className="via-dim" />
      <line x1={cxTop + padR} y1="138" x2={cxTop + padR} y2="146" className="via-dim" />
      <text x={cxTop} y="156" className="f-txt small mid">
        PAD
      </text>
    </svg>
  );
}

export function ViaPanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<ViaDraft>('via');
  const savedSystem = loadUnitSystem(draft?.unitSystem);
  const [form, setForm] = useState<Form>(() => {
    const base = mergeStringDraft(DEFAULTS, draft as Partial<Form> | null);
    return savedSystem === system
      ? base
      : { ...base, ...convertGeometryForm(base, savedSystem, system) };
  });
  const [ruleId, setRuleId] = useState<ViaRuleId>(() => loadRuleId(draft?.ruleId));
  const [customRules, setCustomRules] = useState<ViaCustomRuleFields>(() =>
    loadCustomRules(draft?.customRules),
  );
  const previousSystem = useRef(system);

  useDraft('via', { ...form, unitSystem: system, ruleId, customRules });

  // 页头切换全局单位制时，保持四项几何输入的物理值不变。
  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setForm((current) => ({
      ...current,
      ...convertGeometryForm(current, previous, system),
    }));
    previousSystem.current = system;
  }, [system]);

  const set = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const setCustomRule = (key: keyof ViaCustomRuleFields, value: string) =>
    setCustomRules((prev) => ({ ...prev, [key]: value }));

  const geometry = geometryToMillimetres(form, system);
  const rules = resolveViaRules(ruleId, customRules);
  const activeRuleLabel = ruleLabel(ruleId);

  const { result, error } = solveVia({
    holeMm: geometry.holeMm,
    platingMm: geometry.platingMm,
    lengthMm: geometry.lengthMm,
    padMm: geometry.padMm,
    z0: Number(form.z0),
    currentA: Number(form.current),
    rho: Number(form.rho),
    er: Number(form.er),
    dT: Number(form.dT),
    riseNs: Number(form.rise),
    freqMHz: Number(form.freq),
  });

  const reset = () => {
    setForm(
      system === 'metric'
        ? DEFAULTS
        : { ...DEFAULTS, ...convertGeometryForm(DEFAULTS, 'metric', system) },
    );
    setRuleId('standard');
    setCustomRules(DEFAULT_CUSTOM_RULE_FIELDS);
  };

  const checks = result
    ? buildViaChecks(result, { holeMm: geometry.holeMm, rules, unitSystem: system })
    : [];
  const metricGroups = result
    ? buildViaMetricGroups(result, { z0: form.z0, dT: form.dT, freq: form.freq })
    : [];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: FIELDS.map((f) => ({
        label: f.label,
        value: `${form[f.key]} ${fieldUnit(f, system)}`,
      })),
    },
  ];
  if (result) {
    reportSections.push({
      title: '工艺检查',
      rows: checks.map((c) => ({
        label: c.label,
        value: `${c.value}${c.unit ? ` ${c.unit}` : ''}`,
        note: c.note,
      })),
    });
    reportSections.push({
      title: '计算结果',
      rows: metricGroups.flatMap((g) =>
        g.items.map((m) => ({
          label: `${g.title} · ${m.label}`,
          value: `${m.value}${m.unit ? ` ${m.unit}` : ''}`,
          note: m.note,
        })),
      ),
    });
  }

  useReport({
    id: 'via',
    title: '过孔参数',
    subtitle: `工艺规则：${activeRuleLabel}`,
    sections: reportSections,
    assumptions: [
      '镀层截面 A = π(D+T)T；电阻 R = ρL/A；轴向热阻 Rθ = L/(k·A)，铜 k = 401 W/(m·K)。',
      '载流量采用 IPC-2221 外层公式对镀层截面做一阶估算，不是 via 热网络仿真。',
      '电容与电感采用标准 via 几何近似；结果为工程估算。',
    ],
  });

  return (
    <div className="calc-panel via-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? 'PCB 与高速'}</span>
          <h2>过孔参数</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result
                ? [{ label: '过孔电阻', value: fmtNum(result.resistance * 1e3), unit: 'mΩ' }]
                : []
            }
            badge={<em className="badge">IPC-2221</em>}
            meta={
              result ? (
                <>
                  D {formatViaMeasurement(geometry.holeMm, 'hole', system)} · T{' '}
                  {formatViaMeasurement(geometry.platingMm, 'plating', system)} · 深径比{' '}
                  {formatAspectRatio(result.aspectRatio)} · 载流 {fmtNum(result.currentEstimate)} A
                </>
              ) : (
                '输入过孔与镀层参数。'
              )
            }
            figure={
              result ? (
                <ViaFigure
                  hole={geometry.holeMm}
                  pad={geometry.padMm}
                  length={geometry.lengthMm}
                  plating={geometry.platingMm}
                  unitSystem={system}
                />
              ) : (
                <div className="figure-empty">参数无效</div>
              )
            }
            caption="A–A 剖面 + 俯视：D 为最终孔径，T 为孔壁镀层厚度，PAD 为焊盘直径。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODEL · 镀层截面</div>
              <code className="card-formula">A = π(D + T)·T</code>
              <p className="card-note">按镀铜环形截面计算直流电阻与热阻。</p>
            </div>

            <div className="card">
              <div className="card-title">PROCESS · 工艺规则</div>
              <select
                className="inp"
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value as ViaRuleId)}
              >
                <option value="standard">常规板（示例）</option>
                <option value="hdi">高密度板（示例）</option>
                <option value="custom">自定义</option>
              </select>
              <p className="card-note">{viaRuleSummary(rules, system)}</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 过孔电阻</div>
              <div className="scope-value">
                {result ? fmtNum(result.resistance * 1e3) : '—'}
                <span>mΩ</span>
              </div>
              <div className="scope-status">
                <i />
                {result ? `压降 ${fmtNum(result.voltageDrop * 1e3)} mV` : '待输入'}
              </div>
            </div>
          </section>

          {ruleId === 'custom' && (
            <section className="card editor-card">
              <div className="card-title">CUSTOM · 自定义工艺规则</div>
              <div className="grid grid-3">
                <div className="field">
                  <label htmlFor="via-rule-ar">最大深径比</label>
                  <div className="field-row">
                    <input
                      id="via-rule-ar"
                      value={customRules.maxAspectRatio}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCustomRule('maxAspectRatio', e.target.value)}
                    />
                    <span className="uc-unit">L / D</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="via-rule-ring">最小环宽 (mm)</label>
                  <div className="field-row">
                    <input
                      id="via-rule-ring"
                      value={customRules.minAnnularRingMm}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCustomRule('minAnnularRingMm', e.target.value)}
                    />
                    <span className="uc-unit">mm</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="via-rule-hole">最小孔径 (mm)</label>
                  <div className="field-row">
                    <input
                      id="via-rule-hole"
                      value={customRules.minHoleMm}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCustomRule('minHoleMm', e.target.value)}
                    />
                    <span className="uc-unit">mm</span>
                  </div>
                </div>
              </div>
              <p className="card-note">环宽与孔径按 mm 输入；留空或非法值回退到常规板阈值。</p>
            </section>
          )}

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 过孔与镀层参数</span>
            </div>
            <div className="grid">
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`via-${f.key}`}>{f.label}</label>
                  <div className="field-row">
                    <input
                      id={`via-${f.key}`}
                      value={form[f.key]}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                    <span className="uc-unit">{fieldUnit(f, system)}</span>
                  </div>
                </div>
              ))}
            </div>
            {error && <div className="error">{error}</div>}
          </section>

          {result && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 工艺检查</span>
                <span className="section-note">{activeRuleLabel} · 能力参考</span>
              </div>
              <div className="via-checks">
                {checks.map((c) => (
                  <div className={`via-check ${c.tone}`} key={c.id}>
                    <div className="via-check-title">
                      <i />
                      {c.label}
                    </div>
                    <div className="via-check-value">
                      {c.value}
                      {c.unit && <em>{c.unit}</em>}
                    </div>
                    <div className="via-check-note">{c.note}</div>
                  </div>
                ))}
              </div>
              {checks.some((c) => c.tone === 'warn') && (
                <p className="action-note">
                  参数超出「{activeRuleLabel}」规则，请与工厂工艺能力表复核。
                </p>
              )}
            </section>
          )}

          {result && (
            <section className="input-section">
              <div className="section-head">
                <span className="section-label">// 计算结果</span>
                <span className="section-note">一阶模型 · 实时</span>
              </div>
              <div className="via-results">
                {metricGroups.map((g) => (
                  <div className="via-group" key={g.id}>
                    <div className="via-group-head">
                      <span>{g.label}</span>
                      <b>{g.title}</b>
                    </div>
                    <div className="via-metric-grid">
                      {g.items.map((m) => (
                        <div className={`via-metric${m.muted ? ' muted' : ''}`} key={m.label}>
                          <div className="via-metric-name">{m.label}</div>
                          <div className="via-metric-note">{m.note}</div>
                          <div className="via-metric-value">
                            {m.value}
                            {m.unit && <em>{m.unit}</em>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <details className="ref-block">
            <summary>模型与假设</summary>
            <p className="action-note">
              镀层截面 A = π(D+T)T；电阻 R = ρL/A；轴向热阻 Rθ = L/(k·A)，取铜 k = 401
              W/(m·K)。载流量采用 IPC-2221 外层公式 I = 0.048·ΔT^0.44·A^0.725
              对镀层截面做一阶估算，不是 via 的热网络仿真。电容与电感采用标准 via
              几何近似；结果为工程估算，安全相关设计需按标准复核或实测。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">镀层电阻 / 热阻 / IPC-2221 载流估算。</p>
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
