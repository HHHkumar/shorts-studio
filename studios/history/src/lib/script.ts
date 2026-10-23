// ---------------------------------------------------------------------------
// Turning a hand-written script into scenes, and words into timings.
//
// A scene is one picture held while one or two sentences are spoken. Too long
// and the picture goes stale on screen; too short and the video strobes.
// The sweet spot for this kind of explainer is roughly 8-15 seconds, which at
// a relaxed narration pace is about 20-40 words.
// ---------------------------------------------------------------------------

import { spokenText } from './speech';
import type { Scene, Shot, Word } from './types';

export const WORDS_PER_MINUTE = 150;
const TARGET_WORDS = 30;
const MAX_WORDS = 48;
const MIN_WORDS = 8;

/** Spoken words only: voice directions like [warm] are not said, so they take no time. */
export const countWords = (text: string): number => { const t = spokenText(text); return t ? t.split(/\s+/).length : 0; };

/** Seconds a line takes to say at a relaxed pace. */
export const estimateSeconds = (text: string): number => Math.max(1.5, (countWords(text) / WORDS_PER_MINUTE) * 60);

/** Sentences, keeping their closing punctuation and any closing quote. */
export function sentences(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  const found = flat.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || [flat];
  return found.map((s) => s.trim()).filter(Boolean);
}

/**
 * Split a pasted script into scene-sized pieces.
 *
 * The writer's own paragraphs are respected first - a blank line is the
 * clearest signal there is of "new picture here". Only a paragraph that is
 * too long to hold one picture is broken further, and only at sentence ends.
 * Crumbs shorter than a breath are joined to their neighbour.
 */
export function splitScript(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, '')
    // Stage directions and headings people paste in from docs: [MUSIC], (pause), ## Part 2, SCENE 4:
    .replace(/^\s*#{1,6}\s.*$/gm, '')
    .replace(/^\s*(scene|part|chapter)\s*\d+\s*[:.-]?\s*$/gim, '')
    // Stage notes like [MUSIC] or [Scene 2] go; voice directions like [warm] or [long pause] stay for ElevenLabs v4.
    .replace(/\[(?![a-z])[^\]]{0,60}\]/g, '')
    .trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const pieces: string[] = [];
  for (const para of paragraphs) {
    if (countWords(para) <= MAX_WORDS) {
      pieces.push(para);
      continue;
    }
    let current = '';
    for (const s of sentences(para)) {
      const joined = current ? current + ' ' + s : s;
      if (current && countWords(joined) > TARGET_WORDS + 6) {
        pieces.push(current);
        current = s;
      } else {
        current = joined;
      }
    }
    if (current) pieces.push(current);
  }

  // Join crumbs onto the previous piece (or the next, for a crumb at the start).
  const merged: string[] = [];
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (last !== undefined && countWords(p) < MIN_WORDS && countWords(last) + countWords(p) <= MAX_WORDS + 10) {
      merged[merged.length - 1] = last + ' ' + p;
    } else if (last !== undefined && countWords(last) < MIN_WORDS) {
      merged[merged.length - 1] = last + ' ' + p;
    } else {
      merged.push(p);
    }
  }
  return merged;
}

let counter = 0;
const newId = (prefix: string): string =>
  prefix + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);
export const newSceneId = (): string => newId('s');

export function newShot(patch: Partial<Shot> = {}): Shot {
  return { id: newId('h'), atWord: 0, imagePrompt: '', image: '', motion: 'auto', focus: null, layer: null, video: '', ...patch };
}

export function blankScene(narration = ''): Scene {
  return {
    id: newSceneId(), narration, shots: [newShot()], audio: null,
    effect: 'none', transition: 'auto', callouts: [], chapter: '',
  };
}

export const newCalloutId = (): string => newId('c');

/** The narration as the list of words that timings and cut points index into. */
export const narrationWords = (text: string): string[] => spokenText(text).split(/\s+/).filter(Boolean);

/** Find a word (case and punctuation ignored) in the narration; -1 if it is not there. */
export function findWord(text: string, word: string, from = 0): number {
  const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const target = narrationWords(word).map(bare);
  const words = narrationWords(text).map(bare);
  if (!target.length || !target[0]) return -1;
  for (let i = Math.max(0, from); i < words.length; i++) {
    if (target.every((t, k) => words[i + k] === t)) return i;
  }
  // Loose: a word that starts with it ("pyramid" finds "pyramids").
  for (let i = Math.max(0, from); i < words.length; i++) if (words[i].startsWith(target[0])) return i;
  return -1;
}

/**
 * Word timings when nobody measured them: spread the words across the speech
 * in proportion to their length, with a little extra time after punctuation
 * where a speaker naturally pauses. Good enough for captions that change a
 * phrase at a time; the karaoke highlight will drift a little.
 */
export function estimateWords(text: string, speechStart: number, speechEnd: number): Word[] {
  const words = narrationWords(text);
  if (!words.length) return [];
  const weight = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 2 + (/[.!?…]["'”’)]*$/.test(w) ? 5 : /[,;:—–-]$/.test(w) ? 2.5 : 0);
  const weights = words.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.1, speechEnd - speechStart);
  const out: Word[] = [];
  let t = speechStart;
  words.forEach((w, i) => {
    const d = (weights[i] / total) * span;
    out.push({ word: w, start: t, end: t + d * 0.85 });
    t += d;
  });
  return out;
}

/**
 * True when the narration was edited after its voice clip was made. A new voice
 * direction changes an ElevenLabs take, but not a recording someone made themselves.
 */
export const isStale = (scene: Scene): boolean => {
  if (!scene.audio) return false;
  if (scene.audio.source === 'mic') return spokenText(scene.audio.text) !== spokenText(scene.narration);
  return scene.audio.text.trim() !== scene.narration.trim();
};
