import { interpolate } from 'remotion';
import type { MotionActor, MotionBeat } from './types';

// ---------------------------------------------------------------------------
// Where an actor is, and how big, and which way up - at one instant.
//
// Pure arithmetic, deliberately outside the renderer. It is the part that can
// be wrong in ways a screenshot will not show: a jump between two frames looks
// fine in every still and terrible at speed. Having it here means it can be
// stepped frame by frame in a test and measured.
// ---------------------------------------------------------------------------

export const DURATION: Record<string, number> = {
  appear: 0.55,
  move: 1.15,
  blocked: 1.9,
  climb: 1.7,
  pulse: 0.7,
  spin: 1.1,
  exit: 0.8,
};


/**
 * How fast a thing should cross the frame, in figure-widths per second.
 *
 * A fixed duration per verb was the real cause of things darting: the same
 * 1.15 seconds carried an actor a tenth of the frame or three quarters of it,
 * so a long journey looked flung and a short one looked like a stall. Speed is
 * the thing that should be constant, not time.
 *
 * Two and a half of its own widths a second is a brisk walk - fast enough to
 * be over before the narration moves on, slow enough for the eye to follow.
 */
const SPEED = 2.5;

/** Never shorter than this, or it reads as a jump cut rather than a move. */
const MIN_TRAVEL = 0.55;
/** Never longer, or a big journey outstays the sentence that described it. */
const MAX_TRAVEL = 2.4;

/**
 * How long this beat should take.
 *
 * Travel verbs are paced by distance; the rest are gestures with no distance
 * to speak of, so they keep their fixed length.
 *
 * Deliberately NOT shortened to fit before the next beat. Squeezing a full
 * journey into a fifth of a second is the darting this was meant to cure - an
 * interrupted beat is frozen where it got to instead, and the next one carries
 * on from there.
 */
export function beatDuration(beat: MotionBeat, spans: number): number {
  // Some verbs cover more ground than the straight line between start and
  // finish, and pacing them by that line makes them the fastest thing on
  // screen. `blocked` goes in and back twice; `climb` zig-zags up in steps,
  // adding the whole rise on top of the traverse.
  const stretch = beat.action === 'blocked' ? 2.5 : beat.action === 'climb' ? 1.7 : 1;
  const travels = beat.action === 'move' || beat.action === 'exit'
    || beat.action === 'climb' || beat.action === 'blocked';
  if (!travels) return DURATION[beat.action] || 1;

  const floor = beat.action === 'blocked' ? 1.1 : beat.action === 'climb' ? 0.9 : MIN_TRAVEL;
  return Math.min(MAX_TRAVEL * stretch, Math.max(floor, (spans * stretch) / SPEED));
}

/** Seconds until this actor's next beat, or Infinity when it has none. */
export function gapToNextBeat(
  beats: MotionBeat[],
  starts: number[],
  index: number,
): number {
  const actor = beats[index].actor;
  for (let j = index + 1; j < beats.length; j++) {
    if (beats[j].actor !== actor) continue;
    const next = starts[j];
    if (Number.isFinite(next) && Number.isFinite(starts[index])) return next - starts[index];
    return Infinity;
  }
  return Infinity;
}


/**
 * The part of the frame an actor may occupy, and the squash into it.
 *
 * The storyboard writes 0 to 1 and means "anywhere", but the frame is not all
 * available: the scene title sits across the top and the captions across the
 * bottom. An actor over either is worse than useless - it makes a word
 * unreadable, which costs more than the picture gave.
 *
 * Here rather than in the renderer so a test can measure the position that is
 * actually drawn. Measuring the unsquashed one reports movement the viewer
 * never sees.
 */
export function safeBand(landscape: boolean, hasTitle: boolean) {
  const top = hasTitle ? (landscape ? 0.22 : 0.20) : (landscape ? 0.16 : 0.14);
  // Leaves room for the caption band and for an actor's own label beneath it.
  const bottom = landscape ? 0.70 : 0.60;
  return { left: 0.10, span: 0.80, top, height: bottom - top };
}

/** Squash a storyboard position into the band. */
export function toSafe(x: number, y: number, band: ReturnType<typeof safeBand>) {
  return {
    x: band.left + clamp01(x) * band.span,
    y: band.top + clamp01(y) * band.height,
  };
}

export interface ActorState {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotate: number;
  /** -1 when travelling left, so the artwork faces where it is going. */
  facing: number;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Ease in and out, so nothing starts or stops with a jerk. */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The bounce curve for `blocked`: run at it, get thrown back, try again, get
 * thrown back harder, and end short of it. Reads as "this way is shut" in about
 * two seconds, which is all the time a scene gives it.
 */
function blockedCurve(t: number): number {
  // Every phase is eased at both ends and none is shorter than a fifth of the
  // beat. The first version recoiled 45% of the distance in 15% of the time,
  // which is a snap rather than a bounce - and at speed reads as the animation
  // glitching, not as the thing being turned back.
  if (t < 0.30) return ease(t / 0.30);                        // charge in
  if (t < 0.50) return 1 - 0.40 * ease((t - 0.30) / 0.20);    // knocked back
  if (t < 0.72) return 0.60 + 0.40 * ease((t - 0.50) / 0.22); // try again
  if (t < 0.94) return 1 - 0.55 * ease((t - 0.72) / 0.22);    // knocked back further
  return 0.45;                                                // give up, sit off it
}

/** The stepped path for `climb`: up, across, up, across - a fish ladder. */
function climbCurve(t: number, steps: number): { along: number; lift: number } {
  const stage = Math.min(steps - 1, Math.floor(t * steps));
  const within = clamp01(t * steps - stage);

  // Rise then traverse, but OVERLAPPING rather than split cleanly in half.
  // Splitting it meant a quarter of the journey was covered in an eighth of the
  // time, which measured as the sharpest movement anywhere in the system - a
  // stair climbed in jerks rather than steps. The two phases now share the
  // middle of each step, so the actor is never doing all of one thing at once.
  const lift = (stage + ease(clamp01(within / 0.65))) / steps;
  const along = (stage + ease(clamp01((within - 0.35) / 0.65))) / steps;
  return { along, lift };
}

/**
 * The small movement a thing makes when nothing is happening to it.
 *
 * Without this an actor between beats is a frozen sticker, and a frozen sticker
 * is what makes a scene look cheap however good the choreography around it is.
 * Real animation never has a truly static element - a fish holds station by
 * swimming, a flame never stops moving, a wheel keeps turning.
 *
 * Chosen from the noun, because the noun is what we have. Everything falls back
 * to a slow breath, which is right for a box or a building and wrong for
 * nothing.
 */
function idleFor(noun: string, time: number, seed: number) {
  const n = String(noun || '').toLowerCase();
  const phase = time * 1.2 + seed * 1.7;

  // Things that hold themselves up in a fluid never stop moving.
  if (/fish|bird|butterfl|bee|plane|kite|balloon|cloud|leaf|boat|swim|fly/.test(n)) {
    return { dx: Math.sin(phase * 0.8) * 0.004, dy: Math.sin(phase) * 0.012, rot: Math.sin(phase * 0.9) * 3, scale: 1 };
  }
  // Fire flickers rather than drifts.
  if (/fire|flame|burn|candle|torch|spark|explos/.test(n)) {
    return { dx: 0, dy: 0, rot: Math.sin(phase * 3.1) * 2.5, scale: 1 + Math.sin(phase * 4.3) * 0.05 };
  }
  // Anything that turns, turns.
  if (/wheel|turbine|fan|gear|rotor|propeller|windmill|motor/.test(n)) {
    return { dx: 0, dy: 0, rot: time * 24, scale: 1 };
  }
  // Water and anything falling has a gentle vertical life.
  if (/water|wave|rain|drop|liquid|river|sea|ocean/.test(n)) {
    return { dx: 0, dy: Math.sin(phase * 1.3) * 0.008, rot: 0, scale: 1 };
  }
  // A slow breath. Below the threshold anyone notices, above the threshold of
  // looking dead.
  return { dx: 0, dy: Math.sin(phase * 0.6) * 0.003, rot: 0, scale: 1 + Math.sin(phase * 0.5) * 0.012 };
}

/**
 * Where every actor is at this moment.
 *
 * One pass per actor over the beats aimed at it. A beat that has not started
 * contributes nothing; one that has finished contributes its end state, which
 * is what makes movement persist after the beat is over.
 */
export function stateAt(
  actor: MotionActor,
  beats: MotionBeat[],
  starts: number[],
  time: number,
  positionOf: (id: string) => { x: number; y: number; scale: number } | null,
  /** One figure's width and height as a fraction of the frame. */
  unit: { x: number; y: number },
): ActorState {
  // Seeded off the id so two actors of the same kind do not breathe in unison.
  const idle = idleFor(actor.icon, time, actor.id.length);
  const state: ActorState = {
    x: actor.x + idle.dx,
    y: actor.y + idle.dy,
    opacity: actor.hidden ? 0 : 1,
    scale: idle.scale,
    rotate: idle.rot,
    facing: 1,
  };

  beats.forEach((beat, i) => {
    if (beat.actor !== actor.id) return;
    const start = starts[i];
    if (!Number.isFinite(start) || time < start) return;

    const target = beat.to ? positionOf(beat.to) : null;
    // An explicit x/y wins over a named target, and the actor's own spot is the
    // last resort so a malformed beat moves nothing rather than jumping to 0,0.
    const dest = {
      x: typeof beat.x === 'number' ? beat.x : target ? target.x : state.x,
      y: typeof beat.y === 'number' ? beat.y : target ? target.y : state.y,
    };

    // Stop BESIDE the target, not on top of it. Travelling to an actor's centre
    // parks two shapes in the same place, which reads as one broken shape and
    // collides their captions. How far to stop short depends on how big both
    // are, so it is measured in figure-widths rather than in frame fractions -
    // the frame is not square, and a fixed 0.1 would be two different gaps
    // horizontally and vertically.
    // Distance decides how long this takes, so the speed stays the same
    // whether it is crossing the frame or nudging sideways.
    const reach = Math.hypot(
      (dest.x - state.x) / unit.x,
      (dest.y - state.y) / unit.y,
    );

    // A beat stops advancing the moment the same actor's next beat begins.
    // Without this, two beats run at once and add their movements together,
    // which is the lurch that looks like the animation glitching. With it, an
    // interrupted move simply ends early wherever it had reached.
    const gap = gapToNextBeat(beats, starts, i);
    const until = Number.isFinite(gap) ? start + gap : Infinity;
    const t = clamp01((Math.min(time, until) - start) / beatDuration(beat, reach));

    // Not `climb`: going OVER something means ending past it, not short of it.
    if (
      (beat.action === 'move' || beat.action === 'blocked')
      && target
      && typeof beat.x !== 'number'
      && typeof beat.y !== 'number'
    ) {
      const vx = dest.x - state.x;
      const vy = dest.y - state.y;
      const spans = Math.hypot(vx / unit.x, vy / unit.y);
      if (spans > 0.001) {
        // Half of each figure, plus a margin. Anything less and the two
        // glyphs touch, which looks like one broken shape rather than two
        // things meeting.
        const half = ((actor.scale || 1) + target.scale) / 2;
        // Never pull back past the mover's own position, or it would reverse.
        const pull = Math.min(spans * 0.85, half * 1.05 + 0.12);
        const k = pull / spans;
        dest.x -= vx * k;
        dest.y -= vy * k;
      }
    }

    switch (beat.action) {
      case 'appear': {
        state.opacity = t;
        // A little overshoot, so it lands rather than fades up.
        state.scale = interpolate(t, [0, 0.7, 1], [0.55, 1.08, 1]);
        break;
      }
      case 'move': {
        const p = ease(t);
        state.facing = dest.x < state.x ? -1 : 1;
        state.x += (dest.x - state.x) * p;
        state.y += (dest.y - state.y) * p;
        state.opacity = Math.max(state.opacity, t > 0 ? 1 : 0);
        break;
      }
      case 'blocked': {
        // Stop short of the obstacle rather than on top of it.
        const gapX = dest.x - state.x;
        const gapY = dest.y - state.y;
        const p = blockedCurve(t);
        state.facing = gapX < 0 ? -1 : 1;
        state.x += gapX * p;
        state.y += gapY * p;
        // A shove backwards tips it, which sells the impact more than the
        // position change does on its own.
        state.rotate = Math.sin(t * Math.PI * 4) * 12 * (1 - t * 0.4);
        break;
      }
      case 'climb': {
        const { along, lift } = climbCurve(t, 4);
        const gapX = dest.x - state.x;
        const gapY = dest.y - state.y;
        state.facing = gapX < 0 ? -1 : 1;
        state.x += gapX * along;
        // Climbing means going UP, which is negative y, on top of any
        // vertical gap to the target.
        state.y += gapY * along - lift * unit.y * 0.55;
        state.rotate = -18 * lift;
        break;
      }
      case 'pulse': {
        state.scale *= interpolate(t, [0, 0.35, 1], [1, 1.3, 1]);
        break;
      }
      case 'spin': {
        state.rotate += 360 * ease(t);
        break;
      }
      case 'exit': {
        state.opacity = 1 - t;
        const p = ease(t);
        state.x += (dest.x - state.x) * p;
        state.y += (dest.y - state.y) * p;
        break;
      }
      default:
        break;
    }
  });

  return state;
}

/**
 * How far forward to draw an actor: the index of the last beat that has reached
 * it. Scenery nothing has happened to stays at the back.
 */
export function depthOf(id: string, beats: MotionBeat[], starts: number[], time: number): number {
  let depth = 0;
  beats.forEach((beat, i) => {
    if (beat.actor !== id) return;
    const start = starts[i];
    if (Number.isFinite(start) && time >= start) depth = i + 1;
  });
  return depth;
}
