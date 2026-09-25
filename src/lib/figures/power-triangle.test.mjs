// The power triangle against worked textbook examples, and its labels against
// each other: none may overlap, and none may leave the frame.
import { answerTriangle, layoutTriangle, normalizeTriangle, solveTriangle, triangleAskText } from './power-triangle.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const tri = (raw) => {
  const r = normalizeTriangle({ type: 'power-triangle', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};

// --- the 3-4-5 triangle, from every pair --------------------------------------------------
for (const [label, raw] of [
  ['P and Q', { real: '8 kW', reactive: '6 kVAR' }],
  ['P and S', { real: '8 kW', apparent: '10 kVA' }],
  ['P and pf', { real: '8 kW', powerFactor: 0.8 }],
  ['S and pf', { apparent: '10 kVA', powerFactor: 0.8 }],
  ['Q and S', { reactive: '6 kVAR', apparent: '10 kVA' }],
  ['Q and pf', { reactive: '6 kVAR', powerFactor: 0.8 }],
]) {
  const s = solveTriangle(tri(raw));
  ok('8 kW, 6 kVAR, 10 kVA from ' + label, near(s.P, 8000) && near(s.Q, 6000) && near(s.S, 10000) && near(s.pf, 0.8),
     [s.P, s.Q, s.S, s.pf].map((x) => x.toFixed(2)).join(' '));
}
ok('φ = 36.87°', near(solveTriangle(tri({ real: '8 kW', reactive: '6 kVAR' })).angle, 36.8699));
ok('plain numbers are read as W, VAR, VA', near(solveTriangle(tri({ real: 8000, reactive: 6000 })).S, 10000));
ok('three values that agree are accepted', tri({ real: '8 kW', reactive: '6 kVAR', apparent: '10 kVA' }) !== null);

// --- correction: a standard worked example ---------------------------------------------------
// 100 kW at 0.7 lagging raised to 0.95: Qc = 100 (tan 45.57° - tan 18.19°) = 69.15 kVAR.
const pfc = tri({ real: '100 kW', powerFactor: 0.7, targetPf: 0.95, voltage: '415 V', frequency: 50, phases: 3, ask: 'capacitorReactive' });
const c = solveTriangle(pfc).correction;
ok('capacitor needed: 69.2 kVAR', near(c.Qc, 69153, 1e-3), c.Qc.toFixed(0));
ok('reactive power left: 32.9 kVAR', near(c.Q2, 32868, 1e-3), c.Q2.toFixed(0));
ok('apparent power falls from 142.9 to 105.3 kVA', near(solveTriangle(pfc).S, 142857, 1e-3) && near(c.S2, 105263, 1e-3));
ok('checks against "69.15 kVAR"', checkFigure(pfc, '69.15 kVAR').status === 'match');
ok('and not "69.15 kW" - wrong kind of power', checkFigure(pfc, '69.15 kW').status === 'mismatch');
ok('three-phase line current falls from 198.7 A to 146.4 A',
   near(answerTriangle({ ...pfc, ask: 'currentBefore' }).value, 198.75, 1e-3) && near(answerTriangle({ ...pfc, ask: 'currentAfter' }).value, 146.45, 1e-3),
   answerTriangle({ ...pfc, ask: 'currentBefore' }).value.toFixed(2) + ' / ' + answerTriangle({ ...pfc, ask: 'currentAfter' }).value.toFixed(2));
// Delta bank on 415 V: C per phase = (Qc/3) / (2π·50·415²) = 426 µF.
ok('delta-connected capacitance per phase: 426 µF', near(answerTriangle({ ...pfc, ask: 'capacitance' }).value, 426.1e-6, 2e-3),
   (answerTriangle({ ...pfc, ask: 'capacitance' }).value * 1e6).toFixed(1));
const single = tri({ real: '1 kW', powerFactor: 0.6, targetPf: 1, voltage: '230 V', frequency: 50, ask: 'capacitance' });
// Qc = 1333.3 VAR; C = 1333.3 / (2π·50·230²) = 80.2 µF.
ok('single phase to unity: 80.2 µF', near(answerTriangle(single).value, 80.23e-6, 2e-3), (answerTriangle(single).value * 1e6).toFixed(2));
ok('the power factor line reads "0.80 lagging"', triangleAskText(tri({ real: '8 kW', reactive: '6 kVAR', ask: 'powerFactor' }), true) === 'Power factor = 0.80 lagging');
ok('a leading load says leading', /leading$/.test(triangleAskText(tri({ real: '8 kW', reactive: '6 kVAR', lagging: false, ask: 'powerFactor' }), true)));
ok('before the reveal, only "?"', triangleAskText(pfc, false) === 'Capacitor rating = ?');

// Before the reveal only what the question stated is shown. Asking for S while
// showing P and the power factor would have given S away.
const askS = tri({ real: '8 kW', reactive: '6 kVAR', ask: 'apparent' });
const qLabels = layoutTriangle(askS, 940, 800, 36, false).labels.map((l) => l.text).join(' | ');
ok('question scene: P and Q, as stated', /P = 8 kW/.test(qLabels) && /Q = 6 kVAR/.test(qLabels), qLabels);
ok('question scene: S and the angle are "?"', /S = \?/.test(qLabels) && /φ = \?/.test(qLabels) && !/0\.80/.test(qLabels), qLabels);
const aLabels = layoutTriangle(askS, 940, 800, 36, true).labels.map((l) => l.text).join(' | ');
ok('after the reveal everything is shown', /S = 10 kVA/.test(aLabels) && /0\.80/.test(aLabels), aLabels);
const withPf = layoutTriangle(tri({ real: '8 kW', powerFactor: 0.8, ask: 'reactive' }), 940, 800, 36, false).labels.map((l) => l.text).join(' | ');
ok('a stated power factor is shown before the reveal', /pf 0\.80/.test(withPf) && /Q = \?/.test(withPf), withPf);
const corrQ = layoutTriangle(pfc, 940, 800, 36, false).labels.map((l) => l.text).join(' | ');
ok('the capacitor rating and S₂ wait for the reveal', /Qc = \?/.test(corrQ) && /S₂ = \?/.test(corrQ), corrQ);

// --- refusing triangles that cannot exist ---------------------------------------------------
const refused = (label, raw, pattern) => {
  const r = normalizeTriangle({ type: 'power-triangle', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('S smaller than P', { real: '10 kW', apparent: '8 kVA' }, /smaller than real/);
refused('a power factor above one', { real: '10 kW', powerFactor: 1.2 }, /between 0 and 1/);
refused('only one value', { real: '10 kW' }, /give two/);
refused('three values that contradict', { real: '8 kW', reactive: '6 kVAR', apparent: '12 kVA' }, /does not fit/);
refused('kVA given where kW belongs', { real: '8 kVA', powerFactor: 0.8 }, /real must be a power in W/);
refused('a "correction" that lowers the power factor', { real: '8 kW', powerFactor: 0.9, targetPf: 0.8 }, /lower than the present/);
refused('capacitance without the supply', { real: '8 kW', powerFactor: 0.8, targetPf: 0.95, ask: 'capacitance' }, /voltage and frequency/);
refused('capacitors on a leading load', { real: '8 kW', powerFactor: 0.8, lagging: false, targetPf: 0.95 }, /lagging load/);
ok('the registry reads it from JSON text', normalizeFigure('{"type":"power-triangle","real":"8 kW","powerFactor":0.8}').figure?.type === 'power-triangle');

// --- labels: never on top of each other, never off the frame ------------------------------
const FRAMES = [['portrait', 940, 940 - 36 * 2.1, 36], ['landscape', 1620, 620 - 32 * 2.1, 32]];
const cases = [
  ['pf 0.8', { real: '8 kW', powerFactor: 0.8 }],
  ['pf 0.99', { real: '8 kW', powerFactor: 0.99 }],
  ['pf 0.3', { real: '8 kW', powerFactor: 0.3 }],
  ['unity', { real: '8 kW', powerFactor: 1 }],
  ['leading 0.8', { real: '8 kW', powerFactor: 0.8, lagging: false }],
  ['correction 0.7 to 0.95', { real: '100 kW', powerFactor: 0.7, targetPf: 0.95 }],
  ['small correction 0.95 to 0.99', { real: '100 kW', powerFactor: 0.95, targetPf: 0.99 }],
  ['large correction 0.5 to 1', { real: '100 kW', powerFactor: 0.5, targetPf: 1 }],
];
for (const [frame, w, h, font] of FRAMES) {
  for (const [label, raw] of cases) {
    const t = tri(raw);
    for (const reveal of [false, true]) {
      const L = layoutTriangle(t, w, h, font, reveal);
      const out = L.labels.filter((l) => l.box.x1 < 0 || l.box.x2 > w || l.box.y1 < 0 || l.box.y2 > h);
      const clash = [];
      for (let i = 0; i < L.labels.length; i++) for (let j = i + 1; j < L.labels.length; j++) {
        const a = L.labels[i].box, b = L.labels[j].box;
        if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) clash.push(L.labels[i].key + '+' + L.labels[j].key);
      }
      if (!reveal) continue;
      ok(frame + ' ' + label + ': labels inside the frame', out.length === 0, out.map((l) => l.key + ' ' + Math.round(l.box.x1) + '..' + Math.round(l.box.x2) + ',' + Math.round(l.box.y1) + '..' + Math.round(l.box.y2)).join(' | '));
      ok(frame + ' ' + label + ': no labels overlap', clash.length === 0, clash.join(', '));
    }
  }
}
const lag = layoutTriangle(tri({ real: '8 kW', powerFactor: 0.8 }), 940, 800, 36, true);
ok('lagging: Q is drawn upwards from the base', lag.apex.y < lag.base.y);
ok('and the triangle keeps its shape: height / base = Q / P = 0.75',
   near((lag.base.y - lag.apex.y) / (lag.base.x - lag.origin.x), 0.75, 1e-6));
const leadL = layoutTriangle(tri({ real: '8 kW', powerFactor: 0.8, lagging: false }), 940, 800, 36, true);
ok('leading: Q is drawn downwards', leadL.apex.y > leadL.base.y);
const corr = layoutTriangle(pfc, 940, 800, 36, true);
ok('after correction the new apex sits on the same side, lower down', corr.corrected.y > corr.apex.y && corr.corrected.y < corr.base.y);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall power triangle checks passed');
process.exit(fails ? 1 : 0);
