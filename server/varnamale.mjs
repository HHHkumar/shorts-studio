// ---------------------------------------------------------------------------
// The Kannada alphabet video, from the app: its voice and its render.
//
// The video itself is fixed - the 49 letters of the school varnamale, laid out
// as a chart and read aloud one by one (src/lib/varnamale.ts draws the plan,
// src/remotion/Varnamale.tsx the frames). What there is to do is record its
// voice, once per voice and model, and render it. This is that, shared by the
// Alphabet page and tools/varnamale.mjs so the two can never record it
// differently.
//
// One clip per letter and per heading, in public/generated/varnamale/, with
// their measured lengths in manifest.json. A clip is kept while its model,
// voice and script line are unchanged, so recording again only records what is
// missing or stale; `redo` names letters to record again anyway (one the voice
// said wrongly), or 'all'.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speak } from './tts.mjs';
import { allSpoken, buildTimeline, LETTERS, totalFrames, voiceLine } from '../src/lib/varnamale.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VOICE_DIR = path.join(ROOT, 'public', 'generated', 'varnamale');
const MANIFEST = path.join(VOICE_DIR, 'manifest.json');
export const VIDEO_FILE = path.join(ROOT, 'out', 'kannada-varnamale.mp4');
export const FPS = 30;
export const COMPOSITION_ID = 'Varnamale';

export function readManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return m && typeof m.clips === 'object' && m.clips ? m : { clips: {} };
  } catch {
    return { clips: {} };
  }
}

/** Whether a line's clip on disk is the one this voice and model would record now. */
function isCurrent(kept, line, voiceId, modelId) {
  return Boolean(kept) && kept.said === voiceLine(line, modelId) && kept.modelId === modelId && kept.voiceId === voiceId
    && fs.existsSync(path.join(VOICE_DIR, line.id + '.mp3'));
}

/**
 * Letters named the way a person would name them - "ಕ, ಖ", "ka", "l07" -
 * turned into line ids. Anything not recognised is returned separately, so it
 * can be said rather than silently skipped.
 */
export function redoIds(names) {
  const ids = [];
  const unknown = [];
  for (const raw of (Array.isArray(names) ? names : String(names || '').split(/[,\s]+/))) {
    const name = String(raw || '').trim();
    if (!name) continue;
    if (name.toLowerCase() === 'all') { ids.push('all'); continue; }
    const line = allSpoken().find((l) => l.id === name.toLowerCase());
    const letter = LETTERS.find((l) => l.glyph === name || l.roman === name.toLowerCase());
    if (line) ids.push(line.id);
    else if (letter) ids.push(letter.id);
    else unknown.push(name);
  }
  return { ids: [...new Set(ids)], unknown };
}

/** Where the video stands for this voice and model: what is recorded, what is not, how long it runs. */
export function varnamaleStatus({ voiceId = '', modelId = '' } = {}) {
  const manifest = readManifest();
  const lines = allSpoken();
  const current = lines.filter((l) => isCurrent(manifest.clips[l.id], l, voiceId, modelId)).length;
  const recorded = lines.filter((l) => manifest.clips[l.id] && fs.existsSync(path.join(VOICE_DIR, l.id + '.mp3'))).length;
  const clips = recorded ? manifest.clips : null;
  let video = null;
  if (fs.existsSync(VIDEO_FILE)) {
    const st = fs.statSync(VIDEO_FILE);
    video = { url: '/out/' + path.basename(VIDEO_FILE) + '?t=' + st.mtimeMs, at: st.mtime.toISOString(), bytes: st.size };
  }
  // Characters the next recording would send, for the cost before anything is spent.
  const toSend = lines.filter((l) => !isCurrent(manifest.clips[l.id], l, voiceId, modelId))
    .reduce((n, l) => n + voiceLine(l, modelId || 'eleven_v4').length, 0);
  return {
    lines: lines.length,
    letters: LETTERS.length,
    recorded,
    current,
    toSend,
    clips,
    seconds: totalFrames(buildTimeline(clips, FPS)) / FPS,
    video,
  };
}

/**
 * Record every clip that is missing or stale for this voice and model, and
 * any named in `redo`. Saved after every clip, so a failure halfway keeps
 * everything before it.
 */
export async function recordVarnamale({ apiKey, voiceId, modelId = 'eleven_v4', redo = [], onProgress = () => undefined }) {
  if (!apiKey) throw new Error('No ElevenLabs API key was sent. Add it on the Keys step.');
  if (!voiceId) throw new Error('Pick a voice first.');
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const manifest = readManifest();
  const lines = allSpoken();
  const again = new Set(redo);
  const todo = lines.filter((l) => again.has('all') || again.has(l.id) || !isCurrent(manifest.clips[l.id], l, voiceId, modelId));

  for (const [n, line] of todo.entries()) {
    onProgress({ done: n, total: todo.length, stage: 'Recording ' + line.text + ' (' + (n + 1) + ' of ' + todo.length + ')' });
    const said = voiceLine(line, modelId);
    // Steady rather than expressive: a learner is copying this sound. Style and
    // speed are left out - v4 takes neither, and speak() drops them for it.
    const clip = await speak(apiKey, said, { voiceId, modelId, stability: 0.5, similarity: 0.8 });
    if (!clip) continue;
    fs.writeFileSync(path.join(VOICE_DIR, line.id + '.mp3'), clip.buffer);
    manifest.clips[line.id] = { src: 'generated/varnamale/' + line.id + '.mp3', duration: clip.duration, text: line.text, said, modelId, voiceId };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }
  onProgress({ done: todo.length, total: todo.length, stage: 'Voice recorded' });
  return { made: todo.length, kept: lines.length - todo.length, seconds: totalFrames(buildTimeline(manifest.clips, FPS)) / FPS };
}

/** The props the composition is rendered with: the clips, if any, and the music bed. */
export function varnamaleProps({ music = true } = {}) {
  const manifest = readManifest();
  return { clips: Object.keys(manifest.clips).length ? manifest.clips : null, music: music !== false };
}
