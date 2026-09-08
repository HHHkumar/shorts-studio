import type p5 from 'p5';
import type { SketchArgs } from './P5Sketch';
import { EXTRA_SKETCHES } from './sketches-extra';
import { MORE_SKETCHES } from './sketches-more';
import { GAP_SKETCHES } from './sketches-gaps';

// ---------------------------------------------------------------------------
// The curated sketch library.
//
// Gemini picks one of these by name and supplies parameters; it never writes
// drawing code. That keeps every animation deterministic by construction, and
// means a bad choice degrades to a plain scene instead of breaking the render.
//
// Every sketch must be a pure function of `progress` and `time`. No state
// carried between draws, no Date.now(), and randomness only through p.random(),
// which P5Sketch re-seeds before every frame.
// ---------------------------------------------------------------------------

export interface SketchColors {
  accent: string;
  text: string;
  dim: string;
  good: string;
  bg: string;
}

export interface SketchParams {
  mode?: string;
  angle?: number;
  speed?: number;
  frequency?: number;
  amplitude?: number;
  count?: number;
  ratio?: number;
  labelA?: string;
  labelB?: string;
}

export interface SketchItem {
  label: string;
  value?: number;
  symbol?: string;
}

export interface DrawArgs extends SketchArgs {
  params: SketchParams;
  /** Shared with the other diagram kinds: labelled parts, or values to weigh. */
  items: SketchItem[];
  colors: SketchColors;
}

export interface SketchDef {
  /**
   * How the sketch wants its canvas. A circular diagram in a wide, short box
   * ends up tiny with empty bands either side, so those ask for a square.
   */
  shape: 'wide' | 'square';
  /** Shown in the app when a sketch is chosen. */
  label: string;
  /** One line telling Gemini when this is the right pick. */
  describe: string;
  /** Which parameters this sketch reads. */
  uses: string;
  draw: (a: DrawArgs) => void;
}

/** p5 types drawingContext as a 2D/WebGL union; these sketches are all 2D. */
const ctx2d = (p: p5): CanvasRenderingContext2D =>
  p.drawingContext as unknown as CanvasRenderingContext2D;

const dashed = (p: p5, on: boolean) => ctx2d(p).setLineDash(on ? [8, 10] : []);

/** The accent at a given opacity, so a series of slices stays distinguishable. */
function shade(p: p5, hex: string, alpha: number) {
  const c = p.color(hex);
  c.setAlpha(alpha);
  return c;
}

const num = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** A small caption under a drawn element, in the layout's own dim colour. */
function label(p: p5, text: string, x: number, y: number, colors: SketchColors, size = 26) {
  if (!text) return;
  p.push();
  p.noStroke();
  p.fill(colors.dim);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(size);
  p.text(text, x, y);
  p.pop();
}

const CORE_SKETCHES: Record<string, SketchDef> = {
  // -------------------------------------------------------------------------
  'wave-interference': {
    shape: 'wide',
    label: 'Wave interference',
    describe: 'Two sources sending out ripples that add and cancel. Use for interference, sound, water waves, the double slit.',
    uses: 'frequency (1-5, ripple tightness), speed (1-5)',
    draw: ({ p, time, width, height, params, colors }) => {
      const freq = num(params.frequency, 3, 1, 5);
      const speed = num(params.speed, 3, 1, 5);
      const sources = [
        { x: width * 0.3, y: height * 0.5 },
        { x: width * 0.7, y: height * 0.5 },
      ];
      const step = 22;
      const lambda = 46 / freq * 1.6;

      p.noStroke();
      for (let x = step / 2; x < width; x += step) {
        for (let y = step / 2; y < height; y += step) {
          let sum = 0;
          for (const s of sources) {
            sum += Math.sin(Math.hypot(x - s.x, y - s.y) / lambda - time * speed);
          }
          const v = (sum + 2) / 4; // 0..1
          p.fill(colors.accent);
          p.circle(x, y, 2 + v * 11);
        }
      }

      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(3);
      for (const s of sources) p.circle(s.x, s.y, 14);
    },
  },

  // -------------------------------------------------------------------------
  'sine-wave': {
    shape: 'wide',
    label: 'Travelling wave',
    describe: 'One or two sine waves moving across the screen, optionally with their sum. Use for waves, sound, oscillation, superposition.',
    uses: 'frequency (1-6), amplitude (0.2-1), count (1 or 2; 2 adds a second wave and their sum)',
    draw: ({ p, time, width, height, params, colors }) => {
      const freq = num(params.frequency, 2, 1, 6);
      const amp = num(params.amplitude, 0.7, 0.2, 1) * height * 0.22;
      const count = num(params.count, 1, 1, 2);
      const mid = height / 2;

      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.line(0, mid, width, mid);

      const wave = (k: number, phase: number) => (x: number) =>
        Math.sin((x / width) * Math.PI * 2 * k - time * 2.4 + phase);

      const w1 = wave(freq, 0);
      const w2 = wave(freq * 1.6, 1.2);

      const plot = (fn: (x: number) => number, colour: string, weight: number, scale = 1) => {
        p.noFill();
        p.stroke(colour);
        p.strokeWeight(weight);
        p.beginShape();
        for (let x = 0; x <= width; x += 4) p.vertex(x, mid - fn(x) * amp * scale);
        p.endShape();
      };

      if (count >= 2) {
        plot(w1, colors.dim, 3);
        plot(w2, colors.dim, 3);
        plot((x) => (w1(x) + w2(x)) / 2, colors.accent, 6);
      } else {
        plot(w1, colors.accent, 6);
      }
    },
  },

  // -------------------------------------------------------------------------
  orbit: {
    shape: 'square',
    label: 'Orbit',
    describe: 'Bodies circling a central mass at different periods. Use for planets, moons, satellites, orbital period questions.',
    uses: 'count (1-3 orbiting bodies), ratio (0.3-3, how much slower each outer body is), labelA (centre), labelB (first orbiter)',
    draw: ({ p, time, width, height, params, colors }) => {
      const count = Math.round(num(params.count, 2, 1, 3));
      const ratio = num(params.ratio, 1.6, 0.3, 3);
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.42;

      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      for (let i = 1; i <= count; i++) p.circle(cx, cy, (maxR * i) / count * 2);

      p.noStroke();
      p.fill(colors.accent);
      p.circle(cx, cy, 46);
      label(p, params.labelA || '', cx, cy + 44, colors);

      for (let i = 1; i <= count; i++) {
        const r = (maxR * i) / count;
        const period = Math.pow(i, ratio);
        const a = (time * 1.4) / period;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        p.fill(colors.text);
        p.circle(x, y, 22);
        if (i === 1 && params.labelB) label(p, params.labelB, x, y - 26, colors, 18);
      }
    },
  },

  // -------------------------------------------------------------------------
  projectile: {
    shape: 'wide',
    label: 'Projectile',
    describe: 'A ball launched at an angle, tracing its arc. Use for projectile motion, range, trajectory, gravity questions.',
    uses: 'angle (15-75 degrees), speed (1-5)',
    draw: ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 45, 15, 75);
      const rad = (deg * Math.PI) / 180;
      const groundY = height * 0.86;
      const startX = width * 0.1;
      const span = width * 0.8;

      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.line(0, groundY, width, groundY);

      // Normalised parabola: peak height scales with the launch angle.
      const peak = Math.sin(rad) * height * 0.62;
      const path = (t: number) => ({
        x: startX + span * t,
        y: groundY - 4 * peak * t * (1 - t),
      });

      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      dashed(p, true);
      p.beginShape();
      for (let t = 0; t <= 1.001; t += 0.02) {
        const q = path(t);
        p.vertex(q.x, q.y);
      }
      p.endShape();
      dashed(p, false);

      // The travelled part is drawn solid on top.
      p.stroke(colors.accent);
      p.strokeWeight(6);
      p.beginShape();
      for (let t = 0; t <= progress + 0.0001; t += 0.02) {
        const q = path(Math.min(t, 1));
        p.vertex(q.x, q.y);
      }
      p.endShape();

      const now = path(Math.min(progress, 1));
      p.noStroke();
      p.fill(colors.accent);
      p.circle(now.x, now.y, 26);

      // The launch angle, drawn as an arc at the origin.
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(3);
      p.arc(startX, groundY, 90, 90, -rad, 0);
      label(p, Math.round(deg) + '°', startX + 74, groundY - 26, colors, 22);
    },
  },

  // -------------------------------------------------------------------------
  pendulum: {
    shape: 'square',
    label: 'Pendulum',
    describe: 'A bob swinging on a string. Use for periodic motion, period and length, energy conversion.',
    uses: 'amplitude (10-60 degrees), speed (0.5-3)',
    draw: ({ p, time, width, height, params, colors }) => {
      const amp = (num(params.amplitude, 35, 10, 60) * Math.PI) / 180;
      const speed = num(params.speed, 1.6, 0.5, 3);
      const pivotX = width / 2;
      const pivotY = height * 0.12;
      const len = height * 0.66;
      const theta = amp * Math.cos(time * speed);

      const bx = pivotX + Math.sin(theta) * len;
      const by = pivotY + Math.cos(theta) * len;

      // The swept arc, so the extent of the motion is visible in a still frame.
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.arc(pivotX, pivotY, len * 2, len * 2, Math.PI / 2 - amp, Math.PI / 2 + amp);

      p.stroke(colors.text);
      p.strokeWeight(4);
      p.line(pivotX, pivotY, bx, by);

      p.noStroke();
      p.fill(colors.dim);
      p.circle(pivotX, pivotY, 14);
      p.fill(colors.accent);
      p.circle(bx, by, 46);
    },
  },

  // -------------------------------------------------------------------------
  'vector-field': {
    shape: 'square',
    label: 'Vector field',
    describe: 'A grid of arrows showing a field. Use for gravity, electric and magnetic fields, fluid flow.',
    uses: 'mode ("radial" for a point source, "rotational" for a magnetic-style curl, "uniform" for a constant field)',
    draw: ({ p, time, width, height, params, colors }) => {
      const mode = String(params.mode || 'radial');
      const step = 62;
      const cx = width / 2;
      const cy = height / 2;

      p.stroke(colors.accent);
      p.strokeWeight(3);

      for (let x = step / 2; x < width; x += step) {
        for (let y = step / 2; y < height; y += step) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.max(24, Math.hypot(dx, dy));

          let ax: number;
          let ay: number;
          if (mode === 'rotational') {
            ax = -dy / d;
            ay = dx / d;
          } else if (mode === 'uniform') {
            ax = 1;
            ay = 0;
          } else {
            ax = -dx / d;
            ay = -dy / d;
          }

          // Pulse the length so the field reads as active, not static.
          const len = 20 * (0.7 + 0.3 * Math.sin(time * 3 - d / 60));
          const ex = x + ax * len;
          const ey = y + ay * len;
          p.line(x, y, ex, ey);
          p.push();
          p.translate(ex, ey);
          p.rotate(Math.atan2(ay, ax));
          p.line(0, 0, -8, -5);
          p.line(0, 0, -8, 5);
          p.pop();
        }
      }

      if (mode === 'radial') {
        p.noStroke();
        p.fill(colors.text);
        p.circle(cx, cy, 30);
      }
    },
  },

  // -------------------------------------------------------------------------
  particles: {
    shape: 'square',
    label: 'Particles spreading',
    describe: 'Particles scattering out from a point. Use for diffusion, gases, entropy, Brownian motion, radiation.',
    uses: 'count (20-120), speed (0.5-2)',
    draw: ({ p, progress, width, height, params, colors }) => {
      const count = Math.round(num(params.count, 70, 20, 120));
      const speed = num(params.speed, 1, 0.5, 2);
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.min(width, height) * 0.46 * speed;

      p.noStroke();
      for (let i = 0; i < count; i++) {
        // p.random is re-seeded every frame, so each particle keeps its own
        // direction from frame to frame instead of jittering.
        const a = p.random(Math.PI * 2);
        const spread = 0.35 + p.random(0.65);
        const d = reach * spread * progress;
        p.fill(colors.accent);
        p.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 9);
      }

      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.circle(cx, cy, reach * 2 * progress);
    },
  },

  // -------------------------------------------------------------------------
  graph: {
    shape: 'wide',
    label: 'Graph of a function',
    describe: 'Draws a curve on axes, revealed left to right. Use for showing how one quantity depends on another.',
    uses: 'mode ("linear", "quadratic", "cubic", "exponential", "inverse-square", "sine", "log"), labelA (x axis), labelB (y axis)',
    draw: ({ p, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'quadratic');
      const pad = 54;
      const x0 = pad;
      const y0 = height - pad;
      const w = width - pad * 2;
      const h = height - pad * 2;

      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.line(x0, y0, x0 + w, y0);
      p.line(x0, y0, x0, y0 - h);

      const f = (t: number): number => {
        switch (mode) {
          case 'linear': return t;
          case 'cubic': return t * t * t;
          case 'exponential': return (Math.pow(6, t) - 1) / 5;
          case 'inverse-square': return Math.min(1, 0.05 / Math.max(0.05, t * t));
          case 'sine': return (Math.sin(t * Math.PI * 2) + 1) / 2;
          case 'log': return Math.log(1 + t * 9) / Math.log(10);
          default: return t * t;
        }
      };

      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(6);
      p.beginShape();
      for (let t = 0; t <= progress + 0.0001; t += 0.01) {
        const tt = Math.min(t, 1);
        p.vertex(x0 + tt * w, y0 - Math.min(1, Math.max(0, f(tt))) * h);
      }
      p.endShape();

      const tip = Math.min(progress, 1);
      p.noStroke();
      p.fill(colors.accent);
      p.circle(x0 + tip * w, y0 - Math.min(1, Math.max(0, f(tip))) * h, 20);

      label(p, params.labelA || '', x0 + w / 2, y0 + 32, colors, 26);
      if (params.labelB) {
        p.push();
        p.translate(x0 - 30, y0 - h / 2);
        p.rotate(-Math.PI / 2);
        label(p, params.labelB, 0, 0, colors, 26);
        p.pop();
      }
    },
  },

  // -------------------------------------------------------------------------
  atom: {
    shape: 'square',
    label: 'Atom',
    describe: 'A nucleus with electrons circling in shells. Use for atomic structure, electron shells, isotopes, bonding.',
    uses: 'count (1-3 shells), amplitude (1-8 electrons on the outer shell), labelA (element name)',
    draw: ({ p, time, width, height, params, colors }) => {
      const shells = Math.round(num(params.count, 2, 1, 3));
      const outer = Math.round(num(params.amplitude, 4, 1, 8));
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.4;

      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      for (let s = 1; s <= shells; s++) p.circle(cx, cy, ((maxR * s) / shells) * 2);

      p.noStroke();
      p.fill(colors.accent);
      p.circle(cx, cy, 52);
      label(p, params.labelA || '', cx, cy + 2, { ...colors, dim: colors.bg }, 22);

      for (let s = 1; s <= shells; s++) {
        const r = (maxR * s) / shells;
        const n = s === shells ? outer : Math.min(2 * s * s, 8);
        const dir = s % 2 === 0 ? -1 : 1;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (time * dir * 1.2) / s;
          p.fill(colors.text);
          p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 16);
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  refraction: {
    shape: 'wide',
    label: 'Refraction',
    describe: 'A light ray bending as it crosses a boundary. Use for refraction, lenses, Snell’s law, why a straw looks bent.',
    uses: 'angle (10-70 degrees of incidence), ratio (1.1-2.4, refractive index of the lower medium), labelA / labelB (the two media)',
    draw: ({ p, width, height, params, colors }) => {
      const inc = (num(params.angle, 45, 10, 70) * Math.PI) / 180;
      const n2 = num(params.ratio, 1.5, 1.1, 2.4);
      const cx = width / 2;
      const cy = height / 2;

      // Snell: n1 sin(t1) = n2 sin(t2), with n1 = 1.
      const refr = Math.asin(Math.min(1, Math.sin(inc) / n2));

      p.noStroke();
      p.fill(colors.dim);
      p.rect(0, cy, width, height - cy);

      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.line(0, cy, width, cy);

      ctx2d(p).setLineDash([6, 8]);
      p.stroke(colors.text);
      p.strokeWeight(2);
      p.line(cx, cy - height * 0.42, cx, cy + height * 0.42);
      dashed(p, false);

      const inLen = height * 0.42;
      p.stroke(colors.accent);
      p.strokeWeight(6);
      p.line(cx - Math.sin(inc) * inLen, cy - Math.cos(inc) * inLen, cx, cy);
      p.line(cx, cy, cx + Math.sin(refr) * inLen, cy + Math.cos(refr) * inLen);

      label(p, params.labelA || '', width * 0.16, cy - 36, colors, 26);
      label(p, params.labelB || '', width * 0.16, cy + 36, colors, 26);
    },
  },

  // -------------------------------------------------------------------------
  circuit: {
    shape: 'wide',
    label: 'Circuit',
    describe: 'a source with two or three components in series or parallel. Use for: series and parallel resistance, current division, basic circuit questions',
    uses: 'mode ("series" or "parallel"), count (2-3), labelA (source), items (component labels)',
    draw: ({ p, progress, width, height, params, items, colors }) => {
      const parallel = String(params.mode || 'series') === 'parallel';
      const n = Math.round(num(params.count, Math.max(2, Math.min(3, items.length || 2)), 2, 3));
      const left = width * 0.12;
      const right = width * 0.88;
      const top = height * 0.26;
      const bottom = height * 0.76;
      const midY = (top + bottom) / 2;

      // The source, drawn as a battery on the left rail.
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.line(left, top, left, midY - 16);
      p.line(left, midY + 16, left, bottom);
      p.strokeWeight(6);
      p.line(left - 18, midY - 16, left + 18, midY - 16);
      p.strokeWeight(3);
      p.line(left - 9, midY + 16, left + 9, midY + 16);
      // Inside the loop: at the canvas edge it had nowhere to sit.
      label(p, params.labelA || '', left + 46, midY, colors, 24);

      const boxW = 84;
      const box = (x: number, y: number, text: string, lit: boolean) => {
        p.stroke(lit ? colors.accent : colors.text);
        p.strokeWeight(4);
        p.fill(colors.bg);
        p.rect(x - boxW / 2, y - 16, boxW, 32);
        p.noFill();
        label(p, text, x, y - 38, colors, 22);
      };

      if (parallel) {
        // Branches hang VERTICALLY between a top rail and a bottom rail.
        //
        // This used to run the branches horizontally between two full-height
        // vertical bus bars, which closed the outer wires into two large
        // rectangles - so a viewer saw a mystery box at each end and three
        // resistors slung between them. Rotating the branches removes the
        // rectangles entirely and gives the textbook figure instead: one rail
        // across the top, one across the bottom, components dropped between.
        const first = left + (right - left) * 0.28;
        const last = right - (right - left) * 0.06;
        const xs = n === 1
          ? [(first + last) / 2]
          : new Array(n).fill(0).map((_, i) => first + (i * (last - first)) / (n - 1));

        p.stroke(colors.text);
        p.strokeWeight(4);
        p.line(left, top, xs[xs.length - 1], top);
        p.line(left, bottom, xs[xs.length - 1], bottom);

        xs.forEach((x, i) => {
          const lit = progress > i / (n + 2);
          p.stroke(colors.text);
          p.strokeWeight(4);
          p.line(x, top, x, midY - 20);
          p.line(x, midY + 20, x, bottom);
          // A dot where a branch meets a rail, so the junction reads as joined
          // rather than as two wires crossing.
          p.noStroke();
          p.fill(colors.text);
          p.circle(x, top, 10);
          p.circle(x, bottom, 10);

          p.stroke(lit ? colors.accent : colors.text);
          p.strokeWeight(4);
          p.fill(colors.bg);
          p.rect(x - 20, midY - 20, 40, 40, 3);
          p.noFill();
          label(p, (items[i] && items[i].label) || '', x, midY + 46, colors, 22);
        });
      } else {
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.line(left, top, right, top);
        p.line(left, bottom, right, bottom);
        p.line(right, top, right, bottom);
        for (let i = 0; i < n; i++) {
          const x = left + ((i + 1) * (right - left)) / (n + 1);
          box(x, top, (items[i] && items[i].label) || '', progress > i / (n + 2));
        }
      }
    },
  },

  // -------------------------------------------------------------------------
  phasor: {
    shape: 'square',
    label: 'Phasor diagram',
    describe: 'voltage and current phasors with the angle between them, or the power triangle. Use for: power factor, leading and lagging loads, real and reactive power',
    uses: 'angle (-90 to 90 degrees), mode ("phasor" or "power-triangle"), labelA, labelB',
    draw: ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 35, -90, 90);
      const rad = (deg * Math.PI) / 180;
      const triangle = String(params.mode || 'phasor') === 'power-triangle';
      const cx = width * 0.18;
      // Room below the axis as well as above: a lagging current is drawn
      // downwards, and at 0.74 it ran off the bottom of the canvas.
      const cy = height * 0.52;
      const len = Math.min(width, height) * 0.56;
      const grow = Math.min(1, 0.3 + progress);

      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.line(cx - 20, cy, width * 0.96, cy);
      p.line(cx, cy + len * 0.75, cx, height * 0.06);

      const arrow = (a: number, l: number, colour: string, text: string) => {
        const ex = cx + Math.cos(a) * l;
        const ey = cy - Math.sin(a) * l;
        p.stroke(colour);
        p.strokeWeight(6);
        p.line(cx, cy, ex, ey);
        p.push();
        p.translate(ex, ey);
        p.rotate(-a);
        p.line(0, 0, -18, -8);
        p.line(0, 0, -18, 8);
        p.pop();
        label(p, text, ex + 18, ey - 16, colors, 24);
      };

      if (triangle) {
        const ex = cx + Math.cos(rad) * len * grow;
        const ey = cy - Math.sin(rad) * len * grow;
        arrow(rad, len * grow, colors.accent, params.labelA || 'S');
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.line(cx, cy, ex, cy);
        p.line(ex, cy, ex, ey);
        label(p, params.labelB || 'P', (cx + ex) / 2, cy + 28, colors, 22);
        label(p, 'Q', ex + 24, (cy + ey) / 2, colors, 22);
      } else {
        // Convention: a positive angle is a LAGGING current, drawn below the
        // voltage reference. Drawing it above would say "leading" to anyone who
        // reads phasor diagrams, whatever the caption claimed.
        arrow(0, len * grow, colors.text, params.labelA || 'V');
        arrow(-rad, len * grow * 0.82, colors.accent, params.labelB || 'I');
      }

      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(3);
      const a0 = Math.min(0, rad);
      const a1 = Math.max(0, rad);
      if (a1 - a0 > 0.01) p.arc(cx, cy, 132, 132, a0, a1);
      label(p, Math.abs(Math.round(deg)) + '°', cx + 104, cy + Math.sin(rad) * 48, colors, 22);
    },
  },

  // -------------------------------------------------------------------------
  waveform: {
    shape: 'wide',
    label: 'Waveform',
    describe: 'an AC waveform: two signals out of phase, or a rectified or switched output. Use for: AC theory, phase shift, rectifiers, inverters and PWM',
    uses: 'mode ("phase", "half-wave", "full-wave", "pwm"), angle (phase shift in degrees), frequency (1-4)',
    draw: ({ p, time, width, height, params, colors }) => {
      const mode = String(params.mode || 'phase');
      const k = num(params.frequency, 2, 1, 4);
      const shift = (num(params.angle, 60, -180, 180) * Math.PI) / 180;
      const mid = height / 2;
      const amp = height * 0.3;

      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.line(0, mid, width, mid);

      const plot = (fn: (x: number) => number, colour: string, weight: number) => {
        p.noFill();
        p.stroke(colour);
        p.strokeWeight(weight);
        p.beginShape();
        for (let x = 0; x <= width; x += 3) p.vertex(x, mid - fn(x) * amp);
        p.endShape();
      };

      const raw = (x: number, phase = 0) =>
        Math.sin((x / width) * Math.PI * 2 * k - time * 2 + phase);

      if (mode === 'half-wave') {
        plot((x) => raw(x), colors.dim, 3);
        plot((x) => Math.max(0, raw(x)), colors.accent, 6);
      } else if (mode === 'full-wave') {
        plot((x) => raw(x), colors.dim, 3);
        plot((x) => Math.abs(raw(x)), colors.accent, 6);
      } else if (mode === 'pwm') {
        plot((x) => raw(x) * 0.5, colors.dim, 3);
        plot((x) => (raw(x) > 0 ? 0.85 : -0.85), colors.accent, 6);
      } else {
        plot((x) => raw(x), colors.text, 5);
        plot((x) => raw(x, shift), colors.accent, 6);
      }
    },
  },

  // -------------------------------------------------------------------------
  'block-flow': {
    shape: 'wide',
    label: 'Block flow',
    describe: 'labelled boxes joined by arrows, lighting up in order - a process or plant flow. Use for: a process or plant flow: boiler to turbine to condenser, or any staged sequence',
    uses: 'items (3-5 stage labels, e.g. Boiler, Turbine, Condenser, Pump)',
    draw: ({ p, progress, width, height, items, colors }) => {
      const stages = items.slice(0, 5).map((i) => i.label).filter(Boolean);
      if (stages.length < 2) return;

      const gap = 26;
      const boxW = (width - gap * (stages.length - 1) - 20) / stages.length;
      const boxH = Math.min(96, height * 0.44);
      const y = height / 2;

      stages.forEach((text, i) => {
        const x = 10 + i * (boxW + gap);
        // Each stage lights as the narration reaches it.
        const lit = progress > (i + 0.4) / (stages.length + 0.5);

        p.stroke(lit ? colors.accent : colors.dim);
        p.strokeWeight(lit ? 5 : 3);
        p.fill(colors.bg);
        p.rect(x, y - boxH / 2, boxW, boxH, 8);

        p.noStroke();
        p.fill(lit ? colors.accent : colors.dim);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(text.length > 12 ? 20 : 24);
        p.text(text, x + boxW / 2, y);

        if (i < stages.length - 1) {
          const ax = x + boxW + 4;
          p.stroke(lit ? colors.accent : colors.dim);
          p.strokeWeight(4);
          p.line(ax, y, ax + gap - 8, y);
          p.line(ax + gap - 8, y, ax + gap - 16, y - 6);
          p.line(ax + gap - 8, y, ax + gap - 16, y + 6);
        }
      });
    },
  },

  // -------------------------------------------------------------------------
  transformer: {
    shape: 'square',
    label: 'Transformer',
    describe: 'a core with primary and secondary windings, for turns ratio and voltage transformation. Use for: turns ratio, step-up and step-down, voltage and current transformation',
    uses: 'ratio (0.2-5, secondary turns relative to primary), labelA (primary), labelB (secondary)',
    draw: ({ p, time, width, height, params, colors }) => {
      const ratio = num(params.ratio, 0.5, 0.2, 5);
      const cx = width / 2;
      const cy = height / 2;
      const coreW = width * 0.34;
      const coreH = height * 0.62;

      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(6);
      p.rect(cx - coreW / 2, cy - coreH / 2, coreW, coreH);
      p.strokeWeight(2);
      p.line(cx, cy - coreH / 2, cx, cy + coreH / 2);

      const coil = (x: number, turns: number, colour: string) => {
        p.stroke(colour);
        p.strokeWeight(5);
        p.noFill();
        const n = Math.max(3, Math.min(9, Math.round(turns)));
        const span = coreH * 0.8;
        for (let i = 0; i < n; i++) {
          const y = cy - span / 2 + (i * span) / (n - 1);
          p.arc(x, y, 52, span / n + 8, -Math.PI / 2, Math.PI / 2);
        }
      };

      coil(cx - coreW / 2, 6, colors.text);
      coil(cx + coreW / 2, 6 * ratio, colors.accent);

      // A pulse around the core shows the flux linking the two windings.
      const pulse = (Math.sin(time * 3) + 1) / 2;
      p.stroke(colors.accent);
      p.strokeWeight(2 + pulse * 3);
      p.noFill();
      p.rect(cx - coreW / 2 + 12, cy - coreH / 2 + 12, coreW - 24, coreH - 24);

      label(p, params.labelA || '', cx - coreW / 2 - 56, cy, colors, 24);
      label(p, params.labelB || '', cx + coreW / 2 + 56, cy, colors, 24);
    },
  },

  // -------------------------------------------------------------------------
  pie: {
    shape: 'square',
    label: 'Proportions',
    describe: 'a pie showing how a whole splits up - shares, losses, a fuel mix. Use for: shares, losses, a fuel mix, where the energy goes',
    uses: 'items (2-5 slices, each with a label and a value; they need not add to 100)',
    draw: ({ p, progress, width, height, items, colors }) => {
      const slices = items
        .filter((i) => Number.isFinite(Number(i.value)) && Number(i.value) > 0)
        .slice(0, 5)
        .map((i) => ({ label: i.label, value: Number(i.value) }));
      if (slices.length < 2) return;

      const total = slices.reduce((n, s) => n + s.value, 0);
      const cx = width / 2;
      const cy = height * 0.32;
      const r = Math.min(width, height) * 0.26;
      // Stepping the opacity keeps neighbours distinct however many slices
      // there are; alternating two colours fails as soon as there are three.
      const alphaFor = (i: number) => 255 - i * 42;

      let angle = -Math.PI / 2;
      slices.forEach((slice, i) => {
        const sweep = (slice.value / total) * Math.PI * 2 * Math.min(1, progress * 1.3);
        p.noStroke();
        p.fill(shade(p, colors.accent, alphaFor(i)));
        p.arc(cx, cy, r * 2, r * 2, angle, angle + sweep, p.PIE);
        angle += sweep;
      });

      // A legend below, so no label can ever run off the edge of the canvas.
      const rowH = 30;
      const top = cy + r + 34;
      slices.forEach((slice, i) => {
        const y = top + i * rowH;
        p.noStroke();
        p.fill(shade(p, colors.accent, alphaFor(i)));
        p.rect(width * 0.2, y - 9, 20, 18, 3);
        p.fill(colors.text);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(22);
        p.text(slice.label, width * 0.2 + 32, y);
        p.fill(colors.dim);
        p.textAlign(p.RIGHT, p.CENTER);
        p.text(Math.round((slice.value / total) * 100) + '%', width * 0.8, y);
      });
    },
  },
  // ---------------------------------------------------------------------------
  // Aptitude and reasoning.
  //
  // The sections added in the aptitude content mode had no diagrams at all,
  // which meant a syllogism video could not draw a Venn diagram and a clock
  // problem could not draw a clock - the two things those chapters are entirely
  // about. These fill that gap, and most of them earn their place outside
  // aptitude too: a Venn is a Venn whether it is sets or biology.
  // ---------------------------------------------------------------------------

  venn: {
    shape: 'square',
    label: 'Venn diagram',
    describe: 'two or three overlapping circles, for syllogism, sets and shared properties. Use for: syllogism, sets, shared properties, "both", classification',
    uses: 'count (2 or 3 circles), items (one label per circle), labelA (what the overlap means)',
    draw: ({ p, progress, width, height, params, items, colors }) => {
      const n = Math.round(num(params.count, 2, 2, 3));
      const cx = width / 2;
      const cy = height * 0.46;
      const r = Math.min(width, height) * (n === 3 ? 0.2 : 0.22);
      const spread = r * 0.62;

      // Grown rather than faded in: a set that arrives at full size has no
      // sense of one thing being placed against another.
      const grow = Math.min(1, progress * 2.2);

      const centres = n === 2
        ? [{ x: cx - spread, y: cy }, { x: cx + spread, y: cy }]
        : [
            { x: cx - spread, y: cy - spread * 0.5 },
            { x: cx + spread, y: cy - spread * 0.5 },
            { x: cx, y: cy + spread * 0.75 },
          ];

      p.push();
      // Additive-ish: the overlap darkens because the fills stack, which is
      // exactly the thing the diagram is trying to say.
      centres.forEach((c, i) => {
        p.noStroke();
        p.fill(shade(p, i === 1 ? colors.good : colors.accent, 78));
        p.circle(c.x, c.y, r * 2 * grow);
        p.noFill();
        p.stroke(i === 1 ? colors.good : colors.accent);
        p.strokeWeight(3);
        p.circle(c.x, c.y, r * 2 * grow);
      });
      p.pop();

      // Labels sit outside their circle, never over the overlap, which is the
      // one part of the picture that has to stay readable.
      centres.forEach((c, i) => {
        const text = items[i]?.label || '';
        if (!text) return;
        const outward = n === 2
          ? { x: c.x + (i === 0 ? -r * 0.95 : r * 0.95), y: c.y - r - 26 }
          : { x: c.x, y: i === 2 ? c.y + r + 30 : c.y - r - 26 };
        label(p, text, outward.x, outward.y, colors, 26);
      });

      if (params.labelA && progress > 0.45) {
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(24);
        p.text(String(params.labelA), cx, n === 3 ? cy + spread * 0.1 : cy);
        p.pop();
      }
    },
  },

  clock: {
    shape: 'square',
    label: 'Clock face',
    describe: 'a clock with both hands, and the angle between them marked. Use for: clock problems, angles between hands, time, anything on a dial',
    uses: 'angle (the hour, 1-12), ratio (the minute, 0-59), mode ("angle" to shade the gap between the hands)',
    draw: ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.46;
      const r = Math.min(width, height) * 0.27;

      const hour = num(params.angle, 3, 0, 12);
      const minute = num(params.ratio, 0, 0, 59);
      // Sweep both hands into place rather than snapping them, so the viewer
      // sees which way round the angle is measured.
      const t = Math.min(1, progress * 1.6);
      const minuteAngle = (minute / 60) * 360 * t - 90;
      const hourAngle = (((hour % 12) + minute / 60) / 12) * 360 * t - 90;

      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(4);
      p.circle(cx, cy, r * 2);

      // The twelve marks. The quarters are longer, which is what makes a circle
      // read as a clock rather than as a dial.
      for (let i = 0; i < 12; i++) {
        const a = p.radians(i * 30 - 90);
        const inner = r * (i % 3 === 0 ? 0.84 : 0.9);
        p.stroke(i % 3 === 0 ? colors.text : colors.dim);
        p.strokeWeight(i % 3 === 0 ? 5 : 3);
        p.line(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner,
               cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
      }
      p.pop();

      if (params.mode === 'angle' && progress > 0.35) {
        p.push();
        p.noStroke();
        p.fill(shade(p, colors.accent, 60));
        const from = p.radians(Math.min(hourAngle, minuteAngle));
        const to = p.radians(Math.max(hourAngle, minuteAngle));
        p.arc(cx, cy, r * 0.9, r * 0.9, from, to, p.PIE);
        p.pop();
      }

      const hand = (angle: number, length: number, weight: number, colour: string) => {
        const a = p.radians(angle);
        p.push();
        p.stroke(colour);
        p.strokeWeight(weight);
        p.strokeCap(p.ROUND);
        p.line(cx, cy, cx + Math.cos(a) * length, cy + Math.sin(a) * length);
        p.pop();
      };
      hand(hourAngle, r * 0.52, 11, colors.text);
      hand(minuteAngle, r * 0.78, 7, colors.accent);

      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.circle(cx, cy, 16);
      p.pop();
    },
  },

  'number-line': {
    shape: 'wide',
    label: 'Number line',
    describe: 'a line with marked points, for ranges, inequalities and where a value sits. Use for: inequalities, ranges, where a value sits, ordering, temperature',
    uses: 'items (2-6 points, each with a label and a value), labelA (left end), labelB (right end)',
    draw: ({ p, progress, width, height, items, params, colors }) => {
      const points = items
        .filter((i) => Number.isFinite(Number(i.value)))
        .slice(0, 6)
        .map((i) => ({ label: i.label, value: Number(i.value) }));
      if (!points.length) return;

      const y = height * 0.5;
      const left = width * 0.12;
      const right = width * 0.88;

      const lo = Math.min(...points.map((q) => q.value));
      const hi = Math.max(...points.map((q) => q.value));
      // A single point, or several equal ones, would divide by zero.
      const span = hi - lo || 1;
      const pad = span * 0.15;
      const at = (v: number) => left + ((v - (lo - pad)) / (span + pad * 2)) * (right - left);

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(4);
      p.line(left, y, right * Math.min(1, progress * 1.5), y);
      // Arrowheads, so it reads as continuing rather than as a bar chart axis.
      p.line(right - 18, y - 10, right, y);
      p.line(right - 18, y + 10, right, y);
      p.pop();

      label(p, String(params.labelA || ''), left, y + 44, colors, 24);
      label(p, String(params.labelB || ''), right, y + 44, colors, 24);

      points.forEach((q, i) => {
        // Staggered so a run of points does not all pop at once.
        const on = Math.min(1, Math.max(0, progress * 2.4 - i * 0.22));
        if (on <= 0) return;
        const x = at(q.value);
        p.push();
        p.noStroke();
        p.fill(colors.accent);
        p.circle(x, y, 20 * on);
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(26);
        p.text(q.label, x, y - 26);
        p.fill(colors.dim);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(22);
        p.text(String(q.value), x, y + 18);
        p.pop();
      });
    },
  },

  'ratio-bar': {
    shape: 'wide',
    label: 'Ratio bar',
    describe: 'one bar split into proportional parts, for ratios, shares and percentages. Use for: ratios, shares, percentage splits, "divided in the ratio"',
    uses: 'items (2-5 parts, each with a label and a value; they need not add to 100)',
    draw: ({ p, progress, width, height, items, colors }) => {
      const parts = items
        .filter((i) => Number.isFinite(Number(i.value)) && Number(i.value) > 0)
        .slice(0, 5)
        .map((i) => ({ label: i.label, value: Number(i.value) }));
      if (parts.length < 2) return;

      const total = parts.reduce((n, q) => n + q.value, 0);
      const left = width * 0.1;
      const barW = width * 0.8;
      const y = height * 0.4;
      const h = Math.min(120, height * 0.2);

      // Grows left to right as one bar, so the parts are read as shares of the
      // same whole rather than as separate quantities.
      const shown = barW * Math.min(1, progress * 1.4);
      let x = left;

      parts.forEach((q, i) => {
        const w = (q.value / total) * barW;
        const drawn = Math.max(0, Math.min(w, left + shown - x));
        if (drawn > 0) {
          p.push();
          p.noStroke();
          p.fill(shade(p, colors.accent, 245 - i * 44));
          p.rect(x, y, drawn, h, i === 0 ? 10 : 0, i === parts.length - 1 ? 10 : 0,
                 i === parts.length - 1 ? 10 : 0, i === 0 ? 10 : 0);
          p.pop();

          // The share is written inside the part when it is wide enough, and
          // skipped when it is not - a number overflowing its own slice is
          // worse than no number.
          const pct = Math.round((q.value / total) * 100);
          if (w > 74 && drawn > w * 0.85) {
            p.push();
            p.noStroke();
            p.fill(colors.bg);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(28);
            p.text(pct + '%', x + w / 2, y + h / 2);
            p.pop();
          }
          label(p, q.label, x + w / 2, y + h + 30, colors, 24);
        }
        x += w;
      });
    },
  },

  seating: {
    shape: 'square',
    label: 'Seating arrangement',
    describe: 'people placed around a table, for circular and linear arrangement puzzles. Use for: seating arrangement, circular arrangement, who sits where',
    uses: 'items (3-8 people, each with a label), mode ("circle" or "row"), labelA (who faces which way)',
    draw: ({ p, progress, width, height, items, params, colors }) => {
      const people = items.slice(0, 8).filter((i) => i.label);
      if (people.length < 2) return;

      const row = params.mode === 'row';
      const cx = width / 2;
      const cy = height * 0.46;

      if (row) {
        const gap = Math.min(width * 0.8 / people.length, 140);
        const startX = cx - (gap * (people.length - 1)) / 2;
        people.forEach((who, i) => {
          const on = Math.min(1, Math.max(0, progress * 2.2 - i * 0.16));
          if (on <= 0) return;
          seat(p, startX + i * gap, cy, 34 * on, who.label, colors, i === 0);
        });
      } else {
        const r = Math.min(width, height) * 0.27;
        people.forEach((who, i) => {
          const on = Math.min(1, Math.max(0, progress * 2.2 - i * 0.14));
          if (on <= 0) return;
          // Starting at the top and going clockwise, which is the convention
          // every one of these puzzles is written in.
          const a = (i / people.length) * Math.PI * 2 - Math.PI / 2;
          seat(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 34 * on, who.label, colors, i === 0);
        });
        p.push();
        p.noFill();
        p.stroke(colors.dim);
        p.strokeWeight(3);
        dashed(p, true);
        p.circle(cx, cy, r * 1.05);
        dashed(p, false);
        p.pop();
      }

      if (params.labelA) label(p, String(params.labelA), cx, height * 0.9, colors, 24);
    },
  },

  tree: {
    shape: 'wide',
    label: 'Tree / hierarchy',
    describe: 'a branching diagram, for family trees, blood relations and classifications. Use for: family trees, blood relations, hierarchies, classification, org charts',
    uses: 'items (3-7 nodes; the first is the root, the rest hang below it), labelA (what the links mean)',
    draw: ({ p, progress, width, height, items, params, colors }) => {
      const nodes = items.slice(0, 7).filter((i) => i.label);
      if (nodes.length < 2) return;

      const root = nodes[0];
      const children = nodes.slice(1);
      const rootY = height * 0.24;
      const childY = height * 0.6;
      const gap = Math.min(width * 0.78 / Math.max(1, children.length), 200);
      const startX = width / 2 - (gap * (children.length - 1)) / 2;

      // Edges first so the boxes sit on top of them, never the other way round.
      children.forEach((_, i) => {
        const on = Math.min(1, Math.max(0, progress * 2.4 - 0.2 - i * 0.14));
        if (on <= 0) return;
        const x = startX + i * gap;
        p.push();
        p.stroke(colors.dim);
        p.strokeWeight(3);
        p.noFill();
        // A shallow elbow rather than a straight diagonal: it reads as a
        // relationship, and it stays legible when two children are close.
        const midY = rootY + (childY - rootY) * 0.55;
        p.beginShape();
        p.vertex(width / 2, rootY + 34);
        p.vertex(width / 2, midY);
        p.vertex(x, midY);
        p.vertex(x, rootY + (childY - rootY) * on);
        p.endShape();
        p.pop();
      });

      node(p, width / 2, rootY, root.label, colors, true, Math.min(1, progress * 3));
      children.forEach((child, i) => {
        const on = Math.min(1, Math.max(0, progress * 2.4 - 0.4 - i * 0.14));
        if (on > 0) node(p, startX + i * gap, childY, child.label, colors, false, on);
      });

      if (params.labelA) label(p, String(params.labelA), width / 2, height * 0.9, colors, 24);
    },
  },

  histogram: {
    shape: 'wide',
    label: 'Histogram',
    describe: 'bars over categories with a value axis, for data interpretation and distributions. Use for: data interpretation, distributions, comparing several categories',
    uses: 'items (3-8 bars, each with a label and a value), labelA (what the values measure)',
    draw: ({ p, progress, width, height, items, params, colors }) => {
      const bars = items
        .filter((i) => Number.isFinite(Number(i.value)))
        .slice(0, 8)
        .map((i) => ({ label: i.label, value: Math.max(0, Number(i.value)) }));
      if (bars.length < 2) return;

      const max = Math.max(...bars.map((b) => b.value)) || 1;
      const baseY = height * 0.76;
      const top = height * 0.2;
      const left = width * 0.12;
      const barsW = width * 0.76;
      const slot = barsW / bars.length;
      const w = slot * 0.62;

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.line(left, baseY, left + barsW, baseY);
      p.line(left, baseY, left, top);
      p.pop();

      bars.forEach((b, i) => {
        // Bars rise together but not in lockstep, which stops a row of eight
        // reading as one moving block.
        const on = Math.min(1, Math.max(0, progress * 2 - i * 0.08));
        const h = (b.value / max) * (baseY - top) * on;
        const x = left + i * slot + (slot - w) / 2;
        p.push();
        p.noStroke();
        p.fill(shade(p, colors.accent, 210));
        p.rect(x, baseY - h, w, h, 6, 6, 0, 0);
        if (on > 0.9) {
          p.fill(colors.text);
          p.textAlign(p.CENTER, p.BOTTOM);
          p.textSize(22);
          p.text(String(b.value), x + w / 2, baseY - h - 8);
        }
        p.pop();
        label(p, b.label, x + w / 2, baseY + 26, colors, 22);
      });

      if (params.labelA) label(p, String(params.labelA), width / 2, height * 0.93, colors, 24);
    },
  },

  'grid-logic': {
    shape: 'square',
    label: 'Logic grid',
    describe: 'a tick-and-cross matrix, for matching puzzles and elimination reasoning. Use for: matching puzzles, elimination reasoning, two-variable logic problems',
    uses: 'items (2-4 row labels), labelA and labelB (two column headings), mode ("diagonal" to tick the diagonal)',
    draw: ({ p, progress, width, height, items, params, colors }) => {
      const rows = items.slice(0, 4).filter((i) => i.label);
      if (rows.length < 2) return;

      const cols = [params.labelA, params.labelB].filter(Boolean).map(String);
      const nCols = Math.max(2, cols.length);
      const cell = Math.min(width * 0.6 / nCols, height * 0.5 / rows.length, 130);
      const gridW = cell * nCols;
      const left = width * 0.5 - gridW / 2 + cell * 0.4;
      const top = height * 0.34;

      p.push();
      p.textAlign(p.RIGHT, p.CENTER);
      p.textSize(24);
      p.fill(colors.text);
      p.noStroke();
      rows.forEach((r, i) => p.text(r.label, left - 14, top + i * cell + cell / 2));
      p.textAlign(p.CENTER, p.BOTTOM);
      p.fill(colors.dim);
      cols.forEach((c, i) => p.text(c, left + i * cell + cell / 2, top - 12));
      p.pop();

      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < nCols; c++) {
          const idx = r * nCols + c;
          const on = Math.min(1, Math.max(0, progress * 2.6 - idx * 0.1));
          if (on <= 0) continue;
          const x = left + c * cell;
          const y = top + r * cell;
          p.push();
          p.noFill();
          p.stroke(colors.dim);
          p.strokeWeight(2);
          p.rect(x, y, cell, cell, 6);

          if (params.mode === 'diagonal' && on > 0.6) {
            const hit = r === c;
            p.strokeWeight(5);
            p.strokeCap(p.ROUND);
            const m = cell * 0.28;
            if (hit) {
              p.stroke(colors.good);
              p.line(x + cell / 2 - m, y + cell / 2, x + cell / 2 - m * 0.2, y + cell / 2 + m * 0.7);
              p.line(x + cell / 2 - m * 0.2, y + cell / 2 + m * 0.7, x + cell / 2 + m, y + cell / 2 - m * 0.6);
            } else {
              p.stroke(colors.dim);
              p.line(x + cell / 2 - m, y + cell / 2 - m, x + cell / 2 + m, y + cell / 2 + m);
              p.line(x + cell / 2 + m, y + cell / 2 - m, x + cell / 2 - m, y + cell / 2 + m);
            }
          }
          p.pop();
        }
      }
    },
  },
};

/** One person in a seating arrangement: a head, and a name under it. */
function seat(
  p: p5, x: number, y: number, r: number, name: string, colors: SketchColors, first: boolean,
) {
  p.push();
  p.noStroke();
  // Both branches must be a Color, not a string: p5's fill() has no overload
  // for the union, so a ternary mixing the two does not type-check.
  p.fill(shade(p, colors.accent, first ? 255 : 120));
  p.circle(x, y, r * 2);
  p.fill(colors.text);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(22);
  p.text(name.slice(0, 3), x, y + r + 22);
  p.pop();
}

/** One labelled box in a tree. */
function node(
  p: p5, x: number, y: number, text: string, colors: SketchColors, root: boolean, on: number,
) {
  const w = Math.max(90, text.length * 15 + 28) * on;
  const h = 56 * on;
  p.push();
  p.noStroke();
  p.fill(shade(p, colors.accent, root ? 255 : 110));
  p.rect(x - w / 2, y - h / 2, w, h, 10);
  p.fill(root ? colors.bg : colors.text);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(24 * Math.min(1, on));
  if (on > 0.5) p.text(text, x, y);
  p.pop();
}

/**
 * The whole library, in one flat record.
 *
 * Split across two files only for size - the model sees a single list of names
 * and neither it nor the renderer knows or cares which file an entry came from.
 */
export const SKETCHES: Record<string, SketchDef> = {
  ...CORE_SKETCHES, ...EXTRA_SKETCHES, ...MORE_SKETCHES, ...GAP_SKETCHES,
};

export const SKETCH_NAMES = Object.keys(SKETCHES);
