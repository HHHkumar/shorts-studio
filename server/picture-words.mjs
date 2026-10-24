// ---------------------------------------------------------------------------
// A picture, in words.
//
// Before anything can check a picture it has to be said what the picture
// shows - to the fact-checker, to the picture review, to the person marking
// the test bench. This is that sentence, written from what the picture is set
// to, so "two sine waves, Vr in phase with Vs, Vr 1.2 times the size" is
// judged rather than "a waveform".
//
// Also the list of pictures in a video that make a claim and so want checking,
// each with a key that stays the same for as long as the picture and its line
// do - which is how a verdict or a mark finds its picture again.
// ---------------------------------------------------------------------------

import { SKETCH_CATALOGUE } from './sketch-catalogue.mjs';
// Shared with the browser, which has to recognise the same picture by the same key.
import { pictureKey, REVIEWED_KINDS } from '../src/lib/picture-review.ts';
import { readCircuitLine } from '../src/lib/circuit-line.ts';
import { describeTiming, readTiming } from '../src/lib/timing.ts';

export { pictureKey, REVIEWED_KINDS };

const BY_NAME = new Map(SKETCH_CATALOGUE.map((s) => [s.name, s]));

const given = (v) => v !== '' && v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v));
const entry = (it) => (it.label || '') + (given(it.value) ? ' = ' + it.value : '') + (it.symbol ? ' ' + it.symbol : '');

/** What the sketch shows, without the "Use for:" half that says when to pick it. */
function shows(name) {
  const e = BY_NAME.get(name);
  if (!e) return '';
  return String(e.describe).split(/\.?\s+Use for\b/i)[0].replace(/\.$/, '').trim();
}

/** One picture as a sentence a checker can judge. */
export function describePicture(visual) {
  const v = visual || {};
  const p = v.params || {};
  const items = (v.items || []).map(entry).filter((s) => s.trim());
  const caption = v.caption ? ' captioned "' + v.caption + '"' : '';

  if (v.kind === 'bars') return 'A bar chart' + caption + ': ' + items.join(', ') + '.';
  if (v.kind === 'compare') return 'Two things side by side' + caption + ': ' + items.join(' | ') + '.';
  if (v.kind === 'icon') return 'An icon' + caption + ': ' + items.join(', ') + '.';
  if (v.kind === 'formula') return 'A formula card: ' + (v.formula || '') + '.';
  if (v.kind === 'figure') return 'The question\'s own figure, with every value computed and checked against the answer.';
  if (v.kind !== 'sketch') return '';

  const parts = [];
  if (v.sketch === 'waveform' && String(p.mode || 'phase') === 'phase') {
    // Said exactly as drawn - including what an absent value draws.
    const a = p.labelA || 'V';
    const b = p.labelB || 'I';
    const deg = Number(p.angle) || 0;
    const ratio = Number(p.ratio) || 1;
    parts.push('two sine waves, ' + a + ' and ' + b);
    parts.push(deg ? b + (deg > 0 ? ' lags ' : ' leads ') + a + ' by ' + Math.abs(deg) + ' degrees' : b + ' in phase with ' + a);
    parts.push(ratio === 1 ? 'equal in size' : b + ' is ' + ratio + ' times the size of ' + a);
  } else if (v.sketch === 'timing-diagram') {
    // Said as simulated, so the reviewer judges the waves the video shows.
    const { timing } = readTiming(p);
    if (timing) return describeTiming(timing);
    parts.push('a timing diagram that could not be read');
  } else if (v.sketch === 'circuit' && p.network) {
    // Read the way the video reads it, so what is said is what is drawn: each
    // part by its kind and value, the supply, and what it was solved to give.
    const { line } = readCircuitLine(p);
    if (line) return 'The "circuit" diagram' + caption + ': ' + line.words;
    // A line from before parts had kinds: boxes with numbers on a battery.
    parts.push('a source' + (p.labelA ? ' labelled "' + p.labelA + '"' : '') + ' driving resistors arranged as ' + p.network
      + ', where + is in series and | is in parallel; every component is drawn as a resistor with that number on it,'
      + ' and the source as a battery');
  } else {
    const what = shows(v.sketch);
    if (what) parts.push(what);
    const set = Object.entries(p).filter(([k, val]) => given(val) && k !== 'speed' && k !== 'frequency').map(([k, val]) => k + ' = ' + val);
    if (set.length) parts.push('set to ' + set.join(', '));
    if (items.length) parts.push('entries: ' + items.join(', '));
  }
  return 'The "' + v.sketch + '" diagram' + caption + ': ' + parts.join('; ') + '.';
}

/** Every picture in a video that states something, with its line and its words. */
export function picturesIn(content, kinds = REVIEWED_KINDS) {
  const script = (content && Array.isArray(content.script)) ? content.script : [];
  const out = [];
  script.forEach((line, scene) => {
    const v = line && line.visual;
    if (!v || !kinds.includes(v.kind)) return;
    out.push({
      scene,
      beat: line.kind,
      narration: line.narration || '',
      visual: v,
      words: describePicture(v),
      key: pictureKey(line.narration, v),
    });
  });
  return out;
}
