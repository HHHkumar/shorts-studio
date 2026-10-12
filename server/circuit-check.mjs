// ---------------------------------------------------------------------------
// May this circuit be drawn?
//
// A circuit sketch is not one of the library's fixed drawings. Its line is
// read into a real circuit (src/lib/circuit-line.ts) - each part by its unit
// or its name, a supply, one fact to check it against - laid out, and solved.
// This is the one place that asks whether that worked, so the script
// generator, the test bench and the replay tool all give the same answer.
// ---------------------------------------------------------------------------

import { readCircuitLine } from '../src/lib/circuit-line.ts';
import { fitCircuit } from '../src/lib/figures/circuit.ts';

/** The box a circuit is drawn in: see FigureView in src/remotion/Figure.tsx. */
const boxFor = (orientation) => (orientation === 'landscape'
  ? { width: 620, height: 540, font: 32 }
  : { width: 940, height: 860, font: 36 });

/**
 * Why a circuit sketch cannot be drawn, in words that finish the sentence
 * "The circuit ...". Empty when it can.
 */
export function circuitProblems(params, orientation = 'portrait') {
  const { line, errors } = readCircuitLine(params || {});
  if (!line) return [errors[0] || 'could not be read'];
  const box = boxFor(orientation);
  if (!fitCircuit(line.circuit, box.width, box.height, box.font).fits) {
    return ['has more parts than can be labelled clearly'];
  }
  return [];
}
