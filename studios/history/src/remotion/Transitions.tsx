// ---------------------------------------------------------------------------
// How a scene arrives.
//
// Scenes overlap by `fadeFrames` and the arriving one is drawn on top, so
// every transition is written from the arriving scene's side: how much of it
// to show, and anything laid over both pictures while it happens (a flash, a
// dip to black). The leaving picture is simply what is underneath.
//
// The ink blot and paper tear use clip-path polygons rather than masks:
// Chrome clips HTML with a polygon reliably, and a polygon's wobbly edge is
// just maths, the same on every frame of every render.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Transition } from '../lib/types';
import { blob, hash } from './noise';

export interface Arrival {
  style: React.CSSProperties;
  /** Drawn over the arriving picture (and therefore over the leaving one too). */
  overlay: React.ReactNode;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));

const polygon = (pts: [number, number][]) => 'polygon(' + pts.map(([x, y]) => x.toFixed(2) + '% ' + y.toFixed(2) + '%').join(', ') + ')';

/** The torn edge of the paper at progress p: x in % for each y. Deterministic zigzag. */
function tornEdge(p: number, seed: number): [number, number][] {
  const edge: [number, number][] = [];
  const steps = 40;
  const base = -12 + p * 124;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * 100;
    const jag = (hash(seed * 131 + i) - 0.5) * 5 + Math.sin(i * 0.9 + seed) * 2;
    edge.push([base + jag + (y - 50) * 0.08, y]);
  }
  return edge;
}

export function arrival(kind: Exclude<Transition, 'auto'>, frame: number, span: number, seed: number): Arrival {
  if (span <= 0 || frame >= span || kind === 'cut') return { style: {}, overlay: null };
  const p = clamp01(frame / span);
  const e = easeInOut(p);

  switch (kind) {
    case 'crossfade':
      return { style: { opacity: e }, overlay: null };

    case 'ink': {
      // A blot spreads from just off-centre until it covers the frame.
      const r = e * 95;
      return { style: { clipPath: polygon(blob(52, 48, r * 1.25, r * 1.35, seed, 0.16, 56)) }, overlay: null };
    }

    case 'paper': {
      // The new picture is revealed behind a torn edge sweeping across, with a strip of paper on the edge.
      const edge = tornEdge(e, seed);
      const reveal = polygon([[-5, -5], ...edge.map(([x, y]) => [x, y] as [number, number]), [-5, 105]]);
      const strip = polygon([...edge, ...edge.map(([x, y]) => [x + 1.6, y] as [number, number]).reverse()]);
      return {
        style: { clipPath: reveal },
        overlay: <AbsoluteFill style={{ clipPath: strip, background: '#efe2c4', boxShadow: 'inset 0 0 6px rgba(0,0,0,.4)' }} />,
      };
    }

    case 'page':
      return { style: { transform: `translateX(${(1 - e) * 100}%)`, boxShadow: '-40px 0 60px rgba(0,0,0,0.55)' }, overlay: null };

    case 'whip':
      return { style: { transform: `translateX(${(1 - e) * 100}%)`, filter: `blur(${Math.sin(Math.PI * p) * 26}px)` }, overlay: null };

    case 'flash':
      return {
        style: { opacity: p < 0.5 ? 0 : 1 },
        overlay: <AbsoluteFill style={{ background: '#fffaf0', opacity: 1 - Math.abs(p - 0.5) * 2 }} />,
      };

    case 'dip':
      return {
        style: { opacity: p < 0.5 ? 0 : 1 },
        overlay: <AbsoluteFill style={{ background: '#000', opacity: 1 - Math.abs(p - 0.5) * 2 }} />,
      };

    default:
      return { style: {}, overlay: null };
  }
}

/** Transitions that deserve a whoosh. */
export const WHOOSHES: Transition[] = ['ink', 'paper', 'page', 'whip', 'flash'];
