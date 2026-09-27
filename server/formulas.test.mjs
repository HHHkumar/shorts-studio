// Run: node server/formulas.test.mjs
//
// What Gemini is told when it writes the formula card. The reply is held to
// shape by tidySheet() (src/lib/formula-card.test.mjs covers that).

import { buildFormulaRequest, FORMULA_SYSTEM } from './formulas.mjs';
import { GRAPH_KINDS } from '../src/lib/formula-card.ts';

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

const quiz = {
  subject: 'Basic Electrical', topic: 'Alternating current',
  question: 'What is the RMS value of a 325 V peak sine wave?',
  options: ['230 V', '325 V', '162 V', '460 V'], correctIndex: 0,
  answerLine: 'About 230 volts.', explanation: ['V rms = V0 / root 2', '325 / 1.414 = 230 V'],
  script: [
    { kind: 'question', narration: 'What is the RMS value?' },
    { kind: 'answer', narration: 'It is about 230 volts.' },
    { kind: 'explain', narration: 'Divide the peak by root two.', visual: { kind: 'formula', formula: 'Vrms = V0 / √2' } },
  ],
};

test('the request carries the question, its answer and its working', () => {
  const req = buildFormulaRequest(quiz);
  assert(req.includes('QUESTION: What is the RMS value'), 'no question');
  assert(req.includes('CORRECT: 230 V'), 'no answer');
  assert(req.includes('WORKING: V rms = V0 / root 2'), 'no working');
});

test('formulas already on screen in the video are passed on as the strongest hint', () => {
  assert(buildFormulaRequest(quiz).includes('FORMULAS SHOWN IN THE VIDEO: Vrms = V0 / √2'));
});

test('what was said in the explanation goes too - but not the question scene', () => {
  const req = buildFormulaRequest(quiz);
  assert(req.includes('Divide the peak by root two.'), 'no explanation');
  assert(!req.includes('THE EXPLANATION, AS SPOKEN: What is the RMS value?'), 'the question was sent as explanation');
});

test('every graph kind the renderer draws is explained to the model', () => {
  for (const kind of GRAPH_KINDS) {
    if (kind === 'none') continue;
    assert(FORMULA_SYSTEM.includes(kind + ' ('), 'the prompt does not explain ' + kind);
  }
});

test('the model is told the notation the typesetter reads', () => {
  for (const piece of ['\\frac{a}{b}', '\\sqrt{x}', 'V_{rms}', '\\omega']) {
    assert(FORMULA_SYSTEM.includes(piece), 'no mention of ' + piece);
  }
  assert(/never a formula the question does not use/i.test(FORMULA_SYSTEM), 'does not rule out padding');
});

test('an empty question asks for nothing odd', () => {
  const req = buildFormulaRequest({});
  assert(req.startsWith('SUBJECT: '), req);
});

console.log('\n' + passed + ' checks passed');
