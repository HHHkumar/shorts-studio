// Render the Doodle look as stills, to see it rather than imagine it.
//
//   node --import ./tools/ts-resolve.mjs tools/doodle-preview.mjs [portrait|landscape] [light|dark]
//
// One still per scene, taken after the entrance has settled, for a quiz and an
// explainer. What to look at:
//   - the paper of the drawing should vanish into the page - no rectangle;
//   - the words should be in Kalam, not the fallback;
//   - nothing in the text band should run into the drawing or off the frame,
//     especially the options list and the explainer panels, which are the
//     tallest things a scene draws.
//
// It uses the mascot lab's test drawings when they are on this machine (they
// are scratch files, not committed) and the committed model sheet otherwise,
// so it runs anywhere the repo is checked out.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { normalizePanel } from '../server/explainer.mjs';
import { attachIcons } from '../server/icons.mjs';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'stills');
const ORIENTATION = process.argv[2] === 'landscape' ? 'landscape' : 'portrait';
const MODE = process.argv[3] === 'dark' ? 'dark' : 'light';
const FPS = 30;
const SCENE_SECONDS = 3;

/** The newest lab test's drawings, else the model sheet for every scene. */
function drawings() {
  const labRoot = path.join(PUBLIC, 'generated', 'mascot');
  const tests = fs.existsSync(labRoot)
    ? fs.readdirSync(labRoot).filter((d) => d.startsWith('test-'))
      .map((d) => ({ d, t: fs.statSync(path.join(labRoot, d)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  if (tests.length) {
    const dir = 'generated/mascot/' + tests[0].d + '/';
    return (beat) => (fs.existsSync(path.join(PUBLIC, dir + beat + '.jpg')) ? dir + beat + '.jpg' : 'mascot/mascot.jpg');
  }
  return () => 'mascot/mascot.jpg';
}
const art = drawings();

const QUIZ = {
  videoKind: 'mcq',
  subject: 'Electrical Measurements', topic: 'Energy meters', difficulty: 'medium',
  hook: 'Your meter is spinning with everything switched off.',
  question: 'An induction energy meter\'s disc keeps rotating slowly when no load is connected. What is this called?',
  options: ['Creeping', 'Phase error', 'Friction compensation', 'Speed error'],
  correctIndex: 0,
  answerLine: 'It is called creeping.', explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: ['⚡'],
  script: [
    { kind: 'hook', narration: 'Your meter is spinning with everything in the house switched off.', doodleSrc: art('hook') },
    { kind: 'question', narration: 'An induction energy meter\'s disc keeps rotating slowly when no load is connected. What is this called?', doodleSrc: art('question') },
    { kind: 'options', narration: 'Is it creeping, phase error, friction compensation, or speed error?', doodleSrc: art('think') },
    { kind: 'answer', narration: 'The answer is creeping.', doodleSrc: art('answer') },
    { kind: 'explain', narration: 'Over-compensation for friction gives the disc a small driving torque even at no load, so it keeps turning.', doodleSrc: art('explain') },
    { kind: 'outro', narration: 'Follow for one electrical question a day.', doodleSrc: art('hook') },
  ],
};

const EXPLAINER = {
  videoKind: 'explainer',
  subject: 'Power', topic: 'Turbines', difficulty: 'medium',
  hook: '', question: 'How does a turbine make electricity?', options: [], correctIndex: 0,
  answerLine: '', explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: ['⚡'],
  script: [
    { kind: 'title', narration: 'How does a spinning turbine end up as electricity in your wall?', doodleSrc: art('think') },
    {
      kind: 'process',
      narration: 'Steam flows into the turbine, the blades spin, and the generator turns that rotation into current.',
      panel: normalizePanel({ steps: [
        { label: 'Boiler', detail: 'Water becomes steam', icon: 'boiler' },
        { label: 'Turbine', detail: 'Steam turns the blades', icon: 'wind turbine' },
        { label: 'Generator', detail: 'Rotation becomes current', icon: 'lightning bolt' },
      ] }, 'process'),
      doodleSrc: art('explain'),
    },
    {
      kind: 'versus',
      narration: 'One design lets the heat escape; the other holds it in and does more work for the same fuel.',
      panel: normalizePanel({
        leftLabel: 'Heat escapes', rightLabel: 'Heat held in',
        leftPoints: ['Output falls', 'More fuel burnt'], rightPoints: ['Pressure rises', 'Same fuel, more work'],
      }, 'versus'),
      doodleSrc: art('zap'),
    },
    { kind: 'recap', narration: 'Heat, then motion, then current. Three steps, every power station.', doodleSrc: art('answer') },
  ],
};

/** Even word timings, standing in for ElevenLabs. */
const timed = (line) => line.narration.split(/\s+/).filter(Boolean).map((word, i, all) => {
  const per = (SCENE_SECONDS - 0.4) / all.length;
  return { word, start: i * per, end: (i + 1) * per };
});

function propsFor(content) {
  const frames = SCENE_SECONDS * FPS;
  return {
    content,
    design: {
      ...DEFAULT_DESIGN, layout: 'doodle', mode: MODE, orientation: ORIENTATION,
      music: 'none', sfx: false, transition: 'crossfade',
    },
    scenes: content.script.map((line, i) => ({
      ...line,
      id: 's' + i,
      startFrame: i * frames,
      durationInFrames: frames,
      words: timed(line),
      captionOffset: 0,
      audioSrc: '',
      audioDuration: 0,
      stockSrc: '',
      stockCredit: '',
    })),
    fps: FPS,
    totalDurationInFrames: content.script.length * frames,
  };
}

fs.mkdirSync(OUT, { recursive: true });
const icons = await attachIcons(EXPLAINER, { root: ROOT });
console.log('explainer artwork: ' + icons.resolved + ' resolved');
await ensureBrowser();
console.log('bundling...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: PUBLIC,
  onProgress: () => undefined,
});

for (const [name, content] of [['quiz', QUIZ], ['explainer', EXPLAINER]]) {
  const props = propsFor(content);
  const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
  for (const scene of props.scenes) {
    // Late in the scene: the entrance has settled and most words are read.
    const frame = scene.startFrame + Math.round(scene.durationInFrames * 0.8);
    const file = path.join(OUT, 'doodle-' + ORIENTATION + '-' + MODE + '-' + name + '-' + scene.id + '-' + scene.kind + '.png');
    await renderStill({ composition, serveUrl, output: file, frame, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(file));
  }
}
console.log('wrote ' + OUT);
