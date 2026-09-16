// Transformers against standard worked examples.
import { answerTransformer, layoutTransformer, normalizeTransformer, solveTransformer, transformerAskText, transformerSides } from './transformer.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 2e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const tx = (raw) => {
  const r = normalizeTransformer({ type: 'transformer', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};
const ans = (t, ask) => answerTransformer({ ...t, ask })?.value;

// 2200 / 220 V, 10 kVA.
const t1 = tx({ primaryVoltage: '2200 V', secondaryVoltage: '220 V', rating: '10 kVA', ask: 'secondaryCurrent' });
ok('ratio 10', near(t1.ratio, 10));
ok('primary current 4.545 A', near(ans(t1, 'primaryCurrent'), 4.545));
ok('secondary current 45.45 A', near(ans(t1, 'secondaryCurrent'), 45.45));
ok('checks against "45.45 A"', checkFigure(t1, '45.45 A').status === 'match');
ok('and not against the primary current', checkFigure(t1, '4.545 A').status === 'mismatch');
ok('the ratio reads "10 : 1"', transformerAskText({ ...t1, ask: 'turnsRatio' }, true) === 'Turns ratio N₁ : N₂ = 10 : 1');

// From a ratio and one side.
const t2 = tx({ turnsRatio: '5:1', primaryVoltage: '1100 V', primaryTurns: 1000 });
ok('5:1 on 1100 V gives 220 V', near(t2.V2, 220));
ok('and 200 secondary turns', near(t2.N2, 200));

// E = 4.44 f N Φm: 50 Hz, 500 turns, 25 mWb.
const t3 = tx({ turnsRatio: '10:1', primaryTurns: 500, frequency: 50, maxFlux: '25 mWb', ask: 'primaryEmf' });
ok('EMF equation: 2775 V', near(ans(t3, 'primaryEmf'), 2775));
ok('secondary EMF 277.5 V', near(ans(t3, 'secondaryEmf'), 277.5));
// Flux from the voltage: 230 V, 50 Hz, 200 turns -> 5.18 mWb.
const t4 = tx({ primaryVoltage: '230 V', secondaryVoltage: '23 V', primaryTurns: 200, frequency: 50, area: 0.01, ask: 'maxFlux' });
ok('maximum flux 5.18 mWb', near(ans(t4, 'maxFlux'), 5.18e-3));
ok('peak flux density 0.518 T over 0.01 m²', near(ans(t4, 'fluxDensity'), 0.518));
ok('checks against "5.18 mWb"', checkFigure(t4, '5.18 mWb').status === 'match');
// Turns from B and area: 1.2 T over 0.02 m² on 2200 V at 50 Hz -> 413 turns.
const t5 = tx({ primaryVoltage: '2200 V', secondaryVoltage: '220 V', fluxDensity: '1.2 T', area: 0.02, frequency: 50, ask: 'primaryTurns' });
ok('turns from flux density: 413', near(ans(t5, 'primaryTurns'), 412.9), String(ans(t5, 'primaryTurns')));
ok('turns answered as a whole number', transformerAskText(t5, true) === 'Primary turns = 413');

// Efficiency: 100 kVA, 0.8 pf, Pi 1 kW, Pcu 2 kW at full load.
const eff = tx({ turnsRatio: '10:1', rating: '100 kVA', powerFactor: 0.8, ironLoss: '1 kW', copperLoss: '2 kW', ask: 'efficiency' });
ok('full-load efficiency 96.39%', near(ans(eff, 'efficiency'), 96.386));
ok('half-load efficiency 96.39% too (x² halves copper loss to 0.5 kW)', near(ans({ ...eff, load: 0.5 }, 'efficiency'), 96.386));
ok('maximum efficiency at 70.7% of full load', near(ans(eff, 'maxEfficiencyLoad'), 70.71));
ok('maximum efficiency 96.59%', near(ans(eff, 'maxEfficiency'), 96.585));
ok('at maximum efficiency copper loss equals iron loss', near(0.7071 ** 2 * 2000, 1000, 1e-3));
ok('checks against "96.4%"', checkFigure(eff, '96.4%').status === 'match');
ok('"70.7% of full load" is read as 70.7%', checkFigure({ ...eff, ask: 'maxEfficiencyLoad' }, '70.7% of full load').status === 'match');
ok('the load line says "of full load"', transformerAskText({ ...eff, ask: 'maxEfficiencyLoad' }, true) === 'Maximum efficiency at = 70.7% of full load');

// Regulation: 2% R, 4% X.
const reg = tx({ turnsRatio: '10:1', percentR: 2, percentX: 4, powerFactor: 0.8, ask: 'regulation' });
ok('regulation at 0.8 lagging: 4%', near(ans(reg, 'regulation'), 4.0));
ok('at 0.8 leading: -0.8%', near(ans({ ...reg, lagging: false }, 'regulation'), -0.8));

// Autotransformer 230 / 200 V saves K = 86.96% of the copper.
const auto = tx({ primaryVoltage: '230 V', secondaryVoltage: '200 V', auto: true, ask: 'copperSaving' });
ok('autotransformer saving 86.96%', near(ans(auto, 'copperSaving'), 86.96));
ok('step-up saves the same as step-down', near(ans(tx({ primaryVoltage: '200 V', secondaryVoltage: '230 V', auto: true }), 'copperSaving'), 86.96));

// Three-phase 500 kVA, 11 kV / 415 V.
const three = tx({ primaryVoltage: '11 kV', secondaryVoltage: '415 V', rating: '500 kVA', phases: 3, ask: 'secondaryCurrent' });
ok('three-phase primary line current 26.24 A', near(ans(three, 'primaryCurrent'), 26.24));
ok('three-phase secondary line current 695.6 A', near(ans(three, 'secondaryCurrent'), 695.6));

// Before the reveal, only what the question stated.
const sides = transformerSides(t1, false);
ok('question scene: stated voltages shown', sides.left[0] === 'V₁ = 2.2 kV' && sides.right[0] === 'V₂ = 220 V', JSON.stringify(sides));
ok('question scene: currents that were worked out are "?"', sides.left.includes('I₁ = ?') && sides.right.includes('I₂ = ?'), JSON.stringify(sides));
ok('answer scene: currents shown', transformerSides(t1, true).right.includes('I₂ = 45.5 A'), JSON.stringify(transformerSides(t1, true)));

// --- layout: values beside the core fit the frame ----------------------------------------
for (const [frame, w, h, font] of [['portrait', 940, 940 - 36 * 2.1, 36], ['landscape', 1620, 620 - 32 * 2.1, 32]]) {
  for (const [label, t] of [['currents', t1], ['EMF', t3], ['efficiency', eff], ['three-phase', three]]) {
    const L = layoutTransformer(t, w, h, font);
    ok(frame + ' ' + label + ': left values stay inside the frame', L.left.every((p) => p.x - L.leftWidth >= 0), (L.left[0]?.x - L.leftWidth).toFixed(0));
    ok(frame + ' ' + label + ': right values stay inside the frame', L.right.every((p) => p.x + L.rightWidth <= w), (L.right[0]?.x + L.rightWidth).toFixed(0) + ' / ' + w);
    const bottom = Math.max(L.core.y + L.core.h, ...L.below.map((b) => b.y + font * 0.3));
    ok(frame + ' ' + label + ': rows under the core stay inside the frame', bottom <= h, bottom.toFixed(0) + ' / ' + h.toFixed(0));
    ok(frame + ' ' + label + ': the core is a sensible size', L.core.w >= 160 && L.core.h >= 150, L.core.w.toFixed(0) + 'x' + L.core.h.toFixed(0));
  }
}

const refused = (label, raw, pattern) => {
  const r = normalizeTransformer({ type: 'transformer', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('a turns ratio that is not the voltage ratio', { turnsRatio: '10:1', primaryVoltage: '2200 V', secondaryVoltage: '200 V' }, /ratio/);
refused('an EMF equation that does not hold', { primaryVoltage: '230 V', secondaryVoltage: '23 V', primaryTurns: 200, frequency: 50, maxFlux: '10 mWb' }, /4\.44/);
refused('no ratio at all', { primaryVoltage: '230 V' }, /state the ratio/);
refused('currents without a rating', { primaryVoltage: '230 V', secondaryVoltage: '23 V', ask: 'secondaryCurrent' }, /needs a rating/);
refused('efficiency without the losses', { turnsRatio: '10:1', rating: '10 kVA', powerFactor: 0.8, ask: 'efficiency' }, /ironLoss and copperLoss/);
refused('copper saving on a two-winding transformer', { primaryVoltage: '230 V', secondaryVoltage: '200 V', ask: 'copperSaving' }, /autotransformer/);
refused('a rating in watts', { turnsRatio: '10:1', rating: '10 kW' }, /rating must be/);
ok('the registry reads it', normalizeFigure('{"type":"transformer","turnsRatio":"2:1","primaryVoltage":"440 V"}').figure?.type === 'transformer');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall transformer checks passed');
process.exit(fails ? 1 : 0);
