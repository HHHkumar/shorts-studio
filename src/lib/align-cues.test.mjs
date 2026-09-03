// Run: node src/lib/align-cues.test.ts.mjs
//
// Beat timing is the whole point of a motion scene: the fish is thrown back on
// the words "wall of concrete", not at 4.2 seconds. These check the one thing
// that decides whether that happens, including what it does when the model
// writes a cue the narrator never says.
//
// Unlike the older suites here, this imports the real module rather than
// replaying its logic - node strips the types on the way in, so there is no
// second copy to drift.

import assert from 'node:assert/strict';
import { alignCues, missingCues } from './options-timing.ts';

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

/** One word a second, which makes every expected time readable by eye. */
const say = (text) =>
  text.split(/\s+/).map((word, i) => ({ word, start: i, end: i + 1 }));

const NARRATION = 'a salmon heading upstream runs into a wall of concrete and is thrown back';
const words = say(NARRATION);
const SECONDS = words.length;

console.log('\ntiming a motion scene to the voice');

test('a cue fires on the word it names', () => {
  const t = alignCues(words, ['upstream'], SECONDS);
  assert.equal(t[0], 3);
});

test('a two word cue is found as a phrase', () => {
  const t = alignCues(words, ['wall of concrete'], SECONDS);
  // "wall" is word 7; "of" is a stopword, so "concrete" is the corroborator.
  assert.equal(t[0], 7);
});

test('several cues come out in the order they are spoken', () => {
  const t = alignCues(words, ['upstream', 'wall concrete', 'thrown back'], SECONDS);
  assert.deepEqual(t, [3, 7, 12]);
  assert.ok(t[0] < t[1] && t[1] < t[2]);
});

test('ONE bad cue does not drag the good ones off the voice', () => {
  // The reason this function exists rather than reusing alignLabels: that one
  // is all-or-nothing, so a single paraphrase would push all three beats onto
  // an even spread and the whole scene would drift.
  const t = alignCues(words, ['upstream', 'elephant', 'thrown back'], SECONDS);
  assert.equal(t[0], 3, 'first cue should still be exact');
  assert.equal(t[2], 12, 'last cue should still be exact');
  assert.ok(t[1] > t[0] && t[1] < t[2], 'the miss should sit between them, got ' + t[1]);
});

test('a miss at the start is placed before the first hit', () => {
  const t = alignCues(words, ['elephant', 'thrown back'], SECONDS);
  assert.ok(t[0] >= 0 && t[0] < t[1], 'got ' + t[0] + ' then ' + t[1]);
});

test('a miss at the end still has room left to play', () => {
  const t = alignCues(words, ['upstream', 'elephant'], SECONDS);
  assert.ok(t[1] > t[0], 'should come after the hit');
  assert.ok(t[1] <= SECONDS, 'should not start after the scene ends');
});

test('when nothing matches the beats are spread evenly', () => {
  const t = alignCues(words, ['elephant', 'giraffe'], SECONDS);
  assert.deepEqual(t, [0, SECONDS / 2]);
});

test('no timings at all still gives every beat a moment', () => {
  const t = alignCues([], ['upstream', 'thrown back'], 10);
  assert.deepEqual(t, [0, 5]);
  assert.ok(t.every((n) => Number.isFinite(n)));
});

test('every beat always gets a real number, whatever it is handed', () => {
  // A NaN here would put an actor at NaN% and vanish it from the frame.
  for (const cues of [[''], ['', 'upstream', ''], ['???']]) {
    const t = alignCues(words, cues, SECONDS);
    assert.ok(t.every((n) => Number.isFinite(n)), JSON.stringify(cues) + ' -> ' + t);
  }
});

console.log('\nwarning about cues that cannot fire');

test('a cue the narration never says is reported', () => {
  assert.deepEqual(missingCues(NARRATION, ['upstream', 'elephant']), ['elephant']);
});

test('cues the narration does say are not reported', () => {
  assert.deepEqual(missingCues(NARRATION, ['upstream', 'wall concrete']), []);
});

test('a cue said out of order is reported, because the scan is forward only', () => {
  // The renderer matches forward through the narration, so a beat cued on a
  // word spoken earlier than the beat before it cannot fire there either.
  assert.deepEqual(missingCues(NARRATION, ['thrown back', 'upstream']), ['upstream']);
});

console.log('\n' + passed + ' checks passed\n');
