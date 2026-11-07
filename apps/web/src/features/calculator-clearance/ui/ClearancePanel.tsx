import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import {
  formatLength,
  formatLengthValue,
  lengthUnit,
  type UnitSystem,
} from '@/shared/lib/unitSystem';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  CLEARANCE_COLUMNS as COLUMNS,
  CLEARANCE_ROWS as ROWS,
} from '@calcbridge/calculators/clearance';

function ClearanceArt({ gap, system }: { gap: number; system: UnitSystem }) {
  return (
    <svg viewBox="0 0 300 140" className="figure" role="img" aria-label="电气间隙示意">
      <text x="40" y="32" className="f-txt">
        导体 A
      </text>
      <rect x="40" y="40" width="220" height="16" className="f-box" />
      <text x="40" y="124" className="f-txt">
        导体 B
      </text>
      <rect x="40" y="82" width="220" height="16" className="f-box" />
      <line x1="150" y1="56" x2="150" y2="82" className="f-dim" />
      <line x1="144" y1="56" x2="156" y2="56" className="f-dim" />
      <line x1="144" y1="82" x2="156" y2="82" className="f-dim" />
      <text x="162" y="74" className="f-txt mono">
        d = {formatLength(gap, system)}
      </text>
    </svg>
  );
}

interface ClearanceDraft {
  voltage: string;
  colId: string;
}

export function ClearancePanel({ group }: { group?: string }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<ClearanceDraft>('clearance');
  const [voltage, setVoltage] = useState(() =>
    typeof draft?.voltage === 'string' ? draft.voltage : '100',
  );
  const [colId, setColId] = useState(() =>
    COLUMNS.some((c) => c.id === draft?.colId) ? draft!.colId! : 'B1',
  );

  useDraft('clearance', { voltage, colId });

  const v = Number(voltage);
  const valid = voltage.trim() !== '' && Number.isFinite(v) && v > 0;
  const row = valid ? (ROWS.find((r) => v <= r.max) ?? ROWS[ROWS.length - 1]!) : null;
  const colIndex = Math.max(
    0,
    COLUMNS.findIndex((c) => c.id === colId),
  );
  const column = COLUMNS[colIndex]!;
  const gap = row ? row.values[colIndex]! : null;
  const beyond = valid && v > 500;

  const reset = () => {
    setVoltage('100');
    setColId('B1');
  };

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '工作电压', value: `${voltage} V` },
        { label: '导体类型', value: `${column.id} · ${column.short}`, note: column.desc },
      ],
    },
  ];
  if (gap != null && row) {
    reportSections.push({
      title: '计算结果',
      rows: [
        { label: '电压区间', value: row.label },
        {
          label: '最小电气间隙',
          value: formatLength(gap, system),
        },
      ],
    });
  }
  if (!valid)
    reportSections.push({ title: '校验', rows: [{ label: '错误', value: '工作电压无效' }] });

  useReport({
    id: 'clearance',
    title: '电气间隙（IPC-2221）',
    subtitle: `${column.id} · ${column.short}`,
    sections: reportSections,
    assumptions: [
      '数值来自 IPC-2221 最小电气间隙表；> 500 V 使用表中最后一行。',
      '实际设计应按完整标准、污染等级、海拔、涂层与实测复核。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? 'PCB 与高速'}</span>
          <h2>电气间隙（IPC-2221）</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              gap != null
                ? [
                    {
                      label: '最小间隙',
                      value: formatLengthValue(gap, system),
                      unit: lengthUnit(system),
                    },
                  ]
                : []
            }
            badge={<em className="badge">IPC-2221</em>}
            meta={
              gap != null && row ? (
                <>
                  {column.id} · {column.short} · {row.label}
                </>
              ) : (
                '输入工作电压后查表。'
              )
            }
            figure={
              gap != null ? (
                <ClearanceArt gap={gap} system={system} />
              ) : (
                <div className="figure-empty">输入电压</div>
              )
            }
            caption="表中数值为最小电气间隙；> 500 V 使用表中最后一行。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">CATEGORY · 导体类型</div>
              <select className="inp" value={colId} onChange={(e) => setColId(e.target.value)}>
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.short}
                  </option>
                ))}
              </select>
              <p className="card-note">按内部/外部导体与浸渍、海拔条件选择。</p>
            </div>

            <div className="card">
              <div className="card-title">STANDARD · 标准</div>
              <code className="card-formula">IPC-2221</code>
              <p className="card-note">印制板通用设计标准的最小电气间隙表。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 间隙</div>
              <div className="scope-value">
                {gap != null ? formatLengthValue(gap, system) : '—'}
                <span>{lengthUnit(system)}</span>
              </div>
              <div className="scope-status">
                <i />
                {row ? `${column.id} · ${row.label}` : '待输入电压'}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 工作电压</span>
              <span className="section-note">单位 V</span>
            </div>
            <div className="uc-input">
              <label htmlFor="clr-voltage">工作电压</label>
              <div className="field-row">
                <input
                  id="clr-voltage"
                  value={voltage}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setVoltage(e.target.value)}
                />
                <span className="uc-unit">V</span>
              </div>
            </div>
            {!valid && <div className="error">请输入大于 0 的工作电压。</div>}
            {beyond && (
              <p className="action-note">
                输入 &gt; 500 V，表中使用 &gt; 500 V 行；实际设计应按完整标准或实测复核。
              </p>
            )}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">
                // IPC-2221 最小电气间隙（{lengthUnit(system)}）
              </span>
              <span className="section-note">注：表中为最小值</span>
            </div>
            <div className="clr-table">
              <div className="clr-row head">
                <span>电压</span>
                {COLUMNS.map((c, i) => (
                  <span key={c.id} className={i === colIndex ? 'sel' : ''}>
                    {c.id}
                  </span>
                ))}
              </div>
              {ROWS.map((r) => {
                const active = row === r;
                return (
                  <div key={r.label} className={`clr-row${active ? ' active' : ''}`}>
                    <span className="clr-v">{r.label}</span>
                    {r.values.map((val, i) => (
                      <span
                        key={`${r.label}-${i}`}
                        className={active && i === colIndex ? 'sel' : ''}
                      >
                        {formatLengthValue(val, system)}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="clr-legend">
              {COLUMNS.map((c) => (
                <div key={c.id}>
                  <b>{c.id}</b> {c.desc}
                </div>
              ))}
            </div>
          </section>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">数值来自 IPC-2221 表；&gt; 500 V 使用最后一行。</p>
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
