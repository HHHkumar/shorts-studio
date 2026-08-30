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

export interface DrawArgs extends SketchArgs {
  params: SketchParams;
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
};

export const SKETCH_NAMES = Object.keys(SKETCHES);
