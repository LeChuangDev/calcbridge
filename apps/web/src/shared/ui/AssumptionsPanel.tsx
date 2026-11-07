import type { CalcSpec } from '@calcbridge/core';

/* ── 假设清单（可折叠但不可隐藏） ──────────────────────── */

export function AssumptionsPanel({ spec }: { spec: CalcSpec }) {
  return (
    <details className="assumptions">
      <summary>假设清单（{spec.assumptions.length}）— 必须展示，可折叠</summary>
      <ul>
        {spec.assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </details>
  );
}
