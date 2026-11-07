import { useState } from 'react';
import type { CalcSpec, ModelResult } from '@calcbridge/core';
import { compatibleUnits, convertDisplay, fmtNum } from '@/shared/lib/bridge';
import { VerdictBadge } from '@/shared/ui/VerdictBadge';

/* ── 单个模型结果卡 ───────────────────────────────────── */

export function ResultCard({ spec, r }: { spec: CalcSpec; r: ModelResult }) {
  const [dispUnits, setDispUnits] = useState<Record<string, string>>({});
  const model = spec.models.find((m) => m.id === r.modelId);
  return (
    <div className="result-card">
      <header>
        <strong>{r.modelName}</strong>
        <span
          className="standard"
          title={
            model?.pendingVerification
              ? '曲线/数据为近似值，待人工校准（数据等级 E），暂不参与安全判定'
              : r.standard
          }
        >
          {r.standard}
        </span>
        <VerdictBadge status={r.verdict.status} />
      </header>

      <div className="outputs">
        {Object.entries(r.outputs).map(([id, tv]) => {
          const vs = spec.variables.find((v) => v.id === id);
          const units = vs ? compatibleUnits(vs) : [];
          const to = dispUnits[id] ?? tv.unit;
          const shown = convertDisplay(tv.value, tv.unit, to);
          return (
            <div key={id} className="output-row">
              <span className="oid">{vs?.label ?? id}</span>
              <span className="ovalue">
                {fmtNum(shown)}{' '}
                {units.length > 1 ? (
                  <select
                    value={to}
                    onChange={(e) => setDispUnits((p) => ({ ...p, [id]: e.target.value }))}
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.symbol}
                      </option>
                    ))}
                  </select>
                ) : (
                  <em className="ou">{tv.unit}</em>
                )}
              </span>
              <span
                className={`grade g-${tv.grade.toLowerCase()}`}
                title={tv.confirmed ? '已确认' : '未确认（仅探索）'}
              >
                {tv.grade}
                {tv.confirmed ? '' : '*'}
              </span>
              {tv.source?.docId && (
                <span className="src" title={tv.source.clause ?? ''}>
                  {tv.source.docId}
                  {tv.source.clause ? ` §${tv.source.clause}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <details className="subst">
        <summary>数字代入行</summary>
        <pre>{r.substituted}</pre>
      </details>

      {r.verdict.conflicts.length > 0 && (
        <div className="conflicts">
          {r.verdict.conflicts.map((c) => (
            <div key={c.constraintId} className={`conflict ${c.level}`}>
              <b>{c.label ?? c.constraintId}</b>
              <code>
                {fmtNum(c.actual)} {c.op} {fmtNum(c.limit)}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
