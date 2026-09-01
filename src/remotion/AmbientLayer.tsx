import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { pickAmbient } from '../lib/ambient-pick';
import type { Theme } from '../lib/theme';
import type { QuizContent } from '../lib/types';
import { AMBIENTS, type AmbientArgs } from './ambient';
import { P5Sketch, type SketchArgs } from './P5Sketch';

/**
 * The living layer behind everything.
 *
 * Two decisions worth knowing about.
 *
 * It renders at half resolution and is scaled up with a transform. These are
 * soft, slow shapes - the upscale is invisible - and it turns a full-frame
 * canvas running on every one of nine thousand frames from something that would
 * dominate the render into something that barely registers.
 *
 * It sits OUTSIDE the scene Sequences, so its frame counter is the whole
 * video's. The motion therefore runs straight through every cut instead of
 * snapping back to the start eight times a minute, which is what would make it
 * read as a loop rather than as atmosphere.
 */
export const AmbientLayer: React.FC<{
  theme: Theme;
  content: QuizContent;
  /** A name from AMBIENTS, or 'auto' to choose one from the topic. */
  name: string;
  /** 0 to 1. The cap is deliberately low; see below. */
  intensity: number;
  width: number;
  height: number;
}> = ({ theme, content, name, intensity, width, height }) => {
  const chosen =
    name === 'auto'
      ? pickAmbient(content.subject, content.topic, content.question)
      : name;

  const def = AMBIENTS[chosen];

  const colors = { accent: theme.accent, text: theme.textDim, bg: theme.bg };
  const draw = useCallback(
    (args: SketchArgs) => def && def.draw({ ...args, colors, preset: chosen } as AmbientArgs),
    // Redrawn when the look or the palette changes, not on every frame.
    [def, chosen, colors.accent, colors.text, colors.bg],
  );

  if (!def) return null;

  const scale = 0.5;

  return (
    <AbsoluteFill
      style={{
        // Hard ceiling, whatever the slider says. A backdrop that competes
        // with a caption has failed at its only job, and every one of these is
        // drawn under text that has to stay readable at phone size. The cap was
        // checked by rendering captions over the busiest of them, not guessed.
        opacity: Math.max(0, Math.min(0.42, intensity * 0.42)),
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <P5Sketch
        draw={draw}
        width={Math.round(width * scale)}
        height={Math.round(height * scale)}
        style={{
          transform: 'scale(' + 1 / scale + ')',
          transformOrigin: 'top left',
        }}
      />
    </AbsoluteFill>
  );
};
