// Render named sketches as stills, to see one exactly as a video would show it.
//
//   node --import ./tools/ts-resolve.mjs tools/sketch-preview.mjs switch-circuit led-circuit
//   ... add  mode=closed  (any key=value) to set a parameter on every sketch
//   ... add  --look=doodle  to draw it in the Doodle look
//
// Each sketch is rendered in both frame shapes, because the figure box is 940
// pixels wide in a portrait video and 620 in a landscape one - and a drawing
// whose parts are sized in pixels while its wires are sized in proportions can
// be right in one and broken in the other. That is how the switch sketch came
// to show an open circuit under the caption "Closed - current flows".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { SKETCHES } from '../src/remotion/sketches.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills', 'sketches');
const FPS = 30;
const SECONDS = 4;

const args = process.argv.slice(2);
const names = args.filter((a) => !a.includes('=') && !a.startsWith('--'));
const params = Object.fromEntries(args.filter((a) => a.includes('=') && !a.startsWith('--')).map((a) => a.split('=')));
const look = (args.find((a) => a.startsWith('--look=')) || '').split('=')[1] || '';
const unknown = names.filter((n) => !SKETCHES[n]);
if (!names.length || unknown.length) {
  console.error(unknown.length ? 'No sketch called: ' + unknown.join(', ') : 'Name at least one sketch.');
  process.exit(1);
}

const content = {
  videoKind: 'explainer', subject: 'Preview', topic: 'Sketches', difficulty: 'medium',
  hook: '', question: 'Sketch preview', options: [], correctIndex: 0,
  answerLine: '', explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: [],
  script: [],
};

fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});

for (const name of names) {
  for (const orientation of ['portrait', 'landscape']) {
    const narration = 'Here is the ' + name + ' sketch, drawn the way a video would show it.';
    const words = narration.split(/\s+/).map((word, i, all) => ({ word, start: (i * SECONDS) / all.length, end: ((i + 1) * SECONDS) / all.length }));
    const scene = {
      kind: 'explain', narration, visual: { kind: 'sketch', sketch: name, params },
      id: 's0', startFrame: 0, durationInFrames: SECONDS * FPS, words, captionOffset: 0,
      audioSrc: '', audioDuration: 0, stockSrc: '', stockCredit: '',
    };
    const props = {
      content: { ...content, script: [scene] },
      design: { ...DEFAULT_DESIGN, orientation, ambient: 'none', music: 'none', showMotif: false, ...(look ? { layout: look, mode: 'light' } : {}) },
      scenes: [scene], fps: FPS, totalDurationInFrames: SECONDS * FPS,
    };
    const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
    // Late in the scene, so anything that animates in - a switch closing - has.
    const file = path.join(OUT, name + '-' + orientation + (look ? '-' + look : '') + '.png');
    await renderStill({ composition, serveUrl, output: file, frame: SECONDS * FPS - 12, inputProps: props, overwrite: true });
    console.log('  ' + path.relative(ROOT, file));
  }
}
