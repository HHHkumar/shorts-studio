// Run: node --import ./tools/ts-resolve.mjs src/lib/figures/circuit-flow.test.mjs
//
// How a solved circuit moves: which way each wire's current runs, how fast
// against the others, and how bright each lamp is. The drawing is judged by
// eye; these are the numbers it is drawn from.

import assert from 'node:assert/strict';
import { normalizeCircuit, solveCircuit } from './circuit.ts';
import {
  AC_SWING, circuitFlow, flowOffset, MAX_SPEED, MIN_SPEED, PERIOD, speedFor,
} from './circuit-flow.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const node = (id, col, row) => ({ id, col, row });
const part = (id, kind, from, to, value, unit) => ({ id, kind, from, to, value, unit });
const circuit = (raw) => {
  const r = normalizeCircuit({ type: 'circuit', ...raw });
  if (!r.circuit) throw new Error('refused: ' + r.errors.join('; '));
  return r.circuit;
};
const flowOf = (c) => circuitFlow(c, solveCircuit(c));

// 12 V round 2 Ω and 4 Ω in series: 2 A everywhere.
const series = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 2, 'Ω'),
    part('R2', 'resistor', 'B', 'C', 4, 'Ω'), part('W1', 'wire', 'C', 'D'),
  ],
});

// 12 V across 6 Ω and 3 Ω in parallel: 2 A, 4 A, and 6 A from the source.
const parallel = (kind) => circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 12, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'),
    part('R1', kind, 'B', 'E', 6, 'Ω'), part('R2', kind, 'C', 'D', 3, 'Ω'),
    part('W3', 'wire', 'D', 'E'), part('W4', 'wire', 'E', 'F'),
  ],
});

console.log('\ncurrent');

test('round a series loop the current runs one way, all at the same speed', () => {
  const f = flowOf(series);
  for (const id of ['V1', 'R1', 'R2', 'W1']) {
    assert.equal(f.parts[id].direction, 1, id + ' runs against the loop');
    assert.ok(near(f.parts[id].share, 1), id + ' share ' + f.parts[id].share);
  }
});

test('conventional current: out of the + terminal, round, and back into the -', () => {
  // V1 is drawn from D (-) to A (+); R1 from A to B. Both carry current in
  // their drawn direction, so the dots leave the long plate and head for R1.
  const f = flowOf(series);
  assert.equal(f.parts.V1.direction, 1);
  assert.equal(f.parts.R1.direction, 1);
});

test('in parallel each branch runs at its share of the biggest current', () => {
  const f = flowOf(parallel('resistor'));
  assert.ok(near(f.parts.V1.share, 1), 'source ' + f.parts.V1.share);
  assert.ok(near(f.parts.R1.share, 2 / 6), '6 ohm branch ' + f.parts.R1.share);
  assert.ok(near(f.parts.R2.share, 4 / 6), '3 ohm branch ' + f.parts.R2.share);
  assert.ok(speedFor(f.parts.R2.share) > speedFor(f.parts.R1.share), 'the bigger current is not faster');
  // The wire between the branches carries only the far branch's current.
  assert.ok(near(f.parts.W2.share, 4 / 6), 'W2 ' + f.parts.W2.share);
});

test('a part carrying no current has no flow at all', () => {
  // A capacitor on DC blocks: nothing flows anywhere in its loop.
  const dcCap = circuit({
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
    elements: [
      part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 100, 'Ω'),
      part('C1', 'capacitor', 'B', 'C', 10, 'µF'), part('W1', 'wire', 'C', 'D'),
    ],
  });
  const f = flowOf(dcCap);
  assert.deepEqual(Object.keys(f.parts), [], 'something flowed through a blocking capacitor');
});

test('a circuit that does not solve animates nothing', () => {
  assert.equal(circuitFlow(series, null), null);
});

console.log('\nlamps');

test('two lamps in parallel: the one taking more power shines more', () => {
  const f = flowOf(parallel('lamp'));
  // 24 W and 48 W: brightness as the square root of power.
  assert.ok(near(f.lamps.R2, 1), '3 ohm lamp ' + f.lamps.R2);
  assert.ok(near(f.lamps.R1, Math.sqrt(0.5)), '6 ohm lamp ' + f.lamps.R1);
});

test('identical lamps in series shine the same', () => {
  const c = circuit({
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
    elements: [
      part('V1', 'voltage', 'D', 'A', 12, 'V'), part('L1', 'lamp', 'A', 'B', 6, 'Ω'),
      part('L2', 'lamp', 'B', 'C', 6, 'Ω'), part('W1', 'wire', 'C', 'D'),
    ],
  });
  const f = flowOf(c);
  assert.ok(near(f.lamps.L1, 1) && near(f.lamps.L2, 1), JSON.stringify(f.lamps));
});

test('a shorted lamp stays dark', () => {
  // The lamp down the middle column, and a wire round it on the right.
  const c = circuit({
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2), node('E', 4, 0), node('F', 4, 2)],
    elements: [
      part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 4, 'Ω'),
      part('L1', 'lamp', 'B', 'C', 6, 'Ω'), part('W2', 'wire', 'B', 'E'), part('W3', 'wire', 'E', 'F'),
      part('W4', 'wire', 'F', 'C'), part('W1', 'wire', 'C', 'D'),
    ],
  });
  const f = flowOf(c);
  assert.equal(f.lamps.L1, 0, 'a lamp with a wire across it lit up');
  assert.equal(f.parts.L1, undefined, 'current flowed through the shorted lamp');
});

console.log('\nmovement');

test('DC dots never move so fast they seem to run backwards', () => {
  assert.ok(MAX_SPEED < PERIOD / 2, 'the fastest speed strobes');
  assert.ok(near(speedFor(0), MIN_SPEED) && near(speedFor(1), MAX_SPEED));
  assert.ok(speedFor(5) === MAX_SPEED, 'not capped');
});

test('DC dots travel from the part\'s from-end to its to-end, or back when reversed', () => {
  const ahead = { share: 1, direction: 1, phase: 0 };
  const back = { share: 1, direction: -1, phase: 0 };
  assert.ok(flowOffset(ahead, false, 10, 30) < flowOffset(ahead, false, 0, 30), 'forward flow did not advance');
  assert.ok(flowOffset(back, false, 10, 30) > flowOffset(back, false, 0, 30), 'reverse flow did not reverse');
});

test('AC dots rock back and forth within their swing, with each branch\'s own phase', () => {
  const branch = { share: 1, direction: 1, phase: 0 };
  const samples = Array.from({ length: 90 }, (_, i) => flowOffset(branch, true, i, 30));
  assert.ok(Math.max(...samples) > AC_SWING * 0.9 && Math.min(...samples) < -AC_SWING * 0.9, 'did not swing both ways');
  assert.ok(samples.every((s) => Math.abs(s) <= AC_SWING + 1e-9), 'swung too far');
  const leading = { share: 1, direction: 1, phase: Math.PI / 2 };
  assert.notEqual(flowOffset(leading, true, 0, 30), flowOffset(branch, true, 0, 30), 'phase ignored');
});

test('in an AC circuit a capacitor branch leads a resistor branch', () => {
  const rc = circuit({
    frequency: 50,
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
    elements: [
      part('V1', 'voltage', 'F', 'A', 230, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'),
      part('R1', 'resistor', 'B', 'E', 100, 'Ω'), part('C1', 'capacitor', 'C', 'D', 31.83, 'µF'),
      part('W3', 'wire', 'D', 'E'), part('W4', 'wire', 'E', 'F'),
    ],
  });
  const f = flowOf(rc);
  assert.ok(f.ac, 'not treated as AC');
  const lead = f.parts.C1.phase - f.parts.R1.phase;
  assert.ok(near(lead, Math.PI / 2, 1e-3), 'capacitor leads by ' + (lead * 180 / Math.PI).toFixed(1) + ' degrees');
});

console.log('\n' + passed + ' checks passed\n');
