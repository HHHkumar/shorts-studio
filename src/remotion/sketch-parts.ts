import type p5 from 'p5';
import type { SketchColors } from './sketches';

// ---------------------------------------------------------------------------
// The pieces every diagram is built from.
//
// A hundred sketches written from bare p5 calls would be a hundred chances to
// get a resistor wrong, put a label off the canvas, or divide by an item list
// somebody forgot to send. So the drawing that repeats lives here once, gets
// read once, and is wrong or right in one place.
//
// Two rules, both learned the hard way:
//
//   * Nothing may produce NaN. A p5 canvas swallows a NaN coordinate in
//     silence - no error, no shape - so a single bad divide is a blank scene in
//     a finished video. Every helper that divides guards its denominator.
//   * Nothing may depend on the model sending good data. Labels are trimmed and
//     truncated, counts are clamped, and an empty list draws nothing rather
//     than drawing rubbish.
// ---------------------------------------------------------------------------

export const ctx2d = (p: p5): CanvasRenderingContext2D =>
  p.drawingContext as unknown as CanvasRenderingContext2D;

export const setDash = (p: p5, on: boolean, pattern: number[] = [8, 10]) =>
  ctx2d(p).setLineDash(on ? pattern : []);

/** A colour at an opacity. p5 needs a Color object, not a string, for alpha. */
export function tint(p: p5, hex: string, alpha: number) {
  const c = p.color(hex);
  c.setAlpha(Math.max(0, Math.min(255, alpha)));
  return c;
}

/** Clamp a model-supplied number into something drawable. */
export function num(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** Never divide by zero, however empty the data is. */
export const safe = (n: number) => (Number.isFinite(n) && n !== 0 ? n : 1);

/** 0 to 1, staggered so a row of things arrives one after another. */
export const stagger = (progress: number, i: number, gap = 0.12, speed = 2) =>
  Math.min(1, Math.max(0, progress * speed - i * gap));

/** Model text, made safe to draw: trimmed, single line, and never a novel. */
export const clean = (v: unknown, max = 22): string =>
  String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// --- text --------------------------------------------------------------------

export function caption(
  p: p5, text: string, x: number, y: number, colors: SketchColors, size = 24,
) {
  const t = clean(text, 28);
  if (!t) return;
  p.push();
  p.noStroke();
  p.fill(colors.dim);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(size);
  p.text(t, x, y);
  p.pop();
}

export function title(
  p: p5, text: string, x: number, y: number, colors: SketchColors, size = 28,
) {
  const t = clean(text, 26);
  if (!t) return;
  p.push();
  p.noStroke();
  p.fill(colors.text);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(size);
  p.text(t, x, y);
  p.pop();
}

// --- geometry ----------------------------------------------------------------

export function wire(p: p5, x1: number, y1: number, x2: number, y2: number, colour: unknown, w = 4) {
  p.push();
  p.stroke(colour as string);
  p.strokeWeight(w);
  p.noFill();
  p.line(x1, y1, x2, y2);
  p.pop();
}

/** A filled junction dot, so a wire meeting a wire reads as connected. */
export function junction(p: p5, x: number, y: number, colour: unknown, r = 9) {
  p.push();
  p.noStroke();
  p.fill(colour as string);
  p.circle(x, y, r);
  p.pop();
}

export function arrow(
  p: p5, x1: number, y1: number, x2: number, y2: number, colour: unknown, w = 4, head = 14,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  p.push();
  p.stroke(colour as string);
  p.strokeWeight(w);
  p.noFill();
  p.line(x1, y1, x2, y2);
  p.line(x2, y2, x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
  p.line(x2, y2, x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
  p.pop();
}

/** A curved arrow, for cycles and rotations. */
export function arcArrow(
  p: p5, cx: number, cy: number, r: number, from: number, to: number, colour: unknown, w = 4,
) {
  p.push();
  p.noFill();
  p.stroke(colour as string);
  p.strokeWeight(w);
  p.arc(cx, cy, r * 2, r * 2, from, to);
  p.pop();
  const tipX = cx + Math.cos(to) * r;
  const tipY = cy + Math.sin(to) * r;
  arrow(p, cx + Math.cos(to - 0.12) * r, cy + Math.sin(to - 0.12) * r, tipX, tipY, colour, w, 13);
}

/** A labelled box. The workhorse of every flow, tree and circuit. */
export function box(
  p: p5, x: number, y: number, w: number, h: number, text: string,
  colors: SketchColors, opts: { lit?: boolean; fill?: boolean; radius?: number; size?: number } = {},
) {
  const { lit = false, fill = true, radius = 8, size = 22 } = opts;
  p.push();
  p.stroke(lit ? colors.accent : colors.text);
  p.strokeWeight(lit ? 5 : 3);
  if (fill) p.fill(colors.bg); else p.noFill();
  p.rect(x - w / 2, y - h / 2, w, h, radius);
  p.pop();
  const t = clean(text, Math.max(4, Math.floor(w / 11)));
  if (t) {
    p.push();
    p.noStroke();
    p.fill(lit ? colors.accent : colors.text);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(size);
    p.text(t, x, y);
    p.pop();
  }
}

/** A circle with a label inside. */
export function bubble(
  p: p5, x: number, y: number, r: number, text: string, colors: SketchColors,
  opts: { lit?: boolean; size?: number } = {},
) {
  const { lit = false, size = 22 } = opts;
  p.push();
  p.stroke(lit ? colors.accent : colors.text);
  p.strokeWeight(3);
  p.fill(tint(p, lit ? colors.accent : colors.bg, lit ? 70 : 255));
  p.circle(x, y, r * 2);
  p.pop();
  const t = clean(text, Math.max(3, Math.floor(r / 6)));
  if (t) {
    p.push();
    p.noStroke();
    p.fill(colors.text);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(size);
    p.text(t, x, y);
    p.pop();
  }
}

// --- axes and plots ----------------------------------------------------------

export interface Plot {
  left: number; right: number; top: number; bottom: number;
  x: (t: number) => number;   // 0-1 across
  y: (t: number) => number;   // 0-1 up from the baseline
}

/** A pair of axes with room for labels, and mappers into the plot area. */
export function axes(
  p: p5, width: number, height: number, colors: SketchColors,
  labels: { x?: string; y?: string } = {},
): Plot {
  const left = width * 0.14;
  const right = width * 0.92;
  const bottom = height * 0.78;
  const top = height * 0.16;

  p.push();
  p.stroke(colors.dim);
  p.strokeWeight(3);
  p.noFill();
  p.line(left, top, left, bottom);
  p.line(left, bottom, right, bottom);
  p.pop();

  if (labels.x) caption(p, labels.x, (left + right) / 2, bottom + 34, colors, 22);
  if (labels.y) caption(p, labels.y, left, top - 20, colors, 22);

  return {
    left, right, top, bottom,
    x: (t) => left + t * (right - left),
    y: (t) => bottom - t * (bottom - top),
  };
}

/** Draw a function across the plot, revealed left to right by `progress`. */
export function curve(
  p: p5, plot: Plot, fn: (t: number) => number, colour: unknown, progress: number, w = 5,
) {
  const upto = Math.min(1, Math.max(0, progress));
  if (upto <= 0) return;
  p.push();
  p.noFill();
  p.stroke(colour as string);
  p.strokeWeight(w);
  p.beginShape();
  for (let t = 0; t <= upto; t += 0.01) {
    const v = fn(t);
    if (Number.isFinite(v)) p.vertex(plot.x(t), plot.y(Math.min(1.2, Math.max(-0.2, v))));
  }
  p.endShape();
  p.pop();
}

/** A row of value bars with labels. Used by half a dozen chart sketches. */
export function bars(
  p: p5, plot: Plot, values: { label: string; value: number }[], colors: SketchColors,
  progress: number,
) {
  if (!values.length) return;
  const max = Math.max(...values.map((v) => Math.abs(v.value)), 1);
  const slot = (plot.right - plot.left) / safe(values.length);
  const w = slot * 0.6;
  values.forEach((v, i) => {
    const on = stagger(progress, i, 0.08);
    const h = (Math.abs(v.value) / safe(max)) * (plot.bottom - plot.top) * on;
    const x = plot.left + i * slot + (slot - w) / 2;
    p.push();
    p.noStroke();
    p.fill(tint(p, colors.accent, 220 - i * 18));
    p.rect(x, plot.bottom - h, w, h, 6, 6, 0, 0);
    p.pop();
    caption(p, v.label, x + w / 2, plot.bottom + 24, colors, 20);
  });
}

// --- component symbols -------------------------------------------------------

/** A battery or DC source, drawn across the wire at (x, y), vertically. */
export function battery(p: p5, x: number, y: number, colors: SketchColors, size = 22) {
  p.push();
  p.stroke(colors.text);
  p.strokeWeight(6);
  p.line(x - size, y - 7, x + size, y - 7);
  p.strokeWeight(3);
  p.line(x - size * 0.5, y + 7, x + size * 0.5, y + 7);
  p.pop();
}

/** A resistor as an IEC box, sitting on a horizontal wire. */
export function resistor(p: p5, x: number, y: number, colors: SketchColors, lit = false, w = 74) {
  p.push();
  p.stroke(lit ? colors.accent : colors.text);
  p.strokeWeight(4);
  p.fill(colors.bg);
  p.rect(x - w / 2, y - 16, w, 32, 3);
  p.pop();
}

/** A capacitor across a horizontal wire. */
export function capacitor(p: p5, x: number, y: number, colors: SketchColors, h = 30) {
  p.push();
  p.stroke(colors.text);
  p.strokeWeight(5);
  p.line(x - 7, y - h / 2, x - 7, y + h / 2);
  p.line(x + 7, y - h / 2, x + 7, y + h / 2);
  p.pop();
}

/** An inductor: four bumps on a horizontal wire. */
export function inductor(p: p5, x: number, y: number, colors: SketchColors, w = 72) {
  p.push();
  p.noFill();
  p.stroke(colors.text);
  p.strokeWeight(4);
  const step = w / 4;
  for (let i = 0; i < 4; i++) {
    p.arc(x - w / 2 + step * (i + 0.5), y, step, step * 1.4, Math.PI, 0);
  }
  p.pop();
}

/** A lamp: a circle with a cross. */
export function lamp(p: p5, x: number, y: number, colors: SketchColors, lit = false, r = 20) {
  p.push();
  p.stroke(lit ? colors.accent : colors.text);
  p.strokeWeight(4);
  p.fill(tint(p, lit ? colors.accent : colors.bg, lit ? 90 : 255));
  p.circle(x, y, r * 2);
  const d = r * 0.7;
  p.line(x - d, y - d, x + d, y + d);
  p.line(x - d, y + d, x + d, y - d);
  p.pop();
}

/** A switch, open or closed. */
export function switchSym(p: p5, x: number, y: number, colors: SketchColors, closed = false, w = 56) {
  p.push();
  p.stroke(colors.text);
  p.strokeWeight(4);
  p.noFill();
  p.line(x - w / 2, y, x - w * 0.28, y);
  p.line(x + w * 0.28, y, x + w / 2, y);
  if (closed) p.line(x - w * 0.28, y, x + w * 0.28, y);
  else p.line(x - w * 0.28, y, x + w * 0.22, y - 26);
  p.pop();
  junction(p, x - w * 0.28, y, colors.text, 8);
  junction(p, x + w * 0.28, y, colors.text, 8);
}

/** Ground / earth. */
export function ground(p: p5, x: number, y: number, colors: SketchColors) {
  p.push();
  p.stroke(colors.text);
  p.strokeWeight(4);
  p.line(x, y, x, y + 14);
  p.line(x - 22, y + 14, x + 22, y + 14);
  p.line(x - 14, y + 22, x + 14, y + 22);
  p.line(x - 6, y + 30, x + 6, y + 30);
  p.pop();
}

// --- containers --------------------------------------------------------------

/** A beaker holding liquid to a given level (0-1). */
export function beaker(
  p: p5, x: number, y: number, w: number, h: number, level: number, colour: unknown,
  colors: SketchColors,
) {
  const fillH = h * Math.min(1, Math.max(0, level));
  p.push();
  p.noStroke();
  p.fill(colour as string);
  p.rect(x - w / 2 + 4, y + h / 2 - fillH, w - 8, fillH, 0, 0, 8, 8);
  p.noFill();
  p.stroke(colors.text);
  p.strokeWeight(4);
  // Open at the top, which is what makes it a beaker and not a box.
  p.line(x - w / 2, y - h / 2, x - w / 2, y + h / 2);
  p.line(x - w / 2, y + h / 2, x + w / 2, y + h / 2);
  p.line(x + w / 2, y + h / 2, x + w / 2, y - h / 2);
  p.pop();
}

/** Evenly spaced positions across a width, with margins. */
export function spread(count: number, from: number, to: number): number[] {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return [(from + to) / 2];
  return new Array(n).fill(0).map((_, i) => from + (i * (to - from)) / (n - 1));
}

/** Turn model items into plottable numbers, dropping the unusable ones. */
export function values(items: { label: string; value?: number }[], limit = 8) {
  return (items || [])
    .filter((i) => i && Number.isFinite(Number(i.value)))
    .slice(0, limit)
    .map((i) => ({ label: clean(i.label, 14), value: Number(i.value) }));
}

/** Turn model items into labels, dropping the empty ones. */
export function labels(items: { label: string }[], limit = 8): string[] {
  return (items || []).map((i) => clean(i && i.label, 18)).filter(Boolean).slice(0, limit);
}
