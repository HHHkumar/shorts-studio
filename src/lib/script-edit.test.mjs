// Run: node --import ./tools/ts-resolve.mjs src/lib/script-edit.test.mjs
//
// Putting the formula scene in, or taking it out, keeps every other scene's
// voiceover - on the right scene.

import assert from 'node:assert/strict';
import {
  formulaSceneAt, shiftAudio, specialSceneAt, withFormulaScene, withoutFormulaScene, withoutSpecial, withoutWorking, withSpecial,
  withWorking, workingSceneAt,
} from './script-edit.ts';

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

const quiz = ['hook', 'question', 'options', 'countdown', 'answer', 'explain', 'outro'].map((kind) => ({ kind, narration: kind }));

test('the formula scene goes in just before the outro', () => {
  const { script, at } = withFormulaScene(quiz);
  assert.equal(at, 6);
  assert.deepEqual(script.map((l) => l.kind).slice(-2), ['formulas', 'outro']);
  assert.ok(script[6].narration.length > 10, 'it has no narration');
});

test('with no outro it goes at the end; never twice', () => {
  const noOutro = quiz.slice(0, 6);
  assert.equal(withFormulaScene(noOutro).at, 6);
  const once = withFormulaScene(quiz).script;
  const twice = withFormulaScene(once);
  assert.equal(twice.at, -1);
  assert.equal(twice.script.filter((l) => l.kind === 'formulas').length, 1);
});

test('taking it out again gives back the script it came from', () => {
  const added = withFormulaScene(quiz).script;
  const { script, at } = withoutFormulaScene(added);
  assert.equal(at, 6);
  assert.deepEqual(script, quiz);
  assert.equal(withoutFormulaScene(quiz).at, -1);
  assert.equal(formulaSceneAt(quiz), -1);
});

test('adding a scene moves the later clips along and leaves the new one to record', () => {
  const audio = { 0: 'hook', 5: 'explain', 6: 'outro' };
  const shifted = shiftAudio(audio, 6, 1);
  assert.deepEqual(shifted, { 0: 'hook', 5: 'explain', 7: 'outro' });
});

test('removing a scene drops its clip and moves the later ones back', () => {
  const audio = { 0: 'hook', 6: 'formulas', 7: 'outro' };
  assert.deepEqual(shiftAudio(audio, 6, -1), { 0: 'hook', 6: 'outro' });
});

test('the worked solution takes the first explanation, and gives its visual back', () => {
  const script = quiz.map((l) => (l.kind === 'explain' ? { ...l, visual: { kind: 'formula', formula: 'V = IR' } } : l));
  const on = withWorking(script);
  const at = workingSceneAt(on);
  assert.equal(on[at].kind, 'explain');
  assert.equal(on[at].visual.kind, 'working');
  assert.deepEqual(withWorking(on), on, 'applied twice');
  const off = withoutWorking(on);
  assert.deepEqual(off[at].visual, { kind: 'formula', formula: 'V = IR' });
  assert.equal(off[at].visualWas, undefined, 'left its memory behind');
  assert.equal(workingSceneAt(off), -1);
});

test('the reduction takes the next explanation, never the one the solution is in', () => {
  const two = [...quiz.slice(0, 5), { kind: 'explain', narration: 'a' }, { kind: 'explain', narration: 'b' }, quiz[6]];
  const both = withSpecial(withWorking(two), 'reduce');
  assert.equal(both[5].visual.kind, 'working');
  assert.equal(both[6].visual.kind, 'reduce');
  assert.equal(specialSceneAt(withoutSpecial(both, 'reduce'), 'reduce'), -1);
  assert.equal(withoutSpecial(both, 'reduce')[5].visual.kind, 'working', 'took the wrong one out');
});

test('no explanation scene, no worked solution', () => {
  const noExplain = quiz.filter((l) => l.kind !== 'explain');
  assert.deepEqual(withWorking(noExplain), noExplain);
});

console.log('\n' + passed + ' checks passed\n');
