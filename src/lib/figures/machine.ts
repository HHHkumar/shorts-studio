// ---------------------------------------------------------------------------
// Rotating machines: induction, synchronous and DC.
//
// Induction and synchronous: Ns = 120 f / P; slip s = (Ns - N) / Ns; rotor
// frequency s·f; and the air-gap power splitting into rotor copper loss s·Pg
// and mechanical power (1 - s)·Pg. DC motors: Eb = V - Ia·Ra, speed in
// proportion to Eb / Φ, developed power Eb·Ia and torque Eb·Ia / ω. DC
// generators: E = P Φ Z N / (60 A), with A = P for lap and 2 for wave.
// A rotor speed above synchronous on a motor, or a back EMF above the supply,
// is refused rather than drawn.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './quantity.ts';

export type MachineKind = 'induction' | 'synchronous' | 'dc-motor' | 'dc-generator';

export type MachineAsk =
  | 'synchronousSpeed' | 'rotorSpeed' | 'slip' | 'rotorFrequency' | 'rotorCopperLoss' | 'mechanicalPower' | 'airGapPower'
  | 'frequency' | 'poles'
  | 'backEmf' | 'armatureCurrent' | 'fieldCurrent' | 'lineCurrent' | 'powerDeveloped' | 'torque' | 'newSpeed'
  | 'generatedEmf' | 'terminalVoltage';
export const MACHINE_ASKS: MachineAsk[] = ['synchronousSpeed', 'rotorSpeed', 'slip', 'rotorFrequency', 'rotorCopperLoss', 'mechanicalPower', 'airGapPower', 'frequency', 'poles', 'backEmf', 'armatureCurrent', 'fieldCurrent', 'lineCurrent', 'powerDeveloped', 'torque', 'newSpeed', 'generatedEmf', 'terminalVoltage'];

export interface Machine {
  type: 'machine';
  kind: MachineKind;
  poles?: number;
  frequency?: number;
  /** rpm. */
  speed?: number;
  /** Fraction, 0..1. */
  slip?: number;
  /** W. */
  airGapPower?: number;
  voltage?: number;
  armatureCurrent?: number;
  armatureResistance?: number;
  /** Shunt field resistance, Ω. */
  fieldResistance?: number;
  /** Line current drawn by a shunt motor, A. */
  lineCurrent?: number;
  /** For the second operating point of a DC motor. */
  newArmatureCurrent?: number;
  /** Flux after a change, as a fraction of the original (0.8 for a 20% reduction). */
  fluxRatio?: number;
  /** DC generator. */
  flux?: number;
  conductors?: number;
  winding?: 'lap' | 'wave';
  ask?: MachineAsk;
  given: string[];
}

function q(raw: unknown, unit: UnitClass): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const v = parseQuantity(String(raw ?? ''));
  if (!v || (v.unit && v.unit !== unit)) return null;
  return v.value;
}

/** "4%" or 0.04 - as a fraction. */
function fraction(raw: unknown): number | null {
  if (typeof raw === 'number') return raw > 1 ? raw / 100 : raw;
  const v = parseQuantity(String(raw ?? ''));
  if (!v) return null;
  if (v.unit === '%') return v.value / 100;
  if (!v.unit) return v.value > 1 ? v.value / 100 : v.value;
  return null;
}

export function normalizeMachine(raw: any): { figure: Machine | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const kinds: MachineKind[] = ['induction', 'synchronous', 'dc-motor', 'dc-generator'];
  const kind = kinds.includes(r.kind) ? (r.kind as MachineKind) : null;
  if (!kind) errors.push('kind must be induction, synchronous, dc-motor or dc-generator');
  const given: string[] = [];
  const read = (field: string, unit: UnitClass) => {
    if (r[field] === undefined || r[field] === null || r[field] === '') return undefined;
    const v = q(r[field], unit);
    if (v === null || !(v >= 0)) { errors.push(field + ' must be a value in ' + (unit || 'plain numbers')); return undefined; }
    given.push(field);
    return v;
  };
  const poles = read('poles', '');
  if (poles !== undefined && (!(poles >= 2) || poles % 2 !== 0)) errors.push('poles must be an even number, 2 or more');
  const frequency = read('frequency', 'Hz');
  const speed = read('speed', 'rpm');
  let slip: number | undefined;
  if (r.slip !== undefined) {
    const s = fraction(r.slip);
    if (s === null || !(s >= 0 && s < 1)) errors.push('slip is a fraction below 1, or a percentage: "4%"');
    else { slip = s; given.push('slip'); }
  }
  const airGapPower = read('airGapPower', 'W');
  const voltage = read('voltage', 'V');
  let armatureCurrent = read('armatureCurrent', 'A');
  const armatureResistance = read('armatureResistance', 'Ω');
  const fieldResistance = read('fieldResistance', 'Ω');
  const lineCurrent = read('lineCurrent', 'A');
  const newArmatureCurrent = read('newArmatureCurrent', 'A');
  let fluxRatio: number | undefined;
  if (r.fluxRatio !== undefined) {
    const f = num(r.fluxRatio);
    if (f === null || !(f > 0)) errors.push('fluxRatio is the new flux over the old, e.g. 0.8');
    else { fluxRatio = f; given.push('fluxRatio'); }
  }
  const flux = read('flux', 'Wb');
  const conductors = read('conductors', '');
  const winding = r.winding === 'wave' ? 'wave' : r.winding === 'lap' ? 'lap' : undefined;

  if (kind === 'induction' || kind === 'synchronous') {
    if (!poles && !(frequency && speed && kind === 'synchronous')) errors.push('state the number of poles');
    const Ns = poles && frequency ? (120 * frequency) / poles : undefined;
    if (kind === 'induction' && Ns && speed !== undefined) {
      if (speed > Ns) errors.push('the rotor of an induction motor turns slower than the field (' + Math.round(Ns) + ' rpm), not faster');
      else if (slip !== undefined && !sameValue(slip, (Ns - speed) / Ns)) errors.push('the speed and the slip describe different operating points');
    }
    if (kind === 'synchronous' && Ns && speed !== undefined && !sameValue(speed, Ns)) {
      errors.push('a synchronous machine runs at exactly ' + Math.round(Ns) + ' rpm with these poles and frequency');
    }
  }
  if (kind === 'dc-motor') {
    if (lineCurrent !== undefined && fieldResistance !== undefined && voltage !== undefined) {
      const Ia = lineCurrent - voltage / fieldResistance;
      if (armatureCurrent !== undefined && !sameValue(armatureCurrent, Ia)) errors.push('the line current is not armature plus field current');
      if (!(Ia > 0)) errors.push('the field takes more than the whole line current');
      armatureCurrent = armatureCurrent ?? Ia;
    }
    if (voltage !== undefined && armatureCurrent !== undefined && armatureResistance !== undefined && armatureCurrent * armatureResistance >= voltage) {
      errors.push('the armature drop Ia·Ra is larger than the supply, which leaves no back EMF');
    }
  }
  if (kind === 'dc-generator' && (r.flux !== undefined || r.conductors !== undefined) && !winding) errors.push('say whether the winding is lap or wave');

  let ask: MachineAsk | undefined;
  const a = str(r.ask && typeof r.ask === 'object' ? r.ask.quantity : r.ask, 24) as MachineAsk;
  if (a) {
    if (!MACHINE_ASKS.includes(a)) errors.push('unknown question for a machine: ' + a);
    else ask = a;
  }

  const figure: Machine = {
    type: 'machine', kind: kind || 'induction', given,
    ...(poles !== undefined ? { poles } : {}), ...(frequency !== undefined ? { frequency } : {}),
    ...(speed !== undefined ? { speed } : {}), ...(slip !== undefined ? { slip } : {}),
    ...(airGapPower !== undefined ? { airGapPower } : {}), ...(voltage !== undefined ? { voltage } : {}),
    ...(armatureCurrent !== undefined ? { armatureCurrent } : {}), ...(armatureResistance !== undefined ? { armatureResistance } : {}),
    ...(fieldResistance !== undefined ? { fieldResistance } : {}), ...(lineCurrent !== undefined ? { lineCurrent } : {}),
    ...(newArmatureCurrent !== undefined ? { newArmatureCurrent } : {}), ...(fluxRatio !== undefined ? { fluxRatio } : {}),
    ...(flux !== undefined ? { flux } : {}), ...(conductors !== undefined ? { conductors } : {}), ...(winding ? { winding } : {}),
    ...(ask ? { ask } : {}),
  };
  if (!errors.length && ask && answerMachine(figure) === null) {
    errors.push(ask + ' cannot be worked out from what is given');
  }
  return { figure: errors.length ? null : figure, errors };
}

export function solveMachine(m: Machine) {
  const out: Record<string, number | undefined> = {};
  if (m.kind === 'induction' || m.kind === 'synchronous') {
    const Ns = m.poles && m.frequency ? (120 * m.frequency) / m.poles : undefined;
    out.Ns = Ns;
    if (m.kind === 'synchronous') {
      out.N = Ns ?? m.speed;
      if (!m.frequency && m.poles && m.speed) out.f = (m.poles * m.speed) / 120;
      if (!m.poles && m.frequency && m.speed) out.P = (120 * m.frequency) / m.speed;
    } else {
      const s = m.slip ?? (Ns && m.speed !== undefined ? (Ns - m.speed) / Ns : undefined);
      out.s = s;
      out.N = m.speed ?? (Ns && s !== undefined ? Ns * (1 - s) : undefined);
      out.fr = s !== undefined && m.frequency ? s * m.frequency : undefined;
      if (m.airGapPower !== undefined && s !== undefined) {
        out.Pg = m.airGapPower;
        out.Pcu = s * m.airGapPower;
        out.Pm = (1 - s) * m.airGapPower;
      }
    }
  } else if (m.kind === 'dc-motor') {
    const If = m.voltage !== undefined && m.fieldResistance ? m.voltage / m.fieldResistance : undefined;
    const Ia = m.armatureCurrent;
    out.If = If;
    out.Ia = Ia;
    out.IL = m.lineCurrent ?? (Ia !== undefined && If !== undefined ? Ia + If : undefined);
    const Eb = m.voltage !== undefined && Ia !== undefined && m.armatureResistance !== undefined ? m.voltage - Ia * m.armatureResistance : undefined;
    out.Eb = Eb;
    out.P = Eb !== undefined && Ia !== undefined ? Eb * Ia : undefined;
    out.T = out.P !== undefined && m.speed ? out.P / ((2 * Math.PI * m.speed) / 60) : undefined;
    // Second operating point: N2 / N1 = (Eb2 / Eb1) × (Φ1 / Φ2).
    if (Eb !== undefined && m.speed && (m.newArmatureCurrent !== undefined || m.fluxRatio !== undefined)) {
      const Ia2 = m.newArmatureCurrent ?? Ia!;
      const Eb2 = m.voltage! - Ia2 * m.armatureResistance!;
      out.Eb2 = Eb2;
      out.N2 = (m.speed * (Eb2 / Eb)) / (m.fluxRatio ?? 1);
    }
  } else {
    const A = m.winding === 'wave' ? 2 : m.poles;
    const E = m.poles && m.flux !== undefined && m.conductors && m.speed && A ? (m.poles * m.flux * m.conductors * m.speed) / (60 * A) : undefined;
    out.E = E;
    out.A = A;
    out.V = E !== undefined && m.armatureCurrent !== undefined && m.armatureResistance !== undefined ? E - m.armatureCurrent * m.armatureResistance : undefined;
  }
  return out;
}

export function answerMachine(m: Machine): FigureAnswer | null {
  if (!m.ask) return null;
  const s = solveMachine(m);
  const n = (value: number | undefined, unit: UnitClass): FigureAnswer | null =>
    value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit };
  switch (m.ask) {
    case 'synchronousSpeed': return n(s.Ns, 'rpm');
    case 'rotorSpeed': return n(s.N, 'rpm');
    case 'slip': return n(s.s !== undefined ? s.s * 100 : undefined, '%');
    case 'rotorFrequency': return n(s.fr, 'Hz');
    case 'rotorCopperLoss': return n(s.Pcu, 'W');
    case 'mechanicalPower': return n(s.Pm, 'W');
    case 'airGapPower': return n(s.Pg, 'W');
    case 'frequency': return n(s.f ?? m.frequency, 'Hz');
    case 'poles': return n(s.P ?? m.poles, '');
    case 'backEmf': return n(s.Eb, 'V');
    case 'armatureCurrent': return n(s.Ia, 'A');
    case 'fieldCurrent': return n(s.If, 'A');
    case 'lineCurrent': return n(s.IL, 'A');
    case 'powerDeveloped': return n(s.P, 'W');
    case 'torque': return n(s.T, 'N·m');
    case 'newSpeed': return n(s.N2, 'rpm');
    case 'generatedEmf': return n(s.E, 'V');
    case 'terminalVoltage': return n(s.V, 'V');
  }
  return null;
}

/** Speeds, torque and turns read as plain numbers with their names: "1440 rpm", "95.5 N·m". */
export function machineValueText(ask: MachineAsk, value: number): string {
  if (['synchronousSpeed', 'rotorSpeed', 'newSpeed'].includes(ask)) return Math.round(value) + ' rpm';
  if (ask === 'poles') return String(Math.round(value));
  if (ask === 'torque') return (Math.round(value * 10) / 10) + ' N·m';
  return '';
}

/** The working, as rows. Before the reveal, only what the question stated. */
export function machineRows(m: Machine, reveal: boolean): string[] {
  const s = solveMachine(m);
  const stated = (key: string) => reveal || m.given.includes(key);
  const rpm = (x: number | undefined) => (x === undefined ? '?' : Math.round(x) + ' rpm');
  const rows: string[] = [];
  if (m.kind === 'induction' || m.kind === 'synchronous') {
    const pf = [m.poles !== undefined ? (stated('poles') ? m.poles + ' poles' : '? poles') : '', m.frequency !== undefined ? (stated('frequency') ? m.frequency + ' Hz' : '? Hz') : ''].filter(Boolean).join(', ');
    if (pf) rows.push(pf);
    rows.push('Ns = 120 f / P = ' + (reveal ? rpm(s.Ns) : '?'));
    if (m.kind === 'induction') {
      // A row appears when it was stated, when it is what is asked (as "?"), or after the reveal.
      const shows = (key: string, asked: MachineAsk) => m.given.includes(key) || m.ask === asked || reveal;
      if (shows('speed', 'rotorSpeed')) rows.push('Rotor N = ' + (stated('speed') ? rpm(s.N) : '?'));
      if (shows('slip', 'slip')) rows.push('Slip s = (Ns − N) / Ns = ' + (stated('slip') && s.s !== undefined ? formatQuantity(s.s * 100, '%') : '?'));
      if (s.fr !== undefined && (reveal || m.ask === 'rotorFrequency')) rows.push('Rotor frequency s·f = ' + (reveal ? formatQuantity(s.fr, 'Hz') : '?'));
      if (s.Pg !== undefined) rows.push('Pg ' + formatQuantity(s.Pg, 'W') + ' → loss s·Pg ' + (reveal ? formatQuantity(s.Pcu!, 'W') : '?') + ' + output ' + (reveal ? formatQuantity(s.Pm!, 'W') : '?'));
    }
  } else if (m.kind === 'dc-motor') {
    if (m.voltage !== undefined) rows.push('V = ' + formatQuantity(m.voltage, 'V') + (m.armatureResistance !== undefined ? ',  Ra = ' + formatQuantity(m.armatureResistance, 'Ω') : ''));
    if (m.lineCurrent !== undefined || m.fieldResistance !== undefined) {
      rows.push([m.lineCurrent !== undefined ? 'IL = ' + formatQuantity(m.lineCurrent, 'A') : '', m.fieldResistance !== undefined ? 'Rsh = ' + formatQuantity(m.fieldResistance, 'Ω') : ''].filter(Boolean).join(',  '));
    }
    if (s.Ia !== undefined) rows.push('Ia = ' + (stated('armatureCurrent') ? formatQuantity(s.Ia, 'A') : '?') + (s.If !== undefined ? ',  If = ' + (reveal ? formatQuantity(s.If, 'A') : '?') : ''));
    if (s.Eb !== undefined) rows.push('Eb = V − Ia·Ra = ' + (reveal ? formatQuantity(s.Eb, 'V') : '?'));
    if (m.speed !== undefined) rows.push('N = ' + rpm(m.speed));
    if (s.N2 !== undefined) rows.push('N₂ = N × (Eb₂ / Eb) × (Φ / Φ₂) = ' + (reveal ? rpm(s.N2) : '?'));
  } else {
    if (m.poles !== undefined) rows.push(m.poles + ' poles, ' + (m.winding || '') + ' winding (A = ' + (s.A ?? '?') + ')');
    if (m.conductors !== undefined) rows.push('Z = ' + m.conductors + ',  Φ = ' + (m.flux !== undefined ? formatQuantity(m.flux, 'Wb') : '?') + ',  N = ' + rpm(m.speed));
    rows.push('E = PΦZN / 60A = ' + (reveal && s.E !== undefined ? formatQuantity(s.E, 'V') : '?'));
    if (s.V !== undefined) rows.push('V = E − Ia·Ra = ' + (reveal ? formatQuantity(s.V, 'V') : '?'));
  }
  return rows;
}

export function machineAskText(m: Machine, reveal: boolean): string {
  if (!m.ask) return '';
  const names: Record<MachineAsk, string> = {
    synchronousSpeed: 'Synchronous speed', rotorSpeed: 'Rotor speed', slip: 'Slip', rotorFrequency: 'Rotor frequency',
    rotorCopperLoss: 'Rotor copper loss', mechanicalPower: 'Mechanical power', airGapPower: 'Air-gap power',
    frequency: 'Frequency', poles: 'Number of poles', backEmf: 'Back EMF', armatureCurrent: 'Armature current',
    fieldCurrent: 'Field current', lineCurrent: 'Line current', powerDeveloped: 'Power developed', torque: 'Torque',
    newSpeed: 'New speed', generatedEmf: 'Generated EMF', terminalVoltage: 'Terminal voltage',
  };
  const a = answerMachine(m);
  if (!reveal || !a || a.kind !== 'number') return names[m.ask] + ' = ?';
  return names[m.ask] + ' = ' + (machineValueText(m.ask, a.value) || formatQuantity(a.value, a.unit));
}

export const MACHINE_FAMILY: FigureFamily<Machine> = {
  type: 'machine',
  label: 'a rotating machine - induction or synchronous speed and slip, DC motor back EMF and speed, DC generator EMF.',
  fits: /electrical|machine|motor|generator|alternator|induction|synchronous|drives|traction|utili[sz]ation|generation/i,
  normalize: normalizeMachine,
  answer: answerMachine,
  docs: [
    '{"type":"machine","kind":"induction","poles":4,"frequency":50,"speed":1440,"ask":"slip"}',
    'kind: induction, synchronous, dc-motor or dc-generator. State only what the question gives.',
    'induction/synchronous: poles, frequency, speed (rpm), slip ("4%"), airGapPower ("10 kW").',
    '  ask: synchronousSpeed, rotorSpeed, slip (in %), rotorFrequency, rotorCopperLoss, mechanicalPower,',
    '  airGapPower, frequency, poles.',
    'dc-motor: voltage, armatureCurrent or lineCurrent with fieldResistance (shunt), armatureResistance,',
    '  speed; for a second operating point newArmatureCurrent and/or fluxRatio (new flux / old).',
    '  ask: backEmf, armatureCurrent, fieldCurrent, lineCurrent, powerDeveloped, torque (N·m), newSpeed.',
    'dc-generator: poles, flux ("0.02 Wb"), conductors, speed, winding "lap" or "wave", armatureCurrent,',
    '  armatureResistance. ask: generatedEmf, terminalVoltage. Speeds are answered in rpm.',
  ],
};
