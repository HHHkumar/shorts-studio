// Run: node --import ./tools/ts-resolve.mjs src/lib/script-edit.test.mjs
//
// Putting the formula scene in, or taking it out, keeps every other scene's
// voiceover - on the right scene.

import assert from 'node:assert/strict';
import { formulaSceneAt, shiftAudio, withFormulaScene, withoutFormulaScene } from './script-edit.ts';

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

console.log('\n' + passed + ' checks passed\n');
