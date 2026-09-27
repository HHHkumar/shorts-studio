// Run: node server/translate.test.mjs
//
// A translated video keeps its shape whatever the model sends back.

import { mergeTranslation, translateSystem, translationRequest } from './translate.mjs';

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
  question: 'What is the RMS value?', options: ['230 V', '325 V'], correctIndex: 0, answerLine: '230 V.',
  explanation: ['Divide by root two'], funFact: 'Fact.', outro: 'Follow.', hook: 'Hook.',
  figure: { type: 'circuit', elements: [] },
  script: [
    { kind: 'hook', narration: 'Hook line.', onScreen: 'Hook' },
    { kind: 'countdown', narration: '', onScreen: '' },
    { kind: 'answer', narration: 'It is 230 V.', onScreen: '' },
  ],
  formulas: { title: 'AC Formulas', cards: [{ name: 'RMS Voltage', formula: 'V_{rms} = \\frac{V_0}{\\sqrt{2}}', notes: ['V_0 = peak'], graph: { kind: 'rms' }, icon: 'meter' }] },
};

test('only the words go to be translated - never the formulas or the figure', () => {
  const req = JSON.parse(translationRequest(content));
  assert(req.narrations.length === 3 && req.formulaNames[0] === 'RMS Voltage', JSON.stringify(req));
  assert(!JSON.stringify(req).includes('frac') && !JSON.stringify(req).includes('circuit'), 'sent maths or the figure');
});

test('a full reply is merged scene by scene; the maths and the answer stay', () => {
  const out = mergeTranslation(content, {
    question: 'RMS मान क्या है?', options: ['230 V', '325 V'], answerLine: '230 V.', explanation: ['रूट दो से भाग दें'],
    funFact: 'तथ्य।', outro: 'फॉलो करें।', hook: 'हुक।', narrations: ['हुक लाइन।', '', 'यह 230 V है।'], onScreens: ['हुक', '', ''],
    formulaTitle: 'AC सूत्र', formulaNames: ['RMS वोल्टेज'], formulaNotes: [['V_0 = शिखर']],
  }, 'Hindi');
  assert(out.script[2].narration === 'यह 230 V है।' && out.script[1].kind === 'countdown');
  assert(out.formulas.cards[0].formula === content.formulas.cards[0].formula, 'the formula was changed');
  assert(out.formulas.cards[0].name === 'RMS वोल्टेज' && out.formulas.title === 'AC सूत्र');
  assert(out.correctIndex === 0 && out.figure === content.figure && out.language === 'Hindi');
});

test('a reply that loses a scene or an option changes nothing it cannot place', () => {
  const out = mergeTranslation(content, { narrations: ['only one'], options: ['a'], question: '' }, 'Kannada');
  assert(out.script.map((s) => s.narration).join('|') === 'Hook line.||It is 230 V.', 'scrambled the script');
  assert(out.options[0] === '230 V' && out.question === content.question, 'took a broken list');
});

test('the model is told to keep numbers, order and the correct answer', () => {
  const sys = translateSystem('Kannada');
  assert(/Kannada/.test(sys) && /Keep every number/.test(sys) && /exactly as many entries/.test(sys) && /which option is correct/.test(sys));
});

console.log('\n' + passed + ' checks passed');
