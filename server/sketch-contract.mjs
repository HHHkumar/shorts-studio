// ---------------------------------------------------------------------------
// What a sketch must be told before it may be drawn.
//
// A sketch is a small program with knobs - an angle, a ratio, two labels, a
// list of items. Each knob had a default, and the model was told to "leave out
// any parameter you are unsure of". So an unsure model left the angle out and
// the video stated one anyway: a receiving-end voltage lagging by sixty
// degrees, a power factor of 0.81, a meter reading 12.4 volts, three branch
// currents of 3, 2 and 5 amps. Nobody wrote those numbers. The picture did.
//
// The rule here is the opposite. A knob the sketch lists is a fact the picture
// states, so it must be stated to the sketch - or the sketch is not drawn.
// "No picture" is checked by nobody and misleads nobody.
//
// The contract is READ FROM the sketch's own "uses" line rather than written
// out a second time, so a new sketch is covered the day it is added. Only the
// knobs that are harmless to leave alone are listed by hand, below.
// ---------------------------------------------------------------------------

import { SKETCH_CATALOGUE } from './sketch-catalogue.mjs';
import { shortlist } from './sketch-shelves.mjs';

/** Every knob a sketch can read. speed and frequency only set how fast or how tightly it moves. */
const KNOBS = ['mode', 'network', 'angle', 'amplitude', 'count', 'ratio', 'labelA', 'labelB'];

/**
 * Knobs a sketch lists that state nothing when left alone: how many dots fill
 * a cloud, how wide a swing looks, a label the sketch draws nothing in place
 * of. Everything a sketch lists and this does not is required.
 */
const OPTIONAL = {
  // "How many" that is only how full the picture looks.
  particles: ['count'], dna: ['count'], 'solar-system': ['count'], 'moon-phases': ['count'],
  'sorting-steps': ['count'], 'binary-search': ['count'], 'packet-route': ['count'],
  'area-under': ['count'], 'business-cycle': ['count'], 'sleep-cycle': ['count'], truss: ['count'],
  recursion: ['count'], conformity: ['count'], banking: ['count'], 'free-fall': ['count', 'labelA'],
  'network-topology': ['count'], 'nuclear-decay': ['count'], 'energy-levels': ['count'],
  'binary-number': ['count'], 'emi-schedule': ['count'],
  // The size of a swing or a wave on screen.
  'sine-wave': ['amplitude', 'count'], pendulum: ['amplitude'], spring: ['amplitude'], diffraction: ['amplitude'],
  // Where along a curve a marker sits, or how hard a thing is squeezed: a look, not a value.
  orbit: ['count', 'ratio', 'labelA', 'labelB'], 'gas-laws': ['ratio'], bernoulli: ['ratio'],
  titration: ['ratio'], pythagoras: ['ratio'], 'slope-tangent': ['ratio'], 'normal-curve': ['ratio'],
  sampling: ['ratio'], 'supply-demand': ['ratio'], 'compound-growth': ['ratio'], superconductor: ['ratio'],
  'newton-laws': ['ratio'], 'failure-point': ['ratio'],
  // Labels the sketch draws nothing in place of, or only "A" and "B".
  transformer: ['labelA', 'labelB'], 'led-circuit': ['labelA', 'labelB'], venn: ['labelA'],
  'number-line': ['labelA', 'labelB'], seating: ['labelA'], tree: ['labelA'],
  'logic-gate': ['labelA', 'labelB'], triangle: ['labelA', 'labelB'], 'set-operations': ['labelA', 'labelB'],
  'vector-add': ['labelA', 'labelB'], electrolysis: ['labelA', 'labelB'], redox: ['labelA', 'labelB'],
  'trade-flow': ['labelA', 'labelB'], 'heat-transfer': ['labelA', 'labelB'],
  // One mode among several is the sketch itself; the other is the variant.
  phasor: ['mode'], clock: ['mode'], 'grid-logic': ['mode'],
  // Its items are extra; the two labels are the picture.
  'before-after': ['items'],
  // The network and whether it is AC or DC are the picture. The supply may be
  // left out - the network then stands between two terminals - and the fact
  // to check it against is there to be used, not demanded.
  circuit: ['labelA', 'labelB'],
  // How many pulses a counter shows is its own, and the checked fact is there to be used.
  'timing-diagram': ['count', 'labelB'],
  // In phase mode the waveform needs more - see needsFor().
  waveform: ['angle', 'ratio', 'labelA', 'labelB'],
};

/** Sketches whose single listed mode still flips what the picture claims. */
const MODE_REQUIRED = new Set(['relay']);

const strip = (text) => {
  // Parentheses hold explanation ("angle (10-70 degrees of incidence)"), and
  // an explanation may mention another knob by name. Take them out, innermost
  // first, before looking for which knobs are listed.
  let out = String(text || '').replace(/"[^"]*"/g, ' ');
  for (let i = 0; i < 6 && /\([^()]*\)/.test(out); i++) out = out.replace(/\([^()]*\)/g, ' ');
  return out;
};

/** The text inside the parentheses that follow a knob's name. */
function clause(uses, knob) {
  const at = uses.search(new RegExp('\\b' + knob + '\\b\\s*\\('));
  if (at < 0) return '';
  const open = uses.indexOf('(', at);
  let depth = 0;
  for (let i = open; i < uses.length; i++) {
    if (uses[i] === '(') depth++;
    else if (uses[i] === ')' && --depth === 0) return uses.slice(open + 1, i);
  }
  return uses.slice(open + 1);
}

function parse(entry) {
  const uses = String(entry.uses || '');
  const bare = strip(uses);
  const optional = new Set(OPTIONAL[entry.name] || []);

  const listed = KNOBS.filter((k) => new RegExp('\\b' + k + '\\b').test(bare));
  const modes = [...clause(uses, 'mode').matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  // A single quoted mode is a switch ("closed" to energise it), not a choice.
  const choice = modes.length >= 2;
  const needs = listed.filter((k) => {
    if (optional.has(k)) return false;
    if (k === 'mode') return choice || MODE_REQUIRED.has(entry.name);
    return true;
  });

  let items = null;
  if (/\bitems\b/.test(bare)) {
    const said = clause(uses, 'items');
    const range = said.match(/^\s*(\d+)\s*-\s*(\d+)/);
    const upTo = said.match(/^\s*up to (\d+)/i);
    const exact = said.match(/^\s*(\d+)\b/);
    const min = optional.has('items') ? 0 : range ? Number(range[1]) : upTo ? 1 : exact ? Number(exact[1]) : 1;
    // No number stated ("cell values in order") means the sketch takes what it is given.
    const max = range ? Number(range[2]) : upTo ? Number(upTo[1]) : exact ? Number(exact[1]) : 16;
    items = {
      min,
      max: Math.max(max, min, 1),
      // "each with a label and a value", "value is y", "2 with values".
      values: /\bvalues?\b/i.test(said),
    };
  }
  return { name: entry.name, needs, modes: choice ? modes : null, items };
}

const CONTRACTS = new Map(SKETCH_CATALOGUE.map((e) => [e.name, parse(e)]));

/** What a sketch needs: knobs, the modes it knows, and how many items. Null for an unknown name. */
export function contractFor(name) {
  return CONTRACTS.get(name) || null;
}

const stated = (v) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v));

/** The knobs this sketch needs given what it was told - the waveform needs more in phase mode. */
function needsFor(contract, params) {
  if (contract.name === 'waveform' && String(params.mode || '').toLowerCase() === 'phase') {
    return [...contract.needs, 'angle', 'labelA', 'labelB'];
  }
  return contract.needs;
}

const SAY = {
  mode: 'which variant ("mode")', network: 'the network', angle: 'the angle', amplitude: 'the amplitude',
  count: 'the count', ratio: 'the ratio', labelA: 'the first label', labelB: 'the second label',
};

/**
 * May this sketch be drawn from what it was told?
 *
 * `params` is what the model stated, after junk is stripped and before any
 * default is filled in; `items` is the list it gave. Returns the reasons it
 * may not, in words a creator can read - empty when it may.
 */
export function checkSketch(name, params, items) {
  const contract = CONTRACTS.get(name);
  if (!contract) return ['"' + name + '" is not a sketch in the library'];
  const p = params && typeof params === 'object' ? params : {};
  const list = Array.isArray(items) ? items : [];
  const problems = [];

  const missing = needsFor(contract, p).filter((k) => !stated(p[k]));
  // "Which variant" means little for a circuit: its mode is AC or DC.
  const say = (k) => (name === 'circuit' && k === 'mode' ? 'whether it is AC or DC ("mode")' : SAY[k]);
  if (missing.length) problems.push('was not given ' + missing.map(say).join(', '));

  if (contract.modes && stated(p.mode) && !contract.modes.includes(String(p.mode).toLowerCase())) {
    problems.push('has no "' + p.mode + '" variant (it has ' + contract.modes.join(', ') + ')');
  }

  if (contract.items) {
    const usable = contract.items.values
      ? list.filter((it) => it && it.label && Number.isFinite(it.value))
      : list.filter((it) => it && (it.label || it.symbol));
    if (usable.length < contract.items.min) {
      const what = contract.items.values ? 'entries with a value' : 'entries';
      problems.push(list.length && contract.items.values && usable.length < list.length
        ? 'needs a number on every entry'
        : 'needs at least ' + contract.items.min + ' ' + what + ' and was given ' + usable.length);
    }
  }
  return problems;
}

/** The most items this sketch draws - the cap that used to be five for all of them. */
export function itemLimit(name) {
  const contract = CONTRACTS.get(name);
  return contract && contract.items ? contract.items.max : 5;
}

/** "must state: angle, labelA, labelB; at least 3 items" - the contract as the model is told it. */
function mustState(contract) {
  const parts = [];
  if (contract.name === 'waveform') parts.push('mode; and in "phase" mode angle, labelA, labelB');
  else if (contract.needs.length) parts.push(contract.needs.join(', '));
  if (contract.items && contract.items.min > 0) {
    parts.push('at least ' + contract.items.min + ' items' + (contract.items.values ? ', each with a value' : ''));
  }
  return parts.join('; ');
}

/**
 * The lines describing the library inside the generation prompt.
 *
 * Two lines per sketch, and a third only where something must be stated.
 */
export function sketchPromptLines(options) {
  // A video is shown the sketches for its own subject, not all two hundred:
  // see sketch-shelves.mjs. With no options - a test, a tool - it is all of them.
  const shown = new Set(options ? shortlist(SKETCH_CATALOGUE.map((s) => s.name), options) : SKETCH_CATALOGUE.map((s) => s.name));
  const lines = [
    'ANIMATED SKETCHES. Setting visual.kind to "sketch" runs a real animation, drawn live.',
    'Set "sketch" to one of these names and put its knobs in "params". Never invent a name.',
    'A SKETCH IS DRAWN EXACTLY AS YOU STATE IT, AND NOT AT ALL IF YOU LEAVE SOMETHING OUT.',
    'Each sketch lists what it "must state". Give every one of those, with the value this scene',
    'is actually about - a sketch with one missing is thrown away, and so is one given a mode it',
    'does not have. Never fill a knob with a guess: if the scene does not give that angle, that',
    'ratio, that count or those labels, the sketch does not fit the scene, so use "none".',
    'Labels are a word or two: at most 14 letters, fewer inside a box. A sketch whose label does',
    'not fit is thrown away rather than drawn with the label cut short.',
    'Every number you put in a sketch must be one the question or its working gives, or follow',
    'from them in one step. An invented value drawn on screen is a false statement.',
    'Pick the one that actually shows THIS scene\'s idea. A diagram that is merely in the right',
    'subject is worse than none: it looks like an illustration of something else.',
    'Do not use the same sketch twice in one video unless the second use shows a different case.',
  ];
  for (const s of SKETCH_CATALOGUE) {
    if (!shown.has(s.name)) continue;
    const must = mustState(CONTRACTS.get(s.name));
    lines.push('- ' + s.name + ': ' + s.describe);
    lines.push('    params: ' + s.uses);
    if (must) lines.push('    must state: ' + must);
  }
  return lines;
}
