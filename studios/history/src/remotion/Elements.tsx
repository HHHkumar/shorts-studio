// ---------------------------------------------------------------------------
// Animated elements: the small living things that make a painting breathe -
// smoke curling from a chimney, birds crossing the sky, glints on a river.
//
// They are drawn in the PICTURE's coordinates (inside the camera move), so the
// smoke stays on its chimney as the camera pushes in. Every one is a pure
// function of the frame - no Math.random(), no state - because Remotion draws
// frames out of order and in parallel.
// ---------------------------------------------------------------------------

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { AnimElement } from '../lib/types';
import { hash } from './noise';

type Box = { w: number; h: number };

const frac = (v: number) => v - Math.floor(v);
const tri = (v: number) => Math.sin(v);

/** Deterministic per-element seed from its id. */
function seedOf(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 100000;
}

const Smoke: React.FC<{ e: AnimElement; t: number; box: Box; steam?: boolean }> = ({ e, t, box, steam }) => {
  const s = e.size * box.w;
  const n = steam ? 10 : 16;
  const speed = steam ? 0.45 : 0.16;
  const seed = seedOf(e.id);
  const puffs: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const ph = frac(t * speed + i / n + hash(seed + i) * 0.05);
    const rise = ph * s * (steam ? 1.8 : 2.6);
    const sway = Math.sin(ph * 4 + i * 1.7 + t * 0.6) * s * 0.12 * ph + ph * ph * s * 0.35 * Math.cos((e.angle * Math.PI) / 180);
    const r = s * (steam ? 0.12 : 0.16) * (0.5 + ph * (steam ? 1.6 : 2.2));
    const a = Math.min(0.9, Math.sin(Math.PI * Math.min(1, ph * 1.15)) * (steam ? 0.55 : 0.72) * e.intensity);
    const tone = steam ? '248,248,250' : '150,146,148';
    puffs.push(
      <div
        key={i}
        style={{
          position: 'absolute', left: sway - r, top: -rise - r, width: r * 2, height: r * 2, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${tone},${a.toFixed(3)}) 0%, rgba(${tone},${(a * 0.45).toFixed(3)}) 45%, rgba(${tone},0) 72%)`,
        }}
      />,
    );
  }
  return <div style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, filter: `blur(${steam ? 2 : 3}px)` }}>{puffs}</div>;
};

const Fire: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const s = e.size * box.w;
  const seed = seedOf(e.id);
  const flick = (k: number) => 0.85 + 0.1 * Math.sin(t * 13 + k) + 0.07 * Math.sin(t * 23.3 + k * 2) + 0.05 * Math.sin(t * 7.1 + k * 3);
  const flame = (scale: number, colour: string, k: number) => {
    const h = s * 1.6 * scale * flick(k);
    const w = s * 0.7 * scale;
    const lean = Math.sin(t * 5 + k) * w * 0.18;
    return (
      <path
        key={k}
        d={`M ${-w / 2} 0 C ${-w / 2} ${-h * 0.45}, ${lean - w * 0.1} ${-h * 0.7}, ${lean} ${-h} C ${lean + w * 0.1} ${-h * 0.7}, ${w / 2} ${-h * 0.45}, ${w / 2} 0 Z`}
        fill={colour}
      />
    );
  };
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const ph = frac(t * 0.9 + hash(seed + i));
    return (
      <circle key={'s' + i} cx={Math.sin(ph * 6 + i) * s * 0.3} cy={-s * 0.6 - ph * s * 2.2} r={Math.max(0.8, s * 0.025 * (1 - ph))}
        fill="#ffcf6a" opacity={(1 - ph) * e.intensity} />
    );
  });
  const glow = s * 3.2;
  return (
    <div style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h }}>
      <div style={{
        position: 'absolute', left: -glow, top: -glow * 1.15, width: glow * 2, height: glow * 2, borderRadius: '50%', mixBlendMode: 'screen',
        background: `radial-gradient(circle, rgba(255,170,70,${(0.42 * e.intensity * flick(9)).toFixed(3)}) 0%, rgba(255,120,30,0.12) 40%, rgba(255,100,20,0) 70%)`,
      }} />
      <svg style={{ position: 'absolute', overflow: 'visible', left: 0, top: 0 }} width="1" height="1">
        <g style={{ filter: 'blur(1px)' }}>
          {flame(1, '#e8501f', 1)}
          {flame(0.75, '#ff9a2e', 2)}
          {flame(0.45, '#ffe58a', 3)}
        </g>
        {sparks}
      </svg>
    </div>
  );
};

const Glow: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const r = e.size * box.w;
  const k = seedOf(e.id) % 7;
  const level = 0.75 + 0.12 * Math.sin(t * 9 + k) + 0.08 * Math.sin(t * 17 + k * 2) + 0.05 * Math.sin(t * 3.3);
  return (
    <div style={{
      position: 'absolute', left: e.x * box.w - r, top: e.y * box.h - r, width: r * 2, height: r * 2, borderRadius: '50%', mixBlendMode: 'screen',
      background: `radial-gradient(circle, rgba(255,196,110,${(0.55 * e.intensity * level).toFixed(3)}) 0%, rgba(255,150,60,${(0.2 * e.intensity * level).toFixed(3)}) 35%, rgba(255,140,50,0) 70%)`,
    }} />
  );
};

const Birds: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const n = Math.max(3, Math.round(4 + e.intensity * 3));
  const ang = (e.angle * Math.PI) / 180;
  const speed = box.w * 0.035;
  const spread = e.size * box.w;
  const span = box.w * 1.3;
  const birds: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const ox = (hash(seed + i * 3) - 0.5) * spread;
    const oy = (hash(seed + i * 3 + 1) - 0.5) * spread * 0.45;
    // Travel along the angle, wrapping round so the flock keeps crossing.
    const along = ((t * speed * (0.9 + hash(seed + i) * 0.2) + ox + span * 10) % span) - span * 0.15;
    const x = e.x * box.w - box.w * 0.15 + Math.cos(ang) * along;
    const y = e.y * box.h + oy + Math.sin(ang) * along + Math.sin(t * 1.3 + i) * 6;
    const flap = Math.sin(t * (9 + hash(seed + i * 5) * 3) + i * 2);
    const w = box.w * 0.012 * (0.8 + hash(seed + i * 7) * 0.5);
    birds.push(
      <path key={i} d={`M ${x - w} ${y - flap * w * 0.6} Q ${x - w * 0.45} ${y - w * 0.2} ${x} ${y} Q ${x + w * 0.45} ${y - w * 0.2} ${x + w} ${y - flap * w * 0.6}`}
        stroke="#2a2018" strokeWidth={Math.max(2, w * 0.18)} fill="none" strokeLinecap="round" opacity={0.85 * Math.min(1, e.intensity + 0.3)} />,
    );
  }
  return <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={box.w} height={box.h}>{birds}</svg>;
};

const Clouds: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const w = e.size * box.w;
  const span = box.w + w * 2;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const x = ((e.x * box.w + t * box.w * 0.006 * (1 + i * 0.3) + hash(seed + i) * span) % span) - w;
        const y = e.y * box.h + (hash(seed + i * 9) - 0.5) * w * 0.25;
        const cw = w * (0.6 + hash(seed + i * 4) * 0.5);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y - cw * 0.18, width: cw, height: cw * 0.36, filter: 'blur(14px)', opacity: 0.55 * e.intensity }}>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{
                position: 'absolute', left: (k * 22 + hash(seed + i * 10 + k) * 8) + '%', top: (k % 2 ? 22 : 8) + '%', width: '42%', height: '80%', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 72%)',
              }} />
            ))}
          </div>
        );
      })}
    </>
  );
};

const SunRays: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const len = e.size * box.w;
  const n = 9;
  const turn = Math.sin(t * 0.25) * 4;
  return (
    <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible', mixBlendMode: 'screen' }} width="1" height="1">
      <defs>
        <radialGradient id={'ray' + e.id} cx="0" cy="0" r={len} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff4cc" stopOpacity={0.55 * e.intensity} />
          <stop offset="1" stopColor="#fff4cc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={`rotate(${turn})`}>
        {Array.from({ length: n }, (_, i) => {
          const a = ((i / n) * 360 + hash(seedOf(e.id) + i) * 14) * (Math.PI / 180);
          const wid = 0.05 + hash(seedOf(e.id) + i * 3) * 0.06;
          const pulse = 0.55 + 0.45 * Math.sin(t * (0.6 + i * 0.13) + i);
          const p = (k: number) => `${Math.cos(a + k) * len} ${Math.sin(a + k) * len}`;
          return <path key={i} d={`M 0 0 L ${p(-wid)} L ${p(wid)} Z`} fill={`url(#ray${e.id})`} opacity={pulse} />;
        })}
      </g>
    </svg>
  );
};

const Shimmer: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const w = e.size * box.w;
  const h = w * 0.28;
  const n = Math.round(50 + e.intensity * 50);
  const glints: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const u = hash(seed + i * 2) * 2 - 1;
    const v = hash(seed + i * 2 + 1) * 2 - 1;
    if (u * u + v * v > 1) continue;
    const on = Math.pow(Math.max(0, Math.sin(t * (2.2 + hash(seed + i * 7) * 2.5) + i * 1.9)), 6);
    const len = 8 + hash(seed + i * 11) * w * 0.05;
    glints.push(<rect key={i} x={u * w / 2 - len / 2 + Math.sin(t + i) * 3} y={v * h / 2} width={len} height={3.5} rx={1.75} fill="#fffbe8" opacity={Math.min(1, on * e.intensity * 1.3)} />);
  }
  return <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible', mixBlendMode: 'screen' }} width="1" height="1">{glints}</svg>;
};

const Ripples: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const r = e.size * box.w * 0.5;
  return (
    <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible' }} width="1" height="1">
      {[0, 1, 2].map((i) => {
        const ph = frac(t * 0.35 + i / 3);
        return <ellipse key={i} cx={0} cy={0} rx={r * ph} ry={r * ph * 0.3} fill="none" stroke="#f4f8ff" strokeWidth={2.5} opacity={(1 - ph) * 0.6 * e.intensity} />;
      })}
    </svg>
  );
};

const Leaves: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const w = e.size * box.w;
  const fall = box.h * 0.55;
  const n = Math.round(6 + e.intensity * 8);
  const colours = ['#7a9a3a', '#b8862f', '#c4572a', '#e7b3c6'];
  const drift = Math.cos((e.angle * Math.PI) / 180) * w * 0.5;
  return (
    <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible' }} width="1" height="1">
      {Array.from({ length: n }, (_, i) => {
        const ph = frac(t * (0.09 + hash(seed + i) * 0.05) + hash(seed + i * 3));
        const x = (hash(seed + i * 5) - 0.5) * w + Math.sin(ph * 9 + i) * w * 0.08 + drift * ph;
        const y = ph * fall;
        const rot = ph * 720 * (hash(seed + i * 9) > 0.5 ? 1 : -1);
        const size = 13 + hash(seed + i * 13) * 12;
        return (
          <ellipse key={i} cx={0} cy={0} rx={size} ry={size * 0.45} fill={colours[i % colours.length]} opacity={Math.sin(Math.PI * ph) * e.intensity}
            transform={`translate(${x} ${y}) rotate(${rot}) scale(1 ${0.4 + 0.6 * Math.abs(Math.cos(ph * 12 + i))})`} />
        );
      })}
    </svg>
  );
};

const Fireflies: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const r = e.size * box.w * 0.5;
  const n = Math.round(8 + e.intensity * 10);
  return (
    <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible', mixBlendMode: 'screen' }} width="1" height="1">
      <defs>
        <radialGradient id={'ff' + e.id}>
          <stop offset="0" stopColor="#fff6a0" />
          <stop offset="0.4" stopColor="#ffe066" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd040" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: n }, (_, i) => {
        const a = hash(seed + i) * 6.28 + t * (0.2 + hash(seed + i * 3) * 0.3);
        const d = r * (0.2 + hash(seed + i * 5) * 0.8);
        const x = Math.cos(a) * d + tri(t * 0.7 + i) * 10;
        const y = Math.sin(a * 1.3) * d * 0.6 + tri(t * 0.9 + i * 2) * 8;
        const on = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * (1.5 + hash(seed + i * 7)) + i * 2.3)), 3);
        return <circle key={i} cx={x} cy={y} r={9} fill={`url(#ff${e.id})`} opacity={on * e.intensity} />;
      })}
    </svg>
  );
};

const Sand: React.FC<{ e: AnimElement; t: number; box: Box }> = ({ e, t, box }) => {
  const seed = seedOf(e.id);
  const w = e.size * box.w;
  const n = Math.round(14 + e.intensity * 16);
  const dir = Math.cos((e.angle * Math.PI) / 180) >= 0 ? 1 : -1;
  return (
    <svg style={{ position: 'absolute', left: e.x * box.w, top: e.y * box.h, overflow: 'visible' }} width="1" height="1">
      {Array.from({ length: n }, (_, i) => {
        const ph = frac(t * (0.5 + hash(seed + i) * 0.5) + hash(seed + i * 3));
        const x = dir * (ph - 0.5) * w * 1.2;
        const y = (hash(seed + i * 5) - 0.5) * w * 0.12 - Math.sin(ph * 3.1) * 6;
        const len = 20 + hash(seed + i * 9) * 60;
        return <rect key={i} x={x - (dir > 0 ? len : 0)} y={y} width={len} height={2} rx={1} fill="#f1dcae" opacity={Math.sin(Math.PI * ph) * 0.5 * e.intensity} />;
      })}
    </svg>
  );
};

const RENDER: Record<AnimElement['kind'], React.FC<{ e: AnimElement; t: number; box: Box }>> = {
  smoke: (p) => <Smoke {...p} />,
  steam: (p) => <Smoke {...p} steam />,
  fire: Fire,
  glow: Glow,
  birds: Birds,
  clouds: Clouds,
  sunrays: SunRays,
  shimmer: Shimmer,
  ripples: Ripples,
  leaves: Leaves,
  fireflies: Fireflies,
  sand: Sand,
};

/** All elements of one shot, in the picture's own box. */
export const ElementLayer: React.FC<{ elements: AnimElement[]; box: Box }> = ({ elements, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!elements.length) return null;
  const t = frame / fps;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {elements.map((e) => {
        const Draw = RENDER[e.kind];
        return Draw ? <Draw key={e.id} e={e} t={t} box={box} /> : null;
      })}
    </div>
  );
};
