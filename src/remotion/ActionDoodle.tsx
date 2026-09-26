import React from 'react';
import type { EffectKind } from '../lib/motion-lexicon';

// ---------------------------------------------------------------------------
// The narration's verbs, drawn in marker around the words themselves.
//
// The Doodle look's answer to the effects layer. Blurred particles drifting
// behind the text are a screen's idea of motion; on paper, a word that flows
// gets a wavy arrow under it and a word that heats gets steam over it - the
// marks a teacher adds with a pen while saying the word.
//
// Each mark is drawn on in a stroke when its word is spoken, then keeps a
// small movement of its own for as long as the phrase is on screen: the steam
// rises, the arrow turns, the drops fall. Every bit of it is a function of how
// long ago the word was said, so a seek lands on the same drawing as a play.
//
// Positions are in em, relative to the word's own box, so a mark scales with
// the handwriting around it whatever size the phrase is set at.
// ---------------------------------------------------------------------------

/** How long a mark takes to draw on, in seconds. Shorter than a word. */
export const MARK_DRAW = 0.45;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Marker thickness, as a fraction of the font size. */
const STROKE = 0.075;

interface Pen {
  /** 0 to 1: how much of each line has been drawn. */
  draw: number;
  color: string;
}

/**
 * A mark in a square box beside or above the word.
 *
 * Square so the drawing keeps its shape: an arrowhead stretched to the width
 * of a long word is no longer an arrowhead.
 */
const Glyph: React.FC<{
  pen: Pen;
  /** Side of the box, in em. */
  size: number;
  place: React.CSSProperties;
  paths: string[];
  /** SVG transform for the whole drawing, in the 0-100 box. */
  move?: string;
  opacity?: number;
}> = ({ pen, size, place, paths, move, opacity = 1 }) => (
  <svg
    viewBox="0 0 100 100"
    aria-hidden="true"
    style={{
      position: 'absolute',
      width: size + 'em',
      height: size + 'em',
      overflow: 'visible',
      pointerEvents: 'none',
      opacity,
      ...place,
    }}
  >
    <g transform={move}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={pen.color}
          strokeWidth={(STROKE * 100) / size}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Drawn on as a pen would: each line from its start to its end.
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - pen.draw}
        />
      ))}
    </g>
  </svg>
);

/**
 * The one mark as wide as its word: the wavy line under a flow.
 *
 * Stretched to fit, so the line keeps its thickness with non-scaling-stroke,
 * and it is revealed by a sweep rather than a dash - a dash pattern measured
 * after stretching would not end where the line does. Solid, not travelling
 * dashes: those were tried, and once the boil wobbled them they read as
 * scribble rather than as a current.
 */
const Sweep: React.FC<{ pen: Pen; px: number; d: string; place: React.CSSProperties }> = ({ pen, px, d, place }) => {
  const clip = 'action-sweep-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', ...place }}
    >
      <defs>
        <clipPath id={clip} clipPathUnits="userSpaceOnUse">
          <rect x={-5} y={-60} width={110 * pen.draw} height={220} />
        </clipPath>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={pen.color}
        strokeWidth={px * STROKE}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        clipPath={'url(#' + clip + ')'}
      />
    </svg>
  );
};

/** The last part of the stroke: an arrowhead lands once its line is drawn. */
const headPen = (pen: Pen): Pen => ({ ...pen, draw: clamp01((pen.draw - 0.8) / 0.2) });

/**
 * The head of an arrow running clockwise round the circle, with its tip at
 * `deg`: two short strokes swept back along the way it came.
 */
const arrowHeadOnCircle = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const tip = { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  // Clockwise on screen (y down) travels along (-sin, cos); back is the reverse.
  const back = Math.atan2(-Math.cos(a), Math.sin(a));
  const wing = (turn: number) => {
    const w = back + (turn * Math.PI) / 180;
    return (tip.x + 22 * Math.cos(w)).toFixed(1) + ' ' + (tip.y + 22 * Math.sin(w)).toFixed(1);
  };
  return 'M ' + wing(38) + ' L ' + tip.x.toFixed(1) + ' ' + tip.y.toFixed(1) + ' L ' + wing(-38);
};

/** Steam over the word, one wavy line per column. */
const steam = (x: number) => 'M ' + x + ' 96 C ' + (x - 14) + ' 80, ' + (x + 14) + ' 64, ' + x + ' 50 S '
  + (x - 14) + ' 20, ' + x + ' 6';

/** A teardrop hanging from (x, y). */
const drop = (x: number, y: number, s: number) =>
  'M ' + x + ' ' + y + ' C ' + (x - s * 0.2) + ' ' + (y + s * 0.4) + ', ' + (x - s * 0.55) + ' ' + (y + s * 0.62)
  + ', ' + (x - s * 0.5) + ' ' + (y + s * 0.8) + ' A ' + s * 0.5 + ' ' + s * 0.5 + ' 0 0 0 ' + (x + s * 0.5) + ' '
  + (y + s * 0.8) + ' C ' + (x + s * 0.55) + ' ' + (y + s * 0.62) + ', ' + (x + s * 0.2) + ' ' + (y + s * 0.4)
  + ', ' + x + ' ' + y;

const SIDE_TICKS_LEFT = ['M 92 22 L 52 4', 'M 90 50 L 34 50', 'M 92 78 L 52 96'];
const SIDE_TICKS_RIGHT = ['M 8 22 L 48 4', 'M 10 50 L 66 50', 'M 8 78 L 48 96'];

/**
 * The hand-drawn mark for one action word.
 *
 * Absolutely placed, so the parent - the word - must be `position: relative`.
 * Draws nothing until the word has been spoken.
 */
export const ActionDoodle: React.FC<{
  kind: EffectKind;
  /** Seconds since the word was spoken. Negative: not yet. */
  since: number;
  /** The font size of the word, in px. */
  px: number;
  /** The live colour - the marker red. */
  color: string;
  /** Plain ink, for the one mark that is not "live": cold. */
  ink: string;
}> = ({ kind, since, px, color, ink }) => {
  if (since < 0) return null;
  const pen: Pen = { draw: clamp01(since / MARK_DRAW), color };
  const wave = Math.sin(since * Math.PI * 2 * 0.9);

  switch (kind) {
    case 'flow': {
      // The head keeps pushing on along the way the line goes.
      const push = ((since * 0.9) % 1) * 14;
      return (
        <>
          <Sweep
            pen={pen}
            px={px}
            d="M 1 50 C 12 8, 24 8, 34 50 S 56 92, 67 50 S 88 8, 99 50"
            place={{ left: '-2%', width: '100%', top: '0.98em', height: '0.24em' }}
          />
          <Glyph
            pen={headPen(pen)}
            size={0.36}
            place={{ left: 'calc(98% - 0.16em)', top: '0.92em' }}
            paths={['M 18 12 L 72 50 L 18 88']}
            move={'translate(' + push.toFixed(2) + ' 0)'}
          />
        </>
      );
    }

    case 'rise':
    case 'fall': {
      const up = kind === 'rise';
      // Bobs in the direction it points.
      const bob = ((since * 0.9) % 1) * 14 * (up ? -1 : 1);
      return (
        <Glyph
          pen={pen}
          size={0.6}
          // Beside the word, in the gap before the next one: above or below
          // it, the arrow met the marks of the lines around it.
          place={{ left: 'calc(100% - 0.14em)', top: '0.2em' }}
          paths={up
            ? ['M 50 94 C 45 70, 55 42, 50 10', 'M 26 34 L 50 8 L 74 32']
            : ['M 50 6 C 55 30, 45 58, 50 90', 'M 26 66 L 50 92 L 74 68']}
          move={'translate(0 ' + bob.toFixed(2) + ')'}
          opacity={1 - Math.max(0, ((since * 0.9) % 1) - 0.75) * 2}
        />
      );
    }

    case 'spin':
      // A turning arrow at the word's shoulder, where the other small marks
      // sit. Arcs over and under the word were tried and crowded the lines
      // above and below.
      return (
        <Glyph
          pen={pen}
          size={0.74}
          place={{ left: 'calc(100% - 0.16em)', top: '-0.5em' }}
          paths={[
            'M 78.3 21.7 A 40 40 0 1 1 36.3 12.4',
            arrowHeadOnCircle(40, -110),
          ]}
          move={'rotate(' + (since * 150).toFixed(1) + ' 50 50)'}
        />
      );

    case 'heat':
      return (
        <Glyph
          pen={pen}
          size={0.72}
          place={{ left: '50%', marginLeft: '-0.36em', top: '-0.68em' }}
          paths={[steam(24), steam(50), steam(76)]}
          move={'translate(0 ' + (wave * 5).toFixed(2) + ')'}
        />
      );

    case 'cool':
      return (
        <Glyph
          pen={{ ...pen, color: ink }}
          size={0.5}
          place={{ left: 'calc(100% - 0.1em)', top: '-0.36em' }}
          paths={[
            'M 50 6 L 50 94', 'M 12 28 L 88 72', 'M 12 72 L 88 28',
            'M 38 12 L 50 24 L 62 12', 'M 38 88 L 50 76 L 62 88',
          ]}
          move={'rotate(' + (since * 30).toFixed(1) + ' 50 50)'}
        />
      );

    case 'impact':
    case 'burst': {
      // A hit is over in an instant; a burst keeps pushing outward.
      const push = kind === 'burst' ? ((since * 1.1) % 1) * 10 : 0;
      return (
        <>
          <Glyph
            pen={pen}
            size={0.4}
            place={{ left: '-0.44em', top: '0.3em' }}
            paths={SIDE_TICKS_LEFT}
            move={'translate(' + (-push).toFixed(2) + ' 0)'}
          />
          <Glyph
            pen={pen}
            size={0.4}
            place={{ left: 'calc(100% + 0.04em)', top: '0.3em' }}
            paths={SIDE_TICKS_RIGHT}
            move={'translate(' + push.toFixed(2) + ' 0)'}
          />
          {kind === 'burst' ? (
            <Glyph
              pen={pen}
              size={0.6}
              place={{ left: '50%', marginLeft: '-0.3em', top: '-0.52em' }}
              paths={[-160, -125, -90, -55, -20].map((deg) => {
                const a = (deg * Math.PI) / 180;
                const x = (r: number) => (50 + r * Math.cos(a)).toFixed(1);
                const y = (r: number) => (96 + r * Math.sin(a)).toFixed(1);
                return 'M ' + x(46) + ' ' + y(46) + ' L ' + x(84) + ' ' + y(84);
              })}
              move={'translate(0 ' + (-push * 0.8).toFixed(2) + ')'}
            />
          ) : null}
        </>
      );
    }

    case 'wobble':
      return (
        <>
          <Glyph
            pen={pen}
            // As tall as the letters, so they read as a shake and not as
            // quotation marks: small ones were taken for « ».
            size={0.8}
            place={{ left: '-0.72em', top: '0.17em' }}
            paths={['M 85 30 C 75 42, 75 58, 85 70', 'M 62 12 C 44 38, 44 62, 62 88']}
            opacity={0.65 + 0.35 * Math.abs(wave)}
          />
          <Glyph
            pen={pen}
            size={0.8}
            place={{ left: 'calc(100% - 0.08em)', top: '0.17em' }}
            paths={['M 15 30 C 25 42, 25 58, 15 70', 'M 38 12 C 56 38, 56 62, 38 88']}
            opacity={0.65 + 0.35 * Math.abs(wave)}
          />
        </>
      );

    case 'spark':
      return (
        <Glyph
          pen={pen}
          size={0.68}
          place={{ left: 'calc(100% - 0.22em)', top: '-0.5em' }}
          paths={['M 58 4 L 30 52 L 56 48 L 36 96', 'M 74 30 L 92 22', 'M 76 60 L 94 66']}
          // A flicker, stepped rather than smooth: a spark does not fade.
          opacity={pen.draw < 1 || Math.floor(since * 11) % 4 !== 0 ? 1 : 0.35}
        />
      );

    case 'glow':
      return (
        <Glyph
          pen={pen}
          size={0.66}
          place={{ left: 'calc(100% - 0.16em)', top: '-0.44em' }}
          paths={[
            // A four-point sparkle, and two short rays beside it.
            'M 50 14 Q 54 46, 86 50 Q 54 54, 50 86 Q 46 54, 14 50 Q 46 46, 50 14',
            'M 12 12 L 24 24', 'M 88 12 L 76 24',
          ]}
          move={'rotate(' + (wave * 8).toFixed(1) + ' 50 50)'}
          opacity={0.7 + 0.3 * Math.abs(wave)}
        />
      );

    case 'drip': {
      // Each drop falls and fades, then starts again at the word.
      const fall = (offset: number) => ((since * 0.8 + offset) % 1);
      return (
        <>
          {[{ x: 32, o: 0 }, { x: 68, o: 0.5 }].map(({ x, o }) => (
            <Glyph
              key={x}
              pen={pen}
              size={0.6}
              place={{ left: '50%', marginLeft: '-0.3em', top: '0.86em' }}
              paths={[drop(x, 4, 46)]}
              move={'translate(0 ' + (fall(o) * 30).toFixed(2) + ')'}
              opacity={pen.draw < 1 ? 1 : 1 - fall(o)}
            />
          ))}
        </>
      );
    }

    default:
      return null;
  }
};

/**
 * How the word itself moves with its mark, as a CSS transform: the risen word
 * lifts, the shaken word shakes. Small - it is still a word to be read.
 */
export function actionWordMotion(kind: EffectKind, since: number): string | undefined {
  if (since < 0) return undefined;
  const settle = clamp01(since / MARK_DRAW);
  switch (kind) {
    case 'rise':
      return 'translateY(' + (-0.07 * settle).toFixed(3) + 'em)';
    case 'fall':
      return 'translateY(' + (0.07 * settle).toFixed(3) + 'em)';
    case 'spin':
      return 'rotate(' + (Math.sin(since * Math.PI * 2 * 0.7) * 3).toFixed(2) + 'deg)';
    case 'wobble':
      return 'translateX(' + (Math.sin(since * Math.PI * 2 * 7) * 0.025).toFixed(3) + 'em)';
    case 'impact': {
      // One jolt as the word lands, then still.
      const decay = Math.max(0, 1 - since / 0.5);
      return 'translateX(' + (Math.sin(since * Math.PI * 2 * 9) * 0.05 * decay).toFixed(3) + 'em)';
    }
    case 'flow':
      return 'translateX(' + (0.04 * settle).toFixed(3) + 'em)';
    default:
      return undefined;
  }
}
