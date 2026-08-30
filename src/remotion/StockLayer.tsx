import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';

/**
 * The chosen photo, sitting behind everything the viewer actually reads.
 *
 * It is deliberately quiet: dimmed, slightly blurred, and covered by a scrim in
 * the theme's own background colour. A backdrop that competes with the
 * read-along text defeats the point of the read-along text.
 */
export const StockLayer: React.FC<{
  theme: Theme;
  src: string;
  opacity: number;
}> = ({ theme, src, opacity }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // A slow drift so a still photo does not look like a frozen frame.
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const scale = 1.12 - progress * 0.07;
  const shift = progress * 18 - 9;

  // Fade in and out with the scene so cuts are not jarring.
  const fade = interpolate(
    frame,
    [0, 10, Math.max(11, durationInFrames - 10), Math.max(12, durationInFrames)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Visibility is controlled by the scrim alone. Dimming the image *and* laying
  // a scrim over it multiplies the two, which buried the photo at about 8%.
  const strength = Math.min(0.8, Math.max(0.05, opacity));
  // The middle is where the text sits, so it keeps a little more cover.
  const centerAlpha = 1 - strength * 0.72;
  const edgeAlpha = 1 - strength;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: fade }}>
      <Img
        src={resolve(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scale(' + scale + ') translateY(' + shift + 'px)',
          filter: 'blur(1.5px) saturate(0.9)',
        }}
      />

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, ' +
            hexToRgba(theme.bg, centerAlpha) + ' 0%, ' +
            hexToRgba(theme.bg, centerAlpha) + ' 35%, ' +
            hexToRgba(theme.bg, edgeAlpha) + ' 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

function resolve(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return staticFile(src.replace(/^\/+/, ''));
}
