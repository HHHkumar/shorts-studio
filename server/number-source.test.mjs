// Run: node server/number-source.test.mjs
//
// Where a drawn number came from. The cases are pictures real videos showed.

import { isSourced, numbersIn, sourceNumbers, unsourcedInVisual } from './number-source.mjs';

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
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const same = (got, want) => assert(JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));

test('numbers are read as digits and as words', () => {
  same(numbersIn('A 230 V supply, 1,000 turns, 0.099 ohms'), [230, 1000, 0.099]);
  same(numbersIn('thirty volts, twenty amperes, and two hundred watts'), [30, 20, 200]);
  same(numbersIn('two hundred and thirty volts'), [230]);
  same(numbersIn('zero point five lagging'), [0.5]);
  same(numbersIn('one point four one four'), [1.414]);
  same(numbersIn('twenty five thousand'), [25000]);
});

test('"five and three" is two numbers, not eight', () => {
  same(numbersIn('currents entering are five and three amperes'), [5, 3]);
  same(numbersIn('wattmeter one equals thirty minus phi'), [1, 30]);
});

test('halved, doubles and twice count as numbers', () => {
  same(numbersIn('the flux is halved, so the current doubles'), [0.5, 2]);
});

test('a number given outright, or one step from the givens, has a source', () => {
  const src = [5, 3, 2];
  assert(isSourced(8, src), '5 + 3');
  assert(isSourced(6, src), '3 * 2');
  assert(isSourced(2.5, src), '5 / 2');
  assert(!isSourced(110, src), '110 is nowhere');
  assert(isSourced(0.099, [99, 999]), '99 / 999 rounds to 0.099');
  assert(isSourced(1.41, [2]), 'root two');
  assert(!isSourced(20, [1000, 10]), 'twice a given is not a given unless the video says "twice"');
  assert(isSourced(20, [1000, 10, 2]), 'and is one when it does');
  assert(isSourced(10000, [10]), 'amperes to milliamperes');
  assert(isSourced(0.5, [50]), 'fifty percent');
});

const video = (question, narration, extra = {}) => ({
  question, options: [], explanation: [],
  script: narration.map((n) => ({ kind: 'explain', narration: n })), ...extra,
});

test('the corona chart: 110 kV against 145 kV, from a question with no numbers', () => {
  const src = sourceNumbers(video(
    'Which modification will increase the critical disruptive voltage?',
    ['Increasing spacing d directly raises the ratio d over r inside that natural logarithm term.'],
  ));
  const chart = { kind: 'bars', items: [{ label: 'Narrow', value: 110 }, { label: 'Wide', value: 145 }] };
  same(unsourcedInVisual(chart, src), [110, 145]);
});

test('the Kirchhoff chart: 8 A in and 8 A out, worked from 5, 3 and 2', () => {
  const src = sourceNumbers(video(
    'Currents entering are five amperes and three amperes, while two amperes leaves.',
    ['This gives a total inflow of eight amperes.'],
  ));
  const chart = { kind: 'bars', items: [{ label: 'Entering', value: 8 }, { label: 'Leaving', value: 8 }] };
  same(unsourcedInVisual(chart, src), []);
});

test('a series RLC drawn as resistors of 10, 20 and 30 ohms nobody gave', () => {
  const src = sourceNumbers(video(
    'A series RLC circuit has a resonant frequency of 1000 radians per second and a quality factor of 10.',
    ['Bandwidth equals resonant frequency divided by the quality factor.'],
  ));
  const circuit = { kind: 'sketch', sketch: 'circuit', params: { network: '10 + 20 + 30' }, items: [] };
  same(unsourcedInVisual(circuit, src), [20, 30]);
});

test('the meter and its shunt: 99 ohms beside 1 ohm, both from the question', () => {
  const src = sourceNumbers(video(
    'A PMMC ammeter has an internal resistance of 99 ohms and full scale deflection of 1 milliampere. Extend it to 100 milliamperes.',
    [],
  ));
  const circuit = { kind: 'sketch', sketch: 'circuit', params: { network: '99 | 1' }, items: [] };
  same(unsourcedInVisual(circuit, src), []);
});

test('an angle: ninety and zero state a relationship, forty-five must come from somewhere', () => {
  const src = sourceNumbers(video('What happens to the armature current?', ['The load torque stays constant.']));
  const at = (angle) => unsourcedInVisual({ kind: 'sketch', sketch: 'torque', params: { angle }, items: [] }, src);
  same(at(45), [45]);
  same(at(90), []);
  same(at(-90), []);
  same(at(0), []);
  // Sixty degrees, when the working reaches it.
  const worked = sourceNumbers(video('One wattmeter reads zero.', ['Thirty plus phi equals ninety, so phi is sixty degrees.']));
  same(unsourcedInVisual({ kind: 'sketch', sketch: 'power-factor', params: { angle: 60 }, items: [] }, worked), []);
});

test('formulas the video shows are a source too', () => {
  const src = sourceNumbers({
    question: 'How many roots lie in the right half plane?',
    script: [{ kind: 'explain', narration: 'Compute the first element.', visual: { kind: 'formula', formula: 'b1 = -36 / 2 = -18' } }],
  });
  same(unsourcedInVisual({ kind: 'bars', items: [{ label: 's1', value: -18 }, { label: 's0', value: 36 }] }, src), []);
});

console.log('\n' + passed + ' checks passed');
