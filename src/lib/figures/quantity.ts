// ---------------------------------------------------------------------------
// Reading and writing physical quantities: "500 mA", "Five amperes", "2.2 kΩ".
//
// Shared by the server, which reads the answer options to check a figure
// against them, and the renderer, which labels every part of the figure. So it
// must stay free of React, Remotion and Node - and every import in this folder
// carries its .ts extension, because the server loads these files straight
// through Node's own type stripping, which never guesses an extension.
// ---------------------------------------------------------------------------

/** The base units a figure deals in. '' is a bare number. */
export type UnitClass =
  | 'A' | 'V' | 'Ω' | 'W' | 'H' | 'F' | 'Hz' | 'VA' | 'VAR' | 's' | '°' | '%'
  | 'Wb' | 'T' | 'At' | 'At/m' | 'At/Wb' | 'rpm' | 'N·m' | '';

export interface Quantity {
  /** In base units: amperes, not milliamperes. */
  value: number;
  unit: UnitClass;
}

const PREFIX: Record<string, number> = {
  p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9,
};

const PREFIX_WORDS: [RegExp, number][] = [
  [/^pico/, 1e-12], [/^nano/, 1e-9], [/^micro/, 1e-6], [/^milli/, 1e-3], [/^kilo/, 1e3], [/^mega/, 1e6], [/^giga/, 1e9],
];

/** Unit words and symbols, longest first so "VAR" is not read as "V". */
const UNIT_WORDS: [RegExp, UnitClass][] = [
  [/^(var|vars|volt[- ]?amperes?[- ]?reactive)$/i, 'VAR'],
  [/^(va|volt[- ]?amperes?)$/i, 'VA'],
  [/^(a|amps?|amperes?)$/i, 'A'],
  [/^(v|volts?)$/i, 'V'],
  [/^(ω|Ω|ohms?|r)$/i, 'Ω'],
  [/^(w|watts?)$/i, 'W'],
  [/^(h|henr(y|ys|ies))$/i, 'H'],
  [/^(f|farads?)$/i, 'F'],
  [/^(hz|hertz)$/i, 'Hz'],
  [/^(s|secs?|seconds?)$/i, 's'],
  [/^(°|deg|degs|degrees?)$/i, '°'],
  [/^(%|percent|per ?cent)$/i, '%'],
  [/^(at\/wb|ampere[- ]?turns? ?(per|\/) ?weber)$/i, 'At/Wb'],
  [/^(at\/m|ampere[- ]?turns? ?(per|\/) ?met(re|er))$/i, 'At/m'],
  [/^(at|ampere[- ]?turns?)$/i, 'At'],
  [/^(wb|webers?)$/i, 'Wb'],
  [/^(t|teslas?)$/i, 'T'],
  [/^(rpm|r\.p\.m\.?|revs? ?per ?min(ute)?)$/i, 'rpm'],
  // Case matters for the symbol: "Nm" is torque, "nm" is a nanometre.
  [/^N[·.\- ]?m$/, 'N·m'],
  [/^newton[- ]?met(re|er)s?$/i, 'N·m'],
];

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** "twenty five", "one hundred", "two point five", "half" - or null. */
export function wordsToNumber(text: string): number | null {
  const words = text.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter((w) => w && w !== 'and');
  if (!words.length) return null;
  if (words.length === 1 && words[0] === 'half') return 0.5;
  let total = 0;
  let current = 0;
  let seen = false;
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    const small = SMALL.indexOf(w);
    const tens = TENS.indexOf(w);
    if (small >= 0) { current += small; seen = true; }
    else if (tens >= 2) { current += tens * 10; seen = true; }
    else if (w === 'hundred' && seen) { current = (current || 1) * 100; }
    else if (w === 'thousand' && seen) { total += (current || 1) * 1000; current = 0; }
    else if (w === 'point' && seen) { break; }
    else return null;
  }
  let value = total + current;
  if (i < words.length && words[i] === 'point') {
    const digits = words.slice(i + 1).map((w) => SMALL.indexOf(w));
    if (!digits.length || digits.some((d) => d < 0 || d > 9)) return null;
    value += Number('0.' + digits.join(''));
  }
  return seen ? value : null;
}

/** A unit written after a number - "mA", "kilo-ohms", "µF" - as a multiplier and a class. */
export function parseUnit(raw: string): { factor: number; unit: UnitClass } | null {
  const text = raw.trim().replace(/\.$/, '');
  if (!text) return { factor: 1, unit: '' };
  for (const [re, unit] of UNIT_WORDS) if (re.test(text)) return { factor: 1, unit };
  // A written prefix: "milliamperes", "kilo-ohms", "micro farads".
  const lower = text.toLowerCase();
  for (const [re, factor] of PREFIX_WORDS) {
    if (re.test(lower)) {
      const rest = lower.replace(re, '').replace(/^[- ]/, '');
      for (const [ure, unit] of UNIT_WORDS) if (ure.test(rest)) return { factor, unit };
      return null;
    }
  }
  // A symbol prefix: "mA", "kΩ", "µF". Case matters here - m is milli, M is mega.
  const head = text[0];
  if (PREFIX[head] !== undefined && text.length > 1) {
    const rest = text.slice(1).trim();
    for (const [re, unit] of UNIT_WORDS) {
      // A lone "r" after a prefix is not a unit ("kr" means nothing).
      if (re.test(rest) && rest.toLowerCase() !== 'r') return { factor: PREFIX[head], unit };
    }
  }
  return null;
}

/** Words around a quantity that do not change it: "0.8 lagging", "approximately 20 ms". */
const QUALIFIERS = /\b(lagging|leading|lag|lead|approximately|approx|about|nearly|only|exactly|in phase|rms|peak|of (the )?(full|rated)[ -]load)\b\.?/gi;

/**
 * The quantity an answer option states, or null when it states none.
 *
 * "5 A", "0.5A", "500 mA", "2.2 kΩ", "Five amperes", "One point five volts".
 * An option like "None of these" or "It doubles" returns null: it is not wrong,
 * it simply cannot be checked against a number.
 */
export function parseQuantity(text: string): Quantity | null {
  let s = String(text || '').trim().replace(/,(?=\d{3}\b)/g, '').replace(/−/g, '-');
  // "90°" has no space before the unit; "unity" is how power factor 1 is said.
  s = s.replace(/^unity\b/i, '1').replace(QUALIFIERS, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  const plain = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + m.split('').map((c) => SUP[c]).join(''));
  const numeric = /^(-?\d+(?:\.\d+)?|-?\.\d+)(?:\s*[x×*]\s*10\s*\^\s*(-?\d+)|[eE](-?\d+))?\s*(.*)$/.exec(plain);
  if (numeric) {
    const unit = parseUnit(numeric[4]);
    if (!unit) return null;
    const exponent = Number(numeric[2] ?? numeric[3] ?? 0);
    return { value: Number(numeric[1]) * Math.pow(10, exponent) * unit.factor, unit: unit.unit };
  }

  // Words: try the longest run of leading words that reads as a number.
  const words = s.split(/\s+/);
  for (let n = words.length; n >= 1; n--) {
    const value = wordsToNumber(words.slice(0, n).join(' '));
    if (value === null) continue;
    const unit = parseUnit(words.slice(n).join(' '));
    if (!unit) return null;
    return { value: value * unit.factor, unit: unit.unit };
  }
  return null;
}

const SYMBOL_PREFIXES: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];

/** Three significant figures at most, with trailing zeros dropped: 1.50 -> "1.5". */
export function roundForDisplay(n: number): string {
  if (!Number.isFinite(n)) return '?';
  if (Math.abs(n) < 1e-12) return '0';
  const digits = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(n))));
  const fixed = n.toFixed(Math.min(digits, 6));
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** 0.5 A -> "500 mA", 2200 Ω -> "2.2 kΩ", 5 -> "5 A". */
export function formatQuantity(value: number, unit: UnitClass): string {
  if (!Number.isFinite(value)) return '?';
  if (!unit) return roundForDisplay(value);
  // Degrees never take a prefix or a space, and hertz reads better without milli-.
  if (unit === '°') return roundForDisplay(value) + '°';
  if (unit === '%') return roundForDisplay(value) + '%';
  // A fraction of an ohm is written as a decimal in every textbook: 0.5 Ω, not 500 mΩ.
  if (unit === 'Ω' && Math.abs(value) >= 0.01 && Math.abs(value) < 1) return roundForDisplay(value) + ' Ω';
  // Speeds are read to the rev; torque to one decimal.
  if (unit === 'rpm') return Math.round(value) + ' rpm';
  if (unit === 'N·m') return roundForDisplay(value) + ' N·m';
  // Ampere-turns and reluctance run to huge numbers; a prefix on "At/Wb" reads badly.
  if (unit === 'At' || unit === 'At/m' || unit === 'At/Wb') {
    const abs = Math.abs(value);
    if (abs >= 1e5) {
      const exp = Math.floor(Math.log10(abs));
      return roundForDisplay(value / Math.pow(10, exp)) + ' × 10^' + exp + ' ' + unit;
    }
    return roundForDisplay(value) + ' ' + unit;
  }
  const abs = Math.abs(value);
  if (abs < 1e-12) return '0 ' + unit;
  const allowSmall = unit !== 'Hz';
  for (const [factor, symbol] of SYMBOL_PREFIXES) {
    if (!allowSmall && factor < 1) break;
    // 999.6 rounds to "1000"; move up a prefix before that happens.
    if (abs >= factor * 0.9995) return roundForDisplay(value / factor) + ' ' + symbol + unit;
  }
  const [factor, symbol] = allowSmall ? SYMBOL_PREFIXES[SYMBOL_PREFIXES.length - 1] : [1, ''];
  return roundForDisplay(value / factor) + ' ' + symbol + unit;
}

/** Two values agree when they are within 2%, or both effectively zero. */
export function sameValue(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale < 1e-9) return true;
  return Math.abs(a - b) / scale <= 0.02;
}
