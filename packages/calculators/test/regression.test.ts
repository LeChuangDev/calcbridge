import { describe, expect, it } from 'vitest';
import { runSpecExamples, summarize } from '@calcbridge/core';
import { CALCULATOR_REGISTRY } from '../src';

describe('算例回归（FR-A-9：CI 阻断发布）', () => {
  it('全部计算器内置算例通过', () => {
    const results = Object.values(CALCULATOR_REGISTRY).map(runSpecExamples);
    const allPassed = results.every((r) => r.passed);
    console.log(summarize(results));
    expect(allPassed).toBe(true);
  });

  it('trace_current 校验数量与跳过项符合预期', () => {
    const r = runSpecExamples(CALCULATOR_REGISTRY.trace_current!);
    expect(r.checked).toBe(4);
    // IPC-2152 保守图已校准并纳入回归；当前无跳过项
    expect(r.skipped.length).toBe(0);
  });
});
