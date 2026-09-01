// Run: node src/lib/blank-script.test.mjs
//
// Node cannot import the .ts module, so - as subtopics.test.mjs already does
// here - this reads the source and replays the two rules that matter: the shape
// of the beats, and how many of them a target length produces. Both are things
// a person writing by hand would otherwise have to work out for themselves.

import fs from 'node:fs';

const src = fs.readFileSync(new URL('./blank-script.ts', import.meta.url), 'utf8');

let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (cond) passed++;
  else failed++;
};

const num = (name) => Number((src.match(new RegExp('const ' + name + ' = ([\\d.]+)')) || [])[1]);
const WPS = num('WORDS_PER_SECOND');
const FIXED = num('QUIZ_FIXED_SECONDS');

/** The same arithmetic the module does, replayed. */
const shape = (kind, target) => {
  if (kind === 'explainer') {
    const words = Math.round(target * WPS);
    const count = Math.max(3, Math.min(30, Math.round(words / 26)));
    return { scenes: count, wordsPerScene: Math.round(words / count) };
  }
  const spare = Math.max(0, target - FIXED);
  const explains = Math.max(1, Math.min(20, Math.round((spare * WPS) / 22)));
  return { scenes: 6 + explains, wordsPerScene: 22, explains };
};

console.log('\nconstants');

ok('the pace matches what the generator budgets with', WPS === 2.6, String(WPS));
ok('the fixed quiz beats are accounted for', FIXED > 0 && FIXED < 40, String(FIXED));

console.log('\nquiz shape');

ok('the quiz beats are all present and in order', (() => {
  const m = src.match(/script\.push\(line\('hook'\), line\('question'\), line\('options'\), line\('countdown'\), line\('answer'\)\)/);
  return !!m;
})());

ok('a 45 second quiz gets a couple of explanation scenes', (() => {
  const s = shape('mcq', 45);
  return s.explains >= 1 && s.explains <= 4;
})(), JSON.stringify(shape('mcq', 45)));

ok('a 90 second quiz gets more than a 45 second one',
   shape('mcq', 90).explains > shape('mcq', 45).explains);

ok('a very short target still leaves one place to explain',
   shape('mcq', 15).explains >= 1);

console.log('\nexplainer shape');

ok('an explainer opens on a title and ends on an outro',
   /script\.push\(line\('title'\)\)/.test(src) && /script\.push\(line\('outro'\)\)/.test(src));

ok('an explainer has no options to fill in',
   /options: explainer \? \[\] : \['', '', '', ''\]/.test(src));

for (const target of [120, 180, 240, 300]) {
  const s = shape('explainer', target);
  const implied = (s.scenes * s.wordsPerScene) / WPS;
  ok(
    target + 's asks for ' + s.scenes + ' scenes that add back up',
    Math.abs(implied - target) <= target * 0.06,
    Math.round(implied) + 's',
  );
}

ok('scene count is capped so a long target is not unwritable',
   shape('explainer', 3000).scenes <= 30, String(shape('explainer', 3000).scenes));

console.log('\nwhat it must not do');

// Scene length comes from the recorded audio. A scaffold that wrote durations
// would be inventing a number the renderer then ignores.
ok('no scene duration is invented',
   !/durationInFrames|startFrame|audioDuration/.test(src));

ok('the greeting is only added when one was written',
   /const intro = \(form\.intro \|\| ''\)\.trim\(\);/.test(src) && /if \(intro\)/.test(src));

console.log('\n' + (failed ? failed + ' FAILURES' : passed + ' checks passed') + '\n');
process.exit(failed ? 1 : 0);
