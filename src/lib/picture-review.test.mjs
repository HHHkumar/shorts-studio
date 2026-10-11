// Run: node --import ./tools/ts-resolve.mjs src/lib/picture-review.test.mjs
//
// What is done with the picture check's verdicts: pictures taken out, put
// back, and noticed when nobody has looked at them yet.

import { applyPictureReview, pictureKey, restorePicture, tally, uncheckedPictures } from './picture-review.ts';

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

const circuit = { kind: 'sketch', sketch: 'circuit', params: { network: '10 + 20 + 30' }, items: [] };
const triangle = { kind: 'sketch', sketch: 'power-factor', params: { angle: 60 }, items: [] };
const script = () => [
  { kind: 'question', narration: 'A series RLC circuit.', visual: circuit },
  { kind: 'explain', narration: 'Phi is sixty degrees.', visual: triangle },
  { kind: 'explain', narration: 'So the power factor is one half.', visual: { kind: 'formula', formula: 'cos 60 = 0.5' } },
];
const review = (scene, verdict, extra = {}) => {
  const line = script()[scene];
  return { scene, key: pictureKey(line.narration, line.visual), verdict, reason: 'because', words: 'w', narration: line.narration, ...extra };
};

test('a wrong picture is taken out, and the reason is left on the scene', () => {
  const s = script();
  const out = applyPictureReview(s, s, [review(0, 'wrong'), review(1, 'right')]);
  assert(out.script[0].visual.kind === 'none', 'the wrong picture is still there');
  assert(/^Taken out by the picture check: because/.test(out.script[0].pictureNote), out.script[0].pictureNote);
  assert(out.script[1].visual === triangle, 'a right picture was touched');
  assert(out.reviews[0].removed === circuit, 'what was taken out was not kept');
  assert(s[0].visual === circuit, 'the script passed in was changed in place');
});

test('"beside the point" goes too; "not sure" stays for a person to judge', () => {
  const s = script();
  const out = applyPictureReview(s, s, [review(0, 'unrelated'), review(1, 'unsure')]);
  assert(out.script[0].visual.kind === 'none' && out.script[1].visual === triangle);
});

test('a scene edited since the check is left alone', () => {
  const sent = script();
  const reworded = script();
  reworded[0] = { ...reworded[0], narration: 'A parallel RLC circuit.' };
  assert(applyPictureReview(reworded, sent, [review(0, 'wrong')]).script[0].visual === circuit, 'a reworded scene lost its picture');
  const redrawn = script();
  redrawn[0] = { ...redrawn[0], visual: { ...circuit, params: { network: '5 + 5' } } };
  assert(applyPictureReview(redrawn, sent, [review(0, 'wrong')]).script[0].visual.kind === 'sketch', 'a changed picture was taken out on an old verdict');
});

test('a picture can be put back, and is then left in for good', () => {
  const s = script();
  const taken = applyPictureReview(s, s, [review(0, 'wrong')]);
  const back = restorePicture(taken.script, taken.reviews, taken.reviews[0].key);
  assert(back.script[0].visual === circuit, 'it did not come back');
  assert(back.script[0].pictureNote === undefined, 'the note outlived the picture');
  assert(back.reviews[0].kept === true && !back.reviews[0].removed, JSON.stringify(back.reviews[0]));
  // The reviewer says "wrong" again; the person already overruled it.
  const again = applyPictureReview(back.script, back.script, back.reviews);
  assert(again.script[0].visual === circuit, 'it was taken out a second time');
});

test('pictures nobody has looked at are noticed, and only those', () => {
  const s = script();
  const keys = uncheckedPictures(s, []);
  assert(keys.length === 2, 'formulas are not this check\'s business: ' + keys.length);
  assert(uncheckedPictures(s, [review(0, 'right')]).length === 1, 'a checked picture is asked about again');
  const taken = applyPictureReview(s, s, [review(0, 'wrong'), review(1, 'right')]);
  assert(uncheckedPictures(taken.script, taken.reviews).length === 0, 'a picture already taken out sets the check off again');
});

test('the tally counts each verdict', () => {
  const t = tally([review(0, 'wrong'), review(1, 'right'), review(1, 'right')]);
  assert(t.right === 2 && t.wrong === 1 && t.unsure === 0 && t.unrelated === 0, JSON.stringify(t));
});

console.log('\n' + passed + ' checks passed');
