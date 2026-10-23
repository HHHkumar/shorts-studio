// Colours for the data graphics. One palette object per theme, read by every graphic.

import type { GraphicTheme } from '../../lib/types';

export interface Palette {
  background: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  card: string;
  grid: string;
  land: string;
  border: string;
  /** Text that sits on an ink-coloured shape (the VS badge). */
  onInk: string;
}

export const PALETTES: Record<GraphicTheme, Palette> = {
  night: {
    background: 'radial-gradient(ellipse at 30% 20%, #18304d 0%, #0d1a2b 55%, #070d17 100%)',
    ink: '#f4efe4',
    muted: 'rgba(244,239,228,0.62)',
    accent: '#ffb347',
    accent2: '#5cc8f0',
    card: 'rgba(255,255,255,0.07)',
    grid: 'rgba(255,255,255,0.10)',
    land: '#24384f',
    border: 'rgba(255,255,255,0.18)',
    onInk: '#111111',
  },
  paper: {
    background: 'radial-gradient(ellipse at 40% 30%, #faf3e3 0%, #efe4cb 70%, #e4d6b6 100%)',
    ink: '#2a2118',
    muted: 'rgba(42,33,24,0.62)',
    accent: '#c8462c',
    accent2: '#2d6a8a',
    card: 'rgba(255,250,238,0.85)',
    grid: 'rgba(42,33,24,0.12)',
    land: '#d9c9a5',
    border: 'rgba(42,33,24,0.25)',
    onInk: '#fff6e6',
  },
  bold: {
    background: 'linear-gradient(135deg, #141414 0%, #0a0a0a 100%)',
    ink: '#ffffff',
    muted: 'rgba(255,255,255,0.6)',
    accent: '#ffd23f',
    accent2: '#ff4d6d',
    card: '#1e1e1e',
    grid: 'rgba(255,255,255,0.10)',
    land: '#2c2c2c',
    border: 'rgba(255,255,255,0.22)',
    onInk: '#111111',
  },
};

export const SANS = "'Segoe UI', 'Trebuchet MS', Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** 1,234,567 / 3.4 / 0.25 - a number as a viewer reads it. */
export function formatValue(n: number, digits?: number): string {
  if (!Number.isFinite(n)) return '';
  const d = digits ?? (Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : Math.abs(n) >= 10 ? 1 : 2);
  return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

/** Round axis values: 0, 20, 40 rather than 44.8, 66.5, 88.2. */
export function niceTicks(lo: number, hi: number, count = 3): number[] {
  const span = Math.max(1e-9, hi - lo);
  const raw = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || raw;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9 && out.length < 8; v += step) out.push(+v.toPrecision(12));
  return out;
}
