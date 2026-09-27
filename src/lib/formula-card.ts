// ---------------------------------------------------------------------------
// The formula card: the formulas a question used, laid out as a revision
// sheet - at the end of the video and as a carousel slide.
//
// Each card is a name, the formula, a line or two saying what the symbols
// are, a small graph that shows what the formula means (a sine wave, its RMS
// level, a phasor turning, the power triangle), and an icon.
//
// Formulas are written in a small subset of LaTeX, the notation a model
// writes most reliably - `V_{rms} = \frac{V_0}{\sqrt{2}}` - and typeset here
// rather than by a maths library, so they can be drawn in the look's own
// hand: textbook maths in most looks, marker handwriting in Doodle. Anything
// the parser does not know is shown as written, never dropped.
//
// Pure logic, shared by the server (which has the cards written), the editor
// and the renderer. No React.
// ---------------------------------------------------------------------------

/** The graphs a card can have. Each is drawn in src/remotion/FormulaGraph.tsx. */
export const GRAPH_KINDS = [
  'none',
  'sine',
  'rms',
  'phasor',
  'phase-shift',
  'power-triangle',
  'linear',
  'inverse',
  'exp-rise',
  'exp-decay',
] as const;

export type GraphKind = (typeof GRAPH_KINDS)[number];

export const GRAPH_LABELS: Record<GraphKind, string> = {
  none: 'No graph',
  sine: 'Sine wave',
  rms: 'Sine wave with its RMS level',
  phasor: 'Rotating phasor',
  'phase-shift': 'Two waves out of phase',
  'power-triangle': 'Power triangle',
  linear: 'Straight line (proportional)',
  inverse: 'Curve falling as 1/x',
  'exp-rise': 'Exponential rise (charging)',
  'exp-decay': 'Exponential decay (discharging)',
};

export interface FormulaGraph {
  kind: GraphKind;
  /** Axis names, in the same notation as the formula: "t", "v". */
  x: string;
  y: string;
  /** The graph's main label - the peak, the curve - and a second where the kind has one. */
  label: string;
  label2: string;
}

export interface FormulaCard {
  /** "Instantaneous Voltage". */
  name: string;
  /** "v = V_0 \sin(\omega t)". */
  formula: string;
  /** What the symbols are: "f = Frequency (Hz)". At most two. */
  notes: string[];
  graph: FormulaGraph;
  /** A plain noun for the card's icon: "light bulb", "ammeter". */
  icon: string;
  /** The icon's drawing, found by the server from `icon` (server/icons.mjs). */
  art?: { body: string; width: number; height: number };
}

export interface FormulaSheet {
  /** "Alternating Current - Important Formulas". */
  title: string;
  cards: FormulaCard[];
}

export const MAX_CARDS = 6;

export const FORMULA_LIMITS = {
  title: 60,
  name: 40,
  formula: 110,
  note: 60,
  notes: 2,
  axis: 12,
  label: 16,
  icon: 30,
};

const clean = (value: unknown, max: number): string => {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s\S*$/, '').trim();
};

/**
 * A sheet with every field present and within its length, cards without a
 * formula dropped, at most MAX_CARDS. Null when no card survives.
 */
export function tidySheet(raw: unknown): FormulaSheet | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.cards) ? r.cards : [];
  const cards: FormulaCard[] = [];
  for (const item of list) {
    if (cards.length >= MAX_CARDS) break;
    const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    // A formula is never shortened: half an equation is a wrong equation.
    const formula = String(c.formula == null ? '' : c.formula).replace(/\s+/g, ' ').trim();
    if (!formula || formula.length > FORMULA_LIMITS.formula) continue;
    const g = (c.graph && typeof c.graph === 'object' ? c.graph : {}) as Record<string, unknown>;
    const kind = GRAPH_KINDS.includes(g.kind as GraphKind) ? (g.kind as GraphKind) : 'none';
    const art = c.art && typeof c.art === 'object' ? (c.art as FormulaCard['art']) : undefined;
    cards.push({
      name: clean(c.name, FORMULA_LIMITS.name) || 'Formula ' + (cards.length + 1),
      formula,
      notes: (Array.isArray(c.notes) ? c.notes : [])
        .map((n) => clean(n, FORMULA_LIMITS.note))
        .filter(Boolean)
        .slice(0, FORMULA_LIMITS.notes),
      graph: {
        kind,
        x: clean(g.x, FORMULA_LIMITS.axis),
        y: clean(g.y, FORMULA_LIMITS.axis),
        label: clean(g.label, FORMULA_LIMITS.label),
        label2: clean(g.label2, FORMULA_LIMITS.label),
      },
      icon: clean(c.icon, FORMULA_LIMITS.icon),
      ...(art && typeof art.body === 'string' ? { art } : {}),
    });
  }
  if (!cards.length) return null;
  return { title: clean(r.title, FORMULA_LIMITS.title) || 'Important Formulas', cards };
}

// --- the maths ------------------------------------------------------------------

export type MathStyle =
  /** A single-letter quantity: italic, as in print. */
  | 'var'
  | 'num'
  /** =, +, -: spaced out. */
  | 'op'
  /** A function or a run of letters - sin, rms, max: upright. */
  | 'word'
  /** Brackets, commas, symbols: as they are. */
  | 'sym';

export type MathNode =
  | { t: 'text'; s: string; style: MathStyle }
  | { t: 'frac'; num: MathNode[]; den: MathNode[] }
  | { t: 'sqrt'; body: MathNode[] }
  | { t: 'scripts'; base: MathNode | null; sub: MathNode[] | null; sup: MathNode[] | null };

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ',
  Omega: 'Ω',
};

/** Upper-case Greek is upright in print; lower-case Greek is a quantity, italic. */
const UPRIGHT_GREEK = new Set(['Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega']);

const OPERATORS: Record<string, string> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', approx: '≈', neq: '≠', ne: '≠', leq: '≤', le: '≤',
  geq: '≥', ge: '≥', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', equiv: '≡',
  sim: '∼',
};

const SYMBOLS: Record<string, string> = {
  infty: '∞', angle: '∠', degree: '°', circ: '°', partial: '∂', nabla: '∇', prime: '′', ldots: '…',
  cdots: '⋯', percent: '%', '%': '%', '{': '{', '}': '}', '_': '_', '#': '#', '&': '&', '$': '$',
};

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'max', 'min', 'lim', 'arctan', 'arcsin', 'arccos', 'sinh', 'cosh', 'tanh']);

/** Text commands whose argument is shown as it is, upright. */
const TEXT_COMMANDS = new Set(['text', 'mathrm', 'textrm', 'mathbf', 'textbf', 'operatorname', 'mathit', 'textit', 'mbox']);

/** Commands that only size or space things, and are dropped. */
const IGNORED = new Set(['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'limits', 'quad', 'qquad', 'mathbb']);

const EQUALITY = new Set(['=', '+', '−', '<', '>', '×', '·', '÷', '±', '≈', '≠', '≤', '≥', '∝', '→', '⇒', '≡']);

/**
 * Parse the subset of LaTeX a formula card uses into a tree to typeset.
 * Never throws: whatever it does not understand is kept as text.
 */
export function parseMath(src: string): MathNode[] {
  const s = String(src || '');
  let i = 0;

  const text = (value: string, style: MathStyle): MathNode => ({ t: 'text', s: value, style });

  /** One group in braces, or else the next single atom - what \frac, ^ and _ take. */
  const argument = (): MathNode[] => {
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      i++;
      const body = sequence('}');
      if (s[i] === '}') i++;
      return body;
    }
    const one = atom();
    return one ? (Array.isArray(one) ? one : [one]) : [];
  };

  /** The raw text of a braced group, for \text{...}. */
  const rawGroup = (): string => {
    while (s[i] === ' ') i++;
    if (s[i] !== '{') return '';
    let depth = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const out = s.slice(start, i);
    if (s[i] === '}') i++;
    return out;
  };

  const command = (): MathNode | MathNode[] | null => {
    // At the backslash.
    i++;
    if (!/[A-Za-z]/.test(s[i] || '')) {
      // \, \; \! \  are spaces; \{ \% and friends are the character itself.
      const ch = s[i++] || '';
      if (ch === ',' || ch === ';' || ch === ':' || ch === ' ' || ch === '!') return null;
      return text(SYMBOLS[ch] || ch, 'sym');
    }
    let name = '';
    while (/[A-Za-z]/.test(s[i] || '')) name += s[i++];

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const num = argument();
      const den = argument();
      return { t: 'frac', num, den };
    }
    if (name === 'sqrt') {
      // An index, \sqrt[3]{x}, is dropped: square roots are what cards show.
      if (s[i] === '[') {
        const close = s.indexOf(']', i);
        i = close > 0 ? close + 1 : i;
      }
      return { t: 'sqrt', body: argument() };
    }
    if (TEXT_COMMANDS.has(name)) return text(rawGroup(), 'word');
    if (IGNORED.has(name)) return null;
    if (GREEK[name]) return text(GREEK[name], UPRIGHT_GREEK.has(name) ? 'sym' : 'var');
    if (OPERATORS[name]) return text(OPERATORS[name], 'op');
    if (SYMBOLS[name]) return text(SYMBOLS[name], 'sym');
    if (FUNCTIONS.has(name)) return text(name, 'word');
    // Unknown: shown as its name, so nothing silently disappears.
    return text(name, 'word');
  };

  const atom = (): MathNode | MathNode[] | null => {
    while (s[i] === ' ') i++;
    const ch = s[i];
    if (ch === undefined) return null;
    if (ch === '\\') return command();
    if (ch === '{') {
      i++;
      const body = sequence('}');
      if (s[i] === '}') i++;
      return body;
    }
    if (/[0-9.]/.test(ch)) {
      let n = '';
      while (/[0-9.]/.test(s[i] || '')) n += s[i++];
      return text(n, 'num');
    }
    if (/[A-Za-z]/.test(ch)) {
      let w = '';
      while (/[A-Za-z]/.test(s[i] || '')) w += s[i++];
      // One letter is a quantity. A run is a word - "rms", "max", "eq" -
      // unless it is a function name, which is a word anyway.
      return text(w, w.length === 1 ? 'var' : 'word');
    }
    i++;
    if (ch === '-') return text('−', 'op');
    if (ch === '*') return text('·', 'op');
    if (ch === '=' || ch === '+' || ch === '<' || ch === '>') return text(ch, 'op');
    return text(ch, 'sym');
  };

  function sequence(until?: string): MathNode[] {
    const out: MathNode[] = [];
    while (i < s.length) {
      while (s[i] === ' ') i++;
      if (i >= s.length) break;
      if (until && s[i] === until) break;
      if (s[i] === '^' || s[i] === '_') {
        const which = s[i++];
        const arg = argument();
        const last = out[out.length - 1];
        // Both scripts on one base: x_0^2.
        if (last && last.t === 'scripts' && !(which === '^' ? last.sup : last.sub)) {
          if (which === '^') last.sup = arg; else last.sub = arg;
        } else {
          const base = out.pop() || null;
          out.push({ t: 'scripts', base, sub: which === '_' ? arg : null, sup: which === '^' ? arg : null });
        }
        continue;
      }
      if (s[i] === '}') {
        // A stray closing brace: skip it rather than stop.
        i++;
        continue;
      }
      const next = atom();
      if (next === null) continue;
      if (Array.isArray(next)) out.push(...next); else out.push(next);
    }
    return out;
  }

  return sequence();
}

/** Is this node an operator that wants space either side? */
export const isSpaced = (n: MathNode): boolean => n.t === 'text' && n.style === 'op' && EQUALITY.has(n.s);

/**
 * Roughly how wide a formula sets, in em - to choose a font size that fits
 * the card before the browser has laid anything out.
 */
export function mathWidth(nodes: MathNode[]): number {
  let w = 0;
  for (const n of nodes) {
    if (n.t === 'text') w += n.s.length * (n.style === 'word' ? 0.5 : 0.56) + (isSpaced(n) ? 0.5 : 0);
    else if (n.t === 'frac') w += Math.max(mathWidth(n.num), mathWidth(n.den)) * 0.9 + 0.3;
    else if (n.t === 'sqrt') w += mathWidth(n.body) + 0.7;
    else w += (n.base ? mathWidth([n.base]) : 0) + Math.max(n.sub ? mathWidth(n.sub) : 0, n.sup ? mathWidth(n.sup) : 0) * 0.62;
  }
  return w;
}

/** Whether a formula stacks - a fraction - and so needs more height. */
export const isTall = (nodes: MathNode[]): boolean =>
  nodes.some((n) => n.t === 'frac' || (n.t === 'sqrt' && isTall(n.body)) || (n.t === 'scripts' && n.base !== null && isTall([n.base])));

// --- time and layout ------------------------------------------------------------

/**
 * How long the formula scene holds, in seconds, however short its narration:
 * time to read every card. The cards arrive one after another, and each gets
 * a moment to be read after it lands.
 */
export function formulaHoldSeconds(cards: number): number {
  return cards > 0 ? 3 + 1.8 * Math.min(cards, MAX_CARDS) : 0;
}

/** Frames between one card arriving and the next. */
export const CARD_STAGGER = 9;

/** Columns for a sheet of `cards` in a box of this shape. */
export function columnsFor(cards: number, width: number, height: number): number {
  if (cards <= 1) return 1;
  const landscape = width > height * 1.2;
  if (landscape) return cards <= 2 ? cards : 2;
  // A square (a carousel slide): one column while the cards stay tall enough.
  if (width >= height * 0.9) return cards <= 3 ? 1 : 2;
  return 1;
}

/** The narration the formula scene is added with; the creator can change it. */
export const FORMULA_NARRATION = 'Here are the formulas behind this one. Save it for your revision.';
