import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import {
  detectEffects, effectProgress, envelope, type EffectKind, type TimedEffect,
} from '../lib/motion-lexicon';
import type { WordTiming } from '../lib/types';

// ---------------------------------------------------------------------------
// What the narration's verbs look like.
//
// One renderer per effect in the lexicon. All of them obey the same three
// rules, and breaking any one of them makes the video worse, not better:
//
//   Behind the text, always. These run under the caption band and the panel.
//   Nothing here is allowed to make a word harder to read.
//
//   Low contrast, wide area. An effect is felt, not watched. The moment a
//   viewer's eye goes to the particles instead of the diagram, it has failed.
//
//   A pure function of the frame. Positions come from `random(seed)` with a
//   fixed seed, never from state, so frame 300 draws the same thing whether it
//   is reached by playing or by seeking.
// ---------------------------------------------------------------------------

/** No theme colour means "cold", so this one is fixed. */
const COLD = '#5aa9e6';

interface Live {
  /** 0-1 through the effect. */
  t: number;
  /** 0-1 fade envelope, so nothing pops on or off. */
  e: number;
  theme: Theme;
  width: number;
  height: number;
}

/** Particles crossing the frame: steam into a turbine, water down a pipe. */
const Flow: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <>
    {Array.from({ length: 26 }, (_, i) => {
      const lane = random('flow-lane' + i);
      const speed = 0.6 + random('flow-speed' + i) * 0.8;
      // Each particle starts at its own offset, so they do not arrive in a rank.
      const along = (t * speed + random('flow-start' + i)) % 1;
      const size = (3 + random('flow-size' + i) * 6) * (width / 1920);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: along * (width + 120) - 60,
            top: lane * height,
            width: size * 5,
            height: size,
            borderRadius: 999,
            background: hexToRgba(theme.accent, 0.5 * e),
            filter: 'blur(1px)',
          }}
        />
      );
    })}
  </>
);

/** Drift up or down: growth and loss, climbing and sinking. */
const Drift: React.FC<Live & { direction: 1 | -1 }> = ({ t, e, theme, width, height, direction }) => (
  <>
    {Array.from({ length: 22 }, (_, i) => {
      const x = random('drift-x' + i);
      const speed = 0.5 + random('drift-speed' + i) * 0.9;
      const along = (t * speed + random('drift-start' + i)) % 1;
      // direction -1 rises (smaller y), +1 falls.
      const y = direction === -1 ? 1 - along : along;
      const size = (4 + random('drift-size' + i) * 8) * (width / 1920);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x * width,
            top: y * height,
            width: size,
            height: size,
            borderRadius: 999,
            background: hexToRgba(theme.accent, 0.45 * e * (1 - Math.abs(along - 0.5) * 0.8)),
          }}
        />
      );
    })}
  </>
);

/** A slowly turning ring: turbines, wheels, orbits. */
const Spin: React.FC<Live> = ({ t, e, theme, width, height }) => {
  const size = Math.min(width, height) * 0.62;
  return (
    <div
      style={{
        position: 'absolute',
        left: width / 2 - size / 2,
        top: height / 2 - size / 2,
        width: size,
        height: size,
        opacity: 0.3 * e,
        transform: 'rotate(' + t * 220 + 'deg)',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1="50" y1="50"
            x2={50 + 46 * Math.cos((i / 8) * Math.PI * 2)}
            y2={50 + 46 * Math.sin((i / 8) * Math.PI * 2)}
            stroke={theme.accent}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ))}
        <circle cx="50" cy="50" r="46" fill="none" stroke={theme.accent} strokeWidth="1" />
      </svg>
    </div>
  );
};

/** A warm or cold wash over the whole frame. */
const Wash: React.FC<Live & { colour: string }> = ({ e, colour }) => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(ellipse at 50% 60%, ' + hexToRgba(colour, 0.3 * e)
        + ' 0%, transparent 65%)',
    }}
  />
);

/** Rising heat haze, on top of the warm wash. */
const Haze: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <>
    {Array.from({ length: 14 }, (_, i) => {
      const x = random('haze-x' + i);
      const along = (t * (0.5 + random('haze-s' + i) * 0.6) + random('haze-o' + i)) % 1;
      const sway = Math.sin((along + i) * Math.PI * 3) * 26;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x * width + sway,
            top: (1 - along) * height,
            width: 3,
            height: 46,
            borderRadius: 999,
            background: hexToRgba(theme.wrong, 0.3 * e * (1 - along)),
            filter: 'blur(3px)',
          }}
        />
      );
    })}
  </>
);

/** Short electrical flecks. */
const Spark: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <>
    {Array.from({ length: 18 }, (_, i) => {
      // Each fleck only exists for a slice of the effect, so they flicker
      // rather than all sitting there for a second and a half.
      const born = random('spark-b' + i);
      const life = (t - born + 1) % 1;
      if (life > 0.22) return null;
      const x = random('spark-x' + i) * width;
      const y = random('spark-y' + i) * height;
      const len = 14 + random('spark-l' + i) * 26;
      const angle = random('spark-a' + i) * 360;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: len,
            height: 2.5,
            borderRadius: 999,
            background: theme.accent,
            opacity: e * (1 - life / 0.22),
            transform: 'rotate(' + angle + 'deg)',
            boxShadow: '0 0 12px ' + theme.accent,
          }}
        />
      );
    })}
  </>
);

/** Particles thrown outward from the middle: release, escape, explosion. */
const Burst: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <>
    {Array.from({ length: 30 }, (_, i) => {
      const angle = (i / 30) * Math.PI * 2 + random('burst-a' + i);
      const reach = (0.3 + random('burst-r' + i) * 0.7) * Math.min(width, height) * 0.55;
      const eased = 1 - Math.pow(1 - t, 3);
      const size = (3 + random('burst-s' + i) * 5) * (width / 1920);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: width / 2 + Math.cos(angle) * reach * eased,
            top: height / 2 + Math.sin(angle) * reach * eased,
            width: size,
            height: size,
            borderRadius: 999,
            background: hexToRgba(theme.accent, e * (1 - t)),
          }}
        />
      );
    })}
  </>
);

/** A bloom from the centre. */
const Glow: React.FC<Live> = ({ t, e, theme, width, height }) => {
  const size = Math.min(width, height) * (0.4 + t * 0.5);
  return (
    <div
      style={{
        position: 'absolute',
        left: width / 2 - size / 2,
        top: height / 2 - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle, ' + hexToRgba(theme.accent, 0.35 * e)
          + ' 0%, transparent 70%)',
      }}
    />
  );
};

/** Droplets falling and fading. */
const Drip: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <>
    {Array.from({ length: 20 }, (_, i) => {
      const x = random('drip-x' + i) * width;
      const along = (t * (0.7 + random('drip-s' + i) * 0.7) + random('drip-o' + i)) % 1;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: along * height,
            width: 3.5,
            height: 14 + random('drip-l' + i) * 16,
            borderRadius: 999,
            background: hexToRgba(theme.accent, 0.45 * e),
          }}
        />
      );
    })}
  </>
);

/** Standing waves across the frame: vibration, oscillation, alternation. */
const Wobble: React.FC<Live> = ({ t, e, theme, width, height }) => (
  <svg
    width={width}
    height={height}
    style={{ position: 'absolute', left: 0, top: 0, opacity: 0.35 * e }}
  >
    {[0, 1, 2].map((row) => {
      const y = height * (0.3 + row * 0.2);
      const amp = 16 + row * 8;
      const points = Array.from({ length: 60 }, (_, i) => {
        const x = (i / 59) * width;
        const phase = (i / 59) * Math.PI * 4 + t * Math.PI * 4 + row;
        return x + ',' + (y + Math.sin(phase) * amp);
      }).join(' ');
      return (
        <polyline
          key={row}
          points={points}
          fill="none"
          stroke={theme.accent}
          strokeWidth={2}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

const RENDERERS: Record<EffectKind, React.FC<Live>> = {
  flow: Flow,
  rise: (p) => <Drift {...p} direction={-1} />,
  fall: (p) => <Drift {...p} direction={1} />,
  spin: Spin,
  // The theme's own warm colour, so a heat wash matches the palette rather
  // than introducing a thirteenth hue. Cool has no theme equivalent - `correct`
  // is green and would read as approval - so it takes a fixed cold blue.
  heat: (p) => <><Wash {...p} colour={p.theme.wrong} /><Haze {...p} /></>,
  cool: (p) => <Wash {...p} colour={COLD} />,
  // Impact is a shove, handled by the caller as a transform; the flash is here.
  impact: ({ t, e, theme }) => (
    <AbsoluteFill style={{ background: hexToRgba(theme.accent, 0.16 * e * (1 - t)) }} />
  ),
  wobble: Wobble,
  spark: Spark,
  burst: Burst,
  glow: Glow,
  drip: Drip,
};

/**
 * How hard the frame is shoved at this moment, in pixels.
 *
 * Impact is the one effect that has to move the CONTENT rather than paint over
 * it - a collision you can only see in the background is not a collision. Kept
 * short and decaying, because a shake that outstays its welcome reads as a
 * broken player rather than a hit.
 */
export function impactShove(effects: TimedEffect[], time: number, scale: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const effect of effects) {
    if (effect.kind !== 'impact') continue;
    const t = effectProgress(effect, time);
    if (t === null) continue;
    const decay = Math.pow(1 - t, 2);
    x += Math.sin(t * Math.PI * 14) * 18 * decay * scale;
    y += Math.cos(t * Math.PI * 11) * 10 * decay * scale;
  }
  return { x, y };
}

/**
 * The effects layer for one scene.
 *
 * Rendered under the panel. Returns nothing at all when no effect is running,
 * which is most frames of most scenes - this must not cost anything when it is
 * doing nothing.
 */
export const EffectLayer: React.FC<{
  theme: Theme;
  effects: TimedEffect[];
  /** Seconds into the scene, already corrected for the audio offset. */
  time: number;
}> = ({ theme, effects, time }) => {
  const { width, height } = useVideoConfig();

  const live = effects
    .map((effect) => ({ effect, t: effectProgress(effect, time) }))
    .filter((x): x is { effect: TimedEffect; t: number } => x.t !== null);

  if (!live.length) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {live.map(({ effect, t }, i) => {
        const Renderer = RENDERERS[effect.kind];
        if (!Renderer) return null;
        return (
          <AbsoluteFill key={effect.kind + i}>
            <Renderer t={t} e={envelope(t)} theme={theme} width={width} height={height} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Everything a scene needs to animate itself from its own narration.
 *
 * One hook so a scene reads the frame once: the effects to draw under it, and
 * the shove to apply to it.
 */
export function useNarrationEffects(words: WordTiming[], offset: number) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const seconds = durationInFrames / fps;
  const time = frame / fps - offset;

  const effects = React.useMemo(
    () => detectEffects(words, seconds),
    [words, seconds],
  );

  return { effects, time, shove: impactShove(effects, time, width / 1920) };
}

/**
 * A slow push into the frame, for the whole length of a scene.
 *
 * The single cheapest thing that stops a static layout looking like a
 * screenshot. Every real explainer does it. Deliberately tiny - four percent
 * over twenty seconds is below the threshold anyone consciously notices, which
 * is the point: it should feel filmed, not zoomed.
 */
export function useSlowPush(sceneIndex: number): React.CSSProperties {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Alternating direction, so consecutive scenes do not all drift the same way
  // and turn into a tic.
  const dir = sceneIndex % 2 === 0 ? 1 : -1;
  const scale = 1 + t * 0.04;
  const shift = dir * t * 10;

  return { transform: 'scale(' + scale + ') translate(' + shift + 'px, ' + (-shift * 0.4) + 'px)' };
}
