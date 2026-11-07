import type { VariableSpec } from '@calcbridge/core';
import { compatibleUnits, type InputState } from '@/shared/lib/bridge';

/* ── 输入字段（带单位切换） ─────────────────────────────── */

export function InputField(props: {
  id: string;
  vs: VariableSpec;
  st: InputState;
  onChange: (s: InputState) => void;
}) {
  const { id, vs, st, onChange } = props;
  const units = compatibleUnits(vs);
  return (
    <div className="field">
      <label htmlFor={`in-${id}`}>
        {vs.label ?? id}
        {vs.role === 'output' && <em className="tag out">输出量</em>}
        {vs.description && (
          <em className="tag hint" title={vs.description}>
            ?
          </em>
        )}
      </label>
      <div className="field-row">
        <input
          id={`in-${id}`}
          value={st.v}
          inputMode="decimal"
          placeholder={vs.default !== undefined ? String(vs.default) : '—'}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange({ ...st, v: e.target.value })}
        />
        {units.length > 1 ? (
          <select value={st.unit} onChange={(e) => onChange({ ...st, unit: e.target.value })}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.symbol}
              </option>
            ))}
          </select>
        ) : (
          <span className="uc-unit">{units[0]?.symbol ?? vs.unit}</span>
        )}
      </div>
    </div>
  );
}
