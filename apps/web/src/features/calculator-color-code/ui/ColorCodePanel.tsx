import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';
import {
  COLORS,
  DIGIT_COLORS,
  MULT_COLORS,
  MULT_LABEL,
  TOL_PREC,
  TOL_STD,
  colorById,
  decodeColorCode,
  type ColorDef,
} from '@calcbridge/calculators/color_code';

function ohmParts(v: number): { value: string; unit: string } {
  if (v >= 1e6) return { value: fmtNum(v / 1e6), unit: 'MΩ' };
  if (v >= 1e3) return { value: fmtNum(v / 1e3), unit: 'kΩ' };
  return { value: fmtNum(v), unit: 'Ω' };
}

function ohmText(v: number): string {
  const p = ohmParts(v);
  return `${p.value} ${p.unit}`;
}

/* ── 色环电阻示意图 ───────────────────────────────────── */

function ResistorArt({ bands, colors }: { bands: 4 | 5; colors: string[] }) {
  const xs = bands === 4 ? [112, 142, 172, 198] : [104, 126, 148, 176, 199];
  return (
    <svg viewBox="0 0 300 140" className="figure" role="img" aria-label="色环电阻示意">
      <line x1="20" y1="70" x2="90" y2="70" className="f-signal" />
      <line x1="210" y1="70" x2="280" y2="70" className="f-signal" />
      <rect x="86" y="42" width="128" height="56" rx="12" className="f-box" />
      {colors.slice(0, bands).map((hex, i) => (
        <rect
          key={i}
          x={xs[i]}
          y="42"
          width="10"
          height="56"
          fill={hex}
          stroke="#2d333b"
          strokeWidth="1"
        />
      ))}
      <text x="150" y="122" className="f-txt mid">
        {bands} 环
      </text>
    </svg>
  );
}

/* ── 单个色环选择 ─────────────────────────────────────── */

function ColorField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ColorDef[];
  onChange: (v: string) => void;
}) {
  const color = colorById(value);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-row">
        <span
          className="color-swatch"
          style={{ background: color.hex }}
          title={`${color.name} ${color.en}`}
        />
        <select
          className="inp color-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.en}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ── 色环电阻面板 ─────────────────────────────────────── */

interface ColorCodeDraft {
  bands: 4 | 5;
  filter: 'std' | 'prec';
  d1: string;
  d2: string;
  d3: string;
  mult: string;
  tol: string;
}

const isDigitColor = (id: unknown) => COLORS.some((c) => c.id === id && c.digit !== undefined);
const isMultColor = (id: unknown) => COLORS.some((c) => c.id === id && c.mult !== undefined);

export function ColorCodePanel({ group }: { group?: string }) {
  const draft = useDraftData<ColorCodeDraft>('color_code');
  const savedFilter = draft?.filter === 'prec' ? 'prec' : 'std';
  const savedTolList = savedFilter === 'std' ? TOL_STD : TOL_PREC;
  const savedTol =
    typeof draft?.tol === 'string' &&
    COLORS.some((c) => c.id === draft.tol && c.tol !== undefined) &&
    savedTolList.includes(draft.tol)
      ? draft.tol
      : savedTolList[0]!;

  const [bands, setBands] = useState<4 | 5>(() => (draft?.bands === 5 ? 5 : 4));
  const [filter, setFilter] = useState<'std' | 'prec'>(savedFilter);
  const [d1, setD1] = useState(() => (isDigitColor(draft?.d1) ? draft!.d1 : 'brown'));
  const [d2, setD2] = useState(() => (isDigitColor(draft?.d2) ? draft!.d2 : 'black'));
  const [d3, setD3] = useState(() => (isDigitColor(draft?.d3) ? draft!.d3 : 'black'));
  const [mult, setMult] = useState(() => (isMultColor(draft?.mult) ? draft!.mult : 'red'));
  const [tol, setTol] = useState(savedTol);

  useDraft('color_code', { bands, filter, d1, d2, d3, mult, tol });

  const c1 = colorById(d1);
  const c2 = colorById(d2);
  const c3 = colorById(d3);
  const cm = colorById(mult);
  const ct = colorById(tol);

  const decoded = decodeColorCode({ bands, d1, d2, d3, mult, tol });
  const { resistance, tolerancePct: tolPct, min, max } = decoded;
  const parts = ohmParts(resistance);

  const allowed = filter === 'std' ? TOL_STD : TOL_PREC;
  const tolOptions = COLORS.filter((c) => c.tol !== undefined && allowed.includes(c.id));

  const pickFilter = (f: 'std' | 'prec') => {
    setFilter(f);
    const list = f === 'std' ? TOL_STD : TOL_PREC;
    if (!list.includes(tol)) setTol(list[0]!);
  };

  const reset = () => {
    setBands(4);
    setFilter('std');
    setD1('brown');
    setD2('black');
    setD3('black');
    setMult('red');
    setTol('gold');
  };

  const bandNames = [c1.name, c2.name, bands === 5 ? c3.name : '', cm.name, ct.name]
    .filter(Boolean)
    .join(' ');
  const bandColors = [c1.hex, c2.hex, ...(bands === 5 ? [c3.hex] : []), cm.hex, ct.hex];

  useReport({
    id: 'color_code',
    title: '色环电阻',
    subtitle: `${bands} 环 · ${bandNames}`,
    sections: [
      {
        title: '输入参数',
        rows: [
          { label: '环数', value: `${bands} 环` },
          { label: '精度筛选', value: filter === 'std' ? '10% / 5%' : '≤ 2%' },
          { label: '色环顺序', value: bandNames },
        ],
      },
      {
        title: '计算结果',
        rows: [
          { label: '阻值', value: `${parts.value} ${parts.unit}` },
          { label: '精度', value: `±${fmtNum(tolPct)}%` },
          { label: '范围', value: `${ohmText(min)} ~ ${ohmText(max)}` },
        ],
      },
    ],
    assumptions: ['按 IEC 60062 色环编码解码，未考虑实际温漂与长期漂移。'],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '实用工具'}</span>
          <h2>色环电阻</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[{ label: '阻值', value: parts.value, unit: parts.unit }]}
            badge={<em className="badge">±{fmtNum(tolPct)}%</em>}
            meta={
              <>
                {bands} 环 · {bandNames} · 范围 {ohmText(min)} ~ {ohmText(max)}
              </>
            }
            figure={<ResistorArt bands={bands} colors={bandColors} />}
            caption={`色环顺序：${bands === 5 ? '第一~三环、乘数、精度' : '第一、二环、乘数、精度'}。`}
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">BAND · 环数</div>
              <select
                className="inp"
                value={bands}
                onChange={(e) => setBands(Number(e.target.value) as 4 | 5)}
              >
                <option value={4}>4 环</option>
                <option value={5}>5 环</option>
              </select>
              <p className="card-note">4 环为两位有效数字，5 环为三位。</p>
            </div>

            <div className="card">
              <div className="card-title">FILTER · 精度筛选</div>
              <select
                className="inp"
                value={filter}
                onChange={(e) => pickFilter(e.target.value as 'std' | 'prec')}
              >
                <option value="std">10% / 5%（常规）</option>
                <option value="prec">≤ 2%（精密）</option>
              </select>
              <p className="card-note">筛选精度环可选颜色与对照表高亮。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 阻值</div>
              <div className="scope-value">
                {parts.value}
                <span>{parts.unit}</span>
              </div>
              <div className="scope-status">
                <i />±{fmtNum(tolPct)}% · 实时计算
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 选择各环颜色</span>
            </div>
            <div className="grid">
              <ColorField label="第一环" value={d1} options={DIGIT_COLORS} onChange={setD1} />
              <ColorField label="第二环" value={d2} options={DIGIT_COLORS} onChange={setD2} />
              {bands === 5 && (
                <ColorField label="第三环" value={d3} options={DIGIT_COLORS} onChange={setD3} />
              )}
              <ColorField label="乘数" value={mult} options={MULT_COLORS} onChange={setMult} />
              <ColorField label="精度" value={tol} options={tolOptions} onChange={setTol} />
            </div>
          </section>

          <details className="ref-block" open>
            <summary>色环对照表（IEC 60062）</summary>
            <div className="ref-panel">
              <div className="ref-row head">
                <span>颜色</span>
                <span className="num">第一环</span>
                <span className="num">第二环</span>
                <span className="num">第三环</span>
                <span className="num">乘数</span>
                <span className="num">精度</span>
              </div>
              {COLORS.map((c) => {
                const isTol = c.tol !== undefined;
                const isOn = isTol && allowed.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`ref-row${isOn ? ' tol-ok' : isTol ? ' tol-off' : ''}`}
                  >
                    <span className="ref-color">
                      <i className="ref-swatch" style={{ background: c.hex }} />
                      <span>{c.name}</span>
                      <em className="ref-en">{c.en}</em>
                    </span>
                    <span className="num">{c.digit ?? '—'}</span>
                    <span className="num">{c.digit ?? '—'}</span>
                    <span className="num">{c.digit ?? '—'}</span>
                    <span className="num">
                      {c.mult !== undefined ? `×${MULT_LABEL[c.id]}` : '—'}
                    </span>
                    <span className="num tol">{isTol ? `±${fmtNum(c.tol!)}%` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">色环按 IEC 60062 编码；精度筛选会限制容差环。</p>
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
