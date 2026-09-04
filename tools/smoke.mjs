// Render every combination the tool can produce, and check each one drew
// something.
//
//   npm run smoke
//
// The unit tests check rules; the simulation checks one explainer end to end.
// Neither notices a whole FORMAT breaking - a change to how scenes are
// sequenced touches quizzes and explainers alike, and only one of them was
// being looked at. This renders both kinds in both shapes plus both thumbnail
// sizes, and fails if any of them comes out blank.
//
// "Blank" is judged by file size. A 1920x1080 PNG of one flat colour compresses
// to a few kilobytes; a real frame with text and artwork on it does not get
// near that. Crude, but it catches the failure that matters - a composition
// that renders successfully and draws nothing - without shipping an image
// decoder to do it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { normalizeStoryboard } from '../server/explainer.mjs';
import { attachIcons } from '../server/icons.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { DEMO_CONTENT } from '../src/lib/demo.ts';
import { thumbSizeFor } from '../src/lib/types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills', 'smoke');
const FPS = 30;

/**
 * Below this a frame is empty. Measured: real frames from this app run 650 KB
 * to 1.7 MB, and a 1920x1080 PNG of one flat colour is under 20 KB - so the
 * threshold sits far from both and does not need tuning as the design changes.
 */
const BLANK_KB = 120;

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
  if (!cond) failures++;
};

// ---------------------------------------------------------------------------
// An explainer that uses every layout, so no panel goes unrendered.
// ---------------------------------------------------------------------------

const EXPLAINER = normalizeStoryboard({
  topic: 'How a power station works',
  question: 'Where does the electricity in your wall come from?',
  hook: 'Almost all of it starts by boiling water.',
  outro: 'Follow for more of how the world actually works.',
  hashtags: ['power'],
  motifSymbols: ['⚡'],
  script: [
    {
      kind: 'title',
      narration: 'Almost all the electricity in your wall starts life as a kettle, which is a much stranger fact than it sounds.',
      panel: { title: 'Where does it come from?', subtitle: 'Almost all of it starts by boiling water.' },
    },
    {
      kind: 'metaphor',
      narration: 'Think of a water wheel in a stream, turning because the water pushes it; a power station does the same thing with steam instead of a river.',
      panel: {
        leftLabel: 'Water wheel', rightLabel: 'Steam turbine',
        leftSymbol: '💧', rightSymbol: '⚙️',
        leftPoints: ['A stream pushes it', 'It turns'],
        rightPoints: ['Steam pushes it', 'It turns much faster'],
      },
    },
    {
      kind: 'diagram',
      narration: 'Fuel heats the boiler, the boiler makes steam, the steam drives the turbine, and the turbine spins the generator that feeds the line.',
      panel: {
        nodes: [
          { id: 'b', label: 'Boiler', icon: 'boiler', col: 0, row: 0 },
          { id: 't', label: 'Turbine', icon: 'wind turbine', col: 1, row: 0 },
          { id: 'g', label: 'Generator', icon: 'lightning bolt', col: 2, row: 0 },
        ],
        edges: [{ from: 'b', to: 't', label: 'steam' }, { from: 't', to: 'g', label: 'rotation' }],
      },
    },
    {
      kind: 'motion',
      narration: 'Watch what happens to the heat. It rises through the turbine, most of it escapes out of the tower, and only a third of it ever reaches a wire in your house at all.',
      panel: {
        title: 'Where the energy goes',
        actors: [
          { id: 'fire', icon: 'fire', label: 'Fuel', x: 0.15, y: 0.6, accent: true },
          { id: 'turbine', icon: 'wind turbine', label: 'Turbine', x: 0.5, y: 0.5, scale: 1.3 },
          { id: 'waste', icon: 'cloud', label: 'Lost heat', x: 0.85, y: 0.3, hidden: true },
        ],
        beats: [
          { actor: 'fire', action: 'move', to: 'turbine', cue: 'rises' },
          { actor: 'turbine', action: 'spin', cue: 'turbine' },
          { actor: 'waste', action: 'appear', cue: 'escapes' },
          { actor: 'waste', action: 'exit', x: 0.95, y: 0.1, cue: 'tower' },
        ],
      },
    },
    {
      kind: 'process',
      narration: 'So there are three moves: burn something, boil water with it, and let the steam do the work of turning a magnet inside a coil.',
      panel: {
        steps: [
          { label: 'Burn', detail: 'Fuel releases heat', icon: 'fire' },
          { label: 'Boil', detail: 'Water becomes steam', icon: 'boiler' },
          { label: 'Turn', detail: 'Steam spins the magnet', icon: 'wind turbine' },
        ],
      },
    },
    {
      kind: 'versus',
      narration: 'Coal burns dirty and cheap; nuclear burns clean and expensive, and the argument between them is really an argument about which cost you would rather pay.',
      panel: {
        leftLabel: 'Coal', rightLabel: 'Nuclear',
        leftPoints: ['Cheap to build', 'Dirty to run'],
        rightPoints: ['Costly to build', 'Clean to run'],
      },
    },
    {
      kind: 'timeline',
      narration: 'Faraday found the principle in eighteen thirty one, Edison sold the first station in eighteen eighty two, and the grid we still use arrived in the nineteen thirties.',
      panel: {
        steps: [
          { label: 'Faraday', detail: 'Induction found', when: '1831', icon: 'magnet' },
          { label: 'Edison', detail: 'First station', when: '1882', icon: 'light bulb' },
          { label: 'The grid', detail: 'Nationwide supply', when: '1930s', icon: 'transmission tower' },
        ],
      },
    },
    {
      kind: 'grid',
      narration: 'Every station is a variation on the same theme: coal, gas, nuclear and geothermal all end up boiling water, and only wind and solar skip the kettle entirely.',
      panel: {
        steps: [
          { label: 'Coal', icon: 'fire' },
          { label: 'Gas', icon: 'gas' },
          { label: 'Nuclear', icon: 'atom' },
          { label: 'Wind', icon: 'wind turbine' },
          { label: 'Solar', icon: 'solar panel' },
          { label: 'Hydro', icon: 'water' },
        ],
      },
    },
    {
      kind: 'recap',
      narration: 'So remember three things: it is nearly always a kettle, the turbine is the part that matters, and most of the heat never gets to you at all.',
      panel: {
        title: 'What to remember',
        steps: [
          { label: 'It is a kettle', icon: 'boiler' },
          { label: 'The turbine matters', icon: 'wind turbine' },
          { label: 'Most heat is lost', icon: 'fire' },
        ],
      },
    },
    { kind: 'outro', narration: 'Follow for more of how the world actually works.' },
  ],
}, {});

/** Word timings at the voice's measured pace, standing in for ElevenLabs. */
function voice(scenes) {
  for (const scene of scenes) {
    const words = String(scene.narration || '').split(/\s+/).filter(Boolean);
    const per = (scene.durationInFrames / FPS) / Math.max(1, words.length);
    scene.words = words.map((word, i) => ({ word, start: i * per, end: (i + 1) * per }));
    scene.captionOffset = 0;
  }
  return scenes;
}

function propsFor(content, orientation) {
  const design = { ...DEFAULT_DESIGN, orientation, ambient: 'none', music: 'none' };
  const { scenes, totalDurationInFrames } = buildScenes(content.script, {}, design, FPS);
  return { content, design, scenes: voice(scenes), fps: FPS, totalDurationInFrames };
}

console.log('\nfetching the artwork');
const art = await attachIcons(EXPLAINER, { root: ROOT });
console.log('  ' + art.resolved + ' icons resolved'
  + (art.missing.length ? ', no match for: ' + art.missing.join(', ') : ''));
check('every named thing found a picture', art.missing.length === 0, art.missing.join(', '));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('\nbundling');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});

// ---------------------------------------------------------------------------
// Both kinds of video, both shapes. A change to how scenes are sequenced hits
// all four; only ever looking at one of them is how a format breaks quietly.
// ---------------------------------------------------------------------------

const COMBOS = [
  { name: 'explainer-landscape', content: EXPLAINER, orientation: 'landscape' },
  { name: 'explainer-portrait', content: EXPLAINER, orientation: 'portrait' },
  { name: 'quiz-portrait', content: DEMO_CONTENT, orientation: 'portrait' },
  { name: 'quiz-landscape', content: DEMO_CONTENT, orientation: 'landscape' },
];

for (const combo of COMBOS) {
  console.log('\n' + combo.name);
  const props = propsFor(combo.content, combo.orientation);
  const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });

  const wide = combo.orientation === 'landscape';
  check('the frame is the right shape',
    wide ? composition.width > composition.height : composition.height > composition.width,
    composition.width + 'x' + composition.height);
  check('the length matches the timeline',
    composition.durationInFrames === props.totalDurationInFrames,
    Math.round(props.totalDurationInFrames / FPS) + 's, ' + props.scenes.length + ' scenes');

  // The middle of every scene, so each layout gets looked at at least once and
  // none of the samples lands in a cross-fade.
  let blank = 0;
  let smallest = Infinity;
  for (const [i, scene] of props.scenes.entries()) {
    const frame = Math.min(
      composition.durationInFrames - 1,
      scene.startFrame + Math.floor(scene.durationInFrames / 2),
    );
    const file = path.join(OUT, combo.name + '-' + String(i).padStart(2, '0') + '-' + scene.kind + '.png');
    await renderStill({ composition, serveUrl, output: file, frame, inputProps: props, overwrite: true });
    const kb = fs.statSync(file).size / 1024;
    smallest = Math.min(smallest, kb);
    if (kb < BLANK_KB) {
      blank++;
      console.log('       scene ' + i + ' (' + scene.kind + ') is only ' + Math.round(kb) + ' KB');
    }
  }
  check('no scene rendered blank', blank === 0,
    props.scenes.length + ' scenes, smallest ' + Math.round(smallest) + ' KB');
}

// ---------------------------------------------------------------------------
// Thumbnails: a separate composition that sizes itself from its own props.
// ---------------------------------------------------------------------------

console.log('\nthumbnails');
for (const shape of ['landscape', 'portrait']) {
  for (const layout of ['statement', 'question', 'number', 'split']) {
    const inputProps = {
      content: EXPLAINER,
      design: { ...DEFAULT_DESIGN, orientation: shape },
      title: 'Where does your *electricity* come from?',
      kicker: 'Power', badge: 'PHYSICS', figure: '60%', symbol: '⚡',
      layout, shape,
    };
    const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps });
    const want = thumbSizeFor(shape);
    check(shape + ' ' + layout + ' is ' + want.width + 'x' + want.height,
      composition.width === want.width && composition.height === want.height,
      composition.width + 'x' + composition.height);

    const file = path.join(OUT, 'thumb-' + shape + '-' + layout + '.png');
    await renderStill({ composition, serveUrl, output: file, frame: 0, inputProps, overwrite: true });
    const kb = fs.statSync(file).size / 1024;
    check(shape + ' ' + layout + ' drew something', kb > BLANK_KB, Math.round(kb) + ' KB');
  }
}

console.log('\n' + (failures ? failures + ' FAILURES' : 'everything rendered') + '\n');
console.log('frames in ' + OUT + '\n');
process.exitCode = failures ? 1 : 0;
