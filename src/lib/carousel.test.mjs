// Run: node src/lib/carousel.test.mjs
//
// The carousel plan: which slides a question becomes, and whether their text
// fits a 1080 square.

import {
  BODY_HEIGHT, CONTENT_WIDTH, MAX_SLIDES, QUESTION_GAP, optionsHeight, planCarousel, rationaleSteps,
  slideFileName, textHeight, wrapLines,
} from './carousel.ts';
import { DEMO_CONTENT } from './demo.ts';

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
const kinds = (plan) => plan.slides.map((s) => s.kind).join(' ');

console.log('wrapping');

test('short text is one line', () => assert(wrapLines('Hello there', 40, 900) === 1));
test('words wrap whole, not mid-word', () => {
  // 100 px at size 20 x 0.54 fits 9 characters a line: "aaaa bbbb" then "cccc".
  assert(wrapLines('aaaa bbbb cccc', 20, 100) === 2, String(wrapLines('aaaa bbbb cccc', 20, 100)));
});
test('a word longer than the line takes lines of its own', () => {
  assert(wrapLines('x'.repeat(20), 20, 100) === 3, String(wrapLines('x'.repeat(20), 20, 100)));
});
test('line breaks start new lines', () => assert(wrapLines('one\ntwo', 40, 900) === 2));

console.log('\nthe slides');

test('a plain quiz: question with options, answer, why, outro', () => {
  const plan = planCarousel(DEMO_CONTENT, { channelName: '@physics.daily' });
  assert(kinds(plan) === 'question answer why outro', kinds(plan));
  const q = plan.slides[0];
  assert(q.options.length === 4 && q.questionSize >= 42, JSON.stringify(q));
  assert(plan.slides[3].handle === '@physics.daily', JSON.stringify(plan.slides[3]));
});

test('the question and options really fit the body together', () => {
  const q = planCarousel(DEMO_CONTENT).slides[0];
  const h = textHeight(q.question, q.questionSize, CONTENT_WIDTH, 1.12, 0.6) + QUESTION_GAP + optionsHeight(q.options, q.optionSize);
  assert(h <= BODY_HEIGHT, h + ' > ' + BODY_HEIGHT);
});

test('the answer slide marks the correct option', () => {
  const a = planCarousel(DEMO_CONTENT).slides.find((s) => s.kind === 'answer');
  assert(a.correctIndex === 2 && a.options[2] === 'They land together' && /same time/.test(a.answerLine), JSON.stringify(a));
});

test('the question slide never carries the answer line', () => {
  const q = planCarousel(DEMO_CONTENT).slides[0];
  assert(!JSON.stringify(q).includes(DEMO_CONTENT.answerLine));
});

test('a long question gives the options their own slide', () => {
  const long = { ...DEMO_CONTENT, question: 'A very long question that goes on '.repeat(14), options: DEMO_CONTENT.options.map((o) => o + ' with a lot more words in the option than usual') };
  const plan = planCarousel(long);
  assert(kinds(plan).startsWith('question options answer'), kinds(plan));
  assert(plan.notes.some((n) => /own/.test(n)), JSON.stringify(plan.notes));
});

test('a setup-safe figure shares the first slide with the question, then options, and is worked out after the answer', () => {
  const figure = { type: 'junction', node: 'P', branches: [{ label: 'I1', current: 3, direction: 'in' }, { label: 'I2', current: 2, direction: 'in' }, { label: 'I3', direction: 'out', ask: true }] };
  const withFigure = { ...DEMO_CONTENT, figure };
  const plan = planCarousel(withFigure);
  assert(kinds(plan) === 'question options answer worked why outro', kinds(plan));
  assert(plan.slides[0].figure === true && plan.slides[0].options.length === 0, JSON.stringify(plan.slides[0]));
});

test('a graph is not setup-safe: no figure on the question, but still worked out after the answer', () => {
  const graph = { type: 'graph', curves: [{ id: 'c', formula: 'x' }] };
  const plan = planCarousel({ ...DEMO_CONTENT, figure: graph });
  assert(plan.slides[0].figure === false && kinds(plan) === 'question answer worked why outro', kinds(plan));
});

test('many long steps are split over several "why" slides at one shared size', () => {
  const steps = Array.from({ length: 8 }, (_, i) => 'Step ' + (i + 1) + ': ' + 'this part of the reasoning takes a good few words to say properly '.repeat(2));
  const plan = planCarousel({ ...DEMO_CONTENT, explanation: steps });
  const why = plan.slides.filter((s) => s.kind === 'why');
  assert(why.length >= 2, String(why.length));
  assert(new Set(why.map((s) => s.size)).size === 1, 'sizes differ between pages');
  assert(why.every((s, i) => s.part === i + 1 && s.parts === why.length), JSON.stringify(why.map((s) => [s.part, s.parts])));
  assert(why.flatMap((s) => s.steps.map((t) => t.number)).join(',') === '1,2,3,4,5,6,7,8', 'steps lost or reordered');
});

test('every "why" page fits its budget', () => {
  const steps = Array.from({ length: 6 }, () => 'A long step of reasoning that wraps over a couple of lines at least. '.repeat(2));
  const plan = planCarousel({ ...DEMO_CONTENT, explanation: steps });
  const stepWidth = CONTENT_WIDTH - 56 * 1.6 - 24;
  for (const s of plan.slides.filter((x) => x.kind === 'why')) {
    const h = s.steps.reduce((t, st, i) => t + Math.max(textHeight(st.text, s.size, stepWidth, 1.3), s.size * 1.6) + (i ? 34 : 0), 0);
    assert(h <= BODY_HEIGHT - 90, 'page ' + s.part + ': ' + h);
  }
});

test('without written steps, the explain scenes are the rationale', () => {
  const steps = rationaleSteps({ ...DEMO_CONTENT, explanation: [] });
  assert(steps.length === 2 && /no atmosphere/.test(steps[0]), JSON.stringify(steps));
});

test('an explainer with no options: question, why, outro - no answer slide', () => {
  const plan = planCarousel({ ...DEMO_CONTENT, videoKind: 'explainer', options: [], correctIndex: -1 });
  assert(kinds(plan) === 'question why outro', kinds(plan));
});

test('no fun fact still ends on a follow slide', () => {
  const plan = planCarousel({ ...DEMO_CONTENT, funFact: '' });
  const last = plan.slides[plan.slides.length - 1];
  assert(last.kind === 'outro' && last.fact === '' && last.factSize === 0, JSON.stringify(last));
});

test('the kicker does not repeat a subject that equals the topic', () => {
  const q = planCarousel({ ...DEMO_CONTENT, subject: 'Gravity', topic: 'Gravity' }).slides[0];
  assert(q.kicker === 'Gravity', q.kicker);
});

test('never more than Instagram allows, and the follow slide survives the cut', () => {
  const steps = Array.from({ length: 60 }, () => 'A step long enough to need most of a slide on its own. '.repeat(9));
  const plan = planCarousel({ ...DEMO_CONTENT, explanation: steps });
  assert(plan.slides.length <= MAX_SLIDES, String(plan.slides.length));
  assert(plan.slides[plan.slides.length - 1].kind === 'outro', 'outro dropped');
});

test('file names sort in order', () => {
  assert(slideFileName(0) === 'slide-01.png' && slideFileName(11) === 'slide-12.png');
});

console.log('\n' + passed + ' checks passed');
