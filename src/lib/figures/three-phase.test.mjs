// Balanced three-phase loads against worked examples, and the drawing's rows
// against the frame.
import {
  answerThreePhase, layoutThreePhase, normalizeThreePhase, solveThreePhase, threePhaseAskText, threePhaseRows,
} from './three-phase.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const load = (raw) => {
  const r = normalizeThreePhase({ type: 'three-phase', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};

// 415 V, 10 Ω resistive per phase.
const star = load({ connection: 'star', lineVoltage: '415 V', impedance: '10 Ω', powerFactor: 1 });
const s = solveThreePhase(star);
ok('star: phase voltage 239.6 V', near(s.Vph, 239.6));
ok('star: line current = phase current = 23.96 A', near(s.IL, 23.96) && near(s.Iph, 23.96));
ok('star: 17.22 kW', near(s.P, 17222, 2e-3), s.P.toFixed(0));
const delta = load({ connection: 'delta', lineVoltage: '415 V', impedance: '10 Ω', powerFactor: 1 });
const d = solveThreePhase(delta);
ok('delta: phase voltage = line voltage = 415 V', near(d.Vph, 415));
ok('delta: phase current 41.5 A, line current 71.88 A', near(d.Iph, 41.5) && near(d.IL, 71.88));
ok('delta draws three times the power of star', near(d.P, 3 * s.P));
ok('the star load reconnected in delta: its otherP is the delta power', near(s.otherP, d.P));
ok('and back again', near(d.otherP, s.P));

// P = 10 kW at 0.8 pf on 400 V star: IL = 10000 / (√3 · 400 · 0.8) = 18.04 A.
const byPower = load({ connection: 'star', lineVoltage: '400 V', power: '10 kW', powerFactor: 0.8, ask: 'lineCurrent' });
ok('10 kW at 0.8 pf on 400 V: 18.04 A', near(answerThreePhase(byPower).value, 18.04), answerThreePhase(byPower).value.toFixed(3));
ok('checks against "18 A"', checkFigure(byPower, '18 A').status === 'match');
ok('and not "31.25 A" - the single-phase slip', checkFigure(byPower, '31.25 A').status === 'mismatch');

// R = 6, X = 8 per phase, star on 400 V: Z = 10, pf 0.6, Iph = 23.09, P = 3·I²R = 9.6 kW.
const rx = load({ connection: 'star', lineVoltage: '400 V', resistance: '6 Ω', reactance: '8 Ω', ask: 'power' });
ok('6 + j8 in star on 400 V: pf 0.6', near(rx.powerFactor, 0.6));
ok('and 9.6 kW, which is 3·I²R', near(answerThreePhase(rx).value, 9600, 2e-3) && near(answerThreePhase(rx).value, 3 * solveThreePhase(rx).Iph ** 2 * 6));
ok('from a phase voltage alone', near(solveThreePhase(load({ connection: 'star', phaseVoltage: '230 V', impedance: '23 Ω' })).VL, 398.4));
ok('from a line current in delta', near(load({ connection: 'delta', lineVoltage: '400 V', lineCurrent: '17.32 A' }).impedance, 40, 1e-3));

ok('the working says VL = 1.732 × Vph with the numbers', threePhaseRows(star, true)[1] === '415 V = 1.732 × 240 V', threePhaseRows(star, true)[1]);
ok('delta working says IL = 1.732 × Iph', threePhaseRows(delta, true)[1] === '71.9 A = 1.732 × 41.5 A', threePhaseRows(delta, true)[1]);
// Before the reveal the rows describe the situation only. The first delta
// render printed P = 51.7 kW on the question, which gives the line current away.
const qRows = threePhaseRows(load({ connection: 'delta', lineVoltage: '415 V', impedance: '10 Ω', ask: 'lineCurrent' }), false).join(' | ');
ok('question scene: no line current, phase current or power in the rows', !/A|W/.test(qRows), qRows);
ok('question scene: states the supply and the load', /Supply VL = 415 V/.test(qRows) && /Z = 10 Ω per phase/.test(qRows), qRows);
const askV = threePhaseRows(load({ connection: 'star', phaseVoltage: '230 V', impedance: '23 Ω', ask: 'lineVoltage' }), false).join(' | ');
ok('asking the line voltage: shows the phase voltage and VL = ?', /Vph = 230 V/.test(askV) && /VL = \?/.test(askV), askV);
ok('the footer names the reconnection', threePhaseAskText({ ...star, ask: 'otherConnectionPower' }, true) === 'Power if reconnected in delta = 51.7 kW');

const refused = (label, raw, pattern) => {
  const r = normalizeThreePhase({ type: 'three-phase', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('no connection', { lineVoltage: '415 V', impedance: '10 Ω' }, /star.*delta/);
refused('star with VL = Vph claimed', { connection: 'star', lineVoltage: '415 V', phaseVoltage: '415 V', impedance: '10 Ω' }, /√3 times/);
refused('no voltage', { connection: 'star', impedance: '10 Ω' }, /lineVoltage or the phaseVoltage/);
refused('no load', { connection: 'delta', lineVoltage: '415 V' }, /describe the load/);
refused('a current and an impedance that disagree', { connection: 'star', lineVoltage: '415 V', impedance: '10 Ω', lineCurrent: '40 A' }, /do not agree/);
refused('power without a power factor', { connection: 'star', lineVoltage: '415 V', power: '10 kW' }, /needs a powerFactor/);
refused('an impedance in volts', { connection: 'star', lineVoltage: '415 V', impedance: '10 V' }, /impedance must be/);
ok('the registry reads it', normalizeFigure('{"type":"three-phase","connection":"delta","lineVoltage":"400 V","impedance":"20 Ω"}').figure?.type === 'three-phase');

// --- layout ------------------------------------------------------------------------
for (const [frame, w, h, font] of [['portrait', 940, 940 - 36 * 2.1, 36], ['landscape', 1620, 620 - 32 * 2.1, 32]]) {
  for (const t of [star, delta]) {
    const rows = threePhaseRows(t, true);
    const L = layoutThreePhase(t, w, h, font, rows.length);
    const lastRow = L.rowsTop + (rows.length - 1) * font * 1.35;
    ok(frame + ' ' + t.connection + ': the working fits under the drawing', lastRow + font * 0.3 <= h, lastRow.toFixed(0) + ' / ' + h);
    const inside = L.terminals.every((p) => p.outer.x > 0 && p.outer.x < w && p.outer.y > 0 && p.outer.y < L.rowsTop - font);
    ok(frame + ' ' + t.connection + ': terminals clear of the working and inside the frame', inside);
    const widest = Math.max(...rows.map((r) => r.length)) * font * 0.6;
    ok(frame + ' ' + t.connection + ': the widest row fits across', widest <= w, widest.toFixed(0));
  }
}
const SL = layoutThreePhase(star, 900, 800, 36, 4);
ok('star: every impedance runs from the neutral', SL.impedances.every((z) => z.x1 === SL.centre.x && z.y1 === SL.centre.y));
const DL = layoutThreePhase(delta, 900, 800, 36, 4);
ok('delta: the impedances close a triangle through the terminals',
   DL.impedances.every((z, k) => { const n = DL.impedances[(k + 1) % 3]; return near(z.x2, n.x1, 1e-9) && near(z.y2, n.y1, 1e-9); }));
ok('R is at the top', SL.terminals[0].name === 'R' && SL.terminals[0].terminal.y < SL.centre.y);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall three-phase checks passed');
process.exit(fails ? 1 : 0);
