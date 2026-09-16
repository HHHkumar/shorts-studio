// ---------------------------------------------------------------------------
// The power triangle, and power-factor correction drawn on top of it.
//
// P along the bottom, Q up the side (inductive, lagging - down for leading),
// S the hypotenuse, φ at the origin. The model states any two of P, Q, S and
// the power factor; the other two are worked out, and a pair that cannot
// belong to one triangle - S smaller than P, a power factor above one - is
// refused rather than drawn. For correction it states the target power
// factor, and the capacitor's kVAR follows from Qc = P (tan φ1 - tan φ2); with
// a voltage and a frequency, so do the capacitance and the line current.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './quantity.ts';

export type TriangleAsk =
  | 'real' | 'reactive' | 'apparent' | 'angle' | 'powerFactor'
  | 'capacitorReactive' | 'capacitance' | 'newApparent' | 'currentBefore' | 'currentAfter';
export const TRIANGLE_ASKS: TriangleAsk[] = ['real', 'reactive', 'apparent', 'angle', 'powerFactor', 'capacitorReactive', 'capacitance', 'newApparent', 'currentBefore', 'currentAfter'];

export interface PowerTriangle {
  type: 'power-triangle';
  /** Watts. */
  real: number;
  /** VAR, positive for a lagging (inductive) load. */
  reactive: number;
  /** Target power factor after correction, lagging. Absent when there is no correction. */
  targetPf?: number;
  /** Supply voltage, V - line voltage for three-phase. Needed for capacitance and current. */
  voltage?: number;
  frequency?: number;
  phases: 1 | 3;
  ask?: TriangleAsk;
}

/** "8 kW" -> 8000, refusing a unit that belongs to another side ("8 kVA" for P). */
function power(raw: unknown, unit: UnitClass): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const q = parseQuantity(String(raw ?? ''));
  if (!q) return null;
  if (q.unit && q.unit !== unit) return null;
  return q.value;
}

export function normalizeTriangle(raw: any): { figure: PowerTriangle | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const lagging = r.lagging !== false && r.leading !== true;

  const given = {
    P: r.real !== undefined ? power(r.real, 'W') : null,
    Q: r.reactive !== undefined ? power(r.reactive, 'VAR') : null,
    S: r.apparent !== undefined ? power(r.apparent, 'VA') : null,
    pf: r.powerFactor !== undefined ? num(r.powerFactor) : null,
  };
  for (const [k, field, unit] of [['P', 'real', 'W'], ['Q', 'reactive', 'VAR'], ['S', 'apparent', 'VA']] as const) {
    if (r[field] !== undefined && given[k] === null) errors.push(field + ' must be a power in ' + unit + ', e.g. "8 k' + unit + '"');
  }
  if (given.pf !== null && !(given.pf > 0 && given.pf <= 1)) errors.push('a power factor lies between 0 and 1');
  const count = [given.P, given.Q, given.S, given.pf].filter((v) => v !== null).length;
  if (count < 2) errors.push('give two of real, reactive, apparent and powerFactor');

  let P = 0;
  let Q = 0;
  if (!errors.length) {
    const { P: p, Q: q, S: s, pf } = given;
    if (p !== null && q !== null) { P = p; Q = Math.abs(q); }
    else if (p !== null && s !== null) { P = p; Q = Math.sqrt(Math.max(0, s * s - p * p)); if (s < p * 0.999) errors.push('apparent power cannot be smaller than real power'); }
    else if (p !== null && pf !== null) { P = p; Q = p * Math.tan(Math.acos(pf)); }
    else if (s !== null && pf !== null) { P = s * pf; Q = s * Math.sin(Math.acos(pf)); }
    else if (q !== null && s !== null) { Q = Math.abs(q); P = Math.sqrt(Math.max(0, s * s - q * q)); if (s < Math.abs(q) * 0.999) errors.push('apparent power cannot be smaller than reactive power'); }
    else if (q !== null && pf !== null) {
      if (pf >= 1) errors.push('at unity power factor there is no reactive power to start from');
      else { Q = Math.abs(q); P = Q / Math.tan(Math.acos(pf)); }
    }
    // Three values given: they must agree with each other.
    if (count > 2 && !errors.length) {
      const S = Math.hypot(P, Q);
      if (p !== null && !sameValue(p, P)) errors.push('the real power does not fit the other values');
      if (s !== null && !sameValue(s, S)) errors.push('the apparent power does not fit the other values: P and Q give ' + formatQuantity(S, 'VA'));
      if (pf !== null && !sameValue(pf, S ? P / S : 1)) errors.push('the power factor does not fit the other values: P and S give ' + (S ? (P / S).toFixed(3) : '1'));
    }
    if (!(P > 0)) errors.push('the real power must be positive');
  }

  const targetPf = r.targetPf === undefined ? undefined : num(r.targetPf);
  if (targetPf === null || (targetPf !== undefined && !(targetPf > 0 && targetPf <= 1))) errors.push('targetPf lies between 0 and 1');
  if (targetPf && P > 0 && lagging && targetPf < P / Math.hypot(P, Q) - 1e-9) {
    errors.push('the target power factor is lower than the present one; correction raises it');
  }
  if (targetPf && !lagging) errors.push('correction with capacitors applies to a lagging load');

  const voltage = r.voltage === undefined ? undefined : power(r.voltage, 'V');
  if (voltage === null || (voltage !== undefined && !(voltage > 0))) errors.push('voltage must be positive, in volts');
  const frequency = r.frequency === undefined ? undefined : num(r.frequency);
  if (frequency === null || (frequency !== undefined && !(frequency > 0))) errors.push('frequency must be positive, in Hz');
  const phases = Number(r.phases) === 3 ? 3 : 1;

  let ask: TriangleAsk | undefined;
  const a = str(r.ask && typeof r.ask === 'object' ? r.ask.quantity : r.ask, 20) as TriangleAsk;
  if (a) {
    if (!TRIANGLE_ASKS.includes(a)) errors.push('unknown question for a power triangle: ' + a);
    else if (['capacitorReactive', 'capacitance', 'newApparent', 'currentAfter'].includes(a) && !targetPf) errors.push(a + ' needs a targetPf');
    else if (a === 'capacitance' && !(voltage && frequency)) errors.push('capacitance needs the voltage and frequency');
    else if ((a === 'currentBefore' || a === 'currentAfter') && !voltage) errors.push(a + ' needs the voltage');
    else ask = a;
  }

  const figure: PowerTriangle = {
    type: 'power-triangle', real: P, reactive: lagging ? Q : -Q, phases,
    ...(targetPf ? { targetPf } : {}), ...(voltage ? { voltage } : {}), ...(frequency ? { frequency } : {}),
    ...(ask ? { ask } : {}),
  };
  return { figure: errors.length ? null : figure, errors };
}

/** Every quantity the triangle implies. */
export function solveTriangle(t: PowerTriangle) {
  const P = t.real;
  const Q = t.reactive;
  const S = Math.hypot(P, Q);
  const pf = P / S;
  const angle = (Math.atan2(Math.abs(Q), P) * 180) / Math.PI;
  const current = (s: number) => (t.voltage ? s / (t.voltage * (t.phases === 3 ? Math.sqrt(3) : 1)) : undefined);
  let correction;
  if (t.targetPf) {
    const Q2 = P * Math.tan(Math.acos(t.targetPf));
    const Qc = Math.abs(Q) - Q2;
    const S2 = Math.hypot(P, Q2);
    // Single phase: C = Qc / (ωV²). Three phase, delta-connected bank on line voltage: per phase Qc/3.
    const capacitance = t.voltage && t.frequency
      ? (t.phases === 3 ? Qc / 3 : Qc) / (2 * Math.PI * t.frequency * t.voltage * t.voltage)
      : undefined;
    correction = { Q2, Qc, S2, capacitance, currentAfter: current(S2) };
  }
  return { P, Q, S, pf, angle, lagging: Q >= 0, currentBefore: current(S), correction };
}

export function answerTriangle(t: PowerTriangle): FigureAnswer | null {
  if (!t.ask) return null;
  const s = solveTriangle(t);
  const n = (value: number | undefined, unit: UnitClass): FigureAnswer | null =>
    value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit };
  switch (t.ask) {
    case 'real': return n(s.P, 'W');
    case 'reactive': return n(Math.abs(s.Q), 'VAR');
    case 'apparent': return n(s.S, 'VA');
    case 'angle': return n(s.angle, '°');
    case 'powerFactor': return n(s.pf, '');
    case 'capacitorReactive': return n(s.correction?.Qc, 'VAR');
    case 'capacitance': return n(s.correction?.capacitance, 'F');
    case 'newApparent': return n(s.correction?.S2, 'VA');
    case 'currentBefore': return n(s.currentBefore, 'A');
    case 'currentAfter': return n(s.correction?.currentAfter, 'A');
  }
  return null;
}

// --- geometry ------------------------------------------------------------------------

export interface TriangleLabel { key: string; text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: { x1: number; y1: number; x2: number; y2: number } }

export interface TriangleLayout {
  origin: { x: number; y: number };
  /** End of P along the bottom. */
  base: { x: number; y: number };
  /** Top of Q, before correction. */
  apex: { x: number; y: number };
  /** Top of Q after correction, when there is one. */
  corrected?: { x: number; y: number };
  labels: TriangleLabel[];
  arcRadius: number;
}

const HIDE: Record<string, TriangleAsk[]> = {
  P: ['real'], Q: ['reactive'], S: ['apparent'], phi: ['angle', 'powerFactor'], Qc: ['capacitorReactive', 'capacitance'], S2: ['newApparent'],
};

/**
 * Scaled so the triangle fills the box, with room kept for the labels on the
 * outside of each side. Every label is placed off the line it names, and the
 * boxes are returned so the tests can prove none overlap or leave the frame.
 */
export function layoutTriangle(t: PowerTriangle, width: number, height: number, font: number, reveal: boolean): TriangleLayout {
  const s = solveTriangle(t);
  const text = (key: string, value: string) => (!reveal && t.ask && HIDE[key]?.includes(t.ask) ? '?' : value);
  const qLabel = 'Q = ' + text('Q', formatQuantity(Math.abs(s.Q), 'VAR'));
  const sLabel = 'S = ' + text('S', formatQuantity(s.S, 'VA'));
  const pLabel = 'P = ' + text('P', formatQuantity(s.P, 'W'));
  const phiLabel = 'φ = ' + text('phi', formatQuantity(s.angle, '°')) + '  (pf ' + text('phi', s.pf.toFixed(2)) + ')';
  const cw = font * 0.6;

  // Room for the Q and Qc labels on the right, P below, and S above-left.
  const rightRoom = Math.max(qLabel.length, s.correction ? ('Qc = ' + formatQuantity(s.correction.Qc, 'VAR')).length : 0) * cw + 40;
  const left = 30;
  // Rows on the far side of the base from Q: P, then φ, then S₂ when there
  // is a correction. That is below a lagging triangle and above a leading one.
  const rows = font * (t.targetPf ? 5.4 : 4.1);
  const top = s.lagging ? font * 1.4 : rows;
  const bottom = s.lagging ? rows : font * 1.4;
  const availW = width - left - rightRoom;
  const availH = height - top - bottom;
  const up = s.lagging ? -1 : 1;
  const scale = Math.min(availW / s.P, Math.abs(s.Q) > 0 ? availH / Math.abs(s.Q) : Infinity, availH * 3 / s.P);
  const triW = s.P * scale;
  const triH = Math.abs(s.Q) * scale;
  const ox = left + (availW - triW) / 2;
  const oy = s.lagging ? top + (availH + triH) / 2 : top + (availH - triH) / 2;
  const origin = { x: ox, y: oy };
  const base = { x: ox + triW, y: oy };
  const apex = { x: ox + triW, y: oy + up * triH };

  const labels: TriangleLabel[] = [];
  const add = (key: string, t2: string, x: number, y: number, anchor: TriangleLabel['anchor']) => {
    const w = t2.length * cw;
    const x1 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    labels.push({ key, text: t2, x, y, anchor, box: { x1, x2: x1 + w, y1: y - font, y2: y + font * 0.3 } });
  };
  // P under (or over, for leading) the base; Q to the right of the side.
  add('P', pLabel, ox + triW / 2, oy - up * (font * 1.5), 'middle');
  add('Q', qLabel, base.x + 20, oy + up * triH * 0.5 + font * 0.35, 'start');
  // S beside the hypotenuse, on the side away from the triangle.
  const mx = ox + triW / 2;
  const my = oy + up * triH / 2;
  add('S', sLabel, mx - 16, my + up * font * 0.9, 'end');
  // φ at the origin, inside the angle when there is room, else under the base.
  add('phi', phiLabel, ox, oy - up * (font * 2.9), 'start');

  let corrected;
  if (s.correction) {
    const h2 = s.correction.Q2 * scale;
    corrected = { x: base.x, y: oy + up * h2 };
    add('Qc', 'Qc = ' + text('Qc', formatQuantity(s.correction.Qc, 'VAR')), base.x + 20, oy + up * (h2 + (triH - h2) / 2) + font * 0.35, 'start');
    add('S2', 'S₂ = ' + text('S2', formatQuantity(s.correction.S2, 'VA')), ox, oy - up * (font * 4.3), 'start');
    // Q now labels only the part left after correction.
    const q = labels.find((l) => l.key === 'Q')!;
    const qy = oy + up * h2 / 2 + font * 0.35;
    q.text = 'Q₂ = ' + formatQuantity(s.correction.Q2, 'VAR');
    q.y = qy;
    q.box = { ...q.box, x2: q.box.x1 + q.text.length * cw, y1: qy - font, y2: qy + font * 0.3 };
    // A small correction leaves Q₂ and Qc too close to read apart: push Q₂
    // towards the base until the two labels clear each other.
    const c = labels.find((l) => l.key === 'Qc')!;
    const gap = font * 1.45;
    if (Math.abs(q.y - c.y) < gap) {
      q.y = c.y - up * gap;
      q.box = { ...q.box, y1: q.y - font, y2: q.y + font * 0.3 };
    }
  }
  return { origin, base, apex, corrected, labels, arcRadius: Math.min(triW, 120) * 0.45 };
}

export function triangleAskText(t: PowerTriangle, reveal: boolean): string {
  if (!t.ask) return '';
  const names: Record<TriangleAsk, string> = {
    real: 'Real power', reactive: 'Reactive power', apparent: 'Apparent power', angle: 'Power factor angle',
    powerFactor: 'Power factor', capacitorReactive: 'Capacitor rating', capacitance: 'Capacitance needed',
    newApparent: 'Apparent power after correction', currentBefore: 'Line current', currentAfter: 'Line current after correction',
  };
  const a = answerTriangle(t);
  const shown = reveal && a && a.kind === 'number'
    ? (t.ask === 'powerFactor' ? a.value.toFixed(2) + (solveTriangle(t).lagging ? ' lagging' : ' leading') : formatQuantity(a.value, a.unit))
    : '?';
  return names[t.ask] + ' = ' + shown;
}

export const POWER_TRIANGLE_FAMILY: FigureFamily<PowerTriangle> = {
  type: 'power-triangle',
  label: 'the power triangle (P, Q, S, φ), with power-factor correction by capacitors drawn on it.',
  fits: /electrical|power factor|reactive|power systems|machines|utili[sz]ation|estimation|tariff|energy meter|wattmeter|measurement|generation/i,
  normalize: normalizeTriangle,
  answer: answerTriangle,
  docs: [
    '{"type":"power-triangle","real":"8 kW","powerFactor":0.8,"targetPf":0.95,"voltage":"415 V",',
    ' "frequency":50,"phases":3,"ask":"capacitorReactive"}',
    'Give TWO of real ("8 kW"), reactive ("6 kVAR"), apparent ("10 kVA") and powerFactor (0.8) -',
    'the rest are worked out. lagging is assumed; set "lagging": false for a leading load.',
    'For correction add targetPf (and voltage, frequency, phases 1 or 3 for capacitance or current).',
    'ask: real, reactive, apparent, angle, powerFactor, capacitorReactive, capacitance, newApparent,',
    'currentBefore, currentAfter.',
  ],
};
