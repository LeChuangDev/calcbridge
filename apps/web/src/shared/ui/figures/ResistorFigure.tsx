export function ResistorFigure({ mode }: { mode: 'series' | 'parallel' | 'divider' }) {
  if (mode === 'parallel') {
    return (
      <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="并联电阻示意">
        <line x1="54" y1="52" x2="246" y2="52" className="f-signal" />
        <line x1="54" y1="126" x2="246" y2="126" className="f-signal" />
        <line x1="108" y1="52" x2="108" y2="66" className="f-signal" />
        <rect x="100" y="66" width="16" height="46" className="f-res" />
        <line x1="108" y1="112" x2="108" y2="126" className="f-signal" />
        <text x="124" y="94" className="f-txt">
          R1
        </text>
        <line x1="192" y1="52" x2="192" y2="66" className="f-signal" />
        <rect x="184" y="66" width="16" height="46" className="f-res" />
        <line x1="192" y1="112" x2="192" y2="126" className="f-signal" />
        <text x="208" y="94" className="f-txt">
          R2
        </text>
        <text x="54" y="42" className="f-txt">
          A
        </text>
        <text x="246" y="42" className="f-txt end">
          B
        </text>
      </svg>
    );
  }
  if (mode === 'divider') {
    return (
      <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="分压电阻示意">
        <text x="16" y="34" className="f-txt">
          VIN
        </text>
        <line x1="50" y1="30" x2="120" y2="30" className="f-signal" />
        <line x1="120" y1="30" x2="120" y2="50" className="f-signal" />
        <rect x="112" y="50" width="16" height="34" className="f-res" />
        <line x1="120" y1="84" x2="120" y2="100" className="f-signal" />
        <circle cx="120" cy="100" r="2.5" className="f-node" />
        <line x1="120" y1="100" x2="246" y2="100" className="f-signal" />
        <text x="252" y="104" className="f-txt">
          VOUT
        </text>
        <line x1="120" y1="100" x2="120" y2="112" className="f-signal" />
        <rect x="112" y="112" width="16" height="32" className="f-res" />
        <line x1="120" y1="144" x2="120" y2="152" className="f-signal" />
        <line x1="100" y1="152" x2="140" y2="152" className="f-ground" />
        <text x="140" y="71" className="f-txt">
          R1
        </text>
        <text x="140" y="133" className="f-txt">
          R2
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="串联电阻示意">
      <line x1="40" y1="80" x2="78" y2="80" className="f-signal" />
      <rect x="78" y="70" width="56" height="20" className="f-res" />
      <line x1="134" y1="80" x2="158" y2="80" className="f-signal" />
      <rect x="158" y="70" width="56" height="20" className="f-res" />
      <line x1="214" y1="80" x2="260" y2="80" className="f-signal" />
      <text x="106" y="60" className="f-txt mid">
        R1
      </text>
      <text x="186" y="60" className="f-txt mid">
        R2
      </text>
      <text x="40" y="64" className="f-txt">
        A
      </text>
      <text x="260" y="64" className="f-txt end">
        B
      </text>
      <text x="150" y="120" className="f-txt mid">
        Rs = R1 + R2
      </text>
    </svg>
  );
}
