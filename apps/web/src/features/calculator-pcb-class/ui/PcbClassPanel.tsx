import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';

interface PcbClass {
  id: '1' | '2' | '3';
  name: string;
  summary: string;
  focus: string;
  usage: string;
}

const CLASSES: PcbClass[] = [
  {
    id: '1',
    name: '通用电子产品',
    summary: '以功能完整为基本要求，允许一定外观缺陷；适用于寿命与可靠性要求不高的产品。',
    focus: '功能、基本工艺与连接可靠性；外观缺陷限制较宽。',
    usage: '消费电子、普通家用、非关键设备。',
  },
  {
    id: '2',
    name: '专用服务电子产品',
    summary: '要求持续性能与较长寿命，允许有限外观缺陷；适用于通信、工业和仪器类产品。',
    focus: '功能可靠、工艺一致性、有限外观缺陷与可追溯性。',
    usage: '通信设备、工业控制、测试仪器。',
  },
  {
    id: '3',
    name: '高可靠性电子产品',
    summary: '连续高性能或关键任务产品，对外观、工艺与可靠性要求最严格。',
    focus: '高可靠、严格外观与工艺控制、完整可追溯性；关键任务不得中断。',
    usage: '医疗、航空航天、汽车安全、关键基础设施。',
  },
];

function PcbArt({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 300 150" className="figure" role="img" aria-label="PCB 层叠示意">
      <rect x="50" y="44" width="200" height="12" className="f-box" />
      <rect x="50" y="62" width="200" height="24" className="f-box" />
      <rect x="50" y="92" width="200" height="24" className="f-box" />
      <rect x="50" y="122" width="200" height="12" className="f-box" />
      <text x="150" y="80" className="f-txt mono small" textAnchor="middle">
        FR-4 / 铜箔
      </text>
      <text x="150" y="110" className="f-txt mono small" textAnchor="middle">
        Class {cls}
      </text>
    </svg>
  );
}

export function PcbClassPanel({ group }: { group?: string }) {
  const draft = useDraftData<{ cls: '1' | '2' | '3' }>('pcb_class');
  const [cls, setCls] = useState<'1' | '2' | '3'>(() =>
    draft?.cls === '1' || draft?.cls === '3' ? draft.cls : '2',
  );

  useDraft('pcb_class', { cls });

  const selected = CLASSES.find((c) => c.id === cls) ?? CLASSES[1]!;

  useReport({
    id: 'pcb_class',
    title: '电路板类别（IPC-6012）',
    subtitle: `Class ${cls} · ${selected.name}`,
    sections: [
      {
        title: '选择',
        rows: [
          { label: '性能类别', value: `Class ${cls}` },
          { label: '类别名称', value: selected.name },
        ],
      },
      {
        title: '类别要点',
        rows: [
          { label: '摘要', value: selected.summary },
          { label: '验收重点', value: selected.focus },
          { label: '典型应用', value: selected.usage },
        ],
      },
    ],
    assumptions: [
      '本页为 IPC-6012 性能类别概要参考。',
      '完整验收准则以 IPC-6012 最新版原文为准；类别不是板材分类。',
    ],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '参考与规范'}</span>
          <h2>电路板类别（IPC-6012）</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>

      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[{ label: '性能类别', value: cls, unit: 'Class' }]}
            badge={<em className="badge">IPC-6012</em>}
            meta={`${selected.name} · ${selected.focus}`}
            figure={<PcbArt cls={cls} />}
            caption="性能类别定义；完整验收准则以 IPC-6012 最新版为准。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">CLASS · 性能类别</div>
              <select
                className="inp"
                value={cls}
                onChange={(e) => setCls(e.target.value as '1' | '2' | '3')}
              >
                <option value="1">Class 1 · 通用</option>
                <option value="2">Class 2 · 专用服务</option>
                <option value="3">Class 3 · 高可靠</option>
              </select>
              <p className="card-note">按产品可靠性等级选择，不是板材阻燃等级。</p>
            </div>

            <div className="card">
              <div className="card-title">STANDARD · 标准</div>
              <code className="card-formula">IPC-6012</code>
              <p className="card-note">印制板性能类别；验收细则以标准原文为准。</p>
            </div>

            <div className="card">
              <div className="card-title">OUTPUT · 当前类别</div>
              <div className="scope-value">
                {cls}
                <span>Class</span>
              </div>
              <div className="scope-status">
                <i />
                {selected.name}
              </div>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 类别定义</span>
              <span className="section-note">点击选择</span>
            </div>
            <div className="pcb-class-grid">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  className={`pcb-class-card${c.id === cls ? ' active' : ''}`}
                  onClick={() => setCls(c.id)}
                >
                  <span className="cls">Class {c.id}</span>
                  <b>{c.name}</b>
                  <span>{c.summary}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 当前类别要点</span>
            </div>
            <div className="panel rf-panel">
              <div className="rf-row">
                <span className="rf-label">
                  <b>验收重点</b>
                  <span>Class {cls}</span>
                </span>
                <span className="rf-role">{selected.focus}</span>
                <span />
              </div>
              <div className="rf-row">
                <span className="rf-label">
                  <b>典型应用</b>
                  <span>Class {cls}</span>
                </span>
                <span className="rf-role">{selected.usage}</span>
                <span />
              </div>
            </div>
          </section>

          <details className="ref-block">
            <summary>说明</summary>
            <p className="action-note">
              本页为 IPC-6012 性能类别（Class
              1/2/3）的概要参考，帮助选择可靠性等级；具体验收限值、外观允收与测试要求请以 IPC-6012
              最新版原文为准。类别不是 FR-4/CEM 等板材分类，也不是 IPC-2221 电气间隙等级。
            </p>
          </details>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">IPC-6012 Class 1 / 2 / 3。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={() => setCls('2')}>
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
