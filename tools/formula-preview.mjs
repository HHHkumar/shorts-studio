// Render the formula card - the closing sheet of formulas - to see it rather
// than imagine it.
//
//   node --import ./tools/ts-resolve.mjs tools/formula-preview.mjs [--video]
//
// The six AC formulas of a typical revision sheet, as the end scene of a
// video in a few looks and both shapes, and as the carousel slide. Stills are
// taken once every card has landed and every graph has drawn; with --video
// the scene is rendered as a clip too, to see the cards arrive and the graphs
// move. Icons are looked up the way the app does (Iconify); offline, the
// cards simply have none.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { planCarousel } from '../src/lib/carousel.ts';
import { formulaHoldSeconds, tidySheet } from '../src/lib/formula-card.ts';
import { attachFormulaIcons } from '../server/formulas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'stills');
const FPS = 30;
const VIDEO = process.argv.includes('--video');

const graph = (kind, x, y, label = '', label2 = '') => ({ kind, x, y, label, label2 });
const SHEET = tidySheet({
  title: 'Alternating Current - Important Formulas',
  working: ['V_{rms} = \\frac{V_0}{\\sqrt{2}}', '= \\frac{325}{\\sqrt{2}}', '= \\frac{325}{1.414}', '= 230\\,V'],
  cards: [
    { name: 'Instantaneous Voltage', formula: 'v = V_0 \\sin(\\omega t)', notes: [], graph: graph('sine', 't', 'v', 'V_0'), icon: 'light bulb' },
    { name: 'Instantaneous Current', formula: 'i = I_0 \\sin(\\omega t)', notes: [], graph: graph('phase-shift', 't', 'i', 'v', 'i'), icon: 'ammeter' },
    { name: 'Angular Frequency', formula: '\\omega = 2\\pi f', notes: ['f = Frequency (Hz)', 'ω = Angular frequency (rad/s)'], graph: graph('phasor', '', '', '\\omega', '\\phi'), icon: 'gear' },
    { name: 'RMS Voltage', formula: 'V_{rms} = \\frac{V_0}{\\sqrt{2}}', notes: [], graph: graph('rms', 't', 'v', 'V_{rms}', 'V_0'), icon: 'multimeter' },
    { name: 'RMS Current', formula: 'I_{rms} = \\frac{I_0}{\\sqrt{2}}', notes: [], graph: graph('rms', 't', 'i', 'I_{rms}', 'I_0'), icon: 'multimeter' },
    { name: 'AC Power', formula: 'P = V_{rms} I_{rms} \\cos\\phi', notes: ['P = True power (W)', 'cos φ = Power factor'], graph: graph('power-triangle', '', '', '\\phi'), icon: 'power button' },
  ],
});
await attachFormulaIcons(SHEET, { root: ROOT }).catch((e) => console.log('icons: ' + e.message));
console.log('icons: ' + SHEET.cards.filter((c) => c.art).length + ' of ' + SHEET.cards.length);

const content = {
  videoKind: 'mcq', subject: 'Basic Electrical', topic: 'Alternating current', difficulty: 'easy',
  hook: '', question: 'What is the RMS value of a 325 V peak sine wave?', options: ['230 V', '325 V', '162 V', '460 V'],
  correctIndex: 0, answerLine: 'About 230 volts.', explanation: ['V rms = V0 / root 2', '325 / 1.414 = 230 V'],
  funFact: 'Indian mains is 230 V RMS - its peak is 325 V.', outro: '', hashtags: [], motifSymbols: ['⚡'],
  formulas: SHEET,
  script: [{ kind: 'formulas', narration: 'Here are the formulas behind this one. Save it for your revision.' }],
};

const CASES = [
  { name: 'simple-light-portrait', look: { layout: 'simple', mode: 'light' }, orientation: 'portrait' },
  { name: 'doodle-light-portrait', look: { layout: 'doodle', mode: 'light' }, orientation: 'portrait' },
  { name: 'nerdy-dark-landscape', look: { layout: 'nerdy', mode: 'dark' }, orientation: 'landscape' },
  { name: 'elegant-dark-portrait', look: { layout: 'elegant', mode: 'dark' }, orientation: 'portrait' },
];

fs.mkdirSync(OUT, { recursive: true });
await ensureBrowser();
console.log('bundling...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'),
  publicDir: path.join(ROOT, 'public'),
  onProgress: () => undefined,
});

const frames = Math.ceil(formulaHoldSeconds(SHEET.cards.length) * FPS);
for (const c of CASES) {
  const props = {
    content,
    design: { ...DEFAULT_DESIGN, ...c.look, orientation: c.orientation, music: 'none', sfx: false },
    scenes: content.script.map((line, i) => ({
      ...line, id: 's' + i, startFrame: 0, durationInFrames: frames, words: [], captionOffset: 0,
      audioSrc: '', audioDuration: 0, stockSrc: '', stockCredit: '',
    })),
    fps: FPS,
    totalDurationInFrames: frames,
  };
  const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
  // Late: every card in, every graph drawn and moving.
  const file = path.join(OUT, 'formulas-' + c.name + '.png');
  await renderStill({ composition, serveUrl, output: file, frame: frames - 20, inputProps: props, overwrite: true });
  console.log('  ' + path.basename(file));
  if (VIDEO) {
    const clip = path.join(OUT, 'formulas-' + c.name + '.mp4');
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: clip, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(clip));
  }
}

// The worked solution, written in over an explanation scene, in two looks.
const WORK_SECONDS = 7;
for (const look of [{ layout: 'simple', mode: 'light' }, { layout: 'doodle', mode: 'light' }]) {
  const worked = {
    ...content,
    script: [{ kind: 'explain', narration: 'Divide the peak by root two: 325 over 1.414 is about 230 volts.', visual: { kind: 'working' } }],
  };
  const frames = WORK_SECONDS * FPS;
  const props = {
    content: worked,
    design: { ...DEFAULT_DESIGN, ...look, orientation: 'portrait', music: 'none', sfx: false },
    scenes: worked.script.map((line, i) => ({
      ...line, id: 's' + i, startFrame: 0, durationInFrames: frames, words: [], captionOffset: 0,
      audioSrc: '', audioDuration: 0, stockSrc: '', stockCredit: '',
    })),
    fps: FPS,
    totalDurationInFrames: frames,
  };
  const composition = await selectComposition({ serveUrl, id: 'QuizVideo', inputProps: props });
  for (const [label, frame] of [['mid', Math.round(frames * 0.4)], ['end', frames - 10]]) {
    const file = path.join(OUT, 'working-' + look.layout + '-' + label + '.png');
    await renderStill({ composition, serveUrl, output: file, frame, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(file));
  }
  if (VIDEO) {
    const clip = path.join(OUT, 'working-' + look.layout + '.mp4');
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: clip, inputProps: props, overwrite: true });
    console.log('  ' + path.basename(clip));
  }
}

// The carousel slide, in two looks.
for (const look of [{ layout: 'simple', mode: 'light' }, { layout: 'doodle', mode: 'light' }]) {
  const design = { ...DEFAULT_DESIGN, ...look };
  const plan = planCarousel(content, { channelName: 'Electrical MCQs' });
  const index = plan.slides.findIndex((s) => s.kind === 'formulas');
  const props = { content, design, slide: plan.slides[index], index, total: plan.slides.length, channelName: 'Electrical MCQs' };
  const composition = await selectComposition({ serveUrl, id: 'CarouselSlide', inputProps: props });
  const file = path.join(OUT, 'formulas-slide-' + look.layout + '.png');
  await renderStill({ composition, serveUrl, output: file, frame: composition.durationInFrames - 1, inputProps: props, overwrite: true });
  console.log('  ' + path.basename(file));
}
console.log('wrote ' + OUT);
