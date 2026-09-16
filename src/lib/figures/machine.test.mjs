// Rotating machines against standard worked examples.
import { answerMachine, machineAskText, machineRows, normalizeMachine, solveMachine } from './machine.ts';
import { checkFigure, normalizeFigure } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };
const near = (a, b, tol = 2e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const mc = (raw) => {
  const r = normalizeMachine({ type: 'machine', ...raw });
  if (!r.figure) console.log('     (refused: ' + r.errors.join('; ') + ')');
  return r.figure;
};
const ans = (m, ask) => answerMachine({ ...m, ask })?.value;

// 4-pole, 50 Hz induction motor at 1440 rpm.
const im = mc({ kind: 'induction', poles: 4, frequency: 50, speed: 1440, ask: 'slip' });
ok('synchronous speed 1500 rpm', ans(im, 'synchronousSpeed') === 1500);
ok('slip 4%', near(ans(im, 'slip'), 4));
ok('rotor frequency 2 Hz', near(ans(im, 'rotorFrequency'), 2));
ok('checks against "4%"', checkFigure(im, '4%').status === 'match');
ok('and against "0.04" - the same slip written as a fraction', checkFigure(im, '0.04').status === 'match');
ok('but not against "0.06"', checkFigure(im, '0.06').status === 'mismatch');
ok('speeds read as rpm in the answer line', machineAskText({ ...im, ask: 'synchronousSpeed' }, true) === 'Synchronous speed = 1500 rpm');
// From slip: 6-pole, 50 Hz, 3% slip -> 970 rpm.
const im2 = mc({ kind: 'induction', poles: 6, frequency: 50, slip: '3%', ask: 'rotorSpeed' });
ok('6 pole 50 Hz at 3% slip turns at 970 rpm', near(ans(im2, 'rotorSpeed'), 970));
ok('checks against "970 rpm"', checkFigure(im2, '970 rpm').status === 'match');
ok('and a bare "970"', checkFigure(im2, '970').status === 'match');
ok('torque option "40.1 N-m" is read', checkFigure({ ...mc({ kind: 'dc-motor', voltage: '220 V', lineCurrent: '21 A', fieldResistance: '220 Ω', armatureResistance: '0.5 Ω', speed: 1000 }), ask: 'torque' }, '40.1 N-m').status === 'match');
ok('speed given as "1440 rpm" is read', mc({ kind: 'induction', poles: 4, frequency: 50, speed: '1440 rpm' }).speed === 1440);
// Power split: 20 kW air-gap power at 4% slip.
const split = mc({ kind: 'induction', poles: 4, frequency: 50, slip: 0.04, airGapPower: '20 kW', ask: 'rotorCopperLoss' });
ok('rotor copper loss s·Pg = 800 W', near(ans(split, 'rotorCopperLoss'), 800));
ok('mechanical power (1-s)·Pg = 19.2 kW', near(ans(split, 'mechanicalPower'), 19200));
ok('the two add back to the air-gap power', near(ans(split, 'rotorCopperLoss') + ans(split, 'mechanicalPower'), 20000));

// Synchronous: 50 Hz, 2 poles -> 3000 rpm; and poles from speed.
ok('2-pole synchronous at 50 Hz: 3000 rpm', ans(mc({ kind: 'synchronous', poles: 2, frequency: 50 }), 'synchronousSpeed') === 3000);
ok('a 50 Hz alternator at 375 rpm has 16 poles', near(ans(mc({ kind: 'synchronous', frequency: 50, speed: 375, poles: 16 }), 'poles'), 16));
ok('frequency from poles and speed: 12 poles at 500 rpm is 50 Hz', near(ans(mc({ kind: 'synchronous', poles: 12, speed: 500 }), 'frequency'), 50));

// DC shunt motor: 220 V, Ra 0.5 Ω, IL 21 A, Rsh 220 Ω -> If 1 A, Ia 20 A, Eb 210 V.
const dc = mc({ kind: 'dc-motor', voltage: '220 V', lineCurrent: '21 A', fieldResistance: '220 Ω', armatureResistance: '0.5 Ω', speed: 1000, ask: 'backEmf' });
ok('shunt field current 1 A', near(ans(dc, 'fieldCurrent'), 1));
ok('armature current 20 A', near(ans(dc, 'armatureCurrent'), 20));
ok('back EMF 210 V', near(ans(dc, 'backEmf'), 210));
ok('power developed 4.2 kW', near(ans(dc, 'powerDeveloped'), 4200));
ok('torque 40.1 N·m at 1000 rpm', near(ans(dc, 'torque'), 40.107), String(ans(dc, 'torque')));
ok('checks against "210 V"', checkFigure(dc, '210 V').status === 'match');
// Load raised to Ia = 40 A: Eb2 = 200 V, N2 = 1000 × 200/210 = 952 rpm.
const load = mc({ kind: 'dc-motor', voltage: '220 V', armatureCurrent: '20 A', armatureResistance: '0.5 Ω', speed: 1000, newArmatureCurrent: '40 A', ask: 'newSpeed' });
ok('more load, more drop: 952 rpm', near(ans(load, 'newSpeed'), 952.4));
// Field weakened to 80% at the same armature current: N2 = 1000 / 0.8 = 1250 rpm.
ok('weaker field, faster: 1250 rpm', near(ans(mc({ kind: 'dc-motor', voltage: '220 V', armatureCurrent: '20 A', armatureResistance: '0.5 Ω', speed: 1000, fluxRatio: 0.8 }), 'newSpeed'), 1250));

// DC generator: 4 poles, 0.02 Wb, 500 conductors, 1200 rpm.
const lap = mc({ kind: 'dc-generator', poles: 4, flux: '0.02 Wb', conductors: 500, speed: 1200, winding: 'lap', ask: 'generatedEmf' });
ok('lap winding: E = 200 V', near(ans(lap, 'generatedEmf'), 200));
ok('wave winding doubles it for 4 poles: 400 V', near(ans({ ...lap, winding: 'wave' }, 'generatedEmf'), 400));
ok('terminal voltage E - Ia·Ra: 200 - 50 × 0.2 = 190 V',
   near(ans(mc({ kind: 'dc-generator', poles: 4, flux: '0.02 Wb', conductors: 500, speed: 1200, winding: 'lap', armatureCurrent: '50 A', armatureResistance: '0.2 Ω' }), 'terminalVoltage'), 190));

// Before the reveal.
const q = machineRows(im, false).join(' | ');
ok('question scene: poles, frequency and speed as stated', /4 poles, 50 Hz/.test(q) && /1440 rpm/.test(q), q);
ok('question scene: synchronous speed and slip are "?"', /Ns = 120 f \/ P = \?/.test(q) && /Slip .* = \?/.test(q), q);
const dq = machineRows(dc, false).join(' | ');
ok('DC question scene: the stated line current and field resistance are shown', /IL = 21 A/.test(dq) && /Rsh = 220 Ω/.test(dq) && /Ra = 0.5 Ω/.test(dq), dq);
ok('answer scene: shows them', /1500 rpm/.test(machineRows(im, true).join(' ')) && /4%/.test(machineRows(im, true).join(' ')));

const refused = (label, raw, pattern) => {
  const r = normalizeMachine({ type: 'machine', ...raw });
  ok(label, r.figure === null && pattern.test(r.errors.join('; ')), r.errors.join('; '));
};
refused('an induction rotor faster than the field', { kind: 'induction', poles: 4, frequency: 50, speed: 1600 }, /slower than the field/);
refused('a speed and a slip that disagree', { kind: 'induction', poles: 4, frequency: 50, speed: 1440, slip: '6%' }, /different operating points/);
refused('an odd number of poles', { kind: 'induction', poles: 5, frequency: 50 }, /even number/);
refused('a synchronous machine off synchronous speed', { kind: 'synchronous', poles: 4, frequency: 50, speed: 1450 }, /exactly 1500 rpm/);
refused('an armature drop bigger than the supply', { kind: 'dc-motor', voltage: '220 V', armatureCurrent: '100 A', armatureResistance: '5 Ω' }, /no back EMF/);
refused('a generator without its winding type', { kind: 'dc-generator', poles: 4, flux: '0.02 Wb', conductors: 500, speed: 1200 }, /lap or wave/);
refused('an ask that cannot be answered from what is given', { kind: 'induction', poles: 4, frequency: 50, ask: 'slip' }, /cannot be worked out/);
refused('an unknown kind', { kind: 'stepper' }, /kind must be/);
ok('the registry reads it', normalizeFigure('{"type":"machine","kind":"synchronous","poles":4,"frequency":50}').figure?.type === 'machine');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall machine checks passed');
process.exit(fails ? 1 : 0);
