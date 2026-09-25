import React from 'react';
import { useCurrentFrame } from 'remotion';

// ---------------------------------------------------------------------------
// Making everything look drawn by hand - not just the mascot.
//
// The circuits, phasors, bar charts, icons, arrows and card borders are all
// drawn by code, which is what keeps them accurate - and code draws a ruler-
// straight line and a perfect circle, which on a notebook page looks pasted
// in. So in the Doodle look every scene's graphics are passed through a
// displacement filter: a field of smooth noise nudges each point a couple of
// pixels, and straight lines come out with the slight waver of a marker. The
// maths underneath is untouched; only how it is inked changes.
//
// Two strengths:
//   soft - over the whole scene, still. Words, cards and pills get a hand-
//          lettered irregularity without ever moving.
//   boil - on top, for the diagrams alone (every <svg> in the scene). The
//          noise is re-seeded a few times a second, so the lines shimmer the
//          way hand-drawn animation does when each frame is traced again.
//          Diagrams only: boiling words would be hard to read.
//
// Both are pure functions of the frame - the seed comes from the frame number,
// never from Math.random - so every render of a frame is identical.
// ---------------------------------------------------------------------------

/** Re-trace the diagrams every this many frames: 7.5 times a second at 30fps. */
const BOIL_EVERY = 4;

/** Mount once per Doodle video. Defines the two filters every DoodleInk uses. */
export const DoodleFilters: React.FC<{ boil: boolean }> = ({ boil }) => {
  const frame = useCurrentFrame();
  // A still seed when motion is off: hand-drawn, but holding still.
  const seed = boil ? (Math.floor(frame / BOIL_EVERY) % 997) + 1 : 1;
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="doodle-soft" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="doodle-boil" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={2} seed={seed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={4.5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <style>{'.doodle-ink svg { filter: url(#doodle-boil); }'}</style>
    </svg>
  );
};

/** Wraps a scene's content so everything in it is inked by hand. */
export const DoodleInk: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="doodle-ink" style={{ position: 'absolute', inset: 0, filter: 'url(#doodle-soft)' }}>
    {children}
  </div>
);

/**
 * A mark made in marker, drawn on over a few frames.
 *
 *   circle - the loop a teacher puts round the right answer, kept entirely
 *            OUTSIDE the row so it never crosses the answer it is marking.
 *            It overshoots its own start, because a hand-drawn loop never
 *            quite closes.
 *   strike - a wavy line through an answer that is out.
 *
 * Stretched to whatever it is laid over, with the stroke kept its own width so
 * a wide row does not get a fat line.
 *
 * It is revealed by a clip that sweeps across it, not by the usual dash trick.
 * A dash's length is measured before the stretch but drawn after it once the
 * stroke is kept an even width, so on a wide row the "one long dash" came out
 * as a row of short ones. A clip has no such arithmetic in it.
 */
export const DoodleMark: React.FC<{
  kind: 'circle' | 'strike';
  color: string;
  /** 0 to 1: how much of the line has been drawn. */
  progress: number;
  width?: number;
}> = ({ kind, color, progress, width = 6 }) => {
  // Unique per mark: two scenes overlap during a cut, and a shared id would
  // make one mark's sweep follow the other's.
  const clip = 'doodle-mark-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // The row fills 2.4%-97.6% across and 12%-88% down this box; the loop
  // stays outside both, the strike runs through the middle of the text line.
  const d = kind === 'circle'
    ? 'M 50 5 C 88 2, 100 28, 99.4 50 C 99 76, 76 97, 46 96 C 14 95, 0.6 76, 0.8 48 C 1 21, 22 6, 62 4'
    : 'M 3 56 C 20 42, 34 64, 52 49 S 82 42, 97 52';
  const drawn = Math.max(0, Math.min(1, progress));
  if (drawn <= 0) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        overflow: 'visible',
        ...(kind === 'circle'
          ? { top: '-16%', left: '-2.5%', width: '105%', height: '132%' }
          : { top: 0, left: '2%', width: '96%', height: '100%' }),
      }}
    >
      <defs>
        <clipPath id={clip} clipPathUnits="userSpaceOnUse">
          <rect x={-5} y={-10} width={110 * drawn} height={120} />
        </clipPath>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        clipPath={'url(#' + clip + ')'}
      />
    </svg>
  );
};
