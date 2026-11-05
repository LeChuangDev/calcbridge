/**
 * 微型表达式解析器（FR-A-10：计算器不可“黑箱”）。
 * 支持：数字、变量、+ - * / ^、一元负号、括号、函数。
 * 变量在求值前已由求解器统一换算为计算器声明的工作单位，表达式内为纯数值运算。
 */

export type ExprNode =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'bin'; op: string; l: ExprNode; r: ExprNode }
  | { t: 'un'; op: string; e: ExprNode }
  | { t: 'call'; name: string; args: ExprNode[] };

const FUNCS = new Set(['sqrt', 'ln', 'log10', 'exp', 'abs', 'min', 'max', 'pow', 'curve']);

type Tok = { kind: 'num' | 'id' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof'; text: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error(`非法数字：${src.slice(i, i + 10)}`);
      toks.push({ kind: 'num', text: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_α-ωΑ-ΩµΩ°]/.test(c)) {
      const m = /^[a-zA-Z_α-ωΑ-ΩµΩ°][a-zA-Z0-9_α-ωΑ-ΩµΩ°]*/.exec(src.slice(i));
      toks.push({ kind: 'id', text: m![0] });
      i += m![0].length;
      continue;
    }
    if (c === '(') {
      toks.push({ kind: 'lparen', text: c });
      i++;
      continue;
    }
    if (c === ')') {
      toks.push({ kind: 'rparen', text: c });
      i++;
      continue;
    }
    if (c === ',') {
      toks.push({ kind: 'comma', text: c });
      i++;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      toks.push({ kind: 'op', text: c });
      i++;
      continue;
    }
    throw new Error(`无法识别的字符：${c}`);
  }
  toks.push({ kind: 'eof', text: '' });
  return toks;
}

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.pos];
  }

  private next(): Tok {
    return this.toks[this.pos++];
  }

  private expectOp(op: string): void {
    const t = this.next();
    if (t.kind !== 'op' || t.text !== op) throw new Error(`期望运算符 ${op}，实际 ${t.text}`);
  }

  parse(): ExprNode {
    const e = this.additive();
    const t = this.peek();
    if (t.kind !== 'eof') throw new Error(`多余的内容：${t.text}`);
    return e;
  }

  private additive(): ExprNode {
    let l = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t.kind === 'op' && (t.text === '+' || t.text === '-')) {
        this.next();
        l = { t: 'bin', op: t.text, l, r: this.multiplicative() };
      } else break;
    }
    return l;
  }

  private multiplicative(): ExprNode {
    let l = this.power();
    for (;;) {
      const t = this.peek();
      if (t.kind === 'op' && (t.text === '*' || t.text === '/')) {
        this.next();
        l = { t: 'bin', op: t.text, l, r: this.power() };
      } else break;
    }
    return l;
  }

  private power(): ExprNode {
    const base = this.unary();
    const t = this.peek();
    if (t.kind === 'op' && t.text === '^') {
      this.next();
      return { t: 'bin', op: '^', l: base, r: this.power() }; // 右结合
    }
    return base;
  }

  private unary(): ExprNode {
    const t = this.peek();
    if (t.kind === 'op' && t.text === '-') {
      this.next();
      return { t: 'un', op: '-', e: this.unary() };
    }
    return this.primary();
  }

  private primary(): ExprNode {
    const t = this.next();
    if (t.kind === 'num') return { t: 'num', v: Number(t.text) };
    if (t.kind === 'lparen') {
      const e = this.additive();
      const close = this.next();
      if (close.kind !== 'rparen') throw new Error('缺少右括号');
      return e;
    }
    if (t.kind === 'id') {
      if (this.peek().kind === 'lparen') {
        if (!FUNCS.has(t.text)) throw new Error(`未知函数：${t.text}`);
        this.next();
        const args: ExprNode[] = [];
        if (this.peek().kind !== 'rparen') {
          args.push(this.additive());
          while (this.peek().kind === 'comma') {
            this.next();
            args.push(this.additive());
          }
        }
        const close = this.next();
        if (close.kind !== 'rparen') throw new Error('函数缺少右括号');
        return { t: 'call', name: t.text, args };
      }
      return { t: 'var', name: t.text };
    }
    throw new Error(`意外的 token：${t.text}`);
  }
}

export function parseExpr(src: string): ExprNode {
  return new Parser(tokenize(src)).parse();
}

/** 收集表达式中出现的所有变量名 */
export function collectVars(node: ExprNode, out: Set<string> = new Set()): Set<string> {
  switch (node.t) {
    case 'num':
      break;
    case 'var':
      out.add(node.name);
      break;
    case 'bin':
      collectVars(node.l, out);
      collectVars(node.r, out);
      break;
    case 'un':
      collectVars(node.e, out);
      break;
    case 'call':
      node.args.forEach((a, i) => {
        // curve(曲线id, x)：第一个参数是曲线标识符，不是变量
        if (node.name === 'curve' && i === 0) return;
        collectVars(a, out);
      });
      break;
  }
  return out;
}
