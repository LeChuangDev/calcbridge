import { describe, expect, it } from 'vitest';
import {
  formatValidationMarkdown,
  parseImpedanceCsv,
  parseImpedanceJson,
  validateImpedanceDataset,
  type ImpedanceGoldenCase,
} from '../src/index';

const baseCase: ImpedanceGoldenCase = {
  id: 'smoke-54',
  source: 'published',
  sourceVersion: 'rounded design target',
  mode: 'z0',
  wMm: 0.3,
  hMm: 0.2,
  tMm: 0.035,
  er: 4.2,
  expected: 54,
  tolerancePct: 2,
  required: true,
};

describe('Polar/Sigrity 校验体系', () => {
  it('解析 JSON 数组和 cases 对象', () => {
    expect(parseImpedanceJson(JSON.stringify([baseCase]))[0]!.id).toBe('smoke-54');
    expect(parseImpedanceJson(JSON.stringify({ cases: [baseCase] }))).toHaveLength(1);
  });

  it('解析 CSV 并保留备注中的逗号', () => {
    const csv = [
      'id,source,source_version,date,mode,w_mm,h_mm,t_mm,er,target_ohm,expected,tolerance_pct,notes',
      'p1,polar,Si9000,2026-10-29,z0,0.3,0.2,0.035,4.2,,54,2,"叠层 A, 含阻焊"',
    ].join('\n');
    const cases = parseImpedanceCsv(csv);
    expect(cases[0]!.source).toBe('polar');
    expect(cases[0]!.notes).toBe('叠层 A, 含阻焊');
    expect(cases[0]!.expected).toBe(54);
  });

  it('逐模型计算误差、覆盖率和通过率', () => {
    const report = validateImpedanceDataset([baseCase]);
    expect(report.cases[0]!.status).toBe('pass');
    expect(report.modelSummaries).toHaveLength(2);
    expect(report.modelSummaries[0]!.applicableCases).toBe(1);
    expect(report.modelSummaries[0]!.meanAbsErrorPct).toBeLessThan(1);
    expect(report.modelSummaries[1]!.meanAbsErrorPct).toBeLessThan(2);
    expect(report.gate.passed).toBe(true);
    expect(report.gate.polarSigrityComplete).toBe(false);
  });

  it('失败案例会拉低通过率并阻断门槛', () => {
    const failing: ImpedanceGoldenCase = {
      ...baseCase,
      id: 'fail-60',
      expected: 60,
      tolerancePct: 1,
    };
    const report = validateImpedanceDataset([baseCase, failing]);
    expect(report.cases.find((c) => c.case.id === 'fail-60')!.status).toBe('fail');
    expect(report.gate.passed).toBe(false);
    expect(report.gate.reasons.length).toBeGreaterThan(0);
  });

  it('严格模式要求 Polar 与 Sigrity 数据都存在', () => {
    const report = validateImpedanceDataset([baseCase], { requirePolarSigrity: true });
    expect(report.gate.polarSigrityComplete).toBe(false);
    expect(report.gate.passed).toBe(false);

    const complete = validateImpedanceDataset(
      [
        baseCase,
        { ...baseCase, id: 'polar-1', source: 'polar' },
        { ...baseCase, id: 'sigrity-1', source: 'sigrity' },
      ],
      { requirePolarSigrity: true },
    );
    expect(complete.gate.polarSigrityComplete).toBe(true);
    expect(complete.gate.passed).toBe(true);
  });

  it('报告明确标注 Polar/Sigrity 数据待导入', () => {
    const md = formatValidationMarkdown(validateImpedanceDataset([baseCase]));
    expect(md).toContain('Polar/Sigrity 用例：0');
    expect(md).toContain('尚未导入完整');
    expect(md).toContain('不得用模型自身输出伪造对照数据');
  });
});
