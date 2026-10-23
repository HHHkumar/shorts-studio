// Back test: draw every video already made, and see what breaks.
//
//   npm run backtest                 everything
//   npm run backtest -- 48pd 0zwy    only the library videos whose names contain these
//
// The unit tests check rules, the smoke test checks each format renders, and
// neither looks at a video somebody actually made. Saved videos carry data in
// shapes the code has since moved on from - a circuit written before circuits
// had a line, a doodle directed before the engineer was animated - and the
// first sign of a change that cannot read them used to be a blank scene in a
// re-render. So this renders them:
//
//   every library video  one frame of every scene, timed by its own voice
//                        clips when they are still on disk;
//   every History project three frames, through History Studio's own renderer;
//   the Kannada alphabet  three frames of the chart.
//
// It fails if anything throws, and lists any frame small enough to be blank
// (a flat frame compresses to almost nothing). Frames land in out/backtest/,
// to look at. No keys, no cost.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderComposition, renderSceneFrames } from '../server/render.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { tidySheet } from '../src/lib/formula-card.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'backtest');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
/** A quarter-size JPEG under this many bytes has nothing on it worth the name. */
const BLANK_BYTES = 2500;

const failures = [];
const blanks = [];
let frames = 0;
const started = Date.now();
fs.rmSync(OUT, { recursive: true, force: true });

// --- the library --------------------------------------------------------------

/** The saved voice, if every clip it names is still on disk; otherwise none, and the timings are estimated. */
function savedAudio(entry) {
  const audio = entry.audio && typeof entry.audio === 'object' ? entry.audio : {};
  const clips = Object.values(audio);
  const present = clips.length > 0 && clips.every((a) => a && a.src && fs.existsSync(path.join(ROOT, 'public', a.src)));
  return present ? audio : {};
}

const libraryDir = path.join(ROOT, 'library');
const videos = fs.readdirSync(libraryDir).filter((f) => /^v-.*\.json$/.test(f) && (!only.length || only.some((o) => f.includes(o))));
console.log('\nLibrary: ' + videos.length + ' videos');
for (const f of videos) {
  const id = f.replace(/\.json$/, '');
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(libraryDir, f), 'utf8'));
    const content = entry.content;
    if (!content || !Array.isArray(content.script) || !content.script.length) {
      console.log('  -    ' + id + '  (no script, skipped)');
      continue;
    }
    const design = { ...DEFAULT_DESIGN, ...(entry.design || {}) };
    const audio = savedAudio(entry);
    const sheet = tidySheet(content.formulas);
    const { scenes, totalDurationInFrames } = buildScenes(content.script, audio, design, 30, sheet ? sheet.cards.length : 0);
    const indexes = content.script.map((_, i) => i);
    const out = await renderSceneFrames(
      { content, scenes, design, fps: 30, totalDurationInFrames },
      indexes,
      { scale: 0.25, folder: path.join('backtest', id) },
    );
    frames += out.frames.length;
    const small = out.frames.filter((fr) => fs.statSync(fr.file).size < BLANK_BYTES);
    for (const fr of small) blanks.push(id + ' scene ' + (fr.scene + 1) + ' (' + fs.statSync(fr.file).size + ' bytes)');
    console.log('  ok   ' + id + '  ' + out.frames.length + ' frames, ' + (Object.keys(audio).length ? 'timed by its voice' : 'estimated timings')
      + ', ' + design.layout + (small.length ? '  - ' + small.length + ' look blank' : ''));
  } catch (err) {
    failures.push(id + ': ' + (err && err.message ? err.message.split('\n')[0] : String(err)));
    console.log('  FAIL ' + id + '  ' + (err && err.message ? err.message.split('\n')[0] : err));
  }
}

// --- History Studio -----------------------------------------------------------

if (!only.length) {
  const projectsDir = path.join(ROOT, 'studios', 'history', 'projects');
  const projects = fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json')) : [];
  console.log('\nHistory Studio: ' + projects.length + ' projects');
  for (const f of projects) {
    const id = f.replace(/\.json$/, '');
    const dir = path.join(OUT, 'history-' + id);
    // Its own still renderer, run as History Studio runs it.
    const run = spawnSync(process.execPath, [
      '--import', './studios/history/tools/ts-resolve.mjs', 'studios/history/tools/stills.mjs', id, dir, '2', '30', '90',
    ], { cwd: ROOT, encoding: 'utf8' });
    const made = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /\.(png|jpe?g)$/.test(x)) : [];
    if (run.status !== 0 || !made.length) {
      const why = ((run.stderr || '') + (run.stdout || '')).trim().split('\n').filter(Boolean).slice(-2).join(' | ');
      failures.push('history ' + id + ': ' + (why || 'no frames came out'));
      console.log('  FAIL ' + id + '  ' + why);
      continue;
    }
    frames += made.length;
    const small = made.filter((x) => fs.statSync(path.join(dir, x)).size < BLANK_BYTES * 4);
    for (const x of small) blanks.push('history ' + id + ' ' + x);
    console.log('  ok   ' + id + '  ' + made.length + ' frames' + (small.length ? '  - ' + small.length + ' look blank' : ''));
  }

  // --- the Kannada alphabet ---------------------------------------------------

  console.log('\nKannada alphabet');
  try {
    // A short clip of the chart rather than stills: it is the path the page renders by.
    const output = path.join(OUT, 'varnamale-check.mp4');
    const { varnamaleProps } = await import('../server/varnamale.mjs');
    const props = varnamaleProps({ music: false });
    const out = await renderComposition({ id: 'Varnamale', inputProps: props, output, crf: 30, frameRange: [0, 89] });
    const bytes = fs.statSync(output).size;
    if (bytes < 20000) blanks.push('alphabet clip (' + bytes + ' bytes)');
    frames += 90;
    console.log('  ok   the chart, 3 s of ' + out.seconds.toFixed(0) + ' s, ' + (props.clips ? 'with its voice' : 'silent - no voice recorded yet'));
  } catch (err) {
    failures.push('alphabet: ' + (err && err.message ? err.message.split('\n')[0] : String(err)));
    console.log('  FAIL ' + (err && err.message ? err.message.split('\n')[0] : err));
  }
}

// --- the verdict --------------------------------------------------------------

const seconds = Math.round((Date.now() - started) / 1000);
console.log('\n' + frames + ' frames in ' + seconds + ' s, into ' + path.relative(ROOT, OUT));
if (blanks.length) {
  console.log('\nLook blank - open them and check:');
  for (const b of blanks) console.log('  ' + b);
}
if (failures.length) {
  console.log('\n' + failures.length + ' FAILED:');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nNothing failed.');
process.exit(0);
