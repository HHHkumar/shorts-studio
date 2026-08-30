import type p5 from 'p5';
import type { SketchArgs } from './P5Sketch';

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

export const SKETCHES: Record<string, SketchDef> = {
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
    describe: 'a source with two or three components in series or parallel',
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
        const branchL = left + (right - left) * 0.3;
        const branchR = right - (right - left) * 0.12;
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.line(left, top, branchL, top);
        p.line(left, bottom, branchL, bottom);
        p.line(branchR, top, right, top);
        p.line(branchR, bottom, right, bottom);
        p.line(right, top, right, bottom);
        p.line(branchL, top, branchL, bottom);
        p.line(branchR, top, branchR, bottom);

        const bx = (branchL + branchR) / 2;
        for (let i = 0; i < n; i++) {
          const y = top + ((i + 1) * (bottom - top)) / (n + 1);
          p.stroke(colors.text);
          p.strokeWeight(4);
          p.line(branchL, y, bx - boxW / 2, y);
          p.line(bx + boxW / 2, y, branchR, y);
          box(bx, y, (items[i] && items[i].label) || '', progress > i / (n + 2));
        }
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
    describe: 'voltage and current phasors with the angle between them, or the power triangle',
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
    describe: 'an AC waveform: two signals out of phase, or a rectified or switched output',
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
    describe: 'labelled boxes joined by arrows, lighting up in order - a process or plant flow',
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
    describe: 'a core with primary and secondary windings, for turns ratio and voltage transformation',
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
    describe: 'a pie showing how a whole splits up - shares, losses, a fuel mix',
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
};

export const SKETCH_NAMES = Object.keys(SKETCHES);
