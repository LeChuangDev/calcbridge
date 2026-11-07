import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { FieldWarn } from '@/shared/ui/FieldWarn';
import type { VariableSpec } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useCtrlEnter } from '@/shared/lib/hotkeys';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  solveESeries,
  type ESeriesId,
  type ESeriesResult,
  type ESeriesSolution,
} from '@/features/calculator-e-series/model/eSeriesSolver';

function ohmParts(v: number): { value: string; unit: string } {
  if (v >= 1e6) return { value: fmtNum(v / 1e6), unit: 'MΩ' };
  if (v >= 1e3) return { value: fmtNum(v / 1e3), unit: 'kΩ' };
  return { value: fmtNum(v), unit: 'Ω' };
}

function errText(e: number): string {
  return `${e >= 0 ? '+' : ''}${e.toFixed(3)}%`;
}

function errClass(e: number): string {
  const abs = Math.abs(e);
  if (abs <= 0.1) return ' good';
  if (abs <= 1) return ' ok';
  return ' warn';
}

function validSolution(s: unknown): s is ESeriesSolution {
  if (!s || typeof s !== 'object') return false;
  const v = s as ESeriesSolution;
  return (
    Number.isFinite(v.value) &&
    Number.isFinite(v.error) &&
    typeof v.expr === 'string' &&
    Number.isFinite(v.count)
  );
}

function validResult(r: unknown): r is ESeriesResult {
  if (!r || typeof r !== 'object') return false;
  const result = r as ESeriesResult;
  return [result.simple, result.three, result.four].every((s) => s === null || validSolution(s));
}

interface ESeriesDraft {
  series: ESeriesId;
  limit: 2 | 3 | 4;
  target: string;
  ex1: string;
  ex2: string;
  result: ESeriesResult | null;
}

const ESERIES_IDS: ESeriesId[] = ['E1', 'E3', 'E6', 'E12', 'E24'];

/** 工程建议范围：0.1 Ω–9.1 MΩ（按 kΩ 输入）。 */
const ES_LIMITS: VariableSpec = {
  id: 'target',
  unit: 'kΩ',
  limits: { min: 0.0001, max: 9100, note: '0.1 Ω–9.1 MΩ' },
};

export function ESeriesPanel({ group }: { group?: string }) {
  const draft = useDraftData<ESeriesDraft>('e_series');
  const [series, setSeries] = useState<ESeriesId>(() =>
    draft?.series && ESERIES_IDS.includes(draft.series) ? draft.series : 'E6',
  );
  const [limit, setLimit] = useState<2 | 3 | 4>(() =>
    draft?.limit === 2 || draft?.limit === 3 ? draft.limit : 4,
  );
  const [target, setTarget] = useState(() =>
    typeof draft?.target === 'string' ? draft.target : '1',
  );
  const [ex1, setEx1] = useState(() => (typeof draft?.ex1 === 'string' ? draft.ex1 : ''));
  const [ex2, setEx2] = useState(() => (typeof draft?.ex2 === 'string' ? draft.ex2 : ''));
  const [result, setResult] = useState<ESeriesResult | null>(() =>
    validResult(draft?.result) ? draft.result : null,
  );
  const [error, setError] = useState('');

  useDraft('e_series', { series, limit, target, ex1, ex2, result });

  const best: ESeriesSolution | null = result
    ? [result.simple, result.three, result.four]
        .filter((s): s is ESeriesSolution => s !== null)
        .reduce<ESeriesSolution | null>(
          (acc, s) => (!acc || Math.abs(s.error) < Math.abs(acc.error) - 1e-9 ? s : acc),
          null,
        )
    : null;

  const parts = best ? ohmParts(best.value) : null;

  const calc = () => {
    const t = Number(target);
    if (!target.trim() || !Number.isFinite(t) || t < 0.00025 || t > 4000) {
      setError('目标电阻应在 0.00025 – 4000 kΩ 之间。');
      setResult(null);
      return;
    }
    const ex: number[] = [];
    for (const raw of [ex1, ex2]) {
      if (!raw.trim()) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError('排除值必须为正数，单位 kΩ。');
        setResult(null);
        return;
      }
      ex.push(n * 1000);
    }
    const res = solveESeries(series, t * 1000, ex, limit);
    if (!res.simple && !res.three && !res.four) {
      setError('没有找到可用组合，请放宽排除值或更换 E 系列。');
      setResult(null);
      return;
    }
    setError('');
    setResult(res);
  };

  useCtrlEnter(calc);

  const reset = () => {
    setSeries('E6');
    setLimit(4);
    setTarget('1');
    setEx1('');
    setEx2('');
    setResult(null);
    setError('');
  };

  const rows: { label: string; sol: ESeriesSolution | null; disabled: boolean }[] = [
    { label: '简单解决方案', sol: result?.simple ?? null, disabled: false },
    {
      label: '3R 解决方案',
      sol: result?.three ?? null,
      disabled: limit < 3,
    },
    {
      label: '4R 解决方案',
      sol: result?.four ?? null,
      disabled: limit < 4,
    },
  ];

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: 'E 系列', value: series },
        { label: '元件上限', value: `${limit} 个` },
        { label: '目标电阻', value: `${target} kΩ` },
        { label: '排除值 1', value: ex1 || '—' },
        { label: '排除值 2', value: ex2 || '—' },
      ],
    },
  ];
  if (result) {
    reportSections.push({
      title: '计算结果',
      rows: rows.map((row) => ({
        label: row.label,
        value: row.disabled
          ? '未搜索'
          : row.sol
            ? `${row.sol.expr} · ${errText(row.sol.error)}`
            : '无匹配',
      })),
    });
  }
  if (error) reportSections.push({ title: '校验', rows: [{ label: '错误', value: error }] });

  useReport({
    id: 'e_series',
    title: 'E 系列组合',
    subtitle: result && best ? `最佳误差 ${errText(best.error)}` : '等待计算',
    sections: reportSections,
    assumptions: [
      '标准值覆盖 0.1 Ω – 9.1 MΩ，按所选 E 系列十倍程展开。',
      '误差按标称值计算，不含电阻公差；排除值按相对 ±0.5% 剔除。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '实用工具'}</span>
          <h2>E 系列组合</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              best && parts ? [{ label: '合成阻值', value: parts.value, unit: parts.unit }] : []
            }
            badge={
              best ? (
                <em className={`badge${Math.abs(best.error) <= 1 ? ' ok' : ''}`}>
                  {errText(best.error)}
                </em>
              ) : undefined
            }
            meta={
              best ? (
                <>
                  目标 {target} kΩ · {best.count} 个元件
                </>
              ) : (
                '输入目标后点击「计算」。'
              )
            }
            figure={
              best ? (
                <div className="solution-figure">
                  <div className="solution-expr">{best.expr}</div>
                  <div className="solution-note">+ 串联 · ∥ 并联</div>
                </div>
              ) : (
                <div className="figure-empty">等待计算</div>
              )
            }
            caption={
              best
                ? `最佳方案 · ${best.count} 个电阻 · 误差按标称值计算`
                : '误差 = (合成值 - 目标) / 目标。'
            }
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">SERIES · E 系列</div>
              <select
                className="inp"
                value={series}
                onChange={(e) => {
                  setSeries(e.target.value as ESeriesId);
                  setResult(null);
                }}
              >
                <option value="E1">E1</option>
                <option value="E3">E3</option>
                <option value="E6">E6</option>
                <option value="E12">E12</option>
                <option value="E24">E24</option>
              </select>
              <p className="card-note">E24 可选值最密；E6 组合最简单。</p>
            </div>

            <div className="card">
              <div className="card-title">LIMIT · 元件上限</div>
              <select
                className="inp"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value) as 2 | 3 | 4);
                  setResult(null);
                }}
              >
                <option value={2}>2 个</option>
                <option value={3}>3 个</option>
                <option value={4}>4 个</option>
              </select>
              <p className="card-note">上限越低，搜索越快；默认覆盖 4R。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 最佳误差</div>
              <div className="scope-value">
                {best ? best.error.toFixed(3) : '—'}
                <span>%</span>
              </div>
              <div className="scope-status">
                <i />
                {best ? `${best.count} 个元件 · 已计算` : '待计算'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 目标与排除值（kΩ）</span>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="es-target">所需电阻</label>
                <div className="field-row">
                  <input
                    id="es-target"
                    value={target}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setTarget(e.target.value);
                      setResult(null);
                    }}
                  />
                  <span className="uc-unit">kΩ</span>
                </div>
                <FieldWarn value={target} spec={{ ...ES_LIMITS, label: '所需电阻' }} />
              </div>
              <div className="field">
                <label htmlFor="es-ex1">排除值 1（可选）</label>
                <div className="field-row">
                  <input
                    id="es-ex1"
                    value={ex1}
                    inputMode="decimal"
                    placeholder="—"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setEx1(e.target.value);
                      setResult(null);
                    }}
                  />
                  <span className="uc-unit">kΩ</span>
                </div>
                <FieldWarn value={ex1} spec={{ ...ES_LIMITS, label: '排除值 1' }} />
              </div>
              <div className="field">
                <label htmlFor="es-ex2">排除值 2（可选）</label>
                <div className="field-row">
                  <input
                    id="es-ex2"
                    value={ex2}
                    inputMode="decimal"
                    placeholder="—"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setEx2(e.target.value);
                      setResult(null);
                    }}
                  />
                  <span className="uc-unit">kΩ</span>
                </div>
                <FieldWarn value={ex2} spec={{ ...ES_LIMITS, label: '排除值 2' }} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 解决方案</span>
              <span className="section-note">误差 = (合成值 - 目标) / 目标</span>
            </div>
            <div className="panel solution-panel">
              {rows.map((row) => {
                let expr = '—';
                let err = '—';
                if (row.disabled) {
                  expr = `未搜索（上限 ${limit} 个）`;
                } else if (result) {
                  if (row.sol) {
                    expr = row.sol.expr;
                    err = errText(row.sol.error);
                  } else {
                    expr = '无匹配';
                  }
                } else {
                  expr = '待计算';
                }
                return (
                  <div className="solution-row" key={row.label}>
                    <span className="solution-label">{row.label}</span>
                    <span className="solution-expr">{expr}</span>
                    <span className={`solution-error${row.sol ? errClass(row.sol.error) : ''}`}>
                      {err}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <details className="ref-block">
            <summary>计算说明</summary>
            <p className="action-note">
              目标范围 0.00025 – 4000 kΩ；可用标准值覆盖 0.1 Ω – 9.1 MΩ，按所选 E
              系列十倍程展开。简单方案使用 1–2 个电阻，3R / 4R 分别使用 3 / 4 个电阻。表达式中的 +
              为串联，∥ 为并联；误差按标称值计算，不含电阻公差。排除值按相对 ±0.5% 从标准值中剔除。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">+ 串联 · ∥ 并联 · 最多 4 个电阻 · Ctrl + Enter 计算。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
              <button className="btn primary" onClick={calc}>
                计算
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
