// ---------------------------------------------------------------------------
// Balanced three-phase loads, star and delta.
//
// The relations exam questions turn on - VL = √3·Vph in star, IL = √3·Iph in
// delta, P = √3·VL·IL·cos φ, and a load drawing three times the power when
// its star is reconnected in delta - are all computed here from one voltage
// and one description of the load. The figure shows the connection itself
// with R, Y and B terminals, and states the √3 relation with the real numbers
// in it, because that line is usually the whole answer.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './quantity.ts';

export type ThreePhaseAsk =
  | 'lineVoltage' | 'phaseVoltage' | 'lineCurrent' | 'phaseCurrent'
  | 'power' | 'reactive' | 'apparent' | 'impedance' | 'otherConnectionPower';
export const THREE_PHASE_ASKS: ThreePhaseAsk[] = ['lineVoltage', 'phaseVoltage', 'lineCurrent', 'phaseCurrent', 'power', 'reactive', 'apparent', 'impedance', 'otherConnectionPower'];

export interface ThreePhase {
  type: 'three-phase';
  connection: 'star' | 'delta';
  /** Volts, line to line. */
  lineVoltage: number;
  /** Ohms per phase, magnitude. */
  impedance: number;
  powerFactor: number;
  ask?: ThreePhaseAsk;
}

const ROOT3 = Math.sqrt(3);

function quantity(raw: unknown, unit: UnitClass): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const q = parseQuantity(String(raw ?? ''));
  if (!q || (q.unit && q.unit !== unit)) return null;
  return q.value;
}

export function normalizeThreePhase(raw: any): { figure: ThreePhase | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const connection = r.connection === 'delta' ? 'delta' : r.connection === 'star' ? 'star' : null;
  if (!connection) errors.push('connection must be "star" or "delta"');
  const kV = connection === 'star' ? ROOT3 : 1; // VL = kV · Vph
  const kI = connection === 'delta' ? ROOT3 : 1; // IL = kI · Iph

  const read = (field: string, unit: UnitClass) => {
    if (r[field] === undefined) return undefined;
    const v = quantity(r[field], unit);
    if (v === null || !(v > 0)) { errors.push(field + ' must be a positive value in ' + unit); return undefined; }
    return v;
  };
  const VLg = read('lineVoltage', 'V');
  const Vphg = read('phaseVoltage', 'V');
  const ILg = read('lineCurrent', 'A');
  const Iphg = read('phaseCurrent', 'A');
  const Zg = read('impedance', 'Ω');
  const Pg = read('power', 'W');
  const R = r.resistance === undefined ? undefined : quantity(r.resistance, 'Ω');
  const X = r.reactance === undefined ? undefined : quantity(r.reactance, 'Ω');
  if (R === null || X === null) errors.push('resistance and reactance are in ohms');
  let pf = r.powerFactor === undefined ? undefined : num(r.powerFactor);
  if (pf === null || (pf !== undefined && !(pf > 0 && pf <= 1))) { errors.push('a power factor lies between 0 and 1'); pf = undefined; }

  let lineVoltage = 0;
  let impedance = 0;
  if (!errors.length && connection) {
    if (VLg && Vphg && !sameValue(VLg, Vphg * kV)) {
      errors.push('in ' + connection + ' the line voltage is ' + (kV > 1 ? '√3 times' : 'equal to') + ' the phase voltage, and these are not');
    }
    const V = VLg ?? (Vphg ? Vphg * kV : undefined);
    if (!V) errors.push('give the lineVoltage or the phaseVoltage');
    else lineVoltage = V;
    const Vph = V ? V / kV : 0;

    let Zfrom: number | undefined;
    if (R !== undefined || X !== undefined) {
      const rr = R ?? 0;
      const xx = X ?? 0;
      Zfrom = Math.hypot(rr, xx);
      const pfRX = Zfrom > 0 ? rr / Zfrom : undefined;
      if (pf !== undefined && pfRX !== undefined && !sameValue(pf, pfRX)) errors.push('the power factor does not match R and X');
      pf = pfRX;
    }
    const Iph = Iphg ?? (ILg ? ILg / kI : undefined);
    if (ILg && Iphg && !sameValue(ILg, Iphg * kI)) errors.push('in ' + connection + ' the line current is ' + (kI > 1 ? '√3 times' : 'equal to') + ' the phase current, and these are not');
    const candidates: number[] = [];
    if (Zg) candidates.push(Zg);
    if (Zfrom) candidates.push(Zfrom);
    if (Iph && Vph) candidates.push(Vph / Iph);
    if (Pg && Vph) {
      if (pf === undefined) errors.push('power needs a powerFactor to find the current');
      else candidates.push((3 * Vph * Vph * pf) / Pg);
    }
    if (!candidates.length) errors.push('describe the load: impedance, resistance and reactance, a current, or power with its powerFactor');
    else if (candidates.some((z) => !sameValue(z, candidates[0]))) errors.push('the values given describe different loads - they do not agree with each other');
    impedance = candidates[0] || 0;
    if (!(impedance > 0) && !errors.length) errors.push('the impedance must be positive');
  }
  if (pf === undefined) pf = 1;

  let ask: ThreePhaseAsk | undefined;
  const a = str(r.ask && typeof r.ask === 'object' ? r.ask.quantity : r.ask, 24) as ThreePhaseAsk;
  if (a) {
    if (THREE_PHASE_ASKS.includes(a)) ask = a;
    else errors.push('unknown question for a three-phase load: ' + a);
  }

  const figure: ThreePhase = { type: 'three-phase', connection: connection || 'star', lineVoltage, impedance, powerFactor: pf, ...(ask ? { ask } : {}) };
  return { figure: errors.length ? null : figure, errors };
}

export function solveThreePhase(t: ThreePhase) {
  const kV = t.connection === 'star' ? ROOT3 : 1;
  const kI = t.connection === 'delta' ? ROOT3 : 1;
  const VL = t.lineVoltage;
  const Vph = VL / kV;
  const Iph = Vph / t.impedance;
  const IL = Iph * kI;
  const S = ROOT3 * VL * IL;
  const P = S * t.powerFactor;
  const Q = S * Math.sin(Math.acos(t.powerFactor));
  // The same three impedances connected the other way on the same supply.
  const other = t.connection === 'star' ? 'delta' : 'star';
  const otherVph = other === 'star' ? VL / ROOT3 : VL;
  const otherP = 3 * (otherVph * otherVph / t.impedance) * t.powerFactor;
  return { VL, Vph, IL, Iph, P, Q, S, other, otherP };
}

export function answerThreePhase(t: ThreePhase): FigureAnswer | null {
  if (!t.ask) return null;
  const s = solveThreePhase(t);
  const n = (value: number, unit: UnitClass): FigureAnswer => ({ kind: 'number', value, unit });
  switch (t.ask) {
    case 'lineVoltage': return n(s.VL, 'V');
    case 'phaseVoltage': return n(s.Vph, 'V');
    case 'lineCurrent': return n(s.IL, 'A');
    case 'phaseCurrent': return n(s.Iph, 'A');
    case 'power': return n(s.P, 'W');
    case 'reactive': return n(s.Q, 'VAR');
    case 'apparent': return n(s.S, 'VA');
    case 'impedance': return n(t.impedance, 'Ω');
    case 'otherConnectionPower': return n(s.otherP, 'W');
  }
  return null;
}

// --- geometry -----------------------------------------------------------------------

const HIDDEN: Record<string, ThreePhaseAsk[]> = {
  VL: ['lineVoltage'], Vph: ['phaseVoltage'], IL: ['lineCurrent'], Iph: ['phaseCurrent'],
  P: ['power', 'reactive', 'apparent'], Z: ['impedance'],
};

/** The lines of working under the drawing: the √3 relation with its numbers, then the power. */
export function threePhaseRows(t: ThreePhase, reveal: boolean): string[] {
  const s = solveThreePhase(t);
  if (!reveal) {
    // Before the reveal, only the situation: the working would hand over the
    // answer - the power on a delta question gave its line current away.
    const V = (x: number) => formatQuantity(x, 'V');
    const conn = t.connection === 'star' ? 'Star' : 'Delta';
    const supply = t.ask === 'lineVoltage' ? 'Vph = ' + V(s.Vph) + ',  VL = ?'
      : t.ask === 'phaseVoltage' ? 'VL = ' + V(s.VL) + ',  Vph = ?'
      : 'Supply VL = ' + V(s.VL);
    const loadRow = t.ask === 'impedance' ? 'IL = ' + formatQuantity(s.IL, 'A') + ',  Z = ?'
      : 'Z = ' + formatQuantity(t.impedance, 'Ω') + ' per phase' + (t.powerFactor < 1 ? ', pf ' + t.powerFactor.toFixed(2) : '');
    return [conn + ' connection', supply, loadRow];
  }
  const show = (key: string, value: string) => (!reveal && t.ask && HIDDEN[key]?.includes(t.ask) ? '?' : value);
  const V = (x: number) => formatQuantity(x, 'V');
  const A = (x: number) => formatQuantity(x, 'A');
  const rows = t.connection === 'star'
    ? ['Star: VL = √3 × Vph', show('VL', V(s.VL)) + ' = 1.732 × ' + show('Vph', V(s.Vph)), 'IL = Iph = ' + show('IL', A(s.IL))]
    : ['Delta: IL = √3 × Iph', show('IL', A(s.IL)) + ' = 1.732 × ' + show('Iph', A(s.Iph)), 'VL = Vph = ' + show('VL', V(s.VL))];
  rows.push('P = √3 VL IL cos φ = ' + show('P', formatQuantity(s.P, 'W')));
  return rows;
}

export interface PhasePart {
  /** Terminal, where the supply line joins. */
  terminal: { x: number; y: number };
  /** Outer end of the supply stub. */
  outer: { x: number; y: number };
  name: 'R' | 'Y' | 'B';
}

export interface ThreePhaseLayout {
  centre: { x: number; y: number };
  radius: number;
  terminals: PhasePart[];
  /** The three impedances: centre-to-terminal in star, terminal-to-terminal in delta. */
  impedances: { x1: number; y1: number; x2: number; y2: number }[];
  rowsTop: number;
}

/** R at the top, Y bottom-left, B bottom-right, the way the textbook draws them. */
export function layoutThreePhase(t: ThreePhase, width: number, height: number, font: number, rowCount: number): ThreePhaseLayout {
  const rowsH = rowCount * font * 1.35 + font * 1.6;
  const drawH = height - rowsH;
  // The drawing spans 1.45 radii above the centre (R's stub, then its label)
  // and 1.45 below, so the radius comes from that height, not a guess.
  const labelRoom = font * 1.4;
  const radius = Math.max(40, Math.min((drawH - labelRoom * 2) / 2.9, width * 0.26));
  const cx = width / 2;
  const cy = labelRoom + radius * 1.45;
  const names: PhasePart['name'][] = ['R', 'Y', 'B'];
  const angles = [-90, 150, 30];
  const terminals = angles.map((deg, k) => {
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    return { name: names[k], terminal: { x, y }, outer: { x: cx + Math.cos(a) * radius * 1.45, y: cy + Math.sin(a) * radius * 1.45 } };
  });
  const impedances = t.connection === 'star'
    ? terminals.map((p) => ({ x1: cx, y1: cy, x2: p.terminal.x, y2: p.terminal.y }))
    : [[0, 1], [1, 2], [2, 0]].map(([i, j]) => ({ x1: terminals[i].terminal.x, y1: terminals[i].terminal.y, x2: terminals[j].terminal.x, y2: terminals[j].terminal.y }));
  return { centre: { x: cx, y: cy }, radius, terminals, impedances, rowsTop: cy + radius * 1.45 + font * 1.6 };
}

export function threePhaseAskText(t: ThreePhase, reveal: boolean): string {
  if (!t.ask) return '';
  const s = solveThreePhase(t);
  const names: Record<ThreePhaseAsk, string> = {
    lineVoltage: 'Line voltage', phaseVoltage: 'Phase voltage', lineCurrent: 'Line current', phaseCurrent: 'Phase current',
    power: 'Total power', reactive: 'Reactive power', apparent: 'Apparent power', impedance: 'Impedance per phase',
    otherConnectionPower: 'Power if reconnected in ' + s.other,
  };
  const a = answerThreePhase(t);
  return names[t.ask] + ' = ' + (reveal && a && a.kind === 'number' ? formatQuantity(a.value, a.unit) : '?');
}

export const THREE_PHASE_FAMILY: FigureFamily<ThreePhase> = {
  type: 'three-phase',
  label: 'a balanced three-phase load in star or delta, with line and phase values and power.',
  fits: /electrical|three.phase|star|delta|power systems|machines|transformer|utili[sz]ation|generation|distribution/i,
  normalize: normalizeThreePhase,
  answer: answerThreePhase,
  docs: [
    '{"type":"three-phase","connection":"star","lineVoltage":"415 V","impedance":"10 Ω","powerFactor":0.8,"ask":"lineCurrent"}',
    'connection "star" or "delta". Give lineVoltage or phaseVoltage. Describe the load with ONE of:',
    'impedance (+ powerFactor), resistance and reactance, lineCurrent or phaseCurrent (+ powerFactor),',
    'or power ("10 kW") with powerFactor. Extra values are checked against each other.',
    'ask: lineVoltage, phaseVoltage, lineCurrent, phaseCurrent, power, reactive, apparent, impedance,',
    'otherConnectionPower (the same load reconnected the other way).',
  ],
};
