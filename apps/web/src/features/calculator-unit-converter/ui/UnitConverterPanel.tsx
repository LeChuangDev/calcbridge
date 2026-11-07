import { useState } from 'react';
import { OutputDisplay } from '@/shared/ui/OutputDisplay';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useReport } from '@/entities/report/model/reportStore';
import type { ReportSection } from '@/entities/report/model/report';
import {
  UNIT_CATEGORIES as CATEGORIES,
  convertUnit,
  type ConvCategory,
  type ConvUnit,
} from '@calcbridge/calculators/unit_converter';

/* ── 换算逻辑 ─────────────────────────────────────────── */

function UnitTable({
  category,
  from,
  value,
}: {
  category: ConvCategory;
  from: ConvUnit;
  value: number | null;
}) {
  return (
    <div className="unit-table">
      {category.units.map((u) => {
        const v = value != null ? convertUnit(value, from, u) : null;
        return (
          <div key={u.id} className={`unit-row${u.id === from.id ? ' base' : ''}`}>
            <span className="unit-sym">{u.symbol}</span>
            <span className="unit-name">{u.name}</span>
            <span className="unit-val">{v != null ? fmtNum(v) : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 单位换算面板 ─────────────────────────────────────── */

interface UnitDraft {
  catId: string;
  fromId: string;
  toId: string;
  value: string;
}

export function UnitConverterPanel({ group }: { group?: string }) {
  const draft = useDraftData<UnitDraft>('unit_converter');
  const initialCategory = CATEGORIES.find((c) => c.id === draft?.catId) ?? CATEGORIES[0]!;
  const [catId, setCatId] = useState(initialCategory.id);
  const [fromId, setFromId] = useState(() =>
    initialCategory.units.some((u) => u.id === draft?.fromId)
      ? draft!.fromId!
      : initialCategory.units[0]!.id,
  );
  const [toId, setToId] = useState(() =>
    initialCategory.units.some((u) => u.id === draft?.toId)
      ? draft!.toId!
      : (initialCategory.units[1] ?? initialCategory.units[0]!).id,
  );
  const [value, setValue] = useState(() => (typeof draft?.value === 'string' ? draft.value : '1'));

  useDraft('unit_converter', { catId, fromId, toId, value });

  const category = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]!;

  const from = category.units.find((u) => u.id === fromId) ?? category.units[0]!;
  const to = category.units.find((u) => u.id === toId) ?? category.units[1] ?? category.units[0]!;

  const num = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(num);
  const result = valid ? convertUnit(num, from, to) : null;

  const pickCategory = (id: string) => {
    const c = CATEGORIES.find((x) => x.id === id) ?? CATEGORIES[0]!;
    setCatId(c.id);
    setFromId(c.units[0]!.id);
    setToId((c.units[1] ?? c.units[0]!).id);
  };

  const swap = () => {
    setFromId(to.id);
    setToId(from.id);
  };

  const reset = () => {
    setCatId('length');
    setFromId('m');
    setToId('mm');
    setValue('1');
  };

  const reportSections: ReportSection[] = [
    {
      title: '输入参数',
      rows: [
        { label: '换算类别', value: category.label },
        { label: '源单位', value: `${from.name}（${from.symbol}）` },
        { label: '目标单位', value: `${to.name}（${to.symbol}）` },
        { label: '数值', value: `${value || '—'} ${from.symbol}` },
      ],
    },
    ...(result != null
      ? [
          {
            title: '计算结果',
            rows: [
              { label: '换算结果', value: `${fmtNum(result)} ${to.symbol}` },
              {
                label: '单位比例',
                value: `1 ${from.symbol} = ${fmtNum(convertUnit(1, from, to))} ${to.symbol}`,
              },
            ],
          },
          {
            title: '同类单位对照',
            rows: category.units.map((unit) => ({
              label: `${unit.name}（${unit.symbol}）`,
              value: valid ? fmtNum(convertUnit(num, from, unit)) : '—',
            })),
          },
        ]
      : [{ title: '校验', rows: [{ label: '错误', value: '输入数值无效' }] }]),
  ];

  useReport({
    id: 'unit_converter',
    title: '单位换算',
    subtitle: `${category.label} · ${from.symbol} → ${to.symbol}`,
    sections: reportSections,
    assumptions: ['十进制精确换算；温度按 °C / °F / K 偏移换算。'],
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          <span className="ch-kicker">{group ?? '实用工具'}</span>
          <h2>单位换算</h2>
        </div>
        <span className="calc-ver">v1.0.0</span>
      </header>
      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={
              result != null ? [{ label: '换算结果', value: fmtNum(result), unit: to.symbol }] : []
            }
            badge={result != null ? <em className="badge ok">实时换算</em> : undefined}
            meta={
              result != null ? (
                <>
                  1 {from.symbol} = {fmtNum(convertUnit(1, from, to))} {to.symbol} ·{' '}
                  {category.label}
                </>
              ) : (
                '输入有效数值后实时换算。'
              )
            }
            figure={<UnitTable category={category} from={from} value={valid ? num : null} />}
            caption="同类单位对照，按当前数值换算。"
          />
        </aside>

        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">CATEGORY · 换算类别</div>
              <select
                className="inp"
                value={category.id}
                onChange={(e) => pickCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="card">
              <div className="card-title">FROM · 源单位</div>
              <select className="inp" value={from.id} onChange={(e) => setFromId(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.symbol}）
                  </option>
                ))}
              </select>
            </div>
            <div className="card">
              <div className="card-title">TO · 目标单位</div>
              <select className="inp" value={to.id} onChange={(e) => setToId(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.symbol}）
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入数值</span>
              <button className="btn" onClick={swap}>
                ⇄ 交换单位
              </button>
            </div>
            <div className="uc-input">
              <label htmlFor="uc-value">数值</label>
              <div className="field-row">
                <input
                  id="uc-value"
                  value={value}
                  inputMode="decimal"
                  placeholder="1"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setValue(e.target.value)}
                />
                <span className="uc-unit">{from.symbol}</span>
              </div>
            </div>
          </section>

          <div className="actions">
            <div className="actions-left">
              <p className="action-note">十进制精确换算；温度按 °C / °F / K 偏移换算。</p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
