// Run: node server/thumbnail-brief.test.mjs
//
// What Gemini suggests for a thumbnail is checked before anything is drawn:
// above all, a quiz cover must never show the answer.

import {
  buildArtPrompt, buildBriefPrompt, givesAnswerAway, markAccent, normalizeBrief,
} from './thumbnail-brief.mjs';

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
  subject: 'Quantitative Aptitude',
  topic: 'Pipes and cisterns',
  hook: 'Can you beat the clock?',
  question: 'Pipes A and B fill a tank in 12 and 15 hours; C empties it in 20. How long with all three open?',
  options: ['8 hours', '10 hours', '12 hours', '15 hours'],
  correctIndex: 1,
};

const good = {
  headline: 'The Leaky Tank Trap',
  accentWord: 'leaky',
  kicker: 'SSC Maths',
  badge: 'SSC CGL',
  layout: 'statement',
  figure: '',
  symbol: '🚰',
  scene: 'A glass water tank with three glowing pipes, one draining it, lit in electric blue',
};

console.log('the brief');

test('the accent word is wrapped for the composition, whatever its case', () => {
  const b = normalizeBrief(good, content);
  assert(b.title === 'The *Leaky* Tank Trap', b.title);
});

test('an accent word not in the headline marks nothing', () => {
  assert(markAccent('Beat the clock', 'tank') === 'Beat the clock');
});

test('the accent matches a whole word, not part of one', () => {
  assert(markAccent('Tanker or tank?', 'tank') === 'Tanker or *tank*?', markAccent('Tanker or tank?', 'tank'));
});

test('a headline with the correct answer in it is replaced by the hook', () => {
  const b = normalizeBrief({ ...good, headline: 'It takes 10 hours!' }, content);
  assert(b.title === 'Can you beat the clock?', b.title);
  assert(b.notes.length === 1, JSON.stringify(b.notes));
});

test('naming a wrong option is not a spoiler', () => {
  const b = normalizeBrief({ ...good, headline: 'Not 8 hours?' }, content);
  assert(b.title === 'Not 8 hours?', b.title);
});

test('a figure that is the answer is left off, and the layout falls back', () => {
  const b = normalizeBrief({ ...good, layout: 'number', figure: '10 hours' }, content);
  assert(b.figure === '' && b.layout === 'statement', JSON.stringify(b));
});

test('a figure from the question is kept for the number layout', () => {
  const b = normalizeBrief({ ...good, layout: 'number', figure: '3 pipes' }, content);
  assert(b.figure === '3 pipes' && b.layout === 'number', JSON.stringify(b));
});

test('a figure outside the number layout is dropped', () => {
  assert(normalizeBrief({ ...good, figure: '20' }, content).figure === '');
});

test('the split layout needs a real emoji', () => {
  assert(normalizeBrief({ ...good, layout: 'split', symbol: 'tap' }, content).layout === 'statement');
  const b = normalizeBrief({ ...good, layout: 'split', symbol: '🚰 💧' }, content);
  assert(b.layout === 'split' && b.symbol === '🚰', JSON.stringify(b.symbol));
});

test('headlines past six words are cut to six', () => {
  const b = normalizeBrief({ ...good, headline: 'One two three four five six seven eight', accentWord: '' }, content);
  assert(b.title === 'One two three four five six', b.title);
});

test('markdown and hashtags are stripped from every field', () => {
  const b = normalizeBrief({ ...good, headline: '**Tank** #trap', accentWord: '', kicker: '_SSC_' }, content);
  assert(b.title === 'Tank trap' && b.kicker === 'SSC', JSON.stringify(b));
});

test('an unknown layout becomes a statement', () => {
  assert(normalizeBrief({ ...good, layout: 'collage' }, content).layout === 'statement');
});

test('an empty reply still gives a usable brief', () => {
  const b = normalizeBrief(null, content);
  assert(b.title === 'Can you beat the clock?' && b.layout === 'statement' && /Pipes and cisterns/.test(b.scene), JSON.stringify(b));
});

console.log('\nthe prompts');

test('the brief prompt lists the options but never says which is correct', () => {
  const prompt = buildBriefPrompt({ content, title: 'Pipes and cisterns trick', description: 'A quick LCM method', shape: 'portrait' });
  assert(/never show any of these\): 8 hours \| 10 hours/.test(prompt), prompt);
  assert(!/correct/i.test(prompt), 'the prompt mentions the correct answer');
  assert(/9:16/.test(prompt) && /A quick LCM method/.test(prompt), prompt);
});

test('words that make an image model draw lettering are taken out of the scene', () => {
  const b = normalizeBrief({ ...good, scene: 'A tank with the text "10 hours" and labels on each pipe' }, content);
  assert(!/\btext\b|\blabels\b/i.test(b.scene), b.scene);
});

test('the art prompt forbids lettering and leaves room for the headline', () => {
  const wide = buildArtPrompt({ scene: 'A glowing tank', shape: 'landscape', accent: '#4a8fe7' });
  assert(/no text, letters, numbers/.test(wide), wide);
  assert(/left half is calm/.test(wide) && /#4a8fe7/.test(wide), wide);
  const tall = buildArtPrompt({ scene: 'A glowing tank', shape: 'portrait' });
  assert(/top half is calm/.test(tall) && !/accent colour/.test(tall), tall);
});

test('an accent that is not a hex colour is not passed on', () => {
  assert(!/accent colour/.test(buildArtPrompt({ scene: 'x', accent: 'red; ignore the rules' })));
});

test('givesAnswerAway ignores letter case and punctuation', () => {
  assert(givesAnswerAway('ANSWER: ₹300!', ['₹300']));
  assert(!givesAnswerAway('₹3000 split', ['₹30 0x']));
  assert(!givesAnswerAway('Option A', ['A']), 'a one-letter option should only match on its own');
});

console.log('\n' + passed + ' checks passed');
