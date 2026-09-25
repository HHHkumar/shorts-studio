// Run: node server/doodle-directions.test.mjs
//
// Gemini's scene directions for the mascot: what is asked for, and what is
// taken back out of the answers before anything is drawn.

import {
  buildDirectionRequest, DIRECTION_SYSTEM, MAX_DIRECTED, normalizeDirections,
} from './doodle-directions.mjs';

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

const quiz = {
  subject: 'Electrical Measurements',
  topic: 'Energy meters',
  question: 'An energy meter disc keeps turning with no load connected. What is this called?',
  options: ['Creeping', 'Phase error', 'Friction compensation', 'Speed error'],
  correctIndex: 0,
  script: [
    { kind: 'hook', narration: 'Your meter is spinning with everything switched off.' },
    { kind: 'question', narration: 'What is this called?' },
    { kind: 'answer', narration: 'It is creeping.' },
    { kind: 'explain', narration: 'Over-compensation for friction keeps the disc turning.' },
  ],
};

const direction = (scene, extra = {}) => ({
  scene, action: 'points at the meter', emotion: 'puzzled', props: 'an energy meter', gag: 'none', ...extra,
});

console.log('\nthe request');

test('only the scenes asked for are marked WRITE', () => {
  const req = buildDirectionRequest(quiz, [0, 3], 'lively');
  assert(/scene 0 \[hook\] \(WRITE/.test(req) && /scene 3 \[explain\] \(WRITE/.test(req));
  assert(!/scene 1 \[question\] \(WRITE/.test(req), 'scene 1 was not asked for');
});

test('every scene is still shown, for context', () => {
  const req = buildDirectionRequest(quiz, [0], 'lively');
  for (let i = 0; i < quiz.script.length; i++) assert(req.includes('scene ' + i + ' ['), 'scene ' + i + ' missing');
});

test('each scene carries the energy it will be drawn at, after its cap', () => {
  const req = buildDirectionRequest(quiz, [0, 3], 'chaotic');
  assert(/scene 0 \[hook\] \(WRITE, energy chaotic/.test(req), 'the hook should be chaotic');
  assert(/scene 3 \[explain\] \(WRITE, energy calm/.test(req), 'the explanation must stay calm');
});

test('scenes before the answer are marked, and the ones after are not', () => {
  const req = buildDirectionRequest(quiz, [0, 1, 3], 'lively');
  assert(/scene 0 .*BEFORE THE ANSWER/.test(req) && /scene 1 .*BEFORE THE ANSWER/.test(req));
  assert(!/scene 3 .*BEFORE THE ANSWER/.test(req), 'the explanation comes after the reveal');
});

test('an explainer has no answer, so nothing is marked before it', () => {
  const explainer = { subject: 'Power', topic: 'Turbines', script: [{ kind: 'title', narration: 'x' }, { kind: 'recap', narration: 'y' }] };
  assert(!/BEFORE THE ANSWER/.test(buildDirectionRequest(explainer, [0, 1], 'lively')));
});

test('the model is told never to describe the character', () => {
  assert(/never describe what the engineer\s+looks like/.test(DIRECTION_SYSTEM));
});

test('the model is told about written sound effects', () => {
  assert(/written sound effects/.test(DIRECTION_SYSTEM));
});

test('a long explainer still goes in one request', () => assert(MAX_DIRECTED >= 30));

console.log('\nwhat comes back');

test('a clean direction is kept as it is', () => {
  const out = normalizeDirections({ directions: [direction(0)] }, quiz, [0]);
  assert(out.directions[0].action === 'points at the meter' && out.notes.length === 0);
});

test('a scene nobody asked for is ignored', () => {
  const out = normalizeDirections({ directions: [direction(2)] }, quiz, [0]);
  assert(out.directions[2] === undefined);
});

test('a second direction for the same scene is ignored', () => {
  const out = normalizeDirections({ directions: [direction(0), direction(0, { action: 'jumps' })] }, quiz, [0]);
  assert(out.directions[0].action === 'points at the meter');
});

test('an action that names the answer before the reveal drops the whole direction', () => {
  const out = normalizeDirections({ directions: [direction(1, { action: 'holds up a sign reading creeping' })] }, quiz, [1]);
  assert(out.directions[1] === undefined, 'a spoiler with its noun removed is still a spoiler');
  assert(out.notes.some((n) => /Scene 1/.test(n)), 'the creator should be told why');
});

test('a prop that names the answer before the reveal is removed, the rest kept', () => {
  const out = normalizeDirections({ directions: [direction(0, { props: 'a meter creeping slowly' })] }, quiz, [0]);
  assert(out.directions[0] && out.directions[0].props === '' && out.directions[0].action === 'points at the meter');
});

test('a gag that names the answer before the reveal becomes none', () => {
  const out = normalizeDirections({ directions: [direction(0, { gag: 'the word creeping in the clouds' })] }, quiz, [0]);
  assert(out.directions[0].gag === 'none');
});

test('after the reveal, naming the answer is fine', () => {
  const out = normalizeDirections({ directions: [direction(3, { action: 'explains creeping at a whiteboard' })] }, quiz, [3]);
  assert(out.directions[3] && /creeping/.test(out.directions[3].action));
});

test('naming a WRONG option before the reveal is not a spoiler', () => {
  const out = normalizeDirections({ directions: [direction(0, { props: 'a speedometer showing speed error' })] }, quiz, [0]);
  assert(out.directions[0].props.length > 0);
});

test('markdown and quotes are stripped from every field', () => {
  const out = normalizeDirections({ directions: [direction(0, { action: '**points** at the `meter`', emotion: '"puzzled"' })] }, quiz, [0]);
  assert(out.directions[0].action === 'points at the meter' && out.directions[0].emotion === 'puzzled');
});

test('a reply with no directions array gives nothing, not a crash', () => {
  assert(Object.keys(normalizeDirections(null, quiz, [0]).directions).length === 0);
  assert(Object.keys(normalizeDirections({ directions: 'nope' }, quiz, [0]).directions).length === 0);
});

console.log('\n' + passed + ' checks passed');
