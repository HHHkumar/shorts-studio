// ---------------------------------------------------------------------------
// Circuits: described as a netlist on a grid, SOLVED, and only then drawn.
//
// Why a netlist and not a picture. The old circuit sketch had a mode and a
// count, so a question about a 2 Ω resistor in series with 6 Ω and 3 Ω in
// parallel could only ever be drawn as "some resistors in parallel". Here the
// model writes down the circuit itself - which parts, their values, which
// nodes they join - and every number on screen is computed from that by
// nodal analysis. The drawing and the arithmetic come from the same netlist,
// so the picture cannot show one circuit while the answer belongs to another.
//
// Placement is the model's job, and deliberately coarse: nodes sit on a small
// grid and every part runs straight along a row or down a column between two
// of them. That is how exam circuits are drawn anyway, and it is simple enough
// to validate completely - no diagonals, no crossings, no part running through
// a node it does not connect to.
// ---------------------------------------------------------------------------

import { formatQuantity, parseUnit, type UnitClass } from './quantity.ts';

export type ElementKind = 'resistor' | 'lamp' | 'inductor' | 'capacitor' | 'voltage' | 'current' | 'wire';
export const ELEMENT_KINDS: ElementKind[] = ['resistor', 'lamp', 'inductor', 'capacitor', 'voltage', 'current', 'wire'];

export type AskQuantity = 'current' | 'voltage' | 'power' | 'resistance' | 'impedance';
export const ASK_QUANTITIES: AskQuantity[] = ['current', 'voltage', 'power', 'resistance', 'impedance'];

export interface CircuitNode {
  id: string;
  col: number;
  row: number;
}

export interface CircuitElement {
  id: string;
  kind: ElementKind;
  /** For a source, `from` is the negative terminal and `to` the positive one. */
  from: string;
  to: string;
  /** In base units: ohms, henries, farads, volts (RMS for AC), amperes. 0 for a wire. */
  value: number;
  /** Drawn as "?" until the answer is revealed. The value is still the true one. */
  unknown: boolean;
  /** What to call it on screen. Defaults to the id. */
  label: string;
}

export interface CircuitAsk {
  quantity: AskQuantity;
  element?: string;
  from?: string;
  to?: string;
}

export interface Circuit {
  type: 'circuit';
  title: string;
  /** Hz. 0 is DC: inductors conduct, capacitors block. */
  frequency: number;
  nodes: CircuitNode[];
  elements: CircuitElement[];
  ask?: CircuitAsk;
}

/** The grid is small on purpose: past this, labels collide on a phone screen. */
export const MAX_COL = 4;
export const MAX_ROW = 3;
const MAX_NODES = 12;
const MAX_ELEMENTS = 10;

const BASE_UNIT: Record<ElementKind, UnitClass> = {
  resistor: 'Ω', lamp: 'Ω', inductor: 'H', capacitor: 'F', voltage: 'V', current: 'A', wire: '',
};

export const ASK_UNIT: Record<AskQuantity, UnitClass> = {
  current: 'A', voltage: 'V', power: 'W', resistance: 'Ω', impedance: 'Ω',
};

// --- reading what the model wrote ----------------------------------------------

const str = (v: unknown, max = 24): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (v: unknown): string => str(v, 8).replace(/[^A-Za-z0-9_]/g, '');

/**
 * A value in base units from what the model wrote. It may give "value": 2.2
 * with "unit": "kΩ", or the value already in ohms with no unit. A unit that
 * belongs to a different kind of part ("mH" on a resistor) is refused rather
 * than guessed at.
 */
export function elementValue(kind: ElementKind, value: unknown, unit: unknown): number | null {
  if (kind === 'wire') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const u = str(unit, 12);
  if (!u) return n;
  const parsed = parseUnit(u);
  if (!parsed) return null;
  if (parsed.unit && parsed.unit !== BASE_UNIT[kind]) return null;
  return n * parsed.factor;
}

type Segment = { x1: number; y1: number; x2: number; y2: number };

function between(v: number, a: number, b: number): boolean {
  return v > Math.min(a, b) && v < Math.max(a, b);
}

/** Every reason this circuit cannot be drawn honestly. Empty means it can. */
export function normalizeCircuit(raw: any): { circuit: Circuit | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};

  const nodes: CircuitNode[] = [];
  for (const n of Array.isArray(r.nodes) ? r.nodes : []) {
    const nid = id(n && n.id);
    const col = Number(n && n.col);
    const row = Number(n && n.row);
    if (!nid) { errors.push('a node has no id'); continue; }
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col > MAX_COL || row > MAX_ROW) {
      errors.push('node ' + nid + ' is off the grid (columns 0-' + MAX_COL + ', rows 0-' + MAX_ROW + ')');
      continue;
    }
    if (nodes.some((m) => m.id === nid)) { errors.push('two nodes are called ' + nid); continue; }
    if (nodes.some((m) => m.col === col && m.row === row)) { errors.push('node ' + nid + ' sits on top of another node'); continue; }
    nodes.push({ id: nid, col, row });
  }
  if (nodes.length < 2) errors.push('a circuit needs at least two nodes');
  if (nodes.length > MAX_NODES) errors.push('more than ' + MAX_NODES + ' nodes');

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const elements: CircuitElement[] = [];
  for (const e of Array.isArray(r.elements) ? r.elements : []) {
    const eid = id(e && e.id);
    const kind = str(e && e.kind) as ElementKind;
    const from = id(e && e.from);
    const to = id(e && e.to);
    if (!eid) { errors.push('a part has no id'); continue; }
    if (!ELEMENT_KINDS.includes(kind)) { errors.push(eid + ' is an unknown kind of part: ' + (kind || 'none')); continue; }
    if (elements.some((m) => m.id === eid)) { errors.push('two parts are called ' + eid); continue; }
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) { errors.push(eid + ' connects to a node that does not exist'); continue; }
    if (a === b) { errors.push(eid + ' connects a node to itself'); continue; }
    if (a.col !== b.col && a.row !== b.row) { errors.push(eid + ' runs diagonally; parts must run along a row or a column'); continue; }
    const value = elementValue(kind, e && e.value, e && e.unit);
    if (value === null) { errors.push(eid + ' has no usable value'); continue; }
    if (kind !== 'wire' && !(value > 0)) { errors.push(eid + ' must have a positive value'); continue; }
    elements.push({
      id: eid, kind, from, to, value,
      unknown: Boolean(e && e.unknown) && kind !== 'wire',
      label: str(e && e.label, 10) || eid,
    });
  }
  if (!elements.length) errors.push('a circuit needs at least one part');
  if (elements.length > MAX_ELEMENTS) errors.push('more than ' + MAX_ELEMENTS + ' parts');

  // Geometry: what is drawn must be exactly what is connected.
  const seg = (e: CircuitElement): Segment => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return { x1: a.col, y1: a.row, x2: b.col, y2: b.row };
  };
  for (let i = 0; i < elements.length; i++) {
    const s = seg(elements[i]);
    for (const n of nodes) {
      if (n.id === elements[i].from || n.id === elements[i].to) continue;
      const onVertical = s.x1 === s.x2 && n.col === s.x1 && between(n.row, s.y1, s.y2);
      const onHorizontal = s.y1 === s.y2 && n.row === s.y1 && between(n.col, s.x1, s.x2);
      if (onVertical || onHorizontal) errors.push(elements[i].id + ' runs straight through node ' + n.id + ' without connecting to it');
    }
    for (let j = i + 1; j < elements.length; j++) {
      const t = seg(elements[j]);
      const sHor = s.y1 === s.y2;
      const tHor = t.y1 === t.y2;
      if (sHor === tHor) {
        const sameLine = sHor ? s.y1 === t.y1 : s.x1 === t.x1;
        if (!sameLine) continue;
        const [a1, a2] = sHor ? [s.x1, s.x2] : [s.y1, s.y2];
        const [b1, b2] = sHor ? [t.x1, t.x2] : [t.y1, t.y2];
        const overlap = Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
        if (overlap > 0) errors.push(elements[i].id + ' and ' + elements[j].id + ' are drawn on top of each other');
      } else {
        const h = sHor ? s : t;
        const v = sHor ? t : s;
        if (between(v.x1, h.x1, h.x2) && between(h.y1, v.y1, v.y2)) {
          errors.push(elements[i].id + ' and ' + elements[j].id + ' cross without joining');
        }
      }
    }
  }

  // Connected: a part of the drawing that touches nothing else is a mistake.
  if (nodes.length && elements.length) {
    const seen = new Set([nodes[0].id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of elements) {
        if (seen.has(e.from) !== seen.has(e.to)) { seen.add(e.from); seen.add(e.to); grew = true; }
      }
    }
    const loose = nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
    if (loose.length) errors.push('not everything is connected: ' + loose.join(', '));
  }

  let ask: CircuitAsk | undefined;
  if (r.ask && typeof r.ask === 'object' && ASK_QUANTITIES.includes(r.ask.quantity)) {
    const quantity = r.ask.quantity as AskQuantity;
    const element = id(r.ask.element);
    const from = id(r.ask.from);
    const to = id(r.ask.to);
    const hasElement = element && elements.some((e) => e.id === element);
    const hasNodes = from && to && from !== to && byId.has(from) && byId.has(to);
    if (quantity === 'resistance' || quantity === 'impedance') {
      if (hasNodes) ask = { quantity, from, to };
      else if (hasElement) ask = { quantity, element };
      else errors.push('the question asks for ' + quantity + ' but not between which two nodes');
    } else if (quantity === 'voltage' && hasNodes && !hasElement) {
      ask = { quantity, from, to };
    } else if (hasElement) {
      ask = { quantity, element };
    } else {
      errors.push('the question asks for ' + quantity + ' of a part that is not in the circuit');
    }
  }

  const needsSource = !ask || (ask.quantity !== 'resistance' && ask.quantity !== 'impedance');
  if (needsSource && elements.length && !elements.some((e) => e.kind === 'voltage' || e.kind === 'current')) {
    errors.push('nothing drives this circuit: add a voltage or current source');
  }

  const frequency = Number(r.frequency);
  const circuit: Circuit = {
    type: 'circuit',
    title: str(r.title, 60),
    frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : 0,
    nodes,
    elements,
    ask,
  };
  return { circuit: errors.length ? null : circuit, errors };
}

// --- complex arithmetic, just enough for AC ------------------------------------

export interface Complex { re: number; im: number }
const cx = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
const mul = (a: Complex, b: Complex): Complex => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const magnitude = (a: Complex): number => Math.hypot(a.re, a.im);
const conj = (a: Complex): Complex => cx(a.re, -a.im);

/** Gaussian elimination with partial pivoting. Null when the system is singular. */
function solveLinear(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (magnitude(M[r][col]) > magnitude(M[pivot][col])) pivot = r;
    if (magnitude(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = div(M[r][col], M[col][col]);
      if (magnitude(f) === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] = sub(M[r][c], mul(f, M[col][c]));
    }
  }
  return M.map((row, i) => div(row[n], row[i]));
}

// --- nodal analysis --------------------------------------------------------------

export interface ElementResult {
  /** Drop from `from` to `to`. */
  voltage: Complex;
  /** Flowing from `from` to `to` through the part. */
  current: Complex;
  /** Real power absorbed; negative for a source that delivers. */
  power: number;
}

export interface CircuitSolution {
  nodeVoltage: Record<string, Complex>;
  elements: Record<string, ElementResult>;
}

/**
 * Modified nodal analysis. Each part that fixes a voltage - a source, a wire,
 * an inductor at DC - gets its current as an extra unknown; everything else is
 * an admittance between two nodes. With `testFrom`/`testTo` the independent
 * sources are switched off (voltage sources shorted, current sources opened)
 * and one ampere is pushed in at `testFrom`, which is how an equivalent
 * resistance between two terminals is found.
 */
export function solveCircuit(c: Circuit, test?: { from: string; to: string }): CircuitSolution | null {
  const omega = 2 * Math.PI * c.frequency;
  const ground = test ? test.to : (c.elements.find((e) => e.kind === 'voltage')?.from || c.nodes[0].id);
  const index = new Map<string, number>();
  for (const n of c.nodes) if (n.id !== ground) index.set(n.id, index.size);

  type Fixed = { element: CircuitElement; volts: number };
  const fixed: Fixed[] = [];
  // A source wired straight across the two terminals being measured is what
  // the question means by "the resistance the source sees". Shorting it, as
  // switching off a source normally does, would short the terminals and read
  // zero; it is taken out of the circuit instead.
  const across = (e: CircuitElement) =>
    !!test && ((e.from === test.from && e.to === test.to) || (e.from === test.to && e.to === test.from));
  for (const e of c.elements) {
    if (e.kind === 'voltage' && across(e)) continue;
    if (e.kind === 'voltage') fixed.push({ element: e, volts: test ? 0 : e.value });
    else if (e.kind === 'wire' || (e.kind === 'inductor' && omega === 0)) fixed.push({ element: e, volts: 0 });
  }

  const size = index.size + fixed.length;
  const A: Complex[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => cx(0)));
  const b: Complex[] = Array.from({ length: size }, () => cx(0));
  const at = (node: string) => index.get(node);

  const admittance = (e: CircuitElement): Complex | null => {
    if (e.kind === 'resistor' || e.kind === 'lamp') return cx(1 / e.value);
    if (e.kind === 'inductor' && omega > 0) return div(cx(1), cx(0, omega * e.value));
    if (e.kind === 'capacitor' && omega > 0) return cx(0, omega * e.value);
    return null;
  };

  for (const e of c.elements) {
    const y = admittance(e);
    if (!y) continue;
    const i = at(e.from);
    const j = at(e.to);
    if (i !== undefined) A[i][i] = add(A[i][i], y);
    if (j !== undefined) A[j][j] = add(A[j][j], y);
    if (i !== undefined && j !== undefined) {
      A[i][j] = sub(A[i][j], y);
      A[j][i] = sub(A[j][i], y);
    }
  }

  fixed.forEach(({ element: e, volts }, k) => {
    const row = index.size + k;
    const i = at(e.from);
    const j = at(e.to);
    // The branch current leaves `from` and arrives at `to`.
    if (i !== undefined) { A[i][row] = add(A[i][row], cx(1)); A[row][i] = sub(A[row][i], cx(1)); }
    if (j !== undefined) { A[j][row] = sub(A[j][row], cx(1)); A[row][j] = add(A[row][j], cx(1)); }
    // V(to) - V(from) = volts.
    b[row] = cx(volts);
  });

  // Unknowns are node voltages, so injected currents go on the right-hand side.
  const inject = (node: string, amps: number) => {
    const i = at(node);
    if (i !== undefined) b[i] = add(b[i], cx(amps));
  };
  if (!test) {
    for (const e of c.elements) {
      if (e.kind !== 'current') continue;
      inject(e.from, -e.value);
      inject(e.to, e.value);
    }
  } else {
    inject(test.from, 1);
    inject(test.to, -1);
  }

  const x = size ? solveLinear(A, b) : [];
  if (!x) return null;

  const nodeVoltage: Record<string, Complex> = {};
  for (const n of c.nodes) nodeVoltage[n.id] = n.id === ground ? cx(0) : x[index.get(n.id)!];

  const elements: Record<string, ElementResult> = {};
  for (const e of c.elements) {
    const voltage = sub(nodeVoltage[e.from], nodeVoltage[e.to]);
    let current = cx(0);
    const k = fixed.findIndex((f) => f.element === e);
    if (k >= 0) current = x[index.size + k];
    else if (e.kind === 'current') current = cx(test ? 0 : e.value);
    else {
      const y = admittance(e);
      if (y) current = mul(voltage, y);
    }
    elements[e.id] = { voltage, current, power: mul(voltage, conj(current)).re };
  }
  return { nodeVoltage, elements };
}

/** The number the question asks for, in base units, or null if it cannot be found. */
export function answerCircuit(c: Circuit): { value: number; unit: UnitClass } | null {
  if (!c.ask) return null;
  const { quantity, element, from, to } = c.ask;
  const unit = ASK_UNIT[quantity];

  if (quantity === 'resistance' || quantity === 'impedance') {
    let a = from;
    let z = to;
    if (element) {
      // A part's own opposition, not the network's across its terminals.
      const e = c.elements.find((m) => m.id === element);
      if (!e) return null;
      const omega = 2 * Math.PI * c.frequency;
      if (e.kind === 'resistor' || e.kind === 'lamp') return { value: e.value, unit };
      if (e.kind === 'inductor' && omega > 0) return { value: quantity === 'resistance' ? 0 : omega * e.value, unit };
      if (e.kind === 'capacitor' && omega > 0) return { value: quantity === 'resistance' ? 0 : 1 / (omega * e.value), unit };
      return null;
    }
    if (!a || !z) return null;
    const s = solveCircuit(c, { from: a, to: z });
    if (!s) return null;
    const v = sub(s.nodeVoltage[a], s.nodeVoltage[z]);
    const value = quantity === 'resistance' ? v.re : magnitude(v);
    return Number.isFinite(value) ? { value, unit } : null;
  }

  const s = solveCircuit(c);
  if (!s) return null;
  if (quantity === 'voltage' && from && to) {
    return { value: magnitude(sub(s.nodeVoltage[from], s.nodeVoltage[to])), unit };
  }
  const r = element ? s.elements[element] : undefined;
  if (!r) return null;
  if (quantity === 'current') return { value: magnitude(r.current), unit };
  if (quantity === 'voltage') return { value: magnitude(r.voltage), unit };
  return { value: Math.abs(r.power), unit };
}

/** "R1 = 4 Ω", or "R1 = ?" while the value is still being asked. */
export function elementText(e: CircuitElement, reveal: boolean): string {
  if (e.kind === 'wire') return '';
  const shown = e.unknown && !reveal ? '?' : formatQuantity(e.value, BASE_UNIT[e.kind]);
  return e.label + ' = ' + shown;
}

// --- layout ------------------------------------------------------------------------

export interface PlacedNode { id: string; x: number; y: number; degree: number }

export interface LabelLayout {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  /** One line along a row; name and value on two lines down a column. */
  twoLines: boolean;
  /** The space the label takes, for checking it stays inside the frame. */
  box: { x1: number; y1: number; x2: number; y2: number };
}

export interface PlacedElement {
  element: CircuitElement;
  x1: number; y1: number; x2: number; y2: number;
  /** Where the symbol sits, and how long it is. */
  mx: number; my: number; length: number;
  vertical: boolean;
  /** Which side of the part its label goes on. */
  labelSide: 'above' | 'below' | 'left' | 'right';
  label: LabelLayout | null;
}

export interface CircuitLayout {
  nodes: PlacedNode[];
  elements: PlacedElement[];
  spacing: number;
}

/**
 * Widest a character of label text can be, as a fraction of the font size.
 * Monospace faces are the widest the themes use; sizing for them means a
 * narrower face only ever leaves spare room.
 */
export const CHAR_WIDTH = 0.62;

/** How far a label stands off its part: further for the round symbols. */
const reachFor = (e: CircuitElement) => (e.kind === 'voltage' || e.kind === 'current' || e.kind === 'lamp' ? 58 : 40);

/**
 * Where a label goes, measured with its revealed text - the longest it will
 * ever be - so revealing the answer never moves anything.
 */
export function placeLabel(
  e: CircuitElement, mx: number, my: number, vertical: boolean,
  side: PlacedElement['labelSide'], font: number,
): LabelLayout | null {
  const text = elementText(e, true);
  if (!text) return null;
  const reach = reachFor(e);
  if (!vertical) {
    const width = text.length * font * CHAR_WIDTH;
    const y = side === 'above' ? my - reach - 6 : my + reach + font * 0.8;
    return { x: mx, y, anchor: 'middle', twoLines: false, box: { x1: mx - width / 2, x2: mx + width / 2, y1: y - font, y2: y + font * 0.3 } };
  }
  const [name, value] = text.split(' = ');
  const width = Math.max(name.length, value.length) * font * CHAR_WIDTH;
  const right = side === 'right';
  const x = right ? mx + reach : mx - reach;
  const y = my - font * 0.15;
  return {
    x, y, anchor: right ? 'start' : 'end', twoLines: true,
    box: { x1: right ? x : x - width, x2: right ? x + width : x, y1: y - font, y2: y + font * 1.35 },
  };
}

/**
 * Fits the grid into a box.
 *
 * The margins are not fixed: they are however much room the outermost labels
 * need. A fixed margin cut "230 V" and "31.8 mH" off at the edges of the frame,
 * and a figure with half a value on it is a figure with a wrong value on it.
 */
export function layoutCircuit(c: Circuit, width: number, height: number, font = 36): CircuitLayout {
  const cols = c.nodes.map((n) => n.col);
  const rows = c.nodes.map((n) => n.row);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const byId = new Map(c.nodes.map((n) => [n.id, n]));
  const midCol = (minCol + maxCol) / 2;
  const midRow = (minRow + maxRow) / 2;

  // Sides are decided on the grid, before anything is measured in pixels.
  const sideOf = (e: CircuitElement): PlacedElement['labelSide'] => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    if (a.col === b.col) return a.col >= midCol ? 'right' : 'left';
    return a.row > midRow ? 'below' : 'above';
  };

  // Room each edge needs for the labels that sit against it.
  let left = 24, right = 24, top = 24, bottom = 24;
  for (const e of c.elements) {
    const label = placeLabel(e, 0, 0, sideOf(e) === 'left' || sideOf(e) === 'right', sideOf(e), font);
    if (!label) continue;
    const a = byId.get(e.from)!;
    const side = sideOf(e);
    if (side === 'left' && a.col === minCol) left = Math.max(left, -label.box.x1 + 12);
    if (side === 'right' && a.col === maxCol) right = Math.max(right, label.box.x2 + 12);
    if (side === 'above' && a.row === minRow) top = Math.max(top, -label.box.y1 + 12);
    if (side === 'below' && a.row === maxRow) bottom = Math.max(bottom, label.box.y2 + 12);
  }
  // Terminal letters sit above their node.
  if (c.ask?.from || c.ask?.to) top = Math.max(top, font + 36);

  const colSpan = Math.max(1, maxCol - minCol);
  const rowSpan = Math.max(1, maxRow - minRow);
  const spacing = Math.max(0, Math.min((width - left - right) / colSpan, (height - top - bottom) / rowSpan, 340));
  const gridW = spacing * (maxCol - minCol);
  const gridH = spacing * (maxRow - minRow);
  const ox = left + (width - left - right - gridW) / 2;
  const oy = top + (height - top - bottom - gridH) / 2;

  const pos = new Map<string, { x: number; y: number }>();
  for (const n of c.nodes) pos.set(n.id, { x: ox + (n.col - minCol) * spacing, y: oy + (n.row - minRow) * spacing });
  const degree = new Map<string, number>();
  for (const e of c.elements) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }

  return {
    spacing,
    nodes: c.nodes.map((n) => ({ id: n.id, ...pos.get(n.id)!, degree: degree.get(n.id) || 0 })),
    elements: c.elements.map((e) => {
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const vertical = a.x === b.x;
      const segment = Math.hypot(b.x - a.x, b.y - a.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const labelSide = sideOf(e);
      return {
        element: e, x1: a.x, y1: a.y, x2: b.x, y2: b.y, mx, my, vertical, labelSide,
        length: e.kind === 'wire' ? 0 : Math.min(segment * 0.62, 140),
        label: placeLabel(e, mx, my, vertical, labelSide, font),
      };
    }),
  };
}

import type { FigureFamily } from './family.ts';

export const CIRCUIT_FAMILY: FigureFamily<Circuit> = {
  type: 'circuit',
  label: 'a circuit of sources, resistors, lamps, inductors and capacitors, solved by nodal analysis.',
  fits: /electrical|network|circuit|ohm|kirchhoff|thevenin|norton|superposition|resonance|impedance|measurement|bridge|electronics|power factor|power systems|machines|utili[sz]ation|wiring/i,
  normalize: (raw) => { const r = normalizeCircuit(raw); return { figure: r.circuit, errors: r.errors }; },
  answer: (c) => {
    const a = answerCircuit(c);
    return a ? { kind: 'number', value: a.value, unit: a.unit } : null;
  },
  docs: [
    'Nodes sit on a grid, col 0 to 4 and row 0 to 3. Every part runs straight along a row or down a',
    'column between two nodes. kinds: resistor, lamp, inductor, capacitor, voltage (a source), current',
    '(a source), wire. value with unit: "Ω", "kΩ", "V", "A", "mH", "µF". For a source "from" is the',
    'negative terminal and "to" the positive. frequency: 0 for DC, else Hz, with AC values as RMS.',
    'Parts must not cross, overlap, or run through a node they do not join - two parts in parallel',
    'each get their own column, joined by wires.',
    'ask: {"quantity":"current"|"voltage"|"power","element":id} or',
    '{"quantity":"voltage"|"resistance"|"impedance","from":node,"to":node}. Mark a part "unknown": true',
    'only when its own value is the answer, and still give that value.',
    'Example, 10 V feeding 2 Ω then 6 Ω and 3 Ω in parallel, asking the current in the 3 Ω:',
    '{"type":"circuit","frequency":0,"nodes":[{"id":"A","col":0,"row":0},{"id":"B","col":2,"row":0},',
    '{"id":"C","col":4,"row":0},{"id":"D","col":4,"row":2},{"id":"E","col":2,"row":2},{"id":"F","col":0,"row":2}],',
    '"elements":[{"id":"V1","kind":"voltage","from":"F","to":"A","value":10,"unit":"V"},',
    '{"id":"R1","kind":"resistor","from":"A","to":"B","value":2,"unit":"Ω"},',
    '{"id":"R2","kind":"resistor","from":"B","to":"E","value":6,"unit":"Ω"},{"id":"W1","kind":"wire","from":"B","to":"C"},',
    '{"id":"R3","kind":"resistor","from":"C","to":"D","value":3,"unit":"Ω"},{"id":"W2","kind":"wire","from":"D","to":"E"},',
    '{"id":"W3","kind":"wire","from":"E","to":"F"}],"ask":{"quantity":"current","element":"R3"}}',
  ],
};
