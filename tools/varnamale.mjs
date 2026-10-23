// The Kannada alphabet video: record its voice, check its frames, render it.
//
//   node --import ./tools/ts-resolve.mjs tools/varnamale.mjs voice
//   node --import ./tools/ts-resolve.mjs tools/varnamale.mjs still 0 400 1200
//   node --import ./tools/ts-resolve.mjs tools/varnamale.mjs render
//
// voice   One ElevenLabs clip per letter and per heading, into
//         public/generated/varnamale/, with their measured lengths in
//         manifest.json. A clip is kept while its model, voice and script line
//         are unchanged, so a re-run only records what is missing or stale;
//         --redo l07,l12 records those again (for a letter the voice said
//         wrongly), --redo all records everything.
//         Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the environment -
//         the app keeps its keys in the browser, so this cannot borrow them.
//         ELEVENLABS_MODEL overrides the model (default eleven_v4). What each
//         line says, directions included, is voiceLine() in varnamale.ts.
// still   PNGs of the given frames into stills/varnamale/, for checking the
//         chart without rendering the whole video.
// render  out/kannada-varnamale.mp4. Uses the voice if it has been recorded
//         and renders silent at fixed timings if not. --no-music drops the bed.
//
// The timeline is buildTimeline() in src/lib/varnamale.ts: each letter is lit
// for as long as its own clip plays, so recording again re-times the video.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { speak } from '../server/tts.mjs';
import { allSpoken, buildTimeline, totalFrames, voiceLine } from '../src/lib/varnamale.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const VOICE_DIR = path.join(PUBLIC, 'generated', 'varnamale');
const MANIFEST = path.join(VOICE_DIR, 'manifest.json');
const FPS = 30;
const ID = 'Varnamale';

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes('--' + name);
const option = (name) => {
  const at = rest.indexOf('--' + name);
  return at >= 0 ? rest[at + 1] : undefined;
};

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return { clips: {} };
  }
}

// --- voice -------------------------------------------------------------------

async function voice() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    console.error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID first (the same key and voice the app uses).');
    process.exit(1);
  }
  const modelId = process.env.ELEVENLABS_MODEL || 'eleven_v4';
  const redo = (option('redo') || '').split(',').filter(Boolean);

  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const manifest = readManifest();

  const lines = allSpoken();
  let made = 0;
  for (const [i, line] of lines.entries()) {
    const file = path.join(VOICE_DIR, line.id + '.mp3');
    const said = voiceLine(line, modelId);
    const kept = manifest.clips[line.id];
    // One video in one voice: a clip from another model, voice or wording is
    // recorded again rather than left to sound unlike its neighbours.
    const current = kept && kept.said === said && kept.modelId === modelId && kept.voiceId === voiceId && fs.existsSync(file);
    const again = redo.includes('all') || redo.includes(line.id);
    if (current && !again) continue;

    process.stdout.write('  ' + String(i + 1).padStart(2) + '/' + lines.length + '  ' + line.id.padEnd(9) + line.text + ' … ');
    // Steady rather than expressive: a learner is copying this sound. Style and
    // speed are left out - v4 takes neither, and speak() drops them for it.
    const clip = await speak(apiKey, said, { voiceId, modelId, stability: 0.5, similarity: 0.8 });
    fs.writeFileSync(file, clip.buffer);
    manifest.clips[line.id] = { src: 'generated/varnamale/' + line.id + '.mp3', duration: clip.duration, text: line.text, said, modelId, voiceId };
    // Saved after every clip, so a failure halfway keeps everything before it.
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(clip.duration.toFixed(2) + 's');
    made++;
  }
  const seconds = totalFrames(buildTimeline(manifest.clips, FPS)) / FPS;
  console.log('\n' + made + ' recorded, ' + (lines.length - made) + ' kept. The video will run ' + seconds.toFixed(1) + 's.');
}

// --- still / render ------------------------------------------------------------

async function prepare() {
  await ensureBrowser();
  console.log('Bundling…');
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'), publicDir: PUBLIC });
  const manifest = readManifest();
  const recorded = Object.keys(manifest.clips).length;
  const inputProps = { clips: recorded ? manifest.clips : null, music: !flag('no-music') };
  console.log(recorded ? recorded + ' voice clips found.' : 'No voice recorded yet - rendering silent at fixed timings.');
  const composition = await selectComposition({ serveUrl, id: ID, inputProps });
  return { serveUrl, inputProps, composition };
}

async function still() {
  const frames = rest.filter((a) => /^\d+$/.test(a)).map(Number);
  if (!frames.length) frames.push(0);
  const { serveUrl, inputProps, composition } = await prepare();
  const dir = path.join(ROOT, 'stills', 'varnamale');
  fs.mkdirSync(dir, { recursive: true });
  for (const frame of frames) {
    const output = path.join(dir, 'frame-' + String(frame).padStart(5, '0') + '.png');
    await renderStill({ serveUrl, composition, inputProps, frame: Math.min(frame, composition.durationInFrames - 1), output });
    console.log('  ' + path.relative(ROOT, output));
  }
}

async function render() {
  const { serveUrl, inputProps, composition } = await prepare();
  const out = path.join(ROOT, 'out', 'kannada-varnamale.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let shown = -1;
  await renderMedia({
    serveUrl, composition, inputProps, codec: 'h264', crf: 18, outputLocation: out,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct % 10 === 0 && pct !== shown) console.log('  ' + (shown = pct) + '%');
    },
  });
  console.log((composition.durationInFrames / FPS).toFixed(1) + 's -> ' + path.relative(ROOT, out));
}

const COMMANDS = { voice, still, render };
if (!COMMANDS[command]) {
  console.error('Usage: tools/varnamale.mjs voice [--redo l07,l12|all] | still <frame...> | render [--no-music]');
  process.exit(1);
}
await COMMANDS[command]();
