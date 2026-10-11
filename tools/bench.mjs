// The test bench from the command line.
//
//   node --import ./tools/ts-resolve.mjs tools/bench.mjs score
//   node --import ./tools/ts-resolve.mjs tools/bench.mjs list [case-fragment]
//   node --import ./tools/ts-resolve.mjs tools/bench.mjs add-library
//   node --import ./tools/ts-resolve.mjs tools/bench.mjs frames [case-fragment ...]
//   node --import ./tools/ts-resolve.mjs tools/bench.mjs suggest <marks.json>
//
// score        the numbers the Accuracy page shows, on the marks as they stand
// list         every picture, with what the rules and the reviewer say of it
// add-library  put every library video on the bench (the app's own button)
// frames       draw each case's frames into out/bench/<case>/ - no keys needed
// suggest      lay a first pass of marks beside the pictures, as suggestions:
//              [{ "id": "...", "key": "...", "mark": "wrong", "note": "..." }]
//              A mark a person has made is never replaced.
//
// None of this calls a model. Reviewing a case needs a key, which lives in the
// browser, so that is done from the Accuracy page.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addLibraryVideos, benchView, listCases, readMarks, scoreBench, setMark } from '../server/bench.mjs';
import { allVideos } from '../server/library.mjs';
import { picturesIn } from '../server/picture-words.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'score', ...rest] = process.argv.slice(2);

const frameUrl = (id, scene) => {
  const file = path.join(ROOT, 'out', 'bench', id, 'scene-' + String(scene).padStart(2, '0') + '.jpg');
  return fs.existsSync(file) ? path.relative(ROOT, file) : '';
};
const pct = (n) => (n === null ? '   -' : String(n).padStart(5) + '%');

function printScore(label, s) {
  console.log('\n' + label);
  console.log('  questions ' + s.cases + ', pictures ' + s.pictures + ', marked ' + s.marked + ', reviewed ' + s.checked);
  console.log('  right, before any check      ' + pct(s.askedRightPct) + '   (' + s.asked.right + ' right, ' + s.asked.wrong + ' wrong, ' + s.asked.unrelated + ' beside the point)');
  console.log('  right, of what a viewer sees ' + pct(s.shownRightPct) + '   (' + s.shownRight + ' right and ' + s.shownWrong + ' wrong shown today)');
  console.log('  wrong pictures stopped       ' + pct(s.caughtPct) + '   (' + s.byRules.caught + ' by the rules, ' + s.byReviewer.caught + ' by the check, ' + s.byReviewer.missed + ' missed)');
  console.log('  right pictures kept          ' + pct(s.keptPct) + '   (' + s.byRules.lostRight + ' lost to the rules, ' + s.byReviewer.lostRight + ' to the check)');
}

if (command === 'score') {
  const view = benchView(ROOT, frameUrl);
  printScore('ON YOUR MARKS', view.score);
  if (view.score.suggested) printScore('COUNTING CLAUDE\'S FIRST PASS TOO (' + view.score.suggested + ' unconfirmed)', scoreBench(view.cases, { includeSuggested: true }));
} else if (command === 'list') {
  for (const c of benchView(ROOT, frameUrl).cases) {
    if (rest.length && !rest.some((f) => c.id.includes(f))) continue;
    console.log('\n' + c.id + '  ' + c.topic + '\n  Q: ' + c.question + '\n  A: ' + c.answer);
    for (const p of c.pictures) {
      console.log('  ' + p.key + '  scene ' + String(p.scene).padStart(2) + '  ' + (p.shown ? 'shown ' : 'hidden') + '  mark: ' + (p.mark ? p.mark + (p.markedBy === 'claude' ? '?' : '') : '-')
        + (p.verdict ? '  check: ' + p.verdict : '') + '\n      line:  ' + p.narration + '\n      shows: ' + p.words
        + (p.refused.length ? '\n      rules: ' + p.refused.join('; ') : '') + (p.frame ? '\n      frame: ' + p.frame : ''));
    }
  }
} else if (command === 'add-library') {
  const added = addLibraryVideos(ROOT, allVideos(path.join(ROOT, 'library')));
  console.log('added ' + added.length + ': ' + added.join(', '));
} else if (command === 'frames') {
  const { renderSceneFrames } = await import('../server/render.mjs');
  const { buildScenes } = await import('../src/lib/timeline.ts');
  const { DEFAULT_DESIGN } = await import('../src/lib/theme.ts');
  const { tidySheet } = await import('../src/lib/formula-card.ts');
  for (const c of listCases(ROOT)) {
    if (rest.length && !rest.some((f) => c.id.includes(f))) continue;
    const pictures = picturesIn(c.content);
    if (!pictures.length) continue;
    const design = { ...DEFAULT_DESIGN, ...c.look };
    const sheet = tidySheet(c.content.formulas);
    const { scenes, totalDurationInFrames } = buildScenes(c.content.script, {}, design, 30, sheet ? sheet.cards.length : 0);
    const out = await renderSceneFrames(
      { content: c.content, scenes, design, fps: 30, totalDurationInFrames },
      pictures.map((p) => p.scene),
      { folder: 'bench/' + c.id },
    );
    console.log(c.id + ': ' + out.frames.length + ' frames');
  }
  process.exit(0);
} else if (command === 'suggest') {
  const list = JSON.parse(fs.readFileSync(path.resolve(rest[0]), 'utf8'));
  const marks = readMarks(ROOT);
  const known = new Map(benchView(ROOT).cases.map((c) => [c.id, new Set(c.pictures.map((p) => p.key))]));
  let laid = 0;
  for (const m of list) {
    if (!known.has(m.id) || !known.get(m.id).has(m.key)) { console.log('no such picture: ' + m.id + ' ' + m.key); continue; }
    const existing = marks[m.id] && marks[m.id][m.key];
    if (existing && existing.by === 'you') continue;
    setMark(ROOT, m.id, m.key, { mark: m.mark, note: m.note || '', by: 'claude' });
    laid++;
  }
  console.log(laid + ' suggestions laid');
} else {
  console.log('unknown command: ' + command);
  process.exitCode = 1;
}
