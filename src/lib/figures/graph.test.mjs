// Graphs: the evaluator is safe and right, and every answer read off a curve
// is the textbook one.
import { area, compile, extreme, roots, slope } from './expression.ts';
import { answerGraph, graphAskText, layoutGraph, niceTicks, normalizeGraph } from './graph.ts';
import { checkFigure, isSetupSafe, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const throws = (src, variable = 'x') => { try { compile(src, variable); return false; } catch { return true; } };

// --- the evaluator ---------------------------------------------------------------------
ok('precedence: 2 + 3 * 4 = 14', compile('2 + 3 * 4')(0) === 14);
ok('powers bind tighter than minus: -x^2 at 3 is -9', compile('-x^2')(3) === -9);
ok('powers are right-associative: 2^3^2 = 512', compile('2^3^2')(0) === 512);
ok('implied multiplication: 2x at 5 is 10', compile('2x')(5) === 10);
ok('implied multiplication: 3(x+1) at 1 is 6', compile('3(x+1)')(1) === 6);
ok('constants: 2pi', near(compile('2pi')(0), 2 * Math.PI));
ok('functions: sin(pi/2) = 1', near(compile('sin(pi/2)')(0), 1));
ok('degrees: sind(30) = 0.5', near(compile('sind(30)')(0), 0.5));
ok('ln and exp', near(compile('ln(exp(x))')(2.5), 2.5));
ok('another variable name', compile('5*exp(-t/0.5)', 't')(0) === 5);
ok('scientific notation in a formula', compile('2e3 * x')(1) === 2000);
ok('the × and − signs a model may type', compile('3×x − 1')(2) === 5);
ok('refuses a statement', throws('x; alert(1)'));
ok('refuses an unknown name', throws('process.exit()'));
ok('refuses Object.prototype names as constants', throws('constructor') && throws('__proto__') && throws('valueOf'));
ok('refuses Object.prototype names as functions', throws('toString(x)') && throws('hasOwnProperty(x)'));
ok('refuses the wrong variable', throws('y + 1', 'x'));
ok('refuses an unclosed bracket', throws('(x + 1'));
ok('refuses a function with the wrong number of values', throws('min(x)'));
ok('refuses a formula that is too long', throws('x+'.repeat(120) + 'x'));
ok('refuses brackets used for indexing', throws('x[0]'));

ok('roots of x² - 4x + 3 are 1 and 3', JSON.stringify(roots(compile('x^2 - 4x + 3'), -10, 10).map((r) => Math.round(r * 1e6) / 1e6)) === '[1,3]');
ok('a pole is not a root: 1/x on [-1, 1]', roots(compile('1/x'), -1, 1).length === 0);
ok('maximum of -x² + 4x is 4 at 2', (() => { const e = extreme(compile('-x^2 + 4x'), 0, 5, 'max'); return near(e.x, 2) && near(e.y, 4); })());
ok('slope of x² at 3 is 6', near(slope(compile('x^2'), 3, 10), 6));
ok('area under 2x from 0 to 3 is 9', near(area(compile('2x'), 0, 3), 9));

// --- textbook answers -------------------------------------------------------------------
const graph = (raw) => {
  const r = normalizeGraph({ type: 'graph', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};
// RC charging to 10 V, τ = 2 s.
const rc = graph({
  variable: 't', x: { label: 'time', unit: 's', min: 0, max: 10 }, y: { label: 'Vc', unit: 'V' },
  curves: [{ id: 'vc', label: 'Vc', formula: '10*(1-exp(-t/2))' }],
  points: [{ label: 'τ', x: 2, curve: 'vc' }], asymptotes: [{ y: 10, label: '10 V' }],
  ask: { kind: 'value', curve: 'vc', x: 2 },
});
ok('RC: after one time constant the capacitor is at 63.2% - 6.32 V', near(answerGraph(rc).value, 6.3212));
ok('checks against "6.32 V"', checkFigure(rc, '6.32 V').status === 'match');
ok('and not against "5 V"', checkFigure(rc, '5 V').status === 'mismatch');
ok('RC: half-way (5 V) at t = τ ln 2 = 1.386 s', near(answerGraph({ ...rc, ask: { kind: 'root', curve: 'vc', target: 5 } }).value, 2 * Math.log(2)));
ok('the answer line reads naturally', graphAskText(rc, true) === 'Vc at t = 2 s = 6.32 V', graphAskText(rc, true));
ok('before the reveal, "?"', graphAskText(rc, false) === 'Vc at t = 2 s = ?');

// RL decay: i = 5 e^(-t/0.5).
const rl = graph({ variable: 't', x: { unit: 's', min: 0, max: 3 }, y: { unit: 'A' }, curves: [{ id: 'i', formula: '5*exp(-t/0.5)' }], ask: { kind: 'value', curve: 'i', x: 0.5 } });
ok('RL: after one time constant the current has fallen to 36.8% - 1.84 A', near(answerGraph(rl).value, 1.8394));

// Maximum power transfer: P = V² RL / (RS + RL)², V = 10, RS = 5.
const mpt = graph({ variable: 'R', x: { label: 'RL', unit: 'Ω', min: 0.1, max: 30 }, y: { label: 'P', unit: 'W' },
  curves: [{ id: 'p', label: 'P', formula: '100*R/(5+R)^2' }], ask: { kind: 'maxAt', curve: 'p' } });
ok('maximum power transfer: at RL = RS = 5 Ω', near(answerGraph(mpt).value, 5, 1e-3));
ok('and that maximum is V²/4RS = 5 W', near(answerGraph({ ...mpt, ask: { kind: 'maxValue', curve: 'p' } }).value, 5));

// Supply meets demand.
const market = graph({ x: { label: 'quantity', unit: '', min: 0, max: 50 }, y: { label: 'price', unit: '' },
  curves: [{ id: 'd', label: 'Demand', formula: '100 - 2x' }, { id: 's', label: 'Supply', formula: '20 + 2x' }],
  ask: { kind: 'intersection', curves: ['d', 's'] } });
ok('supply meets demand at 20 units', near(answerGraph(market).value, 20));

// Compound growth: 1000 at 10% for 3 years.
const ci = graph({ variable: 'n', x: { label: 'years', unit: '', min: 0, max: 5 }, y: { label: 'amount', unit: '' }, curves: [{ id: 'a', formula: '1000*1.1^n' }], ask: { kind: 'value', curve: 'a', x: 3 } });
ok('₹1000 at 10% compound for 3 years is ₹1331', near(answerGraph(ci).value, 1331));

// Quadratic with two roots in range has no single answer; narrowed, it has one.
const quad = { x: { min: -10, max: 10 }, y: {}, curves: [{ id: 'q', formula: 'x^2 - 4x + 3' }] };
ok('a root question with two roots in range is refused', normalizeGraph({ ...quad, ask: { kind: 'root', curve: 'q' } }).figure === null);
ok('on a range holding one root, it is answered', near(answerGraph(graph({ ...quad, x: { min: 0, max: 2 }, ask: { kind: 'root', curve: 'q' } })).value, 1));
ok('slope of x² - 4x + 3 at x = 3 is 2', near(answerGraph(graph({ ...quad, ask: { kind: 'slope', curve: 'q', x: 3 } })).value, 2));
ok('area under x² from 0 to 3 is 9', near(answerGraph(graph({ x: { min: 0, max: 3 }, y: {}, curves: [{ id: 'q', formula: 'x^2' }], ask: { kind: 'area', curve: 'q', from: 0, to: 3 } })).value, 9));

// --- refusals ----------------------------------------------------------------------------
const refused = (label, raw, pattern) => {
  const r = normalizeGraph({ type: 'graph', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('a formula that is not maths', { x: { min: 0, max: 1 }, y: {}, curves: [{ id: 'c', formula: 'fetch(x)' }] }, /not a function/);
refused('an x range backwards', { x: { min: 5, max: 1 }, y: {}, curves: [{ id: 'c', formula: 'x' }] }, /min below max/);
refused('a curve with nothing to draw in range', { x: { min: -5, max: -1 }, y: {}, curves: [{ id: 'c', formula: 'sqrt(x)' }] }, /no drawable values/);
refused('a point outside the range', { x: { min: 0, max: 1 }, y: {}, curves: [{ id: 'c', formula: 'x' }], points: [{ x: 5 }] }, /outside the x range/);
refused('a value asked outside the range', { x: { min: 0, max: 1 }, y: {}, curves: [{ id: 'c', formula: 'x' }], ask: { kind: 'value', x: 3 } }, /inside the range/);
refused('a question about a missing curve', { x: { min: 0, max: 1 }, y: {}, curves: [{ id: 'c', formula: 'x' }], ask: { kind: 'maxValue', curve: 'zz' } }, /does not exist/);

// --- drawing ------------------------------------------------------------------------------
ok('ticks 0..10 step 2', JSON.stringify(niceTicks(0, 10)) === '[0,2,4,6,8,10]', JSON.stringify(niceTicks(0, 10)));
ok('ticks 0..6.28 step 1', JSON.stringify(niceTicks(0, 6.28)) === '[0,1,2,3,4,5,6]', JSON.stringify(niceTicks(0, 6.28)));
ok('ticks -1..1 include zero exactly', niceTicks(-1, 1).includes(0));
ok('ticks for 0..0.02 s', niceTicks(0, 0.02).length >= 4 && niceTicks(0, 0.02).length <= 9, JSON.stringify(niceTicks(0, 0.02)));
const L = layoutGraph(rc, 940, 700, 36);
ok('RC y range starts at zero and clears the 10 V asymptote', L.yRange[0] === 0 && L.yRange[1] >= 10);
ok('the τ point sits on the curve, inside the plot', L.points[0].px >= L.plot.left && L.points[0].px <= L.plot.right && L.points[0].py >= L.plot.top && L.points[0].py <= L.plot.bottom);
ok('the τ point is drawn at 6.32 V', near(L.points[0].y, 6.3212));
const pole = layoutGraph(graph({ x: { min: -1, max: 1 }, y: { min: -10, max: 10 }, curves: [{ id: 'h', formula: '1/x' }] }), 900, 600, 36);
ok('1/x is drawn as two pieces, not joined across the pole', pole.paths[0].runs.length === 2, String(pole.paths[0].runs.length));
ok('every drawn point is inside the plot', pole.paths[0].runs.flat().every(([px, py]) => py >= pole.plot.top - 1 && py <= pole.plot.bottom + 1));

const clearOfCurves = (layout) => layout.points.every((pt) => !layout.paths.flatMap((p) => p.runs.flat())
  .some(([cx, cy]) => cx > pt.label.box.x1 && cx < pt.label.box.x2 && cy > pt.label.box.y1 && cy < pt.label.box.y2));
ok('the τ label does not sit on the RC curve', clearOfCurves(L));
// The first fix passed on a similar graph and still failed on the render: two
// lines crossing at a shallow angle cover every spot beside the point. These
// are the rendered figure's exact range and box.
const market40 = graph({ variable: 'q', x: { label: 'quantity', unit: '', min: 0, max: 40 }, y: { label: 'price', unit: '' },
  curves: [{ id: 'd', label: 'Demand', formula: '100 - 2q' }, { id: 's', label: 'Supply', formula: '20 + 2q' }],
  points: [{ label: 'equilibrium', x: 20, curve: 'd' }], ask: { kind: 'intersection', curves: ['d', 's'] } });
for (const [label, w, h, font] of [['landscape', 1620, 620 - 32 * 3.4, 32], ['portrait', 940, 940 - 36 * 3.4, 36]]) {
  const ML = layoutGraph(market40, w, h, font);
  ok(label + ': the equilibrium label found a clear spot', ML.points[0].label.clear);
  ok(label + ': and it does not sit on either line', clearOfCurves(ML));
}
ok('the τ label found a clear spot', L.points[0].label.clear);

// --- never on the question scene ------------------------------------------------------------
ok('a graph is not setup-safe', !isSetupSafe(rc));
ok('the registry reads a graph', normalizeFigure(JSON.stringify({ type: 'graph', x: { min: 0, max: 1 }, y: {}, curves: [{ formula: 'x' }] })).figure?.type === 'graph');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall graph checks passed');
process.exit(fails ? 1 : 0);
