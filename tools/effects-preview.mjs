// Render one ordinary explainer scene across its length, to see whether the
// narration-driven effects actually read.
//
//   node --import ./tools/ts-resolve.mjs tools/effects-preview.mjs [process|diagram|versus]
//
// Deliberately points at a STATIC layout, not a motion scene. The complaint
// this exists to answer is that the other eighteen scenes of an explainer sit
// still, so those are what need looking at.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { normalizePanel } from '../server/explainer.mjs';
import { attachIcons } from '../server/icons.mjs';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { detectEffects } from '../src/lib/motion-lexicon.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');
const KIND = process.argv[2] || 'process';
const FPS = 30;
const SECONDS = 16;

const SCENES = {
  process: {
    narration: 'Steam flows into the turbine, the blades spin faster and faster, the metal heats '
      + 'until it glows, and most of that energy escapes as waste heat long before it ever '
      + 'reaches a wire in your house.',
    panel: {
      steps: [
        { label: 'Boiler', detail: 'Water becomes steam', icon: 'boiler' },
        { label: 'Turbine', detail: 'Steam turns the blades', icon: 'wind turbine' },
        { label: 'Generator', detail: 'Rotation becomes current', icon: 'lightning bolt' },
      ],
    },
  },
  diagram: {
    narration: 'Water flows down from the reservoir, drives the turbine that spins below it, and '
      + 'the generator turns that rotation into the current which travels out along the line.',
    panel: {
      nodes: [
        { id: 'res', label: 'Reservoir', col: 0, row: 0, icon: 'water' },
        { id: 'tur', label: 'Turbine', col: 1, row: 0, icon: 'wind turbine' },
        { id: 'gen', label: 'Generator', col: 2, row: 0, icon: 'lightning bolt' },
      ],
      edges: [
        { from: 'res', to: 'tur', label: 'water' },
        { from: 'tur', to: 'gen', label: 'rotation' },
      ],
    },
  },
  versus: {
    narration: 'One design lets the heat escape and the output falls away; the other holds it in, '
      + 'so the pressure rises and the whole thing spins harder for the same fuel.',
    panel: {
      leftLabel: 'Heat escapes',
      rightLabel: 'Heat held in',
      leftPoints: ['Output falls', 'More fuel burnt'],
      rightPoints: ['Pressure rises', 'Same fuel, more work'],
    },
  },
};

const chosen = SCENES[KIND];
if (!chosen) throw new Error('no scenario called ' + KIND);

const panel = normalizePanel(chosen.panel, KIND);
if (!panel) throw new Error('the normalizer refused the ' + KIND + ' panel');

/** Even word timings, standing in for ElevenLabs at its measured pace. */
const words = chosen.narration.split(/\s+/).filter(Boolean).map((word, i, all) => {
  const per = SECONDS / all.length;
  return { word, start: i * per, end: (i + 1) * per };
});

console.log('effects detected in this narration:');
for (const e of detectEffects(words, SECONDS)) {
  console.log('  ' + e.at.toFixed(1) + 's  ' + e.kind.padEnd(8) + ' <- "' + e.word + '"');
}

const content = {
  videoKind: 'explainer',
  subject: 'Power', topic: 'Turbines', difficulty: 'medium',
  hook: '', question: 'How does a turbine work?', options: [], correctIndex: 0,
  answerLine: '', explanation: [], funFact: '', outro: '', hashtags: [],
  motifSymbols: ['⚡'],
  script: [{ kind: KIND, narration: chosen.narration, panel }],
};

// Real artwork, fetched the same way a live generation fetches it.
const art = await attachIcons(content, { root: ROOT });
console.log('artwork: ' + art.resolved + ' resolved'
  + (art.missing.length ? ', missing ' + art.missing.join(', ') : ''));

const props = {
  content,
  design: { ...DEFAULT_DESIGN, orientation: 'landscape', ambient: 'none', music: 'none' },
  scenes: [{
    ...content.script[0],
    id: 's0',
    startFrame: 0,
    durationInFrames: SECONDS * FPS,
    words,
    captionOffset: 0,
    audioSrc: '',
    audioDuration: 0,
    stockSrc: '',
    stockCredit: '',
  }],
  fps: FPS,
  totalDurationInFrames: SECONDS * FPS,
};

fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('\nbundling...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});
const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });

for (let f = 0; f < SECONDS * FPS; f += 20) {
  const file = path.join(OUT, 'fx-' + KIND + '-' + String(f).padStart(3, '0') + '.png');
  await renderStill({ composition, serveUrl, output: file, frame: f, inputProps: props, overwrite: true });
  process.stdout.write('.');
}
console.log('\nwrote ' + OUT);
