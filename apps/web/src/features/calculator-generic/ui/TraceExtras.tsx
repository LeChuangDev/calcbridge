import { useLayoutEffect, useRef, useState } from 'react';
import type { ModelResult } from '@calcbridge/core';
import { fmtNum } from '@/shared/lib/bridge';
import { useDraft, useDraftData } from '@/entities/draft/model/draftStore';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import {
  areaUnit,
  convertLengthString,
  formatAreaValue,
  formatLengthValue,
  lengthUnit,
  toMillimetres,
  type UnitSystem,
} from '@/shared/lib/unitSystem';

import { MM_PER_OZ, computeTraceExtras } from '@calcbridge/calculators/trace_extras';

interface TraceExtrasDraft {
  length: string;
  rho: string;
  unitSystem?: UnitSystem;
}

export function TraceExtras({ results }: { results: ModelResult[] }) {
  const { system } = useUnitSystem();
  const draft = useDraftData<TraceExtrasDraft>('trace_current_extras');
  const savedSystem: UnitSystem = draft?.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const [length, setLength] = useState(() => {
    const saved = typeof draft?.length === 'string' ? draft.length : '20';
    return savedSystem === system ? saved : convertLengthString(saved, savedSystem, system);
  });
  const [rho, setRho] = useState(() => (typeof draft?.rho === 'string' ? draft.rho : '1.72e-8'));
  const previousSystem = useRef(system);

  useDraft('trace_current_extras', { length, rho, unitSystem: system });

  useLayoutEffect(() => {
    const previous = previousSystem.current;
    if (previous === system) return;
    setLength((value) => convertLengthString(value, previous, system));
    previousSystem.current = system;
  }, [system]);

  // env 中的数值已换算到变量的声明单位：I 为 A、cu 为 oz。
  // 逐模型读取，反向求解（如求 I / cu）时各模型的解可能不同。
  const lengthMm = toMillimetres(Number(length), lengthUnit(system));
  const rows = results
    .map((r) => {
      const width = r.outputs.w?.value;
      const currentA = r.env.I;
      const thicknessMm = r.env.cu != null ? r.env.cu * MM_PER_OZ : 0;
      if (width == null) return null;
      const ex = computeTraceExtras(width, thicknessMm, lengthMm, Number(rho), currentA);
      return ex ? { model: r.modelName, width, ...ex } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;

  return (
    <section className="input-section">
      <div className="section-head">
        <span className="section-label">// 走线电阻与压降</span>
        <span className="section-note">按当前模型线宽</span>
      </div>
      <div className="trace-extra-inputs">
        <div className="field">
          <label htmlFor="trace-length">走线长度</label>
          <div className="field-row">
            <input
              id="trace-length"
              value={length}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setLength(e.target.value)}
            />
            <span className="uc-unit">{lengthUnit(system)}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="trace-rho">铜电阻率</label>
          <div className="field-row">
            <input
              id="trace-rho"
              value={rho}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setRho(e.target.value)}
            />
            <span className="uc-unit">Ω·m</span>
          </div>
        </div>
      </div>
      <div className="panel trace-extra-table">
        <div className="trace-extra-row head">
          <span>模型</span>
          <span>线宽 / {lengthUnit(system)}</span>
          <span>面积 / {areaUnit(system)}</span>
          <span>电阻 / Ω</span>
          <span>压降 / V</span>
          <span>功耗 / W</span>
        </div>
        {rows.map((r) => (
          <div className="trace-extra-row" key={r.model}>
            <span className="trace-extra-model">{r.model}</span>
            <span>{formatLengthValue(r.width, system)}</span>
            <span>{formatAreaValue(r.areaMm2, system)}</span>
            <span>{fmtNum(r.resistance)}</span>
            <span>{fmtNum(r.drop)}</span>
            <span>{fmtNum(r.power)}</span>
          </div>
        ))}
      </div>
      <p className="action-note">面积 = 线宽 × 铜厚；R = ρL/A。铜厚按 1oz = 0.035 mm 换算。</p>
    </section>
  );
}
