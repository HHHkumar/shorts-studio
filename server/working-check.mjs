// ---------------------------------------------------------------------------
// Does the worked solution add up?
//
// The formula card's working is written by Gemini and shown on screen a line
// at a time: the formula, the question's numbers put in, each step, and the
// answer with its unit -
//
//     |Z| = \sqrt{R^2 + (X_L - X_C)^2}
//       = \sqrt{4^2 + (12 - 9)^2}
//       = \sqrt{16 + 9}
//       = 5\,\Omega
//
// Nothing checked that line two equals line three. A slip there is a wrong
// sum on the board, in a video about getting sums right. So every line that is
// numbers only is evaluated with mathjs, each must equal the one before it to
// within the rounding a teacher does (the first, with letters in it, has
// nothing to evaluate), and the last must be the correct option. Units are
// read the way the line writes them - 2.2 kΩ is 2200 Ω - so a line in other
// units is compared in SI.
//
// A working that does not add up is not shown. The formula cards stay.
// ---------------------------------------------------------------------------

import { all, create } from 'mathjs';

const math = create(all);
// The units an electrical paper writes that mathjs does not know.
for (const [name, definition] of [['rpm', '0.0166666667 Hz'], ['VAR', '1 VA'], ['VAr', '1 VA'], ['pu', '1']]) {
  try { math.createUnit(name, { definition, override: true }); } catch { /* already there */ }
}

/** How close two lines must be: a teacher rounds 229.8 to 230, and 1/√2 to 0.707. */
export const TOLERANCE = 0.02;

/** Units as a line or an option writes them, to mathjs's names. Longest first. */
const UNIT_WORDS = [
  ['kilohms', 'kohm'], ['kilohm', 'kohm'], ['megohms', 'Mohm'], ['megohm', 'Mohm'], ['ohms', 'ohm'], ['ohm', 'ohm'],
  ['kΩ', 'kohm'], ['MΩ', 'Mohm'], ['mΩ', 'mohm'], ['Ω', 'ohm'],
  ['kilovolts', 'kV'], ['volts', 'V'], ['volt', 'V'], ['amperes', 'A'], ['ampere', 'A'], ['amps', 'A'], ['amp', 'A'],
  ['milliamperes', 'mA'], ['milliamps', 'mA'], ['kilowatts', 'kW'], ['megawatts', 'MW'], ['watts', 'W'], ['watt', 'W'],
  ['hertz', 'Hz'], ['henries', 'H'], ['henry', 'H'], ['farads', 'F'], ['farad', 'F'], ['microfarads', 'uF'],
  ['μF', 'uF'], ['µF', 'uF'], ['μH', 'uH'], ['µH', 'uH'], ['μA', 'uA'], ['µA', 'uA'], ['μs', 'us'], ['µs', 'us'],
  ['kVAR', 'kVAR'], ['kVAr', 'kVAR'], ['kVA', 'kVA'], ['MVA', 'MVA'], ['VAR', 'VAR'], ['VAr', 'VAR'], ['VA', 'VA'],
  ['kWh', 'kWh'], ['MWh', 'MWh'], ['Wh', 'Wh'], ['units', 'kWh'],
  ['kV', 'kV'], ['mV', 'mV'], ['V', 'V'], ['kA', 'kA'], ['mA', 'mA'], ['A', 'A'], ['MW', 'MW'], ['kW', 'kW'], ['mW', 'mW'],
  ['W', 'W'], ['GHz', 'GHz'], ['MHz', 'MHz'], ['kHz', 'kHz'], ['Hz', 'Hz'], ['mH', 'mH'], ['H', 'H'], ['nF', 'nF'],
  ['pF', 'pF'], ['F', 'F'], ['ms', 'ms'], ['s', 's'], ['rpm', 'rpm'], ['Nm', 'N m'], ['N', 'N'], ['kJ', 'kJ'], ['J', 'J'],
  ['Wb', 'Wb'], ['T', 'T'], ['rad/s', 'rad/s'], ['rad', 'rad'], ['pu', 'pu'], ['p.u.', 'pu'], ['%', '%'], ['percent', '%'],
];
const UNIT_KEYS = UNIT_WORDS.map(([w]) => w);

/** The functions a working line may use; anything else with letters is algebra, not arithmetic. */
const FUNCTIONS = new Set(['sqrt', 'nthRoot', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'log10', 'exp', 'abs', 'pi']);

/** The brace group starting at s[i] === '{': its inside and the index after it. */
function group(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { inside: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

/** The working's LaTeX, as an expression mathjs reads. Null when it cannot be read. */
export function latexToMath(tex) {
  let s = String(tex || '');
  // Fractions and roots first, from the inside out, with their braces.
  for (let guard = 0; guard < 40; guard++) {
    const at = s.search(/\\(?:d|t)?frac\s*\{|\\sqrt\s*(?:\[[^\]]*\])?\s*\{/);
    if (at < 0) break;
    const frac = /^\\(?:d|t)?frac/.test(s.slice(at));
    if (frac) {
      const a = group(s, s.indexOf('{', at));
      const b = a && s[a.end] === '{' ? group(s, a.end) : a && /^\s*\{/.test(s.slice(a.end)) ? group(s, s.indexOf('{', a.end)) : null;
      if (!a || !b) return null;
      s = s.slice(0, at) + '((' + a.inside + ')/(' + b.inside + '))' + s.slice(b.end);
    } else {
      const m = s.slice(at).match(/^\\sqrt\s*(?:\[([^\]]*)\])?\s*\{/);
      const g = group(s, at + m[0].length - 1);
      if (!g) return null;
      s = s.slice(0, at) + (m[1] ? 'nthRoot(' + g.inside + ',' + m[1] + ')' : 'sqrt(' + g.inside + ')') + s.slice(g.end);
    }
  }
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\^\s*\{?\s*\\circ\s*\}?|°/g, ' deg')
    .replace(/\\(?:text|mathrm|mathit|operatorname)\s*\{([^{}]*)\}/g, ' $1 ')
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pi/g, 'pi')
    .replace(/\\%/g, '%')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\(?:mu|micro)\s*/g, 'μ')
    .replace(/\\(?:sin|cos|tan|log|ln|exp)/g, (m) => (m === '\\ln' ? 'log' : m.slice(1)))
    .replace(/\\[,;:!]|\\quad|\\qquad|~/g, ' ')
    .replace(/\^\s*\{([^{}]*)\}/g, '^($1)')
    .replace(/[{}]/g, ' ')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
  return /\\/.test(s) ? null : s;
}

/** The trailing unit of an expression, if it ends in one: "5 Ω" -> { expr: "5", unit: "ohm" }. */
function splitUnit(expr) {
  const s = String(expr || '').trim();
  for (const key of UNIT_KEYS) {
    if (!s.endsWith(key)) continue;
    const before = s.slice(0, s.length - key.length);
    // A unit follows a number or a closing bracket, never a letter: "5 A", not "IA".
    if (!/[\d.)\s]$/.test(before) || !before.trim()) continue;
    const unit = UNIT_WORDS.find(([w]) => w === key)[1];
    return { expr: before.trim(), unit };
  }
  return { expr: s, unit: '' };
}

/** A value in SI, or the bare number when there is no unit. Percent stays a number. */
function inSI(value, unit) {
  if (!unit || unit === '%' || unit === 'pu') return value;
  try {
    return math.unit(value, unit).toSI().toNumber();
  } catch {
    return value;
  }
}

/**
 * Each side of each line, evaluated where it is arithmetic: { line, text,
 * value, si, unit } for the numbers, and nothing for the algebra.
 */
export function evaluateWorking(lines) {
  const out = [];
  (Array.isArray(lines) ? lines : []).forEach((raw, line) => {
    // \approx is an equals sign that has rounded: each side is still a value.
    const parts = String(raw || '').replace(/\\approx/g, '=').split('=').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const converted = latexToMath(part);
      if (!converted) continue;
      const { expr, unit } = splitUnit(converted);
      if (!/\d/.test(expr)) continue;
      // Letters left over, other than functions and pi, are a formula, not a sum.
      const words = expr.match(/[A-Za-zα-ωΑ-ΩμΩ_]+/g) || [];
      if (words.some((w) => !FUNCTIONS.has(w) && w !== 'deg')) continue;
      let value;
      try {
        value = math.evaluate(expr);
      } catch {
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      out.push({ line, text: part, value, si: inSI(value, unit), unit });
    }
  });
  return out;
}

/** Equal to within the rounding a teacher does - read raw, or in SI when only one side has a unit. */
function agree(a, b) {
  const close = (x, y) => Math.abs(x - y) <= TOLERANCE * Math.max(Math.abs(x), Math.abs(y), 1e-12);
  return close(a.value, b.value) || close(a.si, b.si) || (a.unit !== b.unit && (close(a.si, b.value) || close(a.value, b.si)));
}

/** The number an option states, with its unit: "2.2 kΩ" -> 2200 (SI). Null when it states none. */
export function optionValue(text) {
  const s = String(text || '').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').trim();
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*([A-Za-zΩμµ%.]*)/);
  if (!m) return null;
  // A second number ("5 A and 3 A") is a pair, not one answer.
  if ((s.match(/-?\d+(?:\.\d+)?/g) || []).length > 1) return null;
  const value = Number(m[1]);
  const word = m[2].replace(/\.$/, '');
  const pair = UNIT_WORDS.find(([w]) => w === word) || UNIT_WORDS.find(([w]) => w.toLowerCase() === word.toLowerCase() && w.length > 1);
  const unit = pair ? pair[1] : '';
  return { value, si: inSI(value, unit), unit };
}

/**
 * The problems with a worked solution, or none. `answer` is the correct
 * option's text, which the last line must reach.
 */
export function checkWorking(lines, answer = '') {
  const values = evaluateWorking(lines);
  const problems = [];
  for (let k = 1; k < values.length; k++) {
    const a = values[k - 1];
    const b = values[k];
    if (!agree(a, b)) {
      problems.push('Line ' + (b.line + 1) + ' comes to ' + round(b.value) + ', but line ' + (a.line + 1) + ' before it comes to ' + round(a.value) + '.');
      break;
    }
  }
  const last = values[values.length - 1];
  const target = optionValue(answer);
  if (!problems.length && last && target && !agree(last, target)) {
    problems.push('The working ends at ' + round(last.value) + (last.unit && last.unit !== '%' ? ' ' + last.unit : last.unit) + ', but the answer is ' + String(answer).trim() + '.');
  }
  return { checked: values.length, problems };
}

const round = (v) => String(Math.round(v * 1000) / 1000);
