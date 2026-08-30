import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';

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

  if (landscape) {
    return {
      landscape: true,
      padTop: 120,
      padX: 150,
      padBottom: 110,
      gap: 34,
      // Wider measure means the type can stay large without wrapping badly.
      headlineMax: 96,
      headlineMin: 52,
      // Two columns of options: four stacked rows would waste a 16:9 frame.
      optionColumns: 2,
      optionMax: 46,
      optionMin: 30,
      ring: 200,
    };
  }

  return {
    landscape: false,
    padTop: 150,
    padX: 70,
    padBottom: 200,
    gap: 46,
    headlineMax: 112,
    headlineMin: 58,
    optionColumns: 1,
    optionMax: 52,
    optionMin: 32,
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
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.gap,
        textAlign: 'center',
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
export const SceneFade: React.FC<{ theme: Theme; children: React.ReactNode }> = ({ theme, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const scale =
    theme.bounce > 0.5 ? interpolate(frame, [0, 8], [1.06, 1], { extrapolateRight: 'clamp' }) : 1;
  return <AbsoluteFill style={{ opacity, transform: 'scale(' + scale + ')' }}>{children}</AbsoluteFill>;
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
