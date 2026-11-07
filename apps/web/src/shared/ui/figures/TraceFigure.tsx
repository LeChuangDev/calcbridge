export function TraceFigure({
  I = '—',
  dT = '—',
  w = '—',
}: {
  I?: string;
  dT?: string;
  w?: string;
}) {
  return (
    <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="PCB 走线截面示意">
      <rect x="72" y="74" width="156" height="56" className="f-panel" />
      <line x1="60" y1="132" x2="240" y2="132" className="f-ground" />
      <rect x="110" y="64" width="80" height="10" className="f-copper" />
      <line x1="110" y1="46" x2="190" y2="46" className="f-dim" />
      <line x1="110" y1="42" x2="110" y2="50" className="f-dim" />
      <line x1="190" y1="42" x2="190" y2="50" className="f-dim" />
      <text x="150" y="36" className="f-txt mid">
        w {w} mm
      </text>
      <line x1="150" y1="150" x2="150" y2="118" className="f-signal" />
      <polygon points="150,112 145,122 155,122" className="f-copper" />
      <text x="156" y="146" className="f-txt">
        I {I} A
      </text>
      <text x="86" y="106" className="f-txt">
        ΔT {dT} K
      </text>
      <text x="60" y="152" className="f-txt">
        基材
      </text>
    </svg>
  );
}
