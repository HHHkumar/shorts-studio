// Run: node server/speech.test.mjs
//
// Two things are being protected here. That units get said correctly, and that
// expanding them never leaks onto the screen or corrupts the caption timings.

import assert from 'node:assert/strict';
import { collapseTimings, expandForSpeech } from './speech.mjs';

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

const say = (text) => expandForSpeech(text).spoken;

console.log('\nthe reported bug');

test('"10 MW" is spoken as megawatts, not mili wag', () => {
  assert.equal(say('The plant is rated 10 MW.'), 'The plant is rated 10 megawatts.');
});

test('the screen still says "10 MW"', () => {
  const { written } = expandForSpeech('The plant is rated 10 MW.');
  assert.ok(written.includes('MW.'), written.join(' '));
});

console.log('\nunits');

test('case is respected: mV is millivolts, MV is megavolts', () => {
  assert.equal(say('5 mV'), '5 millivolts');
  assert.equal(say('5 MV'), '5 megavolts');
});

test('a unit stuck to its number is still found', () => {
  assert.equal(say('rated 100MW today'), 'rated 100 megawatts today');
});

test('multi-word units expand fully', () => {
  assert.equal(say('8760 kWh'), '8760 kilowatt hours');
  assert.equal(say('50 MVAr'), '50 megavolt amperes reactive');
});

test('one takes the singular', () => {
  assert.equal(say('1 MW'), '1 megawatt');
  assert.equal(say('1.5 MW'), '1.5 megawatts');
});

test('trailing punctuation survives on the outside', () => {
  assert.equal(say('is 40 kV, and'), 'is 40 kilovolts, and');
  assert.equal(say('draws 12 A.'), 'draws 12 amperes.');
});

test('symbols that are not letters work too', () => {
  assert.equal(say('60%'), '60 percent');
  assert.equal(say('load of 40 °C'), 'load of 40 degrees Celsius');
  assert.equal(say('a 10 Ω resistor'), 'a 10 ohms resistor');
});

console.log('\nnot touching prose');

test('"A" stays the article when no number precedes it', () => {
  assert.equal(say('A transformer has no moving parts'), 'A transformer has no moving parts');
});

test('a bare unit with no number in front is left alone', () => {
  // Otherwise "the W in kW" would turn into "the watts in kilowatts".
  assert.equal(say('the unit W stands for watt'), 'the unit W stands for watt');
});

test('ordinary words that look like units are safe', () => {
  assert.equal(say('Bar charts and a fine day'), 'Bar charts and a fine day');
});

test('a sentence with no units is returned untouched', () => {
  const line = 'Think of a gear pair trading speed for force.';
  assert.equal(say(line), line);
});

console.log('\ncaption timings');

test('a written word covers every spoken word it produced', () => {
  const { written, map } = expandForSpeech('rated 8760 kWh');
  // Spoken: rated | 8760 | kilowatt | hours
  const words = [
    { word: 'rated', start: 0.0, end: 0.4 },
    { word: '8760', start: 0.4, end: 1.0 },
    { word: 'kilowatt', start: 1.0, end: 1.6 },
    { word: 'hours', start: 1.6, end: 2.0 },
  ];
  const out = collapseTimings(words, written, map);
  assert.deepEqual(out.map((w) => w.word), ['rated', '8760', 'kWh']);
  // "kWh" must be lit for the whole of "kilowatt hours", not just the first.
  assert.equal(out[2].start, 1.0);
  assert.equal(out[2].end, 2.0);
});

test('timings are kept as they are when the model returns a different count', () => {
  const { written, map } = expandForSpeech('10 MW');
  // A voice model is free to merge or split words; better a slightly wrong
  // highlight than no captions at all.
  const words = [{ word: 'ten-megawatts', start: 0, end: 1 }];
  assert.deepEqual(collapseTimings(words, written, map), words);
});

test('no timings at all is not an error', () => {
  const { written, map } = expandForSpeech('10 MW');
  assert.deepEqual(collapseTimings([], written, map), []);
});

test('every spoken word maps to a real written word', () => {
  const { spoken, written, map } = expandForSpeech('A 100MW plant at 33 kV and 50 Hz.');
  assert.equal(spoken.split(' ').length, map.length);
  assert.ok(map.every((i) => i >= 0 && i < written.length));
});

console.log('\n' + passed + ' checks passed\n');
