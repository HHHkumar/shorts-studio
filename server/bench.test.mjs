// Run: node server/bench.test.mjs
//
// The test bench's own bookkeeping: cases in, marks on, and a score that says
// what it claims to. On a folder of its own - the real bench is never touched.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addCase, addLibraryVideos, benchView, deleteCase, listCases, readMarks, saveReviews, scoreBench, setMark,
} from './bench.mjs';

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
const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bench-test-'));

const sketch = (name, params, items = []) => ({ kind: 'sketch', sketch: name, params, items });
const content = () => ({
  subject: 'Network Theory', topic: 'Series RLC Circuit Resonance',
  question: 'A series RLC circuit has a resonant frequency of 1000 radians per second and a quality factor of 10. What is its bandwidth?',
  options: ['100 radians per second', '10', '1000', '10000'], correctIndex: 0, explanation: ['BW = 1000 / 10'],
  script: [
    { kind: 'question', narration: 'A series RLC circuit.', visual: sketch('circuit', { network: '10 + 20 + 30' }), doodleSrc: 'generated/x.png' },
    { kind: 'explain', narration: 'Bandwidth is the spread between the half power points.', visual: sketch('filter-response', { mode: 'band' }) },
    { kind: 'explain', narration: 'At resonance the circuit is purely resistive.', visual: sketch('power-factor', { angle: 0 }) },
    { kind: 'explain', narration: 'Divide 1000 by 10.', visual: { kind: 'formula', formula: 'BW = 1000 / 10' } },
    { kind: 'outro', narration: 'Follow for more.', visual: { kind: 'none' }, pictureNote: 'The waveform sketch was not given the angle, so it was not drawn.' },
  ],
});

test('a case is added, found again, and keeps no media of its own', () => {
  const root = fresh();
  const c = addCase(root, { content: content(), design: { layout: 'doodle', mode: 'light', orientation: 'portrait', music: 'calm' } });
  assert(c.id === 'b-series-rlc-circuit-resonance', c.id);
  assert(addCase(root, { content: content() }).id === 'b-series-rlc-circuit-resonance-2', 'a second case on the same topic overwrote the first');
  const [first] = listCases(root);
  assert(first.content.script[0].doodleSrc === undefined, 'a drawing path came along');
  assert(JSON.stringify(first.look) === '{"layout":"doodle","mode":"light","orientation":"portrait"}', JSON.stringify(first.look));
});

test('an id that is not a bench id is refused: nothing outside the folder is read or written', () => {
  const root = fresh();
  for (const bad of ['../library/x', 'b-../../x', 'v-20260101-000000-abcd', '', 'b-' + 'a'.repeat(90)]) {
    let threw = false;
    try { setMark(root, bad, '0123abcd', { mark: 'right' }); } catch { threw = true; }
    assert(threw, 'accepted ' + JSON.stringify(bad));
  }
});

test('the view lists each picture with the three opinions about it', () => {
  const root = fresh();
  const { id } = addCase(root, { content: content() });
  let view = benchView(root, (caseId, scene) => '/out/bench/' + caseId + '/scene-' + scene + '.jpg');
  const [c] = view.cases;
  assert(c.pictures.length === 3, 'formulas and bare scenes are not pictures to mark: ' + c.pictures.length);
  const [circuit, band, pf] = c.pictures;
  assert(circuit.refused.length === 1 && /\b30\b/.test(circuit.refused[0]), 'the rules did not refuse invented resistors: ' + circuit.refused);
  assert(!circuit.shown && band.shown && pf.shown, 'shown: ' + [circuit.shown, band.shown, pf.shown]);
  assert(circuit.frame === '/out/bench/' + id + '/scene-0.jpg', circuit.frame);
  assert(c.notDrawn.length === 1 && c.notDrawn[0].scene === 4, 'what was asked for and not drawn is not listed');
  assert(c.answer === '100 radians per second');

  // The reviewer takes the second one out.
  saveReviews(root, id, { by: ['Gemini'], sawFrames: true, reviews: [
    { key: band.key, scene: 1, verdict: 'unrelated', reason: 'generic' },
    { key: pf.key, scene: 2, verdict: 'right', reason: 'unity power factor' },
  ] });
  view = benchView(root);
  assert(!view.cases[0].pictures[1].shown && view.cases[0].pictures[2].shown, 'a flagged picture still counts as shown');
  assert(view.cases[0].sawFrames === true && view.cases[0].by[0] === 'Gemini');
});

test('marks are kept by case and by picture, and can be taken away', () => {
  const root = fresh();
  const { id } = addCase(root, { content: content() });
  const key = benchView(root).cases[0].pictures[0].key;
  setMark(root, id, key, { mark: 'wrong', note: 'RLC drawn as three resistors' });
  assert(readMarks(root)[id][key].mark === 'wrong' && readMarks(root)[id][key].by === 'you');
  assert(benchView(root).cases[0].pictures[0].note === 'RLC drawn as three resistors');
  setMark(root, id, key, { mark: '' });
  assert(!readMarks(root)[id], 'an emptied case is still listed in the marks');
  let threw = false;
  try { setMark(root, id, key, { mark: 'meh' }); } catch { threw = true; }
  assert(threw, 'a mark that is not one of the three was accepted');
});

test('the score sets the rules and the reviewer against the person', () => {
  const root = fresh();
  const { id } = addCase(root, { content: content() });
  const [circuit, band, pf] = benchView(root).cases[0].pictures;
  saveReviews(root, id, { by: ['Gemini'], sawFrames: true, reviews: [
    { key: band.key, scene: 1, verdict: 'right', reason: '' },
    { key: pf.key, scene: 2, verdict: 'unrelated', reason: '' },
  ] });
  setMark(root, id, circuit.key, { mark: 'wrong' });   // refused by a rule: caught
  setMark(root, id, band.key, { mark: 'right' });      // shown, and right
  setMark(root, id, pf.key, { mark: 'right' });        // right, but the reviewer took it out
  const s = benchView(root).score;
  assert(s.marked === 3 && s.pictures === 3, JSON.stringify(s));
  assert(s.shownRight === 1 && s.shownWrong === 0 && s.hiddenWrong === 1 && s.hiddenRight === 1, JSON.stringify(s));
  assert(s.shownRightPct === 100, 'everything shown is right: ' + s.shownRightPct);
  assert(s.askedRightPct === 66.7, 'two of three asked for were right: ' + s.askedRightPct);
  assert(s.caughtPct === 100 && s.keptPct === 50, s.caughtPct + ' ' + s.keptPct);
  assert(s.byRules.caught === 1 && s.byReviewer.lostRight === 1 && s.byReviewer.judged === 2, JSON.stringify(s.byRules) + JSON.stringify(s.byReviewer));
});

test('a first pass by Claude is a suggestion: it does not count until a person confirms it', () => {
  const root = fresh();
  const { id } = addCase(root, { content: content() });
  const [circuit] = benchView(root).cases[0].pictures;
  setMark(root, id, circuit.key, { mark: 'wrong', by: 'claude' });
  let view = benchView(root);
  assert(view.score.marked === 0 && view.score.suggested === 1, JSON.stringify(view.score));
  assert(scoreBench(view.cases, { includeSuggested: true }).marked === 1, 'the suggested score leaves suggestions out');
  setMark(root, id, circuit.key, { mark: 'wrong', by: 'you' });
  view = benchView(root);
  assert(view.score.marked === 1 && view.score.suggested === 0, JSON.stringify(view.score));
});

test('library videos come onto the bench once, with the pictures a check had taken out', () => {
  const root = fresh();
  const c = content();
  const removed = c.script[1].visual;
  c.script[1] = { ...c.script[1], visual: { kind: 'none' }, pictureNote: 'Taken out by the picture check: generic' };
  c.pictureReview = { checkedAt: 'x', by: ['Gemini'], sawFrames: true, reviews: [
    { scene: 1, key: 'k', verdict: 'unrelated', reason: 'generic', words: 'w', narration: c.script[1].narration, removed },
  ] };
  const videos = [
    { id: 'v-20260927-214342-jl3d', createdAt: '2026-09-27T16:13:42.000Z', content: c, design: { layout: 'doodle' } },
    { id: 'v-20260101-000000-aaaa', content: { videoKind: 'explainer', question: 'q', script: [] } },
  ];
  assert(addLibraryVideos(root, videos).join() === 'b-v-20260927-214342-jl3d', 'wrong cases added');
  assert(addLibraryVideos(root, videos).length === 0, 'added a second time');
  const [only] = benchView(root).cases;
  assert(only.pictures.length === 3, 'the picture that had been taken out is not there to be marked: ' + only.pictures.length);
  assert(only.source === 'library');
});

test('a case can be taken off the bench, marks and all', () => {
  const root = fresh();
  const { id } = addCase(root, { content: content() });
  setMark(root, id, benchView(root).cases[0].pictures[0].key, { mark: 'right' });
  deleteCase(root, id);
  assert(listCases(root).length === 0 && !readMarks(root)[id]);
});

console.log('\n' + passed + ' checks passed');
