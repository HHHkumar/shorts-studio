// AC figures, checked against the textbook - and against their own drawing:
// the shaded power curve must average to the power the figure states, and a
// lagging current must peak later than its voltage.
import { acPower, answerAc, averagePowerText, layoutPhasors, phaseShown, layoutWaveform, normalizeAc, phasorAngleLabel, relationText, signalValueText, valueAt, acAskText, waveKeyText } from './ac.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const fig = (signals, extra = {}) => {
  const r = normalizeAc({ type: 'ac', frequency: 50, signals, ...extra });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};
const V = (rms, phase = 0, id = 'V') => ({ id, kind: 'voltage', rms, phase });
const I = (rms, phase = 0, id = 'I') => ({ id, kind: 'current', rms, phase });

// --- the ideal inductor: the video that drew it wrong -----------------------------------
const inductor = fig([V(230), I(10, -90)], { showPower: true, view: 'both', ask: { quantity: 'power' } });
const p = acPower(inductor);
ok('ideal inductor: current lags by 90°', near(p.phi, 90) && p.relation === 'current lags');
ok('absorbs no average power', p.real === 0, String(p.real));
ok('but 2300 VAR of reactive power', near(p.reactive, 2300));
ok('and 2300 VA apparent', near(p.apparent, 2300));
ok('power factor zero', p.powerFactor === 0);
ok('checks against "Zero"', checkFigure(inductor, 'Zero').status === 'match');
ok('and against "0 W"', checkFigure(inductor, '0 W').status === 'match');
ok('and cannot be checked against "V times I"', checkFigure(inductor, 'V times I').status === 'unchecked');
ok('and not against "2300 W"', checkFigure(inductor, '2300 W').status === 'mismatch');
ok('says "I lags V by 90°"', relationText(inductor, true) === 'I lags V by 90°', relationText(inductor, true));

const capacitor = fig([V(230), I(10, 90)]);
ok('capacitor: current leads by 90°', near(acPower(capacitor).phi, -90) && acPower(capacitor).relation === 'current leads');
ok('says "I leads V by 90°"', relationText(capacitor, true) === 'I leads V by 90°');

const resistor = fig([V(230), I(10)]);
ok('resistor: in phase, P = VI = 2300 W', near(acPower(resistor).real, 2300) && acPower(resistor).reactive === 0);

const pf08 = fig([V(230), I(10, -36.8699)], { ask: { quantity: 'powerFactor' } });
ok('0.8 lagging: P = 1840 W', near(acPower(pf08).real, 1840, 1e-4));
ok('Q = 1380 VAR', near(acPower(pf08).reactive, 1380, 1e-4));
ok('checks against "0.8 lagging"', checkFigure(pf08, '0.8 lagging').status === 'match');
ok('the answer line says lagging', /0\.8 lagging$/.test(acAskText(pf08, true)), acAskText(pf08, true));

// --- RMS, peak, period ----------------------------------------------------------------------
const mains = fig([V(230)], { ask: { quantity: 'peak', signal: 'V' } });
ok('230 V RMS peaks at 325 V', near(answerAc(mains).value, 325.27, 1e-3) && checkFigure(mains, '325 V').status === 'match');
ok('period at 50 Hz is 20 ms', checkFigure({ ...mains, ask: { quantity: 'period' } }, '20 ms').status === 'match');
ok('"0.02 seconds" is the same period', checkFigure({ ...mains, ask: { quantity: 'period' } }, '0.02 seconds').status === 'match');
ok('phase difference answered in degrees', checkFigure({ ...inductor, ask: { quantity: 'phase' } }, '90°').status === 'match');
ok('impedance V/I = 23 Ω', checkFigure({ ...inductor, ask: { quantity: 'impedance' } }, '23 Ω').status === 'match');

// --- the drawing agrees with the arithmetic ----------------------------------------------
const W = layoutWaveform(inductor, 900, 400, 2000);
const vWave = W.signals.find((s) => s.signal.kind === 'voltage').points;
const iWave = W.signals.find((s) => s.signal.kind === 'current').points;
const peakX = (pts) => pts.slice(0, Math.floor(pts.length / 2)).reduce((best, pt) => (pt[1] < best[1] ? pt : best))[0];
const quarter = (W.right - W.left) / 8;
ok('the lagging current peaks a quarter period AFTER the voltage', near(peakX(iWave) - peakX(vWave), quarter, 0.01),
   (peakX(iWave) - peakX(vWave)).toFixed(1) + ' vs ' + quarter.toFixed(1));
const lead = layoutWaveform(capacitor, 900, 400, 2000);
const leadV = lead.signals.find((s) => s.signal.kind === 'voltage').points;
const leadI = lead.signals.find((s) => s.signal.kind === 'current').points;
ok('a leading current peaks before the voltage', peakX(leadI) < peakX(leadV));
ok('inductor power: the positive and negative areas are both shaded', W.powerPositive.length > 0 && W.powerNegative.length > 0);
ok('and the average power line sits on the axis', near(W.averageY, W.axisY));
const area = (polys) => polys.reduce((total, poly) => {
  let a = 0;
  for (let k = 0; k < poly.length; k++) {
    const [x1, y1] = poly[k];
    const [x2, y2] = poly[(k + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return total + Math.abs(a) / 2;
}, 0);
ok('the shaded areas are equal, so nothing is absorbed on average',
   near(area(W.powerPositive), area(W.powerNegative), 0.01), area(W.powerPositive).toFixed(0) + ' / ' + area(W.powerNegative).toFixed(0));
const R = layoutWaveform({ ...pf08, showPower: true }, 900, 400, 2000);
ok('at 0.8 pf the positive area outweighs the negative', area(R.powerPositive) > area(R.powerNegative));
ok('and the average line sits above the axis', R.averageY < R.axisY);
let total = 0;
const N = 4000;
for (let k = 0; k < N; k++) {
  const t = (k / N) * (1 / 50);
  total += valueAt(pf08.signals[0], 50, t) * valueAt(pf08.signals[1], 50, t);
}
ok('the mean of v(t)·i(t) over a period is exactly the stated power', near(total / N, 1840, 1e-3), (total / N).toFixed(2));
ok('time ticks are labelled in ms at 50 Hz', W.ticks[3].label === '20 ms', W.ticks.map((t) => t.label).join(' '));

const arrows = layoutPhasors(inductor, 300, 300, 200);
const iArrow = arrows.find((a) => a.signal.kind === 'current');
const vArrow = arrows.find((a) => a.signal.kind === 'voltage');
ok('the voltage phasor points right', near(vArrow.y, 300) && vArrow.x > 300);
ok('the lagging current phasor points straight DOWN, not up', near(iArrow.x, 300) && iArrow.y > 300);
ok('the current phasor is drawn shorter than the voltage', iArrow.length < vArrow.length);

// The first render put "φ = 36.9°" straight across the current arrow.
for (const phi of [10, 36.87, 60, 90, 150, -45, -90]) {
  const f = fig([V(230), I(10, -phi)]);
  const text = 'φ = ' + Math.abs(phi) + '°';
  const label = phasorAngleLabel(f, 300, 300, 200, 28, text);
  const segs = layoutPhasors(f, 300, 300, 200);
  const hits = segs.filter((a) => {
    for (let k = 0; k <= 60; k++) {
      const px = 300 + ((a.x - 300) * k) / 60;
      const py = 300 + ((a.y - 300) * k) / 60;
      if (px > label.box.x1 && px < label.box.x2 && py > label.box.y1 && py < label.box.y2) return true;
    }
    return false;
  });
  ok('φ = ' + phi + '°: the angle label clears both arrows', hits.length === 0, hits.map((h) => h.signal.id).join(','));
}
ok('in phase: no angle to label', phasorAngleLabel(resistor, 300, 300, 200, 28, 'φ = 0°') === null);

// Before the reveal: average power is worked out, so it waits; so does φ when
// the question is the power factor or the phase.
ok('question scene: average power is "?"', averagePowerText(inductor, false) === 'P avg = ?');
ok('answer scene: average power is shown', averagePowerText(inductor, true) === 'P avg = 0 W');
ok('a power-factor question hides φ until the reveal', !phaseShown(pf08, false) && phaseShown(pf08, true));
ok('a peak-value question may show φ', phaseShown(mains, false));
ok('and the relation line hides the angle too', relationText(pf08, false) === 'I lags V by ?', relationText(pf08, false));

// --- the key above the waves says the question, not the answer ---------------------------------
// A 230 V supply peaks at 325 V. Printing "V: peak 325 V" over the question
// that ASKS for the peak gives it away in the key, whatever the footer says.
ok('peak question: the key asks rather than answers', waveKeyText(mains, mains.signals[0], false) === 'V: peak ?', waveKeyText(mains, mains.signals[0], false));
ok('and answers on the reveal', waveKeyText(mains, mains.signals[0], true) === 'V: peak 325 V', waveKeyText(mains, mains.signals[0], true));
ok('no worked-out peak anywhere in the key before the reveal', !/325/.test(waveKeyText(mains, mains.signals[0], false)));

const rmsAsked = fig([V(230)], { ask: { quantity: 'rms', signal: 'V' } });
ok('rms question: the stated peak shows, the asked rms does not', waveKeyText(rmsAsked, rmsAsked.signals[0], false) === 'V: ? rms', waveKeyText(rmsAsked, rmsAsked.signals[0], false));
ok('and the phasor label hides it too', signalValueText(rmsAsked, rmsAsked.signals[0], false) === '?');

ok('a power question keeps the stated rms on the key', waveKeyText(inductor, inductor.signals[0], false) === 'V: 230 V rms', waveKeyText(inductor, inductor.signals[0], false));
ok('and shows the current the question gave', waveKeyText(inductor, inductor.signals[1], false) === 'I: 10 A rms', waveKeyText(inductor, inductor.signals[1], false));
ok('the key never prints a peak the question did not ask about', !/peak/.test(waveKeyText(pf08, pf08.signals[0], false)));
ok('phasor labels carry the stated rms', signalValueText(pf08, pf08.signals[1], false) === '10 A');

// --- refusing what cannot be drawn honestly --------------------------------------------------
const refused = (label, raw, pattern) => {
  const r = normalizeAc({ type: 'ac', frequency: 50, ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('no frequency', { frequency: 0, signals: [V(230)] }, /frequency/);
refused('four signals', { signals: [V(1), V(2, 0, 'V2'), I(1), I(2, 0, 'I2')] }, /1 to 3/);
refused('power with two voltages and no current', { signals: [V(1), V(2, 0, 'V2')], showPower: true }, /exactly one voltage/);
refused('a negative RMS value', { signals: [V(-230)] }, /positive/);
refused('a phase that is not a number', { signals: [{ id: 'V', kind: 'voltage', rms: 230, phase: 'lagging' }] }, /phase/);
refused('asking the peak of nothing', { signals: [V(230)], ask: { quantity: 'peak' } }, /name one of the signals/);
ok('a phase of 270° is the same as -90°', fig([V(1), I(1, 270)]).signals[1].phase === -90);
ok('the registry reads an AC figure', normalizeFigure(JSON.stringify({ type: 'ac', frequency: 50, signals: [V(230)] })).figure?.type === 'ac');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall AC checks passed');
process.exit(fails ? 1 : 0);
