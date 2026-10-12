// Run: node server/picture-review.test.mjs
//
// The picture review's own logic, on replies written by hand - what is asked,
// how a reply is read, how two reviewers are settled. The model's judgement is
// measured on the test bench, against a person's marks, not here.

import { buildReviewRequest, combineReviews, isFlagged, judgeReply, REVIEW_SYSTEM, REVIEW_SYSTEM_TEXT, settle } from './picture-review.mjs';
import { describePicture, pictureKey, picturesIn } from './picture-words.mjs';

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

const content = {
  subject: 'Power Systems', topic: 'Ferranti Effect',
  question: 'On a long line at no load, why does the receiving end voltage exceed the sending end voltage?',
  options: ['Line shunt capacitance drawing leading charging current', 'High series resistance', 'Corona', 'Skin effect'],
  correctIndex: 0,
  explanation: ['The charging current leads the voltage by ninety degrees.'],
  script: [
    { kind: 'hook', narration: 'A line with nothing connected, and the voltage rises.', visual: { kind: 'none' } },
    { kind: 'question', narration: 'Why does the receiving end voltage exceed the sending end voltage?',
      visual: { kind: 'sketch', sketch: 'waveform', params: { mode: 'phase', angle: 0, ratio: 1.2, labelA: 'Vs', labelB: 'Vr' }, items: [] } },
    { kind: 'explain', narration: 'The line draws a charging current through its shunt capacitance.',
      visual: { kind: 'sketch', sketch: 'circuit', params: { network: '10 + (50 | 50)', labelA: 'Vs' }, items: [] } },
    { kind: 'explain', narration: 'So the receiving end sits higher.',
      visual: { kind: 'bars', caption: 'Voltage, kV', items: [{ label: 'Sending', value: 220 }, { label: 'Receiving', value: 231 }] } },
    { kind: 'explain', narration: 'This is the Ferranti effect.', visual: { kind: 'icon', caption: 'Ferranti', items: [{ label: 'Overvoltage', symbol: '⚡' }] } },
    { kind: 'explain', narration: 'The voltage drop is j times I times X.', visual: { kind: 'formula', formula: 'ΔV = j·Ic·XL' } },
  ],
};

test('the pictures that state something are found, and the rest are left out', () => {
  const found = picturesIn(content);
  assert(found.length === 3, 'found ' + found.length + ': ' + found.map((p) => p.visual.kind).join(','));
  assert(found.map((p) => p.scene).join() === '1,2,3', found.map((p) => p.scene).join());
  assert(found[0].beat === 'question');
});

test('a picture is said in words, as drawn', () => {
  const [wave, circuit, bars] = picturesIn(content).map((p) => p.words);
  assert(/Vr in phase with Vs/.test(wave) && /1\.2 times the size/.test(wave), wave);
  // A circuit is said part by part, as the video reads its line.
  assert(/fed by a DC voltage source Vs: a resistor of 10 Ω, in series with \[a resistor of 50 Ω in parallel with a resistor of 50 Ω\]/.test(circuit), circuit);
  const typed = describePicture({ kind: 'sketch', sketch: 'circuit', params: { network: 'L + (C | Load)', labelA: 'Vs', mode: 'ac' } });
  assert(/an AC voltage source Vs: an inductor L, in series with \[a capacitor C in parallel with a load Load\]/.test(typed), typed);
  const band = describePicture({ kind: 'sketch', sketch: 'filter-response', params: { mode: 'band' } });
  assert(/which frequencies a filter lets through; set to mode = band/.test(band), band);
  assert(!/Use for/.test(band), 'the "use for" half belongs to the model that picks, not the one that checks: ' + band);
  assert(/Sending = 220, Receiving = 231/.test(bars) && /Voltage, kV/.test(bars), bars);
  assert(describePicture({ kind: 'sketch', sketch: 'diode-curve', params: {} }).includes('knee'), 'a sketch with no knobs still says what it shows');
});

test('a key follows the picture and its line, and nothing else', () => {
  const v = content.script[2].visual;
  assert(pictureKey('a line', v) === pictureKey('a line', JSON.parse(JSON.stringify(v))), 'the same picture has two keys');
  assert(pictureKey('a line', v) !== pictureKey('another line', v), 'the line is not part of the key');
  assert(pictureKey('a line', v) !== pictureKey('a line', { ...v, params: { ...v.params, network: '10 + 50' } }), 'the picture is not part of the key');
});

test('the reviewer is told the question, the answer, each line and each picture', () => {
  const text = buildReviewRequest(content, picturesIn(content));
  assert(/CORRECT ANSWER: Line shunt capacitance/.test(text), 'no answer');
  assert(/Picture 1 - on the question scene, before the answer/.test(text), 'the question scene is not marked');
  assert(/Picture 2 - on an explanation scene\n {2}line: "The line draws a charging current/.test(text), text.split('PICTURES')[1]);
  assert(/FORMULAS SHOWN: ΔV = j·Ic·XL/.test(text), 'formulas are context too');
});

test('only the reviewer that sees frames is told about frames', () => {
  assert(/the frame as it\nwill be rendered/.test(REVIEW_SYSTEM), 'the vision prompt does not mention the frame');
  assert(!/frame/i.test(REVIEW_SYSTEM_TEXT), 'the text prompt mentions a frame it will never see');
});

const pictures = picturesIn(content);

test('a reply is read into one verdict per picture', () => {
  const r = judgeReply({ pictures: [
    { n: 1, verdict: 'right', reason: 'Vr is drawn larger and in phase.' },
    { n: 2, verdict: 'wrong', reason: 'Draws the shunt capacitance as two 50 ohm resistors.' },
    { n: 3, verdict: 'wrong', reason: '220 and 231 kV are not given.' },
  ] }, pictures);
  assert(r.map((x) => x.verdict).join() === 'right,wrong,wrong', r.map((x) => x.verdict).join());
  assert(r[1].scene === 2 && r[1].key === pictures[1].key, 'a verdict lost its picture');
});

test('a reply in a code fence, with prose around it, is still read', () => {
  const reply = 'Here you go:\n```json\n{"pictures":[{"n":1,"verdict":"unrelated","reason":"generic"}]}\n```';
  assert(judgeReply(reply, pictures)[0].verdict === 'unrelated');
});

test('a picture the reviewer skipped is unsure, never right by default', () => {
  const r = judgeReply({ pictures: [{ n: 1, verdict: 'right', reason: 'ok' }] }, pictures);
  assert(r[1].verdict === 'unsure' && r[2].verdict === 'unsure', r.map((x) => x.verdict).join());
  assert(judgeReply('not json at all', pictures).every((x) => x.verdict === 'unsure'), 'junk became a verdict');
  assert(judgeReply({ pictures: [{ n: 1, verdict: 'fine', reason: 'x' }] }, pictures)[0].verdict === 'unsure', 'an unknown verdict was trusted');
});

// How two reviewers are settled comes from the first real video checked: the
// four pictures both objected to were wrong, and the three only one objected
// to were fine.
const view = (by, verdict, reason = '') => ({ by, verdict, reason });

test('a picture goes when both reviewers say it should, by the worse verdict', () => {
  const s = settle([view('Gemini', 'wrong', 'a battery and resistors for an AC line'), view('DeepSeek', 'unrelated', 'generic')]);
  assert(s.verdict === 'wrong' && s.reason === 'a battery and resistors for an AC line', JSON.stringify(s));
  assert(settle([view('Gemini', 'unrelated', 'g'), view('DeepSeek', 'unrelated', 'd')]).verdict === 'unrelated');
});

test('where they differ it stays, marked for a person, with both views said', () => {
  const s = settle([view('Gemini', 'unrelated', 'A generic capacitor.'), view('DeepSeek', 'right', 'shows the capacitance')]);
  assert(s.verdict === 'unsure', 'one objection took a picture out: ' + s.verdict);
  assert(/Gemini says beside the point \(A generic capacitor\); DeepSeek does not\./.test(s.reason), s.reason);
  assert(settle([view('Gemini', 'wrong', 'x'), view('DeepSeek', 'right', 'y')]).verdict === 'unsure', 'a lone "wrong" out of two took it out');
  assert(!isFlagged(s.verdict));
});

test('one reviewer alone may take out what it calls wrong, but not what it calls beside the point', () => {
  assert(settle([view('Gemini', 'wrong', 'x')]).verdict === 'wrong');
  const s = settle([view('Gemini', 'unrelated', 'generic')]);
  assert(s.verdict === 'unsure' && /Nobody else looked/.test(s.reason), JSON.stringify(s));
});

test('agreement that it is right is right; a doubt is a doubt; no view at all is unsure', () => {
  assert(settle([view('Gemini', 'right', 'ok'), view('DeepSeek', 'right', 'fine')]).verdict === 'right');
  assert(settle([view('Gemini', 'right'), view('DeepSeek', 'unsure', '?')]).verdict === 'unsure');
  assert(settle([]).verdict === 'unsure' && settle(null).verdict === 'unsure');
});

test('each reviewer\'s own verdict is kept beside the settled one', () => {
  const gemini = { by: 'Gemini', reviews: judgeReply({ pictures: [
    { n: 1, verdict: 'right', reason: 'fine' }, { n: 2, verdict: 'wrong', reason: 'resistors' }, { n: 3, verdict: 'unrelated', reason: 'generic' },
  ] }, pictures) };
  const deepseek = { by: 'DeepSeek', reviews: judgeReply({ pictures: [
    { n: 1, verdict: 'right', reason: 'fine' }, { n: 2, verdict: 'wrong', reason: 'capacitance drawn as resistors' }, { n: 3, verdict: 'right', reason: 'ok' },
  ] }, pictures) };
  const both = combineReviews([gemini, deepseek]);
  assert(both.map((x) => x.verdict).join() === 'right,wrong,unsure', both.map((x) => x.verdict).join());
  assert(both[1].said.length === 2 && both[1].said[0].by === 'Gemini', 'a reviewer\'s own verdict was lost');
  assert(both[2].scene === pictures[2].scene && both[2].key === pictures[2].key, 'a settled verdict lost its picture');
  assert(combineReviews([gemini]).length === 3, 'one reviewer alone is still a review');
});

test('wrong and unrelated take a picture out; unsure does not', () => {
  assert(isFlagged('wrong') && isFlagged('unrelated'));
  assert(!isFlagged('unsure') && !isFlagged('right'));
});

console.log('\n' + passed + ' checks passed');
