/**
 * 表达式求值（含 curve 查表函数）。
 * env 中的变量值必须是已换算到计算器声明工作单位后的纯数值。
 */
import { type ExprNode, collectVars } from './parser';

/** 曲线表：一维插值数据（FR-A-5），坐标可线性/对数 */
export interface CurveData {
  id: string;
  x: number[];
  y: number[];
  /** loglog：双对数线性插值；linear：普通线性插值；logx：x 对数 */
  interp: 'loglog' | 'linear' | 'logx';
}

export interface EvalEnv {
  values: Record<string, number>;
  curves?: Record<string, CurveData>;
}

export function curveLookup(curve: CurveData, x: number): number {
  const xs = curve.x;
  const ys = curve.y;
  if (xs.length !== ys.length || xs.length < 2) throw new Error(`曲线 ${curve.id} 数据无效`);
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];

  const toX = curve.interp === 'loglog' || curve.interp === 'logx' ? Math.log10 : (v: number) => v;
  const toY = curve.interp === 'loglog' ? Math.log10 : (v: number) => v;

  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const xa = toX(xs[i - 1]);
      const xb = toX(xs[i]);
      const ya = toY(ys[i - 1]);
      const yb = toY(ys[i]);
      const frac = (toX(x) - xa) / (xb - xa || 1e-300);
      const y =
        curve.interp === 'loglog' ? Math.pow(10, ya + frac * (yb - ya)) : ya + frac * (yb - ya);
      return y;
    }
  }
  return ys[ys.length - 1];
}

export function evalExpr(node: ExprNode, env: EvalEnv): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'var': {
      const v = env.values[node.name];
      if (v === undefined) throw new Error(`未提供的输入变量：${node.name}`);
      return v;
    }
    case 'bin': {
      const l = evalExpr(node.l, env);
      const r = evalExpr(node.r, env);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          if (r === 0) throw new Error('除数为零');
          return l / r;
        case '^':
          return Math.pow(l, r);
        default:
          throw new Error(`未知运算符 ${node.op}`);
      }
    }
    case 'un':
      return -evalExpr(node.e, env);
    case 'call': {
      // curve(曲线id, x)：第一参数是标识符，不参与求值，单独处理
      if (node.name === 'curve') {
        if (!env.curves) throw new Error(`曲线未注册`);
        const idNode = node.args[0];
        if (idNode.t !== 'var') throw new Error(`curve() 第一参数必须是曲线 id 标识符`);
        const curve = env.curves[idNode.name];
        if (!curve) throw new Error(`曲线 ${idNode.name} 未注册`);
        if (node.args.length !== 2) throw new Error(`curve() 需要 2 个参数`);
        return curveLookup(curve, evalExpr(node.args[1]!, env));
      }
      const args = node.args.map((a) => evalExpr(a, env));
      switch (node.name) {
        case 'sqrt':
          return Math.sqrt(args[0]);
        case 'ln':
          return Math.log(args[0]);
        case 'log10':
          return Math.log10(args[0]);
        case 'exp':
          return Math.exp(args[0]);
        case 'abs':
          return Math.abs(args[0]);
        case 'min':
          return Math.min(...args);
        case 'max':
          return Math.max(...args);
        case 'pow':
          return Math.pow(args[0], args[1]);
        default:
          throw new Error(`未知函数 ${node.name}`);
      }
    }
  }
}

/**
 * FR-A-10 数字代入行：把变量替换为实际代入的数值，供结果页展示/复制为 LaTeX 或 Markdown。
 */
export function substituteExpr(node: ExprNode, values: Record<string, number>): string {
  const fmt = (v: number) => (Object.is(v, -0) ? '0' : Number(v.toPrecision(6)).toString());
  switch (node.t) {
    case 'num':
      return fmt(node.v);
    case 'var':
      return fmt(values[node.name] ?? NaN);
    case 'un':
      return `-(${substituteExpr(node.e, values)})`;
    case 'bin': {
      const l = substituteExpr(node.l, values);
      const r = substituteExpr(node.r, values);
      if (node.op === '^') return `(${l})^(${r})`;
      return `(${l}) ${node.op} (${r})`;
    }
    case 'call': {
      if (node.name === 'curve') {
        // 曲线 id 按标识符原样输出，不代入数值
        const idNode = node.args[0];
        const rest = node.args
          .slice(1)
          .map((a) => substituteExpr(a, values))
          .join(', ');
        return `curve(${idNode.t === 'var' ? idNode.name : substituteExpr(idNode, values)}, ${rest})`;
      }
      return `${node.name}(${node.args.map((a) => substituteExpr(a, values)).join(', ')})`;
    }
  }
}

export { collectVars };
