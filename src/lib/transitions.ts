// ---------------------------------------------------------------------------
// How one scene becomes the next.
//
// There used to be exactly one join - a crossfade with a small slide - and it
// is still the right default. But a forty-second short and a five-minute
// explainer do not want the same cut, and neither does a reveal want the same
// cut as an aside. So the join is now a choice.
//
// Everything here is a PURE FUNCTION of two numbers, which is the whole point:
//
//   arriving  0 -> 1 across the first SCENE_OVERLAP frames of a scene
//   leaving   1 -> 0 across the last SCENE_OVERLAP frames
//
// Both scenes are on screen together during an overlap - the outgoing Sequence
// is held open past its narration precisely so they can meet - so a transition
// is just the pair of styles that makes that hand-off read as deliberate. No
// component state, no frame counters, no Remotion imports. That means every one
// of these can be checked at a hundred points without rendering anything, which
// is how we know a transition never blanks the screen or leaves it half faded.
// ---------------------------------------------------------------------------

/** The subset of CSS a transition is allowed to touch. */
export interface TransitionStyle {
  opacity: number;
  transform: string;
  filter?: string;
  clipPath?: string;
}

export interface TransitionInput {
  /** 0 at the first frame of the scene, 1 once it has fully arrived. */
  arriving: number;
  /** 1 until the scene starts to go, 0 once it has fully left. */
  leaving: number;
  /** Scene index. Alternates direction so a video does not drift one way. */
  index: number;
  /** theme.bounce, 0-1. Springy layouts get more overshoot. */
  bounce: number;
}

export type TransitionName =
  | 'auto'
  | 'crossfade'
  | 'slide'
  | 'push'
  | 'wipe'
  | 'zoom'
  | 'blur'
  | 'dip'
  | 'whip'
  | 'glitch';

export const TRANSITIONS: { id: TransitionName; label: string; blurb: string }[] = [
  { id: 'auto', label: 'Auto — varies with the scene', blurb: 'Punchy on the reveal, quiet on the explanations. A good default.' },
  { id: 'crossfade', label: 'Crossfade — dissolve and drift', blurb: 'The classic. Never wrong, never noticed.' },
  { id: 'slide', label: 'Slide — the new scene moves in over', blurb: 'Clean and modern. Reads well on a phone.' },
  { id: 'push', label: 'Push — the old scene is shoved out', blurb: 'More physical than a slide. Good for step-by-step.' },
  { id: 'wipe', label: 'Wipe — a hard edge sweeps across', blurb: 'Graphic and confident. Suits bold layouts.' },
  { id: 'zoom', label: 'Zoom — punch in through the cut', blurb: 'Energetic. Best on short, fast videos.' },
  { id: 'blur', label: 'Blur — defocus and refocus', blurb: 'Soft and expensive-looking. Slows the pace down.' },
  { id: 'dip', label: 'Dip — through the background colour', blurb: 'A real beat between scenes. Use when ideas are separate.' },
  { id: 'whip', label: 'Whip pan — fast smear sideways', blurb: 'High energy. Do not use it for twenty scenes.' },
  { id: 'glitch', label: 'Glitch — digital break-up', blurb: 'Loud. One or two per video, not every cut.' },
];

const NAMES = new Set(TRANSITIONS.map((t) => t.id));

/** Clamp, because interpolate() callers can hand us anything. */
const c01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);

/**
 * A deterministic stand-in for randomness.
 *
 * Glitch wants to look erratic, but a render must produce the same frame every
 * time it is asked for - Remotion may render frame 300 before frame 12, and on
 * a different machine. So the jitter comes from a cheap hash of the inputs
 * rather than from Math.random().
 */
function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Which transition `auto` uses for a given scene.
 *
 * The reveal is the moment the whole video exists for, so it gets the punch.
 * Explanations are a sequence of related thoughts and want the quietest join
 * there is. Everything else alternates gently so a long video keeps some
 * variety without ever calling attention to the edit.
 */
export function autoTransitionFor(kind: string, index: number): TransitionName {
  if (kind === 'answer') return 'zoom';
  if (kind === 'question') return 'wipe';
  if (kind === 'hook' || kind === 'title') return 'slide';
  if (kind === 'outro' || kind === 'recap') return 'dip';
  if (kind === 'explain') return 'crossfade';
  return index % 2 === 0 ? 'crossfade' : 'slide';
}

/**
 * The style for one scene at one moment in its life.
 *
 * Returns the transform/opacity to put on the scene's own wrapper. A scene is
 * usually mid-arrival OR mid-departure, never both, but the maths holds when
 * a scene is so short that its two overlaps meet.
 */
export function transitionStyle(name: TransitionName, input: TransitionInput): TransitionStyle {
  const arriving = c01(input.arriving);
  const leaving = c01(input.leaving);
  const dir = input.index % 2 === 0 ? 1 : -1;
  const bounce = c01(input.bounce);

  // How far through the whole join we are, in and out combined. Most
  // transitions are symmetric, and this is what makes writing them symmetric.
  const fade = Math.min(arriving, leaving);

  switch (pick(name)) {
    case 'slide': {
      // The incoming scene travels over the top of the outgoing one, which
      // stays put. Opacity stays at 1 so the edge stays crisp - fading a slide
      // is what makes it look like an accident rather than a choice.
      const inShift = (1 - arriving) * 100 * dir;
      return { opacity: leaving < 1 ? leaving : 1, transform: translate(inShift) };
    }

    case 'push': {
      // Both move: the old one is genuinely displaced by the new one.
      const shift = (1 - arriving) * 100 * dir - (1 - leaving) * 100 * dir;
      return { opacity: 1, transform: translate(shift) };
    }

    case 'wipe': {
      // A hard edge crossing the frame. The arriving scene is revealed by its
      // clip; the leaving one simply waits underneath, uncut, so there is never
      // a gap through to the background.
      const cut = (1 - arriving) * 100;
      const from = dir === 1 ? 'inset(0 0 0 ' + cut + '%)' : 'inset(0 ' + cut + '% 0 0)';
      return {
        opacity: 1,
        transform: 'translateX(0px)',
        clipPath: arriving < 1 ? from : undefined,
      };
    }

    case 'zoom': {
      // Punch in on arrival, ease back on the way out. Bouncy layouts start
      // from further out, which is what makes the same transition feel
      // different under a playful theme than under a technical one.
      const start = 1.18 + bounce * 0.14;
      const scale = arriving < 1
        ? start - (start - 1) * arriving
        : 1 - (1 - leaving) * 0.12;
      return { opacity: fade, transform: 'scale(' + round(scale) + ')' };
    }

    case 'blur': {
      const amount = ((1 - arriving) + (1 - leaving)) * 22;
      return {
        opacity: fade,
        transform: 'scale(' + round(1 + (1 - arriving) * 0.04) + ')',
        filter: amount > 0.2 ? 'blur(' + round(amount) + 'px)' : undefined,
      };
    }

    case 'dip': {
      // Both scenes are briefly gone, which is what makes this a beat rather
      // than a blend. Squaring the fade drops it away fast and brings it back
      // fast, leaving a real hole in the middle instead of a long grey mush.
      const held = fade * fade;
      return { opacity: held, transform: 'scale(' + round(0.985 + held * 0.015) + ')' };
    }

    case 'whip': {
      // A smear. The distance is deliberately far more than a slide, and the
      // blur is horizontal-only so it reads as camera movement rather than
      // defocus.
      const away = (1 - arriving) + (1 - leaving);
      const shift = ((1 - arriving) - (1 - leaving)) * 120 * dir;
      return {
        opacity: Math.min(1, fade * 1.6),
        transform: translate(shift),
        filter: away > 0.02 ? 'blur(' + round(away * 14) + 'px)' : undefined,
      };
    }

    case 'glitch': {
      const away = Math.max(1 - arriving, 1 - leaving);
      if (away < 0.02) return { opacity: 1, transform: 'translateX(0px)' };
      // Three steps rather than a smooth ramp: a glitch that eases is not a
      // glitch. The step index seeds the jitter, so the same frame always
      // breaks up the same way.
      const step = Math.floor(away * 3);
      const kick = (jitter(step + input.index * 7) - 0.5) * away * 90;
      const lift = (jitter(step * 3.7 + input.index) - 0.5) * away * 26;
      return {
        opacity: Math.min(1, fade * 1.8),
        transform: 'translate(' + round(kick) + 'px, ' + round(lift) + 'px)',
        // A colour fringe, which is what actually sells it as digital.
        filter: 'drop-shadow(' + round(kick * 0.16) + 'px 0 0 rgba(255,0,64,0.55))'
          + ' drop-shadow(' + round(-kick * 0.16) + 'px 0 0 rgba(0,255,238,0.55))',
      };
    }

    case 'crossfade':
    default: {
      // The original, unchanged: a dissolve with just enough drift that it does
      // not read as a lazy dip.
      const shift = (1 - arriving) * 46 * dir - (1 - leaving) * 46 * dir;
      const scale = bounce > 0.5 ? 1.05 - 0.05 * arriving : 1 + (1 - leaving) * 0.03;
      return { opacity: fade, transform: translate(shift, 'px') + ' scale(' + round(scale) + ')' };
    }
  }
}

function pick(name: TransitionName): TransitionName {
  return NAMES.has(name) && name !== 'auto' ? name : 'crossfade';
}

const translate = (n: number, unit: '%' | 'px' = '%') => 'translateX(' + round(n) + unit + ')';

/** Three decimals is plenty for a transform, and keeps the DOM string short. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Is this a name we know? Used to fall back rather than render nothing. */
export function isTransition(name: string): name is TransitionName {
  return NAMES.has(name as TransitionName);
}
