// Run: node server/voiceover-plan.test.mjs
//
// Which scenes a voiceover job records - all of them, or only the changed ones.

import { scenesToRecord } from './voiceover-plan.mjs';

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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const script = [
  { kind: 'hook', narration: 'One.' },
  { kind: 'question', narration: 'Two.' },
  { kind: 'countdown', narration: '' },
  { kind: 'answer', narration: 'Four.' },
  { kind: 'outro', narration: 'Five.' },
];

test('with no list, every scene that has words', () => assert(same(scenesToRecord(script), [0, 1, 3, 4])));
test('an empty list means everything, not nothing', () => assert(same(scenesToRecord(script, []), [0, 1, 3, 4])));
test('with a list, only those - the changed fun fact scene', () => assert(same(scenesToRecord(script, [4]), [4])));
test('numbers keep their place, so clips drop back in beside the kept ones', () => {
  assert(same(scenesToRecord(script, [3, 1]), [1, 3]));
});
test('a listed scene with no words is still skipped', () => assert(same(scenesToRecord(script, [2, 4]), [4])));
test('nonsense in the list is ignored, not recorded as scene 0', () => {
  assert(same(scenesToRecord(script, ['x', -1, 1.5, 99, 4]), [4]));
});
test('numbers sent as strings still count', () => assert(same(scenesToRecord(script, ['4']), [4])));
test('no script, no scenes', () => assert(same(scenesToRecord(null, [1]), [])));

console.log('\n' + passed + ' checks passed');
