// Render the animated engineer's test reel, to judge him moving.
//
//   node --import ./tools/ts-resolve.mjs tools/engineer-preview.mjs [light|dark] [--video]
//
// One still per pose, taken while he is mid-sentence, into stills/engineer-*.png,
// and with --video the whole reel as stills/engineer-reel-<mode>.mp4. No audio:
// the word timings are even, standing in for the voice.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');
const MODE = process.argv.includes('dark') ? 'dark' : 'light';
const VIDEO = process.argv.includes('--video');
const FPS = 30;
const REEL_SECONDS = 1.9;
const POSES = ['stand', 'wave', 'point', 'idea', 'think', 'shock', 'cheer', 'teach', 'worried', 'shrug'];

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

for (const [i, pose] of POSES.entries()) {
  // Late in the hold: the change of pose has settled and he is still talking.
  const frame = Math.round((i * REEL_SECONDS + 1.2) * FPS);
  const file = path.join(OUT, 'engineer-' + MODE + '-' + String(i).padStart(2, '0') + '-' + pose + '.png');
  await renderStill({ composition, serveUrl, output: file, frame, inputProps, overwrite: true });
  console.log('  ' + path.basename(file));
}

if (VIDEO) {
  const file = path.join(OUT, 'engineer-reel-' + MODE + '.mp4');
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: file, inputProps, overwrite: true });
  console.log('  ' + path.basename(file));
}
console.log('wrote ' + OUT);
