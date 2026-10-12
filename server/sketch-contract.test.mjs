// Run: node server/sketch-contract.test.mjs
//
// What a sketch must be told before it is drawn. The cases are the pictures
// that reached real videos with something nobody stated on them.

import { SKETCH_NAMES } from './sketch-catalogue.mjs';
import { checkSketch, contractFor, itemLimit, sketchPromptLines } from './sketch-contract.mjs';

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
const refused = (name, params = {}, items = []) => checkSketch(name, params, items).length > 0;
const why = (name, params = {}, items = []) => checkSketch(name, params, items).join('; ');

test('every sketch in the library has a contract', () => {
  const missing = SKETCH_NAMES.filter((n) => !contractFor(n));
  assert(!missing.length, missing.join(', '));
});

test('the Ferranti waveform: two waves and no angle is not drawn', () => {
  assert(refused('waveform', { mode: 'phase', frequency: 2, labelA: 'Vs', labelB: 'Vr' }), 'drawn with no angle');
  assert(!refused('waveform', { mode: 'phase', angle: 0, labelA: 'Vs', labelB: 'Vr', ratio: 1.2 }), why('waveform', { mode: 'phase', angle: 0, labelA: 'Vs', labelB: 'Vr' }));
  // In phase is a statement, and zero states it.
  assert(/angle/.test(why('waveform', { mode: 'phase', labelA: 'V', labelB: 'I' })), 'the reason names the angle');
});

test('a rectified waveform needs no angle and no labels', () => {
  assert(!refused('waveform', { mode: 'half-wave' }), why('waveform', { mode: 'half-wave' }));
  assert(refused('waveform', {}), 'drawn with no mode');
});

test('a sketch given a mode it does not have is not drawn', () => {
  assert(refused('switch-circuit', { mode: 'vertical' }), 'accepted an unknown mode');
  assert(!refused('switch-circuit', { mode: 'closed' }), why('switch-circuit', { mode: 'closed' }));
  assert(!refused('switch-circuit', { mode: 'Closed' }), 'modes are matched whatever the capitals');
  assert(refused('switch-circuit', {}), 'drawn closed by default');
});

test('a list sketch with no list is not drawn: these came out as blank scenes', () => {
  for (const name of ['checklist', 'flowchart', 'ratio-bar', 'number-line', 'kirchhoff', 'pie', 'histogram']) {
    assert(refused(name, { labelA: 'Key takeaways' }), name + ' drawn with no items');
  }
  assert(!refused('checklist', {}, [{ label: 'One' }, { label: 'Two' }]), why('checklist', {}, [{ label: 'One' }, { label: 'Two' }]));
});

test('a chart sketch needs a number on every entry', () => {
  const labels = [{ label: 'In', value: NaN }, { label: 'Out', value: NaN }];
  assert(refused('kirchhoff', {}, labels), 'drawn with labels and no values');
  assert(!refused('kirchhoff', {}, [{ label: 'I1', value: 5 }, { label: 'I2', value: 3 }]), 'refused a complete one');
});

test('a default value is not a fact: phasor, power factor, meter, op-amp', () => {
  assert(refused('phasor', { labelA: 'V', labelB: 'I' }), 'phasor drawn at its default 35 degrees');
  assert(!refused('phasor', { angle: -90, labelA: 'Vr', labelB: 'Ic' }), why('phasor', { angle: -90, labelA: 'Vr', labelB: 'Ic' }));
  assert(refused('power-factor', {}), 'power factor drawn at its default 0.81');
  assert(!refused('power-factor', { angle: 60 }), why('power-factor', { angle: 60 }));
  assert(refused('multimeter', { labelA: 'Volts' }), 'meter drawn reading its default 12.4');
  assert(refused('op-amp', {}), 'op-amp drawn at its default gain of 10');
  assert(refused('complex-plane', { ratio: 1 }), 'a point with no imaginary part given');
});

test('how fast or how full a picture looks need not be stated', () => {
  assert(!refused('motor', {}), why('motor'));
  assert(!refused('particles', {}), why('particles'));
  assert(!refused('three-phase', {}), why('three-phase'));
  assert(!refused('diode-curve', {}), why('diode-curve'));
});

test('a circuit needs its network and whether it is AC or DC; its supply may be left out', () => {
  assert(refused('circuit', { labelA: '12 V', mode: 'dc' }), 'drawn with no network');
  assert(/AC or DC/.test(why('circuit', { network: 'R + L + C' })), 'an AC circuit could be drawn on a battery by default: ' + why('circuit', { network: 'R + L + C' }));
  assert(!refused('circuit', { network: '99 | 1', mode: 'dc' }), why('circuit', { network: '99 | 1', mode: 'dc' }));
  assert(refused('circuit', { network: '99 | 1', mode: 'series' }), 'the old "series" mode still passes for a new script');
});

test('each sketch takes as many items as it says it draws', () => {
  assert(itemLimit('histogram') === 8, 'histogram: ' + itemLimit('histogram'));
  assert(itemLimit('matrix') >= 9, 'matrix: ' + itemLimit('matrix'));
  assert(itemLimit('checklist') === 5, 'checklist: ' + itemLimit('checklist'));
  assert(itemLimit('motor') === 5, 'a sketch with no items keeps the old cap');
});

test('the prompt says what must be stated, and no longer promises defaults', () => {
  const text = sketchPromptLines().join('\n');
  assert(!/sensible default/i.test(text), 'still promises a default');
  assert(/must state: angle\b/.test(text), 'no "must state" line for an angle');
  assert(/must state: at least 2 items/.test(text), 'no "must state" line for items');
  assert(SKETCH_NAMES.every((n) => text.includes('- ' + n + ': ')), 'a sketch is missing from the prompt');
});

console.log('\n' + passed + ' checks passed');
