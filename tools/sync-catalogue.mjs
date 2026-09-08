// ---------------------------------------------------------------------------
// Regenerate server/sketch-catalogue.mjs from the sketch definitions.
//
//     node --import ./tools/ts-resolve.mjs tools/sync-catalogue.mjs
//
// Why this exists: the catalogue is what the model is shown, and the SKETCHES
// record is what actually draws. They used to be two hand-written lists in two
// languages, which is a drift bug waiting to happen - a name in one and not the
// other is a sketch that can be requested and never drawn, or drawn and never
// requested, and both fail in silence.
//
// With a hundred entries that stopped being a theoretical risk, so the list the
// server shows is now DERIVED. The TypeScript is the single source of truth;
// this writes the JavaScript copy the server can import without a TS loader.
//
// Run it after adding or renaming a sketch. sketches.test.mjs fails if you
// forget, and prints this command.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKETCHES, SKETCH_NAMES } from '../src/remotion/sketches.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'server', 'sketch-catalogue.mjs');

/** Single-quoted JS string literal, escaped. */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

export function buildSource() {
  const entries = SKETCH_NAMES.map((name) => {
    const d = SKETCHES[name];
    return '  { name: ' + q(name) + ', describe: ' + q(d.describe) + ', uses: ' + q(d.uses) + ' },';
  });

  return `// ---------------------------------------------------------------------------
// What the model is told about the animation library.
//
// GENERATED FILE - do not edit by hand. Every change here is overwritten.
//
//     node --import ./tools/ts-resolve.mjs tools/sync-catalogue.mjs
//
// The implementations live in src/remotion/sketches.ts and sketches-extra.ts,
// which the server cannot import because it is TypeScript. This is the copy it
// can, derived from those files so the two can never disagree about which
// sketches exist.
// ---------------------------------------------------------------------------

export const SKETCH_CATALOGUE = [
${entries.join('\n')}
];

export const SKETCH_NAMES = SKETCH_CATALOGUE.map((s) => s.name);

/**
 * The lines describing the library inside the generation prompt.
 *
 * Deliberately two lines per sketch and not three. At a hundred entries the old
 * three-line form was three hundred lines of every request, most of it repeating
 * the sketch's own name back at the model.
 */
export function sketchPromptLines() {
  const lines = [
    'ANIMATED SKETCHES. Setting visual.kind to "sketch" runs a real animation, drawn live.',
    'Set "sketch" to one of these names and put its knobs in "params". Never invent a name.',
    'Prefer a sketch over a static diagram whenever the point is about MOVEMENT or CHANGE.',
    'Pick the one that actually shows THIS scene\\'s idea. A diagram that is merely in the right',
    'subject is worse than none: it looks like an illustration of something else.',
    'Do not use the same sketch twice in one video unless the second use shows a different case.',
  ];
  for (const s of SKETCH_CATALOGUE) {
    lines.push('- ' + s.name + ': ' + s.describe);
    lines.push('    params: ' + s.uses);
  }
  lines.push('Leave out any parameter you are unsure of; every one has a sensible default.');
  return lines;
}

/**
 * Guards against this file being stale. The test calls it; so does boot.
 * Returns the names the catalogue is missing, which is always empty unless
 * somebody added a sketch and forgot to regenerate.
 */
export function verifyAgainstImplementations(names) {
  const have = new Set(SKETCH_NAMES);
  return (names || []).filter((n) => !have.has(n));
}
`;
}

const written = buildSource();
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
if (existing === written) {
  console.log('catalogue already up to date (' + SKETCH_NAMES.length + ' sketches)');
} else {
  fs.writeFileSync(OUT, written);
  console.log('wrote ' + SKETCH_NAMES.length + ' sketches to server/sketch-catalogue.mjs');
}
