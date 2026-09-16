// ---------------------------------------------------------------------------
// A small, safe expression evaluator: "10*(1-exp(-t/2))", "x^2 - 4*x + 3".
//
// Graphs are written by the model as formulas, and a formula that is run with
// eval() or new Function() is a formula that can run anything. This parses
// into a tree of a handful of node types - numbers, one variable, the four
// operators and powers, and a fixed list of functions - and evaluates that
// tree. Nothing else can be expressed, so nothing else can happen.
// ---------------------------------------------------------------------------

type Node =
  | { k: 'num'; v: number }
  | { k: 'var' }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'fn'; name: string; args: Node[] };

const FUNCTIONS: Record<string, { arity: number[]; f: (...a: number[]) => number }> = {
  sin: { arity: [1], f: Math.sin }, cos: { arity: [1], f: Math.cos }, tan: { arity: [1], f: Math.tan },
  asin: { arity: [1], f: Math.asin }, acos: { arity: [1], f: Math.acos }, atan: { arity: [1], f: Math.atan },
  sinh: { arity: [1], f: Math.sinh }, cosh: { arity: [1], f: Math.cosh }, tanh: { arity: [1], f: Math.tanh },
  exp: { arity: [1], f: Math.exp }, ln: { arity: [1], f: Math.log }, log: { arity: [1], f: Math.log10 },
  log10: { arity: [1], f: Math.log10 }, log2: { arity: [1], f: Math.log2 }, sqrt: { arity: [1], f: Math.sqrt },
  abs: { arity: [1], f: Math.abs }, floor: { arity: [1], f: Math.floor }, ceil: { arity: [1], f: Math.ceil },
  sign: { arity: [1], f: Math.sign }, min: { arity: [2], f: Math.min }, max: { arity: [2], f: Math.max },
  pow: { arity: [2], f: Math.pow },
  // Degrees, because exam trigonometry is written in degrees.
  sind: { arity: [1], f: (d) => Math.sin((d * Math.PI) / 180) },
  cosd: { arity: [1], f: (d) => Math.cos((d * Math.PI) / 180) },
  tand: { arity: [1], f: (d) => Math.tan((d * Math.PI) / 180) },
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
// Own properties only: a plain lookup would find "constructor", "toString" and
// the rest of Object.prototype, and a whitelist that leaks is not a whitelist.
const own = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

export interface Compiled {
  source: string;
  variable: string;
  (x: number): number;
}

/** Parse a formula in one variable. Throws with a readable message when it cannot. */
export function compile(source: string, variable = 'x'): Compiled {
  const text = String(source || '').replace(/\*\*/g, '^').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!text.trim()) throw new Error('the formula is empty');
  if (text.length > 200) throw new Error('the formula is too long');
  let i = 0;
  const peek = () => { while (text[i] === ' ') i++; return text[i]; };
  const fail = (why: string): never => { throw new Error(why + ' in "' + source + '"'); };

  const primary = (): Node => {
    const c = peek();
    if (c === undefined) fail('the formula ends too early');
    if (c === '(') { i++; const n = expr(); if (peek() !== ')') fail('a bracket is not closed'); i++; return n; }
    if (/[0-9.]/.test(c!)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(text.slice(i));
      if (!m) fail('a number is written wrongly');
      i += m![0].length;
      return { k: 'num', v: Number(m![0]) };
    }
    if (/[A-Za-z_]/.test(c!)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))!;
      const name = m[0];
      i += name.length;
      if (peek() === '(') {
        const fn = own(FUNCTIONS, name.toLowerCase()) ? FUNCTIONS[name.toLowerCase()] : undefined;
        if (!fn) fail('"' + name + '" is not a function this can draw');
        i++;
        const args: Node[] = [];
        if (peek() !== ')') {
          args.push(expr());
          while (peek() === ',') { i++; args.push(expr()); }
        }
        if (peek() !== ')') fail('a bracket is not closed');
        i++;
        if (!fn!.arity.includes(args.length)) fail(name + ' takes ' + fn!.arity.join(' or ') + ' value(s)');
        return { k: 'fn', name: name.toLowerCase(), args };
      }
      if (name === variable) return { k: 'var' };
      if (own(CONSTANTS, name.toLowerCase())) return { k: 'num', v: CONSTANTS[name.toLowerCase()] };
      return fail('"' + name + '" is not the variable ' + variable + ' or a known constant');
    }
    return fail('"' + c + '" is not allowed');
  };
  // Implied multiplication: "2x", "3(x+1)", "2pi".
  const factorWithImplied = (): Node => {
    let n = power();
    for (;;) {
      const c = peek();
      if (c !== undefined && (/[A-Za-z_(]/.test(c))) n = { k: 'bin', op: '*', a: n, b: power() };
      else return n;
    }
  };
  const power = (): Node => {
    if (peek() === '-') { i++; return { k: 'neg', a: power() }; }
    if (peek() === '+') { i++; return power(); }
    const base = primary();
    if (peek() === '^') { i++; return { k: 'bin', op: '^', a: base, b: power() }; }
    return base;
  };
  const term = (): Node => {
    let n = factorWithImplied();
    for (;;) {
      const c = peek();
      if (c === '*' || c === '/') { i++; n = { k: 'bin', op: c, a: n, b: factorWithImplied() }; }
      else return n;
    }
  };
  const expr = (): Node => {
    let n = term();
    for (;;) {
      const c = peek();
      if (c === '+' || c === '-') { i++; n = { k: 'bin', op: c, a: n, b: term() }; }
      else return n;
    }
  };

  const tree = expr();
  if (peek() !== undefined) fail('"' + peek() + '" was not expected');

  const run = (n: Node, x: number): number => {
    switch (n.k) {
      case 'num': return n.v;
      case 'var': return x;
      case 'neg': return -run(n.a, x);
      case 'fn': return FUNCTIONS[n.name].f(...n.args.map((a) => run(a, x)));
      case 'bin': {
        const a = run(n.a, x);
        const b = run(n.b, x);
        return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
      }
    }
  };
  const f = ((x: number) => run(tree, x)) as Compiled;
  Object.defineProperty(f, 'source', { value: String(source) });
  Object.defineProperty(f, 'variable', { value: variable });
  return f;
}

// --- numerics over an interval -----------------------------------------------------------

const finite = (v: number) => Number.isFinite(v);

/** Every x in [a, b] where f(x) = target, found by sampling then bisection. */
export function roots(f: (x: number) => number, a: number, b: number, target = 0, samples = 800): number[] {
  const g = (x: number) => f(x) - target;
  const out: number[] = [];
  let px = a;
  let py = g(a);
  if (finite(py) && Math.abs(py) < 1e-12) out.push(a);
  for (let k = 1; k <= samples; k++) {
    const x = a + ((b - a) * k) / samples;
    const y = g(x);
    if (finite(y) && finite(py) && py * y < 0) {
      let lo = px, hi = x, flo = py;
      for (let it = 0; it < 80; it++) {
        const mid = (lo + hi) / 2;
        const fm = g(mid);
        if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
      }
      const r = (lo + hi) / 2;
      // A sign change across a pole (1/x at 0) is not a root.
      if (Math.abs(f(r) - target) < 1e-6 * Math.max(1, Math.abs(target), Math.abs(f(px)), Math.abs(f(x)))) out.push(r);
    } else if (finite(y) && Math.abs(y) < 1e-12 && k < samples) {
      out.push(x);
    }
    px = x;
    py = y;
  }
  return out.filter((r, k) => k === 0 || Math.abs(r - out[k - 1]) > (b - a) * 1e-6);
}

/** The largest (or smallest) value on [a, b] and where it is. */
export function extreme(f: (x: number) => number, a: number, b: number, kind: 'max' | 'min', samples = 2000): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  const better = (y: number) => best === null || (kind === 'max' ? y > best.y : y < best.y);
  for (let k = 0; k <= samples; k++) {
    const x = a + ((b - a) * k) / samples;
    const y = f(x);
    if (finite(y) && better(y)) best = { x, y };
  }
  if (!best) return null;
  // Golden-section refinement around the sampled best.
  const step = (b - a) / samples;
  let lo = Math.max(a, best.x - step);
  let hi = Math.min(b, best.x + step);
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < 60; it++) {
    const x1 = hi - phi * (hi - lo);
    const x2 = lo + phi * (hi - lo);
    const y1 = f(x1);
    const y2 = f(x2);
    if (kind === 'max' ? y1 > y2 : y1 < y2) hi = x2; else lo = x1;
  }
  const x = (lo + hi) / 2;
  const y = f(x);
  return finite(y) && !better(y) && Math.abs(y - best.y) > 1e-9 ? best : { x, y };
}

/** Central-difference slope. */
export function slope(f: (x: number) => number, x: number, span: number): number {
  const h = Math.max(Math.abs(x), span) * 1e-5 || 1e-5;
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Simpson's rule over [a, b]. */
export function area(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const m = n % 2 ? n + 1 : n;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let k = 1; k < m; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
  return (s * h) / 3;
}
