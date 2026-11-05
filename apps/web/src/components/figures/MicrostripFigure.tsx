/* ── 图形表达式：截面 / 电路示意 ───────────────────────── */

export function MicrostripFigure({
  w = '—',
  h = '—',
  t = '—',
  er = '—',
}: {
  w?: string;
  h?: string;
  t?: string;
  er?: string;
}) {
  return (
    <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="微带线截面示意">
      <rect x="72" y="72" width="156" height="58" className="f-panel" />
      <line x1="60" y1="132" x2="240" y2="132" className="f-ground" />
      <rect x="112" y="63" width="76" height="9" className="f-copper" />

      <line x1="112" y1="46" x2="188" y2="46" className="f-dim" />
      <line x1="112" y1="42" x2="112" y2="50" className="f-dim" />
      <line x1="188" y1="42" x2="188" y2="50" className="f-dim" />
      <text x="150" y="36" className="f-txt mid">
        w {w} mm
      </text>

      <line x1="246" y1="72" x2="246" y2="130" className="f-dim" />
      <line x1="242" y1="72" x2="250" y2="72" className="f-dim" />
      <line x1="242" y1="130" x2="250" y2="130" className="f-dim" />
      <text x="254" y="105" className="f-txt">
        h {h} mm
      </text>

      <line x1="96" y1="63" x2="96" y2="72" className="f-dim" />
      <text x="92" y="58" className="f-txt end">
        t {t} mm
      </text>

      <text x="86" y="106" className="f-txt">
        εr {er}
      </text>
      <text x="60" y="152" className="f-txt">
        基材
      </text>
      <text x="240" y="152" className="f-txt end">
        参考地
      </text>
    </svg>
  );
}
