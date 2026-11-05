import { useCallback, useMemo, useRef, useState } from 'react';
import { runCalculation, type NamedInputs } from '@calcbridge/core';
import { REGULATOR_SPEC } from '@calcbridge/calculators';
import {
  BUILTIN_REGULATORS,
  MAX_REGULATOR_ENTRIES,
  MAX_REGULATOR_FILE_BYTES,
  downloadRegulatorsFile,
  loadCustomRegulators,
  normalizeRegulatorEntry,
  normalizeRegulatorList,
  parseRegulatorsFile,
  saveCustomRegulators,
  type RegulatorEntry,
} from '@/lib/regulatorData';
import { AssumptionsPanel } from '@/components/AssumptionsPanel';
import { OutputDisplay } from '@/components/OutputDisplay';
import { RegulatorFigure } from '@/components/figures/RegulatorFigure';
import { fmtNum } from '@/lib/bridge';
import { useDraft, useDraftData } from '@/lib/draftStore';
import { useReport } from '@/lib/reportStore';

/* ── 稳压器（三端可调）面板 ─────────────────────────────── */

type Cell = { min: string; typ: string; max: string };
type CellRow = 'R1' | 'R2' | 'Vout' | 'Vref' | 'Iadj';
type Col = 'min' | 'typ' | 'max';
type SolveFor = 'R1' | 'R2' | 'Vout';
interface RegResult {
  min: number;
  typ: number;
  max: number;
  spread: number | null;
}
interface RegulatorDraft {
  cells: Record<CellRow, Cell>;
  solveFor: SolveFor;
  regName: string;
  overallTol: string;
  rTol: string;
  remark: string;
}

/** 实时求解结果：'empty' = 必填项未齐（不提示错误），'error' = 输入不合法 */
type SolveOutcome =
  { status: 'empty' } | { status: 'ok'; result: RegResult } | { status: 'error'; error: string };

const CELL_ROWS: { id: CellRow; label: string; unit: string; selectable: boolean }[] = [
  { id: 'R1', label: 'R1', unit: 'kΩ', selectable: true },
  { id: 'R2', label: 'R2', unit: 'kΩ', selectable: true },
  { id: 'Vout', label: 'Vout', unit: 'V', selectable: true },
  { id: 'Vref', label: 'Vref', unit: 'V', selectable: false },
  { id: 'Iadj', label: 'Iadj', unit: 'µA', selectable: false },
];

function initialCells(): Record<CellRow, Cell> {
  return {
    R1: { min: '', typ: '0.24', max: '' },
    R2: { min: '', typ: '0.72', max: '' },
    Vout: { min: '', typ: '', max: '' },
    Vref: { min: '1.20', typ: '1.25', max: '1.30' },
    Iadj: { min: '50', typ: '50', max: '100' },
  };
}

function draftCells(saved: Record<CellRow, Cell> | undefined): Record<CellRow, Cell> {
  const init = initialCells();
  if (!saved) return init;
  for (const row of CELL_ROWS) {
    const c = saved[row.id];
    if (c && typeof c.min === 'string' && typeof c.typ === 'string' && typeof c.max === 'string') {
      init[row.id] = { min: c.min, typ: c.typ, max: c.max };
    }
  }
  return init;
}

function cellVal(cells: Record<CellRow, Cell>, row: CellRow, col: Col): number | undefined {
  const t = cells[row][col].trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** 该列取不到值时退回典型值 */
function cellOrTyp(cells: Record<CellRow, Cell>, row: CellRow, col: Col): number | undefined {
  return cellVal(cells, row, col) ?? cellVal(cells, row, 'typ');
}

export function RegulatorPanel({ group }: { group?: string }) {
  const draft = useDraftData<RegulatorDraft>(REGULATOR_SPEC.id);
  const [cells, setCells] = useState<Record<CellRow, Cell>>(() => draftCells(draft?.cells));
  const [solveFor, setSolveFor] = useState<SolveFor>(() =>
    draft?.solveFor === 'R1' || draft?.solveFor === 'R2' || draft?.solveFor === 'Vout'
      ? draft.solveFor
      : 'Vout',
  );
  const [regName, setRegName] = useState(() => {
    const saved = draft?.regName;
    const all = [...BUILTIN_REGULATORS, ...loadCustomRegulators()];
    return saved && all.some((r) => r.name === saved) ? saved : 'LM317';
  });
  const [customRegs, setCustomRegs] = useState<RegulatorEntry[]>(loadCustomRegulators);
  const [overallTol, setOverallTol] = useState(() =>
    typeof draft?.overallTol === 'string' ? draft.overallTol : '5',
  );
  const [rTol, setRTol] = useState(() => (typeof draft?.rTol === 'string' ? draft.rTol : '1'));
  const [remark, setRemark] = useState(() =>
    typeof draft?.remark === 'string' ? draft.remark : '',
  );
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dataFileName, setDataFileName] = useState('');
  const [dataMsg, setDataMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<null | {
    name: string;
    /** 编辑现有自定义项时的原名；新增或编辑内置项时为 null。 */
    originalName: string | null;
    vrefMin: string;
    vrefTyp: string;
    vrefMax: string;
    iadjMin: string;
    iadjTyp: string;
    iadjMax: string;
  }>(null);

  useDraft(REGULATOR_SPEC.id, {
    cells,
    solveFor,
    regName,
    overallTol,
    rTol,
    remark,
  });

  const allRegs = [...BUILTIN_REGULATORS, ...customRegs];
  const currentReg = allRegs.find((r) => r.name === regName) ?? BUILTIN_REGULATORS[0]!;

  const setCell = (row: CellRow, col: Col, v: string) =>
    setCells((p) => ({ ...p, [row]: { ...p[row], [col]: v } }));

  /** 求解所需的最小输入是否已填齐（未填齐时不报错，避免输入过程中刷错误） */
  const requiredReady = useMemo(() => {
    if (cellVal(cells, 'Vref', 'typ') === undefined) return false;
    if (cellVal(cells, 'Iadj', 'typ') === undefined) return false;
    if (solveFor !== 'Vout' && cellVal(cells, 'Vout', 'typ') === undefined) return false;
    for (const r of ['R1', 'R2'] as const) {
      if (r !== solveFor && cellVal(cells, r, 'typ') === undefined) return false;
    }
    return true;
  }, [cells, solveFor]);

  /** 按列求解选定量：返回该列输入/输出数值 */
  const solveColumn = useCallback(
    (col: Col, tolPct: number): number => {
      const vref = cellOrTyp(cells, 'Vref', col);
      const iadj = cellOrTyp(cells, 'Iadj', col);
      if (vref === undefined) throw new Error('请填写基准电压 Vref');
      if (iadj === undefined) throw new Error('请填写调整端电流 Iadj');

      const inputs: NamedInputs = { Vref: `${vref} V`, Iadj: `${iadj} uA` };
      if (solveFor !== 'Vout') {
        const vo = cellOrTyp(cells, 'Vout', col);
        if (vo === undefined) throw new Error('求解电阻需要填写目标输出电压 Vout');
        inputs.Vout = `${vo} V`;
      }
      for (const r of ['R1', 'R2'] as const) {
        if (r === solveFor) continue;
        let v = cellOrTyp(cells, r, col);
        if (v === undefined) throw new Error(`请填写 ${r}`);
        // 阻值精度容差：计算 Vout 时按最坏方向扩展电阻极值
        if (solveFor === 'Vout' && tolPct > 0 && col !== 'typ') {
          const sign = col === 'min' ? 1 : -1;
          v *= r === 'R1' ? 1 + (sign * tolPct) / 100 : 1 - (sign * tolPct) / 100;
        }
        inputs[r] = `${v} kohm`;
      }

      const run = runCalculation(REGULATOR_SPEC, inputs, {
        modelIds: ['three_terminal'],
        target: solveFor === 'Vout' ? undefined : solveFor,
      });
      return run.results[0]!.env[solveFor]!;
    },
    [cells, solveFor],
  );

  // 实时求解：输入变化即重算，不写回单元格（派生值只展示，不进状态）。
  const computed = useMemo<SolveOutcome>(() => {
    if (!requiredReady) return { status: 'empty' };
    const tol = Number(rTol);
    const rTolPct = Number.isFinite(tol) && tol > 0 ? tol : 0;
    try {
      const min = solveColumn('min', rTolPct);
      const typ = solveColumn('typ', 0);
      const max = solveColumn('max', rTolPct);
      if (!(typ > 0) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return { status: 'error', error: '计算结果无效，请检查输入' };
      }
      const spread =
        solveFor === 'Vout'
          ? (Math.max(Math.abs(max - typ), Math.abs(typ - min)) / typ) * 100
          : null;
      return { status: 'ok', result: { min, typ, max, spread } };
    } catch (e) {
      return { status: 'error', error: (e as Error).message };
    }
  }, [requiredReady, rTol, solveColumn, solveFor]);

  const result = computed.status === 'ok' ? computed.result : null;
  const solveError = computed.status === 'error' ? computed.error : null;

  const reset = () => {
    setCells(initialCells());
    setSolveFor('Vout');
    setRegName('LM317');
    setOverallTol('5');
    setRTol('1');
    setRemark('');
    setErr(null);
    setEditing(null);
    setDataFileName('');
    setDataMsg(null);
  };

  const applyRegValues = (entry: RegulatorEntry) => {
    setRegName(entry.name);
    setCells((p) => ({
      ...p,
      Vref: {
        min: entry.vrefMin !== undefined ? String(entry.vrefMin) : '',
        typ: String(entry.vrefTyp),
        max: entry.vrefMax !== undefined ? String(entry.vrefMax) : '',
      },
      Iadj: {
        min: entry.iadjMin !== undefined ? String(entry.iadjMin) : '',
        typ: String(entry.iadjTyp),
        max: entry.iadjMax !== undefined ? String(entry.iadjMax) : '',
      },
    }));
  };

  const applyReg = (name: string) => {
    const r = allRegs.find((x) => x.name === name);
    if (r) applyRegValues(r);
  };

  const saveEditing = () => {
    if (!editing) return;
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const result = normalizeRegulatorEntry({
      name: editing.name,
      vrefMin: num(editing.vrefMin),
      vrefTyp: num(editing.vrefTyp),
      vrefMax: num(editing.vrefMax),
      iadjMin: num(editing.iadjMin),
      iadjTyp: num(editing.iadjTyp),
      iadjMax: num(editing.iadjMax),
    });
    if (!result.ok) {
      setErr(`稳压器参数无效：${result.error}`);
      return;
    }

    const entry = result.entry;
    const next = [
      ...customRegs.filter((r) => r.name !== (editing.originalName ?? entry.name)),
      entry,
    ];
    const list = normalizeRegulatorList(next);
    if (!list.ok) {
      setErr(`稳压器参数无效：${list.error}`);
      return;
    }
    setCustomRegs(list.entries);
    saveCustomRegulators(list.entries);
    setEditing(null);
    setErr(null);
    applyRegValues(entry);
  };

  const removeReg = () => {
    if (!currentReg.custom) return;
    const next = customRegs.filter((r) => r.name !== currentReg.name);
    setCustomRegs(next);
    saveCustomRegulators(next);
    applyReg(BUILTIN_REGULATORS[0]!.name);
  };

  const importRegulatorData = async (file: File) => {
    setDataMsg(null);
    if (file.size > MAX_REGULATOR_FILE_BYTES) {
      setDataMsg({
        tone: 'bad',
        text: `数据文件超过 ${MAX_REGULATOR_FILE_BYTES / 1024} KB，已拒绝导入。`,
      });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setDataMsg({ tone: 'bad', text: '读取数据文件失败，请确认文件可访问。' });
      return;
    }
    const parsed = parseRegulatorsFile(text, file.name);
    if (!parsed.ok) {
      setDataMsg({ tone: 'bad', text: `导入失败：${parsed.error}` });
      return;
    }
    if (
      !window.confirm(
        `导入 ${parsed.entries.length} 个稳压器将替换当前 ${customRegs.length} 个自定义项，是否继续？`,
      )
    ) {
      return;
    }

    setCustomRegs(parsed.entries);
    saveCustomRegulators(parsed.entries);
    setDataFileName(file.name);
    setErr(null);
    applyRegValues(parsed.entries[0]!);
    setDataMsg({
      tone: 'ok',
      text: `已导入 ${parsed.entries.length} 个稳压器${
        parsed.warnings.length > 0 ? `（${parsed.warnings.join('；')}）` : ''
      }。`,
    });
  };

  const exportRegulatorData = (format: 'json' | 'csv') => {
    if (customRegs.length === 0) {
      setDataMsg({ tone: 'bad', text: '当前没有自定义稳压器可导出。' });
      return;
    }
    try {
      downloadRegulatorsFile(customRegs, format);
      setDataMsg({
        tone: 'ok',
        text: `已导出自定义稳压器 ${customRegs.length} 个（${format.toUpperCase()}）。`,
      });
    } catch {
      setDataMsg({ tone: 'bad', text: '导出失败：浏览器不允许下载文件。' });
    }
  };

  const copyResult = async () => {
    const solvedUnit = solveFor === 'Vout' ? 'V' : 'kΩ';
    const solvedLine = result
      ? `${solveFor} = ${fmtNum(result.typ)} ${solvedUnit}（最小 ${fmtNum(result.min)} / 最大 ${fmtNum(result.max)} ${solvedUnit}）`
      : `${solveFor} = 未计算`;
    const lines = [
      `稳压器：${regName}`,
      solvedLine,
      solveFor !== 'Vout' ? `目标 Vout = ${cells.Vout.typ.trim() || '—'} V` : '',
      `Vref = ${cells.Vref.typ || '—'} V，Iadj = ${cells.Iadj.typ || '—'} µA`,
      `R1 = ${cells.R1.typ || '—'} kΩ，R2 = ${cells.R2.typ || '—'} kΩ`,
      result?.spread != null
        ? `整体精度：±${result.spread.toFixed(2)}%${overallTol.trim() !== '' ? `（容差 ±${overallTol}%）` : ''}`
        : '',
      remark ? `备注：${remark}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr('复制失败：浏览器未授予剪贴板权限');
    }
  };

  const tolNum = Number(overallTol);
  const tolSet = overallTol.trim() !== '' && Number.isFinite(tolNum) && result?.spread != null;
  const overLimit = tolSet && result!.spread! > tolNum;

  const chooseSolve = (v: SolveFor) => {
    setSolveFor(v);
    setErr(null);
    if (v !== 'Vout') {
      setCells((p) => {
        if (p.Vout.typ.trim() !== '') return p;
        const seed = solveFor === 'Vout' && result ? fmtNum(result.typ) : '5';
        return { ...p, Vout: { min: '', typ: seed, max: '' } };
      });
    }
  };

  useReport({
    id: REGULATOR_SPEC.id,
    title: REGULATOR_SPEC.title,
    subtitle: `${regName} · 求解 ${solveFor}`,
    sections: [
      {
        title: '输入参数',
        rows: [
          { label: '稳压器型号', value: regName },
          ...CELL_ROWS.map((row) => ({
            label: `${row.label}（${row.unit}）`,
            value: `${cells[row.id].min || '—'} / ${cells[row.id].typ || '—'} / ${
              cells[row.id].max || '—'
            }`,
            note: '最小 / 典型 / 最大',
          })),
          {
            label: '求解目标',
            value: solveFor,
            note: solveFor === 'Vout' ? '目标输出电压' : '目标电阻值',
          },
          { label: '整体容差', value: overallTol ? `±${overallTol}%` : '—' },
          { label: '阻值容差', value: rTol ? `±${rTol}%` : '—' },
          { label: '备注', value: remark || '—' },
        ],
      },
      ...(result
        ? [
            {
              title: '计算结果',
              rows: [
                {
                  label: `${solveFor} 典型值`,
                  value: `${fmtNum(result.typ)} ${result.spread != null ? 'V' : 'kΩ'}`,
                },
                {
                  label: `${solveFor} 范围`,
                  value: `${fmtNum(result.min)} ~ ${fmtNum(result.max)} ${
                    result.spread != null ? 'V' : 'kΩ'
                  }`,
                  note:
                    result.spread != null ? `整体精度 ±${result.spread.toFixed(2)}%` : undefined,
                },
              ],
            },
          ]
        : []),
      ...(err ? [{ title: '校验', rows: [{ label: '错误', value: err }] }] : []),
    ],
    assumptions: REGULATOR_SPEC.assumptions,
  });

  return (
    <div className="calc-panel">
      <header className="calc-head">
        <div className="ch-main">
          {group && <span className="ch-kicker">{group}</span>}
          <h2>{REGULATOR_SPEC.title}</h2>
        </div>
        <span className="calc-ver">v{REGULATOR_SPEC.version}</span>
      </header>
      <div className="calc-body">
        <aside className="calc-side">
          <OutputDisplay
            items={[
              {
                label: solveFor,
                value: result ? fmtNum(result.typ) : '--',
                unit: result ? (result.spread != null ? 'V' : 'kΩ') : '',
              },
            ]}
            badge={
              result ? (
                <em
                  className={`badge ${
                    result.spread == null ? '' : overLimit ? 'bad' : tolSet ? 'ok' : ''
                  }`}
                >
                  {result.spread == null
                    ? '求解完成'
                    : overLimit
                      ? '超出容差'
                      : tolSet
                        ? '满足容差'
                        : '未设限'}
                </em>
              ) : undefined
            }
            meta={
              result
                ? `范围 ${fmtNum(result.min)} ~ ${fmtNum(result.max)} ${
                    result.spread != null ? 'V' : 'kΩ'
                  }${result.spread != null ? ` · 整体精度 ±${result.spread.toFixed(2)}%` : ''}`
                : requiredReady
                  ? '输入有误，见左侧提示。'
                  : '填写 Vref / Iadj / R1 / R2 后自动计算。'
            }
            figure={<RegulatorFigure />}
            caption="Vout = Vref × (1 + R2 / R1) + Iadj × R2"
          />
        </aside>
        <div className="calc-main">
          <section className="settings">
            <div className="card">
              <div className="card-title">MODEL · 稳压器型号</div>
              <select className="inp" value={regName} onChange={(e) => applyReg(e.target.value)}>
                {allRegs.map((r) => (
                  <option key={`${r.custom ? 'c' : 'b'}:${r.name}`} value={r.name}>
                    {r.name}
                    {r.custom ? '（自定义）' : ''}
                  </option>
                ))}
              </select>
              <div className="card-actions">
                <button
                  className="btn"
                  onClick={() => {
                    const r = currentReg;
                    setEditing({
                      name: r.custom ? r.name : `${r.name}-定制`,
                      originalName: r.custom ? r.name : null,
                      vrefMin: r.vrefMin !== undefined ? String(r.vrefMin) : '',
                      vrefTyp: String(r.vrefTyp),
                      vrefMax: r.vrefMax !== undefined ? String(r.vrefMax) : '',
                      iadjMin: r.iadjMin !== undefined ? String(r.iadjMin) : '',
                      iadjTyp: String(r.iadjTyp),
                      iadjMax: r.iadjMax !== undefined ? String(r.iadjMax) : '',
                    });
                  }}
                >
                  编辑
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setEditing({
                      name: '',
                      originalName: null,
                      vrefMin: '',
                      vrefTyp: '1.25',
                      vrefMax: '',
                      iadjMin: '',
                      iadjTyp: '50',
                      iadjMax: '',
                    })
                  }
                >
                  添加
                </button>
                <button className="btn" onClick={removeReg} disabled={!currentReg.custom}>
                  移除
                </button>
              </div>
              <p className="card-note">内置参数 + 浏览器本地存储。</p>
            </div>

            <div className="card">
              <div className="card-title">TRANSFER · 传递函数</div>
              <code className="card-formula">Vout = Vref × (1 + R2 / R1) + Iadj × R2</code>
              <p className="card-note">
                在右侧输出栏选择输出参数；求解 R1 / R2 时，Vout 行作为目标值。
              </p>
            </div>

            <div className="card">
              <div className="card-title">TOLERANCE · 精度容差</div>
              <div className="tol-row">
                <label htmlFor="tol-overall">整体容差</label>
                <div className="tol-field">
                  <input
                    id="tol-overall"
                    className="inp"
                    inputMode="decimal"
                    value={overallTol}
                    onChange={(e) => setOverallTol(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="—"
                  />
                  <span className="unit">%</span>
                </div>
              </div>
              <div className="tol-row">
                <label htmlFor="tol-res">阻值容差</label>
                <div className="tol-field">
                  <input
                    id="tol-res"
                    className="inp"
                    inputMode="decimal"
                    value={rTol}
                    onChange={(e) => setRTol(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="unit">%</span>
                </div>
              </div>
              <p className="card-note">用于判定整体误差与阻值展开。</p>
            </div>
          </section>

          <section className="card data-file-card">
            <div className="data-file-head">
              <div>
                <div className="card-title">DATA · 稳压器数据文件</div>
                <p className="card-note">
                  用 JSON / CSV 批量维护自定义型号；导入会替换当前自定义项，内置型号不可覆盖。
                </p>
              </div>
              <span className="data-file-badge" aria-hidden="true">
                JSON / CSV · ≤ 256 KB
              </span>
            </div>

            <div className="data-file-grid">
              <div className="data-file-picker">
                <label className="row-label" htmlFor="reg-data-file">
                  数据文件
                </label>
                <div className="file-control">
                  <input
                    id="reg-data-file"
                    className="inp"
                    value={dataFileName}
                    readOnly
                    placeholder="选择 JSON / CSV 参数文件"
                  />
                  <button className="btn primary" onClick={() => dataInputRef.current?.click()}>
                    浏览…
                  </button>
                </div>
              </div>
              <div className="data-file-actions">
                <button
                  className="btn"
                  onClick={() => exportRegulatorData('json')}
                  disabled={customRegs.length === 0}
                >
                  导出 JSON
                </button>
                <button
                  className="btn"
                  onClick={() => exportRegulatorData('csv')}
                  disabled={customRegs.length === 0}
                >
                  导出 CSV
                </button>
              </div>
            </div>

            <input
              ref={dataInputRef}
              type="file"
              accept=".json,.csv,.txt,application/json,text/csv"
              hidden
              onChange={(e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                input.value = '';
                if (file) void importRegulatorData(file);
              }}
            />

            <div className="data-file-foot">
              <span className="data-file-meta">
                自定义 {customRegs.length} / {MAX_REGULATOR_ENTRIES}
              </span>
              {dataMsg ? (
                <span className={`data-msg ${dataMsg.tone === 'bad' ? 'is-bad' : 'is-ok'}`}>
                  {dataMsg.text}
                </span>
              ) : (
                <span className="data-file-meta">必填列：name、vref_typ、iadj_typ</span>
              )}
            </div>
          </section>

          {editing && (
            <section className="card editor-card">
              <div className="card-title">CUSTOM · 自定义稳压器</div>
              <div className="reg-datarow">
                <label className="row-label">名称</label>
                <input
                  className="inp"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="如 LM317-定制"
                />
              </div>
              <div className="reg-datarow">
                <label className="row-label">Vref（最小 / 典型 / 最大）</label>
                <div className="triple">
                  <input
                    className="inp"
                    value={editing.vrefMin}
                    onChange={(e) => setEditing({ ...editing, vrefMin: e.target.value })}
                  />
                  <input
                    className="inp"
                    value={editing.vrefTyp}
                    onChange={(e) => setEditing({ ...editing, vrefTyp: e.target.value })}
                  />
                  <input
                    className="inp"
                    value={editing.vrefMax}
                    onChange={(e) => setEditing({ ...editing, vrefMax: e.target.value })}
                  />
                  <span className="unit">V</span>
                </div>
              </div>
              <div className="reg-datarow">
                <label className="row-label">Iadj（最小 / 典型 / 最大）</label>
                <div className="triple">
                  <input
                    className="inp"
                    value={editing.iadjMin}
                    onChange={(e) => setEditing({ ...editing, iadjMin: e.target.value })}
                  />
                  <input
                    className="inp"
                    value={editing.iadjTyp}
                    onChange={(e) => setEditing({ ...editing, iadjTyp: e.target.value })}
                  />
                  <input
                    className="inp"
                    value={editing.iadjMax}
                    onChange={(e) => setEditing({ ...editing, iadjMax: e.target.value })}
                  />
                  <span className="unit">µA</span>
                </div>
              </div>
              <div className="reg-actions">
                <button className="btn primary" onClick={saveEditing}>
                  保存
                </button>
                <button className="btn" onClick={() => setEditing(null)}>
                  取消
                </button>
              </div>
            </section>
          )}

          <section className="input-section">
            <div className="section-head">
              <span className="section-label">// 输入参数（最小 / 典型 / 最大）</span>
              <label className="output-picker">
                <span>输出参数</span>
                <select
                  className="inp"
                  value={solveFor}
                  onChange={(e) => chooseSolve(e.target.value as SolveFor)}
                >
                  <option value="Vout">Vout · 输出电压</option>
                  <option value="R1">R1 · 基准电阻</option>
                  <option value="R2">R2 · 调整电阻</option>
                </select>
              </label>
            </div>
            <div className="panel">
              <div className="trow thead">
                <span>参数</span>
                <span className="num">最小</span>
                <span className="num">典型</span>
                <span className="num">最大</span>
                <span className="num">单位</span>
              </div>
              {CELL_ROWS.map((row) => {
                const isTarget = solveFor === row.id;
                return (
                  <div key={row.id} className={`trow${isTarget ? ' sel' : ''}`}>
                    <span
                      className={`label${row.selectable && !isTarget ? ' pickable' : ''}`}
                      onClick={
                        row.selectable && !isTarget
                          ? () => chooseSolve(row.id as SolveFor)
                          : undefined
                      }
                      title={row.selectable && !isTarget ? '设为输出参数' : undefined}
                    >
                      {row.label}
                      {isTarget && <em className="tag solve">求解</em>}
                    </span>
                    {(['min', 'typ', 'max'] as Col[]).map((col) => (
                      <input
                        key={col}
                        className="inp"
                        inputMode="decimal"
                        value={isTarget ? (result ? fmtNum(result[col]) : '') : cells[row.id][col]}
                        placeholder={isTarget ? '自动' : ''}
                        disabled={isTarget}
                        readOnly={isTarget}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setCell(row.id, col, e.target.value)}
                      />
                    ))}
                    <span className="num unit-col">{row.unit}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {solveError && <div className="error">计算错误：{solveError}</div>}
          {err && <div className="error">{err}</div>}

          <div className="actions">
            <div className="actions-left">
              <div className="actions-line">
                <input
                  className="inp note"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="备注：负载 100 mA，输入 12 V"
                />
                <button className="btn" onClick={copyResult}>
                  {copied ? '已复制' : '复制结果'}
                </button>
              </div>
              <p className="action-note">
                输入即算，结果实时更新；所有结果为工程估算，非认证依据。
              </p>
            </div>
            <div className="actions-right">
              <button className="btn" onClick={reset}>
                重置默认
              </button>
            </div>
          </div>

          <AssumptionsPanel spec={REGULATOR_SPEC} />
        </div>
      </div>
    </div>
  );
}
