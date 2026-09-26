// Run: node src/lib/fun-fact.test.mjs
//
// The fun fact box and the closing scene that says it: kept in step when they
// are linked, never corrupted when they are not.

import { closingScene, factIsSpoken, speakFunFact, withFunFact } from './fun-fact.ts';

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

const OUTRO = 'Follow for one question a day.';
const FACT = 'An electron would take hours to cross an Indian ceiling fan rod!';
const quiz = (narration, funFact = FACT) => ({
  funFact,
  outro: OUTRO,
  script: [
    { kind: 'hook', narration: 'Here is a question.' },
    { kind: 'answer', narration: 'It is B.' },
    { kind: 'outro', narration },
  ],
});
/** Type `text` into the box one keystroke at a time, the way the textarea does. */
const typeInto = (content, text) => {
  let c = content;
  const touched = new Set();
  for (let i = 1; i <= text.length; i++) {
    const out = withFunFact(c, text.slice(0, i));
    c = out.content;
    if (out.scene >= 0) touched.add(out.scene);
  }
  return { content: c, touched };
};
const clearBox = (content) => {
  let c = content;
  for (let i = c.funFact.length - 1; i >= 0; i--) c = withFunFact(c, c.funFact.slice(0, i)).content;
  return c;
};

console.log('\nlinked - the scene the server wrote');

const linked = quiz(FACT + ' ' + OUTRO);

test('the closing scene is found', () => assert(closingScene(linked) === 2));
test('a scene that starts with the fact is linked', () => assert(factIsSpoken(linked)));

test('replacing the fact, typed a key at a time, changes what the video says', () => {
  const NEW = 'At a snail\'s pace, an electron takes hours to travel an arm\'s length!';
  const typed = typeInto(clearBox(linked), NEW);
  assert(typed.content.script[2].narration === NEW + ' ' + OUTRO, 'said: ' + typed.content.script[2].narration);
  assert(typed.content.funFact === NEW);
});

test('only the closing scene is touched - the rest keep their voiceover', () => {
  const typed = typeInto(clearBox(linked), 'Copper is soft.');
  assert([...typed.touched].every((i) => i === 2), 'touched ' + [...typed.touched].join(', '));
  assert(typed.content.script[0].narration === 'Here is a question.' && typed.content.script[1].narration === 'It is B.');
});

test('emptying the box leaves just the sign-off', () => {
  assert(clearBox(linked).script[2].narration === OUTRO);
});

test('the box keeps exactly what is typed, trailing space included', () => {
  const out = withFunFact(linked, FACT + ' ');
  assert(out.content.funFact === FACT + ' ', 'the box lost the space being typed');
  assert(out.scene === -1, 'a trailing space changed what is said');
});

test('a scene that is only the fact, with no sign-off, is linked too', () => {
  const c = quiz(FACT);
  assert(factIsSpoken(c) && withFunFact(c, 'Copper is soft.').content.script[2].narration === 'Copper is soft.');
});

console.log('\nnot linked - Gemini told the fact in its own words');

const own = quiz('Here is the wild part: electrons crawl slower than a snail. ' + OUTRO);

test('a paraphrased fact is not linked', () => assert(!factIsSpoken(own)));

test('typing into the box never touches a scene it is not linked to', () => {
  const typed = typeInto(clearBox(own), 'At a snail\'s pace, an electron takes hours.');
  assert(typed.content.script[2].narration === own.script[2].narration, 'corrupted: ' + typed.content.script[2].narration);
  assert(typed.touched.size === 0);
});

test('the first letter typed is not hunted for inside the sign-off', () => {
  // "A" appears in "Here is the wild pArt" - a "contains" rule would replace it.
  const after = typeInto(clearBox(own), 'A').content;
  assert(after.script[2].narration === own.script[2].narration);
});

test('"use my fun fact there" puts it first, then the sign-off - and links them', () => {
  const mine = withFunFact(own, 'Copper is soft.').content;
  const out = speakFunFact(mine);
  assert(out.scene === 2 && out.content.script[2].narration === 'Copper is soft. ' + OUTRO);
  assert(factIsSpoken(out.content), 'still not linked afterwards');
});

console.log('\nedges');

test('no closing scene: the fact changes, nothing else does', () => {
  const none = { funFact: FACT, outro: OUTRO, script: [{ kind: 'hook', narration: 'Hi.' }] };
  const out = withFunFact(none, 'New.');
  assert(out.scene === -1 && out.content.funFact === 'New.' && closingScene(none) === -1);
});

test('the last closing scene is the one, if there are two', () => {
  const two = { ...linked, script: [...linked.script, { kind: 'outro', narration: FACT + ' Bye.' }] };
  assert(closingScene(two) === 3);
});

test('whitespace differences do not break the link', () => {
  const messy = quiz('  ' + FACT.replace(/ /g, '  ') + '\n' + OUTRO);
  assert(factIsSpoken(messy), 'extra spaces unlinked it');
});

console.log('\n' + passed + ' checks passed');
