// Run: node --import ./tools/ts-resolve.mjs src/lib/phasors.test.mjs
//
// A phasor diagram that adds up - or is not drawn.

import { angleBetween, phasorAngles, phasorProblems, phasorSum, readPhasors } from './phasors.ts';
import { workedOutProblems } from '../../server/sketch-checks.mjs';
import { sourceNumbers, unsourcedInVisual } from '../../server/number-source.mjs';

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
const ph = (label, value, symbol) => ({ label, value, symbol: String(symbol) });

test('a phasor is read from an item: its value is its length, its symbol its angle', () => {
  const [a, b, c] = readPhasors([ph('Vr', 1, 0), ph('Ic', 0.4, '90°'), ph('I', 0.7, '−36.87')]);
  assert(a.length === 1 && a.angle === 0 && b.angle === 90, JSON.stringify([a, b]));
  assert(c.angle === -36.87, 'a minus sign or a decimal was lost: ' + c.angle);
  assert(Number.isNaN(readPhasors([ph('X', 1, '⚡')])[0].angle), 'an emoji was read as an angle');
});

test('the Ferranti effect: the drop at 180 degrees SUBTRACTS, and the sum is checked', () => {
  // Vs = Vr + j Ic X, with Ic leading Vr by ninety: the drop opposes Vr.
  const right = [ph('Vr', 1, 0), ph('Ic X', 0.18, 180), ph('Vs', 0.82, 0)];
  assert(!phasorProblems(right, 'sum').length, phasorProblems(right, 'sum').join());
  // The same diagram with the sending end drawn LARGER is the mistake the topic is about.
  const wrong = [ph('Vr', 1, 0), ph('Ic X', 0.18, 180), ph('Vs', 1.18, 0)];
  const why = phasorProblems(wrong, 'sum').join();
  assert(/Vs is not the sum of Vr and Ic X/.test(why) && /0\.82 at 0 degrees, not 1\.18/.test(why), why);
});

test('a sum at an angle: the excitation voltage of an alternator', () => {
  const sum = phasorSum(readPhasors([ph('V', 1, 0), ph('I Xs', 0.5, 60)]));
  assert(Math.abs(sum.length - 1.3229) < 1e-3 && Math.abs(sum.angle - 19.107) < 1e-2, JSON.stringify(sum));
  assert(!phasorProblems([ph('V', 1, 0), ph('I Xs', 0.5, 60), ph('E', 1.32, 19.1)], 'sum').length);
  assert(phasorProblems([ph('V', 1, 0), ph('I Xs', 0.5, 60), ph('E', 1.32, 40)], 'sum').length === 1, 'a resultant twenty degrees out was drawn');
});

test('phasors from one point need no sum, only to be complete', () => {
  assert(!phasorProblems([ph('V', 1, 0), ph('I', 0.7, -60)], 'fan').length);
  assert(/at least two/.test(phasorProblems([ph('V', 1, 0)], 'fan').join()));
  assert(/I is missing one/.test(phasorProblems([ph('V', 1, 0), ph('I', 0.7, '')], 'fan').join()), phasorProblems([ph('V', 1, 0), ph('I', 0.7, '')], 'fan').join());
  assert(/two phasors and their resultant/.test(phasorProblems([ph('V', 1, 0), ph('I', 0.7, -60)], 'sum').join()));
});

test('angles are measured the short way round', () => {
  assert(angleBetween(170, -170) === 20 && angleBetween(-90, 0) === 90 && angleBetween(0, 360) === 0);
  assert(phasorAngles([ph('V', 1, 0), ph('I', 0.7, -60), ph('Ic', 0.2, 90)]).join() === '60,90');
});

test('a script is told why its phasors were not drawn', () => {
  const why = workedOutProblems('phasors', { mode: 'sum' }, [ph('Vr', 1, 0), ph('Ic X', 0.18, 180), ph('Vs', 1.18, 0)]);
  assert(why.length === 1 && /^The phasors Vs is not the sum/.test(why[0]), why.join());
  assert(!workedOutProblems('pendulum', {}, []).length, 'a sketch with no check of its own was given one');
});

test('a phasor\'s angle needs a source; its length does not', () => {
  const video = (narration) => ({ question: 'What is the power factor?', options: [], explanation: [], script: [{ kind: 'explain', narration }] });
  const diagram = (angle) => ({ kind: 'sketch', sketch: 'phasors', params: { mode: 'fan' }, items: [ph('V', 1, 0), ph('I', 0.7, angle)] });
  // Sixty degrees, worked out in the script.
  assert(!unsourcedInVisual(diagram(-60), sourceNumbers(video('Phi is sixty degrees, so the current lags.'))).length);
  // Seventy-five, from nowhere: a real script asked for exactly this.
  assert(unsourcedInVisual(diagram(-75), sourceNumbers(video('The rotor current lags the flux.'))).join() === '75');
  // Ninety is a relationship, not a measurement; and 0.7 of a length is nobody's business.
  assert(!unsourcedInVisual(diagram(90), sourceNumbers(video('The current leads.'))).length);
});

console.log('\n' + passed + ' checks passed');
