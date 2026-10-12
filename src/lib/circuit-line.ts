// ---------------------------------------------------------------------------
// A circuit from one short line - with real parts, and solved.
//
// The circuit sketch took "10 + (50 | 50)" and drew three resistors and a
// battery, whatever the scene was about. That was every circuit it could draw.
// So a series RLC came out as resistors of 10, 20 and 30 ohms, a transmission
// line's capacitance as two 50 ohm resistors across a cell, a shunt reactor
// as a battery labelled "Reactor". Five of its eight uses in real videos were
// wrong, and they were wrong because the sketch had no way to be right.
//
// The line keeps its shape - + is series, | is parallel - and each part now
// says what it is:
//
//     R + L + C                    named parts, no values: a schematic
//     Rm=99Ω | Rsh=1Ω?             values with units; "?" hides one until the answer
//     R=0.5Ω + X=j1.41Ω            a reactance, as it is written in a paper
//     Ra=0.5Ω + Eb=210V            a back EMF, opposing the supply
//     L + (C | Load)               a line, its capacitance, and whatever it feeds
//
// with the supply said separately ("230 V, 50 Hz", "100 mA", "Vs") or left out
// for a network between two terminals. What a part is comes from its unit, or
// from the first letter of its name the way every textbook uses it - R, L, C,
// X, E, Z. Anything that cannot be read is refused: a part is never guessed.
//
// The line becomes the same Circuit the question's own figure uses, so it is
// drawn with the same symbols and - when every part has a value - solved by
// the same nodal analysis. One fact about it may be stated ("I(Rm) = 1 mA")
// and is then CHECKED: a circuit that does not do what the script says it does
// is not drawn.
//
// Pure data and arithmetic. The server imports this directly, so every import
// keeps its .ts extension.
// ---------------------------------------------------------------------------

import { parseNet, type Net } from './circuit-net.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './figures/quantity.ts';
import {
  ASK_UNIT, answerCircuit, isSolvable, type AskQuantity, type Circuit, type CircuitAsk,
  type CircuitElement, type CircuitNode, type ElementKind,
} from './figures/circuit.ts';

/** One part of the line, read. */
interface Part {
  kind: ElementKind;
  label: string;
  /** In base units - ohms, henries, farads, volts - or null for a part with no value. */
  value: number | null;
  /** Ohms, when it was given as a reactance: positive inductive, negative capacitive. */
  reactance: number | null;
  /** Hidden as "?" until the answer is out. */
  unknown: boolean;
  open?: boolean;
  letter?: string;
  /** The number as it was written, before its unit: what the video has to account for. */
  written: number | null;
}

export interface LineSource {
  kind: 'voltage' | 'current' | 'none';
  /** Volts or amperes, or null when the supply is only named. */
  value: number | null;
  label: string;
  ac: boolean;
  /** Hz; 0 when it was not said. */
  frequency: number;
  written: number[];
}

export interface LineCheck {
  quantity: AskQuantity;
  /** The part it is about, by the name it was given; '' for the supply or the whole network. */
  about: string;
  value: number;
  unit: UnitClass;
}

export interface CircuitLine {
  circuit: Circuit;
  /** True when every part has a value, so what is drawn has been solved. */
  solved: boolean;
  check: LineCheck | null;
  /** What the checked quantity works out to, written out: "1 mA". */
  computed: string;
  /** Every number the line writes, for the rule that a drawn number needs a source. */
  written: number[];
  /** The ones hidden behind a "?" until the answer. */
  hidden: number[];
  /** The circuit in words, for a reviewer. */
  words: string;
}

/** When a supply is AC and no frequency is given, reactances are solved at one radian a second. */
const NOMINAL_HZ = 1 / (2 * Math.PI);
const MAX_WIDE = 4;
const MAX_TALL = 3;
const MAX_PARTS = 8;

const firstNumber = (text: string): number | null => {
  const m = /-?\d+(?:\.\d+)?|-?\.\d+/.exec(text);
  return m ? Math.abs(Number(m[0])) : null;
};

/** What a name says a part is, the way a circuit diagram letters its parts. */
function kindFromName(name: string): { kind: ElementKind; letter?: string; open?: boolean; reactive?: 1 | -1 } | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  if (/^(lamp|bulb)/.test(n)) return { kind: 'lamp' };
  if (/^(ammeter|a)$/.test(n)) return { kind: 'meter', letter: 'A' };
  if (/^(voltmeter|v)$/.test(n)) return { kind: 'meter', letter: 'V' };
  if (/^(wattmeter|w)$/.test(n)) return { kind: 'meter', letter: 'W' };
  if (/^(galvanometer|g|pmmc|meter)$/.test(n)) return { kind: 'meter', letter: 'G' };
  if (/^(switch|sw|s\d?)(\b|$)/.test(n)) return { kind: 'switch', open: /open|off/.test(n) };
  if (/^(scr|thyristor)/.test(n)) return { kind: 'scr' };
  if (/^(diode|d\d?$)/.test(n)) return { kind: 'diode' };
  if (/^(load|z[a-z0-9_]{0,3}$)/.test(n)) return { kind: 'load' };
  if (/^(reactor|coil|choke|inductor|inductance|winding)/.test(n)) return { kind: 'inductor' };
  if (/^(capacitor|capacitance|condenser)/.test(n)) return { kind: 'capacitor' };
  if (/^(resistor|resistance)/.test(n)) return { kind: 'resistor' };
  if (/^x_?c/.test(n)) return { kind: 'capacitor', reactive: -1 };
  if (/^x/.test(n)) return { kind: 'inductor', reactive: 1 };
  if (/^(emf|back|e[a-z0-9_]{0,3}$)/.test(n)) return { kind: 'voltage' };
  // The letter convention: R, R1, Rm, Rsh; L, Ls; C, Csh. Short names only, so
  // an ordinary word is never read by its first letter.
  if (/^r[a-z0-9_]{0,3}$/.test(n)) return { kind: 'resistor' };
  if (/^l[a-z0-9_]{0,3}$/.test(n)) return { kind: 'inductor' };
  if (/^c[a-z0-9_]{0,3}$/.test(n)) return { kind: 'capacitor' };
  return null;
}

/** Names that only repeat what the symbol already shows. */
const SELF_EVIDENT = /^(lamp|bulb|switch|sw|diode|ammeter|voltmeter|wattmeter|galvanometer|meter|pmmc|a|v|w|g)$/i;

const KIND_WORD: Record<ElementKind, string> = {
  resistor: 'a resistor', lamp: 'a lamp', inductor: 'an inductor', capacitor: 'a capacitor', voltage: 'a voltage source',
  current: 'a current source', wire: 'a wire', meter: 'a meter', switch: 'a switch', diode: 'a diode', scr: 'a thyristor', load: 'a load',
};

/** One leaf of the line: "99Ω", "Rm=99Ω", "Rsh=1Ω?", "L", "X=j1.41Ω", "Eb=210V". */
function readPart(text: string, errors: string[]): Part | null {
  const raw = text.trim();
  let name = '';
  let val = '';
  const eq = raw.indexOf('=');
  if (eq >= 0) {
    name = raw.slice(0, eq).trim();
    val = raw.slice(eq + 1).trim();
  } else if (/^[+-]?\s*j?\s*[\d.]/i.test(raw) || raw === '?') {
    val = raw;
  } else {
    name = raw;
  }
  let unknown = false;
  if (val.endsWith('?')) {
    unknown = true;
    val = val.slice(0, -1).trim();
  }
  // "switch open": the state is how it is drawn, not part of its name.
  const state = /\b(open|closed|off|on)\b/i.exec(name);
  if (state && /^(switch|sw|s\d?)\b/i.test(name)) name = name.replace(state[0], '').replace(/\s+/g, ' ').trim();
  if (name.length > 10) {
    errors.push('"' + name + '" is too long a name for a part - a letter and a subscript, such as Rm or XL');
    return null;
  }

  const named = kindFromName(name);
  const part: Part = {
    kind: named ? named.kind : 'resistor',
    // A lamp, a switch or a meter is its own label: the symbol says it, and
    // a meter's letter is on its dial.
    label: SELF_EVIDENT.test(name) ? '' : name,
    value: null, reactance: null, unknown,
    open: named && named.kind === 'switch' ? Boolean(state && /open|off/i.test(state[0])) : undefined,
    letter: named ? named.letter : undefined, written: null,
  };

  if (!val) {
    if (!named) {
      errors.push('cannot tell what kind of part "' + raw + '" is - start its name with R, L or C, or give its value with a unit');
      return null;
    }
    return part;
  }

  part.written = firstNumber(val);
  const j = /^([+-]?)\s*j\s*(.*)$/i.exec(val);
  if (j) {
    const q = parseQuantity(j[2]);
    if (!q || (q.unit !== 'Ω' && q.unit !== '') || !(q.value > 0)) {
      errors.push('cannot read the reactance "' + val + '" - write it as j4Ω or -j5Ω');
      return null;
    }
    const sign = j[1] === '-' ? -1 : 1;
    if (named && named.reactive && named.reactive !== sign) {
      errors.push(name + ' is ' + (named.reactive > 0 ? 'inductive' : 'capacitive') + ' but its reactance is written ' + val);
      return null;
    }
    if (named && named.kind !== 'inductor' && named.kind !== 'capacitor' && named.kind !== 'load') {
      errors.push(name + ' is ' + KIND_WORD[named.kind] + ', which has no reactance');
      return null;
    }
    part.kind = sign > 0 ? 'inductor' : 'capacitor';
    part.reactance = sign * q.value;
    return part;
  }

  // "4.7k" is how a resistor is marked: a prefix with the ohm left off.
  const short = /^(-?\d+(?:\.\d+)?)\s*([kKM])$/.exec(val);
  const q = short
    ? { value: Number(short[1]) * (short[2] === 'M' ? 1e6 : 1e3), unit: 'Ω' as UnitClass }
    : parseQuantity(val);
  if (!q || !(q.value > 0)) {
    errors.push('cannot read the value "' + val + '"' + (name ? ' of ' + name : ''));
    return null;
  }

  if (q.unit === 'Ω' || q.unit === '') {
    if (named && named.reactive) {
      // XL = 4 Ω, XC = 5 Ω: a reactance by its name.
      part.kind = named.kind;
      part.reactance = named.reactive * q.value;
      return part;
    }
    if (named && (named.kind === 'inductor' || named.kind === 'capacitor')) {
      errors.push(name + ' is ' + KIND_WORD[named.kind] + ', so ' + val + ' cannot be its value - give henries or farads, or its reactance as '
        + (named.kind === 'inductor' ? 'j' : '-j') + val);
      return null;
    }
    if (named && (named.kind === 'voltage' || named.kind === 'switch' || named.kind === 'diode' || named.kind === 'scr')) {
      errors.push(name + ' is ' + KIND_WORD[named.kind] + ', which is not given in ohms');
      return null;
    }
    part.value = q.value;
    return part;
  }
  const byUnit: Partial<Record<UnitClass, ElementKind>> = { H: 'inductor', F: 'capacitor', V: 'voltage' };
  const kind = byUnit[q.unit];
  if (!kind) {
    errors.push('a part cannot be given as ' + val + ' - a part has ohms, henries, farads, or volts for an EMF');
    return null;
  }
  if (named && named.kind !== kind) {
    errors.push(name + ' is ' + KIND_WORD[named.kind] + ', but ' + val + ' is the value of ' + KIND_WORD[kind]);
    return null;
  }
  part.kind = kind;
  part.value = q.value;
  return part;
}

const GENERIC = /\b(ac|a\.c\.|dc|d\.c\.|source|supply|mains|battery|cell|rms|alternating|direct|voltage|current|single|phase|the|a|an|of|at|and)\b/gi;

/** The supply: "12 V", "Vs = 230 V, 50 Hz", "100 mA", "Vs", or nothing at all. */
export function readSource(text: unknown, mode: unknown): LineSource {
  const said = String(text ?? '').trim();
  const m = String(mode ?? '').trim().toLowerCase();
  // No supply said: the network stands between two terminals. Whether it is an
  // AC network still matters, because a reactance means nothing in a DC one.
  if (!said) return { kind: 'none', value: null, label: '', ac: m === 'ac', frequency: 0, written: [] };

  let ac: boolean | null = m === 'ac' ? true : m === 'dc' ? false : null;
  if (ac === null && (/\b(ac|a\.c\.|alternating|rms|sinusoidal)\b/i.test(said) || said.includes('~'))) ac = true;
  if (ac === null && /\b(dc|d\.c\.|direct|battery|cell)\b/i.test(said)) ac = false;

  const written: number[] = [];
  let frequency = 0;
  let value: number | null = null;
  let kind: LineSource['kind'] = 'voltage';
  for (const hit of said.matchAll(/(\d+(?:\.\d+)?)\s*([a-zA-ZµμΩ]+)/g)) {
    const q = parseQuantity(hit[0]);
    if (!q) continue;
    if (q.unit === 'Hz' && !frequency) {
      frequency = q.value;
      written.push(Number(hit[1]));
      if (ac === null) ac = true;
    } else if ((q.unit === 'V' || q.unit === 'A') && value === null) {
      value = q.value;
      kind = q.unit === 'A' ? 'current' : 'voltage';
      written.push(Number(hit[1]));
    }
  }
  // A name before an equals sign, or what is left once the numbers and the
  // words every supply is described with are taken away.
  const eq = said.indexOf('=');
  let label = eq > 0 ? said.slice(0, eq).trim() : '';
  if (!label && value === null) label = said.replace(GENERIC, ' ').replace(/[~,;]/g, ' ').replace(/\s+/g, ' ').trim();
  if (label.length > 10 || /\d/.test(label)) label = '';
  return { kind, value, label, ac: ac === true, frequency, written };
}

/** One fact stated about the circuit: "I(Rm) = 1 mA", "V(R2) = 6 V", "I = 20 A", "Z = 1.5 Ω". */
export function readCheck(text: unknown): LineCheck | null {
  const said = String(text ?? '').trim();
  const m = /^([IVPRZ])\s*(?:_?(?:eq|th|in|total|t)\b)?\s*(?:\(\s*([^)]{1,12}?)\s*\))?\s*=\s*(.+)$/i.exec(said);
  if (!m) return null;
  const quantity = ({ I: 'current', V: 'voltage', P: 'power', R: 'resistance', Z: 'impedance' } as Record<string, AskQuantity>)[m[1].toUpperCase()];
  const q = parseQuantity(m[3]);
  if (!q || !Number.isFinite(q.value)) return null;
  if (q.unit && q.unit !== ASK_UNIT[quantity]) return null;
  return { quantity, about: (m[2] || '').trim(), value: q.value, unit: ASK_UNIT[quantity] };
}

const measure = (n: Net): { w: number; h: number } => {
  if (n.kind === 'leaf') return { w: 1, h: 1 };
  const kids = n.kids.map(measure);
  return n.kind === 'series'
    ? { w: kids.reduce((s, k) => s + k.w, 0), h: Math.max(...kids.map((k) => k.h)) }
    : { w: Math.max(...kids.map((k) => k.w)), h: kids.reduce((s, k) => s + k.h, 0) };
};

/**
 * Read a circuit line into a Circuit that can be drawn and, where it has
 * values, solved. `params` are the circuit sketch's own: `network`, `labelA`
 * (the supply), `mode` ("ac" or "dc") and `labelB` (a fact to check).
 */
export function readCircuitLine(params: {
  network?: unknown; labelA?: unknown; labelB?: unknown; mode?: unknown;
}): { line: CircuitLine | null; errors: string[] } {
  const errors: string[] = [];
  const tree = parseNet(String(params.network ?? ''));
  if (!tree) return { line: null, errors: ['the network could not be read - write it with + for series and | for parallel'] };

  // Each leaf becomes a part; the tree keeps only its shape.
  const parts = new Map<Net, Part>();
  const leaves: Net[] = [];
  const walk = (n: Net) => {
    if (n.kind === 'leaf') {
      leaves.push(n);
      const part = readPart(n.label, errors);
      if (part) parts.set(n, part);
    } else {
      n.kids.forEach(walk);
    }
  };
  walk(tree);
  if (errors.length) return { line: null, errors };
  if (leaves.length > MAX_PARTS) return { line: null, errors: ['has ' + leaves.length + ' parts - more than ' + MAX_PARTS + ' cannot be drawn clearly'] };

  // A circuit that ends in parallel branches is drawn as a ladder - each
  // branch a rung between the two rails - which is how a shunt, a divider or
  // a line with its capacitance is drawn in every textbook. Only the LAST
  // thing at each level may be more than one part, because everything before
  // it has to hang from the same rail.
  const tailOf = (n: Net): Net => (n.kind === 'leaf' ? n : n.kids[n.kids.length - 1]);
  const canLadder = (n: Net): boolean =>
    n.kind === 'leaf' || (n.kids.slice(0, -1).every((k) => k.kind === 'leaf') && canLadder(tailOf(n)));
  const endsInRungs = (n: Net): boolean => n.kind === 'parallel' || (n.kind === 'series' && endsInRungs(tailOf(n)));
  const rungsAcross = (n: Net): number => (n.kind === 'leaf' ? 1 : n.kids.length - 1 + rungsAcross(tailOf(n)));
  const asLadder = canLadder(tree) && endsInRungs(tree);

  const measured = measure(tree);
  const wide = measured.w;
  let tall = measured.h;
  if (asLadder ? rungsAcross(tree) > 5 : (wide > MAX_WIDE || tall > MAX_TALL)) {
    return { line: null, errors: ['is too large to draw clearly (' + leaves.length + ' parts, ' + wide + ' across and ' + tall + ' deep)'] };
  }

  const source = readSource(params.labelA, params.mode);
  const all = [...parts.values()];
  const reactive = all.some((p) => p.reactance !== null);
  if (reactive && !source.ac) {
    return { line: null, errors: ['has a reactance but is not said to be AC - a reactance means nothing in a DC circuit'] };
  }
  const names = all.map((p) => p.label.toLowerCase()).filter(Boolean);
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) return { line: null, errors: ['two parts are both called ' + twice] };

  // --- onto the grid: series runs across, parallel stacks down ---------------
  const nodes = new Map<string, CircuitNode>();
  const at = (col: number, row: number): string => {
    const id = 'n' + col + '_' + row;
    if (!nodes.has(id)) nodes.set(id, { id, col, row });
    return id;
  };
  const elements: CircuitElement[] = [];
  const laid = new Set<string>();
  const wire = (c1: number, r1: number, c2: number, r2: number) => {
    // In unit steps, so a wire never runs through a node it does not join.
    const steps = Math.abs(c2 - c1) + Math.abs(r2 - r1);
    const dc = Math.sign(c2 - c1);
    const dr = Math.sign(r2 - r1);
    for (let i = 0; i < steps; i++) {
      const a = at(c1 + dc * i, r1 + dr * i);
      const b = at(c1 + dc * (i + 1), r1 + dr * (i + 1));
      const key = [a, b].sort().join('>');
      if (laid.has(key)) continue;
      laid.add(key);
      elements.push({ id: 'w' + laid.size, kind: 'wire', from: a, to: b, value: 0, unknown: false, label: '' });
    }
  };
  const omega = 2 * Math.PI * (source.ac ? (source.frequency || NOMINAL_HZ) : 0);
  const byLeaf = new Map<Net, CircuitElement>();
  /** One part between two nodes: `left` is the end nearer the supply's positive terminal. */
  const lay = (n: Net, left: string, right: string) => {
    const p = parts.get(n)!;
    let value = p.value ?? 0;
    let shown: string | undefined;
    if (p.reactance !== null) {
      // Kept as the inductance or capacitance that has this reactance at the
      // supply's frequency, so the solver treats it as what it is; written
      // back on screen as the reactance it was given as.
      const x = Math.abs(p.reactance);
      value = omega > 0 ? (p.reactance > 0 ? x / omega : 1 / (x * omega)) : 0;
      shown = (p.reactance > 0 ? 'j' : '−j') + formatQuantity(x, 'Ω');
    }
    const symbolic = p.value === null && p.reactance === null;
    // An EMF inside the loop opposes the supply: its positive end faces the
    // supply's, which is what "back EMF" means.
    const opposing = p.kind === 'voltage';
    const e: CircuitElement = {
      id: 'p' + (byLeaf.size + 1), kind: p.kind,
      from: opposing ? right : left, to: opposing ? left : right,
      value, unknown: p.unknown, label: p.label,
      ...(shown ? { shown } : {}), ...(symbolic ? { symbolic: true } : {}),
      ...(p.open ? { open: true } : {}), ...(p.letter ? { letter: p.letter } : {}),
    };
    elements.push(e);
    byLeaf.set(n, e);
  };
  const place = (n: Net, col: number, row: number, width: number) => {
    if (n.kind === 'leaf') {
      lay(n, at(col, row), at(col + 1, row));
      if (width > 1) wire(col + 1, row, col + width, row);
      return;
    }
    if (n.kind === 'series') {
      let c = col;
      n.kids.forEach((kid, i) => {
        const w = i === n.kids.length - 1 ? col + width - c : measure(kid).w;
        place(kid, c, row, w);
        c += w;
      });
      return;
    }
    let r = row;
    const tops: number[] = [];
    for (const kid of n.kids) {
      place(kid, col, r, width);
      tops.push(r);
      r += measure(kid).h;
    }
    wire(col, tops[0], col, tops[tops.length - 1]);
    wire(col + width, tops[0], col + width, tops[tops.length - 1]);
  };

  /** A ladder: parts in series run along the top rail, parallel ones drop to the bottom rail. */
  const ladder = (n: Net, col: number): number => {
    if (n.kind === 'leaf') {
      lay(n, at(col, 0), at(col, 1));
      return col;
    }
    let c = col;
    for (const kid of n.kids.slice(0, -1)) {
      if (n.kind === 'series') {
        lay(kid, at(c, 0), at(c + 1, 0));
      } else {
        lay(kid, at(c, 0), at(c, 1));
        wire(c, 0, c + 1, 0);
      }
      c += 1;
    }
    return ladder(tailOf(n), c);
  };

  // A branch that starts with a stack or a rung needs a lead in: it would
  // otherwise sit on top of the supply.
  const leadsWithPart = tree.kind === 'leaf' || (tree.kind === 'series' && tree.kids[0].kind === 'leaf');
  const x0 = leadsWithPart ? 0 : 1;
  if (asLadder) {
    tall = 1;
    const last = ladder(tree, x0);
    if (x0) wire(0, 0, 1, 0);
    wire(last, 1, 0, 1);
  } else {
    place(tree, x0, 0, wide);
    const right = x0 + wide;
    if (x0) wire(0, 0, 1, 0);
    wire(right, 0, right, tall);
    wire(right, tall, 0, tall);
  }
  const top = at(0, 0);
  const foot = at(0, tall);

  let supply: CircuitElement | null = null;
  if (source.kind !== 'none') {
    supply = {
      id: 'S', kind: source.kind, from: foot, to: top,
      value: source.value ?? 0, unknown: false, label: source.label,
      ...(source.value === null ? { symbolic: true } : {}),
    };
    elements.push(supply);
  }

  // --- the fact to check ------------------------------------------------------
  const check = readCheck(params.labelB);
  let ask: CircuitAsk | undefined;
  if (check) {
    if (check.quantity === 'resistance' || check.quantity === 'impedance') {
      ask = { quantity: check.quantity, from: top, to: foot };
    } else {
      const target = check.about
        ? [...byLeaf.values()].find((e) => e.label.toLowerCase() === check.about.toLowerCase())
        : supply;
      if (!target) {
        return { line: null, errors: ['is checked against ' + (check.about ? '"' + check.about + '", which is not one of its parts' : 'a supply it does not have')] };
      }
      ask = { quantity: check.quantity, element: target.id };
    }
  }
  // Terminals are lettered A and B wherever the network is looked into.
  const lettered = source.kind === 'none' || (ask && (ask.quantity === 'resistance' || ask.quantity === 'impedance'));
  if (lettered) {
    const rename = (from: string, to: string) => {
      const n = nodes.get(from)!;
      nodes.delete(from);
      nodes.set(to, { ...n, id: to });
      for (const e of elements) {
        if (e.from === from) e.from = to;
        if (e.to === from) e.to = to;
      }
      if (ask && ask.from === from) ask.from = to;
      if (ask && ask.to === from) ask.to = to;
    };
    rename(top, 'A');
    rename(foot, 'B');
  }

  const circuit: Circuit = {
    type: 'circuit',
    title: '',
    frequency: source.ac ? (source.frequency || NOMINAL_HZ) : 0,
    nodes: [...nodes.values()],
    elements,
    ...(ask ? { ask } : {}),
    ...(lettered ? { terminals: ['A', 'B'] } : {}),
  };

  // Henries and farads mean nothing to a solver that was not told the frequency.
  const needsHz = all.some((p) => (p.kind === 'inductor' || p.kind === 'capacitor') && p.value !== null && p.reactance === null);
  const lookingIn = ask && (ask.quantity === 'resistance' || ask.quantity === 'impedance');
  const valued = all.every((p) => p.value !== null || p.reactance !== null || p.kind === 'switch');
  const solved = lookingIn
    ? valued && !all.some((p) => p.kind === 'diode' || p.kind === 'scr' || p.kind === 'load') && !(needsHz && source.ac && !source.frequency)
    : isSolvable(circuit) && !(needsHz && source.ac && !source.frequency);

  let computed = '';
  if (check && ask && solved) {
    const answer = answerCircuit(circuit);
    if (!answer) return { line: null, errors: ['could not be solved as it is written'] };
    computed = formatQuantity(answer.value, answer.unit);
    if (!sameValue(answer.value, check.value)) {
      return {
        line: null,
        errors: ['does not do what the script says: as drawn, ' + checkName(check) + ' works out to ' + computed
          + ', not ' + formatQuantity(check.value, check.unit)],
      };
    }
  }
  // A fact that could not be checked is not shown as though it had been.
  if (check && !solved) delete circuit.ask;

  const written = [...all.map((p) => p.written), ...source.written].filter((n): n is number => n !== null);
  const hidden = all.filter((p) => p.unknown).map((p) => p.written).filter((n): n is number => n !== null);
  return {
    line: { circuit, solved, check: check && solved ? check : null, computed, written, hidden, words: wordsFor(tree, parts, source, check && solved ? check : null, computed) },
    errors: [],
  };
}

const QUANTITY_LETTER: Record<AskQuantity, string> = { current: 'I', voltage: 'V', power: 'P', resistance: 'R', impedance: 'Z' };
const checkName = (c: LineCheck) => QUANTITY_LETTER[c.quantity] + (c.about ? '(' + c.about + ')' : '');

function partWords(p: Part): string {
  const what = p.kind === 'meter' ? 'a meter marked ' + (p.letter || 'G') : p.kind === 'switch' ? (p.open ? 'an open switch' : 'a closed switch') : KIND_WORD[p.kind];
  const value = p.reactance !== null
    ? ' of reactance ' + (p.reactance > 0 ? 'j' : '-j') + formatQuantity(Math.abs(p.reactance), 'Ω')
    : p.value !== null ? ' of ' + formatQuantity(p.value, p.kind === 'inductor' ? 'H' : p.kind === 'capacitor' ? 'F' : p.kind === 'voltage' ? 'V' : 'Ω') : '';
  return what + (p.label ? ' ' + p.label : '') + value + (p.unknown ? ' (shown as "?" until the answer)' : '');
}

function wordsFor(tree: Net, parts: Map<Net, Part>, source: LineSource, check: LineCheck | null, computed: string): string {
  const say = (n: Net, inner: boolean): string => {
    if (n.kind === 'leaf') return partWords(parts.get(n)!);
    const joined = n.kids.map((k) => say(k, true)).join(n.kind === 'series' ? ', in series with ' : ' in parallel with ');
    return inner ? '[' + joined + ']' : joined;
  };
  const supply = source.kind === 'none'
    ? 'between two terminals A and B'
    : 'fed by ' + (source.ac ? 'an AC ' : 'a DC ') + (source.kind === 'current' ? 'current' : 'voltage') + ' source'
      + (source.label ? ' ' + source.label : '')
      + (source.value !== null ? ' of ' + formatQuantity(source.value, source.kind === 'current' ? 'A' : 'V') : '')
      + (source.frequency ? ' at ' + formatQuantity(source.frequency, 'Hz') : '');
  return 'a circuit ' + supply + ': ' + say(tree, false) + '. Each part is drawn with its standard symbol'
    + (check ? '; solved, it gives ' + checkName(check) + ' = ' + computed + ', which is shown under it' : '') + '.';
}
