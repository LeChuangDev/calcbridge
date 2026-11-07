export function RegulatorFigure() {
  return (
    <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="三端可调稳压器电路示意">
      <text x="16" y="48" className="f-txt">
        VIN
      </text>
      <line x1="50" y1="44" x2="78" y2="44" className="f-signal" />
      <circle cx="78" cy="44" r="2" className="f-node" />
      <rect x="78" y="26" width="102" height="38" className="f-box" />
      <text x="88" y="50" className="f-txt strong">
        REG
      </text>
      <line x1="180" y1="44" x2="262" y2="44" className="f-signal" />
      <circle cx="262" cy="44" r="2" className="f-node" />
      <text x="266" y="38" className="f-txt">
        VOUT
      </text>

      <line x1="130" y1="64" x2="130" y2="102" className="f-signal" />
      <line x1="130" y1="102" x2="230" y2="102" className="f-signal" />
      <line x1="230" y1="44" x2="230" y2="70" className="f-signal" />
      <rect x="222" y="70" width="16" height="24" className="f-res" />
      <text x="244" y="86" className="f-txt">
        R1
      </text>

      <line x1="130" y1="102" x2="130" y2="116" className="f-signal" />
      <rect x="122" y="116" width="16" height="22" className="f-res" />
      <line x1="130" y1="138" x2="130" y2="148" className="f-signal" />
      <line x1="112" y1="148" x2="148" y2="148" className="f-ground" />
      <text x="152" y="130" className="f-txt">
        R2
      </text>
      <text x="148" y="78" className="f-txt">
        ADJ
      </text>
    </svg>
  );
}
