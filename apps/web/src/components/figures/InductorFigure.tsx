export function InductorFigure({ L = '—', dI = '—' }: { L?: string; dI?: string }) {
  return (
    <svg viewBox="0 0 300 170" className="figure" role="img" aria-label="Buck 电感与电流纹波示意">
      <line x1="52" y1="58" x2="88" y2="58" className="f-signal" />
      <path
        d="M88 58 a15 14 0 0 1 30 0 a15 14 0 0 1 30 0 a15 14 0 0 1 30 0 a15 14 0 0 1 30 0"
        className="f-coil"
      />
      <line x1="208" y1="58" x2="246" y2="58" className="f-signal" />
      <text x="150" y="34" className="f-txt mid">
        L {L} µH
      </text>

      <line x1="70" y1="126" x2="230" y2="126" className="f-dim" />
      <path d="M70 126 L106 104 L142 126 L178 104 L214 126" className="f-signal" />
      <line x1="106" y1="104" x2="106" y2="126" className="f-dim" />
      <text x="238" y="112" className="f-txt">
        ΔI {dI} A
      </text>
      <text x="70" y="146" className="f-txt">
        开关周期
      </text>
    </svg>
  );
}
