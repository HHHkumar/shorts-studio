// ---------------------------------------------------------------------------
// How a solved circuit moves on screen: the current flowing along each part,
// and how bright each lamp is. Pure numbers from solveCircuit(); the drawing
// is src/remotion/figures/CircuitFlow.tsx.
//
// Three decisions, each of which the obvious version gets wrong:
//
//   Speed is relative to the biggest current in the circuit, not so many
//   pixels per ampere. Per ampere, a milliamp circuit never visibly moves and
//   a twenty-amp one runs so fast the dashes strobe - past half the dash
//   pattern per frame the eye sees them crawl backwards. Relative speed shows
//   what the picture is for: this branch carries twice what that one does.
//
//   The dots follow conventional current, + to -, the way every arrow in the
//   question and every textbook draws it. Electron drift runs the other way,
//   and on an exam channel a picture that contradicts the arrows is wrong.
//
//   AC does not drift. It rocks back and forth, each branch with its own
//   phase - so a capacitor's current visibly leads and an inductor's lags.
// ---------------------------------------------------------------------------

import { magnitude, type Circuit, type CircuitSolution } from './circuit.ts';

/**
 * The flow pattern: round beads, well spaced. A dash of 1 with round caps is
 * a dot the width of the stroke; 7px dashes read as a dashed wire, not as
 * something moving along one.
 */
export const DASH = 1;
export const GAP = 27;
export const PERIOD = DASH + GAP;

/** Pixels a frame. The fastest stays well under PERIOD / 2, where the eye loses the direction. */
export const MIN_SPEED = 1.6;
export const MAX_SPEED = 8;

/** How far AC dots swing either way, at the biggest current, in pixels. */
export const AC_SWING = 26;
/** How fast AC dots swing, in cycles a second. Slow: the real 50 Hz would be a blur. */
export const AC_RATE = 0.7;

/** Below this share of the biggest current, a part is treated as carrying none. */
const NEGLIGIBLE = 0.01;

/**
 * Below this, in amperes or watts, it is the solver's rounding, not a
 * current. A capacitor on DC "passes" about 1e-15 A; measured against
 * itself that noise was the biggest current in the circuit, and flowed at
 * full speed through a part that blocks.
 */
const NOISE = 1e-9;

export interface PartFlow {
  /** 0 to 1: this part's current against the biggest in the circuit. */
  share: number;
  /** +1 when the current runs from the part's `from` to its `to`, -1 the other way. DC only. */
  direction: 1 | -1;
  /** The current's phase, in radians. AC only. */
  phase: number;
}

export interface CircuitFlow {
  ac: boolean;
  parts: Record<string, PartFlow>;
  /** 0 to 1 for each lamp: its brightness against the brightest lamp. */
  lamps: Record<string, number>;
}

/**
 * The flow in every part and the glow of every lamp, or null when the
 * circuit does not solve (there is then nothing honest to animate).
 */
export function circuitFlow(circuit: Circuit, solution: CircuitSolution | null): CircuitFlow | null {
  if (!solution) return null;
  const ac = circuit.frequency > 0;
  const amps = (id: string) => {
    const r = solution.elements[id];
    return r ? magnitude(r.current) : 0;
  };
  const biggest = Math.max(0, ...circuit.elements.map((e) => amps(e.id)).filter(Number.isFinite));

  const parts: Record<string, PartFlow> = {};
  for (const e of circuit.elements) {
    const r = solution.elements[e.id];
    if (!r || !(biggest > NOISE)) continue;
    const share = amps(e.id) / biggest;
    if (!Number.isFinite(share) || share < NEGLIGIBLE) continue;
    parts[e.id] = {
      share: Math.min(1, share),
      direction: r.current.re >= 0 ? 1 : -1,
      phase: Math.atan2(r.current.im, r.current.re),
    };
  }

  // Brightness against the brightest lamp, as the square root of power: the
  // eye judges light roughly that way, so a lamp on a quarter of the power
  // looks half as bright, not a quarter.
  const lampPower = circuit.elements
    .filter((e) => e.kind === 'lamp')
    .map((e) => ({ id: e.id, watts: Math.max(0, solution.elements[e.id]?.power ?? 0) }));
  const brightest = Math.max(0, ...lampPower.map((l) => l.watts));
  const lamps: Record<string, number> = {};
  for (const l of lampPower) {
    lamps[l.id] = brightest > NOISE && l.watts / brightest >= NEGLIGIBLE * NEGLIGIBLE ? Math.sqrt(l.watts / brightest) : 0;
  }

  return { ac, parts, lamps };
}

/** How fast a DC part's dots travel, in pixels a frame. */
export function speedFor(share: number): number {
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.max(0, Math.min(1, share));
}

/**
 * The stroke-dashoffset for a part's dots at this moment. A pure function of
 * the frame, so any frame renders the same whether played or sought.
 *
 * A falling offset moves dashes along the path, from its start to its end -
 * and every part is drawn from its `from` node to its `to`.
 */
export function flowOffset(flow: PartFlow, ac: boolean, frame: number, fps: number): number {
  if (ac) {
    const t = frame / fps;
    return -AC_SWING * flow.share * Math.sin(2 * Math.PI * AC_RATE * t + flow.phase);
  }
  return -frame * speedFor(flow.share) * flow.direction;
}
