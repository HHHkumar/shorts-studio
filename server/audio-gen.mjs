// ---------------------------------------------------------------------------
// Music and sound effects, synthesised from scratch.
//
// Nothing is downloaded and nothing is bundled, so there is no licensing
// question about the audio in your videos: these waveforms are generated here,
// on your machine, every time.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const RATE = 44100;

// --- WAV writing ------------------------------------------------------------

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    // Soft clip, then convert to 16-bit signed.
    const v = Math.tanh(samples[i]);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// --- tiny synth helpers -----------------------------------------------------

/** Semitones above A2 (110 Hz), the root all the beds are built on. */
const note = (semitones) => 110 * Math.pow(2, semitones / 12);

/** A slightly warm tone: a sine plus a quiet fifth-ish harmonic. */
function voice(t, freq, warmth = 0.25) {
  return (
    Math.sin(2 * Math.PI * freq * t) +
    warmth * Math.sin(2 * Math.PI * freq * 2 * t) +
    warmth * 0.4 * Math.sin(2 * Math.PI * freq * 3 * t)
  );
}

/** Percussive envelope: fast attack, exponential decay. */
const pluck = (age, decay) => (age < 0 ? 0 : Math.exp(-age * decay));

/** Smooth in and out so a loop never clicks at the seam. */
function loopFade(i, total, seconds = 0.35) {
  const n = seconds * RATE;
  if (i < n) return i / n;
  if (i > total - n) return (total - i) / n;
  return 1;
}

// --- the three music beds ---------------------------------------------------

const BED_SECONDS = 16;

/** Slow sustained chords. Sits under a voice without asking for attention. */
function calmPad(i, t) {
  // Four chords, one per four seconds: Am - F - C - G, voiced low.
  const chords = [[0, 3, 7], [-4, 0, 5], [3, 7, 12], [-2, 2, 7]];
  const bar = Math.floor(t / 4) % chords.length;
  const chord = chords[bar];
  const into = (t % 4) / 4;
  // Cross-fade between chords so nothing steps abruptly.
  const swell = 0.5 - 0.5 * Math.cos(2 * Math.PI * into);

  let s = 0;
  for (const semi of chord) s += voice(t, note(semi), 0.12);
  s /= chord.length;

  const breathe = 0.75 + 0.25 * Math.sin(2 * Math.PI * t / 8);
  return s * 0.34 * breathe * (0.65 + 0.35 * swell);
}

/** A low pulse with a quiet ticking high. Adds pressure without a melody. */
function tensePulse(i, t) {
  const bpm = 96;
  const beat = 60 / bpm;
  const age = t % beat;

  const sub = voice(t, note(-12), 0.05) * pluck(age, 7) * 0.55;
  const body = Math.sin(2 * Math.PI * note(0) * t) * 0.14 * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 6));

  // A soft off-beat tick made from filtered noise.
  const offAge = (t + beat / 2) % beat;
  const tick = (Math.sin(i * 12.9898) * 43758.5453 % 1) * pluck(offAge, 60) * 0.05;

  return sub + body + tick;
}

/** A gentle arpeggio. Bright, but stays out of the voice's range. */
function upbeat(i, t) {
  const bpm = 112;
  const step = 60 / bpm / 2; // eighth notes
  const pattern = [12, 16, 19, 24, 19, 16];
  const idx = Math.floor(t / step);
  const age = t % step;
  const semi = pattern[idx % pattern.length];

  const lead = voice(t, note(semi), 0.18) * pluck(age, 9) * 0.3;
  const bassSemi = [0, 0, -4, 5][Math.floor(t / 2) % 4];
  const bassAge = t % 0.5;
  const bass = voice(t, note(bassSemi - 12), 0.05) * pluck(bassAge, 6) * 0.4;

  return lead + bass;
}

const BEDS = {
  calm: calmPad,
  tense: tensePulse,
  upbeat,
};

export const MUSIC_MOODS = [
  { id: 'none', label: 'No music' },
  { id: 'calm', label: 'Calm pad — soft chords, stays out of the way' },
  { id: 'tense', label: 'Tense pulse — a low heartbeat, good for hard questions' },
  { id: 'upbeat', label: 'Upbeat — light arpeggio, good for fast fun facts' },
];

function renderBed(mood) {
  const fn = BEDS[mood];
  if (!fn) return null;
  const total = BED_SECONDS * RATE;
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / RATE;
    out[i] = fn(i, t) * loopFade(i, total);
  }
  return toWav(out);
}

// --- sound effects ----------------------------------------------------------

/** One second is plenty for any of these. */
function renderEffect(name) {
  const build = (seconds, fn) => {
    const total = Math.round(seconds * RATE);
    const out = new Float32Array(total);
    for (let i = 0; i < total; i++) out[i] = fn(i / RATE, i);
    return toWav(out);
  };

  if (name === 'tick') {
    // A short woodblock-ish click for each countdown second.
    return build(0.16, (t) => voice(t, 880, 0.3) * pluck(t, 42) * 0.5);
  }

  if (name === 'chime') {
    // A rising three-note sparkle for the answer reveal.
    return build(1.1, (t) => {
      const notes = [note(12), note(16), note(19)];
      let s = 0;
      notes.forEach((f, n) => {
        const age = t - n * 0.09;
        if (age > 0) s += Math.sin(2 * Math.PI * f * t) * pluck(age, 3.4);
      });
      return s * 0.3;
    });
  }

  if (name === 'whoosh') {
    // Filtered noise sweeping up, for an option sliding in.
    return build(0.34, (t, i) => {
      const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const sweep = Math.sin(2 * Math.PI * (300 + 1400 * t) * t) * 0.25;
      const env = Math.sin(Math.PI * Math.min(1, t / 0.34));
      return (noise * 0.35 + sweep) * env * 0.28;
    });
  }

  if (name === 'transition') {
    // A soft downward sweep between scenes.
    return build(0.42, (t, i) => {
      const noise = (Math.sin(i * 7.3319) * 91731.771) % 1;
      const env = Math.exp(-t * 7);
      const tone = Math.sin(2 * Math.PI * (900 - 700 * t) * t) * 0.2;
      return (noise * 0.22 + tone) * env * 0.3;
    });
  }

  return null;
}

export const EFFECT_NAMES = ['tick', 'chime', 'whoosh', 'transition'];

// --- caching ----------------------------------------------------------------

/**
 * Generate everything once into public/audio/ and reuse it. Rendering 16
 * seconds of audio takes a moment, and the result never changes.
 */
export function ensureAudioAssets(publicDir) {
  const dir = path.join(publicDir, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const written = [];

  for (const mood of Object.keys(BEDS)) {
    const file = path.join(dir, 'bed-' + mood + '.wav');
    if (!fs.existsSync(file)) {
      const wav = renderBed(mood);
      if (wav) {
        fs.writeFileSync(file, wav);
        written.push(path.basename(file));
      }
    }
  }

  for (const name of EFFECT_NAMES) {
    const file = path.join(dir, 'sfx-' + name + '.wav');
    if (!fs.existsSync(file)) {
      const wav = renderEffect(name);
      if (wav) {
        fs.writeFileSync(file, wav);
        written.push(path.basename(file));
      }
    }
  }

  return { dir, written, bedSeconds: BED_SECONDS };
}
