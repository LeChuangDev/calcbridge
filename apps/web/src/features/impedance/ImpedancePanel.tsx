import { useLayoutEffect, useRef, useState } from 'react';
import { impedanceMicrostripSpec } from '@calcbridge/calculators';
import { OutputDisplay } from '@/components/OutputDisplay';
import { fmtNum } from '@/lib/bridge';
import { useDraft, useDraftData } from '@/lib/draftStore';
import { useUnitSystem } from '@/providers/UnitSystemProvider';
import {
  convertLengthString,
  formatLength,
  formatLengthValue,
  lengthUnit,
  toMillimetres,
  type UnitSystem,
} from '@/lib/unitSystem';
import {
  confidenceLabel,
  confidenceTone,
  evaluateImpedance,
  type ImpedanceMode,
} from './impedanceModels';
import {
  DEFAULT_CUSTOM_STACKUP,
  STACKUP_PRESETS,
  isStackupId,
  presetFields,
  resolveStackup,
  stackupSummary,
  type StackupFields,
  type StackupId,
} from './impedanceStackup';
import { useReport } from '@/lib/reportStore';
import type { ReportSection } from '@/lib/report';

interface ImpedanceDraft {
  mode?: ImpedanceMode;
  stackupId?: StackupId;
  fields?: Partial<StackupFields>;
  w?: string;
  target?: string;
  minWidth?: string;
  unitSystem?: UnitSystem;
}

const DEFAULT_W = '0.3';
const DEFAULT_TARGET = '50';
const DEFAULT_MIN_WIDTH = '0.1';

function StackupArt({
  wMm,
  hMm,
  tMm,
  er,
  system,
}: {
  wMm: number;
  hMm: number;
  tMm: number;
  er: number;
  system: UnitSystem;
}) {
  const traceW = Math.max(28, Math.min(150, 78 * (wMm / Math.max(hMm, 1e-9))));
  const cx = 150;
  const traceX = cx - traceW / 2;
  return (
    <svg viewBox="0 0 300 190" className="figure imp-figure" role="img" aria-label="微带线叠层截面">
      <rect x="60" y="60" width="180" height="100" className="via-board" />
      <rect x={traceX} y="52" width={traceW} height="8" className="via-copper" />
      <rect x="60" y="160" width="180" height="6" className="via-copper" />
      <text x="150" y="42" className="f-txt small mid strong">
        SIGNAL
      </text>

      <line x1={traceX} y1="38" x2={cx + traceW / 2} y2="38" className="via-dim" />
      <line x1={traceX} y1="34" x2={traceX} y2="42" className="via-dim" />
      <line x1={cx + traceW / 2} y1="34" x2={cx + traceW / 2} y2="42" className="via-dim" />
      <text x={cx} y="30" className="f-txt small mid strong">
        w {formatLength(wMm, system)}
      </text>

      <line x1="44" y1="52" x2="44" y2="160" className="via-dim" />
      <line x1="40" y1="52" x2="48" y2="52" className="via-dim" />
      <line x1="40" y1="160" x2="48" y2="160" className="via-dim" />
      <text
        x="38"
        y="106"
        className="f-txt small"
        textAnchor="middle"
        transform="rotate(-90 38 106)"
      >
        h {formatLength(hMm, system)}
      </text>

      <line x1={cx + traceW / 2 + 6} y1="56" x2="236" y2="48" className="via-lead" />
      <text x="240" y="48" className="f-txt small">
        t {formatLength(tMm, system)}
      </text>
      <text x="240" y="60" className="f-txt small">
        CU
      </text>
      <text x="150" y="112" className="f-txt small mid via-material">
        εr {er}
      </text>
      <text x="150" y="180" className="f-txt small mid">
        REFERENCE PLANE
      </text>
    </svg>
  );
}

export function ImpedancePanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<ImpedanceDraft>('impedance_microstrip');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const presetId: StackupId = isStackupId(draft?.stackupId) ? draft.stackupId : 'four-layer';
  const preset = presetId !== 'custom' ? STACKUP_PRESETS[presetId] : null;

  const [mode, setMode] = useState<ImpedanceMode>(() =>
    draft?.mode === 'reverse' ? 'reverse' : 'forward',
  );
  const [stackupId, setStackupId] = useState<StackupId>(presetId);
  const [fields, setFields] = useState<StackupFields>(() => {
    const fallback = preset ? presetFields(preset, savedSystem) : DEFAULT_CUSTOM_STACKUP;
    const raw = {
      h: typeof draft?.fields?.h === 'string' ? draft.fields.h : fallback.h,
      t: typeof draft?.fields?.t === 'string' ? draft.fields.t : fallback.t,
      er: typeof draft?.fields?.er === 'string' ? draft.fields.er : fallback.er,
    };
    return {
      h: savedSystem === system ? raw.h : convertLengthString(raw.h, savedSystem, system),
      t: savedSystem === system ? raw.t : convertLengthString(raw.t, savedSystem, system),
      er: raw.er,
    };
  });
  const [w, setW] = useState(() => {
    const saved = typeof draft?.w === 'string' ? draft.w : DEFAULT_W;
    return savedSystem === system ? saved : convertLengthString(saved, savedSystem, system);
  });
  const [target, setTarget] = useState(() =>
    typeof draft?.target === 'string' ? draft.target : DEFAULT_TARGET,
  );
  const [minWidth, setMinWidth] = useState(() => {
    const saved = typeof draft?.minWidth === 'string' ? draft.minWidth : DEFAULT_MIN_WIDTH;
    return savedSystem === system ? saved : convertLengthString(saved, savedSystem, system);
  });
  const previousSystem = useRef(system);

  useDraft('impedance_microstrip', {
    mode,
    stackupId,
    fields,
    w,
    target,
    minWidth,
    unitSystem: system,
  });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setFields((current) => ({
      ...current,
      h: convertLengthString(current.h, previous, system),
      t: convertLengthString(current.t, previous, system),
    }));
    setW((value) => convertLengthString(value, previous, system));
    setMinWidth((value) => convertLengthString(value, previous, system));
    previousSystem.current = system;
  }, [system]);

  const choosePreset = (id: StackupId) => {
    setStackupId(id);
    if (id !== 'custom') setFields(presetFields(STACKUP_PRESETS[id], system));
  };

  const setField = (key: keyof StackupFields, value: string) => {
    setStackupId('custom');
    setFields((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setMode('forward');
    setStackupId('four-layer');
    setFields(presetFields(STACKUP_PRESETS['four-layer'], system));
    setW(convertLengthString(DEFAULT_W, 'metric', system));
    setTarget(DEFAULT_TARGET);
    setMinWidth(convertLengthString(DEFAULT_MIN_WIDTH, 'metric', system));
  };

  const stackup = resolveStackup(stackupId, fields, system);
  const wMm = toMillimetres(Number(w), lengthUnit(system));
  const minWidthMm = toMillimetres(Number(minWidth), lengthUnit(system));
  const targetOhm = Number(target);
  const paramsValid =
    Number.isFinite(stackup.hMm) &&
    stackup.hMm > 0 &&
    Number.isFinite(stackup.tMm) &&
    stackup.tMm > 0 &&
    Number.isFinite(stackup.er) &&
    stackup.er > 1 &&
    Number.isFinite(targetOhm) &&
    targetOhm > 0 &&
    (mode === 'reverse' || (Number.isFinite(wMm) && wMm > 0));

  const summary = evaluateImpedance(
    mode,
    { wMm, hMm: stackup.hMm, tMm: stackup.tMm, er: stackup.er, targetOhm },
    wMm,
  );

  const effectiveWidth = mode === 'forward' ? wMm : summary.median;
  const minWidthValid = Number.isFinite(minWidthMm) && minWidthMm > 0;
  const widthOk = !minWidthValid || effectiveWidth == null ? true : effectiveWidth >= minWidthMm;
  const targetErrorPct =
    mode === 'forward' && summary.median != null
      ? ((summary.median - targetOhm) / targetOhm) * 100
      : null;

  const tone: 'ok' | 'warn' | 'bad' =
    !paramsValid || summary.count === 0
      ? 'bad'
      : !widthOk
        ? 'bad'
        : confidenceTone(summary.confidence);
  const badgeLabel = !paramsValid
    ? '参数无效'
    : summary.count === 0
      ? '无适用模型'
      : !widthOk
        ? '低于最小线宽'
        : confidenceLabel(summary.confidence);

  const primaryValue =
    summary.median == null
      ? '—'
      : mode === 'forward'
        ? fmtNum(summary.median)
        : formatLengthValue(summary.median, system);
  const primaryUnit = mode === 'forward' ? 'Ω' : lengthUnit(system);

  const rangeText =
    summary.min == null || summary.max == null
      ? '—'
      : mode === 'forward'
        ? `${fmtNum(summary.min)} ~ ${fmtNum(summary.max)} Ω`
        : `${formatLength(summary.min, system)} ~ ${formatLength(summary.max, system)}`;

  const targetMeta =
    mode === 'forward'
      ? `目标 ${fmtNum(targetOhm)} Ω · 模型中位 ${fmtNum(summary.median ?? NaN)} Ω · 范围 ${rangeText}`
      : `目标 ${fmtNum(targetOhm)} Ω · 建议范围 ${rangeText}`;
  const spreadMeta = summary.spreadPct == null ? '' : ` · 模型差 ${summary.spreadPct.toFixed(2)}%`;
  const widthMeta = !widthOk ? ` · 最小线宽 ${formatLength(minWidthMm, system)}` : '';

  const reportSections: ReportSection[] = [
    {
      title: '叠层',
      rows: [
        { label: '叠层预设', value: stackup.name, note: stackup.note },
        { label: '介质厚度 h', value: formatLength(stackup.hMm, system) },
        { label: '铜厚 t', value: formatLength(stackup.tMm, system) },
        { label: '介电常数 εr', value: fmtNum(stackup.er) },
        ...(stackup.df != null ? [{ label: 'Df', value: fmtNum(stackup.df) }] : []),
      ],
    },
    {
      title: '设计参数',
      rows: [
        { label: '求解方向', value: mode === 'forward' ? '已知线宽 → Z0' : '目标 Z0 → 线宽' },
        ...(mode === 'forward' ? [{ label: '线宽 w', value: formatLength(wMm, system) }] : []),
        { label: '目标阻抗', value: `${fmtNum(targetOhm)} Ω` },
        { label: '工厂最小线宽', value: formatLength(minWidthMm, system) },
      ],
    },
  ];
  if (summary.count > 0) {
    reportSections.push({
      title: '模型并列',
      rows: summary.evaluations.map((e) => ({
        label: `${e.model.name}（${e.model.standard}）`,
        value: e.applicable
          ? mode === 'forward'
            ? `${fmtNum(e.z0!)} Ω`
            : formatLength(e.widthMm!, system)
          : '不适用',
        note: e.reason ?? e.model.note,
      })),
    });
    reportSections.push({
      title: '一致性',
      rows: [
        { label: '适用模型数', value: `${summary.count} / ${summary.evaluations.length}` },
        {
          label: '结果中位数',
          value:
            mode === 'forward'
              ? `${fmtNum(summary.median!)} Ω`
              : formatLength(summary.median!, system),
        },
        { label: '模型范围', value: rangeText },
        { label: '模型差', value: `${summary.spreadPct!.toFixed(2)} %` },
        { label: '判定', value: badgeLabel, note: confidenceLabel(summary.confidence) },
      ],
    });
  } else {
    reportSections.push({
      title: '校验',
      rows: [{ label: '错误', value: paramsValid ? '没有模型落在适用域内' : '参数无效' }],
    });
  }
  if (targetErrorPct != null && summary.median != null) {
    reportSections[1]?.rows.push({
      label: '目标偏差',
      value: `${targetErrorPct >= 0 ? '+' : ''}${targetErrorPct.toFixed(2)} %`,
    });
  }

  useReport({
    id: 'impedance_microstrip',
    title: '受控阻抗（微带线）',
    subtitle: `${stackup.name} · ${mode === 'forward' ? '正向' : '反向'}`,
    sections: reportSections,
    assumptions: [
      '准静态微带线模型；未计入阻焊、铜箔粗糙度、频变 Dk/Df 与辐射。',
      'IPC-2141 适用 0.1 ≤ w/h ≤ 3、1 ≤ εr ≤ 15。',
      'Hammerstad–Jensen 含厚度修正，适用 0.1 ≤ w/h ≤ 10。',
      '示例叠层不代表任何板厂官方叠层；生产前必须用实际叠层与板厂阻抗 coupon 复核。',
      '仓库尚未导入 Polar/Sigrity 对照数据；当前模型一致性不是外部软件校验结论。',
    ],
  });

  return (
    <div className="calc-panel imp-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '高速与射频'}</span>
          <h2>{impedanceMicrostripSpec.title}</h2>
        </div>
        <span className="calc-ver">v{impedanceMicrostripSpec.version}</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              summary.median != null
                ? [
                    {
                      label: mode === 'forward' ? '特性阻抗中位数' : '建议线宽中位数',
                      value: primaryValue,
                      unit: primaryUnit,
                    },
                  ]
                : []
            }
            badge={<em className={`badge ${tone}`}>{badgeLabel}</em>}
            meta={
              summary.count > 0
                ? `${targetMeta}${spreadMeta}${widthMeta}`
                : paramsValid
                  ? '当前参数没有模型落在适用域内。'
                  : '请检查叠层、线宽、目标阻抗与最小线宽。'
            }
            figure={
              summary.count > 0 && Number.isFinite(stackup.hMm) && Number.isFinite(stackup.tMm) ? (
                <StackupArt
                  wMm={mode === 'forward' ? wMm : (summary.median ?? wMm)}
                  hMm={stackup.hMm}
                  tMm={stackup.tMm}
                  er={stackup.er}
                  system={system}
                />
              ) : (
                <div className="figure-empty">参数无效</div>
              )
            }
            caption="单端微带线；多模型并列显示，不把单一公式当作精确结果。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">STACKUP · 叠层</div>
              <select
                className="inp"
                value={stackupId}
                onChange={(e) => choosePreset(e.target.value as StackupId)}
              >
                {Object.values(STACKUP_PRESETS).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
                <option value="custom">自定义叠层</option>
              </select>
              <p className="card-note">
                {Number.isFinite(stackup.hMm) &&
                Number.isFinite(stackup.tMm) &&
                Number.isFinite(stackup.er)
                  ? stackupSummary(stackup, system)
                  : '叠层参数无效，请切换预设或填写自定义值。'}
              </p>
            </div>

            <div className="card">
              <div className="card-title">MODE · 求解方向</div>
              <div className="imp-mode-toggle" role="group" aria-label="求解方向">
                <button
                  type="button"
                  className={mode === 'forward' ? 'active' : ''}
                  aria-pressed={mode === 'forward'}
                  onClick={() => setMode('forward')}
                >
                  已知线宽
                </button>
                <button
                  type="button"
                  className={mode === 'reverse' ? 'active' : ''}
                  aria-pressed={mode === 'reverse'}
                  onClick={() => setMode('reverse')}
                >
                  目标阻抗
                </button>
              </div>
              <p className="card-note">
                {mode === 'forward'
                  ? '正向计算 Z0；目标阻抗用于偏差提示。'
                  : '由目标阻抗反解线宽。'}
              </p>
            </div>

            <div className="card">
              <div className="card-title">MODELS · 一致性</div>
              <div className="scope-value">
                {summary.count}
                <span>models</span>
              </div>
              <div className="scope-status">
                <i className={`imp-dot ${tone}`} />
                {confidenceLabel(summary.confidence)}
              </div>
            </div>
          </section>

          {stackupId === 'custom' && (
            <section className="card editor-card imp-stackup-editor">
              <div className="card-title">CUSTOM · 自定义叠层</div>
              <div className="grid grid-3">
                <div className="field">
                  <label htmlFor="imp-h">介质厚度 h</label>
                  <div className="field-row">
                    <input
                      id="imp-h"
                      value={fields.h}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setField('h', e.target.value)}
                    />
                    <span className="uc-unit">{lengthUnit(system)}</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="imp-t">铜厚 t</label>
                  <div className="field-row">
                    <input
                      id="imp-t"
                      value={fields.t}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setField('t', e.target.value)}
                    />
                    <span className="uc-unit">{lengthUnit(system)}</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="imp-er">介电常数 εr</label>
                  <div className="field-row">
                    <input
                      id="imp-er"
                      value={fields.er}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setField('er', e.target.value)}
                    />
                    <span className="uc-unit">—</span>
                  </div>
                </div>
              </div>
              <p className="card-note">
                自定义叠层请以实际叠层报告为准；示例预设不代表板厂官方数据。
              </p>
            </section>
          )}

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 设计参数</span>
              <span className="section-note">单端微带线</span>
            </div>
            <div className="grid grid-3">
              {mode === 'forward' && (
                <div className="field">
                  <label htmlFor="imp-w">线宽 w</label>
                  <div className="field-row">
                    <input
                      id="imp-w"
                      value={w}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setW(e.target.value)}
                    />
                    <span className="uc-unit">{lengthUnit(system)}</span>
                  </div>
                </div>
              )}
              <div className="field">
                <label htmlFor="imp-target">目标阻抗 Z0</label>
                <div className="field-row">
                  <input
                    id="imp-target"
                    value={target}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                  <span className="uc-unit">Ω</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="imp-min">工厂最小线宽</label>
                <div className="field-row">
                  <input
                    id="imp-min"
                    value={minWidth}
                    inputMode="decimal"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setMinWidth(e.target.value)}
                  />
                  <span className="uc-unit">{lengthUnit(system)}</span>
                </div>
              </div>
            </div>
            {!paramsValid && <div className="error">请检查叠层、线宽、目标阻抗与最小线宽。</div>}
            {!widthOk && paramsValid && (
              <p className="action-note">当前线宽低于工厂最小线宽，请调整叠层或与板厂确认能力。</p>
            )}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 模型并列</span>
              <span className="section-note">不做单一公式平均</span>
            </div>
            <div
              className={
                tone === 'bad'
                  ? 'imp-consensus bad'
                  : tone === 'warn'
                    ? 'imp-consensus warn'
                    : 'imp-consensus ok'
              }
            >
              <b>{badgeLabel}</b>
              <span>
                {summary.count} / {summary.evaluations.length} 个模型适用
                {summary.spreadPct != null ? ` · 范围差 ${summary.spreadPct.toFixed(2)}%` : ''}
                {summary.spreadPct != null && summary.spreadPct > 8
                  ? ' · 建议用 2D 场解算或测试 coupon 复核'
                  : ''}
              </span>
            </div>
            <div className="imp-model-grid">
              {summary.evaluations.map((e) => {
                const modelValue =
                  e.applicable && mode === 'forward' && e.z0 != null
                    ? `${fmtNum(e.z0)} Ω`
                    : e.applicable && mode === 'reverse' && e.widthMm != null
                      ? formatLength(e.widthMm, system)
                      : '不适用';
                let delta = '';
                if (e.applicable) {
                  if (mode === 'forward' && e.z0 != null && Number.isFinite(targetOhm)) {
                    const pct = ((e.z0 - targetOhm) / targetOhm) * 100;
                    delta = `Δ目标 ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                  } else if (mode === 'reverse' && e.widthMm != null && summary.median != null) {
                    const pct = ((e.widthMm - summary.median) / summary.median) * 100;
                    delta = `Δ中位 ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                  }
                }
                return (
                  <div className={`imp-model ${e.applicable ? 'ok' : 'warn'}`} key={e.model.id}>
                    <div className="imp-model-head">
                      <i />
                      {e.model.name}
                    </div>
                    <div className="imp-model-standard">{e.model.standard}</div>
                    <div className="imp-model-value">{modelValue}</div>
                    {delta && <div className="imp-model-delta">{delta}</div>}
                    <div className="imp-model-note">{e.reason ?? e.model.note}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <details className="ref-block">
            <summary>模型、误差与限制</summary>
            <p className="action-note">
              本页使用 IPC-2141 与 Hammerstad–Jensen（含厚度修正）两种准静态模型并列计算。
              {mode === 'forward'
                ? ' 正向结果给出两种模型的 Z0 中位数和范围；范围差过大时不应盲目取中位数。'
                : ' 反向求解先由两种模型分别求线宽，再给出建议范围；线宽差异通常比阻抗差异更敏感。'}{' '}
              未计入阻焊、铜箔粗糙度、频变
              Dk/Df、差分/带状线、过孔与辐射效应；生产前必须用实际叠层、板厂阻抗 coupon 或 2D
              场解算器复核。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">多模型并列 · 适用域检查 · 不做单点“精确”承诺。</p>
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
