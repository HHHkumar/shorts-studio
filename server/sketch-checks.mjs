// ---------------------------------------------------------------------------
// The sketches that are checked by working them out.
//
// Most sketches are fixed drawings with a few knobs, and the contract
// (sketch-contract.mjs) is all there is to ask of them. A few are not: a
// circuit is solved, and a phasor diagram has to add up. This is the one place
// that asks those questions, so the script generator, the test bench and the
// replay tool cannot give three different answers.
// ---------------------------------------------------------------------------

import { circuitProblems } from './circuit-check.mjs';
import { phasorProblems } from '../src/lib/phasors.ts';

/** The sketches with a check of their own, and what each is called in a sentence. */
const CHECKED = {
  circuit: { noun: 'circuit', check: (params, _items, orientation) => circuitProblems(params, orientation) },
  phasors: { noun: 'phasors', check: (params, items) => phasorProblems(items, (params || {}).mode) },
};

export const isWorkedOut = (name) => Object.prototype.hasOwnProperty.call(CHECKED, name);

/**
 * Why this sketch cannot be drawn, as whole sentences a creator can read.
 * Empty when it can, and for every sketch that has no check of its own.
 */
export function workedOutProblems(name, params, items, orientation = 'portrait') {
  const entry = CHECKED[name];
  if (!entry) return [];
  return entry.check(params, items, orientation).map((reason) => 'The ' + entry.noun + ' ' + reason);
}
