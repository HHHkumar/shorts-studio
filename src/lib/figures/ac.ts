// ---------------------------------------------------------------------------
// AC: sinusoids as phasors and as waveforms, with the power they carry.
//
// The inductor video drew a current that was meant to lag and a power curve
// with "equal positive and negative areas" that were never shaded. Here each
// signal is written as an RMS magnitude and a phase angle, and everything
// drawn - where each wave peaks, which way a phasor points, the shaded areas
// of p(t) = v(t)·i(t), the average power line - is computed from those two
// numbers. A current written 90° behind its voltage cannot be drawn ahead of it.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, sameValue, type UnitClass } from './quantity.ts';

export interface AcSignal {
  id: string;
  kind: 'voltage' | 'current';
  label: string;
  /** RMS, in volts or amperes. */
  rms: number;
  /** Degrees, positive leads. Wrapped into -180..180. */
  phase: number;
}

export type AcAsk =
  | 'phase' | 'power' | 'reactive' | 'apparent' | 'powerFactor'
  | 'rms' | 'peak' | 'period' | 'frequency' | 'impedance';
export const AC_ASKS: AcAsk[] = ['phase', 'power', 'reactive', 'apparent', 'powerFactor', 'rms', 'peak', 'period', 'frequency', 'impedance'];

export interface AcFigure {
  type: 'ac';
  frequency: number;
  /** waveform, phasor, or both stacked. */
  view: 'waveform' | 'phasor' | 'both';
  signals: AcSignal[];
  /** Shade p(t) and draw the average. Needs exactly one voltage and one current. */
  showPower: boolean;
  ask?: { quantity: AcAsk; signal?: string };
}

const wrap = (deg: number) => {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
};

export function normalizeAc(raw: any): { figure: AcFigure | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const frequency = num(r.frequency);
  if (frequency === null || !(frequency > 0) || frequency > 1e6) errors.push('an AC figure needs its frequency in Hz');

  const signals: AcSignal[] = [];
  (Array.isArray(r.signals) ? r.signals : []).forEach((s: any, i: number) => {
    const kind = s && (s.kind === 'voltage' || s.kind === 'current') ? s.kind : null;
    const id = str(s && s.id, 8).replace(/[^A-Za-z0-9_]/g, '') || (kind === 'current' ? 'I' : 'V') + (i + 1);
    const rms = num(s && s.rms);
    const phase = num(s && s.phase);
    if (!kind) { errors.push(id + ' must be a voltage or a current'); return; }
    if (rms === null || !(rms > 0)) { errors.push(id + ' needs a positive RMS value'); return; }
    if (phase === null) { errors.push(id + ' needs a phase angle in degrees'); return; }
    if (signals.some((x) => x.id === id)) { errors.push('two signals are called ' + id); return; }
    signals.push({ id, kind, label: str(s && s.label, 10) || id, rms, phase: wrap(phase) });
  });
  if (signals.length < 1 || signals.length > 3) errors.push('an AC figure shows 1 to 3 signals');

  const volts = signals.filter((s) => s.kind === 'voltage');
  const amps = signals.filter((s) => s.kind === 'current');
  const showPower = Boolean(r.showPower);
  if (showPower && (volts.length !== 1 || amps.length !== 1)) {
    errors.push('power can only be shown for exactly one voltage and one current');
  }

  const view = r.view === 'phasor' || r.view === 'both' ? r.view : 'waveform';
  let ask: AcFigure['ask'];
  if (r.ask && typeof r.ask === 'object' && AC_ASKS.includes(r.ask.quantity)) {
    const quantity = r.ask.quantity as AcAsk;
    const signal = str(r.ask.signal, 8).replace(/[^A-Za-z0-9_]/g, '');
    const pair = ['phase', 'power', 'reactive', 'apparent', 'powerFactor', 'impedance'].includes(quantity);
    if (pair && (volts.length !== 1 || amps.length !== 1)) {
      errors.push(quantity + ' needs exactly one voltage and one current');
    } else if ((quantity === 'rms' || quantity === 'peak') && !signals.some((s) => s.id === signal)) {
      errors.push(quantity + ' must name one of the signals');
    } else {
      ask = signal ? { quantity, signal } : { quantity };
    }
  }

  const figure: AcFigure = { type: 'ac', frequency: frequency || 0, view, signals, showPower, ask };
  return { figure: errors.length ? null : figure, errors };
}

/** Everything a pair of one voltage and one current implies. */
export function acPower(f: AcFigure) {
  const v = f.signals.find((s) => s.kind === 'voltage');
  const i = f.signals.find((s) => s.kind === 'current');
  if (!v || !i) return null;
  // Positive: the current lags the voltage, as in an inductive load.
  const phi = wrap(v.phase - i.phase);
  const rad = (phi * Math.PI) / 180;
  const apparent = v.rms * i.rms;
  const clean = (x: number) => (Math.abs(x) < 1e-9 * Math.max(1, apparent) ? 0 : x);
  return {
    phi,
    real: clean(apparent * Math.cos(rad)),
    reactive: clean(apparent * Math.sin(rad)),
    apparent,
    powerFactor: clean(Math.cos(rad)),
    relation: Math.abs(phi) < 1e-9 ? 'in phase' : phi > 0 ? 'current lags' : 'current leads',
    impedance: v.rms / i.rms,
  };
}

export function answerAc(f: AcFigure): FigureAnswer | null {
  if (!f.ask) return null;
  const q = f.ask.quantity;
  const n = (value: number, unit: UnitClass): FigureAnswer => ({ kind: 'number', value, unit });
  if (q === 'period') return n(1 / f.frequency, 's');
  if (q === 'frequency') return n(f.frequency, 'Hz');
  if (q === 'rms' || q === 'peak') {
    const s = f.signals.find((x) => x.id === f.ask!.signal);
    if (!s) return null;
    const unit: UnitClass = s.kind === 'voltage' ? 'V' : 'A';
    return n(q === 'rms' ? s.rms : s.rms * Math.SQRT2, unit);
  }
  const p = acPower(f);
  if (!p) return null;
  if (q === 'phase') return n(Math.abs(p.phi), '°');
  if (q === 'power') return n(p.real, 'W');
  if (q === 'reactive') return n(Math.abs(p.reactive), 'VAR');
  if (q === 'apparent') return n(p.apparent, 'VA');
  if (q === 'powerFactor') return n(Math.abs(p.powerFactor), '');
  return n(p.impedance, 'Ω');
}

// --- geometry --------------------------------------------------------------------

/** Instantaneous value of a signal at time t, from its RMS and phase. */
export function valueAt(s: AcSignal, frequency: number, t: number): number {
  return s.rms * Math.SQRT2 * Math.sin(2 * Math.PI * frequency * t + (s.phase * Math.PI) / 180);
}

export interface WaveformLayout {
  /** Two full periods, in seconds. */
  duration: number;
  signals: { signal: AcSignal; points: [number, number][]; peak: number }[];
  /** p(t) split into the parts above and below the axis, as closed polygons. */
  powerPositive: [number, number][][];
  powerNegative: [number, number][][];
  /** Where the average power sits, in pixels, or null when power is not shown. */
  averageY: number | null;
  ticks: { x: number; label: string }[];
  axisY: number;
  left: number;
  right: number;
}

/**
 * Waves are drawn over two periods. A voltage and a current have different
 * units, so each is scaled to its own height - voltages to the full half
 * height, currents to 70% of it - and the figure says so rather than implying
 * the two share an axis.
 */
export function layoutWaveform(f: AcFigure, width: number, height: number, samples = 240): WaveformLayout {
  const left = 70;
  const right = width - 30;
  const axisY = height / 2;
  const half = height / 2 - 24;
  const duration = 2 / f.frequency;
  const x = (t: number) => left + ((right - left) * t) / duration;
  const kindPeak = (kind: AcSignal['kind']) =>
    Math.max(...f.signals.filter((s) => s.kind === kind).map((s) => s.rms * Math.SQRT2));
  const scale = (s: AcSignal) => (s.kind === 'voltage' ? half : half * 0.7) / kindPeak(s.kind);

  const signals = f.signals.map((signal) => {
    const k = scale(signal);
    const points: [number, number][] = [];
    for (let n = 0; n <= samples; n++) {
      const t = (duration * n) / samples;
      points.push([x(t), axisY - valueAt(signal, f.frequency, t) * k]);
    }
    return { signal, points, peak: signal.rms * Math.SQRT2 };
  });

  const powerPositive: [number, number][][] = [];
  const powerNegative: [number, number][][] = [];
  let averageY: number | null = null;
  const v = f.signals.find((s) => s.kind === 'voltage');
  const i = f.signals.find((s) => s.kind === 'current');
  if (f.showPower && v && i) {
    const pPeak = 2 * v.rms * i.rms;
    const k = (half * 0.85) / pPeak;
    let current: [number, number][] = [];
    let sign = 0;
    const flush = () => {
      if (current.length > 1) (sign > 0 ? powerPositive : powerNegative).push([...current, [current[current.length - 1][0], axisY], [current[0][0], axisY]]);
      current = [];
    };
    for (let n = 0; n <= samples; n++) {
      const t = (duration * n) / samples;
      const p = valueAt(v, f.frequency, t) * valueAt(i, f.frequency, t);
      const s = p > 1e-9 ? 1 : p < -1e-9 ? -1 : 0;
      if (s !== 0 && s !== sign) { flush(); sign = s; }
      current.push([x(t), axisY - p * k]);
    }
    flush();
    const avg = acPower(f)!.real;
    averageY = axisY - avg * k;
  }

  const ticks = [1, 2, 3, 4, 5, 6, 7, 8].map((q) => {
    const t = (duration * q) / 8;
    return { x: x(t), label: formatQuantity(t, 's') };
  });
  return { duration, signals, powerPositive, powerNegative, averageY, ticks, axisY, left, right };
}

export interface PhasorArrow {
  signal: AcSignal;
  /** Tip, in pixels. Angles run anticlockwise from the right, as on paper. */
  x: number;
  y: number;
  length: number;
}

/** Phasors from one origin; voltages to the full radius, currents to 70% of it. */
export function layoutPhasors(f: AcFigure, cx: number, cy: number, radius: number): PhasorArrow[] {
  const peakOf = (kind: AcSignal['kind']) => Math.max(...f.signals.filter((s) => s.kind === kind).map((s) => s.rms));
  return f.signals.map((signal) => {
    const length = (signal.kind === 'voltage' ? radius : radius * 0.7) * (signal.rms / peakOf(signal.kind));
    const a = (signal.phase * Math.PI) / 180;
    return { signal, length, x: cx + Math.cos(a) * length, y: cy - Math.sin(a) * length };
  });
}

export interface AngleLabel {
  x: number;
  y: number;
  anchor: 'start' | 'end';
  /** The arc between the two phasors, in pixels, and its SVG sweep flag. */
  arcRadius: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  sweep: 0 | 1;
  /** Text box, for checking it clears both arrows. */
  box: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Where "φ = 36.9°" goes. Pushed out along the bisector until the text box
 * clears both arrows - near the origin a small angle leaves no room between
 * the shafts, and the first render put the label straight across the current.
 * Past the arrow tips, it sits below the diagram instead.
 */
export function phasorAngleLabel(f: AcFigure, cx: number, cy: number, radius: number, font: number, text: string): AngleLabel | null {
  const p = acPower(f);
  const arrows = layoutPhasors(f, cx, cy, radius);
  const v = arrows.find((a) => a.signal.kind === 'voltage');
  const i = arrows.find((a) => a.signal.kind === 'current');
  if (!p || !v || !i || Math.abs(p.phi) < 1e-6) return null;
  const width = text.length * font * 0.6;
  const a1 = (-v.signal.phase * Math.PI) / 180;
  const a2 = (-i.signal.phase * Math.PI) / 180;
  // The short way round from V to I, whichever side that is.
  let delta = a2 - a1;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const mid = a1 + delta / 2;
  const arcRadius = radius * 0.26;
  const segs = [v, i].map((a) => ({ x1: cx, y1: cy, x2: a.x, y2: a.y }));
  const boxAt = (d: number) => {
    const x = cx + Math.cos(mid) * d;
    const y = cy + Math.sin(mid) * d + font * 0.35;
    const anchor: 'start' | 'end' = Math.cos(mid) >= 0 ? 'start' : 'end';
    return { x, y, anchor, box: { x1: anchor === 'start' ? x : x - width, x2: anchor === 'start' ? x + width : x, y1: y - font, y2: y + font * 0.25 } };
  };
  const clear = (box: AngleLabel['box']) => segs.every((s) => {
    for (let k = 0; k <= 40; k++) {
      const px = s.x1 + ((s.x2 - s.x1) * k) / 40;
      const py = s.y1 + ((s.y2 - s.y1) * k) / 40;
      if (px > box.x1 - 6 && px < box.x2 + 6 && py > box.y1 - 6 && py < box.y2 + 6) return false;
    }
    return true;
  });
  let placed = null as ReturnType<typeof boxAt> | null;
  for (let d = arcRadius + 18; d <= radius * 1.6; d += 6) {
    const candidate = boxAt(d);
    if (clear(candidate.box)) { placed = candidate; break; }
  }
  if (!placed) {
    // Below the lower of the two arrows, centred on the origin.
    const bottom = Math.max(cy, v.y, i.y) + font * 1.6;
    const x = cx + 8;
    placed = { x, y: bottom, anchor: 'start', box: { x1: x, x2: x + width, y1: bottom - font, y2: bottom + font * 0.25 } };
  }
  return {
    ...placed,
    arcRadius,
    from: { x: cx + Math.cos(a1) * arcRadius, y: cy + Math.sin(a1) * arcRadius },
    to: { x: cx + Math.cos(a2) * arcRadius, y: cy + Math.sin(a2) * arcRadius },
    sweep: delta > 0 ? 1 : 0,
  };
}

/** "P avg = 1.84 kW" - worked out, so never shown before the reveal. */
export function averagePowerText(f: AcFigure, reveal: boolean): string {
  const p = acPower(f);
  if (!p || !f.showPower) return '';
  return 'P avg = ' + (reveal ? formatQuantity(p.real, 'W') : '?');
}

/** Whether the angle between V and I may be printed yet. */
export function phaseShown(f: AcFigure, reveal: boolean): boolean {
  return reveal || !f.ask || !['phase', 'powerFactor'].includes(f.ask.quantity);
}

/** "I lags V by 90°", or "V and I in phase". */
export function relationText(f: AcFigure, reveal: boolean): string {
  const p = acPower(f);
  const v = f.signals.find((s) => s.kind === 'voltage');
  const i = f.signals.find((s) => s.kind === 'current');
  if (!p || !v || !i) return '';
  const angle = phaseShown(f, reveal) ? formatQuantity(Math.abs(p.phi), '°') : '?';
  if (Math.abs(p.phi) < 1e-9) return v.label + ' and ' + i.label + ' in phase';
  return i.label + (p.phi > 0 ? ' lags ' : ' leads ') + v.label + ' by ' + angle;
}

export function acAskText(f: AcFigure, reveal: boolean): string {
  if (!f.ask) return '';
  const names: Record<AcAsk, string> = {
    phase: 'Phase difference', power: 'Average power', reactive: 'Reactive power', apparent: 'Apparent power',
    powerFactor: 'Power factor', rms: 'RMS value', peak: 'Peak value', period: 'Period', frequency: 'Frequency',
    impedance: 'Impedance',
  };
  const target = f.ask.signal ? ' of ' + (f.signals.find((s) => s.id === f.ask!.signal)?.label || f.ask.signal) : '';
  const a = answerAc(f);
  const shown = reveal && a ? (a.kind === 'number' ? formatQuantity(a.value, a.unit) : a.value) : '?';
  const suffix = reveal && f.ask.quantity === 'powerFactor' && a && a.kind === 'number' && !sameValue(a.value, 1) && a.value > 0
    ? ' ' + (acPower(f)!.phi > 0 ? 'lagging' : 'leading') : '';
  return names[f.ask.quantity] + target + ' = ' + shown + suffix;
}

export const AC_FAMILY: FigureFamily<AcFigure> = {
  type: 'ac',
  label: 'sinusoidal voltages and currents as waveforms and/or phasors, with the power they carry.',
  fits: /electrical|network|circuit|alternating|\bac\b|phasor|impedance|power factor|rms|resonance|signals|harmonic|oscilloscope|machines|power systems|power electronics|measurement|physics/i,
  normalize: normalizeAc,
  answer: answerAc,
  docs: [
    '{"type":"ac","frequency":50,"view":"both","showPower":true,',
    ' "signals":[{"id":"V","kind":"voltage","rms":230,"phase":0},{"id":"I","kind":"current","rms":10,"phase":-90}],',
    ' "ask":{"quantity":"power"}}',
    'rms in volts or amperes; phase in degrees, positive LEADS (a current lagging by 90° has phase -90).',
    'view: "waveform", "phasor" or "both". 1 to 3 signals. showPower shades p = v × i and draws its',
    'average, and needs exactly one voltage and one current - use it for any question about power.',
    'ask quantity: phase, power, reactive, apparent, powerFactor, impedance (these need one voltage',
    'and one current), rms or peak (with "signal": id), period, frequency.',
  ],
};
