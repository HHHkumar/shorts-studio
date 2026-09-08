import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';

// ---------------------------------------------------------------------------
// The layer on top of everything.
//
// Distinct from the two layers that already exist and easy to confuse with
// them, so: the AMBIENT layer runs *underneath* the content and is about the
// subject - a circuit grid for electronics, a galaxy for astronomy. The EFFECT
// layer fires on spoken words and is about the sentence. This one is neither.
// It is about the FILM, sits over the top, and never means anything.
//
// That is why it is deliberately dumb: no content, no narration, no seeking of
// meaning. It exists to make a frame look shot rather than assembled.
//
// Two rules hold everything here together:
//
//   1. Legibility wins. Every overlay is capped well below the strength that
//      would make the read-along text harder to read, in exactly the way the
//      ambient layer is. A creator turning the dial to maximum should get
//      "more", never "unreadable".
//   2. Determinism. Remotion renders frames out of order and across machines,
//      so nothing may use Math.random(). Remotion's own seeded random() is used
//      throughout, keyed by index rather than by frame where the thing is meant
//      to persist, and by frame where it is meant to flicker.
// ---------------------------------------------------------------------------

export type OverlayName =
  | 'none'
  | 'vignette'
  | 'grain'
  | 'scanlines'
  | 'leak'
  | 'bars'
  | 'frame'
  | 'dust'
  | 'chroma';

export const OVERLAYS: { id: OverlayName; label: string; blurb: string }[] = [
  { id: 'none', label: 'None', blurb: 'Clean digital. What every video did before this setting existed.' },
  { id: 'vignette', label: 'Vignette — darkened edges', blurb: 'Pushes the eye to the middle. Safest of the lot.' },
  { id: 'grain', label: 'Film grain', blurb: 'Takes the plastic off a flat colour. Barely visible, and that is the point.' },
  { id: 'scanlines', label: 'Scanlines — CRT texture', blurb: 'Retro and technical. Suits electronics and computing.' },
  { id: 'leak', label: 'Light leak — drifting bloom', blurb: 'Warm and organic. Good over photographic backdrops.' },
  { id: 'bars', label: 'Cinematic bars', blurb: 'Letterbox. Makes a 9:16 short read as a film still.' },
  { id: 'frame', label: 'Corner frame', blurb: 'Viewfinder brackets. Reads as observed, measured, documentary.' },
  { id: 'dust', label: 'Dust — floating specks', blurb: 'Depth in front of the picture. Very quiet.' },
  { id: 'chroma', label: 'Chromatic edges', blurb: 'A lens fringe at the corners. Subtle, and slightly uneasy.' },
];

const NAMES = new Set(OVERLAYS.map((o) => o.id));

export function isOverlay(name: string): name is OverlayName {
  return NAMES.has(name as OverlayName);
}

/**
 * The dial, mapped to what each overlay can actually afford.
 *
 * Not one shared cap: a vignette at 45% is atmospheric while grain at 45% is a
 * broken television. The ceiling is per overlay, and every one of them was
 * chosen by asking "at maximum, can you still read the captions?".
 */
const CEILING: Record<OverlayName, number> = {
  none: 0,
  vignette: 0.62,
  grain: 0.16,
  scanlines: 0.18,
  leak: 0.30,
  bars: 1,
  frame: 0.85,
  dust: 0.42,
  chroma: 0.24,
};

const c01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

/** Strength for this overlay, already capped. Exported for the tests. */
export function overlayStrength(name: string, intensity: number): number {
  if (!isOverlay(name) || name === 'none') return 0;
  return c01(intensity) * CEILING[name];
}

interface LayerProps {
  theme: Theme;
  strength: number;
  frame: number;
  width: number;
  height: number;
}

// --- the overlays themselves -------------------------------------------------

const Vignette: React.FC<LayerProps> = ({ strength }) => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse 78% 68% at 50% 50%, transparent 40%, rgba(0,0,0,'
        + strength.toFixed(3) + ') 100%)',
    }}
  />
);

/**
 * Grain, as a jumping dot pattern rather than real noise.
 *
 * feTurbulence would be truer and is far too slow to evaluate on every frame of
 * a five-minute render. Two offset dot grids, shifted by a couple of pixels
 * each frame, are indistinguishable at playback speed and cost nothing.
 */
const Grain: React.FC<LayerProps> = ({ strength, frame }) => {
  const jx = Math.round(random('gx' + frame) * 14) - 7;
  const jy = Math.round(random('gy' + frame) * 14) - 7;
  const dot = (a: number) =>
    'radial-gradient(circle at 50% 50%, rgba(255,255,255,' + a.toFixed(3) + ') 0.5px, transparent 1px)';
  return (
    <AbsoluteFill
      style={{
        backgroundImage: dot(strength) + ',' + dot(strength * 0.7),
        backgroundSize: '3px 3px, 5px 5px',
        backgroundPosition: jx + 'px ' + jy + 'px, ' + -jy + 'px ' + jx + 'px',
        mixBlendMode: 'overlay',
      }}
    />
  );
};

const Scanlines: React.FC<LayerProps> = ({ strength, frame }) => {
  // A slow downward crawl. Fast enough to see, slow enough not to strobe when
  // the video is re-encoded at a different frame rate.
  const shift = (frame * 0.35) % 4;
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,' + strength.toFixed(3) + ') 0px, '
          + 'rgba(0,0,0,' + strength.toFixed(3) + ') 1px, transparent 1px, transparent 4px)',
        backgroundPosition: '0 ' + shift + 'px',
      }}
    />
  );
};

const Leak: React.FC<LayerProps> = ({ theme, strength, frame, width, height }) => (
  <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
    {[0, 1, 2].map((i) => {
      // Each bloom drifts on its own slow loop, so they never line up into a
      // single pulsing blob.
      const t = frame / (260 + i * 70) + i;
      const x = (0.5 + Math.sin(t) * 0.42) * width;
      const y = (0.5 + Math.cos(t * 0.8 + i) * 0.4) * height;
      const size = Math.min(width, height) * (0.55 + i * 0.16);
      const colour = i === 1 ? theme.accent : i === 2 ? theme.correct : theme.wrong;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, ' + hexToRgba(colour, strength) + ' 0%, transparent 68%)',
            filter: 'blur(46px)',
          }}
        />
      );
    })}
  </AbsoluteFill>
);

const Bars: React.FC<LayerProps> = ({ strength, height }) => {
  // 2.39:1 within the frame at full strength, which is the ratio that reads as
  // "film" rather than as "something went wrong with the export".
  const bar = height * 0.07 * strength;
  const style: React.CSSProperties = { position: 'absolute', left: 0, right: 0, height: bar, background: '#000' };
  return (
    <AbsoluteFill>
      <div style={{ ...style, top: 0 }} />
      <div style={{ ...style, bottom: 0 }} />
    </AbsoluteFill>
  );
};

const Frame: React.FC<LayerProps> = ({ theme, strength, width, height }) => {
  const len = Math.min(width, height) * 0.075;
  const inset = Math.min(width, height) * 0.045;
  const thick = 4;
  const colour = hexToRgba(theme.accent, strength);
  const corner = (v: 'top' | 'bottom', h: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [v]: inset,
    [h]: inset,
    width: len,
    height: len,
    [v === 'top' ? 'borderTop' : 'borderBottom']: thick + 'px solid ' + colour,
    [h === 'left' ? 'borderLeft' : 'borderRight']: thick + 'px solid ' + colour,
  });
  return (
    <AbsoluteFill>
      <div style={corner('top', 'left')} />
      <div style={corner('top', 'right')} />
      <div style={corner('bottom', 'left')} />
      <div style={corner('bottom', 'right')} />
    </AbsoluteFill>
  );
};

const Dust: React.FC<LayerProps> = ({ strength, frame, width, height }) => (
  <AbsoluteFill>
    {new Array(34).fill(0).map((_, i) => {
      // Seeded by index, not by frame: a speck must persist and drift, not
      // reappear somewhere new every thirtieth of a second.
      const seed = 'd' + i;
      const speed = 0.12 + random(seed + 's') * 0.3;
      const size = 2 + random(seed + 'z') * 5;
      const x = ((random(seed + 'x') + Math.sin(frame / 190 + i) * 0.05) % 1) * width;
      const y = (((random(seed + 'y') * height) - frame * speed) % height + height) % height;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,' + (strength * (0.3 + random(seed + 'a') * 0.7)).toFixed(3) + ')',
            filter: 'blur(1px)',
          }}
        />
      );
    })}
  </AbsoluteFill>
);

const Chroma: React.FC<LayerProps> = ({ strength }) => (
  <AbsoluteFill>
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 55%, rgba(255,0,72,'
          + strength.toFixed(3) + ') 100%)',
        mixBlendMode: 'screen',
        transform: 'translateX(-4px)',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 55%, rgba(0,238,255,'
          + strength.toFixed(3) + ') 100%)',
        mixBlendMode: 'screen',
        transform: 'translateX(4px)',
      }}
    />
  </AbsoluteFill>
);

const RENDERERS: Record<Exclude<OverlayName, 'none'>, React.FC<LayerProps>> = {
  vignette: Vignette,
  grain: Grain,
  scanlines: Scanlines,
  leak: Leak,
  bars: Bars,
  frame: Frame,
  dust: Dust,
  chroma: Chroma,
};

/**
 * The finishing layer. Drawn above every scene and outside every Sequence, so
 * it runs continuously through the cuts instead of restarting on each one.
 */
export const OverlayLayer: React.FC<{
  theme: Theme;
  name: string;
  intensity: number;
}> = ({ theme, name, intensity }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const strength = overlayStrength(name, intensity);
  if (!strength) return null;

  const Renderer = RENDERERS[name as Exclude<OverlayName, 'none'>];
  if (!Renderer) return null;

  return (
    // pointerEvents none matters in the browser preview, where this sits over
    // the Player and would otherwise swallow the scrub bar.
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Renderer theme={theme} strength={strength} frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};
