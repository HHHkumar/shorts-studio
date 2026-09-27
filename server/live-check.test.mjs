// Run: node server/live-check.test.mjs
//
// The live rehearsal's judgement, on replies written by hand - the network
// call itself is the thing it exists to test, so it is not faked here.

import { judgeDirections, judgeSheet } from './live-check.mjs';

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
const failed = (results) => results.filter((r) => !r.ok).map((r) => r.name);

const card = (formula, kind = 'rms', icon = 'meter') => ({
  name: 'x', formula, notes: [], graph: { kind, x: '', y: '', label: '', label2: '' }, icon,
});

test('a good sheet passes', () => {
  const r = judgeSheet({ title: 't', cards: [card('V_{rms} = \\frac{V_0}{\\sqrt{2}}'), card('\\omega = 2\\pi f', 'phasor')] });
  assert(!failed(r).length, failed(r).join());
});

test('LaTeX that lost its backslashes is caught', () => {
  const r = judgeSheet({ title: 't', cards: [card('frac sqrt'), card('v = V_0 \\sin(\\omega t)')] });
  assert(failed(r).includes('Every formula typesets'), failed(r).join());
});

test('no sheet, or one card, fails', () => {
  assert(failed(judgeSheet(null)).length === 1);
  assert(failed(judgeSheet({ title: 't', cards: [card('a = b')] })).includes('Formula card written'));
});

test('directions: every engineer scene needs a pose from the list, and poses vary', () => {
  const good = { 0: { subject: 'mascot', pose: 'shock' }, 1: { subject: 'mascot', pose: 'think' }, 5: { subject: 'illustration' } };
  assert(!failed(judgeDirections(good, [0, 1, 5])).length, failed(judgeDirections(good, [0, 1, 5])).join());
  const bad = { 0: { subject: 'mascot', pose: 'think' }, 1: { subject: 'mascot', pose: 'think' }, 5: { subject: 'mascot' } };
  const f = failed(judgeDirections(bad, [0, 1, 5]));
  assert(f.includes('Every engineer scene has a pose') && f.includes('Poses vary'), f.join());
  assert(failed(judgeDirections({ 0: good[0] }, [0, 1])).includes('Every scene directed'));
});

console.log('\n' + passed + ' checks passed');
