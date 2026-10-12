// Run: node server/sketch-shelves.test.mjs
//
// Which sketches a video is shown: the ones for its subject, and never a
// shelf that names a sketch which does not exist.

import { SKETCH_NAMES } from './sketch-catalogue.mjs';
import { SHELVES, shelvesFor, shortlist } from './sketch-shelves.mjs';
import { sketchPromptLines } from './sketch-contract.mjs';
import { quizSystemFor, QUIZ_SYSTEM } from './gemini.mjs';

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
const shown = (options) => shortlist(SKETCH_NAMES, options);

test('every sketch on a shelf exists', () => {
  const ghosts = [...new Set(Object.values(SHELVES).flat())].filter((n) => !SKETCH_NAMES.includes(n));
  assert(!ghosts.length, 'on a shelf, and not in the library: ' + ghosts.join(', '));
});

test('every sketch is on a shelf: one left off would be shown to every subject', () => {
  const shelved = new Set(Object.values(SHELVES).flat());
  const loose = SKETCH_NAMES.filter((n) => !shelved.has(n));
  assert(!loose.length, 'on no shelf: ' + loose.join(', '));
});

test('an electrical video is shown the electrical sketches, and not biology or seating puzzles', () => {
  const list = shown({ contentType: 'electrical', subject: 'Electrical Machines', topic: 'Induction motor torque' });
  for (const want of ['circuit', 'phasors', 'torque-slip', 'scr-characteristic', 'resonance-curve', 'transformer-efficiency', 'graph', 'flowchart', 'power-time']) {
    assert(list.includes(want), want + ' is missing from an electrical video');
  }
  for (const not of ['dna', 'mitosis', 'seating', 'parts-of-speech', 'titration', 'moon-phases', 'supply-demand']) {
    assert(!list.includes(not), not + ' is offered to an electrical video');
  }
  assert(list.length < SKETCH_NAMES.length * 0.5, 'an electrical video is still shown ' + list.length + ' of ' + SKETCH_NAMES.length);
});

test('an aptitude video is shown the puzzles, and an English one the grammar', () => {
  const maths = shown({ contentType: 'aptitude', subject: 'Time & Work' });
  assert(maths.includes('seating') && maths.includes('clock') && maths.includes('ratio-bar') && !maths.includes('circuit'));
  const english = shown({ contentType: 'aptitude', subject: 'English Grammar' });
  assert(english.includes('parts-of-speech') && english.includes('para-jumble'), 'no grammar for an English paper');
});

test('the sections of the aptitude paper that are not aptitude get their own subject', () => {
  const science = shown({ contentType: 'aptitude', subject: 'General Science' });
  assert(science.includes('atom') && science.includes('cell') && science.includes('pendulum') && !science.includes('seating'), 'a science question is offered puzzles');
  const computer = shown({ contentType: 'aptitude', subject: 'Computer Awareness' });
  assert(computer.includes('logic-gate') && computer.includes('network-topology') && !computer.includes('seating'));
  for (const subject of ['General Awareness & Current Affairs', 'Static GK — History, Geography & Polity']) {
    assert(shelvesFor({ contentType: 'aptitude', subject }) === null, subject + ' was guessed at');
  }
});

test('the subject decides, never a word in the topic', () => {
  const gk = { contentType: 'general', subject: 'General Knowledge', topic: 'The power of compounding' };
  assert(shelvesFor(gk) === null, 'a topic with "power" in it was taken for an electrical one');
  const bio = shown({ contentType: 'general', subject: 'Biology', topic: 'Quantum effects in photosynthesis' });
  assert(bio.includes('photosynthesis'), 'a word in the topic moved a biology video to another shelf');
});

test('a general subject is matched by its name', () => {
  assert(shown({ contentType: 'general', subject: 'Biology' }).includes('mitosis') && !shown({ contentType: 'general', subject: 'Biology' }).includes('torque-slip'));
  assert(shown({ contentType: 'general', subject: 'Physics' }).includes('pendulum'));
  assert(shown({ contentType: 'general', subject: 'Astronomy & Space' }).includes('moon-phases'));
});

test('a subject nobody has a shelf for is shown the whole library, not a guess', () => {
  assert(shelvesFor({ contentType: 'general', subject: 'History of Science' }) === null);
  assert(shown({ contentType: 'general', subject: 'History of Science' }).length === SKETCH_NAMES.length);
  assert(shown(undefined).length === SKETCH_NAMES.length && shown({}).length === SKETCH_NAMES.length);
});

test('the prompt for a video is much shorter, and still carries what its subject needs', () => {
  const all = sketchPromptLines().join('\n');
  const electrical = sketchPromptLines({ contentType: 'electrical', subject: 'Power Systems' }).join('\n');
  assert(electrical.length < all.length * 0.55, 'electrical ' + electrical.length + ' against ' + all.length);
  assert(electrical.includes('- circuit: ') && electrical.includes('must state: mode, network'), 'the circuit and its contract are not in it');
  assert(electrical.includes('A SKETCH IS DRAWN EXACTLY AS YOU STATE IT'), 'the rules that head the list were lost with it');
  assert(!electrical.includes('- mitosis: '));
  const system = quizSystemFor({ contentType: 'electrical', subject: 'Power Systems' });
  assert(system.length < QUIZ_SYSTEM.length * 0.6 && system.includes('- scr-characteristic: '), 'the system prompt was not shortened: ' + system.length + ' against ' + QUIZ_SYSTEM.length);
});

console.log('\n' + passed + ' checks passed');
