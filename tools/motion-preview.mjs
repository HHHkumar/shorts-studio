// Render a motion scene across its whole length, so the animation can be
// looked at rather than reasoned about.
//
//   node tools/motion-preview.mjs
//
// Writes stills/motion-NN.png. Not part of the test suite: it needs the network
// for the icons and a headless Chrome for the frames. It exists because the
// only way to know whether a movement reads is to watch it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { attachIcons } from '../server/icons.mjs';
import { normalizePanel } from '../server/explainer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');

const SCENARIO = process.argv[2] || 'dam';
const PORTRAIT = process.argv.includes('--portrait');

// The exact example this feature was asked for: a fish, a dam it cannot pass,
// and a ladder that appears and gives it a way over.
const NARRATION_DAM =
  'A salmon heading upstream runs into a wall of concrete it cannot pass, '
  + 'and the run collapses. Build a fish ladder beside it and the salmon climbs '
  + 'over, one shallow step at a time.';

const RAW_PANEL_DAM = {
  title: 'A way over',
  actors: [
    { id: 'fish', icon: 'fish', label: 'Salmon', x: 0.12, y: 0.62, accent: true },
    { id: 'dam', icon: 'dam', label: 'Dam', x: 0.52, y: 0.55, scale: 1.4 },
    { id: 'ladder', icon: 'stairs', label: 'Fish ladder', x: 0.74, y: 0.42, hidden: true },
  ],
  beats: [
    { actor: 'fish', action: 'move', to: 'dam', cue: 'upstream' },
    { actor: 'fish', action: 'blocked', to: 'dam', cue: 'wall concrete' },
    { actor: 'ladder', action: 'appear', cue: 'fish ladder' },
    { actor: 'fish', action: 'climb', to: 'ladder', cue: 'climbs over' },
  ],
};

// The four verbs the dam scene never touches, so they get looked at too.
const NARRATION_VERBS =
  'The turbine spins as the water drives it, the generator lights up, '
  + 'and the loss escapes as heat, gone long before it reaches a wire.';

const RAW_PANEL_VERBS = {
  title: 'Where the energy goes',
  actors: [
    { id: 'turbine', icon: 'wind turbine', label: 'Turbine', x: 0.28, y: 0.42 },
    { id: 'gen', icon: 'lightning bolt', label: 'Generator', x: 0.68, y: 0.42, accent: true },
    { id: 'loss', icon: 'fire', label: 'Lost as heat', x: 0.5, y: 0.72, hidden: true },
  ],
  beats: [
    { actor: 'turbine', action: 'spin', cue: 'spins' },
    { actor: 'gen', action: 'pulse', cue: 'lights up' },
    { actor: 'loss', action: 'appear', cue: 'loss escapes' },
    { actor: 'loss', action: 'exit', x: 0.95, y: 0.1, cue: 'gone' },
  ],
};

// One cue the narrator never says, to prove the other three still land on the
// voice instead of the whole scene collapsing onto an even spread.
const RAW_PANEL_BROKEN = {
  ...RAW_PANEL_DAM,
  beats: RAW_PANEL_DAM.beats.map((b) =>
    (b.cue === 'wall concrete' ? { ...b, cue: 'sheer bulk' } : b)),
};

const NARRATION = SCENARIO === 'verbs' ? NARRATION_VERBS : NARRATION_DAM;
const RAW_PANEL = SCENARIO === 'verbs' ? RAW_PANEL_VERBS
  : SCENARIO === 'broken' ? RAW_PANEL_BROKEN : RAW_PANEL_DAM;

/** Fake word timings, evenly spread, standing in for ElevenLabs. */
function timeWords(text, seconds) {
  const words = text.split(/\s+/).filter(Boolean);
  const per = seconds / words.length;
  return words.map((word, i) => ({ word, start: i * per, end: (i + 1) * per }));
}

const SECONDS = 9;
const FPS = 30;

const panel = normalizePanel(RAW_PANEL, 'motion');
if (!panel) throw new Error('The normalizer rejected the panel outright.');

const content = {
  videoKind: 'explainer',
  subject: 'Environment',
  topic: 'Dams and fish',
  difficulty: 'medium',
  hook: '',
  question: 'How do fish get past a dam?',
  options: [],
  correctIndex: 0,
  answerLine: '',
  explanation: [],
  funFact: '',
  outro: '',
  hashtags: [],
  motifSymbols: ['🐟'],
  script: [{ kind: 'motion', narration: NARRATION, panel }],
};

const art = await attachIcons(content, { root: ROOT });
console.log('icons: ' + art.resolved + ' resolved'
  + (art.missing.length ? ', missing ' + art.missing.join(', ') : ''));
for (const a of content.script[0].panel.actors) {
  console.log('  ' + a.id.padEnd(8) + ' ' + (a.iconName || 'NONE'));
}

const scene = {
  ...content.script[0],
  index: 0,
  from: 0,
  durationInFrames: SECONDS * FPS,
  words: timeWords(NARRATION, SECONDS),
  captionOffset: 0,
  audioSrc: null,
};

const { DEFAULT_DESIGN } = await import('../src/lib/theme.ts').catch(() => ({}));

const props = {
  content,
  design: {
    theme: 'dark',
    layout: 'nerdy',
    orientation: PORTRAIT ? 'portrait' : 'landscape',
    accent: '#4ade80',
    fontScale: 1,
    music: 'none',
    musicVolume: 0.3,
    ambient: 'none',
    ambientIntensity: 0.5,
    showCaptions: true,
    ...(DEFAULT_DESIGN || {}),
    orientationOverride: undefined,
  },
  scenes: [scene],
  fps: FPS,
  totalDurationInFrames: SECONDS * FPS,
};
props.design.orientation = PORTRAIT ? 'portrait' : 'landscape';
props.design.ambient = 'none';

fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('bundling…');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});
const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
console.log('composition ' + composition.width + 'x' + composition.height
  + ', ' + composition.durationInFrames + ' frames');

// Every half second, which is fine enough to see a bounce.
for (let f = 0; f < SECONDS * FPS; f += 15) {
  const file = path.join(OUT, SCENARIO + (PORTRAIT ? '-p' : '') + '-' + String(f).padStart(3, '0') + '.png');
  await renderStill({ composition, serveUrl, output: file, frame: f, inputProps: props, overwrite: true });
  process.stdout.write('.');
}
console.log('\nwrote ' + OUT);
