// Grouping a scene's words into short on-screen phrases. See remotion/Captions.tsx.

import type { Word } from './types';

export interface Phrase {
  words: Word[];
  start: number;
  end: number;
}

const MAX_WORDS = 7;
const MAX_CHARS = 44;

export function phrases(words: Word[]): Phrase[] {
  const out: Phrase[] = [];
  let current: Word[] = [];
  const chars = () => current.reduce((n, w) => n + w.word.length + 1, 0);
  const flush = () => {
    if (!current.length) return;
    out.push({ words: current, start: current[0].start, end: current[current.length - 1].end });
    current = [];
  };
  for (const w of words) {
    if (current.length && (current.length >= MAX_WORDS || chars() + w.word.length > MAX_CHARS)) flush();
    current.push(w);
    const sentenceEnd = /[.!?…]["'”’)]*$/.test(w.word);
    const pause = /[,;:—–]["'”’)]*$/.test(w.word);
    if ((sentenceEnd && current.length >= 2) || (pause && current.length >= 4)) flush();
  }
  flush();
  // Each phrase stays up until the next begins, so the screen never blinks empty mid-scene.
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.max(out[i].end, out[i + 1].start);
  if (out.length) out[out.length - 1].end += 0.5;
  return out;
}
