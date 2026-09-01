// Run: node src/lib/timeline.test.mjs
//
// The timeline is the one place where a bad number does visible damage. Scenes
// are laid end to end from a running cursor, so a single NaN does not just
// break one scene - it poisons every start frame after it, and scenes that
// should follow each other end up drawn on top of each other instead.
//
// Node cannot import the .ts module, so this reads the source and replays the
// two guards that matter, the same way subtopics.test.mjs does here.

import fs from 'node:fs';

const src = fs.readFileSync(new URL('./timeline.ts', import.meta.url), 'utf8');

let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (cond) passed++;
  else failed++;
};

console.log('\nthe guards are in place');

ok('a usable-number check exists',
   /const usable = \(n: unknown\): n is number =>/.test(src));
ok('it requires finite AND positive',
   /Number\.isFinite\(n\) && n > 0/.test(src));
ok('trueDuration cannot return a non-number',
   /return usable\(a\.duration\) \? a\.duration : 0;/.test(src));
ok('audibleLength bails out on an unusable length',
   /if \(!usable\(full\)\) return 0;/.test(src));
ok('the frame count is checked before Math.max',
   /Number\.isFinite\(rounded\) \? Math\.max\(1, rounded\)/.test(src));

console.log('\nwhy the last one matters');

// This is the trap the code fell into: the obvious clamp does not clamp.
ok('Math.max(1, NaN) is NaN, not 1', Number.isNaN(Math.max(1, NaN)));
ok('Math.ceil(NaN) is NaN', Number.isNaN(Math.ceil(NaN)));
ok('and NaN spreads through a running cursor', Number.isNaN(0 + NaN + 30));

console.log('\nreplaying the layout with a poisoned clip');

// Same walk buildScenes does: a cursor advanced by each scene's frame count.
const layout = (durations, fps = 30) => {
  let cursor = 0;
  return durations.map((d) => {
    const rounded = Math.ceil(d * fps);
    const frames = Number.isFinite(rounded) ? Math.max(1, rounded) : Math.max(1, Math.ceil(1.5 * fps));
    const at = cursor;
    cursor += frames;
    return { startFrame: at, durationInFrames: frames };
  });
};

const scenes = layout([2, NaN, 3, undefined, 1.5]);

ok('every scene gets a real start frame',
   scenes.every((s) => Number.isFinite(s.startFrame)),
   JSON.stringify(scenes.map((s) => s.startFrame)));
ok('every scene gets a real length',
   scenes.every((s) => Number.isFinite(s.durationInFrames) && s.durationInFrames >= 1));
ok('no two scenes overlap', (() => {
  for (let i = 1; i < scenes.length; i++) {
    const prevEnd = scenes[i - 1].startFrame + scenes[i - 1].durationInFrames;
    if (scenes[i].startFrame < prevEnd) return false;
  }
  return true;
})(), JSON.stringify(scenes.map((s) => s.startFrame + '+' + s.durationInFrames)));

console.log('\n' + (failed ? failed + ' FAILURES' : passed + ' checks passed') + '\n');
process.exit(failed ? 1 : 0);
