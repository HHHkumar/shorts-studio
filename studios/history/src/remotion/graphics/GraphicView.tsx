// ---------------------------------------------------------------------------
// Data graphics, drawn by the video in place of a picture.
//
// News is explained with numbers, places, quotes and people - and those are
// better drawn from the facts than invented by an image model (which should
// never fake a photo of a real person anyway). Each kind animates in over its
// first second or two, lays itself out for 16:9 or the vertical Short, and is
// a pure function of the frame like everything else.
// ---------------------------------------------------------------------------

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Graphic, GraphicTheme } from '../../lib/types';
import { clamp01, easeOut, formatValue, niceTicks, PALETTES, SANS, SERIF, type Palette } from './theme';
import { WorldMap } from './WorldMap';

/** `safe` = pixels kept clear at the bottom for the captions. */
type Props = { g: Graphic; t: number; w: number; h: number; p: Palette; u: number; portrait: boolean; safe: number };


const Title: React.FC<{ text: string; t: number; p: Palette; u: number; center?: boolean }> = ({ text, t, p, u, center }) =>
  text ? (
    <div style={{
      position: 'absolute', left: 70 * u, right: 70 * u, top: 48 * u, textAlign: center ? 'center' : 'left',
      fontFamily: SERIF, fontWeight: 700, fontSize: 58 * u, lineHeight: 1.12, color: p.ink,
      opacity: easeOut(t / 0.4), transform: `translateY(${(1 - easeOut(t / 0.5)) * 18 * u}px)`,
    }}>
      {text}
      <div style={{ height: 5 * u, width: 120 * u * easeOut((t - 0.2) / 0.5), background: p.accent, marginTop: 14 * u, marginLeft: center ? 'auto' : 0, marginRight: center ? 'auto' : 0 }} />
    </div>
  ) : null;

const Headline: React.FC<Props> = ({ g, t, p, u, safe }) => {
  const wipe = easeOut(t / 0.6);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${90 * u}px`, bottom: safe, height: 'auto' }}>
      {g.role ? (
        <div style={{ alignSelf: 'flex-start', background: p.accent, color: '#111', fontFamily: SANS, fontWeight: 900, fontSize: 30 * u, letterSpacing: 3 * u, padding: `${8 * u}px ${18 * u}px`, textTransform: 'uppercase', clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>
          {g.role}
        </div>
      ) : null}
      <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 92 * u, lineHeight: 1.06, color: p.ink, marginTop: 22 * u, opacity: easeOut((t - 0.2) / 0.5), transform: `translateY(${(1 - easeOut((t - 0.2) / 0.6)) * 30 * u}px)` }}>
        {g.title}
      </div>
      {g.quote ? (
        <div style={{ fontFamily: SANS, fontSize: 38 * u, lineHeight: 1.35, color: p.muted, marginTop: 24 * u, maxWidth: '85%', opacity: easeOut((t - 0.6) / 0.6) }}>{g.quote}</div>
      ) : null}
      <div style={{ height: 6 * u, background: p.accent, marginTop: 34 * u, width: (wipe * 100) + '%' }} />
    </AbsoluteFill>
  );
};

const BigNumber: React.FC<Props> = ({ g, t, p, u, safe }) => {
  const n = g.from + (g.value - g.from) * easeOut((t - 0.2) / 1.6);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: `0 ${80 * u}px`, bottom: safe, height: 'auto' }}>
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 210 * u, lineHeight: 1, color: p.accent, transform: `scale(${0.9 + 0.1 * easeOut(t / 0.4)})` }}>
        {formatValue(n, Number.isInteger(g.value) && Number.isInteger(g.from) ? 0 : undefined)}<span style={{ fontSize: 110 * u }}>{g.unit}</span>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 54 * u, color: p.ink, marginTop: 24 * u, opacity: easeOut((t - 0.4) / 0.5), maxWidth: '80%' }}>{g.title}</div>
      {g.items[0]?.note ? <div style={{ fontFamily: SANS, fontSize: 32 * u, color: p.muted, marginTop: 14 * u, opacity: easeOut((t - 0.8) / 0.5) }}>{g.items[0].note}</div> : null}
    </AbsoluteFill>
  );
};

const Bars: React.FC<Props> = ({ g, t, p, u, portrait, safe }) => {
  const items = g.items.filter((i) => Number.isFinite(i.value)).slice(0, 8);
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  const rowH = Math.min(92 * u, (portrait ? 900 : 700) * u / Math.max(1, items.length));
  return (
    <>
      <Title text={g.title} t={t} p={p} u={u} />
      <div style={{ position: 'absolute', left: 70 * u, right: 70 * u, top: (g.title ? 210 : 80) * u, bottom: safe, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: rowH * 0.28 }}>
        {items.map((it, i) => {
          const grow = easeOut((t - 0.3 - i * 0.12) / 0.9);
          // The longest bar stops short of the edge, so its value still fits after it.
          const reach = (Math.abs(it.value) / max) * 80 * grow;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 * u, height: rowH }}>
              <div style={{ width: portrait ? '32%' : '24%', textAlign: 'right', fontFamily: SANS, fontWeight: 700, fontSize: Math.min(36 * u, rowH * 0.42), color: p.ink, lineHeight: 1.1 }}>{it.label}</div>
              <div style={{ flex: 1, height: rowH * 0.62, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: p.grid, borderRadius: 8 * u }} />
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: reach + '%', background: i === 0 ? p.accent : p.accent2, borderRadius: 8 * u }} />
                <div style={{ position: 'absolute', left: `calc(${reach}% + ${12 * u}px)`, top: '50%', transform: 'translateY(-50%)', fontFamily: SANS, fontWeight: 800, fontSize: Math.min(34 * u, rowH * 0.4), color: p.ink, opacity: grow, whiteSpace: 'nowrap' }}>
                  {formatValue(it.value * grow)}{g.unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const Line: React.FC<Props> = ({ g, t, p, u, w, h, safe, portrait }) => {
  const items = g.items.filter((i) => Number.isFinite(i.value)).slice(0, 24);
  if (items.length < 2) return <Headline g={{ ...g, title: g.title || 'Not enough data for a line' }} t={t} p={p} u={u} w={w} h={h} portrait={portrait} safe={safe} />;
  const left = 150 * u;
  const right = w - 90 * u;
  const top = (g.title ? 230 : 90) * u;
  const bottom = h - safe - 60 * u;
  const vals = items.map((i) => i.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padV = (hi - lo) * 0.12;
  lo -= padV; hi += padV;
  const X = (i: number) => left + ((right - left) * i) / (items.length - 1);
  const Y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const d = items.map((it, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(it.value).toFixed(1)).join(' ');
  const draw = easeOut((t - 0.3) / 1.8);
  const lastShown = Math.floor(draw * (items.length - 1) + 1e-6);
  const step = Math.max(1, Math.ceil(items.length / 8));
  return (
    <>
      <Title text={g.title} t={t} p={p} u={u} />
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        {niceTicks(lo, hi, 4).map((v) => {
          return (
            <g key={v}>
              <line x1={left} x2={right} y1={Y(v)} y2={Y(v)} stroke={p.grid} strokeWidth={2} />
              <text x={left - 18 * u} y={Y(v) + 10 * u} textAnchor="end" fontFamily={SANS} fontSize={26 * u} fill={p.muted}>{formatValue(v)}{g.unit}</text>
            </g>
          );
        })}
        <path d={d} pathLength={1} fill="none" stroke={p.accent} strokeWidth={8 * u} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - draw} />
        {items.map((it, i) => (
          <g key={i} opacity={i <= lastShown ? 1 : 0}>
            <circle cx={X(i)} cy={Y(it.value)} r={9 * u} fill={p.accent} stroke={p.ink} strokeWidth={3 * u} />
            {i % step === 0 || i === items.length - 1 ? <text x={X(i)} y={bottom + 44 * u} textAnchor="middle" fontFamily={SANS} fontSize={26 * u} fill={p.muted}>{it.label}</text> : null}
          </g>
        ))}
        {lastShown >= 0 ? (
          <text x={X(lastShown)} y={Y(items[lastShown].value) - 26 * u} textAnchor="middle" fontFamily={SANS} fontWeight={800} fontSize={40 * u} fill={p.ink}>
            {formatValue(items[lastShown].value)}{g.unit}
          </text>
        ) : null}
      </svg>
    </>
  );
};

const Quote: React.FC<Props> = ({ g, t, p, u, safe }) => {
  const words = g.quote.split(/\s+/).filter(Boolean);
  const shown = (t - 0.3) * 9; // words per second
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: `0 ${110 * u}px`, bottom: safe, height: 'auto' }}>
      <div style={{ fontFamily: SERIF, fontSize: 220 * u, lineHeight: 0.6, color: p.accent, opacity: easeOut(t / 0.4) }}>“</div>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: (words.length > 40 ? 50 : 62) * u, lineHeight: 1.3, color: p.ink }}>
        {words.map((wd, i) => <span key={i} style={{ opacity: clamp01(shown - i) }}>{wd} </span>)}
      </div>
      <div style={{ marginTop: 34 * u, opacity: easeOut((t - 0.3 - words.length / 9) / 0.5) }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40 * u, color: p.ink }}>— {g.who}</div>
        {g.role ? <div style={{ fontFamily: SANS, fontSize: 30 * u, color: p.muted, marginTop: 6 * u }}>{g.role}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

const People: React.FC<Props> = ({ g, t, p, u, portrait, safe }) => {
  const people = g.items.slice(0, 4);
  return (
    <>
      <Title text={g.title} t={t} p={p} u={u} center />
      <AbsoluteFill style={{ top: (g.title ? 170 : 40) * u, bottom: safe, height: 'auto', flexDirection: portrait ? 'column' : 'row', justifyContent: 'center', alignItems: 'center', gap: (portrait ? 24 : 34) * u, padding: `0 ${60 * u}px` }}>
        {people.map((it, i) => {
          const a = easeOut((t - 0.3 - i * 0.18) / 0.6);
          const colour = i % 2 ? p.accent2 : p.accent;
          return (
            <div key={i} style={{
              width: portrait ? '86%' : `${Math.min(380, 1500 / Math.max(1, people.length) - 30)}px`, maxWidth: (portrait ? 920 : 400) * u,
              background: p.card, border: `2px solid ${p.border}`, borderRadius: 22 * u, padding: `${30 * u}px ${24 * u}px`, textAlign: 'center',
              opacity: a, transform: `translateY(${(1 - a) * 40 * u}px)`, display: portrait ? 'flex' : 'block', alignItems: 'center', gap: 24 * u,
            }}>
              <div style={{ width: 130 * u, height: 130 * u, flex: '0 0 auto', borderRadius: '50%', margin: portrait ? 0 : '0 auto', background: colour, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 52 * u }}>
                {initials(it.label)}
              </div>
              <div style={{ textAlign: portrait ? 'left' : 'center' }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 38 * u, color: p.ink, marginTop: portrait ? 0 : 20 * u, lineHeight: 1.15 }}>{it.label}</div>
                <div style={{ fontFamily: SANS, fontSize: 28 * u, color: p.muted, marginTop: 8 * u, lineHeight: 1.3 }}>{it.note}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </>
  );
};

const Timeline: React.FC<Props> = ({ g, t, p, u, w, h, portrait, safe }) => {
  const events = g.items.slice(0, 6);
  const n = Math.max(1, events.length);
  if (portrait) {
    return (
      <>
        <Title text={g.title} t={t} p={p} u={u} />
        <div style={{ position: 'absolute', left: 90 * u, right: 60 * u, top: (g.title ? 230 : 90) * u, bottom: safe, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', borderLeft: `6px solid ${p.grid}`, paddingLeft: 40 * u }}>
          {events.map((e, i) => {
            const a = easeOut((t - 0.3 - i * 0.35) / 0.5);
            return (
              <div key={i} style={{ position: 'relative', opacity: a }}>
                <div style={{ position: 'absolute', left: -61 * u, top: 6 * u, width: 30 * u, height: 30 * u, borderRadius: '50%', background: i === events.length - 1 ? p.accent : p.accent2, border: `4px solid ${p.ink}` }} />
                <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 36 * u, color: p.accent }}>{e.label}</div>
                <div style={{ fontFamily: SANS, fontSize: 32 * u, color: p.ink, lineHeight: 1.3 }}>{e.note}</div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  const left = 110 * u;
  const right = w - 110 * u;
  // Centred in the space between the title and the captions.
  const y = ((g.title ? 210 * u : 60 * u) + (h - safe)) / 2;
  const line = easeOut((t - 0.2) / (0.4 + n * 0.3));
  return (
    <>
      <Title text={g.title} t={t} p={p} u={u} />
      <div style={{ position: 'absolute', left, top: y - 4 * u, height: 8 * u, width: (right - left) * line, background: p.grid, borderRadius: 4 * u }} />
      {events.map((e, i) => {
        const x = left + ((right - left) * (i + 0.5)) / n;
        const a = easeOut((t - 0.3 - i * 0.3) / 0.5);
        const above = i % 2 === 0;
        return (
          <div key={i} style={{ opacity: a }}>
            <div style={{ position: 'absolute', left: x - 18 * u, top: y - 18 * u, width: 36 * u, height: 36 * u, borderRadius: '50%', background: i === events.length - 1 ? p.accent : p.accent2, border: `5px solid ${p.ink}` }} />
            <div style={{ position: 'absolute', left: x - (right - left) / n / 2 + 8 * u, width: (right - left) / n - 16 * u, top: above ? y - 230 * u : y + 46 * u, height: 180 * u, display: 'flex', flexDirection: 'column', justifyContent: above ? 'flex-end' : 'flex-start', textAlign: 'center' }}>
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 34 * u, color: p.accent }}>{e.label}</div>
              <div style={{ fontFamily: SANS, fontSize: 27 * u, color: p.ink, lineHeight: 1.25, marginTop: 6 * u }}>{e.note}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

const Versus: React.FC<Props> = ({ g, t, p, u, portrait, safe }) => {
  const side = (s: Graphic['left'], colour: string, from: number, k: number) => {
    const a = easeOut((t - 0.2 - k * 0.15) / 0.6);
    return (
      <div style={{ flex: portrait ? '0 0 auto' : 1, background: p.card, border: `3px solid ${colour}`, borderRadius: 22 * u, padding: `${34 * u}px ${36 * u}px`, opacity: a, transform: `translateX(${(1 - a) * from * u}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 44 * u, color: colour, marginBottom: 18 * u }}>{s.title}</div>
        {s.points.slice(0, 4).map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 14 * u, fontFamily: SANS, fontSize: 32 * u, lineHeight: 1.3, color: p.ink, margin: `${12 * u}px 0`, opacity: easeOut((t - 0.6 - k * 0.15 - i * 0.25) / 0.5) }}>
            <span style={{ color: colour }}>●</span><span>{pt}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <>
      <Title text={g.title} t={t} p={p} u={u} center />
      <AbsoluteFill style={{ top: (g.title ? 190 : 60) * u, bottom: safe, height: 'auto', padding: `0 ${60 * u}px`, flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'stretch' : 'center', justifyContent: 'center', gap: 70 * u }}>
        {side(g.left, p.accent, portrait ? 0 : -80, 0)}
        {side(g.right, p.accent2, portrait ? 0 : 80, 1)}
      </AbsoluteFill>
      <AbsoluteFill style={{ top: (g.title ? 190 : 60) * u, bottom: safe, height: 'auto', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 92 * u, height: 92 * u, borderRadius: '50%', background: p.ink, color: p.onInk, fontFamily: SANS, fontWeight: 900, fontSize: 38 * u, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${easeOut((t - 0.5) / 0.4)})` }}>VS</div>
      </AbsoluteFill>
    </>
  );
};

/** One graphic, filling the frame. `theme` picks the palette. */
export const GraphicView: React.FC<{ g: Graphic; theme: GraphicTheme }> = ({ g, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = PALETTES[theme] || PALETTES.night;
  const portrait = height > width;
  // Laid out on a 1920-wide (or 1080-wide) canvas; u scales everything to the real frame.
  const u = Math.min(width, height) / 1080;
  // Captions own the bottom of the frame (much more of it in a vertical Short).
  const safe = portrait ? 640 * u : 200 * u;
  const props: Props = { g, t: frame / fps, w: width, h: height, p, u, portrait, safe };
  const body = (() => {
    switch (g.kind) {
      case 'map': return <><WorldMap countries={g.countries} title={g.title} t={props.t} w={width} h={height} p={p} u={u} safe={safe} /><Title text={g.title} t={props.t} p={p} u={u} /></>;
      case 'bars': return <Bars {...props} />;
      case 'line': return <Line {...props} />;
      case 'number': return <BigNumber {...props} />;
      case 'quote': return <Quote {...props} />;
      case 'people': return <People {...props} />;
      case 'timeline': return <Timeline {...props} />;
      case 'versus': return <Versus {...props} />;
      default: return <Headline {...props} />;
    }
  })();
  return <AbsoluteFill style={{ background: p.background, overflow: 'hidden' }}>{body}</AbsoluteFill>;
};
