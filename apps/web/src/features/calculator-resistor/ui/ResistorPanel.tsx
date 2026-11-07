import { useMemo, useState } from 'react';
import { Quantity, runCalculation, type NamedInputs, type VariableSpec } from '@calcbridge/core';
import { RESISTOR_SPEC } from '@calcbridge/calculators';
import { AssumptionsPanel } from '@/shared/ui/AssumptionsPanel';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { ResistorFigure } from '@/shared/ui/figures/ResistorFigure';
import { draftInput, fmtNum, type InputState } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';

/* ── 电阻计算器面板 ───────────────────────────────────── */

type ResMode = 'series' | 'parallel' | 'divider';
interface ResOut {
  label: string;
  value: string;
  unit: string;
  extra?: string;
}
interface ResistorDraft {
  mode: ResMode;
  r1: InputState;
  r2: InputState;
  vin: InputState;
  out: ResOut | null;
}

const RES_FORMULA: Record<ResMode, string> = {
  series: 'Rs = R1 + R2',
  parallel: 'Rp = R1 × R2 / (R1 + R2)',
  divider: 'Vout = Vin × R2 / (R1 + R2)',
};

const RES_UNIT: Record<string, string> = {
  ohm: 'Ω',
  kohm: 'kΩ',
  Mohm: 'MΩ',
  V: 'V',
  mV: 'mV',
};

function ohmParts(v: number): { value: string; unit: string } {
  if (!Number.isFinite(v)) return { value: String(v), unit: '' };
  if (v >= 1e6) return { value: fmtNum(v / 1e6), unit: 'MΩ' };
  if (v >= 1e3) return { value: fmtNum(v / 1e3), unit: 'kΩ' };
  return { value: fmtNum(v), unit: 'Ω' };
}

/** 工程建议范围：按基础单位判断，避免 kΩ/MΩ 切换时误报。 */
const OHM_FACTOR: Record<string, number> = { ohm: 1, kohm: 1e3, Mohm: 1e6 };

const RES_LIMITS: VariableSpec = {
  id: 'r',
  unit: 'Ω',
  limits: { min: 0.01, max: 1e9, note: '常见 1 Ω–10 MΩ' },
};

const VIN_LIMITS: VariableSpec = {
  id: 'vin',
  unit: 'V',
  limits: { min: 0.001, max: 1000, note: '常见 1–48 V' },
};

export function ResistorPanel({ group }: { group?: string }) {
  const draft = useDraftData<ResistorDraft>(RESISTOR_SPEC.id);
  const [mode, setMode] = useState<ResMode>(() =>
    draft?.mode === 'parallel' || draft?.mode === 'divider' || draft?.mode === 'series'
      ? draft.mode
      : 'series',
  );
  const [r1, setR1] = useState<InputState>(() =>
    draftInput(draft?.r1, { v: '1', unit: 'kohm' }, ['ohm', 'kohm', 'Mohm']),
  );
  const [r2, setR2] = useState<InputState>(() =>
    draftInput(draft?.r2, { v: '2', unit: 'kohm' }, ['ohm', 'kohm', 'Mohm']),
  );
  const [vin, setVin] = useState<InputState>(() =>
    draftInput(draft?.vin, { v: '12', unit: 'V' }, ['V', 'mV']),
  );
  /** 实时求解：输入变化即重算，结果派生而非存状态 */
  const solved = useMemo<{ out: ResOut | null; error: string | null }>(() => {
    if (!r1.v.trim() || !r2.v.trim()) return { out: null, error: null };
    try {
      const inputs: NamedInputs = { R1: `${r1.v} ${r1.unit}`, R2: `${r2.v} ${r2.unit}` };
      if (mode === 'divider') inputs.Vin = `${vin.v} ${vin.unit}`;
      const run = runCalculation(RESISTOR_SPEC, inputs, { modelIds: [mode] });
      const r = run.results[0]!;
      // 分压比按声明单位下的数值计算（同量纲比值与单位无关）
      const rr1 = new Quantity(Number(r1.v), r1.unit).to('ohm').value;
      const rr2 = new Quantity(Number(r2.v), r2.unit).to('ohm').value;
      const ratio = rr2 / (rr1 + rr2);
      if (mode === 'series')
        return { out: { label: '等效阻值 Rs', ...ohmParts(r.outputs.Rs!.value) }, error: null };
      if (mode === 'parallel')
        return { out: { label: '等效阻值 Rp', ...ohmParts(r.outputs.Rp!.value) }, error: null };
      return {
        out: {
          label: '分压输出 Vout',
          value: fmtNum(r.outputs.Vdiv!.value),
          unit: 'V',
          extra: `分压比 ${(ratio * 100).toFixed(2)}%`,
        },
        error: null,
      };
    } catch (e) {
      return { out: null, error: (e as Error).message };
    }
  }, [mode, r1, r2, vin]);

  const out = solved.out;
  const err = solved.error;

  useDraft(RESISTOR_SPEC.id, { mode, r1, r2, vin });

  const reset = () => {
    setMode('series');
    setR1({ v: '1', unit: 'kohm' });
    setR2({ v: '2', unit: 'kohm' });
    setVin({ v: '12', unit: 'V' });
  };

  useReport({
    id: RESISTOR_SPEC.id,
    title: RESISTOR_SPEC.title,
    subtitle: RES_FORMULA[mode],
    sections: [
      {
        title: '输入参数',
        rows: [
          { label: '连接方式', value: mode },
          { label: 'R1', value: `${r1.v} ${RES_UNIT[r1.unit] ?? r1.unit}` },
          { label: 'R2', value: `${r2.v} ${RES_UNIT[r2.unit] ?? r2.unit}` },
          ...(mode === 'divider'
            ? [{ label: '输入电压 Vin', value: `${vin.v} ${RES_UNIT[vin.unit] ?? vin.unit}` }]
            : []),
        ],
      },
      ...(out
        ? [
            {
              title: '计算结果',
              rows: [
                { label: out.label, value: `${out.value} ${out.unit}` },
                ...(out.extra ? [{ label: '补充', value: out.extra }] : []),
              ],
            },
          ]
        : []),
      ...(err ? [{ title: '校验', rows: [{ label: '错误', value: err }] }] : []),
    ],
    assumptions: RESISTOR_SPEC.assumptions,
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          {group && <span className="ch-kicker">{group}</span>}
          <h2>{RESISTOR_SPEC.title}</h2>
        </div>
        <span className="calc-ver">v{RESISTOR_SPEC.version}</span>
      </header>
      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[
              {
                label: out?.label ?? '等效阻值',
                value: out?.value ?? '--',
                unit: out?.unit ?? '',
              },
            ]}
            badge={out ? <em className="badge ok">已计算</em> : undefined}
            meta={out ? (out.extra ?? '按上述计算式求得。') : '输入参数后点击「计算」。'}
            figure={<ResistorFigure mode={mode} />}
            caption={RES_FORMULA[mode]}
          />
        </aside>
        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODE · 连接方式</div>
              <select
                className="inp"
                value={mode}
                onChange={(e) => setMode(e.target.value as ResMode)}
              >
                <option value="series">串联</option>
                <option value="parallel">并联</option>
                <option value="divider">分压</option>
              </select>
              <p className="card-note">串联 / 并联 / 分压三种接法，输入单位可自由选择。</p>
            </div>
            <div className="card">
              <div className="card-title">TRANSFER · 计算式</div>
              <code className="card-formula">{RES_FORMULA[mode]}</code>
              <p className="card-note">按声明单位解析，量纲不符会直接报错。</p>
            </div>
            <div className="card">
              <div className="card-title">OUTPUT · 输出量</div>
              <div className="scope-value">
                {mode === 'series' ? 'Rs' : mode === 'parallel' ? 'Rp' : 'Vout'}
                <span>
                  {mode === 'series' ? '串联等效' : mode === 'parallel' ? '并联等效' : '分压输出'}
                </span>
              </div>
              <div className="scope-status">
                <i />
                {out ? '已计算 · 见右侧' : '待计算'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入</span>
              <span className="section-note">
                输出参数 {mode === 'series' ? 'Rs' : mode === 'parallel' ? 'Rp' : 'Vout'}
              </span>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label>电阻 R1</label>
                <div className="field-row">
                  <input
                    value={r1.v}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setR1({ ...r1, v: e.target.value })}
                  />
                  <select value={r1.unit} onChange={(e) => setR1({ ...r1, unit: e.target.value })}>
                    <option value="ohm">Ω</option>
                    <option value="kohm">kΩ</option>
                    <option value="Mohm">MΩ</option>
                  </select>
                </div>
                <FieldWarn
                  value={Number(r1.v) * OHM_FACTOR[r1.unit]}
                  spec={{ ...RES_LIMITS, label: '电阻 R1' }}
                />
              </div>
              <div className="field">
                <label>电阻 R2</label>
                <div className="field-row">
                  <input
                    value={r2.v}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setR2({ ...r2, v: e.target.value })}
                  />
                  <select value={r2.unit} onChange={(e) => setR2({ ...r2, unit: e.target.value })}>
                    <option value="ohm">Ω</option>
                    <option value="kohm">kΩ</option>
                    <option value="Mohm">MΩ</option>
                  </select>
                </div>
                <FieldWarn
                  value={Number(r2.v) * OHM_FACTOR[r2.unit]}
                  spec={{ ...RES_LIMITS, label: '电阻 R2' }}
                />
              </div>
              {mode === 'divider' && (
                <div className="field">
                  <label>输入电压 Vin</label>
                  <div className="field-row">
                    <input
                      value={vin.v}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setVin({ ...vin, v: e.target.value })}
                    />
                    <select
                      value={vin.unit}
                      onChange={(e) => setVin({ ...vin, unit: e.target.value })}
                    >
                      <option value="V">V</option>
                      <option value="mV">mV</option>
                    </select>
                  </div>
                  <FieldWarn
                    value={Number(vin.v) * (vin.unit === 'mV' ? 1e-3 : 1)}
                    spec={VIN_LIMITS}
                  />
                </div>
              )}
            </div>
          </section>

          {err && <div className="error">计算错误：{err}</div>}

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">
                按声明单位解析，量纲不符会直接报错；输入即算，结果实时更新。
              </p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>

          <AssumptionsPanel spec={RESISTOR_SPEC} />
        </div>
      </div>
    </div>
  );
}
