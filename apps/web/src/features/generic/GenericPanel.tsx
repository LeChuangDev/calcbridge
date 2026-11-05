import { useEffect, useMemo, useState } from 'react';
import {
  Quantity,
  collectVars,
  parseExpr,
  runCalculation,
  runMonteCarlo,
  type CalcSpec,
  type McStats,
} from '@calcbridge/core';
import {
  AssumptionsPanel,
  InductorFigure,
  InputField,
  MicrostripFigure,
  MonteCarloPanel,
  OutputDisplay,
  ResultCard,
  TraceFigure,
  VerdictBadge,
} from '@/components';
import { TraceExtras } from './TraceExtras';
import {
  buildInputs,
  compatibleUnits,
  draftInput,
  emptyInputs,
  fmtNum,
  type InputState,
} from '@/lib/bridge';
import { useDraft, useDraftData } from '@/lib/draftStore';
import type { ReportSection } from '@/lib/report';
import { useReport } from '@/lib/reportStore';

/* ── 通用面板（走线载流 / Buck 电感 / 受控阻抗） ───────── */

interface GenericDraft {
  inputs: Record<string, InputState>;
  target: string;
  selectedModels: string[];
  outSel: string;
  mcOn: boolean;
}

export function GenericPanel({ spec, group }: { spec: CalcSpec; group?: string }) {
  const draft = useDraftData<GenericDraft>(spec.id);
  const [inputs, setInputs] = useState<Record<string, InputState>>(() => {
    const init: Record<string, InputState> = {};
    for (const vs of spec.variables) {
      const fallback = emptyInputs(vs);
      const st = draftInput(draft?.inputs?.[vs.id], fallback);
      const unitOk = compatibleUnits(vs).some((u) => u.id === st.unit);
      init[vs.id] = unitOk ? st : fallback;
    }
    return init;
  });
  const [target, setTarget] = useState<string>(() =>
    typeof draft?.target === 'string' ? draft.target : '__forward__',
  );
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    const saved = draft?.selectedModels;
    if (!Array.isArray(saved)) return spec.models.map((m) => m.id);
    return saved.filter((id) => spec.models.some((m) => m.id === id));
  });
  const [mcOn, setMcOn] = useState(() => draft?.mcOn === true);
  const [outSel, setOutSel] = useState(() =>
    typeof draft?.outSel === 'string' ? draft.outSel : '',
  );

  useDraft(spec.id, { inputs, target, selectedModels, outSel, mcOn });

  const namedInputs = useMemo(() => buildInputs(inputs), [inputs]);

  const run = useMemo<
    | { kind: 'ok'; results: ReturnType<typeof runCalculation>['results'] }
    | { kind: 'error'; error: string }
  >(() => {
    if (selectedModels.length === 0) {
      return { kind: 'error', error: '请至少选择一个计算模型。' };
    }
    try {
      const res = runCalculation(spec, namedInputs, {
        modelIds: selectedModels,
        target: target === '__forward__' ? undefined : target,
      });
      return { kind: 'ok', results: res.results };
    } catch (e) {
      return { kind: 'error', error: (e as Error).message };
    }
  }, [spec, namedInputs, target, selectedModels]);

  const [mc, setMc] = useState<Record<string, McStats>>({});
  const [mcPending, setMcPending] = useState(false);

  // 蒙特卡洛 2000 次采样较重：输入变化时延迟 200ms 再算，避免每次按键阻塞界面。
  useEffect(() => {
    if (!mcOn || run.kind !== 'ok' || selectedModels.length === 0) {
      setMc({});
      setMcPending(false);
      return;
    }
    setMcPending(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const out: Record<string, McStats> = {};
      for (const m of spec.models) {
        if (!selectedModels.includes(m.id)) continue;
        try {
          out[m.id] = runMonteCarlo(
            spec,
            m,
            namedInputs,
            { samples: 2000, seed: 42 },
            {},
            undefined,
            target === '__forward__' ? undefined : target,
          );
        } catch {
          /* 该模型缺少输入时跳过 */
        }
      }
      if (!cancelled) {
        setMc(out);
        setMcPending(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mcOn, run, spec, namedInputs, selectedModels, target]);

  const targetCandidates = useMemo(() => {
    const activeModels = spec.models.filter((m) => selectedModels.includes(m.id));
    const used = new Set<string>();
    const outputIds = new Set<string>();
    for (const m of activeModels) {
      const bodies = m.exprs ? Object.values(m.exprs) : [m.expr!.split('=')[1]!];
      for (const body of bodies) {
        for (const v of collectVars(parseExpr(body))) used.add(v);
      }
      for (const key of m.exprs ? Object.keys(m.exprs) : [m.expr!.split('=')[0]!.trim()]) {
        outputIds.add(key);
      }
    }
    // 多输出模型中，输出量可能出现在后续表达式里（如 Buck 的 iPeak），
    // 不能作为反向求解目标，否则求解器会直接报错。
    return spec.variables.filter((v) => used.has(v.id) && !outputIds.has(v.id));
  }, [spec, selectedModels]);

  // 切换模型后若原目标已不可用，自动回到正向求解。
  useEffect(() => {
    if (target !== '__forward__' && !targetCandidates.some((v) => v.id === target)) {
      setTarget('__forward__');
    }
  }, [target, targetCandidates]);

  const reset = () => {
    const init: Record<string, InputState> = {};
    for (const vs of spec.variables) init[vs.id] = emptyInputs(vs);
    setInputs(init);
    setTarget('__forward__');
    setSelectedModels(spec.models.map((m) => m.id));
    setMcOn(false);
  };

  const firstResult = run.kind === 'ok' ? run.results[0] : null;
  const outputList = firstResult
    ? Object.entries(firstResult.outputs).map(([id, tv]) => {
        const vs = spec.variables.find((v) => v.id === id);
        const symbol = vs
          ? (compatibleUnits(vs).find((u) => u.id === tv.unit)?.symbol ?? tv.unit)
          : tv.unit;
        return { id, label: vs?.label ?? id, value: fmtNum(tv.value), unit: symbol };
      })
    : [];
  const selectedOutput = outputList.find((o) => o.id === outSel) ?? outputList[0] ?? null;
  const restOutputs = outputList.filter((o) => o.id !== selectedOutput?.id);

  /** 将输入状态换算到变量声明单位，供图形标注使用。 */
  const declaredValue = (id: string): string => {
    const st = inputs[id];
    const vs = spec.variables.find((v) => v.id === id);
    if (!st || !vs || st.v.trim() === '') return '—';
    const n = Number(st.v);
    if (!Number.isFinite(n)) return '—';
    try {
      return fmtNum(new Quantity(n, st.unit).to(vs.unit).value);
    } catch {
      return '—';
    }
  };

  let figure = <div className="figure-empty">该计算器暂无可视化示意</div>;
  let figureCaption = '按所选模型计算。';
  if (spec.id === 'impedance_microstrip') {
    figure = (
      <MicrostripFigure
        w={declaredValue('w')}
        h={declaredValue('h')}
        t={declaredValue('t')}
        er={declaredValue('Er')}
      />
    );
    figureCaption = '微带线截面：w 线宽、h 介质厚度、t 铜厚（mm），εr 为介电常数。';
  } else if (spec.id === 'trace_current') {
    const wOut = firstResult?.outputs.w?.value;
    figure = (
      <TraceFigure
        I={declaredValue('I')}
        dT={declaredValue('dT')}
        w={wOut != null ? fmtNum(wOut) : '—'}
      />
    );
    figureCaption = '走线截面：按载流（A）与允许温升（K）确定最小线宽。';
  } else if (spec.id === 'buck_inductor') {
    const lOut = firstResult?.outputs.L?.value;
    const dOut = firstResult?.outputs.deltaI?.value;
    figure = (
      <InductorFigure
        L={lOut != null ? fmtNum(lOut) : '—'}
        dI={dOut != null ? fmtNum(dOut) : '—'}
      />
    );
    figureCaption = '电感电流纹波：L 与 ΔI 决定磁芯与饱和电流选型。';
  }

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        ...spec.variables.map((vs) => {
          const st = inputs[vs.id]!;
          const symbol = compatibleUnits(vs).find((u) => u.id === st.unit)?.symbol ?? st.unit;
          return {
            label: vs.label ?? vs.id,
            value: `${st.v || '—'} ${symbol}`,
            note: target === vs.id ? '求解目标' : undefined,
          };
        }),
        {
          label: '求解方向',
          value:
            target === '__forward__'
              ? '正向'
              : `反向求解 ${spec.variables.find((v) => v.id === target)?.label ?? target}`,
        },
        {
          label: '启用模型',
          value: selectedModels
            .map((id) => spec.models.find((m) => m.id === id)?.name ?? id)
            .join(' / '),
        },
      ],
    },
  ];
  if (run.kind === 'error') {
    reportSections.push({ title: '校验', rows: [{ label: '错误', value: run.error }] });
  } else {
    for (const r of run.results) {
      reportSections.push({
        title: `结果 · ${r.modelName}`,
        rows: [
          ...Object.entries(r.outputs).map(([id, tv]) => {
            const vs = spec.variables.find((v) => v.id === id);
            const symbol = vs
              ? (compatibleUnits(vs).find((u) => u.id === tv.unit)?.symbol ?? tv.unit)
              : tv.unit;
            return {
              label: vs?.label ?? id,
              value: `${fmtNum(tv.value)} ${symbol}`,
              note: `${tv.grade}${tv.confirmed ? '' : ' · 未确认'}`,
            };
          }),
          {
            label: '标准 / 判定',
            value: r.standard,
            note: r.verdict.status,
          },
        ],
      });
    }
  }

  useReport({
    id: spec.id,
    title: spec.title,
    subtitle:
      target === '__forward__'
        ? '正向求解'
        : `反向求解 ${spec.variables.find((v) => v.id === target)?.label ?? target}`,
    sections: reportSections,
    assumptions: spec.assumptions,
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          {group && <span className="ch-kicker">{group}</span>}
          <h2>{spec.title}</h2>
        </div>
        <span className="calc-ver">v{spec.version}</span>
      </header>
      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={selectedOutput ? [selectedOutput] : []}
            badge={firstResult ? <VerdictBadge status={firstResult.verdict.status} /> : undefined}
            meta={
              run.kind === 'error' ? (
                '输入有误，见左侧提示。'
              ) : firstResult ? (
                <>
                  {restOutputs.map((o) => `${o.label} ${o.value} ${o.unit}`).join(' · ')}
                  {restOutputs.length ? ' · ' : ''}
                  {firstResult.standard}
                </>
              ) : (
                '输入参数后实时计算。'
              )
            }
            figure={figure}
            caption={figureCaption}
          />
        </aside>
        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">SOLVE · 求解方向</div>
              <select className="inp" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="__forward__">正向：已知输入 → 求输出</option>
                {targetCandidates.map((v) => (
                  <option key={v.id} value={v.id}>
                    反向：求解 {v.label ?? v.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="card">
              <div className="card-title">MODELS · 多标准并存</div>
              <div className="chips">
                {spec.models.map((m) => (
                  <label key={m.id} className="chip">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(m.id)}
                      onChange={(e) =>
                        setSelectedModels((p) =>
                          e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id),
                        )
                      }
                    />
                    {m.name}
                    {m.pendingVerification && <em className="tag warn">近似</em>}
                  </label>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">SCOPE · 运行范围</div>
              <div className="scope-value">
                {selectedModels.length}
                <span>models</span>
              </div>
              <div className="scope-status">
                <i />
                {mcOn ? '不确定度分析开启' : '稳态计算 · 实时'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入（任意变量可作已知量）</span>
              {outputList.length > 0 && (
                <label className="output-picker">
                  <span>输出参数</span>
                  <select
                    className="inp"
                    value={selectedOutput?.id ?? ''}
                    onChange={(e) => setOutSel(e.target.value)}
                  >
                    {outputList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="grid">
              {spec.variables.map((vs) => (
                <InputField
                  key={vs.id}
                  id={vs.id}
                  vs={vs}
                  st={inputs[vs.id]!}
                  onChange={(s) => setInputs((p) => ({ ...p, [vs.id]: s }))}
                />
              ))}
            </div>
          </section>

          {run.kind === 'error' && <div className="error">计算错误：{run.error}</div>}

          {run.kind === 'ok' && (
            <details className="detail-block">
              <summary>
                详细结果（{selectedModels.length} 个模型{mcOn ? ' · 不确定度' : ''}）
              </summary>
              <div className="results">
                {run.results.map((r) => (
                  <ResultCard key={r.modelId} spec={spec} r={r} />
                ))}
              </div>
            </details>
          )}

          {spec.id === 'trace_current' && run.kind === 'ok' && (
            <TraceExtras results={run.results} />
          )}

          {mcOn && run.kind === 'ok' && (
            <div className="mc-block">
              <h3>不确定度与敏感度</h3>
              {mcPending && (
                <div className="mc-running">蒙特卡洛采样中…（2000 样本，输入停止后自动重算）</div>
              )}
              {Object.entries(mc).map(([modelId, stats]) => (
                <div key={modelId} className="mc-model">
                  <b>{modelId}</b>
                  <MonteCarloPanel stats={stats} running={false} />
                </div>
              ))}
            </div>
          )}

          <div className="actions">
            <div className="actions-left">
              <div className="actions-line">
                <button className={mcOn ? 'btn active' : 'btn'} onClick={() => setMcOn((p) => !p)}>
                  {mcOn ? '关闭不确定度分析' : '开启不确定度分析'}
                </button>
              </div>
              <p className="action-note">输入即实时重算 · 支持正 / 反向求解。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>

          <AssumptionsPanel spec={spec} />
        </div>
      </div>
    </div>
  );
}
