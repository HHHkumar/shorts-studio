// Run: node --import ./tools/ts-resolve.mjs src/lib/varnamale.test.mjs
//
// The alphabet video is only as right as its list. A letter missing, doubled,
// or two clips sharing an id would each still render - and teach it wrong.

import { allSpoken, buildTimeline, LETTERS, lettersBefore, segmentAt, totalFrames, voiceLine } from './varnamale.ts';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

console.log('\nthe letters');
const count = (g) => LETTERS.filter((l) => l.group === g).length;
ok('49 in all', LETTERS.length === 49, String(LETTERS.length));
ok('13 vowels, 2 yogavahas, 34 consonants',
   count('svara') === 13 && count('yogavaha') === 2 && LETTERS.length - 15 === 34);
ok('every varga has five', ['ka', 'cha', 'tta', 'ta', 'pa'].every((g) => count(g) === 5));
ok('no glyph twice', new Set(LETTERS.map((l) => l.glyph)).size === LETTERS.length);
ok('no romanisation twice', new Set(LETTERS.map((l) => l.roman)).size === LETTERS.length);
ok('every glyph is Kannada script', LETTERS.every((l) => [...l.glyph].every((ch) => ch >= 'ಀ' && ch <= '೿')));

console.log('\nthe clips');
const spoken = allSpoken();
ok('one clip id per line said', new Set(spoken.map((s) => s.id)).size === spoken.length);
ok('every letter is said', LETTERS.every((l) => spoken.some((s) => s.id === l.id && s.text === l.glyph)));

console.log('\nthe voiceover script');
const strip = (s) => s.replace(/\[[^\]]*\]/g, '').trim();
const v4 = spoken.map((s) => voiceLine(s, 'eleven_v4'));
ok('every v4 line opens with a direction', v4.every((s) => /^\[[^\]]+\] /.test(s)));
ok('directions never touch the Kannada', spoken.every((s, i) => strip(v4[i]).startsWith(s.text)));
ok('every line ends on punctuation', v4.every((s) => /[.!]$/.test(s)));
ok('a letter is said alone - no other Kannada in its line',
   spoken.every((s, i) => s.kind !== 'letter' || strip(v4[i]) === s.text + '.'));
ok('a model that would read tags aloud gets none', spoken.every((s) => !voiceLine(s, 'eleven_multilingual_v2').includes('[')));
ok('v4 Turbo is directed too', voiceLine(spoken[0], 'eleven_v4_turbo').startsWith('['));

console.log('\nthe timeline');
const silent = buildTimeline(null, 30);
ok('starts at frame 0', silent[0].from === 0);
ok('beats are laid end to end', silent.every((s, i) => i === 0 || s.from === silent[i - 1].from + silent[i - 1].frames));
ok('letters are said in order', silent.filter((s) => s.kind === 'letter').every((s, i) => s.letter === i));

const clips = { l05: { src: 'x.mp3', duration: 3 }, l06: { src: 'y.mp3', duration: Number.NaN } };
const voiced = buildTimeline(clips, 30);
const beat = (t, id) => t.find((s) => s.kind === 'letter' && LETTERS[s.letter].id === id);
ok('a long clip holds its letter longer', beat(voiced, 'l05').frames > beat(silent, 'l05').frames);
ok('a clip with no usable length falls back to silent timing', beat(voiced, 'l06').frames === beat(silent, 'l06').frames && beat(voiced, 'l06').clip === null);
ok('total grows by the same amount', totalFrames(voiced) - totalFrames(silent) === beat(voiced, 'l05').frames - beat(silent, 'l05').frames);

console.log('\nwhat is lit');
const first = silent.find((s) => s.kind === 'letter');
ok('nothing is learned during the title', lettersBefore(silent, 0) === 0);
ok('the current letter is not yet counted', lettersBefore(silent, first.from) === 0);
ok('after the last frame, everything', lettersBefore(silent, totalFrames(silent) + 100) === 49);
ok('past the end is the outro', segmentAt(silent, totalFrames(silent) + 100).kind === 'outro');

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
