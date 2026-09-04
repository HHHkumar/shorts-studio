import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { alignCues } from '../lib/options-timing';
import type { Theme } from '../lib/theme';
import { useSceneSeconds } from './ui';
import { hexToRgba } from '../lib/theme';
import type { MotionActor, MotionBeat, WordTiming } from '../lib/types';
import type { PanelProps } from './Panel';

// ---------------------------------------------------------------------------
// Motion: things that move.
//
// Every other explainer panel shows a structure and lights parts of it up. This
// one shows something HAPPENING - a fish swimming at a dam, being turned back,
// and then finding a way over once a ladder appears. That is a different job,
// and it needs actors and verbs rather than boxes and arrows.
//
// Three rules hold this together.
//
// The vocabulary is closed. A storyboard picks from seven verbs and cannot
// invent an eighth, exactly like it picks from the sketch catalogue. Free-form
// motion from a language model produces confident nonsense, and nonsense that
// moves is worse than nonsense that sits still.
//
// Timing comes from the voice. A beat carries a cue - a word from this scene's
// narration - not a timestamp. The fish is turned back at the moment the
// narrator says "blocked". Nothing is timed by guesswork, which is the same
// trick the reveals already use.
//
// The frame is pure. An actor's position at frame N is computed by folding
// every beat up to N, from the actor's declared start. No state, no refs, no
// accumulation between frames. Remotion renders frames out of order and in
// parallel, so anything else eventually renders a different video than it
// previewed.
// ---------------------------------------------------------------------------

/** How long each verb takes to play, in seconds, before anything is clamped. */
const DURATION: Record<string, number> = {
  appear: 0.55,
  move: 1.15,
  blocked: 1.9,
  climb: 1.7,
  pulse: 0.7,
  spin: 1.1,
  exit: 0.8,
};

interface ActorState {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotate: number;
  /** -1 when travelling left, so the artwork faces where it is going. */
  facing: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Ease in and out, so nothing starts or stops with a jerk. */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The bounce curve for `blocked`: run at it, get thrown back, try again, get
 * thrown back harder, and end short of it. Reads as "this way is shut" in about
 * two seconds, which is all the time a scene gives it.
 */
function blockedCurve(t: number): number {
  if (t < 0.25) return ease(t / 0.25);            // charge in
  if (t < 0.4) return 1 - 0.45 * ease((t - 0.25) / 0.15);  // knocked back
  if (t < 0.62) return 0.55 + 0.45 * ease((t - 0.4) / 0.22); // try again
  if (t < 0.8) return 1 - 0.6 * ease((t - 0.62) / 0.18);   // knocked back further
  return 0.4;                                      // give up, sit off it
}

/** The stepped path for `climb`: up, across, up, across - a fish ladder. */
function climbCurve(t: number, steps: number): { along: number; lift: number } {
  const stage = Math.min(steps - 1, Math.floor(t * steps));
  const within = clamp01(t * steps - stage);
  // Rise on the first half of each step, move across on the second.
  const lift = (stage + (within < 0.5 ? ease(within * 2) : 1)) / steps;
  const along = (stage + (within < 0.5 ? 0 : ease((within - 0.5) * 2))) / steps;
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
function stateAt(
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

    const t = clamp01((time - start) / (DURATION[beat.action] || 1));
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
function depthOf(id: string, beats: MotionBeat[], starts: number[], time: number): number {
  let depth = 0;
  beats.forEach((beat, i) => {
    if (beat.actor !== id) return;
    const start = starts[i];
    if (Number.isFinite(start) && time >= start) depth = i + 1;
  });
  return depth;
}

/** One actor, drawn. The icon body uses currentColor, so `color` tints it. */
const Figure: React.FC<{
  actor: MotionActor;
  state: ActorState;
  theme: Theme;
  size: number;
  depth: number;
}> = ({ actor, state, theme, size, depth }) => {
  const colour = actor.accent ? theme.accent : theme.text;
  const art = actor.art;

  return (
    <div
      style={{
        position: 'absolute',
        left: state.x * 100 + '%',
        top: state.y * 100 + '%',
        // Whatever moved most recently is drawn on top. Without this the
        // painting order is declaration order, so a fish swimming past a dam
        // disappears behind it at the moment you most want to watch it.
        zIndex: depth,
        opacity: clamp01(state.opacity),
        // Rotation and facing live on the artwork below, NOT here. A spin
        // applied to the whole figure turns the caption upside down with it.
        transform: 'translate(-50%, -50%) scale(' + state.scale * (actor.scale || 1) + ')',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: size * 0.08,
      }}
    >
      <div
        style={{
          transform: 'rotate(' + state.rotate + 'deg) scaleX(' + state.facing + ')',
          display: 'flex',
        }}
      >
        {art ? (
          <svg
            width={size}
            height={size}
            viewBox={'0 0 ' + art.width + ' ' + art.height}
            style={{
              color: colour,
              display: 'block',
              filter: 'drop-shadow(0 6px 18px ' + hexToRgba(theme.bg, 0.7) + ')',
            }}
            dangerouslySetInnerHTML={{ __html: art.body }}
          />
        ) : (
          // No icon was found for this noun. A labelled disc is worse than a
          // picture, but it keeps the beat readable instead of leaving a hole.
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              border: '4px solid ' + colour,
              background: hexToRgba(colour, 0.12),
            }}
          />
        )}
      </div>

      {actor.label ? (
        <div
          style={{
            fontFamily: theme.fontBody,
            fontWeight: 700,
            fontSize: size * 0.2,
            color: actor.accent ? theme.accent : theme.textDim,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            // Figures cross over each other, and two captions meeting on a
            // busy backdrop is the one place this layout turns to mush.
            textShadow: '0 2px 10px ' + hexToRgba(theme.bg, 0.95),
          }}
        >
          {actor.label}
        </div>
      ) : null}
    </div>
  );
};

export const MotionPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const seconds = useSceneSeconds();
  const time = frame / fps - offset;

  const actors = (panel.actors || []).filter((a) => a && a.id);
  const beats = panel.beats || [];

  // Beats fire on the words that describe them. Matched one at a time, so a
  // single cue the narrator paraphrased does not drag the other three off the
  // voice with it.
  const cues = beats.map((b) => b.cue || '');
  const starts = alignCues(words, cues, seconds);

  // A target resolves to where it was DECLARED, not to where it has animated
  // to. Targets are scenery - the dam, the ladder - and resolving an animated
  // one would mean evaluating another actor's whole beat list from inside this
  // one, which two actors moving toward each other turns into a cycle.
  const positionOf = (id: string): { x: number; y: number; scale: number } | null => {
    const target = actors.find((a) => a.id === id);
    if (!target) return null;
    return { x: target.x, y: target.y, scale: target.scale || 1 };
  };

  const size = Math.min(width, height) * 0.16;
  // A figure's footprint as a fraction of the frame, which differs per axis.
  const unit = { x: size / width, y: size / height };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: height * 0.5 }}>
      {panel.title ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            width: '100%',
            textAlign: 'center',
            fontFamily: theme.fontDisplay,
            fontWeight: theme.displayWeight,
            fontSize: Math.min(width, height) * 0.055,
            letterSpacing: theme.displayTracking,
            textTransform: theme.displayTransform,
            color: theme.text,
          }}
        >
          {panel.title}
        </div>
      ) : null}

      {actors.map((actor) => (
        <Figure
          key={actor.id}
          actor={actor}
          state={stateAt(actor, beats, starts, time, positionOf, unit)}
          theme={theme}
          size={size}
          depth={depthOf(actor.id, beats, starts, time)}
        />
      ))}
    </div>
  );
};
