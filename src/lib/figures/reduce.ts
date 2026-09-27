// ---------------------------------------------------------------------------
// Series and parallel, combined: when a question's circuit is loads in one
// plain arrangement, the explanation can show them sliding together into the
// one equivalent resistance (src/remotion/ReduceView.tsx).
//
// Only the two arrangements a picture explains without doubt:
//
//   series    - one loop: every load, and the source, one after another;
//   parallel  - every load connected across the same two points.
//
// Anything else - a ladder, a bridge, a reactive part - gets no animation
// rather than a wrong one. Wires are merged first, so a load "across the same
// two points" means electrically, not only where it is drawn.
// ---------------------------------------------------------------------------

import type { Circuit, CircuitElement } from './circuit.ts';

export interface Reduction {
  mode: 'series' | 'parallel';
  loads: { label: string; value: number }[];
  /** The equivalent resistance, in ohms. */
  result: number;
}

const LOADS = new Set(['resistor', 'lamp']);
const SOURCES = new Set(['voltage', 'current']);

/** The one equivalent the loads make, or null when they are not simply in series or in parallel. */
export function reductionFor(circuit: Circuit | null | undefined): Reduction | null {
  if (!circuit || circuit.type !== 'circuit') return null;
  const els = circuit.elements || [];
  // Anything reactive changes the story: not a resistance to add up.
  if (els.some((e) => !LOADS.has(e.kind) && !SOURCES.has(e.kind) && e.kind !== 'wire')) return null;
  const loads = els.filter((e) => LOADS.has(e.kind));
  if (loads.length < 2 || loads.some((e) => !(e.value > 0))) return null;

  // Merge the nodes every wire joins.
  const parent = new Map<string, string>();
  const find = (n: string): string => {
    let r = n;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(n, r);
    return r;
  };
  for (const n of circuit.nodes) parent.set(n.id, n.id);
  for (const w of els.filter((e) => e.kind === 'wire')) parent.set(find(w.from), find(w.to));
  const ends = (e: CircuitElement) => [find(e.from), find(e.to)].sort().join('|');

  const described = loads.map((e) => ({ label: e.label || e.id, value: e.value }));

  // Parallel: every load across one pair of points, and no load shorted out.
  const pair = ends(loads[0]);
  const [a, b] = pair.split('|');
  if (a !== b && loads.every((e) => ends(e) === pair)) {
    return { mode: 'parallel', loads: described, result: 1 / loads.reduce((n, e) => n + 1 / e.value, 0) };
  }

  // Series: one loop through the source and every load, each point joining exactly two parts.
  const parts = els.filter((e) => LOADS.has(e.kind) || SOURCES.has(e.kind));
  const degree = new Map<string, number>();
  for (const e of parts) {
    const [x, y] = [find(e.from), find(e.to)];
    if (x === y) return null; // shorted out
    degree.set(x, (degree.get(x) || 0) + 1);
    degree.set(y, (degree.get(y) || 0) + 1);
  }
  const loop = [...degree.values()].every((d) => d === 2) && degree.size === parts.length;
  if (loop && parts.some((e) => SOURCES.has(e.kind))) {
    return { mode: 'series', loads: described, result: loads.reduce((n, e) => n + e.value, 0) };
  }
  return null;
}

/** A value in ohms, as a card shows it: at most three figures, no trailing zeros. */
export const ohms = (v: number): string => {
  const r = Number(v.toPrecision(3));
  return String(r);
};

/** The formula the reduction uses, in the card notation. */
export function reductionFormula(r: Reduction): string {
  const names = r.loads.map((_, i) => 'R_{' + (i + 1) + '}');
  return r.mode === 'series'
    ? 'R_{eq} = ' + names.join(' + ')
    : '\\frac{1}{R_{eq}} = ' + names.map((n) => '\\frac{1}{' + n + '}').join(' + ');
}

/** The same with the numbers in, ending on the answer. */
export function reductionWorking(r: Reduction): string[] {
  const vals = r.loads.map((l) => ohms(l.value));
  return r.mode === 'series'
    ? ['R_{eq} = ' + vals.join(' + '), '= ' + ohms(r.result) + '\\,\\Omega']
    : ['\\frac{1}{R_{eq}} = ' + vals.map((v) => '\\frac{1}{' + v + '}').join(' + '), 'R_{eq} = ' + ohms(r.result) + '\\,\\Omega'];
}
