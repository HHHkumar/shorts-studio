// ---------------------------------------------------------------------------
// Beats: something new on screen every few seconds.
//
// Viewers drift when one picture holds for twelve seconds. Editors keep them
// with small changes - a punch-in on a detail, a key word slammed on screen.
// This finds every stretch longer than the Look step's pace with nothing new
// in it (no cut, no callout), and fills it with beats:
//
//   punch   a snap zoom onto a detail of the picture, then back out next beat
//   pop     a key word from the narration - a number, a name - stamped on
//           screen as it is spoken
//
// Beats sit on words, like everything else, so they land on the syllable.
// Pure and frame-exact: the same script always gets the same beats.
// ---------------------------------------------------------------------------

import type { BeatStyle, TimedBeat, TimedCallout, TimedShot, Word } from './types';

export type { BeatStyle, TimedBeat };

const STOP = new Set(('a an the and or but so of in on at to for from by with as is are was were be been being it its this that these those ' +
  'he she they we you i his her their our your them him us me my who whom which what when where why how not no yes do does did ' +
  'has have had will would can could should may might must just very also than then there here into onto over under about after ' +
  'before while because if until out up down off again more most some any each every all both few other such only own same too ' +
  'now even still ever never one').split(' '));

const NUMBER_WORDS = new Set('hundred thousand million billion trillion lakh lakhs crore crores percent per cent'.split(' '));

/** Words that are capitalised only because they start a sentence, or always. */
const CAP_NOISE = new Set('I The A An And But So Yet Or In On At To For From By With As It Its This That These Those He She They We You Our Their His Her Then There Here Now Today Yesterday Tomorrow When Where Why How What Who Which If Because While After Before Still Even Just Only Also Some Many Most One'.split(' '));

const bare = (w: string) => w.replace(/^[^\p{L}\p{N}₹$€£]+|[^\p{L}\p{N}%]+$/gu, '');
const endsSentence = (w: string) => /[.!?]["'”’)]*$/.test(w);
const isNumber = (w: string) => /^[₹$€£]?\d[\d,.]*%?$/.test(w) || NUMBER_WORDS.has(w.toLowerCase());
const isCap = (w: string) => /^\p{Lu}/u.test(w);
/** "MP", "BJP", "NASA": a name on its own, and the end of any name run before it. */
const isAcronym = (w: string) => /^\p{Lu}{2,5}s?$/u.test(w);

export type Keyword = { index: number; text: string; score: number };

/**
 * The words worth putting on screen: numbers with their unit ("300 MPs", "₹500 crore"),
 * names ("Election Commission", "New Delhi"), and long uncommon words, best first.
 */
export function keywords(words: Word[]): Keyword[] {
  const raw = words.map((w) => w.word);
  const out: Keyword[] = [];
  let i = 0;
  while (i < raw.length) {
    const w = bare(raw[i]);
    const sentenceStart = i === 0 || endsSentence(raw[i - 1]);
    if (!w) { i++; continue; }
    if (/\d/.test(w)) {
      // The number, then up to two more words of it ("2.5 lakh", "40 percent") and its unit ("MPs").
      const parts = [w];
      let j = i + 1;
      while (j < raw.length && parts.length < 3 && !endsSentence(raw[j - 1]) && isNumber(bare(raw[j]))) parts.push(bare(raw[j++]));
      const unit = j < raw.length && !endsSentence(raw[j - 1]) ? bare(raw[j]) : '';
      if (unit && !STOP.has(unit.toLowerCase()) && unit.length > 1) { parts.push(unit); j++; }
      out.push({ index: i, text: parts.join(' '), score: 3 + (parts.length > 1 ? 0.5 : 0) });
      i = j;
      continue;
    }
    if (isAcronym(w) && w !== 'I') {
      out.push({ index: i, text: w, score: 2 });
      i++;
      continue;
    }
    if (isCap(w) && !CAP_NOISE.has(w)) {
      const parts = [w];
      let j = i + 1;
      while (j < raw.length && parts.length < 3 && !endsSentence(raw[j - 1]) && isCap(bare(raw[j])) && !isAcronym(bare(raw[j])) && !CAP_NOISE.has(bare(raw[j]))) parts.push(bare(raw[j++]));
      // A lone capital at the start of a sentence is usually just the start of a sentence.
      if (parts.length > 1 || !sentenceStart) out.push({ index: i, text: parts.join(' '), score: 2 + (parts.length > 1 ? 0.6 : 0) });
      i = j;
      continue;
    }
    if (w.length >= 9 && !STOP.has(w.toLowerCase())) out.push({ index: i, text: w, score: 1 + Math.min(0.5, (w.length - 9) * 0.1) });
    i++;
  }
  return out;
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type BeatInput = {
  words: Word[];
  /** Frames the scene owns, and where its narration starts (after a chapter card). */
  frames: number;
  leadIn: number;
  fps: number;
  shots: TimedShot[];
  callouts: TimedCallout[];
  /** Seconds: a new visual at least this often. 0 = no beats. */
  pace: number;
  style: BeatStyle;
  /** No beats before this frame (a title card, the Short's hook). */
  quietUntil?: number;
  /** Varies the punch points between scenes. */
  seed?: number;
};

export function planBeats(o: BeatInput): TimedBeat[] {
  if (!(o.pace > 0) || !o.words.length) return [];
  const { fps, frames } = o;
  const paceF = Math.round(o.pace * fps);
  const minGap = Math.max(Math.round(fps * 1.2), Math.round(paceF * 0.6));
  const lastAt = frames - Math.round(fps * 0.9);
  const wordFrame = (i: number) => o.leadIn + Math.round(o.words[i].start * fps);

  // Everything already new on screen: cuts, callouts, the narration starting.
  const events = [...new Set([0, o.leadIn, o.quietUntil || 0, ...o.shots.map((s) => s.from), ...o.callouts.map((c) => c.at)])]
    .filter((f) => f >= 0 && f < frames)
    .sort((a, b) => a - b);
  const floor = Math.max(o.leadIn, o.quietUntil || 0);

  // Where beats should land: evenly through each gap that is too long.
  const targets: number[] = [];
  const bounds = [...events, frames];
  for (let k = 0; k < bounds.length - 1; k++) {
    const a = bounds[k];
    const b = bounds[k + 1];
    if (b - a <= paceF * 1.25) continue;
    const n = Math.ceil((b - a) / paceF) - 1;
    for (let m = 1; m <= n; m++) targets.push(Math.round(a + ((b - a) * m) / (n + 1)));
  }
  if (!targets.length) return [];

  // Mixed beats only stamp strong words (numbers, names); a weak word is a punch instead.
  const keys = o.style === 'zoom' ? [] : keywords(o.words).filter((k) => o.style === 'words' || k.score >= 2);
  const usedText = new Set<string>();
  const taken: number[] = [...events];
  const shotAt = (f: number) => [...o.shots].reverse().find((s) => s.from <= f) || o.shots[0];
  const window = Math.round(fps * 0.9);
  const beats: TimedBeat[] = [];
  let count = 0;

  for (const t of targets) {
    const clear = (f: number) => f >= floor && f <= lastAt && taken.every((e) => Math.abs(e - f) >= minGap);
    const shot = shotAt(t);
    const graphic = Boolean(shot && shot.graphic);
    const wantPop = !graphic && (o.style === 'words' || (o.style === 'mix' && count % 2 === 0));
    let beat: TimedBeat | null = null;

    if (wantPop) {
      // The best key word spoken near the target, not on screen already in this scene.
      const near = keys
        .filter((k) => !usedText.has(k.text.toLowerCase()) && Math.abs(wordFrame(k.index) - t) <= window && clear(wordFrame(k.index)))
        .sort((x, y) => y.score - x.score || Math.abs(wordFrame(x.index) - t) - Math.abs(wordFrame(y.index) - t))[0];
      if (near) {
        const at = wordFrame(near.index);
        usedText.add(near.text.toLowerCase());
        beat = { kind: 'pop', at, until: at, text: near.text, zoom: 1, fx: 0.5, fy: 0.5, n: count };
      }
    }
    if (!beat) {
      // Snap the punch onto the nearest word start, so it hits with the voice.
      let at = -1;
      let best = Infinity;
      for (let i = 0; i < o.words.length; i++) {
        const f = wordFrame(i);
        const d = Math.abs(f - t);
        if (d <= window && d < best && clear(f)) { best = d; at = f; }
      }
      if (at < 0 && clear(t)) at = t;
      if (at < 0) continue;
      beat = { kind: 'punch', at, until: at, text: '', zoom: 1, fx: 0.5, fy: 0.5, n: count };
    }
    taken.push(beat.at);
    beats.push(beat);
    count++;
  }

  beats.sort((a, b) => a.at - b.at);

  // Punches alternate in and out within a shot: in on a detail, back to the whole, in on another.
  const inside = new Map<string, number>();
  const seed = o.seed || 0;
  for (const b of beats) {
    if (b.kind !== 'punch') continue;
    const shot = shotAt(b.at);
    const id = shot ? shot.id : '';
    const k = inside.get(id) || 0;
    inside.set(id, k + 1);
    if (k % 2 === 1) continue; // back out, from where it went in
    const graphic = Boolean(shot && shot.graphic);
    const focus = shot && shot.focus ? shot.focus : { x: 0.5, y: 0.5 };
    const r1 = hash(seed * 31 + b.at);
    const r2 = hash(seed * 17 + b.at * 3 + 1);
    b.zoom = graphic ? 1.06 : (k === 0 ? 1.18 : 1.13);
    // The first punch heads for the shot's subject; later ones look around it.
    b.fx = graphic ? 0.5 : Math.max(0.2, Math.min(0.8, k === 0 ? focus.x : focus.x + (r1 - 0.5) * 0.5));
    b.fy = graphic ? 0.42 : Math.max(0.2, Math.min(0.75, k === 0 ? focus.y : focus.y + (r2 - 0.5) * 0.35));
  }
  // A back-out keeps the point it went in on, so it pulls straight back.
  let last: TimedBeat | null = null;
  for (const b of beats) {
    if (b.kind !== 'punch') continue;
    if (b.zoom === 1 && last && shotAt(last.at) === shotAt(b.at)) { b.fx = last.fx; b.fy = last.fy; }
    last = b;
  }

  // A pop stays about a second and a half, and is gone before the next thing arrives.
  const allEvents = [...events, ...beats.map((b) => b.at)].sort((a, b) => a - b);
  for (const b of beats) {
    if (b.kind !== 'pop') continue;
    const next = allEvents.find((e) => e > b.at) ?? frames;
    b.until = Math.max(b.at + Math.round(fps * 0.8), Math.min(b.at + Math.round(fps * 1.6), next - 3, frames));
  }
  return beats;
}

/** The punch on screen `frame` frames into a scene: scale and the point it zooms towards. */
export function punchAt(beats: TimedBeat[], frame: number, shotFrom: number, shotEnd: number, fps: number): { zoom: number; fx: number; fy: number } {
  const mine = beats.filter((b) => b.kind === 'punch' && b.at >= shotFrom && b.at < shotEnd && b.at <= frame);
  if (!mine.length) return { zoom: 1, fx: 0.5, fy: 0.5 };
  const cur = mine[mine.length - 1];
  const prev = mine.length > 1 ? mine[mine.length - 2].zoom : 1;
  const snap = Math.round(fps * 0.16);
  const t = Math.max(0, Math.min(1, (frame - cur.at) / Math.max(1, snap)));
  const e = 1 - Math.pow(1 - t, 3);
  return { zoom: prev + (cur.zoom - prev) * e, fx: cur.fx, fy: cur.fy };
}

/**
 * How long the picture holds without anything new, across the video, in seconds -
 * with the beats, and without them (what the cuts and callouts alone give).
 */
export function holdStats(scenes: { leadIn: number; durationInFrames: number; shots: { from: number }[]; callouts: { at: number }[]; beats: TimedBeat[] }[], fps: number) {
  let longest = 0;
  let bare = 0;
  let beats = 0;
  for (const sc of scenes) {
    const base = [0, sc.leadIn, ...sc.shots.map((s) => s.from), ...sc.callouts.map((c) => c.at)];
    const gap = (list: number[]) => {
      const ev = [...list, sc.durationInFrames].sort((a, b) => a - b);
      let g = 0;
      for (let i = 1; i < ev.length; i++) g = Math.max(g, ev[i] - ev[i - 1]);
      return g;
    };
    bare = Math.max(bare, gap(base));
    longest = Math.max(longest, gap([...base, ...sc.beats.map((b) => b.at)]));
    beats += sc.beats.length;
  }
  return { longest: longest / fps, withoutBeats: bare / fps, beats };
}
