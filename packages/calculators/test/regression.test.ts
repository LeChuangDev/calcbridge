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
    expect(r.checked).toBe(3);
    // 当前示例仅覆盖 2221 两模型；ipc2152 曲线待校准（pendingVerification），扩示例后会自动纳入跳过/断言
    expect(r.skipped.length).toBe(0);
  });
});
