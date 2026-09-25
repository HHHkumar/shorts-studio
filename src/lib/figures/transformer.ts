// ---------------------------------------------------------------------------
// Transformers: ratio, currents, the EMF equation, efficiency, regulation.
//
// One transformer is described by what the question states - voltages, turns
// or a ratio, a kVA rating, the core flux, the losses - and every relation an
// exam uses is computed from it: V1/V2 = N1/N2 = I2/I1, I = S/V (with √3 for
// three-phase), E = 4.44 f N Φm, η = xS cos φ / (xS cos φ + Pi + x²Pcu), the
// load for maximum efficiency x = √(Pi/Pcu), regulation ≈ %R cos φ ± %X sin φ,
// and the copper an autotransformer saves. Statements that contradict each
// other - a turns ratio that is not the voltage ratio - are refused.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './quantity.ts';

export type TransformerAsk =
  | 'primaryVoltage' | 'secondaryVoltage' | 'turnsRatio' | 'primaryTurns' | 'secondaryTurns'
  | 'primaryCurrent' | 'secondaryCurrent' | 'primaryEmf' | 'secondaryEmf' | 'maxFlux' | 'fluxDensity'
  | 'efficiency' | 'maxEfficiencyLoad' | 'maxEfficiency' | 'regulation' | 'copperSaving';
export const TRANSFORMER_ASKS: TransformerAsk[] = ['primaryVoltage', 'secondaryVoltage', 'turnsRatio', 'primaryTurns', 'secondaryTurns', 'primaryCurrent', 'secondaryCurrent', 'primaryEmf', 'secondaryEmf', 'maxFlux', 'fluxDensity', 'efficiency', 'maxEfficiencyLoad', 'maxEfficiency', 'regulation', 'copperSaving'];

export interface Transformer {
  type: 'transformer';
  phases: 1 | 3;
  /** N1 / N2 = V1 / V2. */
  ratio: number;
  V1?: number;
  V2?: number;
  N1?: number;
  N2?: number;
  /** VA. */
  rating?: number;
  frequency?: number;
  /** Peak core flux, Wb. */
  flux?: number;
  /** Core cross-section, m², when the question gives flux density instead of flux. */
  area?: number;
  powerFactor?: number;
  /** W. */
  ironLoss?: number;
  /** Full-load copper loss, W. */
  copperLoss?: number;
  /** Fraction of full load, 1 when not stated. */
  load: number;
  /** Percentage resistance and reactance, for regulation. */
  percentR?: number;
  percentX?: number;
  lagging: boolean;
  auto: boolean;
  ask?: TransformerAsk;
  /** What the question stated, so nothing worked out shows before the reveal. */
  given: string[];
}

function q(raw: unknown, unit: UnitClass): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const v = parseQuantity(String(raw ?? ''));
  if (!v || (v.unit && v.unit !== unit)) return null;
  return v.value;
}

/** "10:1", "10/1", 10 - as N1/N2. */
function ratioOf(raw: unknown): number | null {
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(raw ?? ''));
  if (m) return Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeTransformer(raw: any): { figure: Transformer | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const given: string[] = [];
  const read = (field: string, unit: UnitClass, key = field) => {
    if (r[field] === undefined || r[field] === null || r[field] === '') return undefined;
    const v = q(r[field], unit);
    if (v === null || !(v > 0)) { errors.push(field + ' must be a positive value in ' + unit); return undefined; }
    given.push(key);
    return v;
  };
  const V1 = read('primaryVoltage', 'V', 'V1');
  const V2 = read('secondaryVoltage', 'V', 'V2');
  const rating = read('rating', 'VA');
  const frequency = r.frequency === undefined ? undefined : num(r.frequency) ?? undefined;
  if (frequency !== undefined) given.push('f');
  let flux = read('maxFlux', 'Wb', 'flux');
  const density = read('fluxDensity', 'T', 'B');
  const area = r.area === undefined ? undefined : num(r.area) ?? undefined;
  const ironLoss = read('ironLoss', 'W');
  const copperLoss = read('copperLoss', 'W');
  const N1g = r.primaryTurns === undefined ? undefined : num(r.primaryTurns) ?? undefined;
  const N2g = r.secondaryTurns === undefined ? undefined : num(r.secondaryTurns) ?? undefined;
  if (N1g !== undefined) given.push('N1');
  if (N2g !== undefined) given.push('N2');
  const ratioG = r.turnsRatio === undefined ? undefined : ratioOf(r.turnsRatio) ?? undefined;
  if (r.turnsRatio !== undefined && ratioG === undefined) errors.push('turnsRatio is written "10:1" (N1:N2)');
  if (ratioG !== undefined) given.push('ratio');
  let pf = r.powerFactor === undefined ? undefined : num(r.powerFactor) ?? undefined;
  if (pf !== undefined && !(pf > 0 && pf <= 1)) { errors.push('a power factor lies between 0 and 1'); pf = undefined; }
  if (pf !== undefined) given.push('pf');
  const load = r.load === undefined ? 1 : num(r.load);
  if (load === null || !(load > 0 && load <= 2)) errors.push('load is a fraction of full load, e.g. 0.5 for half load');
  const percentR = r.percentR === undefined ? undefined : num(r.percentR) ?? undefined;
  const percentX = r.percentX === undefined ? undefined : num(r.percentX) ?? undefined;
  const phases = Number(r.phases) === 3 ? 3 : 1;
  const lagging = r.lagging !== false;
  const auto = Boolean(r.auto);

  if (density !== undefined) {
    if (!(area && area > 0)) errors.push('fluxDensity needs the core area in m²');
    else if (flux !== undefined && !sameValue(flux, density * area)) errors.push('maxFlux is not fluxDensity × area');
    else flux = density * area;
  }

  // The ratio, from whichever pair was stated; every other pair must agree.
  const ratios: [string, number][] = [];
  if (ratioG) ratios.push(['the turns ratio', ratioG]);
  if (N1g && N2g) ratios.push(['the turns', N1g / N2g]);
  if (V1 && V2) ratios.push(['the voltages', V1 / V2]);
  let ratio = ratios[0]?.[1];
  for (const [what, value] of ratios.slice(1)) {
    if (!sameValue(value, ratio!)) errors.push(what + ' give a ratio of ' + value.toFixed(3) + ', not ' + ratio!.toFixed(3));
  }
  let N1 = N1g;
  let N2 = N2g;
  // Turns from the EMF equation when the flux and frequency are known - whether
  // or not the ratio is already settled by the voltages.
  if (flux && frequency) {
    if (!N1 && V1) N1 = V1 / (4.44 * frequency * flux);
    if (!N2 && V2) N2 = V2 / (4.44 * frequency * flux);
    if (!ratio && N1 && N2) ratio = N1 / N2;
  }
  if (!ratio && !(N1 && N2)) errors.push('state the ratio: two voltages, two turns counts, or turnsRatio');
  if (ratio) {
    if (N1 && !N2) N2 = N1 / ratio;
    if (N2 && !N1) N1 = N2 * ratio;
  }
  const v1 = V1 ?? (V2 && ratio ? V2 * ratio : undefined);
  const v2 = V2 ?? (V1 && ratio ? V1 / ratio : undefined);
  // Voltage, turns, flux and frequency all stated: the EMF equation must hold.
  if (V1 && N1g && flux && frequency && !sameValue(4.44 * frequency * flux * N1g, V1)) {
    errors.push('4.44 f Φm N1 gives ' + formatQuantity(4.44 * frequency * flux * N1g, 'V') + ', not the stated ' + formatQuantity(V1, 'V'));
  }

  let ask: TransformerAsk | undefined;
  const a = str(r.ask && typeof r.ask === 'object' ? r.ask.quantity : r.ask, 24) as TransformerAsk;
  if (a) {
    const needs: Partial<Record<TransformerAsk, [boolean, string]>> = {
      primaryCurrent: [!!rating && !!v1, 'a rating and the primary voltage'],
      secondaryCurrent: [!!rating && !!v2, 'a rating and the secondary voltage'],
      primaryEmf: [!!frequency && !!flux && !!N1, 'frequency, flux and primary turns'],
      secondaryEmf: [!!frequency && !!flux && !!N2, 'frequency, flux and secondary turns'],
      maxFlux: [!!frequency && !!N1 && !!v1, 'frequency, primary turns and voltage'],
      fluxDensity: [!!frequency && !!N1 && !!v1 && !!area, 'frequency, primary turns, voltage and core area'],
      efficiency: [!!rating && pf !== undefined && ironLoss !== undefined && copperLoss !== undefined, 'rating, powerFactor, ironLoss and copperLoss'],
      maxEfficiencyLoad: [ironLoss !== undefined && copperLoss !== undefined, 'ironLoss and copperLoss'],
      maxEfficiency: [!!rating && pf !== undefined && ironLoss !== undefined && copperLoss !== undefined, 'rating, powerFactor, ironLoss and copperLoss'],
      regulation: [percentR !== undefined && percentX !== undefined && pf !== undefined, 'percentR, percentX and powerFactor'],
      primaryVoltage: [!!v1, 'a secondary voltage and a ratio'],
      secondaryVoltage: [!!v2, 'a primary voltage and a ratio'],
      primaryTurns: [!!N1, 'turns or a voltage with the flux'],
      secondaryTurns: [!!N2, 'turns or a voltage with the flux'],
    };
    if (!TRANSFORMER_ASKS.includes(a)) errors.push('unknown question for a transformer: ' + a);
    else if (needs[a] && !needs[a]![0]) errors.push(a + ' needs ' + needs[a]![1]);
    else if (a === 'copperSaving' && !auto) errors.push('copperSaving is for an autotransformer: set "auto": true');
    else ask = a;
  }

  const figure: Transformer = {
    type: 'transformer', phases, ratio: ratio || 1, load: load || 1, lagging, auto, given,
    ...(v1 ? { V1: v1 } : {}), ...(v2 ? { V2: v2 } : {}), ...(N1 ? { N1 } : {}), ...(N2 ? { N2 } : {}),
    ...(rating ? { rating } : {}), ...(frequency ? { frequency } : {}), ...(flux ? { flux } : {}), ...(area ? { area } : {}),
    ...(pf !== undefined ? { powerFactor: pf } : {}), ...(ironLoss !== undefined ? { ironLoss } : {}),
    ...(copperLoss !== undefined ? { copperLoss } : {}), ...(percentR !== undefined ? { percentR } : {}),
    ...(percentX !== undefined ? { percentX } : {}), ...(ask ? { ask } : {}),
  };
  return { figure: errors.length ? null : figure, errors };
}

export function solveTransformer(t: Transformer) {
  const k = t.phases === 3 ? Math.sqrt(3) : 1;
  const I1 = t.rating && t.V1 ? t.rating / (k * t.V1) : undefined;
  const I2 = t.rating && t.V2 ? t.rating / (k * t.V2) : undefined;
  const E1 = t.frequency && t.flux && t.N1 ? 4.44 * t.frequency * t.flux * t.N1 : undefined;
  const E2 = t.frequency && t.flux && t.N2 ? 4.44 * t.frequency * t.flux * t.N2 : undefined;
  const flux = t.flux ?? (t.frequency && t.N1 && t.V1 ? t.V1 / (4.44 * t.frequency * t.N1) : undefined);
  const density = flux && t.area ? flux / t.area : undefined;
  const efficiencyAt = (x: number) => {
    if (!t.rating || t.powerFactor === undefined || t.ironLoss === undefined || t.copperLoss === undefined) return undefined;
    const out = x * t.rating * t.powerFactor;
    return (100 * out) / (out + t.ironLoss + x * x * t.copperLoss);
  };
  const xMax = t.ironLoss !== undefined && t.copperLoss ? Math.sqrt(t.ironLoss / t.copperLoss) : undefined;
  const sin = t.powerFactor !== undefined ? Math.sin(Math.acos(t.powerFactor)) : 0;
  const regulation = t.percentR !== undefined && t.percentX !== undefined && t.powerFactor !== undefined
    ? t.percentR * t.powerFactor + (t.lagging ? 1 : -1) * t.percentX * sin
    : undefined;
  // An autotransformer uses (1 - K) of the copper of a two-winding one, K = low/high voltage.
  const K = t.ratio >= 1 ? 1 / t.ratio : t.ratio;
  return {
    I1, I2, E1, E2, flux, density,
    efficiency: efficiencyAt(t.load),
    xMax,
    maxEfficiency: xMax !== undefined ? efficiencyAt(xMax) : undefined,
    regulation,
    copperSaving: 100 * K,
  };
}

export function answerTransformer(t: Transformer): FigureAnswer | null {
  if (!t.ask) return null;
  const s = solveTransformer(t);
  const n = (value: number | undefined, unit: UnitClass): FigureAnswer | null =>
    value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit };
  switch (t.ask) {
    case 'primaryVoltage': return n(t.V1, 'V');
    case 'secondaryVoltage': return n(t.V2, 'V');
    case 'turnsRatio': return n(t.ratio, '');
    case 'primaryTurns': return n(t.N1, '');
    case 'secondaryTurns': return n(t.N2, '');
    case 'primaryCurrent': return n(s.I1, 'A');
    case 'secondaryCurrent': return n(s.I2, 'A');
    case 'primaryEmf': return n(s.E1, 'V');
    case 'secondaryEmf': return n(s.E2, 'V');
    case 'maxFlux': return n(s.flux, 'Wb');
    case 'fluxDensity': return n(s.density, 'T');
    case 'efficiency': return n(s.efficiency, '%');
    case 'maxEfficiencyLoad': return n(s.xMax !== undefined ? s.xMax * 100 : undefined, '%');
    case 'maxEfficiency': return n(s.maxEfficiency, '%');
    case 'regulation': return n(s.regulation, '%');
    case 'copperSaving': return n(s.copperSaving, '%');
  }
  return null;
}

// --- what the drawing says --------------------------------------------------------------

export function transformerSides(t: Transformer, reveal: boolean) {
  const s = solveTransformer(t);
  const stated = (key: string) => reveal || t.given.includes(key);
  const side = (items: [string, string, number | undefined, (v: number) => string][]) =>
    items.filter(([, , v]) => v !== undefined).map(([key, name, v, fmt]) => name + ' = ' + (stated(key) ? fmt(v!) : '?'));
  return {
    left: side([
      ['V1', 'V₁', t.V1, (v) => formatQuantity(v, 'V')],
      ['N1', 'N₁', t.N1, (v) => String(Math.round(v))],
      ['I1', 'I₁', s.I1, (v) => formatQuantity(v, 'A')],
    ]),
    right: side([
      ['V2', 'V₂', t.V2, (v) => formatQuantity(v, 'V')],
      ['N2', 'N₂', t.N2, (v) => String(Math.round(v))],
      ['I2', 'I₂', s.I2, (v) => formatQuantity(v, 'A')],
    ]),
    // Under the core: the rating, flux and losses, as stated or worked out.
    below: [
      t.rating ? (t.phases === 3 ? '3-phase, ' : '') + formatQuantity(t.rating, 'VA') + (t.frequency ? ', ' + t.frequency + ' Hz' : '') : undefined,
      s.flux !== undefined ? 'Φm = ' + (stated('flux') ? formatQuantity(s.flux, 'Wb') : '?') : undefined,
      t.ironLoss !== undefined ? 'Pi = ' + formatQuantity(t.ironLoss, 'W') + (t.copperLoss !== undefined ? ',  Pcu = ' + formatQuantity(t.copperLoss, 'W') : '') : undefined,
    ].filter(Boolean) as string[],
  };
}

export interface TransformerLayout {
  /** Outer edge of the core. */
  core: { x: number; y: number; w: number; h: number };
  /** Limb thickness. */
  limb: number;
  /** Where each winding sits on its limb, top to bottom. */
  primary: { x: number; y1: number; y2: number };
  secondary: { x: number; y1: number; y2: number };
  left: { x: number; y: number }[];
  right: { x: number; y: number }[];
  below: { x: number; y: number }[];
  /** Widest text in each column, for the fit test. */
  leftWidth: number;
  rightWidth: number;
}

/**
 * The core sits in the middle with room on each side sized to the longest
 * value that goes there - measured, not assumed - and the rating, flux and
 * losses in rows underneath.
 */
export function layoutTransformer(t: Transformer, width: number, height: number, font: number): TransformerLayout {
  const sides = transformerSides(t, true); // the revealed text is the longest it will be
  const cw = font * 0.6;
  const leftWidth = Math.max(0, ...sides.left.map((s) => s.length * cw));
  const rightWidth = Math.max(0, ...sides.right.map((s) => s.length * cw));
  const rowH = font * 1.3;
  const belowH = sides.below.length * rowH + (sides.below.length ? font * 0.8 : 0);
  // Room between the core and the values beside it: the winding overhangs the
  // limb and its leads run out past that, and the first render put V₁ on the coil.
  const gap = 68;
  const coreW = Math.max(160, Math.min(420, width - leftWidth - rightWidth - gap * 2 - 20));
  const coreH = Math.min(height - belowH - font * 1.2, coreW * 1.05, 520);
  const x = leftWidth + gap + (width - leftWidth - rightWidth - gap * 2 - coreW) / 2;
  const y = font * 0.6 + (height - belowH - font * 0.6 - coreH) / 2;
  const limb = Math.max(26, coreW * 0.16);
  const windTop = y + coreH * 0.22;
  const windBottom = y + coreH * 0.78;
  const column = (count: number) => {
    const top = y + coreH / 2 - ((count - 1) * rowH) / 2 + font * 0.35;
    return Array.from({ length: count }, (_, k) => top + k * rowH);
  };
  return {
    core: { x, y, w: coreW, h: coreH },
    limb,
    primary: { x: x + limb / 2, y1: windTop, y2: windBottom },
    secondary: { x: x + coreW - limb / 2, y1: windTop, y2: windBottom },
    left: column(sides.left.length).map((yy) => ({ x: x - gap, y: yy })),
    right: column(sides.right.length).map((yy) => ({ x: x + coreW + gap, y: yy })),
    below: sides.below.map((_, k) => ({ x: width / 2, y: y + coreH + font * 1.5 + k * rowH })),
    leftWidth,
    rightWidth,
  };
}

export function transformerAskText(t: Transformer, reveal: boolean): string {
  if (!t.ask) return '';
  const names: Record<TransformerAsk, string> = {
    primaryVoltage: 'Primary voltage', secondaryVoltage: 'Secondary voltage', turnsRatio: 'Turns ratio N₁ : N₂',
    primaryTurns: 'Primary turns', secondaryTurns: 'Secondary turns', primaryCurrent: 'Primary current',
    secondaryCurrent: 'Secondary current', primaryEmf: 'Primary EMF', secondaryEmf: 'Secondary EMF',
    maxFlux: 'Maximum flux', fluxDensity: 'Peak flux density', efficiency: 'Efficiency',
    maxEfficiencyLoad: 'Maximum efficiency at', maxEfficiency: 'Maximum efficiency', regulation: 'Voltage regulation',
    copperSaving: 'Copper saved',
  };
  const a = answerTransformer(t);
  if (!reveal || !a || a.kind !== 'number') return names[t.ask] + ' = ?';
  const value = t.ask === 'turnsRatio' ? formatQuantity(a.value, '') + ' : 1'
    : t.ask === 'primaryTurns' || t.ask === 'secondaryTurns' ? String(Math.round(a.value))
    : t.ask === 'maxEfficiencyLoad' ? formatQuantity(a.value, '%') + ' of full load'
    : formatQuantity(a.value, a.unit);
  return names[t.ask] + ' = ' + value;
}

export const TRANSFORMER_FAMILY: FigureFamily<Transformer> = {
  type: 'transformer',
  label: 'a transformer: ratio, currents, the EMF equation, efficiency, regulation and autotransformer saving.',
  fits: /electrical|transformer|machines|power systems|utili[sz]ation|measurement|ct and pt|cts and pts|distribution|generation/i,
  normalize: normalizeTransformer,
  answer: answerTransformer,
  docs: [
    '{"type":"transformer","primaryVoltage":"2200 V","secondaryVoltage":"220 V","rating":"10 kVA","ask":"secondaryCurrent"}',
    'State only what the question states: primaryVoltage, secondaryVoltage, primaryTurns, secondaryTurns, turnsRatio',
    '("10:1"), rating ("10 kVA"), phases (1 or 3), frequency, maxFlux ("25 mWb") or fluxDensity ("1.2 T") with area',
    '(m²), powerFactor, ironLoss and copperLoss (full-load, "200 W"), load (0.5 for half load), percentR and',
    'percentX (for regulation), lagging, auto (true for an autotransformer).',
    'ask: primaryVoltage, secondaryVoltage, turnsRatio, primaryTurns, secondaryTurns, primaryCurrent,',
    'secondaryCurrent, primaryEmf, secondaryEmf, maxFlux, fluxDensity, efficiency, maxEfficiencyLoad (as % of',
    'full load), maxEfficiency, regulation, copperSaving. Efficiencies, regulation and savings are answered in %.',
  ],
};
