// Run: node --import ./tools/ts-resolve.mjs src/lib/figures/reduce.test.mjs
//
// Which circuits get the series/parallel animation - only the plain ones - and
// that the equivalent it shows is right.

import assert from 'node:assert/strict';
import { normalizeCircuit } from './circuit.ts';
import { ohms, reductionFor, reductionFormula, reductionWorking } from './reduce.ts';
import { parseMath } from '../formula-card.ts';

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
const near = (a, b) => Math.abs(a - b) < 1e-9;
const node = (id, col, row) => ({ id, col, row });
const part = (id, kind, from, to, value, unit) => ({ id, kind, from, to, value, unit });
const made = (raw) => {
  const r = normalizeCircuit({ type: 'circuit', ...raw });
  if (!r.circuit) throw new Error('refused: ' + r.errors.join('; '));
  return r.circuit;
};

const series = made({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 2, 'Ω'),
    part('R2', 'resistor', 'B', 'C', 4, 'Ω'), { id: 'W1', kind: 'wire', from: 'C', to: 'D' },
  ],
});

const parallel = made({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 12, 'V'), { id: 'W1', kind: 'wire', from: 'A', to: 'B' }, { id: 'W2', kind: 'wire', from: 'B', to: 'C' },
    part('R1', 'resistor', 'B', 'E', 6, 'Ω'), part('R2', 'lamp', 'C', 'D', 3, 'Ω'),
    { id: 'W3', kind: 'wire', from: 'D', to: 'E' }, { id: 'W4', kind: 'wire', from: 'E', to: 'F' },
  ],
});

test('a single loop is series, and adds up', () => {
  const r = reductionFor(series);
  assert.equal(r.mode, 'series');
  assert.ok(near(r.result, 6));
});

test('loads across the same two points - through wires - are parallel, and combine', () => {
  const r = reductionFor(parallel);
  assert.equal(r.mode, 'parallel');
  assert.ok(near(r.result, 2), 'got ' + r.result);
});

test('a series resistor feeding a parallel pair is neither - no animation', () => {
  const mixed = made({
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
    elements: [
      part('V1', 'voltage', 'F', 'A', 12, 'V'), part('R0', 'resistor', 'A', 'B', 1, 'Ω'), { id: 'W2', kind: 'wire', from: 'B', to: 'C' },
      part('R1', 'resistor', 'B', 'E', 6, 'Ω'), part('R2', 'resistor', 'C', 'D', 3, 'Ω'),
      { id: 'W3', kind: 'wire', from: 'D', to: 'E' }, { id: 'W4', kind: 'wire', from: 'E', to: 'F' },
    ],
  });
  assert.equal(reductionFor(mixed), null);
});

test('one load, a reactive part, or no circuit: nothing', () => {
  const one = made({
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
    elements: [part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 2, 'Ω'),
      { id: 'W1', kind: 'wire', from: 'B', to: 'C' }, { id: 'W2', kind: 'wire', from: 'C', to: 'D' }],
  });
  assert.equal(reductionFor(one), null);
  const rc = made({
    frequency: 50,
    nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
    elements: [part('V1', 'voltage', 'D', 'A', 230, 'V'), part('R1', 'resistor', 'A', 'B', 100, 'Ω'),
      part('C1', 'capacitor', 'B', 'C', 10, 'µF'), { id: 'W1', kind: 'wire', from: 'C', to: 'D' }],
  });
  assert.equal(reductionFor(rc), null);
  assert.equal(reductionFor(null), null);
});

test('the formula and the working typeset, and end on the answer', () => {
  const r = reductionFor(parallel);
  assert.equal(reductionFormula(r), '\\frac{1}{R_{eq}} = \\frac{1}{R_{1}} + \\frac{1}{R_{2}}');
  const w = reductionWorking(r);
  assert.ok(w[w.length - 1].includes('2\\,\\Omega'), w.join(' | '));
  for (const line of [reductionFormula(r), ...w]) assert.ok(parseMath(line).length > 3, line);
  assert.equal(reductionWorking(reductionFor(series))[1], '= 6\\,\\Omega');
});

test('values print as a card shows them', () => {
  assert.equal(ohms(2), '2');
  assert.equal(ohms(1 / 3), '0.333');
  assert.equal(ohms(4700), '4700');
});

console.log('\n' + passed + ' checks passed\n');
