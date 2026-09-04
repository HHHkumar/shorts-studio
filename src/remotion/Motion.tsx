import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { alignCues } from '../lib/options-timing';
import type { Theme } from '../lib/theme';
import { useSceneSeconds } from './ui';
import { hexToRgba } from '../lib/theme';
import type { MotionActor, MotionBeat, WordTiming } from '../lib/types';
import {
  type ActorState, clamp01, depthOf, safeBand, stateAt, toSafe,
} from '../lib/motion-physics';
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

  // One definition of the band, shared with the tests that measure it.
  const band = safeBand(width > height, !!panel.title);

  // A figure's footprint expressed in the SAME space the positions are computed
  // in, not in frame fractions. Everything above happens in 0-1 storyboard
  // coordinates and is squashed into the band only at the end, so a figure that
  // covers a tenth of the screen covers more than a tenth of that space. Get
  // this wrong and the "stop beside it, not on it" gap shrinks by the squash
  // factor and the shapes overlap again.
  const unit = {
    x: (size / width) / band.span,
    y: (size / height) / band.height,
  };

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
          state={(() => {
            const raw = stateAt(actor, beats, starts, time, positionOf, unit);
            return { ...raw, ...toSafe(raw.x, raw.y, band) };
          })()}
          theme={theme}
          size={size}
          depth={depthOf(actor.id, beats, starts, time)}
        />
      ))}
    </div>
  );
};
