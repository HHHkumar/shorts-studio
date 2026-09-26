import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import { flexAlignFor, textAlignFor } from '../lib/align';
import { autoTransitionFor, isTransition, transitionStyle } from '../lib/transitions';
import { DoodleZoneContext } from './doodle-zone';

/**
 * How the frame is laid out for the shape we are rendering into.
 *
 * Scenes read this instead of hard-coding portrait numbers, which is what lets
 * the same components fill a 9:16 phone screen and a 16:9 explainer. Derived
 * from the composition itself, so nothing has to be threaded down as props.
 */
export interface Metrics {
  landscape: boolean;
  padTop: number;
  padX: number;
  padBottom: number;
  gap: number;
  headlineMax: number;
  headlineMin: number;
  optionColumns: number;
  optionMax: number;
  optionMin: number;
  ring: number;
}

export function useMetrics(): Metrics {
  const { width, height } = useVideoConfig();
  const landscape = width > height;

  // Inside a doodle scene the text has only its own band - the top of a
  // portrait frame, the left of a landscape one - with the drawing beside it.
  // Same components, smaller room: the padding that keeps text clear of the
  // phone's own buttons is only needed at the edge the band actually touches.
  // The Doodle look's words are handwriting in lowercase, which reads much
  // smaller than the heavy capitals the other looks set at the same size -
  // only the x-height is doing the work. They were also first sized DOWN to fit
  // beside the drawing, to 86 against 112, when the band beside it has far more
  // room than one line needs: a caption used 70 pixels of an 880-pixel band.
  // So beside a drawing they are now larger than the other looks, and on a
  // page with no drawing, a notch larger than standard.
  const zone = React.useContext(DoodleZoneContext);
  if (zone === 'text-top') {
    return {
      landscape: false,
      padTop: 120,
      padX: 70,
      padBottom: 20,
      gap: 28,
      headlineMax: 120,
      headlineMin: 64,
      optionColumns: 1,
      optionMax: 48,
      optionMin: 34,
      ring: 170,
    };
  }
  if (zone === 'text-left') {
    return {
      landscape: true,
      padTop: 100,
      padX: 90,
      padBottom: 90,
      gap: 26,
      headlineMax: 96,
      headlineMin: 54,
      optionColumns: 1,
      optionMax: 42,
      optionMin: 30,
      ring: 170,
    };
  }
  const handwritten = zone === 'page' ? 1.12 : 1;

  if (landscape) {
    return {
      landscape: true,
      padTop: 120,
      padX: 150,
      padBottom: 110,
      gap: 34,
      // Wider measure means the type can stay large without wrapping badly.
      headlineMax: Math.round(96 * handwritten),
      headlineMin: Math.round(52 * handwritten),
      // Two columns of options: four stacked rows would waste a 16:9 frame.
      optionColumns: 2,
      optionMax: Math.round(46 * handwritten),
      optionMin: Math.round(30 * handwritten),
      ring: 200,
    };
  }

  return {
    landscape: false,
    padTop: 150,
    padX: 70,
    padBottom: 200,
    gap: 46,
    headlineMax: Math.round(112 * handwritten),
    headlineMin: Math.round(58 * handwritten),
    optionColumns: 1,
    optionMax: Math.round(52 * handwritten),
    optionMin: Math.round(32 * handwritten),
    ring: 240,
  };
}

/** A spring whose bounciness comes from the chosen layout. */
export function useEnter(delay: number, theme: Theme): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 200 - theme.bounce * 188,
      stiffness: 100 + theme.bounce * 60,
      mass: 1 - theme.bounce * 0.45,
    },
    durationInFrames: theme.bounce > 0.5 ? undefined : 18,
  });
}

/** Shrink the type as the text gets longer so nothing ever overflows. */
export function autoFontSize(text: string, max: number, min: number): number {
  const len = text.trim().length;
  if (len <= 24) return max;
  if (len >= 190) return min;
  const t = (len - 24) / (190 - 24);
  return Math.round(max + (min - max) * t);
}

export const Pill: React.FC<{ theme: Theme; children: React.ReactNode; tone?: 'accent' | 'quiet' }> = ({
  theme,
  children,
  tone = 'accent',
}) => (
  <div
    style={{
      display: 'inline-block',
      padding: '14px 34px',
      borderRadius: 999,
      background: tone === 'accent' ? theme.accentSoft : 'transparent',
      border: '2px solid ' + (tone === 'accent' ? theme.accent : theme.border),
      color: tone === 'accent' ? theme.accent : theme.textDim,
      fontFamily: theme.fontBody,
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

export const Card: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ theme, children, style }) => (
  <div
    style={{
      background: theme.surface,
      border: theme.borderWidth + 'px solid ' + theme.border,
      borderRadius: theme.radius,
      boxShadow: theme.shadow,
      padding: '54px 48px',
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    }}
  >
    {children}
  </div>
);

/** The standard vertical frame: header strip, content, caption slot. */
export const Stage: React.FC<{
  theme: Theme;
  header?: React.ReactNode;
  children: React.ReactNode;
}> = ({ theme, header, children }) => {
  const m = useMetrics();
  return (
    <AbsoluteFill
      style={{
        padding: m.padTop + 'px ' + m.padX + 'px ' + m.padBottom + 'px',
        display: 'flex',
        flexDirection: 'column',
        // Across follows the look; down stays centred, so a flush-left scene
        // is still balanced top to bottom.
        alignItems: flexAlignFor(theme.align),
        justifyContent: 'center',
        gap: m.gap,
        textAlign: textAlignFor(theme.align),
      }}
    >
      {header ? (
        <div style={{ position: 'absolute', top: m.padTop, left: 0, right: 0 }}>{header}</div>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

/** Fades the whole scene in so hard cuts do not flicker. */
/** How long two scenes overlap at a cut. About a third of a second. */
export const SCENE_OVERLAP = 10;


/**
 * How long this scene's narration actually is, in seconds.
 *
 * NOT the same as the composition duration inside a Sequence. Each scene is
 * held open SCENE_OVERLAP frames past its narration so it can cross-fade with
 * the next one, and `useVideoConfig` inside a Sequence reports that extended
 * length. Everything that aligns to the voice - reveals, motion beats,
 * narration effects - has to use the real one, or a fallback that spreads
 * items "evenly across the scene" would quietly spread them across a third of
 * a second more than the viewer ever hears.
 */
export function useSceneSeconds(): number {
  const { fps, durationInFrames } = useVideoConfig();
  return Math.max(0.1, (durationInFrames - SCENE_OVERLAP) / fps);
}

/**
 * The join between one scene and the next.
 *
 * This used to be five frames of opacity on the incoming scene and nothing at
 * all on the outgoing one, which is a hard cut with a flicker in front of it.
 * A real crossfade needs both scenes on screen at once, so each Sequence is
 * held open past its narration by SCENE_OVERLAP frames and spends them fading
 * out while the next one fades in.
 *
 * `hold` is the scene's own length, NOT the extended one - it is the moment the
 * next scene starts, and therefore the moment this one must begin to go.
 *
 * The slide is what stops it reading as a dissolve. Direction alternates so a
 * whole video does not drift the same way, which becomes a tic by the fourth
 * scene.
 */
export const SceneFade: React.FC<{
  theme: Theme;
  hold: number;
  index: number;
  /** Which join to use. 'auto' resolves from the scene kind. */
  transition?: string;
  /** Only read when the transition is 'auto'. */
  kind?: string;
  children: React.ReactNode;
}> = ({ theme, hold, index, transition = 'crossfade', kind = '', children }) => {
  const frame = useCurrentFrame();

  const arriving = interpolate(frame, [0, SCENE_OVERLAP], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leaving = interpolate(frame, [hold, hold + SCENE_OVERLAP], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The maths lives in src/lib/transitions.ts, framework-free, so every join
  // can be checked at a hundred points without rendering a frame.
  // A name saved by an older version, or simply mistyped, must not blank the
  // scene - transitionStyle already falls back, but resolving here keeps
  // 'auto' from ever reaching it.
  const name = !isTransition(transition) || transition === 'auto'
    ? autoTransitionFor(kind, index)
    : transition;
  const style = transitionStyle(name, { arriving, leaving, index, bounce: theme.bounce });

  return (
    <AbsoluteFill
      style={{
        opacity: style.opacity,
        transform: style.transform,
        filter: style.filter,
        clipPath: style.clipPath,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** The decorative background for each layout. */
export const Backdrop: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1]);

  if (theme.decor === 'grid') {
    const cell = 90;
    const offset = (drift * cell) % cell;
    return (
      <AbsoluteFill style={{ background: theme.bg }}>
        <AbsoluteFill
          style={{
            // 2px lines, not 1px: a single pixel disappears once the video is
            // scaled down to a phone screen.
            backgroundImage:
              'linear-gradient(' + hexToRgba(theme.accent, 0.22) + ' 2px, transparent 2px),' +
              'linear-gradient(90deg, ' + hexToRgba(theme.accent, 0.22) + ' 2px, transparent 2px)',
            backgroundSize: cell + 'px ' + cell + 'px',
            backgroundPosition: '0px ' + offset + 'px',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 30%, ' + hexToRgba(theme.accent, 0.1) + ' 0%, transparent 60%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (theme.decor === 'paper') {
    // A notebook page: faint dots and a little warmth at the edges. It does
    // not drift like the grid does - under a still drawing, a moving page
    // makes the engineer look as if they are sliding.
    const dot = theme.mode === 'dark' ? 'rgba(236,235,228,0.10)' : 'rgba(28,28,28,0.10)';
    return (
      <AbsoluteFill style={{ background: theme.bg }}>
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(' + dot + ' 2.4px, transparent 2.6px)',
            backgroundSize: '44px 44px',
            backgroundPosition: '22px 22px',
          }}
        />
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 45%, transparent 55%, '
              + hexToRgba(theme.bgAlt, theme.mode === 'dark' ? 0.9 : 0.8) + ' 100%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (theme.decor === 'rays') {
    return (
      <AbsoluteFill style={{ background: theme.bg }}>
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(120% 70% at 50% 0%, ' + theme.bgAlt + ' 0%, ' + theme.bg + ' 65%)',
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(' + (100 + drift * 12) + 'deg, transparent 42%, ' +
              hexToRgba(theme.accent, 0.09) + ' 50%, transparent 58%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (theme.decor === 'burst') {
    const blobs = new Array(7).fill(0).map((_, i) => {
      const seed = 'b' + i;
      const x = random(seed + 'x') * 100;
      const y = random(seed + 'y') * 100;
      const size = 340 + random(seed + 's') * 520;
      const pulse = Math.sin((frame / 22) + i) * 26;
      const color = i % 2 === 0 ? theme.accent : theme.border;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x + '%',
            top: y + '%',
            width: size + pulse,
            height: size + pulse,
            marginLeft: -(size / 2),
            marginTop: -(size / 2),
            borderRadius: '50%',
            background: 'radial-gradient(circle, ' + hexToRgba(color, 0.4) + ' 0%, transparent 70%)',
            filter: 'blur(28px)',
          }}
        />
      );
    });
    return (
      <AbsoluteFill
        style={{ background: 'linear-gradient(160deg, ' + theme.bg + ' 0%, ' + theme.bgAlt + ' 100%)' }}
      >
        {blobs}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{ background: 'linear-gradient(180deg, ' + theme.bgAlt + ' 0%, ' + theme.bg + ' 55%)' }}
    />
  );
};

/** Thin bar across the very top showing how far through the video we are. */
export const ProgressBar: React.FC<{ theme: Theme; progress: number }> = ({ theme, progress }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: hexToRgba(theme.text, 0.12) }}>
    <div
      style={{
        width: Math.min(100, Math.max(0, progress * 100)) + '%',
        height: '100%',
        background: theme.accent,
        boxShadow: theme.glow,
      }}
    />
  </div>
);
