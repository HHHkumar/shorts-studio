import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { DASH, GAP, flowOffset, type PartFlow } from '../../lib/figures/circuit-flow.ts';

// ---------------------------------------------------------------------------
// A solved circuit, alive: current flowing along the wires and lamps lit by
// the power they really take. The numbers are src/lib/figures/circuit-flow.ts;
// this is only the drawing, in the theme's own colours - the accent is the
// current and the light, so in the Doodle look they are the marker red that
// already means "live".
// ---------------------------------------------------------------------------

/**
 * A wire, or a lead of a part, with its current flowing along it as a train
 * of dots. With no flow - a branch that carries nothing, or a circuit not yet
 * switched on - it is the plain line it always was.
 */
export const AnimatedWirePath: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The wire's own colour. */
  colour: string;
  /** The current's colour: the theme accent. */
  flowColour: string;
  /** Used for the dots instead when the wire itself is drawn in the accent. */
  bg: string;
  flow: PartFlow | null;
  ac: boolean;
  /** 0 to 1: how far the circuit has switched on. */
  on: number;
  strokeWidth: number;
}> = ({ x1, y1, x2, y2, colour, flowColour, bg, flow, ac, on, strokeWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
  );
  if (!flow || on <= 0 || Math.hypot(x2 - x1, y2 - y1) < 1) return line;
  // An accent wire (the part the question is about) would hide accent dots.
  const dots = colour === flowColour ? bg : flowColour;
  return (
    <g>
      {line}
      <path
        d={'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2}
        fill="none"
        stroke={dots}
        strokeWidth={strokeWidth + 6}
        strokeLinecap="round"
        strokeDasharray={DASH + ' ' + GAP}
        strokeDashoffset={flowOffset(flow, ac, frame, fps)}
        opacity={on}
      />
    </g>
  );
};

/**
 * The lamp: the standard circle-and-cross an exam uses, which lights up. Its
 * glow and the colour of its cross follow `brightness` - the lamp's power
 * against the brightest lamp in the circuit - so of two lamps the one taking
 * more power visibly shines more. Drawn centred on the origin along +x, as
 * every symbol in Figure.tsx is.
 */
export const GlowingLampSymbol: React.FC<{
  half: number;
  colour: string;
  bg: string;
  /** The light's colour: the theme accent. */
  glow: string;
  /** 0 to 1, from circuitFlow(). */
  brightness: number;
  /** 0 to 1: how far the circuit has switched on. */
  on: number;
  strokeWidth: number;
}> = ({ half, colour, bg, glow, brightness, on, strokeWidth }) => {
  // One gradient per lamp: two lamps in one figure must not share an id.
  const id = 'lamp-glow-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const r = Math.min(30, half);
  const k = r * 0.7;
  const lit = Math.max(0, Math.min(1, brightness)) * Math.max(0, Math.min(1, on));
  const cross = lit > 0.15 ? glow : colour;
  const lead = { stroke: colour, strokeWidth, strokeLinecap: 'round' as const };
  return (
    <g>
      {lit > 0 ? (
        <>
          <defs>
            <radialGradient id={id}>
              <stop offset="0%" stopColor={glow} stopOpacity={0.55} />
              <stop offset="45%" stopColor={glow} stopOpacity={0.22} />
              <stop offset="100%" stopColor={glow} stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* A gradient, not a blur filter: the same look, and cheap to render every frame. */}
          <circle r={r * (1.5 + 1.9 * lit)} fill={'url(#' + id + ')'} opacity={lit} />
        </>
      ) : null}
      <line x1={-half} y1={0} x2={-r} y2={0} {...lead} />
      <line x1={r} y1={0} x2={half} y2={0} {...lead} />
      <circle r={r} fill={bg} stroke={colour} strokeWidth={strokeWidth} />
      {lit > 0 ? <circle r={r - strokeWidth / 2} fill={glow} opacity={0.22 * lit} /> : null}
      <line x1={-k} y1={-k} x2={k} y2={k} stroke={cross} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={-k} y1={k} x2={k} y2={-k} stroke={cross} strokeWidth={strokeWidth} strokeLinecap="round" />
    </g>
  );
};
