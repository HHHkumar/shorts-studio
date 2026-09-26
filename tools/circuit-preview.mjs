// Render a revealed circuit coming alive, to see the current flow and the
// lamps rather than imagine them.
//
//   node --import ./tools/ts-resolve.mjs tools/circuit-preview.mjs [--video]
//
// Two lamps in parallel on 12 V - 6 ohm and 3 ohm, so one shines more than
// the other and its branch runs faster - plus an AC branch circuit, in a few
// looks and both shapes. For each: the question scene (still: nothing may
// move before the answer), and the explain scene once it has switched on.
// With --video, each as a clip too.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { normalizeCircuit } from '../src/lib/figures/circuit.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');
const FPS = 30;
const SECONDS = 4;
const VIDEO = process.argv.includes('--video');

const node = (id, col, row) => ({ id, col, row });
const part = (id, kind, from, to, value, unit) => ({ id, kind, from, to, value, unit });
const made = (raw) => {
  const r = normalizeCircuit({ type: 'circuit', ...raw });
  if (!r.circuit) throw new Error('refused: ' + r.errors.join('; '));
  return r.circuit;
};

const LAMPS = made({
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 12, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'),
    part('L1', 'lamp', 'B', 'E', 6, 'Ω'), part('L2', 'lamp', 'C', 'D', 3, 'Ω'),
    part('W3', 'wire', 'D', 'E'), part('W4', 'wire', 'E', 'F'),
  ],
  ask: { quantity: 'power', element: 'L2' },
});

const RC = made({
  frequency: 50,
  nodes: [node('A', 0, 0), node('B', 2, 0), node('C', 4, 0), node('D', 4, 2), node('E', 2, 2), node('F', 0, 2)],
  elements: [
    part('V1', 'voltage', 'F', 'A', 230, 'V'), part('W1', 'wire', 'A', 'B'), part('W2', 'wire', 'B', 'C'),
    part('R1', 'resistor', 'B', 'E', 100, 'Ω'), part('C1', 'capacitor', 'C', 'D', 31.83, 'µF'),
    part('W3', 'wire', 'D', 'E'), part('W4', 'wire', 'E', 'F'),
  ],
  ask: { quantity: 'current', element: 'V1' },
});

const content = (figure) => ({
  videoKind: 'mcq', subject: 'Basic Electrical', topic: 'Circuits', difficulty: 'easy',
  hook: '', question: 'Which lamp shines more?', options: ['L1', 'L2', 'Both the same', 'Neither'], correctIndex: 1,
  figure, answerLine: '', explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: ['⚡'],
  script: [
    { kind: 'question', narration: 'Which of these two lamps shines more?', visual: { kind: 'figure', reveal: false } },
    { kind: 'explain', narration: 'The smaller resistance takes more current and more power.', visual: { kind: 'figure', reveal: true } },
  ],
});

const timed = (line) => line.narration.split(/\s+/).map((word, i, all) => {
  const per = (SECONDS - 0.4) / all.length;
  return { word, start: i * per, end: (i + 1) * per };
});

const CASES = [
  { name: 'lamps-simple-dark-portrait', figure: LAMPS, look: { layout: 'simple', mode: 'dark' }, orientation: 'portrait' },
  { name: 'lamps-doodle-light-portrait', figure: LAMPS, look: { layout: 'doodle', mode: 'light' }, orientation: 'portrait' },
  { name: 'lamps-nerdy-dark-landscape', figure: LAMPS, look: { layout: 'nerdy', mode: 'dark' }, orientation: 'landscape' },
  { name: 'rc-ac-simple-light-landscape', figure: RC, look: { layout: 'simple', mode: 'light' }, orientation: 'landscape' },
];

fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('bundling...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});

for (const c of CASES) {
  const quiz = content(c.figure);
  const frames = SECONDS * FPS;
  const props = {
    content: quiz,
    design: { ...DEFAULT_DESIGN, ...c.look, orientation: c.orientation, music: 'none', sfx: false },
    scenes: quiz.script.map((line, i) => ({
      ...line, id: 's' + i, startFrame: i * frames, durationInFrames: frames, words: timed(line), captionOffset: 0,
      audioSrc: '', audioDuration: 0, stockSrc: '', stockCredit: '',
    })),
    fps: FPS,
    totalDurationInFrames: quiz.script.length * frames,
  };
  const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
  // The question late on (nothing may be moving), then the explain scene two
  // frames apart once it is on - two frames, so the flow can be seen to move.
  for (const [label, frame] of [['question', frames - 10], ['on', frames + 75], ['on2', frames + 77]]) {
    const file = path.join(OUT, 'circuit-' + c.name + '-' + label + '.png');
    await renderStill({ composition, serveUrl, output: file, frame, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(file));
  }
  if (VIDEO) {
    const file = path.join(OUT, 'circuit-' + c.name + '.mp4');
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: file, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(file));
  }
}
console.log('wrote ' + OUT);
