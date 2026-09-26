// Render the animated engineer's test reel, to judge him moving.
//
//   node --import ./tools/ts-resolve.mjs tools/engineer-preview.mjs [light|dark] [--video]
//
// One still per pose and per mime, into stills/engineer-*.png,
// and with --video the whole reel as stills/engineer-reel-<mode>.mp4. No audio:
// the word timings are even, standing in for the voice.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { REEL, reelStarts, segmentWords } from '../src/lib/engineer-reel.ts';
import { effectForWord } from '../src/lib/motion-lexicon.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');
const MODE = process.argv.includes('dark') ? 'dark' : 'light';
const VIDEO = process.argv.includes('--video');
const FPS = 30;


fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('bundling...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});
const inputProps = { mode: MODE };
const composition = await selectComposition({ serveUrl, id: 'EngineerReel', inputProps });

const starts = reelStarts();
for (const [i, segment] of REEL.entries()) {
  // A pose once it has settled; a mime in the thick of it, 0.85s after its word.
  const word = segment.mime ? segmentWords(i).find((w) => effectForWord(w.word)) : null;
  const at = word ? word.start + 0.85 : starts[i] + 1.3;
  const name = segment.mime ? 'mime-' + segment.mime : segment.pose;
  const file = path.join(OUT, 'engineer-' + MODE + '-' + String(i).padStart(2, '0') + '-' + name + '.png');
  await renderStill({ composition, serveUrl, output: file, frame: Math.round(at * FPS), inputProps, overwrite: true });
  console.log('  ' + path.basename(file));
}

if (VIDEO) {
  const file = path.join(OUT, 'engineer-reel-' + MODE + '.mp4');
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: file, inputProps, overwrite: true });
  console.log('  ' + path.basename(file));
}
console.log('wrote ' + OUT);
