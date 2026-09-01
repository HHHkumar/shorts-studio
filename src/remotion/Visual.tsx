import React from 'react';
import { interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import type { SceneVisual } from '../lib/types';
import { P5Sketch, type SketchArgs } from './P5Sketch';
import { SKETCHES, type SketchParams } from './sketches';
import { useEnter, useMetrics } from './ui';

/**
 * The diagram for a scene. Gemini decides which kind fits the point being made;
 * each kind is drawn here from theme tokens so it matches whatever layout the
 * user picked. Everything is sized to fit inside roughly 360px of height.
 */
export const Visual: React.FC<{ theme: Theme; visual?: SceneVisual }> = ({ theme, visual }) => {
  if (!visual || visual.kind === 'none') return null;

  let body: React.ReactNode = null;
  if (visual.kind === 'formula' && visual.formula) body = <Formula theme={theme} text={visual.formula} />;
  else if (visual.kind === 'bars' && visual.items?.length) body = <Bars theme={theme} items={visual.items} />;
  else if (visual.kind === 'compare' && visual.items?.length) body = <Compare theme={theme} items={visual.items} />;
  else if (visual.kind === 'icon' && visual.items?.length) body = <Icon theme={theme} item={visual.items[0]} />;
  else if (visual.kind === 'sketch' && visual.sketch) {
    body = (
      <Sketch
        theme={theme}
        name={visual.sketch}
        params={visual.params || {}}
        items={visual.items || []}
      />
    );
  }

  if (!body) return null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {body}
      {visual.caption ? (
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: 30,
            color: theme.textDim,
            letterSpacing: 0.5,
          }}
        >
          {visual.caption}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------

/**
 * A running p5 animation from the curated library.
 *
 * The sketch is looked up by name; an unknown name draws nothing rather than
 * throwing, so a model that invents one degrades to a plain scene.
 */
const Sketch: React.FC<{
  theme: Theme;
  name: string;
  params: SketchParams;
  items: { label: string; value?: number; symbol?: string }[];
}> = ({ theme, name, params, items }) => {
  const { width } = useVideoConfig();
  const m = useMetrics();

  // Every hook runs before any early return: bailing out above useCallback
  // would change the hook order between an known and an unknown sketch name.
  const paramKey = JSON.stringify(params);
  const itemKey = JSON.stringify(items);
  const draw = React.useCallback(
    (a: SketchArgs) => {
      const def = SKETCHES[name];
      if (!def) return;
      def.draw({
        ...a,
        params,
        items,
        colors: {
          accent: theme.accent,
          text: theme.text,
          dim: theme.textDim,
          good: theme.correct,
          bg: theme.bg,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, paramKey, itemKey, theme.accent, theme.text, theme.textDim, theme.correct, theme.bg],
  );

  const def = SKETCHES[name];
  if (!def) return null;

  const full = Math.round(width - m.padX * 2);
  const tall = m.landscape ? 320 : 430;
  // Round diagrams get a square box so they are not lost in a wide, short band.
  const canvasWidth = def.shape === 'square' ? Math.min(full, tall) : full;

  return <P5Sketch draw={draw} width={canvasWidth} height={tall} />;
};

/**
 * An equation, shown in full or not at all.
 *
 * This used to be a fixed size with `text-overflow: ellipsis`, which turned
 * "1 Year = 365 x 24 = 8,760 hours" into "1 Year = 365 x 24 = 87...". That is
 * not a cosmetic problem: a clipped equation is a WRONG equation, stated
 * confidently on screen, and a viewer has no way to know what was cut. So
 * nothing here truncates - the type shrinks to fit, and wraps to a second line
 * before it would get too small to read.
 */
const Formula: React.FC<{ theme: Theme; text: string }> = ({ theme, text }) => {
  const p = useEnter(2, theme);
  const { width } = useVideoConfig();
  const m = useMetrics();

  const mono = theme.layout !== 'elegant';
  // Room inside the box: the stage margins, then this card's own padding and
  // border. The serif display face runs narrower than the monospace one.
  const available = width - m.padX * 2 - 46 * 2 - 6;
  const perChar = mono ? 0.62 : 0.55;
  const estimate = (size: number) => text.length * (size * perChar + 1);

  let size = 34;
  let oneLine = false;
  for (let candidate = 82; candidate >= 34; candidate -= 2) {
    if (estimate(candidate) <= available) {
      size = candidate;
      oneLine = true;
      break;
    }
  }
  if (!oneLine) {
    // Two lines at a readable size beats one line nobody can read.
    for (let candidate = 62; candidate >= 26; candidate -= 2) {
      size = candidate;
      if (estimate(candidate) <= available * 1.9) break;
    }
  }

  return (
    <div
      style={{
        opacity: p,
        transform: 'scale(' + (0.86 + p * 0.14) + ')',
        padding: '32px 46px',
        background: theme.surfaceAlt,
        border: '3px solid ' + theme.accent,
        borderRadius: theme.radius,
        boxShadow: theme.glow !== 'none' ? theme.glow : theme.shadow,
        maxWidth: '100%',
        fontFamily: mono ? "'Cascadia Mono', Consolas, 'Courier New', monospace" : theme.fontDisplay,
        fontSize: size,
        fontWeight: 700,
        color: theme.text,
        letterSpacing: 1,
        lineHeight: 1.25,
        textAlign: 'center',
        whiteSpace: oneLine ? 'nowrap' : 'normal',
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------

const Bars: React.FC<{ theme: Theme; items: { label: string; value?: number }[] }> = ({ theme, items }) => {
  const rows = items.slice(0, 4).map((it) => ({ label: it.label, value: Number(it.value) || 0 }));
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {rows.map((row, i) => (
        <Bar key={i} theme={theme} label={row.label} value={row.value} max={max} delay={4 + i * 6} />
      ))}
    </div>
  );
};

const Bar: React.FC<{ theme: Theme; label: string; value: number; max: number; delay: number }> = ({
  theme,
  label,
  value,
  max,
  delay,
}) => {
  const p = useEnter(delay, theme);
  const target = Math.max(0.04, Math.abs(value) / max);
  // Count the number up as the bar grows - the motion carries the comparison.
  const shown = value * Math.min(1, p);

  return (
    <div style={{ width: '100%', textAlign: 'left' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
          fontFamily: theme.fontBody,
          fontSize: 32,
          color: theme.textDim,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: theme.accent,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatNumber(shown)}
        </span>
      </div>
      <div
        style={{
          height: 26,
          borderRadius: theme.layout === 'nerdy' ? 3 : 999,
          background: hexToRgba(theme.text, 0.12),
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: target * p * 100 + '%',
            height: '100%',
            borderRadius: 'inherit',
            background: theme.accent,
            boxShadow: theme.glow !== 'none' ? theme.glow : 'none',
          }}
        />
      </div>
    </div>
  );
};

function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return Math.round(n).toLocaleString('en-US');
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------

const Compare: React.FC<{ theme: Theme; items: { label: string; symbol?: string }[] }> = ({ theme, items }) => {
  const pair = items.slice(0, 2);
  // A one-sided comparison renders as a lone card next to a floating "vs",
  // which looks broken. Better to draw nothing at all.
  if (pair.length < 2 || !pair[0] || !pair[1]) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 20, width: '100%' }}>
      <Side theme={theme} item={pair[0]} delay={2} />
      <div
        style={{
          flex: '0 0 auto',
          fontFamily: theme.fontDisplay,
          fontSize: 40,
          fontWeight: 900,
          color: theme.accent,
          fontStyle: theme.displayItalic ? 'italic' : 'normal',
          alignSelf: 'center',
        }}
      >
        vs
      </div>
      <Side theme={theme} item={pair[1]} delay={9} />
    </div>
  );
};

const Side: React.FC<{ theme: Theme; item?: { label: string; symbol?: string }; delay: number }> = ({
  theme,
  item,
  delay,
}) => {
  const p = useEnter(delay, theme);
  if (!item) return null;
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        opacity: p,
        transform: 'translateY(' + (1 - p) * 26 + 'px)',
        background: theme.surface,
        border: theme.borderWidth + 'px solid ' + theme.border,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: '26px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 84, lineHeight: 1 }}>{item.symbol || '•'}</div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 30,
          fontWeight: 700,
          color: theme.text,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {item.label}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Icon: React.FC<{ theme: Theme; item: { label: string; symbol?: string } }> = ({ theme, item }) => {
  const frame = useCurrentFrame();
  const p = useEnter(0, theme);
  const bob = Math.sin(frame / 18) * 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          fontSize: 170,
          lineHeight: 1,
          opacity: p,
          transform: 'translateY(' + bob + 'px) scale(' + (0.6 + p * 0.4) + ')',
          filter: theme.glow !== 'none' ? 'drop-shadow(0 0 26px ' + hexToRgba(theme.accent, 0.6) + ')' : 'none',
        }}
      >
        {item.symbol || '💡'}
      </div>
      {item.label ? (
        <div style={{ fontFamily: theme.fontBody, fontSize: 32, fontWeight: 700, color: theme.text }}>
          {item.label}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------

/**
 * Topic symbols drifting slowly behind everything. Cheap, but it stops a
 * text-only video from looking like a slide deck.
 */
export const MotifLayer: React.FC<{ theme: Theme; symbols: string[] }> = ({ theme, symbols }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!symbols.length) return null;

  const glyphs = new Array(9).fill(0).map((_, i) => {
    const symbol = symbols[i % symbols.length];
    const seed = 'm' + i;
    const x = random(seed + 'x') * 100;
    const startY = random(seed + 'y') * 130 - 15;
    const size = 60 + random(seed + 's') * 90;
    const speed = 0.4 + random(seed + 'v') * 0.9;
    // Drift upward across the whole video, wrapping around.
    const travelled = (frame / Math.max(1, durationInFrames)) * 130 * speed;
    const y = ((startY - travelled) % 130 + 130) % 130 - 15;
    const sway = Math.sin(frame / 40 + i) * 14;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x + '%',
          top: y + '%',
          transform: 'translate(-50%, -50%) translateX(' + sway + 'px)',
          fontSize: size,
          lineHeight: 1,
          opacity: 0.13,
          filter: 'grayscale(0.35)',
          color: theme.text,
          userSelect: 'none',
        }}
      >
        {symbol}
      </div>
    );
  });

  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{glyphs}</div>;
};

/** Fade the motif out during dense scenes so it never fights the text. */
export const motifOpacity = (frame: number, durationInFrames: number): number =>
  interpolate(frame, [0, 12, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
