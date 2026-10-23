// ---------------------------------------------------------------------------
// Ambience loops, synthesised from scratch on first boot.
//
// Nothing downloaded, nothing bundled: these are generated here, so there is
// no licensing question about the sound under the videos. Seeded, so every
// machine makes the same files.
//
//   amb-wind.wav   desert wind: low rushing noise with slow gusts
//   amb-fire.wav   a hearth: soft roar with crackles and pops
//   amb-rain.wav   steady rain: hiss with droplets
//
// Each loop is 20 seconds and seamless: its tail is crossfaded into its head.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const RATE = 44100;
const SECONDS = 20;

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
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
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Small seeded PRNG (mulberry32): the same "random" every time. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One-pole low-pass: 0 < k < 1, smaller is darker. */
const lowpass = (k) => {
  let y = 0;
  return (x) => (y += k * (x - y));
};

/** Make the end flow into the start: crossfade the last `fade` seconds onto the first. */
function seamless(buf, fade = 1.5) {
  const n = Math.round(fade * RATE);
  const out = buf.slice(0, buf.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = out[i] * k + buf[buf.length - n + i] * (1 - k);
  }
  return out;
}

function normalise(buf, peak = 0.7) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const g = max ? peak / max : 1;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

function wind() {
  const r = rng(11);
  const total = (SECONDS + 1.5) * RATE;
  const out = new Float32Array(total);
  const body = lowpass(0.02);
  const air = lowpass(0.12);
  for (let i = 0; i < total; i++) {
    const t = i / RATE;
    const white = r() * 2 - 1;
    const gust = 0.55 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 0.83 + 1.3) + 0.1 * Math.sin(t * 2.1);
    out[i] = (body(white) * 3.2 + air(white) * 0.35 * gust) * gust;
  }
  return normalise(seamless(out), 0.6);
}

function fire() {
  const r = rng(23);
  const total = (SECONDS + 1.5) * RATE;
  const out = new Float32Array(total);
  const roar = lowpass(0.012);
  const hiss = lowpass(0.5);
  let crackle = 0;
  let decay = 0.99;
  for (let i = 0; i < total; i++) {
    const white = r() * 2 - 1;
    // A crackle: a sharp click with a quick decay, a few times a second, sometimes a bigger pop.
    if (r() < 9 / RATE) {
      crackle = (r() < 0.15 ? 1 : 0.35 + r() * 0.3) * (r() < 0.5 ? 1 : -1);
      decay = 0.93 + r() * 0.05;
    }
    crackle *= decay;
    out[i] = roar(white) * 4 + (hiss(white) - white * 0.5) * 0.04 + crackle * (r() * 2 - 1);
  }
  return normalise(seamless(out), 0.65);
}

function rain() {
  const r = rng(37);
  const total = (SECONDS + 1.5) * RATE;
  const out = new Float32Array(total);
  const bed = lowpass(0.35);
  const low = lowpass(0.03);
  let drop = 0;
  for (let i = 0; i < total; i++) {
    const white = r() * 2 - 1;
    if (r() < 60 / RATE) drop = (0.2 + r() * 0.5) * (r() < 0.5 ? 1 : -1);
    drop *= 0.9;
    // High-passed hiss (noise minus its low part) with a soft body and droplets on top.
    const hiss = bed(white) - low(white);
    out[i] = hiss * 0.9 + low(white) * 0.6 + drop * (r() * 2 - 1);
  }
  return normalise(seamless(out), 0.55);
}

const AMBIENCES = { wind, fire, rain };

/** Write any missing ambience files into public/audio. Returns the names written. */
export function ensureAmbience(publicDir) {
  const dir = path.join(publicDir, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const [name, make] of Object.entries(AMBIENCES)) {
    const file = path.join(dir, 'amb-' + name + '.wav');
    if (fs.existsSync(file)) continue;
    fs.writeFileSync(file, toWav(make()));
    written.push(path.basename(file));
  }
  return written;
}
