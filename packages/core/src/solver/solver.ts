/**
 * 求解器：正向计算 / 反向求解（FR-A-3）。
 *
 * 正向：已知全部输入，求输出。
 * 反向：指定任一变量为“待求量”，其余为已知量（含输出值），
 *      对目标变量做数值求根（二分），不写反向公式——工程公式大多单调，二分足够稳健。
 */
import { type EvalEnv, evalExpr } from '../expr/eval';
import { collectVars, parseExpr } from '../expr/parser';
import { traced, type Grade, type TracedValue } from '../provenance/traced';
import { type CalcSpec, type ModelSpec, type VariableSpec, varById } from '../spec/spec';
import { Quantity, fmtNum, parseQuantity } from '../unit/quantity';

export type NamedInputs = Record<string, Quantity | string | number>;

export interface SolveOptions {
  /** 只计算指定模型（默认全部） */
  modelIds?: string[];
  /** 反向求解目标变量 id */
  target?: string;
  /** 工艺/过程输入（叠加在 inputs 之后，约束与公式共用变量命名空间） */
  process?: NamedInputs;
  /** 安全相关标记：非确认数据参与时返回警告（B-5/C-3-1） */
  safetyRelevant?: boolean;
}

export interface ModelResult {
  modelId: string;
  modelName: string;
  standard: string;
  /** 输出变量 → 带证据链的结果值 */
  outputs: Record<string, TracedValue>;
  /** 所有变量（输入+输出）的最终数值（声明单位下），供约束/敏感度使用 */
  env: Record<string, number>;
  /** FR-A-10 数字代入行 */
  substituted: string;
  verdict: FeasibilityVerdict;
  warnings: string[];
}

export interface FeasibilityVerdict {
  status: 'manufacturable' | 'not-manufacturable' | 'boundary';
  conflicts: Array<{
    constraintId: string;
    op: string;
    lhs: string;
    rhs: string;
    actual: number;
    limit: number;
    level: 'info' | 'warning' | 'blocker';
    label?: string;
  }>;
}

export interface RunResult {
  spec: CalcSpec;
  results: ModelResult[];
  warnings: string[];
}

/** 把用户输入统一转成 Quantity */
export function toQuantity(v: Quantity | string | number): Quantity {
  if (v instanceof Quantity) return v;
  return parseQuantity(String(v));
}

function resolveInput(
  id: string,
  vs: VariableSpec,
  inputs: NamedInputs,
  process: NamedInputs,
): { q: Quantity; from: 'input' | 'process' | 'default' } {
  const raw = inputs[id] ?? process[id];
  if (raw !== undefined) {
    const q = toQuantity(raw);
    // FR-A-1：输入单位必须与声明单位量纲兼容
    const declared = requireUnitStrict(vs.unit);
    if (!q.isCompatibleWith(new Quantity(0, declared))) {
      throw new Error(`输入 ${id}=${q} 与声明单位 ${vs.unit} 量纲不兼容`);
    }
    // 变量可显式限制可用单位（如温升只允许 K，避免 °C 的绝对偏移被误用）。
    if (q.unit.id !== vs.unit && vs.units && !vs.units.includes(q.unit.id)) {
      throw new Error(
        `输入 ${id} 不允许使用单位 ${q.unit.symbol}；可用单位：${[vs.unit, ...vs.units].join(', ')}`,
      );
    }
    return { q: q.to(vs.unit), from: raw === inputs[id] ? 'input' : 'process' };
  }
  if (vs.default !== undefined) return { q: new Quantity(vs.default, vs.unit), from: 'default' };
  throw new Error(`缺少输入：${id}（单位 ${vs.unit}）`);
}

import { getUnit } from '../unit/dimensions';
function requireUnitStrict(unit: string) {
  const u = getUnit(unit);
  if (!u) throw new Error(`计算器声明了未知单位：${unit}`);
  return u;
}

function buildEvalEnv(spec: CalcSpec, model: ModelSpec, env: Record<string, number>): EvalEnv {
  return { values: env, curves: model.curves };
}

function splitExpr(expr: string): { output: string; body: string } {
  const eq = expr.indexOf('=');
  if (eq < 0) throw new Error(`模型表达式必须形如 "输出 = 表达式"：${expr}`);
  return { output: expr.slice(0, eq).trim(), body: expr.slice(eq + 1).trim() };
}

/** 模型输出键列表：exprs 的键，或单输出 expr 的左侧 */
export function outputKeys(model: ModelSpec): string[] {
  if (model.exprs) return Object.keys(model.exprs);
  return [splitExpr(model.expr!).output];
}

/** 主输出 id：primary 显式指定，否则取 exprs 首键 或 expr 左侧（反向求解/不确定度追踪用） */
export function primaryOutput(model: ModelSpec): string {
  if (model.primary) return model.primary;
  if (model.exprs) return Object.keys(model.exprs)[0];
  return splitExpr(model.expr!).output;
}

/** 按序求值全部表达式（后序可引用先序输出），返回含全部输出的完整 env */
function evalExprs(
  spec: CalcSpec,
  model: ModelSpec,
  bodies: Record<string, string>,
  env: Record<string, number>,
): Record<string, number> {
  const full = { ...env };
  for (const [k, body] of Object.entries(bodies)) {
    full[k] = evalExpr(parseExpr(body), buildEvalEnv(spec, model, full));
  }
  return full;
}

/** 正向求解单个模型 */
export function solveForward(
  spec: CalcSpec,
  model: ModelSpec,
  inputs: NamedInputs,
  process: NamedInputs = {},
): { env: Record<string, number>; output: string } {
  if (model.exprs) {
    const env: Record<string, number> = {};
    for (const [k, body] of Object.entries(model.exprs)) {
      const used = collectVars(parseExpr(body));
      for (const id of used) {
        if (env[id] !== undefined) continue;
        const vs = varById(spec, id);
        const { q } = resolveInput(id, vs, inputs, process);
        env[id] = q.value;
      }
      env[k] = evalExpr(parseExpr(body), buildEvalEnv(spec, model, env));
    }
    return { env, output: primaryOutput(model) };
  }
  const { output, body } = splitExpr(model.expr!);
  const ast = parseExpr(body);
  const used = collectVars(ast);
  const env: Record<string, number> = {};
  for (const id of used) {
    const vs = varById(spec, id);
    const { q } = resolveInput(id, vs, inputs, process);
    env[id] = q.value;
  }
  const outVal = evalExpr(ast, buildEvalEnv(spec, model, env));
  env[output] = outVal;
  return { env, output };
}

/** 反向求解：目标变量待求，主输出值由 inputs 提供 */
export function solveBackward(
  spec: CalcSpec,
  model: ModelSpec,
  targetId: string,
  inputs: NamedInputs,
  process: NamedInputs = {},
  opts: { maxIter?: number; tol?: number } = {},
): { env: Record<string, number>; output: string } {
  const outId = primaryOutput(model);
  const bodies: Record<string, string> = model.exprs ?? { [outId]: splitExpr(model.expr!).body };

  // 全部表达式引用到的变量（不含输出键）
  const used = new Set<string>();
  for (const body of Object.values(bodies)) {
    for (const v of collectVars(parseExpr(body))) used.add(v);
  }
  if (bodies[targetId] !== undefined) {
    throw new Error(`目标变量 ${targetId} 是输出量，不能作为反向求解目标`);
  }
  if (!used.has(targetId))
    throw new Error(`目标变量 ${targetId} 未出现在模型 ${model.id} 的表达式中`);

  const outVs = varById(spec, outId);
  const outQ = resolveInput(outId, outVs, inputs, process).q;
  const targetVs = varById(spec, targetId);
  const outVal = outQ.value;

  // 固定其余变量（输出键为中间量，由求值产生，不要求输入）
  const env: Record<string, number> = {};
  for (const id of used) {
    if (id === targetId || bodies[id] !== undefined) continue;
    const vs = varById(spec, id);
    const { q } = resolveInput(id, vs, inputs, process);
    env[id] = q.value;
  }

  const f = (x: number): number => {
    const e = { ...env, [targetId]: x };
    return evalExprs(spec, model, bodies, e)[outId] - outVal;
  };
  const finish = (x: number): { env: Record<string, number>; output: string } => {
    const full = evalExprs(spec, model, bodies, { ...env, [targetId]: x });
    return { env: { ...full, [outId]: outVal }, output: outId };
  };

  // 搜索区间：优先用变量 domain，否则自动扩张
  const lo0 = targetVs.domain?.min ?? 1e-9;
  const hi0 = targetVs.domain?.max ?? 1e6;
  let lo = lo0;
  let hi = hi0;
  const maxIter = opts.maxIter ?? 200;
  const tol = opts.tol ?? 1e-10;

  let flo = f(lo);
  let fhi = f(hi);
  if (Math.abs(flo) < tol) return finish(lo);
  if (Math.abs(fhi) < tol) return finish(hi);
  if (flo * fhi > 0) {
    // 自动扩张搜索范围
    let factor = 10;
    while (flo * fhi > 0 && factor < 1e12) {
      lo = lo0 / factor;
      hi = hi0 * factor;
      flo = f(lo);
      fhi = f(hi);
      factor *= 10;
    }
    if (flo * fhi > 0) {
      throw new Error(
        `反向求解失败：${targetId} 在 [${lo}, ${hi}] 内函数不穿越零点（检查输入是否矛盾）`,
      );
    }
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < tol || hi - lo < tol * Math.max(1, Math.abs(mid))) {
      return finish(mid);
    }
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  throw new Error(`反向求解未收敛：${targetId}`);
}

/** 可行域判定（FR-A-8）：输出“可制造/不可制造/边界”并列出冲突项 */
export function evaluateFeasibility(
  spec: CalcSpec,
  model: ModelSpec,
  env: Record<string, number>,
): FeasibilityVerdict {
  const conflicts: FeasibilityVerdict['conflicts'] = [];
  const eps = 1e-9;
  for (const c of spec.constraints) {
    const lhsVal = evaluateConstraintSide(c.lhs, spec, env);
    const rhsVal = evaluateConstraintSide(c.rhs, spec, env);
    let violated: boolean;
    switch (c.op) {
      case 'le':
        violated = lhsVal > rhsVal + eps;
        break;
      case 'ge':
        violated = lhsVal < rhsVal - eps;
        break;
      case 'lt':
        violated = lhsVal >= rhsVal - eps;
        break;
      case 'gt':
        violated = lhsVal <= rhsVal + eps;
        break;
    }
    if (violated) {
      conflicts.push({
        constraintId: c.id,
        op: c.op,
        lhs: c.lhs,
        rhs: c.rhs,
        actual: lhsVal,
        limit: rhsVal,
        level: c.level,
        label: c.label,
      });
    }
  }
  const blockers = conflicts.filter((c) => c.level === 'blocker');
  const warnings = conflicts.filter((c) => c.level === 'warning');
  let status: FeasibilityVerdict['status'] = 'manufacturable';
  if (blockers.length > 0) status = 'not-manufacturable';
  else if (warnings.length > 0) status = 'boundary';
  return { status, conflicts };
}

/** 约束表达式求值：支持变量 id 或直接数值；数值视为变量声明单位下的常数 */
function evaluateConstraintSide(side: string, spec: CalcSpec, env: Record<string, number>): number {
  const trimmed = side.trim();
  const vs = spec.variables.find((v) => v.id === trimmed);
  if (vs) return env[vs.id] ?? vs.default ?? 0;
  // 支持简单表达式（含变量）
  const ast = parseExpr(trimmed);
  return evalExpr(ast, { values: env });
}

/** 约束变量（如工艺档案 min_width、目标阻抗 z0_target）不出现在模型表达式中，需从输入解析后并入 env（FR-D-3） */
function withConstraintVars(
  spec: CalcSpec,
  env: Record<string, number>,
  inputs: NamedInputs,
  process: NamedInputs,
): Record<string, number> {
  const full = { ...env };
  for (const c of spec.constraints) {
    for (const side of [c.lhs, c.rhs]) {
      let ids: Iterable<string>;
      try {
        ids = collectVars(parseExpr(side));
      } catch {
        continue; // 纯数值侧，无需解析
      }
      for (const vid of ids) {
        if (full[vid] !== undefined) continue;
        const vs = spec.variables.find((v) => v.id === vid);
        if (!vs) continue;
        try {
          const { q } = resolveInput(vid, vs, inputs, process);
          full[vid] = q.value;
        } catch {
          // 约束侧变量不可解时保留缺省，由约束求值兜底
        }
      }
    }
  }
  return full;
}

/** 主入口：按 options 求解全部模型 */
export function runCalculation(
  spec: CalcSpec,
  inputs: NamedInputs,
  options: SolveOptions = {},
): RunResult {
  const process = options.process ?? {};
  const results: ModelResult[] = [];
  const runWarnings: string[] = [];

  for (const model of spec.models) {
    if (options.modelIds && !options.modelIds.includes(model.id)) continue;

    let env: Record<string, number>;
    if (options.target) {
      const solved = solveBackward(spec, model, options.target, inputs, process);
      env = solved.env;
    } else {
      const solved = solveForward(spec, model, inputs, process);
      env = solved.env;
    }

    const outKeysArr = outputKeys(model);
    const outId = primaryOutput(model);
    const outputs: Record<string, TracedValue> = {};
    for (const k of outKeysArr) {
      const vs = varById(spec, k);
      outputs[k] = traced(env[k], vs.unit, {
        grade: 'D',
        confirmed: true,
        source: model.source ?? { kind: 'standard', docId: model.standard, clause: model.clause },
        note: `按 ${model.standard}${model.clause ? ` 条款 ${model.clause}` : ''} 计算`,
      });
    }
    // 反向求解时把目标变量也输出
    if (options.target && options.target !== outId) {
      const tvs = varById(spec, options.target);
      outputs[options.target] = traced(env[options.target], tvs.unit, {
        grade: 'E',
        confirmed: false,
        note: '反向求解所得，需结合器件手册确认',
      });
    }

    const verdict = evaluateFeasibility(
      spec,
      model,
      withConstraintVars(spec, env, inputs, process),
    );

    // 安全相关警告（B-5/C-3-1）：由调用方在输入层完成可信度检查（warnIfUnsafe）
    const warnings: string[] = [];
    if (verdict.status === 'not-manufacturable') {
      warnings.push(`模型 ${model.id}：不可制造，冲突项 ${verdict.conflicts.length} 个`);
    }

    const substituted = model.exprs
      ? Object.entries(model.exprs)
          .map(([k, body]) => `${k} = ${substitute(body, env)}`)
          .join('；')
      : `${outId} = ${substitute(splitExpr(model.expr!).body, env)}`;

    results.push({
      modelId: model.id,
      modelName: model.name,
      standard: model.standard,
      outputs,
      env,
      substituted,
      verdict,
      warnings,
    });
  }
  return { spec, results, warnings: runWarnings };
}

import { substituteExpr } from '../expr/eval';
function substitute(body: string, env: Record<string, number>): string {
  return substituteExpr(parseExpr(body), env);
}

/** 输出便捷格式化 */
export function formatResult(r: ModelResult): string {
  const lines: string[] = [];
  lines.push(`[${r.modelId}] ${r.modelName}（依据 ${r.standard}）`);
  for (const [id, tv] of Object.entries(r.outputs)) {
    lines.push(`  ${id} = ${fmtNum(tv.value)} ${tv.unit}`);
  }
  lines.push(`  代入行: ${r.substituted}`);
  lines.push(`  可行域: ${r.verdict.status}`);
  for (const c of r.verdict.conflicts) {
    lines.push(`    ⚠ ${c.constraintId}: ${c.actual} ${c.op} ${c.limit}（${c.level}）`);
  }
  return lines.join('\n');
}

export type { Grade };
