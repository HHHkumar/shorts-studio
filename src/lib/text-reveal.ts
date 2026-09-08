// ---------------------------------------------------------------------------
// How the spoken words arrive on screen.
//
// The read-along model is fixed and not negotiable: exactly one line is on
// screen, it is exactly what is being said, and the word being spoken is lit.
// What IS negotiable is the manner of the arrival - whether an unspoken word
// waits faintly, blurred, or not at all, and what the current word does as it
// is reached.
//
// That choice matters more than it sounds. Letting the viewer read a word
// slightly before hearing it feels calm and is easier to follow; withholding it
// until the syllable lands feels urgent and holds attention harder. Neither is
// correct - a maths explainer and a hook want opposite things.
//
// Pure functions of a word's state, for the same reason the transitions are:
// no React, no frames, so the whole matrix can be checked without rendering.
// ---------------------------------------------------------------------------

export type RevealName =
  | 'fade'
  | 'pop'
  | 'rise'
  | 'type'
  | 'blur'
  | 'marker'
  | 'bounce';

export const TEXT_REVEALS: { id: RevealName; label: string; blurb: string }[] = [
  { id: 'fade', label: 'Fade — the phrase appears, words light up', blurb: 'The original. Calm, and the easiest to read.' },
  { id: 'pop', label: 'Pop — each word snaps in as it is said', blurb: 'Punchy. Suits hooks and fast shorts.' },
  { id: 'rise', label: 'Rise — words lift into place', blurb: 'Smooth and modern. Good all-rounder.' },
  { id: 'type', label: 'Typewriter — nothing before it is spoken', blurb: 'Urgent. Nothing to read ahead to.' },
  { id: 'blur', label: 'Focus — words sharpen as they are reached', blurb: 'Soft. Reads as expensive on a big screen.' },
  { id: 'marker', label: 'Highlighter — a bar sweeps under the word', blurb: 'Teacherly. Strong for method and revision videos.' },
  { id: 'bounce', label: 'Bounce — springy overshoot per word', blurb: 'Playful. Best with a bouncy layout.' },
];

const NAMES = new Set(TEXT_REVEALS.map((r) => r.id));

export interface WordState {
  /** Has the voice reached this word yet? */
  spoken: boolean;
  /** Is this the one word currently being said? Exactly one per phrase. */
  current: boolean;
  /** 0 the instant the word starts, 1 once its entrance has finished. */
  enter: number;
}

export interface RevealColors {
  /** Normal spoken text. */
  text: string;
  /** The current word. */
  accent: string;
  /** Not yet spoken - the read-ahead ghost. */
  ghost: string;
}

/** What ReadAlong needs to draw one word. */
export interface WordStyle {
  opacity: number;
  color: string;
  transform: string;
  filter?: string;
  /** Draw the highlighter bar behind this word. */
  marker: boolean;
}

const c01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Grow from `from` to 1, overshooting once on the way.
 *
 * Not Remotion's spring - this has to stay framework-free - but the same shape.
 * The sine term is zero at both ends, so the word lands at exactly 1 and stays
 * there: an entrance that does not settle exactly is a word that jitters for
 * the rest of the phrase.
 */
function springIn(t: number, from: number, over: number): number {
  if (t <= 0) return from;
  if (t >= 1) return 1;
  return from + (1 - from) * t + Math.sin(t * Math.PI) * over;
}

export function wordStyle(reveal: string, state: WordState, colors: RevealColors): WordStyle {
  const name = (NAMES.has(reveal as RevealName) ? reveal : 'fade') as RevealName;
  const enter = c01(state.enter);
  const { spoken, current } = state;

  // Shared by every style: the current word takes the accent, words already
  // said take the normal colour, and what happens to the rest is the choice.
  const colour = current ? colors.accent : spoken ? colors.text : colors.ghost;

  switch (name) {
    case 'pop': {
      // Scales up past its size and back. Only on arrival - a word that keeps
      // pulsing after it is said turns the line into a fairground.
      const s = spoken ? springIn(enter, 0.72, 0.18) : 0.86;
      return {
        opacity: spoken ? 1 : 0.24,
        color: colour,
        transform: 'scale(' + round(current ? s * 1.04 : s) + ')',
        marker: false,
      };
    }

    case 'rise': {
      const lift = spoken ? (1 - enter) * 26 : 14;
      return {
        opacity: spoken ? 1 : 0.26,
        color: colour,
        transform: 'translateY(' + round(lift) + 'px) scale(' + (current ? 1.04 : 1) + ')',
        marker: false,
      };
    }

    case 'type': {
      // Nothing exists before it is spoken. No ghost, no gap held open - the
      // line grows as the voice moves through it.
      return {
        opacity: spoken ? 1 : 0,
        color: colour,
        transform: 'scale(' + (current ? 1.05 : 1) + ')',
        marker: false,
      };
    }

    case 'blur': {
      // Unspoken words are legible in shape but not in detail, which is what
      // makes the focus pull feel like focus rather than a fade.
      const amount = spoken ? (1 - enter) * 6 : 7;
      return {
        opacity: spoken ? 1 : 0.5,
        color: colour,
        transform: 'scale(' + (current ? 1.04 : 1) + ')',
        filter: amount > 0.15 ? 'blur(' + round(amount) + 'px)' : undefined,
        marker: false,
      };
    }

    case 'marker': {
      // The word itself barely moves. The bar behind it does the work, which is
      // why this one reads as teaching rather than as motion graphics.
      return {
        opacity: spoken ? 1 : 0.3,
        // On the highlight, the normal text colour reads better than the accent:
        // accent-on-accent is what makes a real highlighter illegible too.
        color: current ? colors.text : colour,
        transform: 'scale(1)',
        marker: current,
      };
    }

    case 'bounce': {
      const s = spoken ? springIn(enter, 0.6, 0.34) : 0.8;
      const drop = spoken ? (1 - enter) * -18 : 0;
      return {
        opacity: spoken ? 1 : 0.24,
        color: colour,
        transform: 'translateY(' + round(drop) + 'px) scale(' + round(current ? s * 1.05 : s) + ')',
        marker: false,
      };
    }

    case 'fade':
    default:
      // Unchanged from before this file existed: the ghost sits at 0.32 so the
      // viewer can read a shade ahead, and the current word lifts slightly.
      return {
        opacity: spoken ? 1 : 0.32,
        color: colour,
        transform: 'scale(' + (current ? 1.06 : 1) + ')',
        marker: false,
      };
  }
}

export function isReveal(name: string): name is RevealName {
  return NAMES.has(name as RevealName);
}
