// ---------------------------------------------------------------------------
// Graphs: curves from formulas, with points and answers worked out on them.
//
// RC charging, a damped response, stress against strain, supply meeting
// demand, a quadratic crossing zero: each is written as one or more formulas
// in one variable over a range. The value at a point, the roots, the maximum,
// the slope, the area and where two curves cross are all computed from the
// formula - so the point marked on the curve and the number beside it are the
// same number. A formula that cannot be read, or a range with nothing to draw
// in it, is refused.
// ---------------------------------------------------------------------------

import { area, compile, extreme, roots, slope, type Compiled } from './expression.ts';
import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, parseUnit, roundForDisplay, type UnitClass } from './quantity.ts';

export interface Axis {
  label: string;
  /** As written: "s", "V", "%", "kg". */
  unit: string;
  min: number;
  max: number;
}

export interface Curve {
  id: string;
  label: string;
  formula: string;
}

export interface Marked {
  label: string;
  x: number;
  /** Which curve the point sits on. */
  curve: string;
}

export type GraphAsk =
  | { kind: 'value'; curve: string; x: number }
  | { kind: 'root'; curve: string; target: number }
  | { kind: 'maxValue' | 'minValue' | 'maxAt' | 'minAt'; curve: string }
  | { kind: 'slope'; curve: string; x: number }
  | { kind: 'area'; curve: string; from: number; to: number }
  | { kind: 'intersection'; curves: [string, string] };

export interface Graph {
  type: 'graph';
  /** The variable the formulas are written in: "x", "t". */
  variable: string;
  x: Axis;
  y: Axis;
  curves: Curve[];
  points: Marked[];
  asymptotes: { y: number; label: string }[];
  ask?: GraphAsk;
}

const MAX_CURVES = 3;

export function normalizeGraph(raw: any): { figure: Graph | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const variable = /^[A-Za-z]$/.test(String(r.variable ?? '')) ? String(r.variable) : 'x';

  const axis = (a: any, name: string, needRange: boolean): Axis | null => {
    const o = a && typeof a === 'object' ? a : {};
    const min = num(o.min);
    const max = num(o.max);
    if (needRange && (min === null || max === null || !(max > min))) {
      errors.push('the ' + name + ' axis needs min below max');
      return null;
    }
    return { label: str(o.label, 24) || name, unit: str(o.unit, 12), min: min ?? NaN, max: max ?? NaN };
  };
  const x = axis(r.x, 'x', true);
  const y = axis(r.y, 'y', false);

  const curves: Curve[] = [];
  const compiled = new Map<string, Compiled>();
  (Array.isArray(r.curves) ? r.curves : []).slice(0, MAX_CURVES + 1).forEach((c: any, i: number) => {
    const id = str(c && c.id, 10).replace(/[^A-Za-z0-9_]/g, '') || 'c' + (i + 1);
    const formula = str(c && c.formula, 200);
    try {
      compiled.set(id, compile(formula, variable));
      curves.push({ id, label: str(c && c.label, 24) || id, formula });
    } catch (e) {
      errors.push(id + ': ' + (e as Error).message);
    }
  });
  if (!curves.length) errors.push('a graph needs at least one curve with a formula');
  if (curves.length > MAX_CURVES) errors.push('at most ' + MAX_CURVES + ' curves');

  // The curve must actually exist somewhere in the range.
  if (x) {
    for (const c of curves) {
      const f = compiled.get(c.id)!;
      let good = 0;
      for (let k = 0; k <= 100; k++) if (Number.isFinite(f(x.min + ((x.max - x.min) * k) / 100))) good++;
      if (good < 20) errors.push(c.id + ' has no drawable values between ' + x.min + ' and ' + x.max);
    }
  }

  const has = (id: string) => curves.some((c) => c.id === id);
  const first = curves[0]?.id || '';
  const points: Marked[] = (Array.isArray(r.points) ? r.points : []).slice(0, 4).flatMap((p: any) => {
    const px = num(p && p.x);
    const curve = str(p && p.curve, 10) || first;
    if (px === null || !x || px < x.min || px > x.max) { errors.push('a marked point lies outside the x range'); return []; }
    if (!has(curve)) { errors.push('a marked point sits on a curve that does not exist'); return []; }
    return [{ label: str(p && p.label, 16), x: px, curve }];
  });
  const asymptotes = (Array.isArray(r.asymptotes) ? r.asymptotes : []).slice(0, 2).flatMap((a: any) => {
    const ay = num(a && a.y);
    return ay === null ? [] : [{ y: ay, label: str(a && a.label, 20) }];
  });

  let ask: GraphAsk | undefined;
  const a = r.ask && typeof r.ask === 'object' ? r.ask : null;
  if (a) {
    const curve = str(a.curve, 10) || first;
    const kind = str(a.kind, 16);
    const inRange = (v: number | null) => v !== null && x !== null && v >= x.min && v <= x.max;
    if (kind === 'intersection') {
      const ids = Array.isArray(a.curves) ? a.curves.map((s: unknown) => str(s, 10)) : [];
      if (ids.length !== 2 || !has(ids[0]) || !has(ids[1])) errors.push('an intersection names two curves');
      else ask = { kind, curves: [ids[0], ids[1]] };
    } else if (!has(curve)) {
      errors.push('the question is about a curve that does not exist');
    } else if (kind === 'value' || kind === 'slope') {
      const ax = num(a.x);
      if (!inRange(ax)) errors.push(kind + ' needs an x inside the range');
      else ask = { kind, curve, x: ax! };
    } else if (kind === 'root') {
      ask = { kind, curve, target: num(a.target) ?? 0 };
    } else if (kind === 'area') {
      const from = num(a.from) ?? x?.min ?? 0;
      const to = num(a.to) ?? x?.max ?? 0;
      if (!inRange(from) || !inRange(to) || !(to > from)) errors.push('area needs from and to inside the range');
      else ask = { kind, curve, from, to };
    } else if (['maxValue', 'minValue', 'maxAt', 'minAt'].includes(kind)) {
      ask = { kind: kind as 'maxValue', curve };
    } else {
      errors.push('unknown question for a graph: ' + kind);
    }
  }

  const figure: Graph | null = x && y ? { type: 'graph', variable, x, y, curves, points, asymptotes, ...(ask ? { ask } : {}) } : null;
  if (figure && !errors.length && ask && answerGraph(figure) === null) errors.push('the question has no answer on this range');
  return { figure: errors.length ? null : figure, errors };
}

export const curveFunction = (g: Graph, id: string): Compiled => compile(g.curves.find((c) => c.id === id)!.formula, g.variable);

const unitClassOf = (unit: string): UnitClass => {
  const p = parseUnit(unit);
  return p && p.factor === 1 ? p.unit : '';
};

export function answerGraph(g: Graph): FigureAnswer | null {
  if (!g.ask) return null;
  const a = g.ask;
  const xu = unitClassOf(g.x.unit);
  const yu = unitClassOf(g.y.unit);
  const n = (value: number | undefined, unit: UnitClass): FigureAnswer | null =>
    value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit };
  if (a.kind === 'intersection') {
    const f = curveFunction(g, a.curves[0]);
    const h = curveFunction(g, a.curves[1]);
    const xs = roots((t) => f(t) - h(t), g.x.min, g.x.max);
    return xs.length === 1 ? n(xs[0], xu) : null;
  }
  const f = curveFunction(g, a.curve);
  switch (a.kind) {
    case 'value': return n(f(a.x), yu);
    case 'root': {
      const xs = roots(f, g.x.min, g.x.max, a.target);
      return xs.length === 1 ? n(xs[0], xu) : null;
    }
    case 'maxValue': return n(extreme(f, g.x.min, g.x.max, 'max')?.y, yu);
    case 'minValue': return n(extreme(f, g.x.min, g.x.max, 'min')?.y, yu);
    case 'maxAt': return n(extreme(f, g.x.min, g.x.max, 'max')?.x, xu);
    case 'minAt': return n(extreme(f, g.x.min, g.x.max, 'min')?.x, xu);
    case 'slope': return n(slope(f, a.x, g.x.max - g.x.min), '');
    case 'area': return n(area(f, a.from, a.to), '');
  }
  return null;
}

/** "6.32 V" when the unit is one this knows, "6.32 kg" when it is not. */
export function withUnit(value: number, unit: string): string {
  const cls = unitClassOf(unit);
  if (cls) return formatQuantity(value, cls);
  return roundForDisplay(value) + (unit ? ' ' + unit : '');
}

// --- geometry ---------------------------------------------------------------------------

/** 1, 2 or 5 times a power of ten, giving 4 to 8 ticks across the range. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target + 1) || 10 * mag;
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return ticks;
}

export interface GraphLayout {
  plot: { left: number; top: number; right: number; bottom: number };
  xRange: [number, number];
  yRange: [number, number];
  xTicks: number[];
  yTicks: number[];
  toX: (v: number) => number;
  toY: (v: number) => number;
  /** Each curve as drawable runs: a break wherever the curve leaves the range or stops being finite. */
  paths: { curve: Curve; runs: [number, number][][] }[];
  points: {
    point: Marked; x: number; y: number; px: number; py: number;
    /** Where its "(x, y)" label goes: the first spot round the point that no curve crosses. */
    label: {
      text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end';
      box: { x1: number; y1: number; x2: number; y2: number };
      /** False when no spot clear of every curve was found. The test holds this true. */
      clear: boolean;
    };
  }[];
}

export function layoutGraph(g: Graph, width: number, height: number, font: number, samples = 300): GraphLayout {
  const fns = new Map(g.curves.map((c) => [c.id, curveFunction(g, c.id)]));
  let yMin = g.y.min;
  let yMax = g.y.max;
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || !(yMax > yMin)) {
    // Fit the range to what is drawn, trimming the extreme 1% so a near-pole
    // spike does not flatten everything else.
    const ys: number[] = [];
    for (const f of fns.values()) {
      for (let k = 0; k <= samples; k++) {
        const v = f(g.x.min + ((g.x.max - g.x.min) * k) / samples);
        if (Number.isFinite(v)) ys.push(v);
      }
    }
    for (const a of g.asymptotes) ys.push(a.y);
    ys.sort((p, q) => p - q);
    const lo = ys[Math.floor(ys.length * 0.01)] ?? 0;
    const hi = ys[Math.ceil(ys.length * 0.99) - 1] ?? 1;
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
    yMin = Number.isFinite(g.y.min) ? g.y.min : lo - pad;
    yMax = Number.isFinite(g.y.max) ? g.y.max : hi + pad;
    // Start from zero when the data sits close to it, as a reader expects.
    if (!Number.isFinite(g.y.min) && lo >= 0 && lo < (hi - lo) * 0.5) yMin = 0;
  }
  const yTicks = niceTicks(yMin, yMax);
  const xTicks = niceTicks(g.x.min, g.x.max);
  const tickText = (v: number) => roundForDisplay(v);
  const leftRoom = Math.max(...yTicks.map((v) => tickText(v).length)) * font * 0.62 * 0.8 + 24;
  const plot = { left: leftRoom + font * 1.2, top: font * 1.4, right: width - 24, bottom: height - font * 2.6 };
  const toX = (v: number) => plot.left + ((v - g.x.min) / (g.x.max - g.x.min)) * (plot.right - plot.left);
  const toY = (v: number) => plot.bottom - ((v - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);

  const paths = g.curves.map((curve) => {
    const f = fns.get(curve.id)!;
    const runs: [number, number][][] = [];
    let run: [number, number][] = [];
    for (let k = 0; k <= samples; k++) {
      const xv = g.x.min + ((g.x.max - g.x.min) * k) / samples;
      const yv = f(xv);
      const inside = Number.isFinite(yv) && yv >= yMin - (yMax - yMin) * 0.02 && yv <= yMax + (yMax - yMin) * 0.02;
      if (inside) run.push([toX(xv), toY(Math.max(yMin, Math.min(yMax, yv)))]);
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    return { curve, runs: runs.filter((r) => r.length > 1) };
  });

  // A label may not sit on a curve: the first render hid "τ" under the RC curve
  // and wrote "equilibrium" along the supply line.
  const drawn = paths.flatMap((p) => p.runs.flat());
  const small = font * 0.62 * 1.15;
  const points = g.points.map((point) => {
    const yv = fns.get(point.curve)!(point.x);
    const px = toX(point.x);
    const py = toY(yv);
    const text = (point.label ? point.label + ': ' : '') + '(' + withUnit(point.x, g.x.unit) + ', ' + withUnit(yv, g.y.unit) + ')';
    const w = text.length * small * 0.6;
    // Beside the point first; then centred above and below it, further out each
    // time - where two lines cross at a shallow angle, every spot beside the
    // point lies on one of them.
    const candidates: [number, number, 'start' | 'middle' | 'end'][] = [
      [18, -18, 'start'], [18, small + 18, 'start'], [-18, -18, 'end'], [-18, small + 18, 'end'],
      [18, -small * 2.2, 'start'], [-18, -small * 2.2, 'end'], [18, small * 2.6, 'start'], [-18, small * 2.6, 'end'],
    ];
    for (let n = 1; n <= 8; n++) {
      candidates.push([0, -small * (1 + n), 'middle'], [0, small * (1.6 + n), 'middle']);
    }
    const boxOf = ([dx, dy, anchor]: [number, number, 'start' | 'middle' | 'end']) => {
      const x = px + dx;
      const y = py + dy;
      const x1 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      return { x, y, anchor, box: { x1, x2: x1 + w, y1: y - small, y2: y + small * 0.3 } };
    };
    const fits = (b: { x1: number; y1: number; x2: number; y2: number }) =>
      b.x1 >= plot.left && b.x2 <= plot.right && b.y1 >= plot.top - small && b.y2 <= plot.bottom &&
      !drawn.some(([cx, cy]) => cx > b.x1 - 6 && cx < b.x2 + 6 && cy > b.y1 - 6 && cy < b.y2 + 6);
    const found = candidates.map(boxOf).find((c) => fits(c.box));
    const chosen = found || boxOf(candidates[0]);
    return { point, x: point.x, y: yv, px, py, label: { text, ...chosen, clear: !!found } };
  });
  return { plot, xRange: [g.x.min, g.x.max], yRange: [yMin, yMax], xTicks, yTicks, toX, toY, paths, points };
}

export function graphAskText(g: Graph, reveal: boolean): string {
  if (!g.ask) return '';
  const a = g.ask;
  const name = (id: string) => g.curves.find((c) => c.id === id)?.label || id;
  const x = (v: number) => g.variable + ' = ' + withUnit(v, g.x.unit);
  const lead =
    a.kind === 'value' ? name(a.curve) + ' at ' + x(a.x)
    : a.kind === 'root' ? g.variable + ' where ' + name(a.curve) + ' = ' + withUnit(a.target, g.y.unit)
    : a.kind === 'maxValue' ? 'Largest ' + name(a.curve)
    : a.kind === 'minValue' ? 'Smallest ' + name(a.curve)
    : a.kind === 'maxAt' ? g.variable + ' at the largest ' + name(a.curve)
    : a.kind === 'minAt' ? g.variable + ' at the smallest ' + name(a.curve)
    : a.kind === 'slope' ? 'Slope of ' + name(a.curve) + ' at ' + x(a.x)
    : a.kind === 'area' ? 'Area under ' + name(a.curve)
    : g.variable + ' where ' + name((a as Extract<GraphAsk, { kind: 'intersection' }>).curves[0]) + ' meets ' + name((a as Extract<GraphAsk, { kind: 'intersection' }>).curves[1]);
  const ans = answerGraph(g);
  if (!reveal || !ans || ans.kind !== 'number') return lead + ' = ?';
  const unit = ['root', 'maxAt', 'minAt', 'intersection'].includes(a.kind) ? g.x.unit
    : ['value', 'maxValue', 'minValue'].includes(a.kind) ? g.y.unit : '';
  return lead + ' = ' + withUnit(ans.value, unit);
}

export const GRAPH_FAMILY: FigureFamily<Graph> = {
  type: 'graph',
  label: 'curves plotted from formulas, with values, roots, maxima, slopes, areas and crossings worked out on them.',
  fits: /electric|electronic|control|signal|network|circuit|power|machine|math|algebra|calculus|physics|chemistry|engineering|economic|statistic|probability|interest|growth|population|depreciation|measurement|material|transmission|trigonometry|geometry|data interpretation|renewable|generation/i,
  setupSafe: false,
  normalize: normalizeGraph,
  answer: answerGraph,
  docs: [
    '{"type":"graph","variable":"t","x":{"label":"time","unit":"s","min":0,"max":10},"y":{"label":"Vc","unit":"V"},',
    ' "curves":[{"id":"vc","label":"Vc","formula":"10*(1-exp(-t/2))"}],"points":[{"label":"τ","x":2,"curve":"vc"}],',
    ' "asymptotes":[{"y":10,"label":"10 V"}],"ask":{"kind":"value","curve":"vc","x":2}}',
    'formulas use the one variable with + - * / ^, brackets, pi, e and sin cos tan (radians), sind cosd tand',
    '(degrees), exp ln log sqrt abs min max. 1 to 3 curves. y min/max may be left out to fit the curves.',
    'ask kinds: value (curve, x), root (curve, target y, default 0), maxValue, minValue, maxAt, minAt (curve),',
    'slope (curve, x), area (curve, from, to), intersection (curves: [a, b]). Graphs are never shown on the',
    'question scene - a plotted curve gives the answer away - only on the explain scenes.',
  ],
};
