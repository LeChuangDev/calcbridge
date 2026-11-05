import { type CalcSpec } from '@calcbridge/core';
import { traceCurrentSpec } from './trace_current/spec';
import { impedanceMicrostripSpec } from './impedance_microstrip/spec';
import { BUCK_INDUCTOR_SPEC } from './buck_inductor/spec';
import { REGULATOR_SPEC } from './regulator/spec';
import { RESISTOR_SPEC } from './resistor/spec';

/** 计算器注册表：新计算器在此登记（UI 左侧树按分类自动列出） */
export const CALCULATOR_REGISTRY: Record<string, CalcSpec> = {
  [REGULATOR_SPEC.id]: REGULATOR_SPEC,
  [RESISTOR_SPEC.id]: RESISTOR_SPEC,
  [traceCurrentSpec.id]: traceCurrentSpec,
  [impedanceMicrostripSpec.id]: impedanceMicrostripSpec,
  [BUCK_INDUCTOR_SPEC.id]: BUCK_INDUCTOR_SPEC,
};

export function getCalculator(id: string): CalcSpec {
  const spec = CALCULATOR_REGISTRY[id];
  if (!spec)
    throw new Error(
      `未注册的计算器：${id}（可用：${Object.keys(CALCULATOR_REGISTRY).join(', ')}）`,
    );
  return spec;
}

export * from './trace_current/spec';
export * from './impedance_microstrip/spec';
export * from './buck_inductor/spec';
export * from './regulator/spec';
export * from './resistor/spec';
