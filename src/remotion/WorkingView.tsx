import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { mathWidth, parseMath } from '../lib/formula-card';
import { useMetrics } from './ui';
import { MathText } from './MathText';
import { DoodleMark } from './DoodleInk';

// ---------------------------------------------------------------------------
// The worked solution, written in the way a teacher writes it on the board:
// the formula, then the question's numbers put in, then each step, one line
// at a time across the scene, ending on the answer - which is boxed, or in
// the Doodle look ringed in marker.
//
// The newest line arrives in the accent colour and settles into ink as the
// next one comes, so the eye always knows which step is being said. Spread
// evenly over the scene's own length: the narration explains the steps in
// order, and a line per step lands close enough to its words to follow.
// ---------------------------------------------------------------------------

export const WorkingView: React.FC<{ theme: Theme; lines: string[] }> = ({ theme, lines }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const m = useMetrics();
  if (!lines.length) return null;

  const available = width - m.padX * 2 - 40;
  const widest = Math.max(...lines.map((l) => mathWidth(parseMath(l))));
  const size = Math.max(30, Math.min(m.landscape ? 90 : 110, available / Math.max(1, widest * 1.18)));
  // First line straight away; the answer lands by about three-quarters in.
  const first = 6;
  const step = Math.max(12, (durationInFrames * 0.72 - first) / Math.max(1, lines.length - 1));
  const doodle = theme.layout === 'doodle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: size * 0.28, width: '100%', paddingLeft: 20 }}>
      {lines.map((line, i) => {
        const at = first + i * step;
        const enter = spring({ frame: frame - at, fps, config: { damping: 16, stiffness: 120 } });
        if (frame < at) return <div key={i} style={{ height: size * 1.4 }} />;
        const newest = i === lines.length - 1 || frame < first + (i + 1) * step;
        const last = i === lines.length - 1;
        // The accent fades back to ink once the next line has arrived.
        const settled = last ? 0 : interpolate(frame, [first + (i + 1) * step, first + (i + 1) * step + 10], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const ring = last ? interpolate(frame, [at + 12, at + 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              opacity: enter,
              transform: 'translateX(' + (1 - enter) * 40 + 'px)',
              padding: last && !doodle ? '0.12em 0.4em' : '0 0.2em',
              border: last && !doodle ? Math.max(3, size * 0.05) + 'px solid ' + theme.correct : undefined,
              borderRadius: last ? 12 : 0,
              marginLeft: i > 0 ? size * 0.9 : 0,
            }}
          >
            <MathText
              theme={theme}
              src={line}
              size={size}
              color={last ? theme.correct : newest && settled < 0.5 ? theme.accent : theme.text}
            />
            {last && doodle ? <DoodleMark kind="circle" color={theme.correct} progress={ring} /> : null}
          </div>
        );
      })}
    </div>
  );
};
