// Run: node server/delivery-script.test.mjs
//
// The script writers and Eleven v4: each line gets a direction for the voice
// beside it, held to the vocabulary, and the narration - which is also the
// on-screen text - never carries one.

import { normalizeContent, QUIZ_SYSTEM, quizSystemFor } from './gemini.mjs';
import { normalizeStoryboard, STORYBOARD_SYSTEM } from './explainer.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

const base = { subject: 'S', topic: 'T', difficulty: 'D', intro: '' };
const quiz = normalizeContent({
  question: 'q', options: ['a', 'b', 'c', 'd'], correctIndex: 0,
  script: [
    { kind: 'hook', narration: 'Most people get this wrong.', delivery: 'Intrigued, PLAYFUL' },
    { kind: 'answer', narration: 'It is a.', delivery: 'thunder rumbling' },
    { kind: 'explain', narration: '[excited] The current doubles.', delivery: 'warm, clear' },
    { kind: 'outro', narration: 'Follow for more.' },
  ],
}, base);
const scene = (kind) => quiz.script.find((s) => s.kind === kind);

console.log('\nthe quiz writer');
ok('a direction in the vocabulary is kept, tidied', scene('hook').delivery === 'intrigued, playful', JSON.stringify(scene('hook').delivery));
ok('a refused one is left out, so the scene is said the usual way', !('delivery' in scene('answer')));
ok('a direction written into the narration is taken out of it', scene('explain').narration === 'The current doubles.', scene('explain').narration);
ok('and the line keeps its own direction', scene('explain').delivery === 'warm, clear');
ok('a line with none has no field at all', !('delivery' in scene('outro')));

ok('the system prompt asks for delivery and names the voice', QUIZ_SYSTEM.includes('DELIVERY.') && QUIZ_SYSTEM.includes('ELEVEN V4'));
ok('it lists the vocabulary, not the joining words', /Use only these words[^\n]*curious/.test(QUIZ_SYSTEM) && !/: a, an, the/.test(QUIZ_SYSTEM));
ok('and is the same for a shortlisted video', quizSystemFor({ contentType: 'electrical', subject: 'Power Systems' }).includes('DELIVERY.'));
ok('no SSML or break tags are ever suggested', !/<break|SSML/i.test(QUIZ_SYSTEM.replace(/no stage directions/i, '')));

console.log('\nthe explainer writer');
const board = normalizeStoryboard({
  topic: 'Transformers', question: 'How?', hook: 'h', outro: 'o',
  script: [
    { kind: 'explain', narration: 'You push current through a coil.', delivery: 'thoughtful, warm' },
    { kind: 'explain', narration: '[whispers] And then it hums.', delivery: 'British accent' },
  ],
}, { subject: 'Electrical Machines' });
ok('keeps a direction in the vocabulary', board.script[0].delivery === 'thoughtful, warm', JSON.stringify(board.script[0]));
ok('drops one outside it', !('delivery' in board.script[1]));
ok('and takes directions out of the narration', board.script[1].narration === 'And then it hums.', board.script[1].narration);
ok('its prompt asks for delivery too', STORYBOARD_SYSTEM.includes('DELIVERY.'));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
