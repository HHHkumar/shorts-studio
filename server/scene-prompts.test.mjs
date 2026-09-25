// Run: node server/scene-prompts.test.mjs
//
// Drawing prompts for scenes with no honest photo: which scenes are asked for,
// and what is taken back out of the answers.

import {
  MAX_SCENES, PROMPT_LIMIT, answerSceneIndex, buildScenePromptRequest, normalizeScenePrompts,
} from './scene-prompts.mjs';

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

const content = {
  subject: 'Basic Electrical Engineering',
  topic: 'Power factor',
  question: 'In a purely inductive circuit, by how much does the current lag the voltage?',
  options: ['0°', '45°', '90°', '180°'],
  correctIndex: 2,
  script: [
    { kind: 'hook', narration: 'This one trips up half of every exam hall.' },
    { kind: 'question', narration: 'In a purely inductive circuit, how far does current lag voltage?' },
    { kind: 'options', narration: 'Zero, forty-five, ninety or one eighty degrees.' },
    { kind: 'answer', narration: 'Ninety degrees.' },
    { kind: 'explain', narration: 'The coil fights every change in current by storing energy in its magnetic field.' },
    { kind: 'outro', narration: 'Follow for one every day.' },
  ],
};

console.log('the request');

test('the answer scene is found', () => assert(answerSceneIndex(content) === 3));
test('an explainer has no answer scene', () => assert(answerSceneIndex({ script: [{ kind: 'explain' }] }) === -1));

test('only the asked-for scenes are marked WRITE, with the whole script as context', () => {
  const text = buildScenePromptRequest(content, [1, 4]);
  assert(/scene 1 \[question\] \(WRITE, BEFORE THE ANSWER\)/.test(text), text);
  assert(/scene 4 \[explain\] \(WRITE\): The coil/.test(text), text);
  assert(/scene 0 \[hook\]: This one/.test(text), 'unmarked context scene missing');
  assert(/Return prompts for scenes 1, 4\./.test(text), text);
});

test('the request never says which option is correct', () => {
  const text = buildScenePromptRequest(content, [1]);
  assert(!/correct/i.test(text), text);
});

console.log('\nthe answers');

test('prompts are kept by scene, for asked-for scenes only', () => {
  const { prompts } = normalizeScenePrompts({ prompts: [
    { scene: 4, prompt: 'A copper coil wrapped round an iron core, its magnetic field shown as glowing loops.' },
    { scene: 5, prompt: 'Not asked for.' },
  ] }, content, [4]);
  assert(Object.keys(prompts).join() === '4' && /copper coil/.test(prompts[4]), JSON.stringify(prompts));
});

test('a picture that gives the answer away before the answer scene is replaced', () => {
  const { prompts, notes } = normalizeScenePrompts({ prompts: [
    { scene: 1, prompt: 'Two sine waves exactly 90° apart on an oscilloscope.' },
  ] }, content, [1]);
  assert(!/90/.test(prompts[1]) && /Power factor/.test(prompts[1]), prompts[1]);
  assert(notes.length === 1 && /Scene 1/.test(notes[0]), JSON.stringify(notes));
});

test('after the answer, showing it is fine', () => {
  const { prompts } = normalizeScenePrompts({ prompts: [
    { scene: 4, prompt: 'Two sine waves 90° apart, the current wave trailing.' },
  ] }, content, [4]);
  assert(/90°/.test(prompts[4]), prompts[4]);
});

test('lettering words and markdown are stripped', () => {
  const { prompts } = normalizeScenePrompts({ prompts: [
    { scene: 4, prompt: '**A coil** with text labels on each turn' },
  ] }, content, [4]);
  assert(!/text|labels|\*/.test(prompts[4]), prompts[4]);
});

test('over-long prompts are cut at a word', () => {
  const { prompts } = normalizeScenePrompts({ prompts: [{ scene: 4, prompt: 'glowing coil '.repeat(60) }] }, content, [4]);
  assert(prompts[4].length <= PROMPT_LIMIT && /(coil|glowing)$/.test(prompts[4]), prompts[4].slice(-20));
});

test('empty, duplicate and malformed entries are ignored', () => {
  const { prompts } = normalizeScenePrompts({ prompts: [
    { scene: 4, prompt: '' }, { scene: 'four', prompt: 'x' }, { scene: 4, prompt: 'First real one' }, { scene: 4, prompt: 'Second' },
  ] }, content, [4]);
  assert(prompts[4] === 'First real one', JSON.stringify(prompts));
});

test('a reply with no prompts array gives nothing, not a crash', () => {
  assert(Object.keys(normalizeScenePrompts(null, content, [4]).prompts).length === 0);
});

test('one request is capped at a sensible number of scenes', () => assert(MAX_SCENES >= 20));

console.log('\n' + passed + ' checks passed');
