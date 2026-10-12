// Run: node server/formula-visual.test.mjs
//
// A formula on a card keeps its subscripts. Each case is a formula that went
// on screen in a real video with its braces showing.

import { normalizeContent, QUIZ_SYSTEM } from './gemini.mjs';
import { isNotation, mendFormula, parseMath } from '../src/lib/formula-card.ts';

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

const formulaOf = (formula) => normalizeContent(
  { question: 'q', options: ['a', 'b', 'c', 'd'], correctIndex: 0, script: [{ kind: 'explain', narration: 'n', visual: { kind: 'formula', formula } }] },
  { subject: 'S', topic: 'T', difficulty: 'D', intro: '' },
).script.find((s) => s.kind === 'explain').visual;

test('a formula keeps its underscores: they are subscripts, not markdown', () => {
  const v = formulaOf('P_{sc} = I_{sc}^2 \\times R_{eq}');
  assert(v.formula === 'P_{sc} = I_{sc}^2 \\times R_{eq}', 'came out as ' + v.formula);
  assert(formulaOf('$V_{rms} = V_0 / \\sqrt{2}$').formula === 'V_{rms} = V_0 / \\sqrt{2}', 'the dollar signs stayed, or more went');
});

test('a plain formula is left exactly as it was', () => {
  assert(formulaOf('F = m × a').formula === 'F = m × a');
  assert(formulaOf('1 Year = 365 x 24 = 8,760 hours').formula === '1 Year = 365 x 24 = 8,760 hours');
});

test('a formula is measured by how wide it sets, not by how long its markup is', () => {
  // Seventy characters of markup, and it sets no wider than "V = 230/1.41".
  const marked = 'V_{rms} = \\frac{V_{0}}{\\sqrt{2}} = \\frac{325}{\\sqrt{2}} = \\frac{325}{1.414} = 230\\,V';
  assert(marked.length > 64, 'the example is not longer than the plain limit, so it proves nothing');
  assert(formulaOf(marked).kind === 'formula', 'a formula that fits was dropped for its markup');
  assert(formulaOf('E = ' + 'x'.repeat(70)).kind === 'none', 'a plain formula too long for the card was kept');
  assert(formulaOf('a_{1} + '.repeat(24) + 'a_{25}').kind === 'none', 'a typeset formula too wide for the card was kept');
});

test('a saved formula that already lost its underscores is mended when it is drawn', () => {
  assert(mendFormula('V{sc}=30V, I{sc}=20A') === 'V_{sc}=30V, I_{sc}=20A', mendFormula('V{sc}=30V, I{sc}=20A'));
  assert(mendFormula('P{sc} = I{sc}^2 \\times R{eq}') === 'P_{sc} = I_{sc}^2 \\times R_{eq}');
  // The brace after a command is its argument, and is left alone.
  assert(mendFormula('\\frac{a}{b} + \\sqrt{2}') === '\\frac{a}{b} + \\sqrt{2}', mendFormula('\\frac{a}{b} + \\sqrt{2}'));
  assert(mendFormula('Z{eq} = \\frac{30}{20}') === 'Z_{eq} = \\frac{30}{20}');
  assert(mendFormula('V_{sc} = 30') === 'V_{sc} = 30', 'a formula that was right was changed');
});

test('what is typeset and what is plain text', () => {
  assert(isNotation('V_{sc}') && isNotation('x^2') && isNotation('\\frac{1}{2}'));
  assert(!isNotation('F = m × a') && !isNotation('v² = u² + 2as') && !isNotation(''));
  // The mended formula parses into a subscript, not into a run of braces.
  const nodes = parseMath(mendFormula('V{sc} = 30'));
  assert(JSON.stringify(nodes).includes('sub'), 'no subscript in ' + JSON.stringify(nodes));
});

test('the prompt shows the notation with its backslashes intact', () => {
  assert(QUIZ_SYSTEM.includes('\\frac{a}{b}') && QUIZ_SYSTEM.includes('\\sqrt{x}'), 'the model is being shown "rac{a}{b}"');
  assert(!/[\f\v\b]/.test(QUIZ_SYSTEM), 'a control character is in the prompt: an escape was eaten');
});

console.log('\n' + passed + ' checks passed');
