// ---------------------------------------------------------------------------
// What the picture check found, and what is done about it.
//
// The check itself runs on the helper (server/picture-review.mjs): a reviewer
// reads each picture against the line it sits on and gives one verdict. This
// is the browser's half - taking the flagged pictures out of the script, and
// putting one back when the person, who outranks the reviewer, says it was
// right all along.
//
// Pure: script in, script out. The server imports nothing from here.
// ---------------------------------------------------------------------------

import type { SceneVisual, ScriptLine } from './types.ts';

export type PictureVerdict = 'right' | 'wrong' | 'unrelated' | 'unsure';

export interface PictureReview {
  /** Where the picture was in the script when it was checked. */
  scene: number;
  /** The picture and its line, as a key - see server/picture-words.mjs. */
  key: string;
  verdict: PictureVerdict;
  reason: string;
  /** Each reviewer's own verdict, when more than one looked. */
  said?: { by: string; verdict: PictureVerdict; reason: string }[];
  /** The picture in words, and the line it sat on. */
  words: string;
  narration: string;
  /** The frame the reviewer saw, under /out. Empty when it went on words alone. */
  frame?: string;
  /** The picture that was taken out, kept so it can be put back. */
  removed?: SceneVisual;
  /** The person said the reviewer was wrong: do not take it out again. */
  kept?: boolean;
}

export interface PictureReviewRecord {
  checkedAt: string;
  /** Who looked: "Gemini", "DeepSeek". */
  by: string[];
  /** True when a reviewer saw the rendered frames, not only the words. */
  sawFrames: boolean;
  reviews: PictureReview[];
  /** A reviewer that could not be reached. */
  problems?: string[];
}

/** A picture with one of these verdicts is taken out of the video. */
export const isFlagged = (verdict: PictureVerdict): boolean => verdict === 'wrong' || verdict === 'unrelated';

/**
 * The kinds of picture that state something and are not checked elsewhere.
 * A "figure" is computed and checked against the answer; a formula is read by
 * the fact-check; an icon is an emoji and a label.
 */
export const REVIEWED_KINDS = ['sketch', 'bars', 'compare'];

/**
 * A short key for a picture and the line it sits on. It stays the same for as
 * long as both do, which is how a verdict - or a mark on the test bench -
 * finds its picture again, and how a picture nobody has looked at is noticed.
 */
export function pictureKey(narration: unknown, visual: unknown): string {
  const text = String(narration || '') + '\u0001' + JSON.stringify(visual || {});
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** The keys of the pictures in a script that nobody has checked yet. */
export function uncheckedPictures(script: ScriptLine[], reviews: PictureReview[] = []): string[] {
  const seen = new Set(reviews.map((r) => r.key));
  return script
    .filter((line) => line && line.visual && REVIEWED_KINDS.includes(line.visual.kind))
    .map((line) => pictureKey(line.narration, line.visual))
    .filter((key) => !seen.has(key));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Take the flagged pictures out.
 *
 * `sent` is the script the review was run on. A scene edited since - its line
 * reworded, its picture changed - is left alone: the verdict was about
 * something that is no longer there.
 */
export function applyPictureReview(
  script: ScriptLine[],
  sent: ScriptLine[],
  reviews: PictureReview[],
): { script: ScriptLine[]; reviews: PictureReview[] } {
  const next = script.slice();
  const out = reviews.map((r) => {
    if (!isFlagged(r.verdict) || r.kept) return r;
    const now = next[r.scene];
    const was = sent[r.scene];
    if (!now || !was || !now.visual || now.narration !== was.narration || !same(now.visual, was.visual)) return r;
    const removed = now.visual;
    next[r.scene] = {
      ...now,
      visual: { kind: 'none' },
      pictureNote: 'Taken out by the picture check: ' + (r.reason || 'it did not show what this line says.'),
    };
    return { ...r, removed };
  });
  return { script: next, reviews: out };
}

/** Put a picture back where the check took it from, if that scene is still as it was. */
export function restorePicture(
  script: ScriptLine[],
  reviews: PictureReview[],
  key: string,
): { script: ScriptLine[]; reviews: PictureReview[] } {
  const review = reviews.find((r) => r.key === key);
  if (!review || !review.removed) return { script, reviews };
  const now = script[review.scene];
  if (!now || now.narration !== review.narration || (now.visual && now.visual.kind !== 'none')) return { script, reviews };
  const next = script.slice();
  const { pictureNote: _gone, ...rest } = now;
  next[review.scene] = { ...rest, visual: review.removed };
  return {
    script: next,
    reviews: reviews.map((r) => (r.key === key ? { ...r, removed: undefined, kept: true } : r)),
  };
}

/** How many of each verdict: the line under the heading. */
export function tally(reviews: PictureReview[]): Record<PictureVerdict, number> {
  const t: Record<PictureVerdict, number> = { right: 0, wrong: 0, unrelated: 0, unsure: 0 };
  for (const r of reviews) t[r.verdict] += 1;
  return t;
}
