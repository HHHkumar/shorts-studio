// Run: node src/lib/doodle.test.mjs
//
// Which scenes get a drawing of the mascot, and how wild each may be.

import {
  DEFAULT_DOODLE_ENERGY, DOODLE_FIELD_LIMITS, doodleScenes, energyFor, fieldLabels, tidyDirection, wantsDoodle,
} from './doodle.ts';

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

console.log('\nenergy');

test('a teaching scene stays calm even when the dial says chaotic', () => {
  for (const kind of ['explain', 'recap', 'process', 'timeline', 'grid', 'versus']) {
    assert(energyFor(kind, 'chaotic') === 'calm', kind + ' was allowed ' + energyFor(kind, 'chaotic'));
  }
});

test('the hook and the reveal may go all the way', () => {
  assert(energyFor('hook', 'chaotic') === 'chaotic' && energyFor('answer', 'chaotic') === 'chaotic');
});

test('the dial is a maximum - calm means calm everywhere', () => {
  for (const kind of ['hook', 'answer', 'question', 'title', 'explain']) {
    assert(energyFor(kind, 'calm') === 'calm', kind + ' went above calm');
  }
});

test('a scene kind nobody listed is held at lively', () => {
  assert(energyFor('something-new', 'chaotic') === 'lively');
});

test('an unknown or missing dial reads as the default', () => {
  assert(energyFor('hook', undefined) === DEFAULT_DOODLE_ENERGY);
  assert(energyFor('hook', 'volcanic') === DEFAULT_DOODLE_ENERGY);
});

console.log('\nwhich scenes');

test('a plain scene gets a doodle', () => {
  assert(wantsDoodle({ kind: 'hook', narration: 'x' }));
});

test('a scene showing its own diagram does not', () => {
  assert(!wantsDoodle({ kind: 'question', narration: 'x', visual: { kind: 'figure' } }, true));
  assert(!wantsDoodle({ kind: 'explain', narration: 'x', visual: { kind: 'bars' } }, true));
});

test('with diagrams switched off, that scene gets its doodle back', () => {
  assert(wantsDoodle({ kind: 'question', narration: 'x', visual: { kind: 'figure' } }, false));
});

test('a visual of kind none is no visual', () => {
  assert(wantsDoodle({ kind: 'explain', narration: 'x', visual: { kind: 'none' } }, true));
});

test('explainer layouts that are pictures themselves never get one', () => {
  assert(!wantsDoodle({ kind: 'diagram', narration: 'x' }) && !wantsDoodle({ kind: 'motion', narration: 'x' }));
});

test('the list of scenes keeps the script order and skips the rest', () => {
  const script = [
    { kind: 'hook', narration: 'a' },
    { kind: 'question', narration: 'b', visual: { kind: 'figure' } },
    { kind: 'options', narration: 'c' },
    { kind: 'diagram', narration: 'd' },
    { kind: 'answer', narration: 'e' },
  ];
  assert(JSON.stringify(doodleScenes(script)) === '[0,2,4]', 'got ' + JSON.stringify(doodleScenes(script)));
});

test('no script is no scenes, not a crash', () => {
  assert(doodleScenes(null).length === 0 && doodleScenes(undefined).length === 0);
});

console.log('\ndirections');

test('a direction with no action is no direction', () => {
  assert(tidyDirection({ emotion: 'happy', props: 'a bulb' }) === null);
  assert(tidyDirection(null) === null);
});

test('missing fields are filled with something drawable', () => {
  const d = tidyDirection({ action: 'waves' });
  assert(d.emotion === 'friendly' && d.props === '' && d.gag === 'none');
});

test('every field is held to its length, cut at a word', () => {
  const long = 'reaches across the bench '.repeat(20);
  const d = tidyDirection({ action: long, emotion: long, props: long, gag: long });
  for (const key of Object.keys(DOODLE_FIELD_LIMITS)) {
    assert(d[key].length <= DOODLE_FIELD_LIMITS[key], key + ' is ' + d[key].length);
    assert(!/\s$/.test(d[key]) && long.includes(d[key]), key + ' was cut mid-word');
  }
});

test('whitespace is tidied', () => {
  assert(tidyDirection({ action: '  points   at\n the meter ' }).action === 'points at the meter');
});

console.log('\nsubjects');

test('an illustration stays an illustration', () => {
  assert(tidyDirection({ subject: 'illustration', action: 'a coil of wire' }).subject === 'illustration');
});

test('no subject, or one nobody knows, is the engineer', () => {
  assert(tidyDirection({ action: 'waves' }).subject === 'mascot');
  assert(tidyDirection({ subject: 'robot', action: 'waves' }).subject === 'mascot');
});

test('an illustration may have no mood; the engineer always has a feeling', () => {
  assert(tidyDirection({ subject: 'illustration', action: 'a coil' }).emotion === '');
  assert(tidyDirection({ subject: 'mascot', action: 'waves' }).emotion === 'friendly');
});

test('the boxes are labelled for what goes in them', () => {
  assert(fieldLabels('illustration').action === 'Shows' && fieldLabels('mascot').action === 'Doing');
  assert(fieldLabels(undefined).emotion === 'Feeling', 'an older direction is the engineer');
});

console.log('\n' + passed + ' checks passed');
