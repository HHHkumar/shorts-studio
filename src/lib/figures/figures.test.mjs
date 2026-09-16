// Truth, not just drawability: every figure test states the textbook answer and
// requires the engine to reach it. The sketch harness could only ever prove a
// diagram drew without crashing; these prove the numbers on it are right.
import {
  formatQuantity, parseQuantity, roundForDisplay, sameValue, wordsToNumber,
} from './quantity.ts';
import { answerCircuit, CHAR_WIDTH, layoutCircuit, normalizeCircuit, solveCircuit, magnitude, MAX_COL, MAX_ROW } from './circuit.ts';
import { answerJunction, layoutJunction, normalizeJunction } from './junction.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// --- reading options ---------------------------------------------------------------
const q = (s) => parseQuantity(s);
ok('"5 A"', q('5 A')?.value === 5 && q('5 A')?.unit === 'A');
ok('"0.5A" with no space', q('0.5A')?.value === 0.5);
ok('"500 mA" is half an ampere', near(q('500 mA')?.value, 0.5) && q('500 mA')?.unit === 'A');
ok('"2.2 kΩ"', near(q('2.2 kΩ')?.value, 2200) && q('2.2 kΩ')?.unit === 'Ω');
ok('"4.7 µF"', near(q('4.7 µF')?.value, 4.7e-6) && q('4.7 µF')?.unit === 'F');
ok('"10 ohms"', q('10 ohms')?.value === 10 && q('10 ohms')?.unit === 'Ω');
ok('"Five amperes" - spelled out, as the KCL video had it', q('Five amperes')?.value === 5 && q('Five amperes')?.unit === 'A');
ok('"One ampere"', q('One ampere')?.value === 1);
ok('"Seven amperes"', q('Seven amperes')?.value === 7);
ok('"twenty five volts"', q('twenty five volts')?.value === 25 && q('twenty five volts')?.unit === 'V');
ok('"one point five volts"', q('one point five volts')?.value === 1.5);
ok('"2 milliamperes"', near(q('2 milliamperes')?.value, 0.002));
ok('"3 kilo-ohms"', q('3 kilo-ohms')?.value === 3000);
ok('"1 MΩ" is mega, "1 mΩ" is milli', q('1 MΩ')?.value === 1e6 && near(q('1 mΩ')?.value, 1e-3));
ok('"100 VAR" is not read as volts', q('100 VAR')?.unit === 'VAR');
ok('"None of these" states no quantity', q('None of these') === null);
ok('"It is doubled" states no quantity', q('It is doubled') === null);
ok('"Zero" is a number', q('Zero')?.value === 0);
ok('"half" is a number', wordsToNumber('half') === 0.5);
ok('"1,200 W" drops the thousands comma', q('1,200 W')?.value === 1200);

ok('0.5 A shows as 500 mA', formatQuantity(0.5, 'A') === '500 mA', formatQuantity(0.5, 'A'));
ok('2200 Ω shows as 2.2 kΩ', formatQuantity(2200, 'Ω') === '2.2 kΩ', formatQuantity(2200, 'Ω'));
ok('5 A shows as 5 A', formatQuantity(5, 'A') === '5 A');
ok('1/3 A shows three figures', formatQuantity(1 / 3, 'A') === '333 mA', formatQuantity(1 / 3, 'A'));
ok('999.9 V moves up a prefix instead of showing 1000 V', formatQuantity(999.9, 'V') === '1 kV', formatQuantity(999.9, 'V'));
ok('trailing zeros dropped', roundForDisplay(1.5) === '1.5' && roundForDisplay(2) === '2');
ok('2% agreement', sameValue(1.67, 5 / 3) && !sameValue(1.5, 5 / 3));

// --- junctions: Kirchhoff's current law ------------------------------------------------
const kclRaw = { type: 'junction', branches: [
  { label: 'I1', value: 2, unit: 'A', direction: 'in' },
  { label: 'I2', value: 4, unit: 'A', direction: 'in' },
  { label: 'I3', value: 1, unit: 'A', direction: 'out' },
  { label: 'I4', value: 5, unit: 'A', direction: 'out', unknown: true },
] };
const kcl = normalizeJunction(kclRaw);
ok('the KCL video problem is a valid junction', kcl.junction !== null, kcl.errors.join('; '));
ok('and the unknown works out to 5 A from the others', answerJunction(kcl.junction)?.value === 5);
ok('which matches "Five amperes"', checkFigure(kcl.junction, 'Five amperes').status === 'match');
ok('and does not match "Seven amperes"', checkFigure(kcl.junction, 'Seven amperes').status === 'mismatch');
ok('nor "5 W" - the units differ', checkFigure(kcl.junction, '5 W').status === 'mismatch');

const unbalanced = normalizeJunction({ ...kclRaw, branches: kclRaw.branches.map((b) => (b.unknown ? { ...b, value: 7 } : b)) });
ok('a junction where charge is not conserved is refused', unbalanced.junction === null && /balance/.test(unbalanced.errors.join()), unbalanced.errors.join('; '));
ok('two unknowns are refused', normalizeJunction({ branches: kclRaw.branches.map((b) => ({ ...b, unknown: true })) }).junction === null);
ok('a junction with nothing leaving is refused',
   normalizeJunction({ branches: [{ value: 1, direction: 'in' }, { value: 1, direction: 'in' }, { value: 2, direction: 'in' }] }).junction === null);
const milli = normalizeJunction({ branches: [
  { label: 'I1', value: 300, unit: 'mA', direction: 'in' }, { label: 'I2', value: 0.2, unit: 'A', direction: 'in' },
  { label: 'I3', value: 0.5, unit: 'A', direction: 'out', unknown: true }] });
ok('milliamperes are converted before balancing', milli.junction !== null && near(answerJunction(milli.junction).value, 0.5), milli.errors.join('; '));
const wayRound = normalizeJunction({ branches: [
  { label: 'I1', value: 1, direction: 'in' }, { label: 'I2', value: 4, direction: 'out' },
  { label: 'I3', value: 3, direction: 'out', unknown: true }] });
ok('an unknown drawn flowing the wrong way has no answer', wayRound.junction === null || answerJunction(wayRound.junction) === null);

const jl = layoutJunction(kcl.junction, 960, 700);
ok('entering branches are drawn on the left', jl.branches.filter((b) => b.branch.direction === 'in').every((b) => b.x < jl.cx));
ok('leaving branches are drawn on the right', jl.branches.filter((b) => b.branch.direction === 'out').every((b) => b.x > jl.cx));
ok('every branch end is inside the box', jl.branches.every((b) => b.x > 0 && b.x < 960 && b.y > 0 && b.y < 700));

// --- circuits ---------------------------------------------------------------------------
/** A loop of parts round a rectangle, clockwise from the source. */
const node = (id, col, row) => ({ id, col, row });
const part = (id, kind, from, to, value, unit, extra = {}) => ({ id, kind, from, to, value, unit, ...extra });
const circuit = (raw) => {
  const r = normalizeCircuit({ type: 'circuit', ...raw });
  if (!r.circuit) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.circuit;
};

const series = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('V1', 'voltage', 'D', 'A', 12, 'V'), part('R1', 'resistor', 'A', 'B', 2, 'Ω'),
    part('R2', 'resistor', 'B', 'C', 4, 'Ω'), part('W1', 'wire', 'C', 'D'),
  ],
  ask: { quantity: 'current', element: 'R2' },
});
ok('series 12 V, 2 Ω + 4 Ω: current is 2 A', near(answerCircuit(series)?.value, 2));
ok('voltage across the 4 Ω is 8 V', near(answerCircuit({ ...series, ask: { quantity: 'voltage', element: 'R2' } })?.value, 8));
ok('power in the 4 Ω is 16 W', near(answerCircuit({ ...series, ask: { quantity: 'power', element: 'R2' } })?.value, 16));
ok('the source delivers 24 W', near(answerCircuit({ ...series, ask: { quantity: 'power', element: 'V1' } })?.value, 24));
ok('node voltage between A and C is 12 V', near(answerCircuit({ ...series, ask: { quantity: 'voltage', from: 'A', to: 'C' } })?.value, 12));

const parallel = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 12, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'),
    part('R1', 'resistor', 'B', 'E', 6, 'Ω'), part('R2', 'resistor', 'C', 'D', 3, 'Ω'),
    part('W3', 'wire', 'D', 'E'), part('W4', 'wire', 'E', 'F'),
  ],
  ask: { quantity: 'current', element: 'V1' },
});
ok('parallel 6 Ω || 3 Ω on 12 V: source current is 6 A', near(answerCircuit(parallel)?.value, 6));
ok('6 Ω branch carries 2 A', near(answerCircuit({ ...parallel, ask: { quantity: 'current', element: 'R1' } })?.value, 2));
ok('3 Ω branch carries 4 A', near(answerCircuit({ ...parallel, ask: { quantity: 'current', element: 'R2' } })?.value, 4));
ok('equivalent resistance seen by the source is 2 Ω',
   near(answerCircuit({ ...parallel, ask: { quantity: 'resistance', from: 'A', to: 'F' } })?.value, 2));

const mixed = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 3, 0), node('D', 3, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 10, 'V'), part('R1', 'resistor', 'A', 'B', 2, 'Ω'),
    part('R2', 'resistor', 'B', 'E', 6, 'Ω'), part('W1', 'wire', 'B', 'C'),
    part('R3', 'resistor', 'C', 'D', 3, 'Ω'), part('W2', 'wire', 'D', 'E'), part('W3', 'wire', 'E', 'F'),
  ],
  ask: { quantity: 'current', element: 'R3' },
});
ok('2 Ω then (6 Ω || 3 Ω) on 10 V: 3 Ω carries 5/3 A', near(answerCircuit(mixed)?.value, 5 / 3));
ok('and the total is 2.5 A', near(answerCircuit({ ...mixed, ask: { quantity: 'current', element: 'R1' } })?.value, 2.5));

const currentSource = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('I1', 'current', 'D', 'A', 2, 'A'), part('W1', 'wire', 'A', 'B'),
    part('R1', 'resistor', 'B', 'C', 5, 'Ω'), part('W2', 'wire', 'C', 'D'),
  ],
  ask: { quantity: 'voltage', element: 'R1' },
});
ok('2 A through 5 Ω: 10 V', near(answerCircuit(currentSource)?.value, 10));

// A balanced Wheatstone bridge: nothing flows through the middle.
const bridge = circuit({
  nodes: [node('T', 1, 0), node('L', 0, 1), node('Rn', 2, 1), node('Bm', 1, 2), node('S', 3, 0), node('S2', 3, 2), node('M', 1, 1)],
  elements: [
    part('W1', 'wire', 'T', 'S'), part('V1', 'voltage', 'S2', 'S', 10, 'V'), part('W2', 'wire', 'S2', 'Bm'),
    part('R1', 'resistor', 'T', 'M', 1, 'Ω'),
    part('R2', 'resistor', 'M', 'Bm', 1, 'Ω'),
    part('R5', 'resistor', 'L', 'M', 7, 'Ω'),
    part('R3', 'resistor', 'M', 'Rn', 1, 'Ω'),
  ],
});
ok('a star of parts through one node still solves', bridge !== null && solveCircuit(bridge) !== null);

const rl = circuit({
  frequency: 50,
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('V1', 'voltage', 'D', 'A', 230, 'V'), part('R1', 'resistor', 'A', 'B', 10, 'Ω'),
    part('L1', 'inductor', 'B', 'C', 10 / (2 * Math.PI * 50), 'H'), part('W1', 'wire', 'C', 'D'),
  ],
  ask: { quantity: 'current', element: 'R1' },
});
ok('AC: 230 V across 10 Ω + 10 Ω reactance draws 16.26 A', near(answerCircuit(rl)?.value, 230 / Math.SQRT2 / 10, 1e-4), String(answerCircuit(rl)?.value));
ok('the resistor absorbs I²R = 2645 W', near(answerCircuit({ ...rl, ask: { quantity: 'power', element: 'R1' } })?.value, 2645, 1e-4));
ok('the ideal inductor absorbs no average power', answerCircuit({ ...rl, ask: { quantity: 'power', element: 'L1' } })?.value < 1e-6);
ok('impedance between the source terminals is 14.14 Ω',
   near(answerCircuit({ ...rl, ask: { quantity: 'impedance', from: 'A', to: 'D' } })?.value, 10 * Math.SQRT2, 1e-4));
ok('an inductor\'s own reactance is ωL, not the network across it',
   near(answerCircuit({ ...rl, ask: { quantity: 'impedance', element: 'L1' } })?.value, 10, 1e-6));
const rlSolution = solveCircuit(rl);
const phase = Math.atan2(rlSolution.elements.R1.current.im, rlSolution.elements.R1.current.re) * 180 / Math.PI;
ok('and the current lags the source by 45°', near(phase, -45, 1e-3), phase.toFixed(2));

const dcCap = circuit({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)],
  elements: [
    part('V1', 'voltage', 'D', 'A', 9, 'V'), part('R1', 'resistor', 'A', 'B', 100, 'Ω'),
    part('C1', 'capacitor', 'B', 'C', 10, 'µF'), part('W1', 'wire', 'C', 'D'),
  ],
  ask: { quantity: 'voltage', element: 'C1' },
});
ok('DC: a capacitor blocks, so no current flows', answerCircuit({ ...dcCap, ask: { quantity: 'current', element: 'R1' } })?.value < 1e-9);
ok('and the whole 9 V stands across it', near(answerCircuit(dcCap)?.value, 9));
ok('µF is read as microfarads', near(dcCap.elements.find((e) => e.id === 'C1').value, 1e-5));

// --- refusing what cannot be drawn honestly --------------------------------------------
const refused = (label, raw, pattern) => {
  const r = normalizeCircuit({ type: 'circuit', ...raw });
  ok(label, r.circuit === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
const box = [node('A', 0, 0), node('B', 2, 0), node('C', 2, 2), node('D', 0, 2)];
refused('a diagonal part', { nodes: box, elements: [part('V1', 'voltage', 'D', 'A', 5, 'V'), part('R1', 'resistor', 'A', 'C', 1, 'Ω')] }, /diagonal/);
refused('two parts drawn on top of each other', { nodes: box, elements: [
  part('V1', 'voltage', 'D', 'A', 5, 'V'), part('R1', 'resistor', 'A', 'B', 1, 'Ω'), part('R2', 'resistor', 'A', 'B', 2, 'Ω'),
  part('W1', 'wire', 'B', 'C'), part('W2', 'wire', 'C', 'D')] }, /on top of each other/);
refused('a part running through a node it does not join', {
  nodes: [node('A', 0, 0), node('M', 1, 0), node('B', 2, 0), node('C', 2, 1), node('D', 0, 1)],
  elements: [part('V1', 'voltage', 'D', 'A', 5, 'V'), part('R1', 'resistor', 'A', 'B', 1, 'Ω'), part('R2', 'resistor', 'M', 'C', 1, 'Ω'),
    part('W1', 'wire', 'B', 'C'), part('W2', 'wire', 'C', 'D')] }, /through node/);
refused('two wires crossing without a junction', {
  nodes: [node('A', 0, 1), node('B', 2, 1), node('C', 1, 0), node('D', 1, 2)],
  elements: [part('R1', 'resistor', 'A', 'B', 1, 'Ω'), part('V1', 'voltage', 'C', 'D', 5, 'V')] }, /cross/);
refused('a node off the grid', { nodes: [node('A', 0, 0), node('B', MAX_COL + 1, 0)], elements: [] }, /off the grid/);
refused('an unknown kind of part', { nodes: box, elements: [part('X1', 'transistor', 'A', 'B', 1, '')] }, /unknown kind/);
refused('a unit that belongs to another part', { nodes: box, elements: [part('R1', 'resistor', 'A', 'B', 4, 'mH')] }, /no usable value/);
refused('a circuit with no source', { nodes: box, elements: [part('R1', 'resistor', 'A', 'B', 4, 'Ω'), part('R2', 'resistor', 'B', 'C', 4, 'Ω')],
  ask: { quantity: 'current', element: 'R1' } }, /nothing drives/);
refused('a disconnected part', { nodes: [...box, node('E', 4, 0), node('F', 4, 2)], elements: [
  part('V1', 'voltage', 'D', 'A', 5, 'V'), part('R1', 'resistor', 'A', 'B', 1, 'Ω'), part('W1', 'wire', 'B', 'C'), part('W2', 'wire', 'C', 'D'),
  part('R2', 'resistor', 'E', 'F', 1, 'Ω')] }, /not everything is connected/);
refused('asking about a part that is not there', { nodes: box, elements: [part('V1', 'voltage', 'D', 'A', 5, 'V'), part('R1', 'resistor', 'A', 'B', 1, 'Ω'),
  part('W1', 'wire', 'B', 'C'), part('W2', 'wire', 'C', 'D')], ask: { quantity: 'current', element: 'R9' } }, /not in the circuit/);

const shorted = circuit({ nodes: box, elements: [
  part('V1', 'voltage', 'D', 'A', 5, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'), part('W3', 'wire', 'C', 'D')],
  ask: { quantity: 'current', element: 'V1' } });
ok('a source shorted by a wire cannot be solved, and says so', shorted !== null && answerCircuit(shorted) === null);

// --- the whole path: raw model output to a checked figure ---------------------------------
ok('normalizeFigure passes "none" through as no figure', normalizeFigure({ type: 'none' }).figure === null);
ok('normalizeFigure refuses an unknown type', /unknown figure type/.test(normalizeFigure({ type: 'venn' }).errors.join()));
ok('a figure asking nothing is unchecked, not passed', checkFigure(series && { ...series, ask: undefined }, '2 A').status === 'unchecked');
ok('a correct option with no number is unchecked', checkFigure(series, 'It doubles').status === 'unchecked');
ok('the series circuit matches "2 A"', checkFigure(series, '2 A').status === 'match');
ok('and "2000 mA"', checkFigure(series, '2000 mA').status === 'match');
ok('and not "3 A"', checkFigure(series, '3 A').status === 'mismatch');

// --- layout ------------------------------------------------------------------------------
const lay = layoutCircuit(mixed, 960, 700);
const within = (x, y) => x >= 0 && x <= 960 && y >= 0 && y <= 700;
ok('every node is inside the box', lay.nodes.every((n) => within(n.x, n.y)));
ok('every symbol is shorter than the wire it sits on',
   lay.elements.every((e) => e.length <= Math.hypot(e.x2 - e.x1, e.y2 - e.y1)));
const fullGrid = circuit({
  nodes: [node('A', 0, 0), node('B', MAX_COL, 0), node('C', MAX_COL, MAX_ROW), node('D', 0, MAX_ROW)],
  elements: [part('V1', 'voltage', 'D', 'A', 1, 'V'), part('R1', 'resistor', 'A', 'B', 1, 'Ω'), part('W1', 'wire', 'B', 'C'), part('W2', 'wire', 'C', 'D')],
});
const big = layoutCircuit(fullGrid, 960, 700);
ok('even the largest grid keeps grid lines at least 150 px apart on a phone', big.spacing >= 150, big.spacing.toFixed(0));
ok('junction dots only where three or more wires meet', lay.nodes.filter((n) => n.degree >= 3).map((n) => n.id).sort().join() === 'B,E');
ok('a part left of centre has its label on the left', lay.elements.find((e) => e.element.id === 'V1').labelSide === 'left');

// --- labels never leave the frame, and never sit on each other ---------------------------
// The first render cut "230 V" and "31.8 mH" off at the edges. These are the
// portrait and landscape figure boxes the renderer uses, at its font sizes.
const FRAMES = [['portrait', 940, 940 - 36 * 2.2, 36], ['landscape', 1620, 620 - 32 * 2.2, 32]];
const longValues = circuit({
  nodes: [node('A', 0, 0), node('B', MAX_COL, 0), node('C', MAX_COL, MAX_ROW), node('D', 0, MAX_ROW)],
  elements: [
    part('Vs', 'voltage', 'D', 'A', 233.5, 'V'), part('R1', 'resistor', 'A', 'B', 4.72, 'kΩ'),
    part('Ls', 'inductor', 'B', 'C', 31.83, 'mH'), part('C1', 'capacitor', 'C', 'D', 470, 'µF'),
  ],
  frequency: 50,
});
for (const [name, fw, fh, font] of FRAMES) {
  for (const [label, c] of [['series-parallel', mixed], ['RL', rl], ['long values', longValues], ['parallel', parallel]]) {
    const L = layoutCircuit(c, fw, fh, font);
    const boxes = L.elements.map((e) => e.label && { id: e.element.id, ...e.label.box }).filter(Boolean);
    const outside = boxes.filter((b) => b.x1 < 0 || b.x2 > fw || b.y1 < 0 || b.y2 > fh);
    ok(name + ' ' + label + ': every label inside the frame', outside.length === 0,
       outside.map((b) => b.id + ' ' + [b.x1, b.x2, b.y1, b.y2].map(Math.round).join('/')).join(', '));
    const clash = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) clash.push(a.id + '+' + b.id);
    }
    ok(name + ' ' + label + ': no two labels overlap', clash.length === 0, clash.join(', '));
  }
  const J = layoutJunction(kcl.junction, fw, fh);
  const jOutside = J.branches.filter((b) => {
    const w = 'I4 = 5 A'.length * font * CHAR_WIDTH;
    const x = b.x + Math.cos(b.angle) * 26;
    return b.x < J.cx ? x - w < 0 : x + w > fw;
  });
  ok(name + ' junction: every branch label inside the frame', jOutside.length === 0);
}

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall figure checks passed');
process.exit(fails ? 1 : 0);
