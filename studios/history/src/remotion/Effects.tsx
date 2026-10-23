// ---------------------------------------------------------------------------
// Atmosphere: the small moving touches that make a still picture feel alive -
// heat shimmer over a desert, dust in a sunbeam, embers over a forge.
//
// Every effect is a pure function of the frame. Remotion renders frames out of
// order and in parallel, so nothing here may use Math.random() or remember
// anything between frames: a speck that moved randomly would flicker.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Effect } from '../lib/types';
import { hash } from './noise';

export { hash };

/** Smooth-ish noise over time, 0..1. */
function wobble(seed: number, t: number): number {
  return 0.5 + 0.25 * Math.sin(t * 1.7 + seed * 12.9) + 0.25 * Math.sin(t * 3.1 + seed * 4.1);
}

const W = 1920;
const H = 1080;

const Particles: React.FC<{ kind: 'dust' | 'embers' | 'snow' | 'rain'; seed: number }> = ({ kind, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const count = kind === 'rain' ? 140 : kind === 'snow' ? 110 : kind === 'embers' ? 55 : 45;
  const items: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    const a = hash(seed * 1000 + i * 3);
    const b = hash(seed * 1000 + i * 3 + 1);
    const c = hash(seed * 1000 + i * 3 + 2);
    if (kind === 'dust') {
      const x = (a * W + Math.sin(t * 0.3 + c * 6) * 40 + t * 8) % W;
      const y = (b * H + Math.cos(t * 0.25 + a * 6) * 30 - t * 5 + H) % H;
      const r = 1.5 + c * 3;
      items.push(<circle key={i} cx={x} cy={y} r={r} fill="#fff6dc" opacity={0.18 + 0.4 * wobble(c, t)} />);
    } else if (kind === 'embers') {
      const speed = 40 + c * 90;
      const y = H - ((b * H + t * speed) % (H + 40));
      const x = a * W + Math.sin(t * (0.8 + c) + a * 10) * 30;
      const r = 1.5 + c * 2.8;
      items.push(<circle key={i} cx={x} cy={y} r={r} fill={c > 0.5 ? '#ffb347' : '#ff6a2a'} opacity={0.35 + 0.6 * wobble(a, t * 3)} />);
    } else if (kind === 'snow') {
      const speed = 30 + c * 60;
      const y = (b * H + t * speed) % (H + 20);
      const x = (a * W + Math.sin(t * 0.9 + c * 8) * 25 + W) % W;
      items.push(<circle key={i} cx={x} cy={y} r={1.5 + c * 3.5} fill="#ffffff" opacity={0.5 + 0.4 * c} />);
    } else {
      const speed = 900 + c * 500;
      const y = (b * (H + 200) + t * speed) % (H + 200) - 100;
      const x = (a * (W + 300) - (y * 0.25)) % (W + 300);
      items.push(<line key={i} x1={x} y1={y} x2={x - 10} y2={y + 38 + c * 20} stroke="#dfe8ff" strokeWidth={1.4} opacity={0.25 + 0.25 * c} />);
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: kind === 'rain' || kind === 'snow' ? 'normal' : 'screen' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {kind === 'embers' ? (
          <defs>
            <filter id={'glow' + seed}><feGaussianBlur stdDeviation="2.5" /></filter>
          </defs>
        ) : null}
        <g filter={kind === 'embers' ? `url(#glow${seed})` : undefined}>{items}</g>
      </svg>
    </AbsoluteFill>
  );
};

const Fog: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const blobs = [0, 1, 2, 3].map((i) => {
    const x = ((hash(seed + i) * 140 - 20 + t * (2 + i)) % 160) - 30;
    const y = 45 + hash(seed + i + 10) * 45;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x + '%',
          top: y + '%',
          width: '75%',
          height: '55%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(235,235,240,0.55) 0%, rgba(235,235,240,0) 65%)',
          filter: 'blur(30px)',
        }}
      />
    );
  });
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.7 }}>{blobs}</AbsoluteFill>;
};

const Flicker: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const level = 0.55 + 0.3 * Math.sin(t * 7 + seed) * Math.sin(t * 2.3) + 0.15 * Math.sin(t * 17.1 + seed * 3);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 70%, rgba(255,160,60,0.55) 0%, rgba(255,120,30,0.15) 45%, rgba(20,8,0,0.35) 100%)',
        mixBlendMode: 'soft-light',
        opacity: Math.max(0.2, Math.min(1, level)),
      }}
    />
  );
};

/** Drawn over the picture, inside the scene. */
export const EffectLayer: React.FC<{ effect: Effect; seed: number }> = ({ effect, seed }) => {
  switch (effect) {
    case 'dust':
    case 'embers':
    case 'snow':
    case 'rain':
      return (
        <>
          {effect === 'rain' ? <AbsoluteFill style={{ background: 'rgba(20,30,50,0.22)' }} /> : null}
          <Particles kind={effect} seed={seed} />
        </>
      );
    case 'fog':
      return <Fog seed={seed} />;
    case 'flicker':
      return <Flicker seed={seed} />;
    case 'heat':
      // The shimmer itself distorts the picture (see HeatFilter); this is the warm air.
      return (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(255,170,80,0.18), rgba(255,200,120,0) 60%)',
            mixBlendMode: 'screen',
          }}
        />
      );
    default:
      return null;
  }
};

/**
 * Heat shimmer: the picture itself is displaced by slowly changing noise,
 * strongest near the ground. Returned as an SVG <filter> the picture opts into.
 */
export const HeatFilter: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const fy = 0.05 + 0.004 * Math.sin(t * 2.2);
  const fx = 0.006 + 0.001 * Math.sin(t * 1.3 + 1);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={`${fx} ${fy}`} numOctaves={2} seed={4} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={9} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
};

/**
 * Breeze: the picture is pushed back and forth by a fixed, smooth noise field
 * whose strength swings either way - so foliage, cloth and grass sway in place
 * instead of crawling. Stronger near the bottom of a tree than its trunk is
 * not something a filter can know, so it is kept gentle everywhere.
 */
export const BreezeFilter: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const sway = 5 * Math.sin(t * 1.25) + 2.2 * Math.sin(t * 2.7 + 1) + 1 * Math.sin(t * 4.3 + 2);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves={2} seed={9} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={sway} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
};

/** Film grain over the whole video. A handful of fixed noise frames, cycled. */
export const Grain: React.FC<{ amount: number }> = ({ amount }) => {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;
  const seed = frame % 6;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: Math.min(0.5, amount * 0.35), mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%">
        <filter id={'grain' + seed}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed + 1} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ amount: number }> = ({ amount }) =>
  amount <= 0 ? null : (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${Math.min(0.85, amount * 0.9)}) 100%)`,
      }}
    />
  );
