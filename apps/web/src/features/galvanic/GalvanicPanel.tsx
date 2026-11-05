import { useState } from 'react';
import { OutputDisplay } from '@/components/OutputDisplay';
import { fmtNum } from '@/lib/bridge';
import { useDraft, useDraftData } from '@/lib/draftStore';
import { useReport } from '@/lib/reportStore';
import { METALS, solveGalvanic, type Environment } from './galvanicSolver';

const ENV_LABEL: Record<Environment, string> = {
  controlled: '室内 / 受控',
  normal: '一般 / 户外遮蔽',
  harsh: '海洋 / 高湿',
};

const ENV_OPTIONS: { id: Environment; label: string }[] = [
  { id: 'controlled', label: '室内 / 受控' },
  { id: 'normal', label: '一般 / 户外遮蔽' },
  { id: 'harsh', label: '海洋 / 高湿' },
];

function GalvanicArt({ anode, cathode }: { anode: string; cathode: string }) {
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="电偶腐蚀示意">
      <rect x="46" y="28" width="26" height="64" className="f-box" />
      <rect x="228" y="28" width="26" height="64" className="f-box" />
      <line x1="30" y1="104" x2="270" y2="104" className="f-signal" />
      <text x="59" y="120" className="f-txt mono small" textAnchor="middle">
        阳极
      </text>
      <text x="241" y="120" className="f-txt mono small" textAnchor="middle">
        阴极
      </text>
      <text x="59" y="18" className="f-txt mono small" textAnchor="middle">
        {anode}
      </text>
      <text x="241" y="18" className="f-txt mono small" textAnchor="middle">
        {cathode}
      </text>
      <path d="M96 76 h106" className="f-signal" />
      <path d="M202 76 l-8 -5 v10 z" fill="var(--accent)" />
      <text x="150" y="66" className="f-txt mono small" textAnchor="middle">
        离子电流
      </text>
    </svg>
  );
}

interface GalvanicDraft {
  metalA: string;
  metalB: string;
  env: Environment;
}

const GALVANIC_ENVS: Environment[] = ['controlled', 'normal', 'harsh'];

export function GalvanicPanel({ group }: { group?: string }) {
  const draft = useDraftData<GalvanicDraft>('galvanic');
  const [metalA, setMetalA] = useState(() =>
    METALS.some((m) => m.id === draft?.metalA) ? draft!.metalA! : 'copper',
  );
  const [metalB, setMetalB] = useState(() =>
    METALS.some((m) => m.id === draft?.metalB) ? draft!.metalB! : 'aluminum',
  );
  const [env, setEnv] = useState<Environment>(() =>
    draft?.env && GALVANIC_ENVS.includes(draft.env) ? draft.env : 'normal',
  );

  useDraft('galvanic', { metalA, metalB, env });

  const r = solveGalvanic({ metalA, metalB, environment: env });
  const riskClass = r.risk === '低' ? 'ok' : r.risk === '中' ? 'warn' : 'bad';
  const recommendation =
    r.risk === '低'
      ? '按该环境可接受；仍建议避免长期电解液滞留。'
      : r.risk === '中'
        ? '需评估；建议隔离、镀层或选择更接近的金属。'
        : '高风险；避免直接接触，采用绝缘、镀层或牺牲阳极等防护。';

  const swap = () => {
    setMetalA(metalB);
    setMetalB(metalA);
  };

  const rows = [
    {
      label: '阳极（腐蚀侧）',
      note: `${r.anode.symbol} · 指数 ${fmtNum(r.anode.index)} V`,
      value: r.anode.name,
    },
    {
      label: '阴极（受保护侧）',
      note: `${r.cathode.symbol} · 指数 ${fmtNum(r.cathode.index)} V`,
      value: r.cathode.name,
    },
    { label: '阳极指数差', note: '|αA - αB|', value: `${fmtNum(r.difference)} V` },
    {
      label: '环境允许差值',
      note: ENV_LABEL[env],
      value: `${fmtNum(r.allowed)} V`,
    },
    { label: '风险等级', note: `${fmtNum(r.ratio)} × 允许值`, value: r.risk },
    { label: '建议', note: '工程参考', value: recommendation },
  ];

  useReport({
    id: 'galvanic',
    title: '电偶腐蚀',
    subtitle: `${r.metalA.name}（${r.metalA.symbol}） ↔ ${r.metalB.name}（${r.metalB.symbol}） · ${
      ENV_LABEL[env]
    }`,
    sections: [
      {
        title: '输入参数',
        rows: [
          { label: '金属 A', value: `${r.metalA.name}（${r.metalA.symbol}）` },
          { label: '金属 B', value: `${r.metalB.name}（${r.metalB.symbol}）` },
          { label: '环境', value: ENV_LABEL[env] },
        ],
      },
      { title: '评估结果', rows },
    ],
    assumptions: [
      '阳极指数为常用工程参考值，表面状态、镀层、介质与温度会改变实际电位差。',
      '环境允许差值：受控 0.60 V、一般 0.50 V、海洋 0.25 V。',
      '结果用于快速筛选，不能替代 ASTM G82、盐雾/浸泡试验或现场腐蚀评估。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '参考与规范'}</span>
          <h2>电偶腐蚀</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[{ label: '阳极指数差', value: fmtNum(r.difference), unit: 'V' }]}
            badge={<em className={`badge ${riskClass}`}>{r.risk}风险</em>}
            meta={
              <>
                {r.metalA.symbol} ↔ {r.metalB.symbol} · {ENV_LABEL[env]}
              </>
            }
            figure={<GalvanicArt anode={r.anode.symbol} cathode={r.cathode.symbol} />}
            caption="常用阳极指数参考；差值越大，电偶腐蚀风险越高。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">ENVIRONMENT · 环境</div>
              <select
                className="inp"
                value={env}
                onChange={(e) => setEnv(e.target.value as Environment)}
              >
                {ENV_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="card-note">环境越严苛，允许的阳极指数差越小。</p>
            </div>

            <div className="card">
              <div className="card-title">SCOPE · 允许差值</div>
              <div className="scope-value">
                {fmtNum(r.allowed)}
                <span>V</span>
              </div>
              <div className="scope-status">
                <i />
                {ENV_LABEL[env]}
              </div>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 风险</div>
              <div className="scope-value">
                {r.risk}
                <span>等级</span>
              </div>
              <div className="scope-status">
                <i />
                {fmtNum(r.ratio)} × 阈值
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 金属组合</span>
              <button className="btn" onClick={swap}>
                ⇄ 交换金属
              </button>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="gal-a">金属 A</label>
                <select
                  id="gal-a"
                  className="inp"
                  value={metalA}
                  onChange={(e) => setMetalA(e.target.value)}
                >
                  {METALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}（{m.symbol}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gal-b">金属 B</label>
                <select
                  id="gal-b"
                  className="inp"
                  value={metalB}
                  onChange={(e) => setMetalB(e.target.value)}
                >
                  {METALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}（{m.symbol}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {metalA === metalB && <p className="action-note">同种金属组合，不构成电偶对。</p>}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 评估结果</span>
              <span className="section-note">阳极指数法</span>
            </div>
            <div className="panel rf-panel">
              {rows.map((row) => (
                <div className="rf-row" key={row.label}>
                  <span className="rf-label">
                    <b>{row.label}</b>
                    <span>{row.note}</span>
                  </span>
                  <span className="rf-role" />
                  <span className="rf-value">{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 常用阳极指数（V）</span>
              <span className="section-note">参考值</span>
            </div>
            <div className="panel gal-table">
              <div className="gal-row head">
                <span>金属</span>
                <span>符号</span>
                <span>指数</span>
              </div>
              {METALS.map((m) => (
                <div
                  key={m.id}
                  className={`gal-row${m.id === metalA || m.id === metalB ? ' active' : ''}`}
                >
                  <span>{m.name}</span>
                  <span>{m.symbol}</span>
                  <span>{m.index.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>

          <details className="ref-block">
            <summary>数据与限制</summary>
            <p className="action-note">
              阳极指数为常用工程参考值，不同表面状态、镀层、介质与温度会改变实际电位差；环境允许差值取受控
              0.60 V、一般 0.50 V、海洋 0.25 V。结果用于快速筛选，不能替代 ASTM
              G82、盐雾/浸泡试验或现场腐蚀评估。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">阳极指数差值法 · 工程参考。</p>
            </div>
            <div className="actions-right">
              <button
                className="btn"
                onClick={() => {
                  setMetalA('copper');
                  setMetalB('aluminum');
                  setEnv('normal');
                }}
              >
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
