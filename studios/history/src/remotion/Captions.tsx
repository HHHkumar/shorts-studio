// ---------------------------------------------------------------------------
// Burnt-in captions, a phrase at a time, like the reference video.
//
// A long-form video cannot show a whole sentence at once - it would cover the
// picture - so the scene's words are grouped into short phrases that break at
// punctuation where they can. The phrase on screen is the one being spoken;
// in karaoke mode the word being said is picked out in gold.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { phrases } from '../lib/captions';
import type { CaptionMode, Word } from '../lib/types';

export const Captions: React.FC<{ words: Word[]; mode: CaptionMode; size: number; portrait?: boolean }> = ({ words, mode, size, portrait = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (mode === 'off' || !words.length) return null;

  const t = frame / fps;
  const list = phrases(words);
  const phrase = list.find((p) => t >= p.start - 0.05 && t < p.end);
  if (!phrase) return null;

  const since = (t - phrase.start) * fps;
  const pop = interpolate(since, [0, 4], [0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(since, [0, 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  if (mode === 'boxed') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: portrait ? 430 : 56, pointerEvents: 'none' }}>
        <div style={{
          maxWidth: portrait ? '88%' : '72%', textAlign: 'center', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 600, fontSize: Math.round(size * 0.8), lineHeight: 1.3, color: '#ffffff', background: 'rgba(0,0,0,0.72)',
          padding: '0.18em 0.55em', borderRadius: 6, opacity: fade, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
        }}>
          {phrase.words.map((w) => w.word).join(' ')}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: portrait ? 430 : 70, pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth: portrait ? '88%' : '78%',
          textAlign: 'center',
          fontFamily: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.18,
          color: '#ffffff',
          WebkitTextStroke: Math.max(2, size / 18) + 'px #000',
          paintOrder: 'stroke fill',
          textShadow: '0 4px 14px rgba(0,0,0,0.65)',
          transform: `scale(${pop})`,
          opacity: fade,
        }}
      >
        {phrase.words.map((w, i) => {
          const active = mode === 'karaoke' && t >= w.start && t < (phrase.words[i + 1]?.start ?? phrase.end);
          return (
            <span key={i} style={{ color: active ? '#ffd54a' : '#ffffff' }}>
              {w.word}
              {i < phrase.words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
