/* ── 可行域徽标 ────────────────────────────────────────── */

export function VerdictBadge({
  status,
}: {
  status: 'manufacturable' | 'not-manufacturable' | 'boundary';
}) {
  const map = {
    manufacturable: ['可制造', 'ok'],
    'not-manufacturable': ['不可制造', 'bad'],
    boundary: ['边界/警告', 'warn'],
  } as const;
  const [label, cls] = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
