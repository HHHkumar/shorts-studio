// Run: node src/lib/delivery.test.mjs
//
// How the voice says each line: the Eleven v4 audio tag a scene is spoken
// with, and the captions that must never show it.

import {
  cleanDelivery, DELIVERY_BY_KIND, deliveryFor, deliveryPromptWords, directedText, dropBracketed, splitLeadingTags,
  takesAudioTags,
} from './delivery.ts';

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

console.log('\nwhich models');

test('v3 and v4 take tags; v2, Turbo and Flash would read them out', () => {
  for (const id of ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3']) assert(takesAudioTags(id), id);
  for (const id of ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', '', undefined, 'eleven_v40x']) {
    assert(!takesAudioTags(id), String(id) + ' was taken for a tag model');
  }
});

console.log('\nwhat a direction may say');

test('a direction in the vocabulary is kept, tidied', () => {
  assert(cleanDelivery('curious') === 'curious');
  assert(cleanDelivery('  Confident,  PLEASED ') === 'confident, pleased');
  assert(cleanDelivery('[playful, building suspense]') === 'playful, building suspense');
  assert(cleanDelivery('warm; clear') === 'warm, clear');
});

test('sounds, accents, shouts, laughs and pauses are refused, part by part', () => {
  assert(cleanDelivery('thunder rumbling') === '');
  assert(cleanDelivery('British accent') === '');
  assert(cleanDelivery('shouts') === '' && cleanDelivery('laughs') === '' && cleanDelivery('long pause') === '');
  assert(cleanDelivery('excited, pirate voice') === 'excited', cleanDelivery('excited, pirate voice'));
  assert(cleanDelivery('crying, curious') === 'curious');
});

test('no more than three parts, no repeats, nothing only made of joining words', () => {
  assert(cleanDelivery('warm, clear, calm, curious') === 'warm, clear, calm');
  assert(cleanDelivery('warm, warm') === 'warm');
  assert(cleanDelivery('with a, very') === '');
  assert(cleanDelivery(null) === '' && cleanDelivery(42) === '');
  assert(cleanDelivery('slightly teasing, with a smile') === 'slightly teasing, with a smile');
});

test('every usual direction passes its own vocabulary, and every kind of scene has one', () => {
  for (const [kind, tag] of Object.entries(DELIVERY_BY_KIND)) {
    if (kind === 'countdown') continue;
    assert(tag && cleanDelivery(tag) === tag, kind + ': "' + tag + '" would be refused');
  }
  for (const kind of ['hook', 'question', 'options', 'answer', 'explain', 'outro']) assert(DELIVERY_BY_KIND[kind], kind);
  assert(deliveryPromptWords().includes('curious') && !deliveryPromptWords().includes('with'));
});

test('a scene with no direction, or a refused one, is said the usual way for its kind', () => {
  assert(deliveryFor({ kind: 'question' }) === DELIVERY_BY_KIND.question);
  assert(deliveryFor({ kind: 'answer', delivery: 'thunder' }) === DELIVERY_BY_KIND.answer);
  assert(deliveryFor({ kind: 'answer', delivery: 'proud' }) === 'proud');
  assert(deliveryFor({ kind: 'something-new' }) === DELIVERY_BY_KIND.explain);
});

console.log('\nwhat the voice is sent');

test('the direction goes in front, for a tag model only', () => {
  const line = { kind: 'hook', delivery: 'intrigued' };
  assert(directedText('Most people get this wrong.', line, 'eleven_v4') === '[intrigued] Most people get this wrong.');
  assert(directedText('Most people get this wrong.', line, 'eleven_multilingual_v2') === 'Most people get this wrong.');
  assert(directedText('Why?', { kind: 'question' }, 'eleven_v4') === '[' + DELIVERY_BY_KIND.question + '] Why?');
});

test('text that already carries a direction keeps its own, and a bare word with no scene gets none', () => {
  const own = '[slow and clear, like a teacher] ಕ.';
  assert(directedText(own, { kind: 'explain' }, 'eleven_v4') === own);
  assert(directedText('ಕ.', null, 'eleven_v4') === 'ಕ.', 'a tool speaking one letter was given a direction');
  assert(directedText('', { kind: 'hook' }, 'eleven_v4') === '');
});

test('leading directions are split from the words, however many', () => {
  assert(JSON.stringify(splitLeadingTags('[warm] [softly]  Hello there')) === JSON.stringify({ tags: '[warm] [softly]', rest: 'Hello there' }));
  assert(splitLeadingTags('Hello [warm] there').tags === '', 'a bracket in the middle was taken for a leading tag');
  assert(splitLeadingTags('Plain').rest === 'Plain');
});

console.log('\nwhat the captions are timed from');

const timed = (text, step = 0.05) => {
  const characters = [...text];
  return { characters, starts: characters.map((_, i) => i * step), ends: characters.map((_, i) => (i + 1) * step) };
};

test('the tag and its space come out of the timings; the words keep their own times', () => {
  const t = timed('[warm, clear] Hello world');
  const out = dropBracketed(t.characters, t.starts, t.ends);
  assert(out.characters.join('') === 'Hello world', JSON.stringify(out.characters.join('')));
  assert(out.starts[0] === t.starts[14], 'Hello no longer starts when it was spoken');
  assert(out.characters.length === out.starts.length && out.starts.length === out.ends.length);
});

test('a tag in the middle leaves one space between the words around it', () => {
  const t = timed('Wait [gasps] what');
  assert(dropBracketed(t.characters, t.starts, t.ends).characters.join('') === 'Wait what');
  const n = timed('no tags at all');
  assert(dropBracketed(n.characters, n.starts, n.ends).characters.join('') === 'no tags at all');
  const close = timed('a ] b');
  assert(dropBracketed(close.characters, close.starts, close.ends).characters.join('') === 'a ] b', 'a lone closing bracket swallowed text');
});

console.log('\n' + passed + ' checks passed');
