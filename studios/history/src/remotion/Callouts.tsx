// ---------------------------------------------------------------------------
// Callouts: the hand-drawn notes that pop in on a word.
//
// Two kinds of anchoring:
//   ON THE PICTURE  label, arrow, circle, pin, route - drawn in the picture's own
//                   coordinates, inside the camera move, so a ring drawn round a
//                   wind catcher stays round the wind catcher as the camera pushes in.
//   ON THE SCREEN   date, counter, thermometer, timeline - graphics that sit still
//                   while the picture moves under them.
//
// The ink is drawn twice, dark and wide under light and narrow, so it reads on
// any picture. Strokes draw themselves on with pathLength=1 dash animation.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CalloutKind, TimedCallout } from '../lib/types';
import { blob } from './noise';

const HAND = "Kalam, 'Segoe Print', 'Comic Sans MS', cursive";
const INK = '#fff6dc';
const OUTLINE = 'rgba(20,12,4,0.85)';

export const PICTURE_KINDS: CalloutKind[] = ['label', 'arrow', 'circle', 'pin', 'route'];

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Overshoot then settle, for things that pop. */
const pop = (t: number) => {
  const x = clamp01(t);
  return 1 + Math.sin(x * Math.PI) * 0.18 * (1 - x) - (1 - easeOut(x)) * 0.6;
};

/** Pretty year: -1500 -> "1500 BC", 79 -> "AD 79", 1492 -> "1492". */
export function year(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return Math.abs(Math.round(n)) + ' BC';
  if (n < 1000) return 'AD ' + Math.round(n);
  return String(Math.round(n));
}

const handText = (size: number): React.CSSProperties => ({
  fontFamily: HAND,
  fontWeight: 700,
  fontSize: size,
  color: INK,
  WebkitTextStroke: Math.max(3, size / 9) + 'px ' + OUTLINE,
  paintOrder: 'stroke fill',
  textShadow: '0 3px 10px rgba(0,0,0,0.55)',
  whiteSpace: 'nowrap',
  lineHeight: 1.05,
});

/**
 * Drawings use a 1600x900 user space laid over the picture, which is always
 * 16:9 - so circles stay round and a stroke is the same width in every
 * direction. (Stretching a 100x100 box instead needs non-scaling strokes, and
 * those ignore pathLength, which is what the draw-on animation relies on.)
 */
const AX = 16;
const AY = 9;
/** Percent coordinates -> user space. */
const P = (x: number, y: number) => (x * AX).toFixed(1) + ' ' + (y * AY).toFixed(1);

const Drawing: React.FC<{ fade: number; children: React.ReactNode }> = ({ fade, children }) => (
  <svg viewBox="0 0 1600 900" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', opacity: fade }}>
    {children}
  </svg>
);

/** A stroke drawn twice (outline under ink) that draws itself on. Width in user units (1600 = picture width). */
const Stroke: React.FC<{ d: string; progress: number; width?: number; colour?: string }> = ({ d, progress, width = 6, colour = INK }) => (
  <>
    <path d={d} pathLength={1} fill="none" stroke={OUTLINE} strokeWidth={width + 5} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="1 1" strokeDashoffset={1 - clamp01(progress)} />
    <path d={d} pathLength={1} fill="none" stroke={colour} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="1 1" strokeDashoffset={1 - clamp01(progress)} />
  </>
);

/** Two barbs at (x2, y2), pointing along the line from (x1, y1). Percent coordinates in, a user-space path out. */
export function arrowHead(x1: number, y1: number, x2: number, y2: number): string {
  const a = Math.atan2((y2 - y1) * AY, (x2 - x1) * AX);
  const len = 34;
  const tipX = x2 * AX;
  const tipY = y2 * AY;
  const wing = (s: number) => {
    const ang = a + Math.PI + s * 0.5;
    return (tipX + Math.cos(ang) * len).toFixed(1) + ' ' + (tipY + Math.sin(ang) * len).toFixed(1);
  };
  return `M ${wing(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${wing(-1)}`;
}

const onPicture = (c: TimedCallout, t: number, fps: number, fadeOut: number): React.ReactNode => {
  const x = c.x * 100;
  const y = c.y * 100;
  const appear = clamp01(t / (fps * 0.25));

  switch (c.kind) {
    case 'circle': {
      const pts = blob(x, y, 8, (8 * AX) / AY, c.atWord + 3, 0.07, 36);
      // Overshoot the start a little, like a real pen closing a loop.
      const d = 'M ' + pts.map(([px, py]) => P(px, py)).join(' L ') + ' L ' + P(pts[0][0], pts[0][1]) + ' L ' + P(pts[2][0], pts[2][1]);
      return (
        <>
          <Drawing fade={fadeOut}>
            <Stroke d={d} progress={easeOut(t / (fps * 0.7))} width={7} />
          </Drawing>
          {c.text ? <Tag x={x} y={y + (8 * AX) / AY + 3} t={t - fps * 0.5} fps={fps} fade={fadeOut} text={c.text} size={46} /> : null}
        </>
      );
    }
    case 'arrow': {
      const x2 = (c.x2 ?? c.x - 0.14) * 100;
      const y2 = (c.y2 ?? c.y - 0.16) * 100;
      const mx = (x + x2) / 2 + (y - y2) * 0.25;
      const my = (y + y2) / 2 - (x - x2) * 0.25;
      const d = `M ${P(x2, y2)} Q ${P(mx, my)} ${P(x, y)}`;
      const draw = easeOut(t / (fps * 0.6));
      return (
        <>
          <Drawing fade={fadeOut}>
            <Stroke d={d} progress={draw} width={7} />
            {draw > 0.95 ? <Stroke d={arrowHead(mx, my, x, y)} progress={1} width={7} /> : null}
          </Drawing>
          {c.text ? <Tag x={x2} y={y2 - 1} t={t} fps={fps} fade={fadeOut} text={c.text} size={52} above /> : null}
        </>
      );
    }
    case 'pin': {
      const drop = t / (fps * 0.45);
      const fall = drop < 1 ? -(1 - easeOut(drop)) * 140 : Math.sin(Math.min(1, (drop - 1) * 2) * Math.PI) * -10;
      return (
        <div style={{ position: 'absolute', left: x + '%', top: y + '%', opacity: fadeOut * appear }}>
          <svg width="64" height="86" viewBox="0 0 64 86" style={{ position: 'absolute', left: -32, top: -86 + fall, filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.5))' }}>
            <path d="M32 84 C 20 60 4 46 4 30 A 28 28 0 1 1 60 30 C 60 46 44 60 32 84 Z" fill="#d6452c" stroke="#3a0d05" strokeWidth="4" />
            <circle cx="32" cy="30" r="10" fill="#fff4dc" />
          </svg>
          {c.text ? <div style={{ ...handText(44), position: 'absolute', left: 38, top: -70 + fall, opacity: clamp01((t - fps * 0.3) / (fps * 0.2)) }}>{c.text}</div> : null}
        </div>
      );
    }
    case 'route': {
      const pts = c.points && c.points.length >= 2 ? c.points : [{ x: c.x, y: c.y }, { x: c.x2 ?? c.x + 0.2, y: c.y2 ?? c.y }];
      const d = 'M ' + pts.map((p) => P(p.x * 100, p.y * 100)).join(' L ');
      const prog = easeOut(t / (fps * 2));
      const head = pointAlong(pts, prog);
      const last = pts[pts.length - 1];
      return (
        <>
          <Drawing fade={fadeOut}>
            <Stroke d={d} progress={prog} width={7} colour="#e8483a" />
          </Drawing>
          <div style={{ position: 'absolute', left: head.x * 100 + '%', top: head.y * 100 + '%', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', background: '#e8483a', border: '4px solid ' + INK, opacity: fadeOut, boxShadow: '0 2px 6px rgba(0,0,0,.6)' }} />
          {c.text ? <Tag x={last.x * 100} y={last.y * 100 - 2} t={t - fps * 1.8} fps={fps} fade={fadeOut} text={c.text} size={46} above /> : null}
        </>
      );
    }
    default: {
      // label: words with a hand-drawn underline.
      const w = Math.min(26, 1.3 + c.text.length * 1.05);
      const d = `M ${P(x - w / 2, y + 4)} Q ${P(x, y + 5.2)} ${P(x + w / 2, y + 3.6)}`;
      return (
        <>
          <Tag x={x} y={y} t={t} fps={fps} fade={fadeOut} text={c.text} size={60} />
          <Drawing fade={fadeOut}>
            <Stroke d={d} progress={easeOut((t - fps * 0.2) / (fps * 0.4))} width={6} />
          </Drawing>
        </>
      );
    }
  }
};

/** Point `f` (0..1) of the way along a polyline, by length in true proportions. */
function pointAlong(pts: { x: number; y: number }[], f: number): { x: number; y: number } {
  const seg = pts.slice(1).map((p, i) => Math.hypot((p.x - pts[i].x) * AX, (p.y - pts[i].y) * AY));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let left = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, left / seg[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }
    left -= seg[i];
  }
  return pts[pts.length - 1];
}

const Tag: React.FC<{ x: number; y: number; t: number; fps: number; fade: number; text: string; size: number; above?: boolean }> = ({ x, y, t, fps, fade, text, size, above }) => {
  if (t < 0) return null;
  const s = pop(t / (fps * 0.35));
  return (
    <div
      style={{
        ...handText(size),
        position: 'absolute',
        left: x + '%',
        top: y + '%',
        transform: `translate(-50%, ${above ? '-100%' : '-50%'}) scale(${s}) rotate(-2deg)`,
        opacity: clamp01(t / (fps * 0.12)) * fade,
      }}
    >
      {text}
    </div>
  );
};

const onScreen = (c: TimedCallout, t: number, fps: number, fadeOut: number, portrait: boolean): React.ReactNode => {
  // A vertical frame is narrow: pull side-placed graphics in so they are not cut off.
  const x = (portrait && c.kind !== 'timeline' ? Math.max(0.3, Math.min(0.7, c.x)) : c.x) * 100;
  const y = c.y * 100;
  const inT = easeOut(t / (fps * 0.4));

  switch (c.kind) {
    case 'date':
      return (
        <div
          style={{
            position: 'absolute', left: x + '%', top: y + '%',
            transform: `translate(-50%, -50%) rotate(-3deg) scale(${1 + (1 - inT) * 0.5})`,
            opacity: inT * fadeOut,
            background: '#efe0bd', color: '#3b2410', padding: '14px 30px', borderRadius: 6,
            fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: portrait ? 52 : 46, letterSpacing: 1,
            boxShadow: '0 8px 24px rgba(0,0,0,.45), inset 0 0 18px rgba(120,80,30,.35)', border: '3px solid #6b4520', whiteSpace: 'nowrap',
          }}
        >
          {c.text}
        </div>
      );
    case 'counter': {
      const from = c.from ?? 0;
      const to = c.value ?? 0;
      const n = from + (to - from) * easeOut(t / (fps * 1.4));
      const digits = Math.abs(to) < 10 && !Number.isInteger(to) ? 1 : 0;
      return (
        <div style={{ position: 'absolute', left: x + '%', top: y + '%', transform: `translate(-50%, -50%) scale(${pop(t / (fps * 0.3))})`, textAlign: 'center', opacity: fadeOut }}>
          <div style={handText(portrait ? 140 : 120)}>{n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}{c.unit || ''}</div>
          {c.text ? <div style={{ ...handText(46), marginTop: 4 }}>{c.text}</div> : null}
        </div>
      );
    }
    case 'thermometer': {
      const to = c.value ?? 50;
      const top = Math.max(50, Math.ceil((to * 1.2) / 10) * 10);
      const now = (c.from ?? 20) + (to - (c.from ?? 20)) * easeOut((t - fps * 0.2) / (fps * 1.6));
      const fill = clamp01(now / top);
      const hot = clamp01((now - 20) / 30);
      const colour = `rgb(${200 + hot * 55}, ${160 - hot * 120}, ${60 - hot * 40})`;
      return (
        <div style={{ position: 'absolute', left: x + '%', top: y + '%', transform: `translate(-50%, -50%) translateY(${(1 - inT) * 40}px)`, opacity: inT * fadeOut, display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="90" height="400" viewBox="0 0 90 400" style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.5))' }}>
            <rect x="27" y="10" width="36" height="320" rx="18" fill="#fff6e6" stroke={OUTLINE} strokeWidth="6" />
            <rect x="35" y={20 + 300 * (1 - fill)} width="20" height={300 * fill + 20} rx="10" fill={colour} />
            <circle cx="45" cy="350" r="38" fill={colour} stroke={OUTLINE} strokeWidth="6" />
            {[0.25, 0.5, 0.75].map((k) => <line key={k} x1="63" x2="76" y1={20 + 300 * k} y2={20 + 300 * k} stroke={OUTLINE} strokeWidth="4" />)}
          </svg>
          <div>
            <div style={handText(96)}>{Math.round(now)}{c.unit || '°C'}</div>
            {c.text ? <div style={handText(42)}>{c.text}</div> : null}
          </div>
        </div>
      );
    }
    case 'timeline': {
      const a = c.from ?? -3000;
      const b = c.to ?? 2000;
      const at = c.value ?? (a + b) / 2;
      const pos = (v: number) => 12 + (76 * (v - a)) / Math.max(1, b - a);
      const slide = easeOut((t - fps * 0.3) / (fps * 1.4));
      const marker = pos(a + (at - a) * slide);
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, top: y + '%', height: 160, opacity: inT * fadeOut, transform: `translateY(${(1 - inT) * 30}px)` }}>
          <div style={{ position: 'absolute', left: '12%', top: 80, height: 8, width: 76 * easeOut(t / (fps * 0.5)) + '%', background: INK, border: '3px solid ' + OUTLINE, borderRadius: 6, boxSizing: 'content-box' }} />
          {[a, b].map((v) => (
            <div key={v} style={{ position: 'absolute', left: pos(v) + '%', top: 66, width: 8, height: 36, marginLeft: -4, background: INK, border: '3px solid ' + OUTLINE, borderRadius: 4 }} />
          ))}
          <div style={{ ...handText(34), position: 'absolute', left: pos(a) + '%', top: 108, transform: 'translateX(-50%)' }}>{year(a)}</div>
          <div style={{ ...handText(34), position: 'absolute', left: pos(b) + '%', top: 108, transform: 'translateX(-50%)' }}>{year(b)}</div>
          <div style={{ position: 'absolute', left: marker + '%', top: 60, width: 34, height: 34, marginLeft: -17, borderRadius: '50%', background: '#e8483a', border: '5px solid ' + INK, boxShadow: '0 2px 8px rgba(0,0,0,.6)' }} />
          <div style={{ ...handText(48), position: 'absolute', left: marker + '%', top: 0, transform: 'translateX(-50%)' }}>{c.text || year(at)}</div>
        </div>
      );
    }
    default:
      return null;
  }
};

/**
 * All callouts of one scene that belong to one plane. Frames are the scene's
 * own; `end` is the scene length, where everything fades.
 */
export const CalloutLayer: React.FC<{ callouts: TimedCallout[]; plane: 'picture' | 'screen'; end: number; portrait?: boolean }> = ({ callouts, plane, end, portrait = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mine = callouts.filter((c) => (plane === 'picture') === PICTURE_KINDS.includes(c.kind));
  if (!mine.length) return null;
  const fadeOut = interpolate(frame, [end - 8, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {mine.map((c) => {
        const t = frame - c.at;
        if (t < 0) return null;
        return <React.Fragment key={c.id}>{plane === 'picture' ? onPicture(c, t, fps, fadeOut) : onScreen(c, t, fps, fadeOut, portrait)}</React.Fragment>;
      })}
    </AbsoluteFill>
  );
};
