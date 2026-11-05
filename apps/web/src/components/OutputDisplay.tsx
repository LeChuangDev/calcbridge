import { useState } from 'react';
import type { ReactNode } from 'react';

/* ── 输出显示 ─────────────────────────────────────────── */

export function OutputDisplay({
  items,
  badge,
  meta,
  figure,
  caption,
}: {
  items: { label: string; value: string; unit?: string }[];
  badge?: ReactNode;
  meta?: ReactNode;
  figure: ReactNode;
  caption: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copyOutput = async () => {
    const text = items
      .map((it) => `${it.label} = ${it.value}${it.unit ? ` ${it.unit}` : ''}`)
      .join(' · ');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时保持静默 */
    }
  };

  return (
    <section className="output-section">
      <div className="output-panel">
        <div className="output-head">
          <span className="card-title">输出显示</span>
          {badge}
          <button
            className="btn copy-btn"
            onClick={copyOutput}
            disabled={items.length === 0}
            title="复制当前输出数值"
          >
            {copied ? '已复制' : '复制数值'}
          </button>
        </div>
        <div className="output-pair">
          {items.length === 0 ? (
            <div className="output-item">
              <span className="output-label">结果</span>
              <div className="output-number muted">--</div>
            </div>
          ) : (
            items.map((it) => (
              <div key={it.label} className="output-item">
                <span className="output-label">{it.label}</span>
                <div className="output-number">
                  {it.value}
                  {it.unit ? <em>{it.unit}</em> : null}
                </div>
              </div>
            ))
          )}
        </div>
        {meta ? <div className="output-meta">{meta}</div> : null}
      </div>
      <div className="figure-panel">
        {figure}
        <p className="figure-caption">{caption}</p>
      </div>
    </section>
  );
}
