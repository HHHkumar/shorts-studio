// ---------------------------------------------------------------------------
// Bar models for arithmetic aptitude.
//
// Ratio shares, percentage change, profit and discount, simple and compound
// interest, time and work, alligation and replacement, and averages - the
// chapters an aptitude paper spends half its questions on. Each is a small
// solver over what the question states, and each draws the same way: bars
// split into labelled segments, so "3 parts of 8" is visibly three of eight
// equal blocks, and a line of working per step underneath.
// ---------------------------------------------------------------------------

import { num, str, type FigureAnswer, type FigureFamily } from './family.ts';
import { roundForDisplay, sameValue } from './quantity.ts';
import { CHAR_WIDTH } from './circuit.ts';

export type BarsModel = 'ratio' | 'percentage' | 'profit' | 'interest' | 'work' | 'alligation' | 'replacement' | 'average';

export interface Segment {
  value: number;
  text: string;
  accent?: boolean;
  /** Drawn as equal blocks - a ratio's parts. */
  blocks?: number;
  /** What has gone: an outline, not a fill. */
  ghost?: boolean;
}
export interface BarRow { label: string; segments: Segment[] }

export interface Bars {
  type: 'bars';
  model: BarsModel;
  /** Prefix money with ₹. */
  money: boolean;
  data: Record<string, any>;
  ask: string;
  given: string[];
}

const r2 = (n: number) => roundForDisplay(n);
const money = (b: { money: boolean }, n: number) => (b.money ? '₹' : '') + r2(n);
const gcd = (a: number, b: number): number => (b < 1e-9 ? a : gcd(b, a % b));
/** "3:2" in lowest whole terms, from two positive numbers. */
export function ratioText(a: number, b: number): string {
  for (const scale of [1, 2, 3, 4, 5, 6, 8, 10, 12, 100]) {
    const x = a * scale;
    const y = b * scale;
    if (Math.abs(x - Math.round(x)) < 1e-6 && Math.abs(y - Math.round(y)) < 1e-6) {
      const g = gcd(Math.round(x), Math.round(y)) || 1;
      return Math.round(x) / g + ' : ' + Math.round(y) / g;
    }
  }
  return r2(a / b) + ' : 1';
}

type Solved = { answer: FigureAnswer | null; rows: BarRow[]; lines: string[]; answerText: string };
type Model = {
  asks: string[];
  normalize(r: any, errors: string[], given: string[]): Record<string, any> | null;
  solve(b: Bars, reveal: boolean): Solved;
};

const n = (value: number | undefined): FigureAnswer | null =>
  value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit: '' };
const pct = (value: number | undefined): FigureAnswer | null =>
  value === undefined || !Number.isFinite(value) ? null : { kind: 'number', value, unit: '%' };
const show = (b: Bars, key: string, reveal: boolean, text: string) => (reveal || b.given.includes(key) ? text : '?');

const readNum = (r: any, key: string, errors: string[], given: string[], positive = true) => {
  if (r[key] === undefined || r[key] === null || r[key] === '') return undefined;
  const v = num(typeof r[key] === 'string' ? String(r[key]).replace(/[₹,%]/g, '').replace(/^rs\.?\s*/i, '') : r[key]);
  if (v === null || (positive && !(v > 0))) { errors.push(key + ' must be a ' + (positive ? 'positive ' : '') + 'number'); return undefined; }
  given.push(key);
  return v;
};

// --- ratio -----------------------------------------------------------------------------
const RATIO: Model = {
  asks: ['share', 'total'],
  normalize(r, errors, given) {
    const parts = (Array.isArray(r.parts) ? r.parts : []).map((p: any, i: number) => ({
      label: str(p && p.label, 14) || String.fromCharCode(65 + i), ratio: num(p && p.ratio),
    }));
    if (parts.length < 2 || parts.length > 4 || parts.some((p: any) => !(p.ratio > 0))) {
      errors.push('ratio needs 2 to 4 parts, each with a positive ratio');
      return null;
    }
    const total = readNum(r, 'total', errors, given);
    const knownLabel = str(r.known && r.known.label, 14);
    const knownValue = r.known ? num(r.known.value) : null;
    const diff = r.difference && typeof r.difference === 'object' ? r.difference : null;
    let unit: number | undefined;
    if (total !== undefined) unit = total / parts.reduce((s: number, p: any) => s + p.ratio, 0);
    if (knownLabel && knownValue !== null) {
      const p = parts.find((x: any) => x.label === knownLabel);
      if (!p) errors.push('the known share names a part that does not exist');
      else {
        const u = knownValue / p.ratio;
        if (unit !== undefined && !sameValue(u, unit)) errors.push('the known share does not fit the total');
        unit = u;
        given.push('share:' + knownLabel);
      }
    }
    if (diff) {
      const a = parts.find((x: any) => x.label === str(diff.a, 14));
      const bb = parts.find((x: any) => x.label === str(diff.b, 14));
      const v = num(diff.value);
      if (!a || !bb || v === null || a.ratio === bb.ratio) errors.push('a difference names two parts with different ratios and a value');
      else {
        const u = v / Math.abs(a.ratio - bb.ratio);
        if (unit !== undefined && !sameValue(u, unit)) errors.push('the difference does not fit the other values');
        unit = u;
        given.push('difference');
      }
    }
    if (unit === undefined) errors.push('give the total, one share, or the difference between two shares');
    const askPart = str(r.ask && r.ask.part, 14) || str(r.askPart, 14);
    return { parts, unit, askPart };
  },
  solve(b, reveal) {
    const { parts, unit, askPart } = b.data;
    const sum = parts.reduce((s: number, p: any) => s + p.ratio, 0);
    const shareOf = (label: string) => parts.find((p: any) => p.label === label)!.ratio * unit;
    const hidden = (label: string) => !reveal && !b.given.includes('share:' + label);
    const row: BarRow = {
      label: 'Total ' + show(b, 'total', reveal, money(b, sum * unit)),
      segments: parts.map((p: any) => ({
        value: p.ratio, text: p.label + ': ' + (hidden(p.label) ? '?' : money(b, p.ratio * unit)), accent: p.label === askPart,
        blocks: Number.isInteger(p.ratio) && p.ratio <= 24 ? p.ratio : undefined,
      })),
    };
    const lines = [
      'Ratio ' + parts.map((p: any) => p.ratio).join(' : ') + ' = ' + sum + ' parts',
      '1 part = ' + (reveal ? money(b, unit) : '?'),
    ];
    let answer: FigureAnswer | null = null;
    let answerText = '';
    if (b.ask === 'total') { answer = n(sum * unit); answerText = 'Total = ' + (reveal ? money(b, sum * unit) : '?'); }
    else if (askPart) { answer = n(shareOf(askPart)); answerText = askPart + "'s share = " + (reveal ? money(b, shareOf(askPart)) : '?'); }
    return { answer, rows: [row], lines, answerText };
  },
};

// --- percentage --------------------------------------------------------------------------
const PERCENTAGE: Model = {
  asks: ['final', 'base', 'netChange'],
  normalize(r, errors, given) {
    const changes = (Array.isArray(r.changes) ? r.changes : []).map((c: unknown) => num(typeof c === 'string' ? c.replace('%', '') : c));
    if (!changes.length || changes.length > 4 || changes.some((c: number | null) => c === null || c <= -100)) {
      errors.push('percentage needs 1 to 4 changes in percent, e.g. [20, -10]');
      return null;
    }
    given.push('changes');
    const base = readNum(r, 'base', errors, given);
    const final = readNum(r, 'final', errors, given);
    const factor = changes.reduce((f: number, c: number) => f * (1 + c / 100), 1);
    if (base !== undefined && final !== undefined && !sameValue(base * factor, final)) errors.push('the final value does not follow from the base and the changes');
    return { changes, base: base ?? (final !== undefined ? final / factor : 100), factor, assumedBase: base === undefined && final === undefined };
  },
  solve(b, reveal) {
    const { changes, base, factor } = b.data;
    const rows: BarRow[] = [];
    let value = base;
    rows.push({ label: b.data.assumedBase ? 'Take 100' : 'Start', segments: [{ value: base, text: b.data.assumedBase ? '100' : show(b, 'base', reveal, money(b, base)) }] });
    changes.forEach((c: number, k: number) => {
      const next = value * (1 + c / 100);
      const last = k === changes.length - 1;
      const shown = reveal || (last && b.given.includes('final'));
      rows.push({ label: (c >= 0 ? '+' : '') + r2(c) + '%', segments: [{ value: next, text: shown ? money(b, next) : '?', accent: last }] });
      value = next;
    });
    const net = (factor - 1) * 100;
    const lines = [
      'Multiply by ' + changes.map((c: number) => r2(1 + c / 100)).join(' × ') + ' = ' + (reveal ? r2(factor) : '?'),
      'Net change = ' + (reveal ? (net >= 0 ? '+' : '') + r2(net) + '%' : '?'),
    ];
    const answer = b.ask === 'base' ? n(base) : b.ask === 'netChange' ? pct(net) : n(base * factor);
    return { answer, rows, lines, answerText: '' };
  },
};

// --- profit, loss and discount --------------------------------------------------------------
const PROFIT: Model = {
  asks: ['sellingPrice', 'costPrice', 'markedPrice', 'profitPercent', 'discountPercent'],
  normalize(r, errors, given) {
    let cp = readNum(r, 'costPrice', errors, given);
    let sp = readNum(r, 'sellingPrice', errors, given);
    let mp = readNum(r, 'markedPrice', errors, given);
    let p = r.profitPercent === undefined ? undefined : num(String(r.profitPercent).replace('%', ''));
    if (p === null || (p !== undefined && p <= -100)) { errors.push('profitPercent is a percentage above -100 (negative for a loss)'); p = undefined; }
    if (p !== undefined) given.push('profitPercent');
    const discounts = (Array.isArray(r.discounts) ? r.discounts : r.discountPercent !== undefined ? [r.discountPercent] : [])
      .map((d: unknown) => num(String(d).replace('%', '')));
    if (discounts.some((d: number | null) => d === null || d < 0 || d >= 100)) { errors.push('discounts are percentages from 0 to 100'); return null; }
    if (discounts.length) given.push('discountPercent');
    const keep = discounts.reduce((f: number, d: number) => f * (1 - d / 100), 1);
    const d = discounts.length ? (1 - keep) * 100 : undefined;
    // Propagate the two relations until nothing more can be found.
    for (let pass = 0; pass < 4; pass++) {
      if (sp === undefined && cp !== undefined && p !== undefined) sp = cp * (1 + p / 100);
      if (cp === undefined && sp !== undefined && p !== undefined) cp = sp / (1 + p / 100);
      if (p === undefined && cp !== undefined && sp !== undefined) p = (sp / cp - 1) * 100;
      if (sp === undefined && mp !== undefined && d !== undefined) sp = mp * keep;
      if (mp === undefined && sp !== undefined && d !== undefined) mp = sp / keep;
    }
    if (cp !== undefined && sp !== undefined && p !== undefined && given.includes('profitPercent') && given.includes('costPrice') && given.includes('sellingPrice')
      && !sameValue(sp, cp * (1 + p / 100))) errors.push('the profit percentage does not fit the cost and selling prices');
    let discount = d;
    if (discount === undefined && mp !== undefined && sp !== undefined) discount = (1 - sp / mp) * 100;
    return { cp, sp, mp, p, discount, discounts };
  },
  solve(b, reveal) {
    const { cp, sp, mp, p, discount, discounts } = b.data;
    const rows: BarRow[] = [];
    // Each price is a bar with its value in the name; profit, loss and discount are the gaps between them.
    const name = (label: string, key: string, v: number) => label + ' ' + show(b, key, reveal, money(b, v));
    const gap = (word: string, v: number, accent: boolean, ghost: boolean) => ({ value: v, text: word + ' ' + (reveal ? money(b, v) : '?'), accent, ghost });
    if (cp !== undefined) rows.push({ label: name('Cost price', 'costPrice', cp), segments: [{ value: cp, text: '', accent: b.ask === 'costPrice' }] });
    if (sp !== undefined) {
      const segments: Segment[] = cp === undefined ? [{ value: sp, text: '', accent: b.ask === 'sellingPrice' }]
        : sp >= cp ? [{ value: cp, text: '', accent: b.ask === 'sellingPrice' }, gap('profit', sp - cp, b.ask === 'profitPercent' || b.ask === 'sellingPrice', false)]
        : [{ value: sp, text: '', accent: b.ask === 'sellingPrice' }, gap('loss', cp - sp, b.ask === 'profitPercent', true)];
      rows.push({ label: name('Selling price', 'sellingPrice', sp), segments });
    }
    if (mp !== undefined) {
      rows.push({
        label: name('Marked price', 'markedPrice', mp),
        segments: sp === undefined ? [{ value: mp, text: '', accent: b.ask === 'markedPrice' }]
          : [{ value: sp, text: '', accent: b.ask === 'markedPrice' }, gap('discount', mp - sp, b.ask === 'discountPercent' || b.ask === 'markedPrice', true)],
      });
    }
    const lines: string[] = [];
    if (p !== undefined) lines.push((p >= 0 ? 'Profit ' : 'Loss ') + show(b, 'profitPercent', reveal, r2(Math.abs(p)) + '%') + ' on cost');
    if (discount !== undefined) {
      lines.push((discounts.length > 1 ? 'Successive discounts ' + discounts.map((d: number) => r2(d) + '%').join(' then ') + ' = ' : 'Discount ') + show(b, 'discountPercent', reveal, r2(discount) + '%') + ' on marked price');
    }
    const map: Record<string, FigureAnswer | null> = {
      sellingPrice: n(sp), costPrice: n(cp), markedPrice: n(mp), profitPercent: pct(p), discountPercent: pct(discount),
    };
    return { answer: map[b.ask] ?? null, rows, lines, answerText: '' };
  },
};

// --- interest ---------------------------------------------------------------------------------
const INTEREST: Model = {
  asks: ['amount', 'interest', 'difference', 'simpleInterest', 'compoundInterest'],
  normalize(r, errors, given) {
    const principal = readNum(r, 'principal', errors, given);
    const rate = readNum(r, 'rate', errors, given);
    const time = readNum(r, 'time', errors, given);
    if (principal === undefined || rate === undefined || time === undefined) {
      errors.push('interest needs principal, rate (% per year) and time (years)');
      return null;
    }
    const compounding = ['simple', 'annual', 'half-yearly', 'quarterly'].includes(r.compounding) ? r.compounding : 'annual';
    return { principal, rate, time, compounding };
  },
  solve(b, reveal) {
    const { principal: P, rate: R, time: T, compounding } = b.data;
    const perYear = compounding === 'half-yearly' ? 2 : compounding === 'quarterly' ? 4 : 1;
    const SI = (P * R * T) / 100;
    const CIamount = P * Math.pow(1 + R / (100 * perYear), perYear * T);
    const CI = CIamount - P;
    const simple = compounding === 'simple';
    const years = Math.min(6, Math.ceil(T));
    const rows: BarRow[] = [];
    for (let y = 1; y <= years; y++) {
      const t = Math.min(y, T);
      const growth = simple ? (P * R * t) / 100 : P * Math.pow(1 + R / (100 * perYear), perYear * t) - P;
      rows.push({ label: 'Year ' + r2(t), segments: [{ value: P, text: y === 1 ? money(b, P) : '' }, { value: growth, text: reveal ? '+' + money(b, growth) : '?', accent: y === years }] });
    }
    const lines = simple
      ? ['SI = P × R × T / 100 = ' + (reveal ? money(b, SI) : '?')]
      : ['A = P (1 + R/' + (perYear === 1 ? '100' : 100 * perYear) + ')^' + (perYear === 1 ? 'T' : perYear + 'T') + ' = ' + (reveal ? money(b, CIamount) : '?'),
        'CI = ' + (reveal ? money(b, CI) : '?') + '   (SI would be ' + (reveal ? money(b, SI) : '?') + ')'];
    const map: Record<string, FigureAnswer | null> = {
      amount: n(simple ? P + SI : CIamount), interest: n(simple ? SI : CI), difference: n(CI - SI),
      simpleInterest: n(SI), compoundInterest: n(CI),
    };
    return { answer: map[b.ask] ?? null, rows, lines, answerText: '' };
  },
};

// --- time and work, pipes and cisterns ------------------------------------------------------
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
const WORK: Model = {
  asks: ['together'],
  normalize(r, errors) {
    const workers = (Array.isArray(r.workers) ? r.workers : []).map((w: any, i: number) => ({
      label: str(w && w.label, 12) || String.fromCharCode(65 + i), days: num(w && w.days), empties: Boolean(w && w.empties),
    }));
    const unit = str(r.unit, 8) || 'days';
    if (workers.length < 2 || workers.length > 4 || workers.some((w: any) => !(w.days > 0))) {
      errors.push('work needs 2 to 4 workers or pipes, each with the time it takes alone');
      return null;
    }
    const rate = workers.reduce((s: number, w: any) => s + (w.empties ? -1 : 1) / w.days, 0);
    if (!(rate > 1e-12)) errors.push('together they never finish: the outlets empty as fast as the inlets fill');
    return { workers, rate, unit };
  },
  solve(b, reveal) {
    const { workers, rate } = b.data;
    const unit = b.data.unit || 'days';
    const per = unit.replace(/s$/, '');
    const whole = workers.every((w: any) => Number.isInteger(w.days));
    const units = whole ? workers.reduce((m: number, w: any) => lcm(m, w.days), 1) : 1;
    const rows: BarRow[] = workers.map((w: any) => ({
      label: w.label + (w.empties ? ' empties' : ' alone') + ' in ' + r2(w.days) + ' ' + unit,
      segments: [{ value: units / w.days, ghost: w.empties, text: (reveal ? (w.empties ? '−' : '+') + r2(units / w.days) : '?') + (whole ? ' units/' + per : ' per ' + per) }],
    }));
    const net = units * rate;
    rows.push({ label: 'Together', segments: [{ value: net, text: (reveal ? r2(net) : '?') + (whole ? ' units/' + per : ' per ' + per), accent: true }] });
    const lines = [
      whole ? 'Total work = LCM of ' + workers.map((w: any) => r2(w.days)).join(', ') + ' = ' + units + ' units' : 'Work per day = 1 ÷ days alone',
      'Time together = ' + (whole ? units + ' ÷ ' + (reveal ? r2(net) : '?') : '1 ÷ ' + (reveal ? r2(rate) : '?')) + ' = ' + (reveal ? r2(1 / rate) + ' ' + unit : '?'),
    ];
    return { answer: n(1 / rate), rows, lines, answerText: '' };
  },
};

// --- alligation -----------------------------------------------------------------------------
const ALLIGATION: Model = {
  asks: ['ratio', 'mean'],
  normalize(r, errors, given) {
    const cheaper = r.cheaper && typeof r.cheaper === 'object' ? { label: str(r.cheaper.label, 16) || 'cheaper', value: num(r.cheaper.value) } : null;
    const dearer = r.dearer && typeof r.dearer === 'object' ? { label: str(r.dearer.label, 16) || 'dearer', value: num(r.dearer.value) } : null;
    if (!cheaper || !dearer || cheaper.value === null || dearer.value === null || !(dearer.value > cheaper.value)) {
      errors.push('alligation needs a cheaper and a dearer value, the dearer larger');
      return null;
    }
    const mean = readNum(r, 'mean', errors, given, false);
    const qc = num(r.cheaperQuantity);
    const qd = num(r.dearerQuantity);
    if (mean !== undefined && !(mean > cheaper.value! && mean < dearer.value!)) errors.push('the mean must lie between the cheaper and dearer values');
    if (mean === undefined && !(qc && qd && qc > 0 && qd > 0)) errors.push('give the mean, or the quantities of each');
    if (qc && qd) given.push('quantities');
    const m = mean ?? (cheaper.value! * qc! + dearer.value! * qd!) / (qc! + qd!);
    return { cheaper, dearer, mean: m, quantities: qc && qd ? [qc, qd] : null };
  },
  solve(b, reveal) {
    const { cheaper, dearer, mean, quantities } = b.data;
    const a = dearer.value - mean;
    const c = mean - cheaper.value;
    const [pa, pc] = ratioText(a, c).split(' : ');
    const name = (x: { label: string; value: number }) => (x.label.includes(r2(x.value)) ? x.label : x.label + ' at ' + r2(x.value));
    const parts = (p: string, q: number | undefined) => (quantities && q !== undefined ? r2(q) : reveal ? p : '?') + (p === '1' && (reveal || quantities) ? ' part' : ' parts');
    const rows: BarRow[] = [
      { label: name(cheaper), segments: [{ value: a, text: parts(pa, quantities?.[0]) }] },
      { label: name(dearer), segments: [{ value: c, text: parts(pc, quantities?.[1]) }] },
    ];
    const lines = [
      'Mean ' + show(b, 'mean', reveal, r2(mean)),
      '(' + r2(dearer.value) + ' − ' + show(b, 'mean', reveal, r2(mean)) + ') : (' + show(b, 'mean', reveal, r2(mean)) + ' − ' + r2(cheaper.value) + ') = ' + (reveal ? ratioText(a, c) : '?'),
    ];
    const answer: FigureAnswer | null = b.ask === 'mean' ? n(mean) : { kind: 'text', value: ratioText(a, c) };
    return { answer, rows, lines, answerText: '' };
  },
};

// --- repeated replacement ----------------------------------------------------------------------
const REPLACEMENT: Model = {
  asks: ['remaining', 'remainingPercent'],
  normalize(r, errors, given) {
    const volume = readNum(r, 'volume', errors, given);
    const removed = readNum(r, 'removed', errors, given);
    const times = readNum(r, 'times', errors, given);
    if (volume === undefined || removed === undefined || times === undefined) { errors.push('replacement needs volume, removed each time, and times'); return null; }
    if (!(removed < volume)) errors.push('less must be removed than the vessel holds');
    if (!Number.isInteger(times) || times > 10) errors.push('times is a whole number up to 10');
    return { volume, removed, times, unit: str(r.unit, 6) };
  },
  solve(b, reveal) {
    const { volume: V, removed: x, times: k } = b.data;
    const u = b.data.unit ? ' ' + b.data.unit : '';
    const rows: BarRow[] = [];
    // Up to six bars: the start, the first few rounds, and always the last.
    const rounds = k <= 5 ? Array.from({ length: k + 1 }, (_, i) => i) : [0, 1, 2, 3, 4, k];
    for (const i of rounds) {
      const left = V * Math.pow(1 - x / V, i);
      rows.push({
        label: i === 0 ? 'Start' : 'After ' + i,
        segments: [{ value: left, text: (i === 0 || reveal ? r2(left) : '?') + u, accent: i === k }, { value: V - left, text: '', ghost: true }],
      });
    }
    const remaining = V * Math.pow(1 - x / V, k);
    const lines = ['Left = V (1 − x/V)^n = ' + r2(V) + ' × (1 − ' + r2(x) + '/' + r2(V) + ')^' + k + ' = ' + (reveal ? r2(remaining) + u : '?')];
    return { answer: b.ask === 'remainingPercent' ? pct((100 * remaining) / V) : n(remaining), rows, lines, answerText: '' };
  },
};

// --- averages ----------------------------------------------------------------------------------
const AVERAGE: Model = {
  asks: ['average', 'newAverage', 'addedValue'],
  normalize(r, errors, given) {
    const values = (Array.isArray(r.values) ? r.values : []).map((v: unknown) => num(v));
    const count = num(r.count);
    const average = num(r.average);
    if (values.length) {
      if (values.length > 12 || values.some((v: number | null) => v === null)) { errors.push('average takes up to 12 numeric values'); return null; }
      given.push('values');
    } else if (!(count && count > 0 && average !== null)) {
      errors.push('give the values, or their count and average');
      return null;
    } else given.push('count', 'average');
    const n0 = values.length || count!;
    const sum = values.length ? values.reduce((s: number, v: number) => s + v, 0) : count! * average!;
    const added = num(r.added);
    const removed = num(r.removed);
    const newAverage = num(r.newAverage);
    if (added !== null) given.push('added');
    if (removed !== null) given.push('removed');
    if (newAverage !== null) given.push('newAverage');
    return { values, n0, sum, added, removed, newAverage };
  },
  solve(b, reveal) {
    const { values, n0, sum, added, removed, newAverage } = b.data;
    const avg = sum / n0;
    const rows: BarRow[] = values.length
      ? values.map((v: number, k: number) => ({ label: '#' + (k + 1), segments: [{ value: v, text: r2(v) }] }))
      : [{ label: n0 + ' items, average ' + r2(sum / n0), segments: [{ value: sum, text: 'total ' + (reveal ? r2(sum) : '?') }] }];
    if (added !== null && values.length) rows.push({ label: 'added', segments: [{ value: added, text: r2(added), accent: true }] });
    if (removed !== null && values.length) rows.push({ label: 'removed', segments: [{ value: removed, text: '−' + r2(removed), accent: true }] });
    let count = n0;
    let total = sum;
    if (added !== null) { count++; total += added; }
    if (removed !== null) { count--; total -= removed; }
    const lines = [values.length || reveal
      ? 'Average = ' + r2(sum) + ' ÷ ' + n0 + ' = ' + show(b, 'average', reveal, r2(avg))
      : 'Total = ' + n0 + ' × ' + r2(avg) + ' = ?'];
    if (!values.length && reveal) lines[0] = 'Total = ' + n0 + ' × ' + r2(avg) + ' = ' + r2(sum);
    let answer: FigureAnswer | null = n(avg);
    if (b.ask === 'newAverage') {
      lines.push('New average = ' + (reveal || values.length ? r2(total) : '?') + ' ÷ ' + count + ' = ' + (reveal ? r2(total / count) : '?'));
      answer = n(total / count);
    } else if (b.ask === 'addedValue' && newAverage !== null) {
      const x = newAverage * (n0 + 1) - sum;
      lines.push('Added = ' + r2(newAverage) + ' × ' + (n0 + 1) + ' − ' + (reveal || values.length ? r2(sum) : '?') + ' = ' + (reveal ? r2(x) : '?'));
      answer = n(x);
    }
    return { answer, rows, lines, answerText: '' };
  },
};

const MODELS: Record<BarsModel, Model> = {
  ratio: RATIO, percentage: PERCENTAGE, profit: PROFIT, interest: INTEREST,
  work: WORK, alligation: ALLIGATION, replacement: REPLACEMENT, average: AVERAGE,
};

export function normalizeBars(raw: any): { figure: Bars | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const model = Object.prototype.hasOwnProperty.call(MODELS, r.model) ? (r.model as BarsModel) : null;
  if (!model) return { figure: null, errors: ['model must be one of ' + Object.keys(MODELS).join(', ')] };
  const given: string[] = [];
  const data = MODELS[model].normalize(r, errors, given);
  const ask = str(r.ask && typeof r.ask === 'object' ? r.ask.quantity : r.ask, 24) || MODELS[model].asks[0];
  if (!MODELS[model].asks.includes(ask) && !(model === 'ratio' && ask === 'share')) errors.push('unknown question for ' + model + ': ' + ask);
  const figure: Bars = { type: 'bars', model, money: Boolean(r.money), data: data || {}, ask, given };
  if (!errors.length && data && answerBars(figure) === null) errors.push('the ' + ask + ' cannot be worked out from what is given');
  return { figure: errors.length || !data ? null : figure, errors };
}

export function solveBars(b: Bars, reveal: boolean): Solved {
  return MODELS[b.model].solve(b, reveal);
}

export function answerBars(b: Bars): FigureAnswer | null {
  return solveBars(b, true).answer;
}

export const BARS_FAMILY: FigureFamily<Bars> = {
  type: 'bars',
  label: 'bar models for ratio, percentage, profit and discount, interest, time and work, alligation, replacement and averages.',
  fits: /aptitude|percentage|ratio|average|mixture|alligation|profit|loss|discount|interest|time & work|work|pipes|partnership|estimation|arithmetic|quantitative|stoichiometry|word problems|expected value|fraction/i,
  normalize: normalizeBars,
  answer: answerBars,
  docs: [
    'Pick a model and state only what the question gives; "money": true shows ₹.',
    'ratio: {"model":"ratio","parts":[{"label":"A","ratio":3},{"label":"B","ratio":5}],"total":800,"ask":{"quantity":"share","part":"A"}}',
    '  (instead of total: "known":{"label":"A","value":300} or "difference":{"a":"B","b":"A","value":200}; ask total)',
    'percentage: {"model":"percentage","base":500,"changes":[20,-10],"ask":"final"}  (ask final, base with final given, netChange)',
    'profit: {"model":"profit","costPrice":400,"profitPercent":25,"markedPrice":600,"ask":"discountPercent"}',
    '  fields costPrice, sellingPrice, markedPrice, profitPercent (negative = loss), discountPercent or discounts [20,10].',
    '  ask sellingPrice, costPrice, markedPrice, profitPercent, discountPercent.',
    'interest: {"model":"interest","principal":10000,"rate":10,"time":2,"compounding":"annual","ask":"difference"}',
    '  compounding simple, annual, half-yearly, quarterly. ask amount, interest, difference (CI - SI), simpleInterest, compoundInterest.',
    'work: {"model":"work","workers":[{"label":"A","days":12},{"label":"B","days":15},{"label":"C","days":20,"empties":true}],"ask":"together"}',
    'alligation: {"model":"alligation","cheaper":{"label":"₹20/kg","value":20},"dearer":{"label":"₹50/kg","value":50},"mean":30,"ask":"ratio"}',
    'replacement: {"model":"replacement","volume":40,"removed":4,"times":2,"ask":"remaining"}',
    'average: {"model":"average","values":[12,15,18],"added":23,"ask":"newAverage"}  (or "count":10,"average":20;',
    '  ask average, newAverage (with added or removed), addedValue (with newAverage).',
  ],
};

// --- what is asked, and the layout ------------------------------------------------------------

const ASK_NAMES: Record<string, string> = {
  total: 'total', final: 'final value', base: 'starting value', netChange: 'net change',
  sellingPrice: 'selling price', costPrice: 'cost price', markedPrice: 'marked price', profitPercent: 'profit %', discountPercent: 'discount %',
  amount: 'amount', interest: 'interest', difference: 'CI − SI', simpleInterest: 'simple interest', compoundInterest: 'compound interest',
  together: 'time together', ratio: 'mixing ratio', mean: 'mean', remaining: 'amount left', remainingPercent: 'share left',
  average: 'average', newAverage: 'new average', addedValue: 'number added',
};

/** "Find the selling price", then "Selling price = ₹500". */
export function barsAskText(b: Bars, reveal: boolean): string {
  const solved = solveBars(b, reveal);
  if (solved.answerText) return reveal ? solved.answerText : 'Find: ' + solved.answerText.replace(/ = \?$/, '');
  const name = ASK_NAMES[b.ask] || b.ask;
  if (!reveal || !solved.answer) return 'Find the ' + name;
  const a = solved.answer;
  const value = a.kind === 'text' ? a.value
    : a.unit === '%' ? (b.ask === 'netChange' && a.value > 0 ? '+' : '') + r2(a.value) + '%'
    : b.model === 'work' ? r2(a.value) + ' ' + (b.data.unit || 'days')
    : b.model === 'replacement' && b.data.unit ? r2(a.value) + ' ' + b.data.unit
    : money(b, a.value);
  return name.charAt(0).toUpperCase() + name.slice(1) + ' = ' + value;
}

export interface PlacedText { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; width: number }
export interface PlacedSegment extends Segment { x: number; width: number; label: PlacedText | null }
export interface BarsLayout {
  rows: { label: PlacedText; y: number; height: number; segments: PlacedSegment[] }[];
  lines: PlacedText[];
  labelFont: number;
  lineFont: number;
}

const textWidth = (text: string, size: number) => text.length * size * CHAR_WIDTH;

/**
 * Rows of bars on a shared scale, each with its name above it. A segment's
 * text sits inside it when it fits, otherwise just past the end of the bar -
 * and the scale leaves room for that text, so nothing runs off the frame.
 */
export function layoutBars(b: Bars, reveal: boolean, w: number, h: number, font: number): BarsLayout {
  const solved = solveBars(b, reveal);
  const labelFont = font * 0.72;
  const lineFont = font * 0.8;
  const lineStep = lineFont * 1.45;
  const margin = 12;
  const linesH = solved.lines.length * lineStep;
  const gap = font * 1.1;
  const rowsH = h - linesH - gap;
  const n = Math.max(1, solved.rows.length);
  const tall = n <= 2 ? 2.2 : 1.5;
  const step = Math.min(font * (tall + 1.9), rowsH / n);
  // With many rows there is no room for a name above each bar: names go in a column to the left.
  const compact = step - labelFont * 1.6 < font * 0.7;
  const barH = compact ? Math.min(step * 0.7, font * 1.2) : Math.min(font * tall, step - labelFont * 1.6);
  // Bars and working sit together as one block in the middle, not pinned to opposite ends.
  const blockH = step * n + gap + linesH;
  const top = Math.max(0, (h - blockH) / 2);
  const linesTop = top + step * n + gap;
  const nameW = compact ? Math.max(...solved.rows.map((r) => textWidth(r.label, labelFont))) + 18 : 0;
  const left = margin + nameW;
  const right = w - margin;
  const scaleMax = Math.max(1e-9, ...solved.rows.map((r) => r.segments.reduce((t, sg) => t + Math.max(0, sg.value), 0)));

  // Text that will not fit inside its segment goes after the bar; find the scale that leaves it room.
  const fitScale = (scale: number) => solved.rows.every((row) => {
    let x = left;
    const outside: string[] = [];
    for (const sg of row.segments) {
      const width = Math.max(0, sg.value) * scale;
      if (sg.text && textWidth(sg.text, labelFont) > width - 16) outside.push(sg.text);
      x += width;
    }
    return !outside.length || x + 14 + textWidth(outside.join('  '), labelFont) <= right;
  });
  let scale = (right - left) / scaleMax;
  for (let k = 0; k < 40 && !fitScale(scale); k++) scale *= 0.93;

  const rows = solved.rows.map((row, i) => {
    const y = compact ? top + i * step + (step - barH) / 2 : top + i * step + labelFont * 1.5;
    let x = left;
    const outside: PlacedSegment[] = [];
    const segments: PlacedSegment[] = row.segments.map((sg) => {
      const width = Math.max(0, sg.value) * scale;
      const tw = textWidth(sg.text, labelFont);
      const placed: PlacedSegment = { ...sg, x, width, label: null };
      if (sg.text && tw <= width - 16) placed.label = { x: x + width / 2, y: y + barH / 2 + labelFont * 0.36, text: sg.text, anchor: 'middle', width: tw };
      else if (sg.text) outside.push(placed);
      x += width;
      return placed;
    });
    let after = x + 14;
    for (const sg of outside) {
      const tw = textWidth(sg.text, labelFont);
      sg.label = { x: after, y: y + barH / 2 + labelFont * 0.36, text: sg.text, anchor: 'start', width: tw };
      after += tw + textWidth('  ', labelFont);
    }
    const label: PlacedText = compact
      ? { x: margin, y: y + barH / 2 + labelFont * 0.36, text: row.label, anchor: 'start', width: textWidth(row.label, labelFont) }
      : { x: left, y: y - labelFont * 0.45, text: row.label, anchor: 'start', width: textWidth(row.label, labelFont) };
    return { label, y, height: barH, segments };
  });

  const lines = solved.lines.map((text, k) => ({
    x: w / 2, y: linesTop + k * lineStep + lineFont, text, anchor: 'middle' as const, width: textWidth(text, lineFont),
  }));
  return { rows, lines, labelFont, lineFont };
}
