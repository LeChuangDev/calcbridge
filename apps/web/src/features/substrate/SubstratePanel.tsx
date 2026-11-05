import { useState } from 'react';
import { OutputDisplay } from '@/components/OutputDisplay';
import { useDraft, useDraftData } from '@/lib/draftStore';
import { useReport } from '@/lib/reportStore';

/* ── 常见 PCB 板材分类（工程参考，非验收标准） ───────────── */

type SubstrateCategory = '刚性' | '复合' | '金属基' | '高频' | '陶瓷' | '柔性';

interface Substrate {
  id: string;
  name: string;
  category: SubstrateCategory;
  composition: string;
  tg: string;
  dk: string;
  df: string;
  thermal: string;
  cte: string;
  flame: string;
  usage: string;
  cost: '低' | '低–中' | '中' | '高' | '很高';
  note: string;
}

const CATEGORIES: ('全部' | SubstrateCategory)[] = [
  '全部',
  '刚性',
  '复合',
  '金属基',
  '高频',
  '陶瓷',
  '柔性',
];

const SUBSTRATES: Substrate[] = [
  {
    id: 'fr4',
    name: 'FR-4',
    category: '刚性',
    composition: '环氧树脂 + 玻璃纤维布',
    tg: '130–180 °C',
    dk: '4.2–4.8',
    df: '0.015–0.025',
    thermal: '0.2–0.4 W/(m·K)',
    cte: 'XY 13–17 ppm/°C；Z 50–70 ppm/°C',
    flame: 'UL94 V-0',
    usage: '通用单/双/多层板，数字与模拟电路',
    cost: '低',
    note: '最常见基材；普通 Tg 约 130–140 °C，无铅焊接或高温场景应选高 Tg 牌号。',
  },
  {
    id: 'fr4_htg',
    name: '高 Tg FR-4',
    category: '刚性',
    composition: '改性环氧树脂 + 玻璃纤维布',
    tg: '170–200 °C',
    dk: '4.2–4.8',
    df: '0.012–0.022',
    thermal: '0.25–0.45 W/(m·K)',
    cte: 'XY 12–16 ppm/°C；Z 45–60 ppm/°C',
    flame: 'UL94 V-0',
    usage: '无铅焊接、多层板、高可靠工业/汽车电子',
    cost: '中',
    note: 'Tg 提高后耐热与尺寸稳定性更好；具体 Tg、Td 与吸湿率按牌号确认。',
  },
  {
    id: 'cem1',
    name: 'CEM-1',
    category: '复合',
    composition: '环氧树脂 + 玻璃布面 + 纸芯',
    tg: '约 120–140 °C',
    dk: '4.5–5.0',
    df: '0.02–0.03',
    thermal: '0.2–0.3 W/(m·K)',
    cte: 'XY 15–20 ppm/°C；Z 50–70 ppm/°C',
    flame: 'UL94 V-0',
    usage: '低成本单面板、消费电子与简单电源板',
    cost: '低',
    note: '以纸芯降低成本，机械与耐湿性能通常低于 FR-4；不适合高可靠多层板。',
  },
  {
    id: 'cem3',
    name: 'CEM-3',
    category: '复合',
    composition: '环氧树脂 + 玻璃布面 + 玻璃毡芯',
    tg: '130–150 °C',
    dk: '4.3–4.8',
    df: '0.015–0.025',
    thermal: '0.2–0.35 W/(m·K)',
    cte: 'XY 14–18 ppm/°C；Z 50–70 ppm/°C',
    flame: 'UL94 V-0',
    usage: '双面板、FR-4 的低成本替代',
    cost: '低–中',
    note: '冲孔与平整度较好；高频、高可靠或厚多层结构仍优先 FR-4/高频材料。',
  },
  {
    id: 'aluminum',
    name: '铝基板',
    category: '金属基',
    composition: '铝基 + 绝缘介质层 + 铜箔',
    tg: '取决于介质层（通常 > 100 °C）',
    dk: '介质层约 4–6',
    df: '0.02–0.04',
    thermal: '整体约 1–3 W/(m·K)',
    cte: '铝约 23 ppm/°C（面向材料而定）',
    flame: 'UL94 V-0（按介质配方）',
    usage: 'LED 照明、电源、功率模块与散热要求高的板',
    cost: '中',
    note: '关键在绝缘介质层的耐压与导热；铝基厚度、介质厚度和铜厚需按热设计选型。',
  },
  {
    id: 'ptfe',
    name: '高频 PTFE',
    category: '高频',
    composition: 'PTFE + 玻纤/陶瓷填料 + 铜箔',
    tg: 'PTFE 熔点约 327 °C',
    dk: '2.2–3.5',
    df: '0.0009–0.002',
    thermal: '0.2–0.5 W/(m·K)',
    cte: '随配方差异较大，需查牌号',
    flame: '通常 V-0（按配方）',
    usage: '射频/微波、天线、毫米波与低损耗传输线',
    cost: '很高',
    note: 'Dk/Df 随频率与铜箔粗糙度变化；高频设计必须使用厂家叠层数据与场解算器复核。',
  },
  {
    id: 'ceramic',
    name: '陶瓷基板',
    category: '陶瓷',
    composition: 'Al₂O₃ / AlN 陶瓷 + 铜或银金属化',
    tg: '无机材料，无树脂 Tg',
    dk: '约 8–10（Al₂O₃）',
    df: '0.0005–0.002',
    thermal: '20–180 W/(m·K)，按陶瓷种类',
    cte: '约 4–8 ppm/°C',
    flame: '不燃',
    usage: '高功率 LED、IGBT、射频功率与高温封装',
    cost: '很高',
    note: '导热与耐温极佳，但脆性大、尺寸受限、金属化与共烧工艺复杂。',
  },
  {
    id: 'polyimide',
    name: '聚酰亚胺 PI',
    category: '柔性',
    composition: '聚酰亚胺薄膜 + 铜箔 + 覆盖层',
    tg: '250–400 °C',
    dk: '3.4–3.8',
    df: '0.01–0.02',
    thermal: '0.1–0.3 W/(m·K)',
    cte: '20–40 ppm/°C（按薄膜牌号）',
    flame: 'UL94 V-0',
    usage: 'FPC、刚挠结合板、轻薄/可弯折设备',
    cost: '高',
    note: '耐弯折与耐高温突出；动态弯折寿命、覆盖层与补强设计需按结构验证。',
  },
];

function SubstrateArt({ item }: { item: Substrate }) {
  const layers =
    item.category === '金属基'
      ? ['铜箔', '绝缘介质', '铝基']
      : item.category === '陶瓷'
        ? ['金属化', '陶瓷', '金属化']
        : ['铜箔', '介质', '芯材', '介质', '铜箔'];
  const h = 18;
  const gap = 6;
  const startY = 28;
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="PCB 板材层叠示意">
      {layers.map((layer, i) => (
        <g key={`${layer}-${i}`}>
          <rect
            x="56"
            y={startY + i * (h + gap)}
            width="188"
            height={h}
            className={i === 0 || i === layers.length - 1 ? 'f-copper' : 'f-box'}
            opacity={i === 0 || i === layers.length - 1 ? '0.9' : '1'}
          />
          <text
            x="150"
            y={startY + i * (h + gap) + 12}
            className="f-txt mono small"
            textAnchor="middle"
          >
            {layer}
          </text>
        </g>
      ))}
      <text x="252" y="76" className="f-txt mono small">
        {item.category}
      </text>
    </svg>
  );
}

interface SubstrateDraft {
  category: '全部' | SubstrateCategory;
  selectedId: string;
}

export function SubstratePanel({ group }: { group?: string }) {
  const draft = useDraftData<SubstrateDraft>('substrate');
  const initialCategory: '全部' | SubstrateCategory =
    draft?.category && CATEGORIES.includes(draft.category) ? draft.category : '全部';
  const initialList =
    initialCategory === '全部'
      ? SUBSTRATES
      : SUBSTRATES.filter((s) => s.category === initialCategory);
  const [category, setCategory] = useState<'全部' | SubstrateCategory>(initialCategory);
  const [selectedId, setSelectedId] = useState(() =>
    initialList.some((s) => s.id === draft?.selectedId) ? draft!.selectedId! : initialList[0]!.id,
  );

  useDraft('substrate', { category, selectedId });

  const list = category === '全部' ? SUBSTRATES : SUBSTRATES.filter((s) => s.category === category);
  const selected = SUBSTRATES.find((s) => s.id === selectedId) ?? SUBSTRATES[0]!;

  const pickCategory = (next: '全部' | SubstrateCategory) => {
    setCategory(next);
    const nextList = next === '全部' ? SUBSTRATES : SUBSTRATES.filter((s) => s.category === next);
    if (nextList.length > 0 && !nextList.some((s) => s.id === selectedId)) {
      setSelectedId(nextList[0]!.id);
    }
  };

  const rows = [
    { label: '典型组成', note: selected.category, value: selected.composition },
    { label: '耐热 / Tg', note: '树脂体系或熔点', value: selected.tg },
    { label: '介电常数 Dk', note: '典型范围', value: selected.dk },
    { label: '损耗因子 Df', note: '典型范围', value: selected.df },
    { label: '导热率', note: '典型范围', value: selected.thermal },
    { label: '热膨胀 CTE', note: '典型范围', value: selected.cte },
    { label: '阻燃等级', note: '按配方/牌号', value: selected.flame },
    { label: '典型用途', note: '工程参考', value: selected.usage },
    { label: '相对成本', note: '批量/工艺相关', value: selected.cost },
  ];

  useReport({
    id: 'substrate',
    title: 'PCB 板材分类',
    subtitle: `${selected.name} · ${selected.category}`,
    sections: [{ title: '当前板材', rows }],
    assumptions: [
      'Tg、Dk、Df、导热率与 CTE 为典型范围，随树脂体系、频率与厂家牌号变化。',
      '不可直接作为叠层设计或来料验收依据；实际选型请以厂家数据表与 IPC-4101 为准。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '参考与规范'}</span>
          <h2>PCB 板材分类</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[{ label: '当前板材', value: selected.name }]}
            badge={<em className="badge">{selected.category}</em>}
            meta={
              <>
                {selected.dk} Dk · {selected.thermal} · 耐热 {selected.tg}
              </>
            }
            figure={<SubstrateArt item={selected} />}
            caption="层叠示意；实际层数、铜厚与介质厚度按叠层设计。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">CATEGORY · 板材类别</div>
              <select
                className="inp"
                value={category}
                onChange={(e) => pickCategory(e.target.value as '全部' | SubstrateCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="card-note">按基材体系分类，不是 IPC-6012 性能等级。</p>
            </div>

            <div className="card">
              <div className="card-title">SCOPE · 数据口径</div>
              <code className="card-formula">典型范围</code>
              <p className="card-note">Dk/Df 随频率、树脂与铜箔粗糙度变化。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 当前板材</div>
              <div className="scope-value">
                {selected.name}
                <span>{selected.category}</span>
              </div>
              <div className="scope-status">
                <i />
                成本 {selected.cost}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 板材对照</span>
              <span className="section-note">点击行查看详情</span>
            </div>
            <div className="sub-table-wrap">
              <div className="sub-table">
                <div className="sub-row head">
                  <span>板材</span>
                  <span>类别</span>
                  <span className="num">Tg / 耐热</span>
                  <span className="num">Dk</span>
                  <span className="num">导热</span>
                  <span className="num">成本</span>
                </div>
                {list.map((s) => (
                  <button
                    key={s.id}
                    className={`sub-row${s.id === selectedId ? ' active' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className="sub-name">{s.name}</span>
                    <span>{s.category}</span>
                    <span className="num" title={s.tg}>
                      {s.tg}
                    </span>
                    <span className="num" title={s.dk}>
                      {s.dk}
                    </span>
                    <span className="num" title={s.thermal}>
                      {s.thermal}
                    </span>
                    <span className="num">{s.cost}</span>
                  </button>
                ))}
              </div>
            </div>
            {list.length === 0 && <div className="tree-empty">该类别暂无参考数据</div>}
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 当前板材详情</span>
              <span className="section-note">{selected.name}</span>
            </div>
            <div className="panel sub-detail-panel">
              {rows.map((r) => (
                <div className="sub-detail-row" key={r.label}>
                  <span className="sub-detail-label">
                    <b>{r.label}</b>
                    <span>{r.note}</span>
                  </span>
                  <span className="sub-detail-value">{r.value}</span>
                </div>
              ))}
            </div>
            <p className="action-note">{selected.note}</p>
          </section>

          <details className="ref-block">
            <summary>数据说明与限制</summary>
            <p className="action-note">
              本页为常见 PCB 基材的工程参考分类。Tg、Dk、Df、导热率与 CTE
              均为典型范围，随树脂体系、玻纤布、铜箔粗糙度、频率、温度与厂家牌号显著变化；不可直接作为叠层设计或来料验收依据。实际选型请以板材厂家数据表、叠层报告与
              IPC-4101 等适用标准为准。高频/高功率设计还应结合场解算、热仿真与样品验证。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">常见板材分类 · 工程参考。</p>
            </div>
            <div className="actions-right">
              <button
                className="btn"
                onClick={() => {
                  setCategory('全部');
                  setSelectedId('fr4');
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
