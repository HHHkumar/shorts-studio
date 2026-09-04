// Run: node src/lib/motion-lexicon.test.mjs
//
// The vocabulary is the contract. A missed word costs one effect nobody knew
// was coming; a FALSE one makes the video react to something the narration did
// not say, which a viewer notices immediately even if they cannot say why. So
// most of what follows is about words that must NOT fire.

import assert from 'node:assert/strict';
import { detectEffects, effectForWord, envelope, motionWordsIn } from './motion-lexicon.ts';

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

/** One word a second, so every expected time is readable by eye. */
const say = (text) => text.split(/\s+/).map((word, i) => ({ word, start: i, end: i + 1 }));

console.log('\nwords that should fire');

test('the plain verb forms all match their stem', () => {
  for (const w of ['flows', 'flowing', 'flowed', 'pours', 'travels']) {
    assert.equal(effectForWord(w), 'flow', w);
  }
  for (const w of ['spins', 'spinning', 'rotates', 'rotating', 'revolves', 'orbits']) {
    assert.equal(effectForWord(w), 'spin', w);
  }
  for (const w of ['heats', 'heated', 'burning', 'boils', 'combustion']) {
    assert.equal(effectForWord(w), 'heat', w);
  }
});

test('punctuation and capitals do not stop a match', () => {
  assert.equal(effectForWord('Flows,'), 'flow');
  assert.equal(effectForWord('SPINS.'), 'spin');
  assert.equal(effectForWord('"escapes"'), 'burst');
});

test('the engineering vocabulary this tool is actually used for is covered', () => {
  assert.equal(effectForWord('turbine'), 'spin');
  assert.equal(effectForWord('voltage'), 'spark');
  assert.equal(effectForWord('circuit'), 'spark');
  assert.equal(effectForWord('condenses'), 'cool');
  assert.equal(effectForWord('pressure'), null, 'pressure alone is not a movement');
});

console.log('\nwords that must NOT fire');

test('ordinary English is left alone', () => {
  // Every one of these was either a stem prefix at some point, or looks like
  // one. A false fire here would put particles on screen during a sentence
  // about nothing of the kind.
  for (const w of ['the', 'and', 'a', 'is', 'it', 'this', 'that', 'them', 'they',
    'because', 'through', 'about', 'into', 'over', 'under', 'what', 'which',
    'people', 'thing', 'something', 'anything', 'important', 'different']) {
    assert.equal(effectForWord(w), null, w + ' should not fire an effect');
  }
});

test('very short words never match, whatever they start with', () => {
  // "up", "arc", "hot" as bare words are usually not the physical event.
  for (const w of ['up', 'in', 'on', 'at', 'to', 'of']) {
    assert.equal(effectForWord(w), null, w);
  }
});

test('junk does not throw', () => {
  assert.equal(effectForWord(''), null);
  assert.equal(effectForWord('???'), null);
  assert.equal(effectForWord(null), null);
  assert.equal(effectForWord(undefined), null);
});

console.log('\nfiring on the voice');

const NARRATION = 'steam flows into the turbine and the metal heats until it glows '
  + 'and most of that energy escapes as waste before it reaches a wire';

test('an effect starts on the second its word is spoken', () => {
  const effects = detectEffects(say(NARRATION), 40);
  const first = effects[0];
  assert.equal(first.kind, 'flow');
  assert.equal(first.word, 'flows');
  assert.equal(first.at, 1, '"flows" is the second word, so one second in');
});

test('effects come out in the order they are said', () => {
  const effects = detectEffects(say(NARRATION), 40);
  for (let i = 1; i < effects.length; i++) {
    assert.ok(effects[i].at > effects[i - 1].at, 'out of order at ' + i);
  }
});

test('two triggers close together do not both fire', () => {
  // "spins" and "rotates" back to back would otherwise stack two effects on
  // the same beat and read as noise rather than emphasis.
  const effects = detectEffects(say('the wheel spins rotates turns quickly now'), 20);
  assert.equal(effects.length, 1, JSON.stringify(effects));
});

test('a scene never gets more than four', () => {
  const busy = 'flows spins heats escapes glows rains sparks collides rises falls '
    + 'flows spins heats escapes glows rains sparks collides rises falls';
  // Spaced a second apart, so the gap rule alone would allow far more.
  const effects = detectEffects(say(busy).map((w, i) => ({ ...w, start: i * 3, end: i * 3 + 1 })), 90);
  assert.ok(effects.length <= 4, 'got ' + effects.length);
});

test('a trigger too near the end is skipped, because it could not be seen', () => {
  const effects = detectEffects(say('nothing happens here at all until it explodes'), 7);
  assert.deepEqual(effects, [], JSON.stringify(effects));
});

test('no timings means no effects, rather than guessed ones', () => {
  // An effect at the wrong moment is worse than none: it makes the video look
  // like it is reacting to something the viewer cannot hear.
  assert.deepEqual(detectEffects([], 20), []);
  assert.deepEqual(detectEffects(null, 20), []);
});

test('a narration with no motion in it produces nothing', () => {
  const calm = say('this is a question about what people believe and why they believe it');
  assert.deepEqual(detectEffects(calm, 20), []);
});

console.log('\nthe envelope');

test('it starts at nothing, holds, and returns to nothing', () => {
  assert.equal(envelope(0), 0);
  assert.equal(envelope(1), 0);
  assert.ok(envelope(0.5) > 0.99, 'should be fully up in the middle');
  for (const t of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
    const v = envelope(t);
    assert.ok(v >= 0 && v <= 1, t + ' gave ' + v);
  }
});

console.log('\nwhat the editor is told');

test('the editor sees the same words the renderer will act on', () => {
  const found = motionWordsIn('Steam flows in and the turbine spins.');
  assert.deepEqual(found.map((f) => f.kind), ['flow', 'spin', 'spin']);
  assert.deepEqual(found.map((f) => f.word), ['flows', 'turbine', 'spins']);
});

test('a calm sentence reports nothing to the editor either', () => {
  assert.deepEqual(motionWordsIn('Why do people believe this?'), []);
});

console.log('\n' + passed + ' checks passed\n');
