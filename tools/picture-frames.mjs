// Draw the frame of every diagram in videos already made, to look at them.
//
//   node --import ./tools/ts-resolve.mjs tools/picture-frames.mjs [folder] [id-fragment ...]
//
// `folder` is library (the default) or bench/cases. Each picture that states
// something - a sketch, a chart, a comparison - is rendered as the viewer will
// see it, into out/frames/<video>/scene-NN.jpg, with the line it sits on and
// what it is set to printed beside the file name. No keys, no cost: this is
// the same frame the picture check shows its reviewer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSceneFrames } from '../server/render.mjs';
import { picturesIn } from '../server/picture-words.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { tidySheet } from '../src/lib/formula-card.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const folder = args[0] && fs.existsSync(path.resolve(ROOT, args[0])) ? args.shift() : 'library';
const dir = path.resolve(ROOT, folder);
const only = args;

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  if (only.length && !only.some((frag) => f.includes(frag))) continue;
  let entry;
  try { entry = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const content = entry.content;
  if (!content || !Array.isArray(content.script)) continue;
  const pictures = picturesIn(content);
  if (!pictures.length) continue;

  const design = { ...DEFAULT_DESIGN, ...(entry.design || {}) };
  const sheet = tidySheet(content.formulas);
  const { scenes, totalDurationInFrames } = buildScenes(content.script, {}, design, 30, sheet ? sheet.cards.length : 0);
  const id = f.replace(/\.json$/, '');
  const out = await renderSceneFrames(
    { content, scenes, design, fps: 30, totalDurationInFrames },
    pictures.map((p) => p.scene),
    { folder: path.join('frames', id) },
  );
  console.log('\n' + (content.topic || id) + '  [' + id + ']');
  for (const p of pictures) {
    const frame = out.frames.find((x) => x.scene === p.scene);
    console.log('  ' + (frame ? path.relative(ROOT, frame.file) : '(no frame)') + '\n      line:  ' + p.narration + '\n      shows: ' + p.words);
  }
}
process.exit(0);
