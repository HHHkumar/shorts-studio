// ---------------------------------------------------------------------------
// Key words stamped on screen as they are spoken ("300 MPs", "New Delhi").
//
// History videos get a comic stamp: tilted, outlined, slammed in. News gets a
// clean chip in the graphics' accent colour that wipes in from the side.
// Upper part of the frame, alternating sides, clear of the captions.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { GraphicTheme, ProjectKind, TimedBeat } from '../lib/types';
import { PALETTES } from './graphics/theme';

export const PopWord: React.FC<{ beat: TimedBeat; kind: ProjectKind; theme: GraphicTheme; portrait: boolean }> = ({ beat, kind, theme, portrait }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = beat.until - beat.at;
  const out = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const left = beat.n % 4 < 2;
  const side: React.CSSProperties = portrait
    ? { top: 330, left: 0, right: 0, justifyContent: 'center' }
    : { top: 96, ...(left ? { left: 110 } : { right: 110 }), justifyContent: left ? 'flex-start' : 'flex-end' };

  if (kind === 'news') {
    const p = PALETTES[theme] || PALETTES.night;
    const wipe = interpolate(frame, [0, 7], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const lift = interpolate(frame, [0, 9], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', display: 'flex', ...side, opacity: out }}>
          <div style={{
            transform: `translateY(${lift}px)`, clipPath: `inset(0 ${100 - wipe}% 0 0)`,
            background: p.accent, color: p.onInk, padding: portrait ? '16px 30px' : '14px 30px', borderRadius: 6,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", fontWeight: 800, fontSize: portrait ? 64 : 58,
            letterSpacing: 0.5, boxShadow: '0 10px 30px rgba(0,0,0,0.45)', maxWidth: portrait ? 900 : 1100,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {beat.text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  const slam = spring({ frame, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  const scale = interpolate(slam, [0, 1], [1.9, 1]);
  const tilt = (beat.n % 2 ? 1 : -1) * 3.5;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', display: 'flex', ...side, opacity: Math.min(1, slam * 3) * out }}>
        <div style={{
          transform: `rotate(${tilt}deg) scale(${scale})`, transformOrigin: 'center',
          fontFamily: "Impact, 'Arial Black', 'Trebuchet MS', sans-serif", fontSize: portrait ? 104 : 112, lineHeight: 1,
          textTransform: 'uppercase', letterSpacing: 2, color: '#ffd23f',
          WebkitTextStroke: '10px #1a1206', paintOrder: 'stroke fill', textShadow: '0 8px 0 rgba(0,0,0,0.35), 0 14px 30px rgba(0,0,0,0.5)',
          maxWidth: portrait ? 980 : 1300, textAlign: 'center',
        }}>
          {beat.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
