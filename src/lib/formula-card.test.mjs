// Run: node --import ./tools/ts-resolve.mjs src/lib/formula-card.test.mjs
//
// The formula card: the maths parser, and the rules a sheet is held to.

import assert from 'node:assert/strict';
import {
  columnsFor, formulaHoldSeconds, isTall, mathWidth, MAX_CARDS, parseMath, tidySheet,
} from './formula-card.ts';

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

/** The parse tree as a compact string, to compare by eye. */
const show = (nodes) => nodes.map((n) => {
  if (n.t === 'text') return n.style === 'var' ? n.s : n.style + ':' + n.s;
  if (n.t === 'frac') return 'frac(' + show(n.num) + ' / ' + show(n.den) + ')';
  if (n.t === 'sqrt') return 'sqrt(' + show(n.body) + ')';
  return (n.base ? show([n.base]) : '') + (n.sub ? '_(' + show(n.sub) + ')' : '') + (n.sup ? '^(' + show(n.sup) + ')' : '');
}).join(' ');

console.log('\nthe maths');

test('the formulas from the reference sheet all parse as they should', () => {
  assert.equal(show(parseMath('v = V_0 \\sin(\\omega t)')), 'v op:= V_(num:0) word:sin sym:( ω t sym:)');
  assert.equal(show(parseMath('\\omega = 2\\pi f')), 'ω op:= num:2 π f');
  assert.equal(show(parseMath('V_{rms} = \\frac{V_0}{\\sqrt{2}}')), 'V_(word:rms) op:= frac(V_(num:0) / sqrt(num:2))');
  assert.equal(show(parseMath('P = V_{rms} I_{rms} \\cos\\phi')), 'P op:= V_(word:rms) I_(word:rms) word:cos φ');
});

test('both scripts on one base, in either order', () => {
  assert.equal(show(parseMath('I_0^2 R')), 'I_(num:0)^(num:2) R');
  assert.equal(show(parseMath('I^2_0')), 'I_(num:0)^(num:2)');
});

test('plain typed formulas, with no LaTeX, still come out right', () => {
  assert.equal(show(parseMath('I = V / (R1 + R2)')), 'I op:= V sym:/ sym:( R num:1 op:+ R num:2 sym:)');
  assert.equal(show(parseMath('a - b * c')), 'a op:− b op:· c');
});

test('text, operators, symbols and upright capital Greek', () => {
  assert.equal(show(parseMath('X_L = 2\\pi f L \\;\\Omega')), 'X_(L) op:= num:2 π f L sym:Ω');
  assert.equal(show(parseMath('P \\approx \\text{power factor}')), 'P op:≈ word:power factor');
  assert.equal(show(parseMath('\\left( a \\right)')), 'sym:( a sym:)');
});

test('a unit after a thin space is upright, not a variable', () => {
  assert.equal(show(parseMath('= 230\\,V')), 'op:= num:230 word:V');
  assert.equal(show(parseMath('V = 2')), 'V op:= num:2', 'a plain V stays a quantity');
});

test('the worked solution keeps its lines, trimmed and at most six', () => {
  const one = { name: 'x', formula: 'a = b', notes: [], graph: { kind: 'none' }, icon: '' };
  const s = tidySheet({ cards: [one], working: [' a = b ', '', '= c', ...Array(8).fill('= d')] });
  assert.equal(s.working[0], 'a = b');
  assert.equal(s.working.length, 6);
  assert.equal(tidySheet({ cards: [one] }).working, undefined, 'an empty working was kept');
});

test('nothing it does not know is ever dropped', () => {
  assert.equal(show(parseMath('\\mystery{x}')), 'word:mystery x');
  assert.equal(show(parseMath('a }} b')), 'a b');
  assert.doesNotThrow(() => parseMath('\\frac{'));
  assert.doesNotThrow(() => parseMath('x^'));
  assert.deepEqual(parseMath(''), []);
});

test('a fraction makes a formula tall; its width is its wider half', () => {
  assert.ok(isTall(parseMath('\\frac{a}{b}')));
  assert.ok(!isTall(parseMath('a + b')));
  const wide = mathWidth(parseMath('\\frac{V_0 + V_1 + V_2}{2}'));
  const narrow = mathWidth(parseMath('\\frac{V}{2}'));
  assert.ok(wide > narrow * 2, wide + ' vs ' + narrow);
});

console.log('\nthe sheet');

const card = (extra = {}) => ({
  name: 'RMS Voltage', formula: 'V_{rms} = \\frac{V_0}{\\sqrt{2}}', notes: ['V_0 = peak voltage'],
  graph: { kind: 'rms', x: 't', y: 'v', label: 'V_{rms}', label2: '' }, icon: 'multimeter', ...extra,
});

test('a sheet keeps its cards and fills in what is missing', () => {
  const s = tidySheet({ cards: [card({ graph: undefined, notes: undefined })] });
  assert.equal(s.title, 'Important Formulas');
  assert.equal(s.cards[0].graph.kind, 'none');
  assert.deepEqual(s.cards[0].notes, []);
});

test('a card without a formula is dropped; no cards, no sheet', () => {
  assert.equal(tidySheet({ cards: [card({ formula: '  ' })] }), null);
  assert.equal(tidySheet(null), null);
  assert.equal(tidySheet({ title: 'x', cards: [card(), card({ formula: '' })] }).cards.length, 1);
});

test('a formula too long for a card is dropped, never cut short', () => {
  const long = 'V = ' + 'a + '.repeat(40) + 'b';
  assert.equal(tidySheet({ cards: [card({ formula: long })] }), null);
});

test('at most six cards, two notes each, and a graph from the list only', () => {
  const s = tidySheet({ cards: Array.from({ length: 9 }, () => card({ notes: ['a', 'b', 'c'], graph: { kind: 'spiral' } })) });
  assert.equal(s.cards.length, MAX_CARDS);
  assert.equal(s.cards[0].notes.length, 2);
  assert.equal(s.cards[0].graph.kind, 'none');
});

test('the icon drawing the server found is kept', () => {
  const s = tidySheet({ cards: [card({ art: { body: '<path d="M0 0"/>', width: 24, height: 24 } })] });
  assert.equal(s.cards[0].art.width, 24);
});

test('long enough to read every card, and nothing for no cards', () => {
  assert.equal(formulaHoldSeconds(0), 0);
  assert.ok(formulaHoldSeconds(6) >= 12, 'six cards in ' + formulaHoldSeconds(6) + 's');
  assert.ok(formulaHoldSeconds(9) === formulaHoldSeconds(6), 'counted cards past the limit');
});

test('one column on a phone, two on a wide frame, and on a crowded square', () => {
  assert.equal(columnsFor(6, 1000, 1700), 1);
  assert.equal(columnsFor(6, 1800, 900), 2);
  assert.equal(columnsFor(3, 900, 780), 1);
  assert.equal(columnsFor(5, 900, 780), 2);
  assert.equal(columnsFor(1, 1800, 900), 1);
});

console.log('\n' + passed + ' checks passed\n');
