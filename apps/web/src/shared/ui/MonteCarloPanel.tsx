import type { McStats } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';

/* ── 不确定度面板 ─────────────────────────────────────── */

export function MonteCarloPanel({ stats, running }: { stats: McStats | null; running: boolean }) {
  if (running) return <div className="mc-running">蒙特卡洛采样中…（2000 样本）</div>;
  if (!stats) return null;
  const max = Math.max(stats.p10, stats.p90);
  const bar = (v: number) => ({ width: `${((v / max) * 100).toFixed(1)}%` });
  return (
    <div className="mc">
      <div className="mc-row">
        <span>P10</span>
        <div className="bar">
          <i style={bar(stats.p10)} />
        </div>
        <code>{fmtNum(stats.p10)}</code>
      </div>
      <div className="mc-row">
        <span>P50</span>
        <div className="bar">
          <i className="mid" style={bar(stats.p50)} />
        </div>
        <code>{fmtNum(stats.p50)}</code>
      </div>
      <div className="mc-row">
        <span>P90</span>
        <div className="bar">
          <i className="hi" style={bar(stats.p90)} />
        </div>
        <code>{fmtNum(stats.p90)}</code>
      </div>
      <div className="sens">
        最敏感输入：
        {stats.topSensitivity.map((s, i) => (
          <span key={s.varId} className={`sens-item ${i === 0 ? 'top' : ''}`}>
            {s.varId} <em>ρ={s.rho.toFixed(3)}</em>
          </span>
        ))}
      </div>
    </div>
  );
}
