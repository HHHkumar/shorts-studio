// ---------------------------------------------------------------------------
// Where did that number come from?
//
// A chart is believed more readily than a sentence. So a bar chart saying
// "110 kV against 145 kV", a circuit with resistors of 10, 20 and 30 ohms, or
// a torque arm drawn at 45 degrees is a statement of fact - and when the
// question gave none of those numbers, it is a statement nobody made. The
// model fills a picture with plausible values the way it fills a sentence
// with plausible words.
//
// The rule: a number drawn on screen must be one the video itself gives - in
// the question, the options, the explanation, a formula it shows, or a line it
// speaks - or follow from those in ONE step (5 + 3, 99 / 999, half of it,
// volts to millivolts). Anything else has no source, and the picture carrying
// it is dropped.
//
// One step, deliberately. Allow two and nearly every round number can be
// reached from the dozen or so a script contains, and the check checks
// nothing. A second net - the picture review - reads what this lets through.
// ---------------------------------------------------------------------------

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1e3, lakh: 1e5, million: 1e6, crore: 1e7, billion: 1e9 };
/** Words that are a number without being a numeral. */
const LOOSE = {
  half: 0.5, halved: 0.5, halves: 0.5, halving: 0.5, quarter: 0.25,
  double: 2, doubles: 2, doubled: 2, doubling: 2, twice: 2,
  triple: 3, triples: 3, tripled: 3, thrice: 3, quadruple: 4, quadruples: 4, quadrupled: 4,
  third: 1 / 3, thirds: 1 / 3, tenth: 0.1, unity: 1,
};

/**
 * Every number a piece of text states, as digits or as words.
 * "two hundred and thirty", "zero point five", "1,000", "0.099" and "halved"
 * all count. Signs are dropped: the question here is whether a magnitude was
 * given, not which way it points.
 */
export function numbersIn(text) {
  const out = [];
  const src = String(text || '');

  for (const m of src.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }

  const words = src.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  let total = 0; // the number built so far, above the current hundreds group
  let group = 0; // the current group: "two hundred thirty"
  let open = false;
  let last = ''; // the kind of word just read: unit, tens, hundred or scale
  const flush = () => {
    if (open) out.push(total + group);
    total = 0; group = 0; open = false; last = '';
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in UNITS) {
      // "five three" is two numbers; "twenty five" and "two hundred five" are one.
      if (last === 'unit' || (last === 'tens' && UNITS[w] >= 10)) flush();
      group += UNITS[w]; open = true; last = 'unit';
      continue;
    }
    if (w in TENS) {
      if (last === 'unit' || last === 'tens') flush();
      group += TENS[w]; open = true; last = 'tens';
      continue;
    }
    if (w === 'hundred') { group = (group || 1) * 100; open = true; last = 'hundred'; continue; }
    if (w in SCALES) { total += (group || 1) * SCALES[w]; group = 0; open = true; last = 'scale'; continue; }
    // "two hundred and thirty": the "and" joins only straight after a hundred
    // or a thousand. "Five and three amperes" is two numbers.
    if (w === 'and' && (last === 'hundred' || last === 'scale') && (words[i + 1] in UNITS || words[i + 1] in TENS)) continue;
    if (w === 'point' && (words[i + 1] in UNITS)) {
      // "zero point five", "one point four one four" - and "point five" alone.
      let digits = '';
      let j = i + 1;
      while (j < words.length && words[j] in UNITS && UNITS[words[j]] < 10) { digits += UNITS[words[j]]; j++; }
      if (digits) {
        out.push(Number((open ? total + group : 0) + '.' + digits));
        total = 0; group = 0; open = false; last = '';
        i = j - 1;
        continue;
      }
    }
    flush();
    if (w in LOOSE) out.push(LOOSE[w]);
  }
  flush();
  return out;
}

/** Everything a video says that a number could have come from. */
export function sourceNumbers(content) {
  const c = content || {};
  const parts = [c.question, ...(c.options || []), c.answerLine, ...(c.explanation || []), c.funFact];
  for (const s of c.script || []) {
    if (!s) continue;
    parts.push(s.narration);
    const v = s.visual;
    if (v && v.kind === 'formula') parts.push(v.formula);
  }
  const sheet = c.formulas;
  if (sheet && Array.isArray(sheet.working)) parts.push(...sheet.working);
  const found = new Set();
  for (const p of parts) for (const n of numbersIn(p)) found.add(Math.abs(n));
  return [...found];
}

/** Within about one percent: 0.099 is 99 / 999, and 1.41 is root two. */
const close = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.011, 1e-9);

/**
 * True when `target` is given outright, or follows from the source in one step.
 * `wholes` are totals a given may be taken away from - a right angle, a half
 * turn - and nothing more: they are not givens themselves.
 */
export function isSourced(target, source, wholes = []) {
  const t = Math.abs(Number(target));
  if (!Number.isFinite(t)) return false;
  // Nothing, unity and the whole are never inventions.
  if (t === 0 || close(1, t) || close(100, t)) return true;
  const base = [...new Set(source)];
  for (const w of wholes) {
    if (base.some((a) => close(Math.abs(w - a), t))) return true;
  }
  for (const a of base) {
    if (close(a, t)) return true;
    // One step on one number: its square, its root, its reciprocal, a unit
    // prefix, a percentage, and what is left of the whole.
    if (close(a * a, t) || close(Math.sqrt(a), t) || (a && close(1 / a, t))) return true;
    if (close(a * 1000, t) || close(a / 1000, t) || close(a * 100, t) || close(a / 100, t)) return true;
    if (close(Math.abs(1 - a), t) || close(Math.abs(100 - a), t)) return true;
  }
  for (let i = 0; i < base.length; i++) {
    // Two different givens: a number added to itself is a doubling nobody mentioned.
    for (let j = i + 1; j < base.length; j++) {
      const a = base[i];
      const b = base[j];
      if (close(a + b, t) || close(Math.abs(a - b), t) || close(a * b, t)) return true;
      if ((b && close(a / b, t)) || (a && close(b / a, t))) return true;
    }
  }
  return false;
}

/** The numbers in `values` that the source does not account for. */
export function unsourced(values, source, wholes = []) {
  return (values || []).filter((v) => Number.isFinite(Number(v)) && !isSourced(v, source, wholes));
}

/** Angles that state a relationship rather than a measurement: in phase, a pure reactance, opposite. */
const PLAIN_ANGLES = [0, 90, 120, 180, 360];

/**
 * The numbers a picture puts on screen that the video never gave.
 *
 * Looks at what is drawn as a value: the bars of a chart, the entries of a
 * sketch that plots them, the components of a circuit, and an angle. Knobs
 * that only place or pace a drawing (speed, how many dots) are not values.
 */
export function unsourcedInVisual(visual, source) {
  const v = visual || {};
  if (v.kind === 'bars') {
    return unsourced((v.items || []).map((it) => it.value), source);
  }
  if (v.kind !== 'sketch') return [];
  const p = v.params || {};
  const bad = [];
  // Only entries that carry a number: a flowchart's steps have none.
  bad.push(...unsourced((v.items || []).map((it) => it.value).filter((n) => Number.isFinite(n)), source));
  if (v.sketch === 'circuit' && p.network) bad.push(...unsourced(numbersIn(p.network), source));
  if (Number.isFinite(p.angle) && !PLAIN_ANGLES.includes(Math.abs(p.angle))) {
    // An angle may also be what is left of a right angle or a half turn.
    bad.push(...unsourced([p.angle], source, [90, 180, 360]));
  }
  return [...new Set(bad)];
}
