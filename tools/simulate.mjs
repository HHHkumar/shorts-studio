// A dry run of the whole pipeline, without an API key.
//
//   npm run simulate            check only, no render
//   npm run simulate -- --render  also encode a real mp4
//
// Run it through npm, or with the resolver loaded first:
//   node --import ./tools/ts-resolve.mjs tools/simulate.mjs
//
// Model output cannot be exercised here - the keys live in the browser - so
// this feeds the pipeline a storyboard shaped exactly like a model's reply and
// puts it through every real stage after that: the normalizer, the motion
// check, the icon fetch, the timeline, the upload kit and the renderer.
//
// The point is that every function called below is the same one a live
// generation calls. Nothing is stubbed except the model and the voice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { checkMotion, normalizeStoryboard } from '../server/explainer.mjs';
import { attachIcons } from '../server/icons.mjs';
import { buildPublishKit } from '../server/publish-kit.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDER = process.argv.includes('--render');
const FPS = 30;

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
  if (!cond) failures++;
};

// ---------------------------------------------------------------------------
// A storyboard shaped exactly like a model reply, warts included: an unknown
// scene kind, a beat aimed at a missing actor, a cue the narration never says,
// and an outro in the wrong place. A real reply has a couple of these.
// ---------------------------------------------------------------------------

const RAW = {
  topic: 'Why dams stop salmon',
  question: 'How does a fish get past a dam?',
  hook: 'A wall of concrete can end a salmon run that is ten thousand years old.',
  outro: 'Follow for more of how the world actually works.',
  hashtags: ['rivers', 'salmon', 'engineering'],
  motifSymbols: ['🐟', '🌊'],
  script: [
    {
      kind: 'title',
      narration: 'Every dam built on a salmon river asks the same awkward question of its engineers.',
      panel: { title: 'How does a fish get past a dam?', subtitle: 'And what happens when it cannot.' },
    },
    {
      kind: 'metaphor',
      narration: 'Think of a motorway with no junction for a hundred miles. You can see where you '
        + 'need to be, but there is no way off. A dam does that to a river, and a salmon has no '
        + 'other route home.',
      panel: {
        leftLabel: 'Motorway, no exit', rightLabel: 'River, dammed',
        leftSymbol: '🛣️', rightSymbol: '🌊',
        leftPoints: ['You can see the turning', 'No way to reach it'],
        rightPoints: ['Spawning ground upstream', 'No way to climb'],
      },
    },
    {
      kind: 'motion',
      narration: 'A salmon heading upstream meets a wall of concrete it has no way over, and the '
        + 'whole run collapses behind it. Cut a fish ladder into the side and the salmon climbs '
        + 'it in shallow steps, one at a time, until it is finally past.',
      panel: {
        title: 'A way over',
        actors: [
          { id: 'fish', icon: 'fish', label: 'Salmon', x: 0.12, y: 0.62, accent: true },
          { id: 'dam', icon: 'dam', label: 'Dam', x: 0.52, y: 0.55, scale: 1.4 },
          { id: 'ladder', icon: 'stairs', label: 'Fish ladder', x: 0.78, y: 0.42, hidden: true },
        ],
        beats: [
          { actor: 'fish', action: 'move', to: 'dam', cue: 'upstream' },
          { actor: 'fish', action: 'blocked', to: 'dam', cue: 'wall of concrete' },
          { actor: 'ladder', action: 'appear', cue: 'fish ladder' },
          { actor: 'fish', action: 'climb', to: 'ladder', cue: 'climbs' },
          // Deliberately malformed: no such actor. Must be dropped, not drawn.
          { actor: 'otter', action: 'pulse', cue: 'past' },
        ],
      },
    },
    {
      kind: 'process',
      narration: 'A ladder works in three moves. It splits the drop into small steps, it keeps '
        + 'water flowing down them so the fish can smell the river above, and it slows that flow '
        + 'enough that a tired salmon can still swim against it.',
      panel: {
        steps: [
          { label: 'Small steps', detail: 'The drop is divided up' },
          { label: 'Water flowing', detail: 'The fish can smell upstream' },
          { label: 'Slowed enough', detail: 'A tired salmon can swim it' },
        ],
      },
    },
    // Out of order on purpose: the normalizer must move this to the end.
    { kind: 'outro', narration: 'Follow for more of how the world actually works.' },
    {
      kind: 'recap',
      narration: 'So: a dam is a wall, a ladder is a way over it, and the fish needs small steps, '
        + 'flowing water and a current it can still beat.',
      panel: {
        title: 'What to remember',
        steps: [{ label: 'A dam is a wall' }, { label: 'A ladder is a way over' }, { label: 'Small steps win' }],
      },
    },
    // An invented kind. Must degrade to a plain talking beat, not throw.
    { kind: 'montage', narration: 'Some rivers now have ladders on every dam along their length.' },
  ],
};

console.log('\n=== 1. the normalizer ===');
const content = normalizeStoryboard(RAW, {});
const kinds = content.script.map((s) => s.kind);
console.log('  scenes: ' + kinds.join(' -> '));
check('a motion scene survives', kinds.includes('motion'));
check('an unknown kind degrades instead of throwing', kinds.includes('explain'));
check('the outro is moved to the end', kinds[kinds.length - 1] === 'outro');
const motion = content.script.find((s) => s.kind === 'motion');
check('the motion panel is kept', !!(motion && motion.panel));
check('a beat naming a missing actor is dropped', motion.panel.beats.length === 4,
  motion.panel.beats.length + ' beats kept');
check('every beat names a declared actor',
  motion.panel.beats.every((b) => motion.panel.actors.some((a) => a.id === b.actor)));

console.log('\n=== 2. the motion check ===');
const notes = checkMotion(content);
notes.forEach((n) => console.log('  note: ' + n));
check('a clean motion scene raises no warnings', notes.length === 0, notes.join(' | '));

console.log('\n=== 3. the icon fetch ===');
const art = await attachIcons(content, { root: ROOT });
console.log('  ' + motion.panel.actors.map((a) => a.icon + ' -> ' + (a.iconName || 'NONE')).join(', '));
check('every actor found a picture', art.missing.length === 0, art.missing.join(', '));
check('every actor carries drawable art', motion.panel.actors.every((a) => a.art && a.art.body));
check('no icon needs an attribution credit', art.attribution.length === 0, art.attribution.join(', '));

console.log('\n=== 4. the timeline ===');
// No ElevenLabs here, so scenes fall back to their estimated length and the
// word timings are synthesised at the voice's own measured pace.
const design = { ...DEFAULT_DESIGN, orientation: 'landscape', ambient: 'none', music: 'none' };
const { scenes, totalDurationInFrames } = buildScenes(content.script, {}, design, FPS);
check('every scene got a real start frame', scenes.every((s) => Number.isFinite(s.startFrame)));
check('every scene got a real length', scenes.every((s) => Number.isFinite(s.durationInFrames) && s.durationInFrames > 0));
check('no two scenes overlap', scenes.every((s, i) =>
  i === 0 || s.startFrame >= scenes[i - 1].startFrame + scenes[i - 1].durationInFrames));
console.log('  cuts at: ' + scenes.map((x) => (x.startFrame / FPS).toFixed(1) + 's').join(', '));
check('the video has a real total length', Number.isFinite(totalDurationInFrames) && totalDurationInFrames > 0,
  Math.round(totalDurationInFrames / FPS) + 's');

// Stand in for the voiceover so the reveals and beats have something to align
// against, at the 2.6 words a second the real voice averages.
for (const scene of scenes) {
  const words = String(scene.narration || '').split(/\s+/).filter(Boolean);
  const per = (scene.durationInFrames / FPS) / Math.max(1, words.length);
  scene.words = words.map((word, i) => ({ word, start: i * per, end: (i + 1) * per }));
  scene.captionOffset = 0;
}

const motionScene = scenes.find((s) => s.kind === 'motion');
check('the motion scene survived into the timeline', !!motionScene);
check('the motion scene carries its actors and beats',
  !!(motionScene.panel && motionScene.panel.actors.length === 3 && motionScene.panel.beats.length === 4));
check('the artwork survived the timeline',
  motionScene.panel.actors.every((a) => a.art && a.art.body));

const props = { content, design, scenes, fps: FPS, totalDurationInFrames };

console.log('\n=== 5. the upload kit ===');
const SEO = {
  titles: ['How does a fish get past a dam?', 'The ladder that saved a salmon run'],
  description: 'A wall of concrete can end a salmon run that is ten thousand years old. '
    + 'Here is what a fish ladder actually does about it.',
  tags: ['rivers', 'salmon', 'fish ladder', 'civil engineering'],
  hashtags: ['#rivers', '#engineering'],
  pinnedComment: 'Which bit of infrastructure should we pull apart next?',
  thumbnailText: 'A way over',
};
const kit = buildPublishKit({
  content,
  design,
  seo: SEO,
  title: SEO.titles[0],
  scenes,
  fps: FPS,
  thumbnail: Buffer.from('89504e470d0a1a0a', 'hex'),
});
check('the kit is a well formed zip',
  kit.buffer.readUInt32LE(0) === 0x04034b50
  && kit.buffer.readUInt32LE(kit.buffer.length - 22) === 0x06054b50);
check('it carries the thumbnail', kit.hasThumbnail);
check('chapters were worked out from the real timeline', kit.chapters >= 3, kit.chapters + ' chapters');

const kitPath = path.join(ROOT, 'out', kit.name);
fs.mkdirSync(path.dirname(kitPath), { recursive: true });
fs.writeFileSync(kitPath, kit.buffer);
console.log('  ' + kitPath + '  (' + Math.round(kit.buffer.length / 1024) + ' KB)');

console.log('\n=== 6. the renderer ===');
await ensureBrowser();
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});
const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
check('the composition sizes itself from the props',
  composition.width === 1920 && composition.height === 1080,
  composition.width + 'x' + composition.height);
check('the composition length matches the timeline',
  composition.durationInFrames === totalDurationInFrames);

if (RENDER) {
  const out = path.join(ROOT, 'out', 'simulation.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: out, inputProps: props,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100 / 10) * 10;
      if (pct !== last) { last = pct; process.stdout.write(' ' + pct + '%'); }
    },
  });
  console.log('');
  const size = fs.statSync(out).size;
  check('an mp4 was written', size > 20000, Math.round(size / 1024) + ' KB');
  console.log('  ' + out);
}

console.log('\n' + (failures ? failures + ' FAILURES' : 'every stage passed') + '\n');
process.exitCode = failures ? 1 : 0;
