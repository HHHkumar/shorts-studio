// ---------------------------------------------------------------------------
// The YouTube thumbnail: 1280x720, one still.
//
// What works on YouTube for this genre, and what this does: one clear picture,
// three or four huge words with one of them in a loud colour, a thick black
// outline so the words survive being shrunk to a phone's list view, and - if
// the shot has one - the cut-out character big on the other side, glowing.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { Layer, Point } from '../lib/types';
import { HandFonts } from './fonts';
import { resolveSrc } from './media';

export type ThumbnailProps = {
  image: string;
  focus: Point;
  text: string;
  highlight: string;
  accent: string;
  side: 'left' | 'right';
  layer: Layer | null;
};

export const THUMB_W = 1280;
export const THUMB_H = 720;

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const Thumbnail: React.FC<ThumbnailProps> = ({ image, focus, text, highlight, accent, side, layer }) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const hot = new Set(highlight.trim().split(/\s+/).map(bare).filter(Boolean));
  const long = text.length > 26;
  const left = side === 'left';
  return (
    <AbsoluteFill style={{ backgroundColor: '#111' }}>
      <HandFonts />
      {image ? (
        <Img src={resolveSrc(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focus.x * 100}% ${focus.y * 100}%`, transform: 'scale(1.06)', filter: 'saturate(1.25) contrast(1.08)' }} />
      ) : null}
      <AbsoluteFill style={{ background: `linear-gradient(${left ? 90 : 270}deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 70%)` }} />
      {layer && layer.image ? (
        <Img
          src={resolveSrc(layer.image)}
          style={{
            position: 'absolute', bottom: -20, [left ? 'right' : 'left']: 20, height: '108%',
            transform: layer.flip ? 'scaleX(-1)' : undefined,
            filter: 'drop-shadow(0 0 6px #fff) drop-shadow(0 0 3px #fff) drop-shadow(0 18px 24px rgba(0,0,0,.6))',
          }}
        />
      ) : null}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: left ? 'flex-start' : 'flex-end', padding: '0 56px' }}>
        <div
          style={{
            maxWidth: layer && layer.image ? '58%' : '70%',
            textAlign: left ? 'left' : 'right',
            fontFamily: "Impact, 'Arial Black', 'Segoe UI Black', sans-serif",
            fontSize: long ? 104 : 136,
            lineHeight: 0.98,
            textTransform: 'uppercase',
            color: '#fff',
            WebkitTextStroke: '14px #000',
            paintOrder: 'stroke fill',
            textShadow: '0 10px 0 rgba(0,0,0,.35)',
            transform: `rotate(${left ? -2 : 2}deg)`,
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: hot.has(bare(w)) ? accent : '#fff' }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
