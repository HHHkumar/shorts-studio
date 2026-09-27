// Run: node server/hooks.test.mjs
//
// Other hooks and thumbnail headlines: what the model is told, and what of
// its reply is kept.

import { buildHookRequest, HOOK_SYSTEM, tidyHooks } from './hooks.mjs';

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
  subject: 'Electrical', topic: 'AC', question: 'What is the RMS value of a 325 V peak?',
  options: ['230 V', '325 V', '162 V', '460 V'], correctIndex: 0,
  script: [{ kind: 'hook', narration: 'Your socket hides a bigger number.' }],
};

test('the request carries the question, the options and the current hook', () => {
  const r = buildHookRequest(quiz);
  assert(r.includes('QUESTION: What is the RMS') && r.includes('OPTIONS: 230 V') && r.includes('THE CURRENT HOOK: Your socket'), r);
});

test('the model is told never to give the answer away', () => {
  assert(/never reveal or hint at the correct answer/i.test(HOOK_SYSTEM));
});

test('a hook naming the answer is dropped; the others are kept', () => {
  const out = tidyHooks({ hooks: ['It is 230 V, obviously.', 'Most engineers get this one wrong.'], headlines: [] }, quiz);
  assert(out.hooks.length === 1 && out.hooks[0].startsWith('Most'), JSON.stringify(out.hooks));
});

test('too long, duplicated, or the same as now: dropped', () => {
  const long = 'This hook goes on and on and on and on and on and on and on and on and on';
  const out = tidyHooks({ hooks: [long, 'A short one.', 'a short one.', 'Your socket hides a bigger number.'], headlines: [] }, quiz);
  assert(out.hooks.length === 1, JSON.stringify(out.hooks));
});

test('headlines keep their *emphasis* and stay short', () => {
  const out = tidyHooks({ hooks: [], headlines: ['The *hidden* voltage', 'Way too many words in this one here'] }, quiz);
  assert(out.headlines.length === 1 && out.headlines[0] === 'The *hidden* voltage', JSON.stringify(out.headlines));
});

test('a bad reply gives empty lists, not an error', () => {
  const out = tidyHooks(null, quiz);
  assert(out.hooks.length === 0 && out.headlines.length === 0);
});

console.log('\n' + passed + ' checks passed');
