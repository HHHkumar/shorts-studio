import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Theme } from '../../lib/theme';

/** What every family's artwork is given: the theme, the box, and whether the answer may show. */
export type ArtProps = { theme: Theme; reveal: boolean; w: number; h: number; font: number; highlight?: string };

export const STROKE = 5;

/** Parts arrive one after another, over about a second. A pure function of the frame. */
export function useStagger(): (i: number) => number {
  const frame = useCurrentFrame();
  return (i) => Math.max(0, Math.min(1, (frame - 6 - i * 3) / 8));
}

/** The one line under a figure that says what is asked, and then what it is. */
export const Footer: React.FC<{ theme: Theme; w: number; h: number; font: number; text: string; reveal: boolean; opacity: number }> = ({
  theme, w, h, font, text, reveal, opacity,
}) => (
  <text
    x={w / 2}
    y={h - font * 0.6}
    textAnchor="middle"
    fontFamily={theme.fontBody}
    fontWeight={700}
    fontSize={font * 0.92}
    fill={reveal ? theme.accent : theme.textDim}
    opacity={opacity}
  >
    {text}
  </text>
);

/** A filled triangular arrowhead at (x, y) pointing along (dx, dy). */
export const ArrowHead: React.FC<{ x: number; y: number; dx: number; dy: number; size?: number; fill: string }> = ({
  x, y, dx, dy, size = 20, fill,
}) => {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const back = { x: x - ux * size, y: y - uy * size };
  const pts = [
    [x, y],
    [back.x - uy * size * 0.55, back.y + ux * size * 0.55],
    [back.x + uy * size * 0.55, back.y - ux * size * 0.55],
  ];
  return <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={fill} />;
};

export const polyline = (pts: [number, number][]) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
