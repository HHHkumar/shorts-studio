import type p5 from 'p5';
import type { SketchDef } from './sketches';
import {
  arcArrow, arrow, axes, bars, battery, beaker, box, bubble, capacitor, caption, clean, curve,
  ground, inductor, junction, labels, lamp, num, resistor, safe, setDash, spread, stagger,
  switchSym, tint, title, values, wire,
} from './sketch-parts';

// ---------------------------------------------------------------------------
// The rest of the illustration library.
//
// Split out of sketches.ts purely for size: that file holds the original set
// and the type definitions, this one holds everything added since. They are
// merged into one record at the bottom of sketches.ts, and the model sees a
// single flat list of names either way.
//
// The rules from sketch-parts.ts apply to every entry here, and the test in
// sketches.test.mjs enforces them: no throw on any input, no NaN coordinate, no
// drawing off the canvas, and an entry in the server catalogue with the same
// name. A sketch that only works when the model sends perfect data is a sketch
// that produces blank scenes in finished videos.
// ---------------------------------------------------------------------------

const wide = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'wide', label, describe, uses, draw });

const square = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'square', label, describe, uses, draw });

export const EXTRA_SKETCHES: Record<string, SketchDef> = {

  // =========================================================================
  // Mechanics
  // =========================================================================

  lever: wide('Lever', 'a beam on a pivot with loads either side',
    'ratio (0.2-3, where the pivot sits), labelA (left load), labelB (right load)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.56;
      const half = width * 0.34;
      const at = num(params.ratio, 1, 0.2, 3);
      const pivot = cx + (at - 1) * half * 0.4;
      // Tilts towards whichever side has the longer arm, settling as it goes.
      const tilt = ((pivot - cx) / safe(half)) * 0.28 * Math.min(1, progress * 1.6);

      p.push();
      p.translate(pivot, cy);
      p.rotate(tilt);
      p.stroke(colors.text);
      p.strokeWeight(10);
      p.line(-(pivot - (cx - half)), 0, (cx + half) - pivot, 0);
      p.pop();

      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.triangle(pivot, cy + 8, pivot - 26, cy + 58, pivot + 26, cy + 58);
      p.pop();

      caption(p, String(params.labelA || 'Effort'), cx - half, cy - 54, colors);
      caption(p, String(params.labelB || 'Load'), cx + half, cy - 54, colors);
      caption(p, 'Pivot', pivot, cy + 82, colors, 22);
    }),

  pulley: square('Pulley', 'one or two wheels with a rope and a hanging load',
    'count (1-2 pulleys), labelA (the load)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 1, 1, 2));
      const cy = height * 0.26;
      const r = Math.min(width, height) * 0.1;
      const xs = spread(n, width * 0.38, width * 0.62);
      const drop = height * 0.3 + Math.sin(progress * Math.PI) * 18;

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(6);
      p.line(width * 0.2, cy - r - 24, width * 0.8, cy - r - 24);
      p.pop();

      xs.forEach((x) => {
        p.push();
        p.noFill();
        p.stroke(colors.text);
        p.strokeWeight(5);
        p.circle(x, cy, r * 2);
        p.pop();
        junction(p, x, cy, colors.accent, 10);
        wire(p, x, cy - r - 24, x, cy - r, colors.dim, 4);
      });

      const load = xs[xs.length - 1];
      wire(p, xs[0] - r, cy, xs[0] - r, cy + drop, colors.accent, 4);
      wire(p, load + r, cy, load + r, cy + drop * 0.7, colors.accent, 4);
      box(p, load + r, cy + drop * 0.7 + 34, 92, 56, clean(params.labelA, 8) || 'Load', colors);
    }),

  incline: wide('Inclined plane', 'a block on a slope with its forces marked',
    'angle (10-60 degrees), labelA (the block)',
    ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 30, 10, 60);
      const rad = (deg * Math.PI) / 180;
      const x0 = width * 0.12;
      const y0 = height * 0.8;
      const run = width * 0.7;
      const rise = run * Math.tan(rad);
      const topY = Math.max(height * 0.14, y0 - rise);

      p.push();
      p.noStroke();
      p.fill(tint(p, colors.dim, 60));
      p.triangle(x0, y0, x0 + run, y0, x0 + run, topY);
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.noFill();
      p.triangle(x0, y0, x0 + run, y0, x0 + run, topY);
      p.pop();

      // Slides down the slope as the scene plays.
      const t = 0.15 + progress * 0.6;
      const bx = x0 + run * (1 - t);
      const by = y0 - (y0 - topY) * (1 - t);
      p.push();
      p.translate(bx, by);
      p.rotate(-Math.atan2(y0 - topY, run));
      p.noStroke();
      p.fill(colors.accent);
      p.rect(-26, -34, 52, 34, 5);
      p.pop();

      arrow(p, bx, by - 8, bx, by + 62, colors.dim, 4);
      caption(p, 'Weight', bx + 44, by + 52, colors, 20);
      caption(p, deg + '°', x0 + run - 56, y0 - 16, colors, 24);
      caption(p, clean(params.labelA, 12), bx, by - 52, colors, 22);
    }),

  gears: wide('Gears', 'two meshed gears turning in opposite directions',
    'ratio (1-4, size of the second gear), speed (1-5)',
    ({ p, time, width, height, params, colors }) => {
      const ratio = num(params.ratio, 2, 1, 4);
      const speed = num(params.speed, 2, 1, 5);
      const r1 = Math.min(width, height) * 0.19;
      const r2 = r1 * ratio;
      const cy = height * 0.5;
      const cx1 = width * 0.5 - r2 * 0.7;
      const cx2 = cx1 + r1 + r2;

      const gear = (cx: number, r: number, teeth: number, spin: number) => {
        p.push();
        p.translate(cx, cy);
        p.rotate(spin);
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.fill(colors.bg);
        p.circle(0, 0, r * 2);
        for (let i = 0; i < teeth; i++) {
          const a = (i / safe(teeth)) * Math.PI * 2;
          p.push();
          p.rotate(a);
          p.noStroke();
          p.fill(colors.accent);
          p.rect(r - 4, -7, 16, 14, 3);
          p.pop();
        }
        p.noStroke();
        p.fill(colors.dim);
        p.circle(0, 0, r * 0.3);
        p.pop();
      };

      const turn = time * speed * 0.5;
      gear(cx1, r1, 10, turn);
      gear(cx2, r2, Math.round(10 * ratio), -turn / safe(ratio));
      caption(p, '1 : ' + Math.round(ratio), width / 2, height * 0.9, colors, 24);
    }),

  spring: wide('Spring and mass', 'a mass on a spring oscillating',
    'frequency (1-5), amplitude (0.2-1)',
    ({ p, time, width, height, params, colors }) => {
      const f = num(params.frequency, 2, 1, 5);
      const amp = num(params.amplitude, 0.6, 0.2, 1) * height * 0.16;
      const cx = width / 2;
      const anchor = height * 0.18;
      const rest = height * 0.55;
      const y = rest + Math.sin(time * f * 2) * amp;

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(6);
      p.line(cx - 90, anchor, cx + 90, anchor);
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(4);
      p.beginShape();
      const coils = 9;
      for (let i = 0; i <= coils * 8; i++) {
        const t = i / (coils * 8);
        p.vertex(cx + Math.sin(t * coils * Math.PI * 2) * 26, anchor + t * (y - anchor));
      }
      p.endShape();
      p.pop();

      box(p, cx, y + 34, 96, 64, 'm', colors, { lit: true });
      arrow(p, cx + 90, rest - amp, cx + 90, rest + amp, colors.dim, 3, 11);
    }),

  collision: wide('Collision', 'two bodies meeting and rebounding',
    'ratio (0.2-3, mass of the second body), mode ("elastic" or "inelastic")',
    ({ p, progress, width, height, params, colors }) => {
      const massRatio = num(params.ratio, 1, 0.2, 3);
      const inelastic = String(params.mode || '') === 'inelastic';
      const cy = height * 0.5;
      const r1 = 34;
      const r2 = 34 * Math.cbrt(massRatio);
      const hit = 0.5;

      let x1: number;
      let x2: number;
      if (progress < hit) {
        const t = progress / hit;
        x1 = width * 0.16 + t * (width * 0.5 - r1 - width * 0.16);
        x2 = width * 0.84 - t * (width * 0.84 - (width * 0.5 + r2));
      } else {
        const t = (progress - hit) / safe(1 - hit);
        if (inelastic) {
          x1 = width * 0.5 - r1 + t * width * 0.1;
          x2 = width * 0.5 + r2 + t * width * 0.1;
        } else {
          x1 = width * 0.5 - r1 - t * width * 0.3 / safe(massRatio);
          x2 = width * 0.5 + r2 + t * width * 0.3 * Math.min(2, massRatio);
        }
      }

      bubble(p, x1, cy, r1, 'A', colors, { lit: true });
      bubble(p, x2, cy, r2, 'B', colors);
      if (Math.abs(progress - hit) < 0.06) {
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 150));
        p.circle(width * 0.5, cy, 90);
        p.pop();
      }
      caption(p, inelastic ? 'They stick together' : 'They bounce apart', width / 2, height * 0.86, colors);
    }),

  friction: wide('Friction', 'a block pulled across a surface, with the forces named',
    'labelA (what is being pulled)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.6;
      const x = width * 0.28 + progress * width * 0.3;
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(5);
      p.line(width * 0.1, cy + 30, width * 0.9, cy + 30);
      // Hatching under the ground line, the standard way of saying "fixed".
      for (let i = 0; i < 16; i++) {
        const hx = width * 0.1 + (i / 16) * width * 0.8;
        p.line(hx, cy + 30, hx - 14, cy + 48);
      }
      p.pop();
      box(p, x, cy, 100, 60, clean(params.labelA, 8), colors, { lit: true });
      arrow(p, x + 54, cy, x + 130, cy, colors.accent, 4);
      caption(p, 'Pull', x + 96, cy - 26, colors, 20);
      arrow(p, x - 54, cy + 16, x - 128, cy + 16, colors.dim, 4);
      caption(p, 'Friction', x - 96, cy + 44, colors, 20);
    }),

  torque: square('Torque', 'a force applied at a distance from a pivot',
    'angle (0-90, where the force is applied), labelA (the force)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.55;
      const r = Math.min(width, height) * 0.3;
      const deg = num(params.angle, 40, 0, 90);
      const a = -(deg * Math.PI) / 180;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;

      p.push();
      p.stroke(colors.text);
      p.strokeWeight(7);
      p.line(cx, cy, px, py);
      p.pop();
      junction(p, cx, cy, colors.accent, 22);
      arrow(p, px, py, px + Math.cos(a - Math.PI / 2) * 74, py + Math.sin(a - Math.PI / 2) * 74,
            colors.accent, 5);
      arcArrow(p, cx, cy, r * 0.42, -0.2, -0.2 + progress * 1.2, colors.dim, 3);
      caption(p, clean(params.labelA, 10) || 'Force', px + 40, py - 46, colors);
      caption(p, 'r', (cx + px) / 2, (cy + py) / 2 + 26, colors, 22);
    }),

  'free-fall': wide('Free fall', 'objects dropped together, falling at the same rate',
    'count (1-3 objects), labelA (the surface, e.g. "vacuum")',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 2, 1, 3));
      const xs = spread(n, width * 0.3, width * 0.7);
      const top = height * 0.16;
      const floor = height * 0.82;
      // s = ut + at^2/2 with u = 0: the shape is the point.
      const fall = Math.min(1, progress * progress * 1.25);
      xs.forEach((x, i) => {
        const y = top + (floor - top) * fall;
        p.push();
        p.noStroke();
        p.fill(i === 0 ? colors.accent : colors.text);
        p.circle(x, y, 30 + i * 10);
        p.pop();
        setDash(p, true, [5, 9]);
        wire(p, x, top, x, y, colors.dim, 2);
        setDash(p, false);
      });
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(5);
      p.line(width * 0.14, floor + 22, width * 0.86, floor + 22);
      p.pop();
      caption(p, clean(params.labelA, 18), width / 2, height * 0.94, colors);
    }),

  buoyancy: square('Buoyancy', 'an object floating or sinking, with the displaced water shown',
    'ratio (0.2-2, density against the liquid)',
    ({ p, progress, width, height, params, colors }) => {
      const density = num(params.ratio, 0.6, 0.2, 2);
      const w = width * 0.6;
      const h = height * 0.5;
      const x = width / 2;
      const y = height * 0.55;
      const surface = y - h / 2;
      const size = Math.min(width, height) * 0.2;
      // Floats with the fraction of itself submerged equal to the density
      // ratio, which is the whole of Archimedes in one line.
      const sunk = Math.min(1, density) * size;
      const rest = surface - size / 2 + sunk;
      const cy = surface - size + (rest - (surface - size)) * Math.min(1, progress * 1.5);

      p.push();
      p.noStroke();
      p.fill(tint(p, colors.accent, 70));
      p.rect(x - w / 2, surface, w, h);
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.line(x - w / 2, surface, x - w / 2, y + h / 2);
      p.line(x - w / 2, y + h / 2, x + w / 2, y + h / 2);
      p.line(x + w / 2, y + h / 2, x + w / 2, surface);
      p.pop();

      p.push();
      p.noStroke();
      p.fill(colors.text);
      p.rect(x - size / 2, cy - size / 2, size, size, 6);
      p.pop();
      arrow(p, x, cy + size, x, cy + 16, colors.accent, 4);
      caption(p, density < 1 ? 'It floats' : 'It sinks', width / 2, height * 0.9, colors);
    }),

  momentum: wide('Momentum', 'mass and velocity combining into one quantity',
    'items (2 bodies with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 2);
      if (vs.length < 2) return;
      const cy = height * 0.46;
      const max = Math.max(...vs.map((v) => Math.abs(v.value)), 1);
      vs.forEach((v, i) => {
        const x = width * (i === 0 ? 0.28 : 0.72);
        const r = 26 + (Math.abs(v.value) / safe(max)) * 34;
        bubble(p, x, cy, r, '', colors, { lit: i === 0 });
        const len = (v.value / safe(max)) * width * 0.16 * stagger(progress, i, 0.2);
        if (Math.abs(len) > 2) arrow(p, x, cy, x + len, cy, colors.accent, 5);
        caption(p, v.label, x, cy + r + 34, colors);
        caption(p, String(v.value), x, cy + r + 62, colors, 20);
      });
      caption(p, 'p = m v', width / 2, height * 0.88, colors, 26);
    }),

  // =========================================================================
  // Waves, light and sound
  // =========================================================================

  reflection: wide('Reflection', 'a ray bouncing off a surface at an equal angle',
    'angle (10-80 degrees)',
    ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 45, 10, 80);
      const rad = (deg * Math.PI) / 180;
      const cx = width / 2;
      const surf = height * 0.7;
      const len = Math.min(width, height) * 0.55;

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(5);
      p.line(width * 0.1, surf, width * 0.9, surf);
      setDash(p, true);
      p.strokeWeight(2);
      p.line(cx, surf - len, cx, surf);
      setDash(p, false);
      p.pop();

      const dx = Math.sin(rad) * len;
      const dy = Math.cos(rad) * len;
      const t = Math.min(1, progress * 2);
      arrow(p, cx - dx, surf - dy, cx - dx * (1 - t), surf - dy * (1 - t), colors.accent, 4);
      if (progress > 0.5) {
        const t2 = Math.min(1, (progress - 0.5) * 2);
        arrow(p, cx, surf, cx + dx * t2, surf - dy * t2, colors.good, 4);
      }
      caption(p, deg + '°', cx - 46, surf - 34, colors, 22);
      caption(p, deg + '°', cx + 46, surf - 34, colors, 22);
      caption(p, 'Normal', cx, surf - len - 22, colors, 20);
    }),

  lens: wide('Lens', 'rays converging or diverging through a lens',
    'mode ("convex" or "concave"), labelA (the object)',
    ({ p, progress, width, height, params, colors }) => {
      const concave = String(params.mode || 'convex') === 'concave';
      const cx = width / 2;
      const cy = height / 2;
      const lh = height * 0.5;

      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      setDash(p, true);
      p.line(0, cy, width, cy);
      setDash(p, false);
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      // Two arcs facing each other make a convex lens; facing away, concave.
      const bulge = concave ? -1 : 1;
      p.beginShape();
      for (let t = 0; t <= 1; t += 0.05) {
        p.vertex(cx - Math.sin(t * Math.PI) * 22 * bulge, cy - lh / 2 + t * lh);
      }
      p.endShape();
      p.beginShape();
      for (let t = 0; t <= 1; t += 0.05) {
        p.vertex(cx + Math.sin(t * Math.PI) * 22 * bulge, cy - lh / 2 + t * lh);
      }
      p.endShape();
      p.pop();

      const focal = width * 0.2;
      const t = Math.min(1, progress * 1.6);
      [-1, 0, 1].forEach((k) => {
        const y = cy + k * lh * 0.3;
        arrow(p, width * 0.06, y, cx - 24, y, colors.text, 3, 10);
        if (t > 0.4) {
          const endX = cx + focal * 2;
          const endY = concave ? y + k * lh * 0.4 : cy;
          const tt = Math.min(1, (t - 0.4) / 0.6);
          arrow(p, cx + 24, y, cx + 24 + (endX - cx - 24) * tt, y + (endY - y) * tt, colors.good, 3, 10);
        }
      });
      junction(p, cx + focal, cy, colors.accent, 12);
      caption(p, concave ? 'Diverging' : 'Focus', cx + focal, cy + 34, colors, 20);
      caption(p, clean(params.labelA, 14), width * 0.12, cy - 40, colors, 20);
    }),

  prism: wide('Prism', 'white light splitting into a spectrum',
    'angle (30-70, the prism angle)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width * 0.46;
      const cy = height * 0.5;
      const size = Math.min(width, height) * 0.32;

      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.triangle(cx, cy - size, cx - size * 0.86, cy + size * 0.6, cx + size * 0.86, cy + size * 0.6);
      p.pop();

      arrow(p, width * 0.06, cy, cx - size * 0.3, cy, colors.text, 4);
      const bands = ['#ff4d4d', '#ff9f43', '#ffd400', '#3ddc97', '#4c9aff', '#a76bff'];
      const t = Math.min(1, Math.max(0, (progress - 0.3) * 2));
      bands.forEach((hex, i) => {
        const spreadA = (i - 2.5) * 0.07;
        const x2 = cx + size * 0.3 + width * 0.34 * t;
        const y2 = cy + spreadA * width * 0.34 * t + 20;
        p.push();
        p.stroke(hex);
        p.strokeWeight(5);
        p.line(cx + size * 0.3, cy + 6, x2, y2);
        p.pop();
      });
      caption(p, 'White light', width * 0.14, cy - 34, colors, 20);
    }),

  'standing-wave': wide('Standing wave', 'a wave with fixed nodes and moving antinodes',
    'count (1-5 loops), frequency (1-5)',
    ({ p, time, width, height, params, colors }) => {
      const loops = Math.round(num(params.count, 3, 1, 5));
      const f = num(params.frequency, 2, 1, 5);
      const cy = height / 2;
      const left = width * 0.1;
      const right = width * 0.9;
      const amp = height * 0.22 * Math.sin(time * f * 2);

      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      setDash(p, true);
      p.beginShape();
      for (let x = left; x <= right; x += 6) {
        const t = (x - left) / safe(right - left);
        p.vertex(x, cy - Math.sin(t * Math.PI * loops) * height * 0.22);
      }
      p.endShape();
      setDash(p, false);
      p.stroke(colors.accent);
      p.strokeWeight(6);
      p.beginShape();
      for (let x = left; x <= right; x += 4) {
        const t = (x - left) / safe(right - left);
        p.vertex(x, cy - Math.sin(t * Math.PI * loops) * amp);
      }
      p.endShape();
      p.pop();

      for (let i = 0; i <= loops; i++) {
        junction(p, left + (i / safe(loops)) * (right - left), cy, colors.text, 12);
      }
      caption(p, 'Nodes stay still', width / 2, height * 0.88, colors);
    }),

  doppler: wide('Doppler effect', 'a moving source bunching its waves ahead of it',
    'speed (1-5, how fast the source moves)',
    ({ p, progress, time, width, height, params, colors }) => {
      const speed = num(params.speed, 3, 1, 5);
      const cy = height / 2;
      const x = width * 0.2 + progress * width * 0.6;
      p.push();
      p.noFill();
      for (let i = 0; i < 6; i++) {
        const age = ((time * speed * 0.4) % 1) + i;
        const r = age * Math.min(width, height) * 0.14;
        const emitted = x - (age / safe(speed)) * width * 0.16 * speed;
        p.stroke(tint(p, colors.accent, Math.max(0, 200 - age * 34)));
        p.strokeWeight(3);
        p.circle(emitted, cy, r * 2);
      }
      p.pop();
      p.push();
      p.noStroke();
      p.fill(colors.text);
      p.circle(x, cy, 28);
      p.pop();
      caption(p, 'Bunched ahead', width * 0.82, cy - height * 0.28, colors, 20);
      caption(p, 'Stretched behind', width * 0.18, cy + height * 0.3, colors, 20);
    }),

  diffraction: wide('Diffraction', 'waves spreading after passing through a gap',
    'amplitude (0.2-1, how wide the gap is)',
    ({ p, time, width, height, params, colors }) => {
      const gap = num(params.amplitude, 0.4, 0.2, 1) * height * 0.3;
      const barX = width * 0.42;
      const cy = height / 2;

      p.push();
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(3);
      for (let i = 0; i < 7; i++) {
        const x = width * 0.06 + ((i * 34 + time * 40) % (barX - width * 0.06));
        p.line(x, cy - height * 0.34, x, cy + height * 0.34);
      }
      for (let i = 0; i < 7; i++) {
        const r = ((i * 40 + time * 40) % (width * 0.5));
        p.arc(barX, cy, r * 2, r * 2, -Math.PI / 2.1, Math.PI / 2.1);
      }
      p.stroke(colors.text);
      p.strokeWeight(9);
      p.line(barX, 0, barX, cy - gap);
      p.line(barX, cy + gap, barX, height);
      p.pop();
      caption(p, 'Gap', barX + 54, cy, colors, 20);
    }),

  // =========================================================================
  // Heat, gases and fluids
  // =========================================================================

  'heat-transfer': wide('Heat transfer', 'heat moving from a hot body to a cold one',
    'labelA (hot side), labelB (cold side), mode ("conduction", "convection" or "radiation")',
    ({ p, time, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'conduction');
      const cy = height / 2;
      const hx = width * 0.2;
      const cx2 = width * 0.8;
      p.push();
      p.noStroke();
      p.fill('#ff6b6b');
      p.rect(hx - 70, cy - 90, 140, 180, 10);
      p.fill('#5aa9e6');
      p.rect(cx2 - 70, cy - 90, 140, 180, 10);
      p.pop();
      title(p, clean(params.labelA, 10) || 'Hot', hx, cy, colors, 26);
      title(p, clean(params.labelB, 10) || 'Cold', cx2, cy, colors, 26);

      const n = 5;
      for (let i = 0; i < n; i++) {
        const t = ((time * 0.4 + i / n) % 1);
        const x = hx + 74 + t * (cx2 - 74 - hx - 74);
        const wobble = mode === 'convection' ? Math.sin(t * Math.PI * 3) * 26 : 0;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 220 * (1 - Math.abs(t - 0.5) * 0.8)));
        p.circle(x, cy + wobble, mode === 'radiation' ? 10 : 16);
        p.pop();
      }
      caption(p, mode, width / 2, height * 0.86, colors);
    }),

  'phase-change': wide('Phase change', 'a heating curve with flat plateaus at each change of state',
    'labelA (the substance)',
    ({ p, progress, width, height, params, colors }) => {
      const plot = axes(p, width, height, colors, { x: 'Heat added', y: 'Temp' });
      // Rise, plateau, rise, plateau, rise: the shape IS the lesson.
      const fn = (t: number) => {
        if (t < 0.16) return t / 0.16 * 0.22;
        if (t < 0.36) return 0.22;
        if (t < 0.62) return 0.22 + ((t - 0.36) / 0.26) * 0.4;
        if (t < 0.84) return 0.62;
        return 0.62 + ((t - 0.84) / 0.16) * 0.3;
      };
      curve(p, plot, fn, colors.accent, progress);
      caption(p, 'Melting', plot.x(0.26), plot.y(0.22) - 26, colors, 20);
      caption(p, 'Boiling', plot.x(0.73), plot.y(0.62) - 26, colors, 20);
      caption(p, clean(params.labelA, 16), width / 2, height * 0.93, colors);
    }),

  'gas-laws': wide('Gas laws', 'a piston squeezing a gas, with pressure rising as volume falls',
    'ratio (0.3-1, how far it is compressed)',
    ({ p, progress, width, height, params, colors }) => {
      const squeeze = num(params.ratio, 0.5, 0.3, 1);
      const left = width * 0.16;
      const cy = height / 2;
      const h = height * 0.44;
      const full = width * 0.5;
      const len = full * (1 - (1 - squeeze) * Math.min(1, progress * 1.4));

      p.push();
      p.noStroke();
      p.fill(tint(p, colors.accent, 60));
      p.rect(left, cy - h / 2, len, h);
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.line(left, cy - h / 2, left, cy + h / 2);
      p.line(left, cy - h / 2, left + full + 60, cy - h / 2);
      p.line(left, cy + h / 2, left + full + 60, cy + h / 2);
      p.fill(colors.dim);
      p.rect(left + len, cy - h / 2, 22, h);
      p.pop();

      // More molecules per unit area is the point, so the count is fixed and
      // the box shrinks around them.
      for (let i = 0; i < 22; i++) {
        const x = left + 14 + ((i * 37) % Math.max(1, len - 28));
        const y = cy - h / 2 + 14 + ((i * 53) % Math.max(1, h - 28));
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.circle(x, y, 9);
        p.pop();
      }
      arrow(p, left + full + 90, cy, left + len + 40, cy, colors.accent, 5);
      caption(p, 'Volume down, pressure up', width / 2, height * 0.9, colors);
    }),

  bernoulli: wide('Bernoulli', 'fluid speeding up through a narrow section',
    'ratio (0.2-0.8, how narrow the throat is)',
    ({ p, time, width, height, params, colors }) => {
      const throat = num(params.ratio, 0.4, 0.2, 0.8);
      const cy = height / 2;
      const wide0 = height * 0.34;
      const narrow = wide0 * throat;
      const shape = (x: number) => {
        const t = x / safe(width);
        const k = Math.exp(-Math.pow((t - 0.5) * 5, 2));
        return wide0 - (wide0 - narrow) * k;
      };
      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.beginShape();
      for (let x = 0; x <= width; x += 8) p.vertex(x, cy - shape(x));
      p.endShape();
      p.beginShape();
      for (let x = 0; x <= width; x += 8) p.vertex(x, cy + shape(x));
      p.endShape();
      p.pop();

      for (let i = 0; i < 14; i++) {
        const t = ((time * 0.35 + i / 14) % 1);
        const x = t * width;
        const y = cy + (((i % 3) - 1) * shape(x) * 0.5);
        const fast = shape(x) < wide0 * 0.7;
        p.push();
        p.noStroke();
        p.fill(fast ? colors.accent : colors.dim);
        p.circle(x, y, fast ? 13 : 10);
        p.pop();
      }
      caption(p, 'Narrow = faster = lower pressure', width / 2, height * 0.9, colors);
    }),

  // =========================================================================
  // Chemistry
  // =========================================================================

  molecule: square('Molecule', 'atoms joined by bonds',
    'count (2-5 outer atoms), labelA (centre atom), items (outer atom labels)',
    ({ p, progress, width, height, params, items, colors }) => {
      const n = Math.round(num(params.count, 3, 2, 5));
      const names = labels(items, 5);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.24;
      for (let i = 0; i < n; i++) {
        const a = (i / safe(n)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const on = stagger(progress, i, 0.14);
        if (on <= 0) continue;
        wire(p, cx, cy, cx + (x - cx) * on, cy + (y - cy) * on, colors.dim, 5);
        bubble(p, x, y, 30 * on, names[i] || '', colors);
      }
      bubble(p, cx, cy, 42, clean(params.labelA, 3) || 'C', colors, { lit: true, size: 26 });
    }),

  'ph-scale': wide('pH scale', 'where a substance sits from acid to alkali',
    'ratio (0-14, the pH), labelA (the substance)',
    ({ p, progress, width, height, params, colors }) => {
      const ph = num(params.ratio, 7, 0, 14);
      const left = width * 0.1;
      const right = width * 0.9;
      const y = height * 0.5;
      const h = 52;
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = left + t * (right - left);
        const w = (right - left) / steps;
        // Red through green to blue, the colours a real indicator chart uses.
        const hex = i < 6 ? '#ff5b5b' : i < 8 ? '#3ddc97' : '#4c9aff';
        p.push();
        p.noStroke();
        p.fill(tint(p, hex, 120 + Math.abs(7 - i) * 9));
        p.rect(x, y - h / 2, w + 1, h);
        p.pop();
      }
      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(3);
      p.rect(left, y - h / 2, right - left, h, 4);
      p.pop();
      caption(p, 'Acid  0', left + 40, y + 56, colors, 20);
      caption(p, '14  Alkali', right - 44, y + 56, colors, 20);
      const px = left + (ph / 14) * (right - left);
      const t = Math.min(1, progress * 1.6);
      arrow(p, px, y - h / 2 - 70 * t - 8, px, y - h / 2 - 8, colors.accent, 5);
      title(p, clean(params.labelA, 14) + ' pH ' + Math.round(ph), px, y - h / 2 - 92, colors, 24);
    }),

  titration: wide('Titration', 'liquid added drop by drop until the colour turns',
    'ratio (0-1, how far through the titration)',
    ({ p, progress, width, height, params, colors }) => {
      const endPoint = num(params.ratio, 0.7, 0.1, 0.95);
      const cx = width / 2;
      const t = Math.min(1, progress);
      const turned = t >= endPoint;

      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.rect(cx - 18, height * 0.08, 36, height * 0.34, 4);
      p.pop();
      p.push();
      p.noStroke();
      p.fill(tint(p, colors.accent, 140));
      const burette = height * 0.34 * (1 - t);
      p.rect(cx - 14, height * 0.08 + (height * 0.34 - burette), 28, burette);
      p.pop();

      if (!turned) {
        const dy = ((progress * 5) % 1) * height * 0.12;
        p.push();
        p.noStroke();
        p.fill(colors.accent);
        p.circle(cx, height * 0.46 + dy, 12);
        p.pop();
      }
      beaker(p, cx, height * 0.72, width * 0.24, height * 0.28, 0.6,
             tint(p, turned ? '#ff5bb0' : colors.accent, 120), colors);
      caption(p, turned ? 'End point — colour changed' : 'Adding…', cx, height * 0.95, colors);
    }),

  electrolysis: wide('Electrolysis', 'two electrodes in a solution with ions moving to each',
    'labelA (cathode), labelB (anode)',
    ({ p, time, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.56;
      const w = width * 0.5;
      const h = height * 0.44;
      beaker(p, cx, cy, w, h, 0.85, tint(p, colors.accent, 46), colors);
      const lx = cx - w * 0.24;
      const rx = cx + w * 0.24;
      p.push();
      p.noStroke();
      p.fill(colors.dim);
      p.rect(lx - 12, cy - h * 0.62, 24, h * 0.9, 3);
      p.rect(rx - 12, cy - h * 0.62, 24, h * 0.9, 3);
      p.pop();
      battery(p, cx, cy - h * 0.78, colors);
      wire(p, lx, cy - h * 0.62, lx, cy - h * 0.78, colors.text);
      wire(p, lx, cy - h * 0.78, cx - 22, cy - h * 0.78, colors.text);
      wire(p, cx + 22, cy - h * 0.78, rx, cy - h * 0.78, colors.text);
      wire(p, rx, cy - h * 0.78, rx, cy - h * 0.62, colors.text);

      for (let i = 0; i < 8; i++) {
        const t = ((time * 0.4 + i / 8) % 1);
        const toLeft = i % 2 === 0;
        const x = toLeft ? cx - t * (cx - lx - 20) : cx + t * (rx - cx - 20);
        const y = cy - h * 0.1 + ((i * 29) % Math.max(1, h * 0.5));
        p.push();
        p.noStroke();
        p.fill(toLeft ? '#ff6b6b' : colors.good);
        p.circle(x, y, 14);
        p.pop();
      }
      caption(p, clean(params.labelA, 10) || '−', lx, cy + h * 0.62, colors, 22);
      caption(p, clean(params.labelB, 10) || '+', rx, cy + h * 0.62, colors, 22);
    }),

  'states-of-matter': wide('States of matter', 'particles arranged as solid, liquid and gas',
    'mode ("all", "solid", "liquid" or "gas")',
    ({ p, time, width, height, params, colors }) => {
      const which = String(params.mode || 'all');
      const shows = which === 'all' ? ['solid', 'liquid', 'gas'] : [which];
      const xs = spread(shows.length, width * 0.22, width * 0.78);
      const cy = height * 0.46;
      const boxW = Math.min(width / safe(shows.length) * 0.66, height * 0.5);

      shows.forEach((state, k) => {
        const cx = xs[k];
        p.push();
        p.noFill();
        p.stroke(colors.dim);
        p.strokeWeight(3);
        p.rect(cx - boxW / 2, cy - boxW / 2, boxW, boxW, 8);
        p.pop();
        const n = state === 'gas' ? 9 : 16;
        for (let i = 0; i < n; i++) {
          let x: number;
          let y: number;
          if (state === 'solid') {
            x = cx - boxW / 2 + 22 + (i % 4) * (boxW - 44) / 3;
            y = cy - boxW / 2 + 22 + Math.floor(i / 4) * (boxW - 44) / 3;
            x += Math.sin(time * 4 + i) * 2;
          } else if (state === 'liquid') {
            x = cx - boxW / 2 + 24 + ((i * 41) % Math.max(1, boxW - 48));
            y = cy + boxW / 2 - 26 - Math.floor(i / 5) * 26 + Math.sin(time * 2 + i) * 5;
          } else {
            x = cx - boxW / 2 + 16 + ((i * 61 + time * 40) % Math.max(1, boxW - 32));
            y = cy - boxW / 2 + 16 + ((i * 97 + time * 30) % Math.max(1, boxW - 32));
          }
          p.push();
          p.noStroke();
          p.fill(colors.accent);
          p.circle(x, y, 15);
          p.pop();
        }
        caption(p, state, cx, cy + boxW / 2 + 30, colors);
      });
    }),

  'reaction-energy': wide('Reaction profile', 'energy over the course of a reaction, with the barrier',
    'mode ("exothermic" or "endothermic")',
    ({ p, progress, width, height, params, colors }) => {
      const endo = String(params.mode || 'exothermic') === 'endothermic';
      const plot = axes(p, width, height, colors, { x: 'Progress', y: 'Energy' });
      const start = endo ? 0.3 : 0.6;
      const end = endo ? 0.66 : 0.24;
      const peak = Math.max(start, end) + 0.26;
      const fn = (t: number) => {
        if (t < 0.3) return start;
        if (t > 0.72) return end;
        const k = (t - 0.3) / 0.42;
        return start + (end - start) * k + Math.sin(k * Math.PI) * (peak - Math.max(start, end));
      };
      curve(p, plot, fn, colors.accent, progress);
      caption(p, 'Activation energy', plot.x(0.5), plot.y(peak) - 24, colors, 20);
      caption(p, endo ? 'Takes energy in' : 'Gives energy out', width / 2, height * 0.93, colors);
    }),

  'periodic-block': square('Periodic table block', 'one element as it appears on the table',
    'labelA (symbol), labelB (name), ratio (atomic number)',
    ({ p, progress, width, height, params, colors }) => {
      const s = Math.min(width, height) * 0.52;
      const cx = width / 2;
      const cy = height * 0.48;
      const on = Math.min(1, progress * 2);
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.fill(tint(p, colors.accent, 40));
      p.rect(cx - s / 2, cy - s / 2, s * on, s, 10);
      p.pop();
      if (on > 0.6) {
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(s * 0.4);
        p.text(clean(params.labelA, 3) || 'H', cx, cy);
        p.textSize(22);
        p.fill(colors.dim);
        p.text(clean(params.labelB, 14), cx, cy + s * 0.32);
        p.textAlign(p.LEFT, p.TOP);
        p.text(String(Math.round(num(params.ratio, 1, 0, 118))), cx - s / 2 + 14, cy - s / 2 + 12);
        p.pop();
      }
    }),

  // =========================================================================
  // Biology
  // =========================================================================

  cell: square('Cell', 'a cell with its labelled parts',
    'items (2-5 parts, each with a label), mode ("animal" or "plant")',
    ({ p, progress, width, height, params, items, colors }) => {
      const plant = String(params.mode || 'animal') === 'plant';
      const names = labels(items, 5);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.32;

      p.push();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.fill(tint(p, colors.accent, 34));
      if (plant) p.rect(cx - r, cy - r * 0.82, r * 2, r * 1.64, 12);
      else p.circle(cx, cy, r * 2);
      p.pop();

      p.push();
      p.noStroke();
      p.fill(tint(p, colors.accent, 150));
      p.circle(cx, cy, r * 0.6);
      p.pop();
      caption(p, 'Nucleus', cx, cy, colors, 20);

      names.forEach((name, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const a = (i / safe(names.length)) * Math.PI * 2 - Math.PI / 3;
        const ox = cx + Math.cos(a) * r * 0.66;
        const oy = cy + Math.sin(a) * r * 0.6;
        p.push();
        p.noStroke();
        p.fill(colors.good);
        p.circle(ox, oy, 22 * on);
        p.pop();
        const lx = cx + Math.cos(a) * (r + 46);
        const ly = cy + Math.sin(a) * (r + 40);
        wire(p, ox, oy, lx, ly, colors.dim, 2);
        caption(p, name, lx, ly, colors, 19);
      });
    }),

  dna: square('DNA', 'a double helix with base pairs',
    'count (6-14 rungs)',
    ({ p, time, width, height, params, colors }) => {
      const rungs = Math.round(num(params.count, 10, 6, 14));
      const cx = width / 2;
      const top = height * 0.12;
      const h = height * 0.76;
      const amp = Math.min(width * 0.22, 110);
      for (let i = 0; i <= rungs; i++) {
        const t = i / safe(rungs);
        const a = t * Math.PI * 3 + time * 0.8;
        const x1 = cx + Math.sin(a) * amp;
        const x2 = cx - Math.sin(a) * amp;
        const y = top + t * h;
        p.push();
        p.stroke(tint(p, i % 2 === 0 ? colors.accent : colors.good, 200));
        p.strokeWeight(5);
        p.line(x1, y, x2, y);
        p.pop();
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.circle(x1, y, 13);
        p.circle(x2, y, 13);
        p.pop();
      }
    }),

  neuron: wide('Neuron', 'a nerve cell with a signal travelling down the axon',
    'labelA (what the signal is)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height / 2;
      const bodyX = width * 0.22;
      const endX = width * 0.86;
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.circle(bodyX, cy, 92);
      p.pop();
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.6 + i * 0.2);
        wire(p, bodyX, cy, bodyX + Math.cos(a) * 96, cy + Math.sin(a) * 96, colors.accent, 5);
      }
      wire(p, bodyX + 46, cy, endX, cy, colors.text, 8);
      for (let i = 0; i < 3; i++) {
        const a = -0.5 + i * 0.5;
        wire(p, endX, cy, endX + Math.cos(a) * 54, cy + Math.sin(a) * 54, colors.text, 5);
      }
      const px = bodyX + 46 + progress * (endX - bodyX - 46);
      p.push();
      p.noStroke();
      p.fill(colors.good);
      p.circle(px, cy, 30);
      p.pop();
      caption(p, clean(params.labelA, 18) || 'Signal', px, cy - 44, colors, 20);
    }),

  heart: square('Heart', 'the four chambers and the direction blood flows',
    'labelA (a chamber to highlight)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.5;
      const w = Math.min(width, height) * 0.52;
      const h = w * 1.05;
      const beat = 1 + Math.sin(progress * Math.PI * 6) * 0.03;
      const names = ['RA', 'LA', 'RV', 'LV'];
      p.push();
      p.translate(cx, cy);
      const cells = [
        [-w / 4, -h / 4], [w / 4, -h / 4], [-w / 4, h / 4], [w / 4, h / 4],
      ];
      cells.forEach(([dx, dy], i) => {
        const lit = clean(params.labelA, 4).toUpperCase() === names[i];
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(3);
        p.fill(lit ? tint(p, colors.accent, 140) : tint(p, i < 2 ? '#5aa9e6' : '#ff6b6b', 70));
        p.rect(dx * beat - w / 4 + 4, dy * beat - h / 4 + 4, w / 2 - 8, h / 2 - 8, 14);
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(24);
        p.text(names[i], dx * beat, dy * beat);
        p.pop();
      });
      p.pop();
      arrow(p, cx - w / 2 - 40, cy - h / 4, cx - w / 4, cy - h / 4, '#5aa9e6', 4);
      arrow(p, cx + w / 4, cy + h / 4, cx + w / 2 + 40, cy + h / 4, '#ff6b6b', 4);
    }),

  photosynthesis: wide('Photosynthesis', 'light, water and CO2 going in, sugar and oxygen coming out',
    'labelA (what is being made)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.5;
      p.push();
      p.noStroke();
      p.fill(colors.good);
      p.ellipse(cx, cy, Math.min(width, height) * 0.44, Math.min(width, height) * 0.34);
      p.pop();
      const ins = ['Light', 'Water', 'CO₂'];
      const outs = [clean(params.labelA, 10) || 'Sugar', 'Oxygen'];
      ins.forEach((t, i) => {
        const y = cy - 70 + i * 70;
        const on = stagger(progress, i, 0.1);
        if (on > 0) arrow(p, width * 0.06, y, width * 0.06 + (cx - width * 0.16 - width * 0.06) * on, cy, colors.accent, 4);
        caption(p, t, width * 0.11, y - 24, colors, 20);
      });
      outs.forEach((t, i) => {
        const y = cy - 40 + i * 80;
        const on = stagger(progress, i + 3, 0.1);
        if (on > 0) arrow(p, cx + width * 0.16, cy, cx + width * 0.16 + (width * 0.28) * on, y, colors.good, 4);
        caption(p, t, width * 0.9, y - 24, colors, 20);
      });
    }),

  'food-chain': wide('Food chain', 'energy passing along a chain of organisms',
    'items (3-5 organisms, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (names.length < 2) return;
      const xs = spread(names.length, width * 0.14, width * 0.86);
      const cy = height / 2;
      names.forEach((name, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        bubble(p, xs[i], cy, 46 * on, '', colors, { lit: i === 0 });
        caption(p, name, xs[i], cy + 74, colors, 20);
        if (i > 0) {
          const prev = stagger(progress, i - 1, 0.16);
          if (prev > 0.8) arrow(p, xs[i - 1] + 52, cy, xs[i] - 52, cy, colors.accent, 4);
        }
      });
    }),

  mitosis: wide('Cell division', 'one cell splitting into two',
    'progress drives the split; no parameters',
    ({ p, progress, width, height, colors }) => {
      const cy = height / 2;
      const cx = width / 2;
      const r = Math.min(width, height) * 0.2;
      const gap = Math.min(1, Math.max(0, (progress - 0.4) / 0.6)) * r * 1.3;
      [-1, 1].forEach((side) => {
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.fill(tint(p, colors.accent, 40));
        p.circle(cx + side * gap, cy, r * 2);
        p.noStroke();
        p.fill(tint(p, colors.accent, 170));
        p.circle(cx + side * gap, cy, r * 0.7);
        p.pop();
      });
      caption(p, progress < 0.4 ? 'One cell' : progress < 0.85 ? 'Dividing' : 'Two cells',
              cx, height * 0.86, colors);
    }),

  // =========================================================================
  // Maths and geometry
  // =========================================================================

  triangle: square('Triangle', 'a labelled triangle with its sides and angles',
    'angle (20-120, the marked angle), labelA/labelB (side labels)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.58;
      const s = Math.min(width, height) * 0.34;
      const ax = cx - s;
      const ay = cy + s * 0.6;
      const bx = cx + s;
      const by = cy + s * 0.6;
      const deg = num(params.angle, 60, 20, 120);
      const topX = ax + s * 2 * 0.42;
      const topY = cy - s * 0.7;
      const on = Math.min(1, progress * 1.6);

      p.push();
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.beginShape();
      p.vertex(ax, ay);
      p.vertex(ax + (bx - ax) * on, ay);
      p.endShape();
      if (on > 0.4) { p.line(bx, by, topX, topY); }
      if (on > 0.7) { p.line(topX, topY, ax, ay); }
      p.pop();
      caption(p, clean(params.labelA, 8) || 'a', (ax + bx) / 2, ay + 32, colors, 22);
      caption(p, clean(params.labelB, 8) || 'b', (bx + topX) / 2 + 26, (by + topY) / 2, colors, 22);
      if (on > 0.9) {
        p.push();
        p.noFill();
        p.stroke(colors.good);
        p.strokeWeight(3);
        p.arc(ax, ay, 62, 62, -0.9, 0);
        p.pop();
        caption(p, Math.round(deg) + '°', ax + 52, ay - 24, colors, 20);
      }
    }),

  pythagoras: square('Pythagoras', 'squares built on the three sides of a right triangle',
    'ratio (0.4-1.5, shape of the triangle)',
    ({ p, progress, width, height, params, colors }) => {
      const k = num(params.ratio, 0.75, 0.4, 1.5);
      const unit = Math.min(width, height) * 0.15;
      const a = unit * 1.2;
      const b = a * k;
      const ox = width * 0.42;
      const oy = height * 0.6;

      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.triangle(ox, oy, ox + b, oy, ox, oy - a);
      p.pop();
      const sq = (x: number, y: number, w: number, h: number, on: number, colour: string) => {
        if (on <= 0) return;
        p.push();
        p.noStroke();
        p.fill(tint(p, colour, 90));
        p.rect(x, y, w * on, h * on);
        p.noFill();
        p.stroke(colour);
        p.strokeWeight(3);
        p.rect(x, y, w * on, h * on);
        p.pop();
      };
      sq(ox, oy, b, b, stagger(progress, 0, 0.16), colors.accent);
      sq(ox - a, oy - a, a, a, stagger(progress, 1, 0.16), colors.good);
      caption(p, 'a² + b² = c²', width / 2, height * 0.92, colors, 26);
    }),

  'coordinate-plane': wide('Coordinate plane', 'points plotted on x and y axes',
    'items (2-6 points; value is y, label is the name)',
    ({ p, progress, width, height, items, colors }) => {
      const pts = values(items, 6);
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      p.push();
      p.stroke(tint(p, colors.dim, 70));
      p.strokeWeight(1);
      for (let i = 1; i < 8; i++) {
        p.line(plot.x(i / 8), plot.top, plot.x(i / 8), plot.bottom);
        p.line(plot.left, plot.y(i / 8), plot.right, plot.y(i / 8));
      }
      p.pop();
      if (!pts.length) return;
      const max = Math.max(...pts.map((q) => Math.abs(q.value)), 1);
      pts.forEach((q, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        const x = plot.x((i + 0.5) / safe(pts.length));
        const y = plot.y(Math.abs(q.value) / safe(max));
        junction(p, x, y, colors.accent, 20 * on);
        caption(p, q.label, x, y - 28, colors, 19);
      });
    }),

  quadratic: wide('Quadratic curve', 'a parabola with its roots and turning point',
    'ratio (-2 to 2, how the curve opens)',
    ({ p, progress, width, height, params, colors }) => {
      const k = num(params.ratio, 1, -2, 2) || 1;
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      const fn = (t: number) => {
        const x = (t - 0.5) * 4;
        return 0.5 + (k * (x * x - 2)) / 12;
      };
      curve(p, plot, fn, colors.accent, progress);
      const vertexT = 0.5;
      if (progress > 0.6) {
        junction(p, plot.x(vertexT), plot.y(fn(vertexT)), colors.good, 18);
        caption(p, 'Turning point', plot.x(vertexT), plot.y(fn(vertexT)) + (k > 0 ? 34 : -34), colors, 20);
      }
    }),

  'set-operations': square('Set operations', 'union, intersection or difference of two sets',
    'mode ("union", "intersection" or "difference"), labelA/labelB (set names)',
    ({ p, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'intersection');
      const cx = width / 2;
      const cy = height * 0.46;
      const r = Math.min(width, height) * 0.22;
      const dx = r * 0.62;
      const on = Math.min(1, progress * 1.8);

      p.push();
      p.noStroke();
      if (mode === 'union') {
        p.fill(tint(p, colors.accent, 110));
        p.circle(cx - dx, cy, r * 2 * on);
        p.circle(cx + dx, cy, r * 2 * on);
      } else if (mode === 'difference') {
        p.fill(tint(p, colors.accent, 110));
        p.circle(cx - dx, cy, r * 2 * on);
        p.fill(colors.bg);
        p.circle(cx + dx, cy, r * 2 * on);
      } else {
        p.fill(tint(p, colors.accent, 60));
        p.circle(cx - dx, cy, r * 2 * on);
        p.circle(cx + dx, cy, r * 2 * on);
        p.fill(tint(p, colors.accent, 190));
        // The lens shape, drawn as the overlap of the two clipped circles.
        p.arc(cx - dx, cy, r * 2 * on, r * 2 * on, -1.05, 1.05, p.PIE);
        p.arc(cx + dx, cy, r * 2 * on, r * 2 * on, Math.PI - 1.05, Math.PI + 1.05, p.PIE);
      }
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.circle(cx - dx, cy, r * 2 * on);
      p.circle(cx + dx, cy, r * 2 * on);
      p.pop();
      caption(p, clean(params.labelA, 8) || 'A', cx - dx - r * 0.6, cy - r - 20, colors);
      caption(p, clean(params.labelB, 8) || 'B', cx + dx + r * 0.6, cy - r - 20, colors);
      caption(p, mode, cx, height * 0.9, colors, 24);
    }),

  'function-machine': wide('Function machine', 'an input going into a rule and a result coming out',
    'labelA (the rule), labelB (the input)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height / 2;
      const cx = width / 2;
      const t = Math.min(1, progress * 1.5);
      box(p, cx, cy, width * 0.3, height * 0.34, clean(params.labelA, 14) || 'x 2', colors,
          { lit: true, size: 30 });
      const inX = width * 0.1 + t * (cx - width * 0.18 - width * 0.1);
      bubble(p, inX, cy, 34, clean(params.labelB, 4) || '3', colors);
      if (t > 0.9) {
        const t2 = Math.min(1, (progress - 0.66) * 3);
        bubble(p, cx + width * 0.18 + t2 * width * 0.2, cy, 34, '?', colors, { lit: true });
      }
      caption(p, 'In', width * 0.09, cy - 62, colors, 20);
      caption(p, 'Out', width * 0.91, cy - 62, colors, 20);
    }),

  'fraction-bar': wide('Fraction bar', 'a bar split into equal parts with some shaded',
    'count (2-12 parts), ratio (how many are shaded)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 2, 12));
      const filled = Math.round(num(params.ratio, Math.ceil(n / 2), 0, n));
      const left = width * 0.1;
      const w = width * 0.8;
      const y = height * 0.42;
      const h = Math.min(110, height * 0.24);
      const cell = w / safe(n);
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.06, 2.4);
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(3);
        const shaded = i < filled && on > 0.5;
        p.fill(tint(p, shaded ? colors.accent : colors.bg, shaded ? 200 : 255));
        p.rect(left + i * cell, y, cell, h);
        p.pop();
      }
      title(p, filled + ' / ' + n, width / 2, y + h + 54, colors, 34);
    }),

  angles: square('Angles', 'angles around a point or on a line',
    'items (2-4 angles, each with a label and a value in degrees)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 4).filter((v) => v.value > 0);
      if (!vs.length) return;
      const total = vs.reduce((n, v) => n + v.value, 0) || 360;
      const cx = width / 2;
      const cy = height * 0.52;
      const r = Math.min(width, height) * 0.3;
      let a = -Math.PI / 2;
      vs.forEach((v, i) => {
        const sweep = (v.value / safe(total)) * Math.PI * 2 * Math.min(1, progress * 1.4);
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 200 - i * 42));
        p.arc(cx, cy, r * 2, r * 2, a, a + sweep, p.PIE);
        p.pop();
        const mid = a + sweep / 2;
        if (sweep > 0.25) {
          caption(p, Math.round(v.value) + '°', cx + Math.cos(mid) * r * 0.62,
                  cy + Math.sin(mid) * r * 0.62, colors, 20);
        }
        a += sweep;
      });
      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(3);
      p.circle(cx, cy, r * 2);
      p.pop();
      junction(p, cx, cy, colors.text, 12);
    }),

  // =========================================================================
  // More electrical and electronics
  // =========================================================================

  'rc-charging': wide('Capacitor charging', 'the charging curve of a capacitor through a resistor',
    'mode ("charge" or "discharge")',
    ({ p, progress, width, height, params, colors }) => {
      const discharge = String(params.mode || 'charge') === 'discharge';
      const plot = axes(p, width, height, colors, { x: 'Time', y: 'Volts' });
      const fn = (t: number) => (discharge ? Math.exp(-t * 4) : 1 - Math.exp(-t * 4)) * 0.85;
      curve(p, plot, fn, colors.accent, progress);
      const tau = 0.25;
      setDash(p, true);
      wire(p, plot.x(tau), plot.bottom, plot.x(tau), plot.y(fn(tau)), colors.dim, 2);
      setDash(p, false);
      caption(p, 'One time constant', plot.x(tau), plot.bottom + 26, colors, 19);
    }),

  rectifier: wide('Rectifier', 'AC turned into pulsing DC',
    'mode ("half" or "full")',
    ({ p, time, width, height, params, colors }) => {
      const full = String(params.mode || 'full') === 'full';
      const cy = height * 0.5;
      const amp = height * 0.26;
      const draw = (fn: (x: number) => number, colour: string, w: number) => {
        p.push();
        p.noFill();
        p.stroke(colour);
        p.strokeWeight(w);
        p.beginShape();
        for (let x = 0; x <= width; x += 4) {
          p.vertex(x, cy - fn((x / safe(width)) * Math.PI * 6 - time * 3) * amp);
        }
        p.endShape();
        p.pop();
      };
      draw((a) => Math.sin(a), colors.dim, 3);
      draw((a) => (full ? Math.abs(Math.sin(a)) : Math.max(0, Math.sin(a))), colors.accent, 6);
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.line(0, cy, width, cy);
      p.pop();
      caption(p, full ? 'Full wave' : 'Half wave', width / 2, height * 0.92, colors);
    }),

  'three-phase': wide('Three phase', 'three sine waves 120 degrees apart',
    'frequency (1-4)',
    ({ p, time, width, height, params, colors }) => {
      const f = num(params.frequency, 2, 1, 4);
      const cy = height / 2;
      const amp = height * 0.28;
      const cols = [colors.accent, colors.good, '#ff9f43'];
      cols.forEach((colour, i) => {
        p.push();
        p.noFill();
        p.stroke(colour);
        p.strokeWeight(5);
        p.beginShape();
        for (let x = 0; x <= width; x += 4) {
          const a = (x / safe(width)) * Math.PI * 2 * f - time * 2.4 + (i * Math.PI * 2) / 3;
          p.vertex(x, cy - Math.sin(a) * amp);
        }
        p.endShape();
        p.pop();
      });
      caption(p, 'R  Y  B — 120° apart', width / 2, height * 0.94, colors);
    }),

  motor: square('Motor', 'a rotor turning inside a magnetic field',
    'speed (1-5)',
    ({ p, time, width, height, params, colors }) => {
      const speed = num(params.speed, 3, 1, 5);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.26;
      p.push();
      p.noStroke();
      p.fill(tint(p, '#ff6b6b', 90));
      p.rect(cx - r * 1.7, cy - r, r * 0.5, r * 2, 8);
      p.fill(tint(p, '#5aa9e6', 90));
      p.rect(cx + r * 1.2, cy - r, r * 0.5, r * 2, 8);
      p.pop();
      caption(p, 'N', cx - r * 1.45, cy, colors, 30);
      caption(p, 'S', cx + r * 1.45, cy, colors, 30);
      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.circle(cx, cy, r * 2);
      p.translate(cx, cy);
      p.rotate(time * speed);
      p.stroke(colors.accent);
      p.strokeWeight(9);
      p.line(-r * 0.8, 0, r * 0.8, 0);
      p.pop();
      junction(p, cx, cy, colors.text, 14);
    }),

  'led-circuit': wide('LED circuit', 'a source, a resistor and an LED that lights up',
    'labelA (supply), labelB (resistor value)',
    ({ p, progress, width, height, params, colors }) => {
      const left = width * 0.16;
      const right = width * 0.84;
      const top = height * 0.3;
      const bottom = height * 0.72;
      const lit = progress > 0.4;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.noFill();
      p.line(left, top, right, top);
      p.line(left, bottom, right, bottom);
      p.line(right, top, right, bottom);
      p.line(left, top, left, (top + bottom) / 2 - 16);
      p.line(left, (top + bottom) / 2 + 16, left, bottom);
      p.pop();
      battery(p, left, (top + bottom) / 2, colors);
      caption(p, clean(params.labelA, 10), left + 60, (top + bottom) / 2, colors, 20);
      resistor(p, width * 0.42, top, colors);
      caption(p, clean(params.labelB, 10), width * 0.42, top - 34, colors, 20);
      lamp(p, right, (top + bottom) / 2, colors, lit, 24);
    }),

  'star-delta': wide('Star and delta', 'the two ways three windings can be connected',
    'mode ("star", "delta" or "both")',
    ({ p, width, height, params, colors }) => {
      const mode = String(params.mode || 'both');
      const show = mode === 'both' ? ['star', 'delta'] : [mode];
      const xs = spread(show.length, width * 0.28, width * 0.72);
      const cy = height * 0.48;
      const r = Math.min(width / safe(show.length), height) * 0.24;
      show.forEach((kind, k) => {
        const cx = xs[k];
        const pts = [0, 1, 2].map((i) => ({
          x: cx + Math.cos((i / 3) * Math.PI * 2 - Math.PI / 2) * r,
          y: cy + Math.sin((i / 3) * Math.PI * 2 - Math.PI / 2) * r,
        }));
        if (kind === 'star') {
          pts.forEach((q) => wire(p, cx, cy, q.x, q.y, colors.accent, 5));
          junction(p, cx, cy, colors.text, 14);
        } else {
          pts.forEach((q, i) => {
            const n = pts[(i + 1) % 3];
            wire(p, q.x, q.y, n.x, n.y, colors.accent, 5);
          });
        }
        pts.forEach((q) => junction(p, q.x, q.y, colors.text, 16));
        caption(p, kind, cx, cy + r + 46, colors);
      });
    }),

  'switch-circuit': wide('Switch', 'a circuit that only works when the switch is closed',
    'mode ("open" or "closed")',
    ({ p, progress, width, height, params, colors }) => {
      const closed = String(params.mode || '') === 'closed' || progress > 0.55;
      const left = width * 0.18;
      const right = width * 0.82;
      const top = height * 0.32;
      const bottom = height * 0.7;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.noFill();
      p.line(left, bottom, right, bottom);
      p.line(right, top, right, bottom);
      p.line(left, top, width * 0.4, top);
      p.line(width * 0.62, top, right, top);
      p.line(left, top, left, (top + bottom) / 2 - 16);
      p.line(left, (top + bottom) / 2 + 16, left, bottom);
      p.pop();
      battery(p, left, (top + bottom) / 2, colors);
      switchSym(p, width * 0.51, top, colors, closed, 130);
      lamp(p, right, (top + bottom) / 2, colors, closed, 24);
      caption(p, closed ? 'Closed — current flows' : 'Open — nothing flows',
              width / 2, height * 0.88, colors);
    }),

  earthing: square('Earthing', 'an appliance bonded to earth',
    'labelA (the appliance)',
    ({ p, width, height, params, colors }) => {
      const cx = width / 2;
      const top = height * 0.22;
      box(p, cx, top, width * 0.4, height * 0.2, clean(params.labelA, 12) || 'Appliance', colors);
      wire(p, cx, top + height * 0.1, cx, height * 0.62, colors.good, 5);
      ground(p, cx, height * 0.62, colors);
      caption(p, 'Earth', cx, height * 0.82, colors);
    }),

  'power-factor': square('Power factor', 'real, reactive and apparent power as a triangle',
    'angle (0-70, the phase angle)',
    ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 36, 0, 70);
      const rad = (deg * Math.PI) / 180;
      const ox = width * 0.24;
      const oy = height * 0.72;
      const base = Math.min(width, height) * 0.5;
      const on = Math.min(1, progress * 1.6);
      const hx = ox + base * on;
      const hy = oy - base * Math.tan(rad) * on;
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.noFill();
      p.line(ox, oy, hx, oy);
      p.line(hx, oy, hx, hy);
      p.line(ox, oy, hx, hy);
      p.pop();
      caption(p, 'kW', (ox + hx) / 2, oy + 30, colors, 22);
      caption(p, 'kVAr', hx + 44, (oy + hy) / 2, colors, 22);
      caption(p, 'kVA', (ox + hx) / 2 - 20, (oy + hy) / 2 - 24, colors, 22);
      caption(p, 'cos φ = ' + Math.cos(rad).toFixed(2), width / 2, height * 0.92, colors, 24);
    }),

  // =========================================================================
  // Aptitude and reasoning, continued
  // =========================================================================

  'cube-net': wide('Cube net', 'a folded cube beside its flat net',
    'mode ("cross" or "tee")',
    ({ p, progress, width, height, params, colors }) => {
      const s = Math.min(width * 0.1, height * 0.19);
      const nx = width * 0.28;
      const ny = height * 0.5;
      const cross = String(params.mode || 'cross') === 'cross';
      const cells = cross
        ? [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]]
        : [[-1, 0], [0, 0], [1, 0], [0, 1], [0, 2], [0, -1]];
      cells.forEach(([dx, dy], i) => {
        const on = stagger(progress, i, 0.08, 2.6);
        if (on <= 0) return;
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(3);
        p.fill(tint(p, colors.accent, 60));
        p.rect(nx + dx * s - s / 2, ny + dy * s - s / 2, s, s, 3);
        p.pop();
      });
      // The folded cube, in simple isometric.
      const cx = width * 0.72;
      const cy = height * 0.48;
      const k = s * 1.1;
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(4);
      p.fill(tint(p, colors.accent, 40));
      p.rect(cx - k, cy - k * 0.5, k * 1.6, k * 1.6, 4);
      p.noFill();
      p.line(cx - k, cy - k * 0.5, cx - k * 0.5, cy - k);
      p.line(cx + k * 0.6, cy - k * 0.5, cx + k * 1.1, cy - k);
      p.line(cx - k * 0.5, cy - k, cx + k * 1.1, cy - k);
      p.line(cx + k * 1.1, cy - k, cx + k * 1.1, cy + k * 0.6);
      p.line(cx + k * 0.6, cy + k * 1.1, cx + k * 1.1, cy + k * 0.6);
      p.pop();
      caption(p, 'Net', nx, ny + s * 3, colors);
      caption(p, 'Folds to', cx, cy + k * 1.6, colors);
    }),

  dice: wide('Dice', 'two views of a die, for opposite-face problems',
    'count (1-6, the face shown), ratio (1-6, the second face)',
    ({ p, progress, width, height, params, colors }) => {
      const faces = [Math.round(num(params.count, 1, 1, 6)), Math.round(num(params.ratio, 3, 1, 6))];
      const s = Math.min(width * 0.26, height * 0.5);
      const xs = spread(2, width * 0.32, width * 0.68);
      const pips: Record<number, number[][]> = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
      };
      faces.forEach((face, k) => {
        const on = stagger(progress, k, 0.2);
        if (on <= 0) return;
        const cx = xs[k];
        const cy = height * 0.48;
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(4);
        p.fill(colors.bg);
        p.rect(cx - s / 2, cy - s / 2, s, s, 12);
        p.noStroke();
        p.fill(colors.accent);
        (pips[face] || pips[1]).forEach(([dx, dy]) => {
          p.circle(cx + dx * s * 0.27, cy + dy * s * 0.27, s * 0.16);
        });
        p.pop();
      });
    }),

  'paper-fold': wide('Paper folding', 'a sheet folded and punched, then opened out',
    'count (1-2 folds)',
    ({ p, progress, width, height, params, colors }) => {
      const folds = Math.round(num(params.count, 1, 1, 2));
      const s = Math.min(width * 0.22, height * 0.44);
      const steps = ['Fold', 'Punch', 'Open'];
      const xs = spread(3, width * 0.2, width * 0.8);
      steps.forEach((name, i) => {
        const on = stagger(progress, i, 0.22);
        if (on <= 0) return;
        const cx = xs[i];
        const cy = height * 0.46;
        p.push();
        p.stroke(colors.text);
        p.strokeWeight(3);
        p.fill(tint(p, colors.accent, 30));
        const w = i === 2 ? s : s / (folds + 1);
        p.rect(cx - w / 2, cy - s / 2, w, s, 4);
        p.pop();
        if (i >= 1) {
          const holes = i === 2 ? (folds + 1) : 1;
          for (let h = 0; h < holes; h++) {
            const hx = cx - s / 2 + (s / safe(holes)) * (h + 0.5);
            p.push();
            p.noStroke();
            p.fill(colors.bg);
            p.circle(i === 2 ? hx : cx, cy - s * 0.16, 20);
            p.stroke(colors.accent);
            p.noFill();
            p.strokeWeight(3);
            p.circle(i === 2 ? hx : cx, cy - s * 0.16, 20);
            p.pop();
          }
        }
        caption(p, name, cx, cy + s * 0.68, colors);
      });
    }),

  'mirror-image': wide('Mirror image', 'a shape and its reflection across a line',
    'labelA (the shape letter)',
    ({ p, progress, width, height, params, colors }) => {
      const cx = width / 2;
      const cy = height * 0.48;
      const letter = clean(params.labelA, 2) || 'R';
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(4);
      setDash(p, true);
      p.line(cx, height * 0.14, cx, height * 0.82);
      setDash(p, false);
      p.pop();
      const draw = (x: number, flip: number, on: number) => {
        if (on <= 0) return;
        p.push();
        p.translate(x, cy);
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.min(width, height) * 0.34 * on);
        // No scale() in the shared subset, so the mirrored copy is rotated
        // through the vertical instead - same read, one fewer p5 call to mock.
        if (flip < 0) p.rotate(Math.PI);
        p.text(letter, 0, 0);
        p.pop();
      };
      draw(cx - width * 0.2, 1, Math.min(1, progress * 2));
      draw(cx + width * 0.2, -1, Math.min(1, Math.max(0, (progress - 0.4) * 2)));
      caption(p, 'Mirror', cx, height * 0.9, colors);
    }),

  compass: square('Direction', 'a compass with a path turning across it',
    'items (2-5 moves, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const cx = width / 2;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.34;
      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.circle(cx, cy, r * 2);
      p.pop();
      [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]].forEach(([n, dx, dy]) => {
        caption(p, String(n), cx + Number(dx) * (r + 28), cy + Number(dy) * (r + 28), colors, 24);
      });
      const moves = labels(items, 5);
      let x = cx;
      let y = cy;
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      moves.forEach((name, i) => {
        const on = stagger(progress, i, 0.18);
        if (on <= 0) return;
        const [dx, dy] = dirs[i % 4];
        const nx = x + dx * r * 0.42 * on;
        const ny = y + dy * r * 0.42 * on;
        arrow(p, x, y, nx, ny, colors.accent, 4, 12);
        caption(p, name, (x + nx) / 2 + 26, (y + ny) / 2, colors, 18);
        if (on >= 1) { x = nx; y = ny; }
      });
    }),

  'matrix-puzzle': square('Figure matrix', 'a three by three grid with one cell missing',
    'items (up to 8 cell labels); the last cell is always the question mark',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 8);
      const s = Math.min(width, height) * 0.24;
      const cx = width / 2;
      const cy = height * 0.48;
      for (let i = 0; i < 9; i++) {
        const on = stagger(progress, i, 0.06, 2.6);
        if (on <= 0) continue;
        const gx = cx + ((i % 3) - 1) * s;
        const gy = cy + (Math.floor(i / 3) - 1) * s;
        const last = i === 8;
        p.push();
        p.stroke(last ? colors.accent : colors.dim);
        p.strokeWeight(last ? 5 : 3);
        p.fill(colors.bg);
        p.rect(gx - s / 2 + 4, gy - s / 2 + 4, s - 8, s - 8, 6);
        p.noStroke();
        p.fill(last ? colors.accent : colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(s * 0.3);
        p.text(last ? '?' : (names[i] || String(i + 1)), gx, gy);
        p.pop();
      }
    }),

  'profit-loss': wide('Profit and loss', 'cost, selling price and the gap between them',
    'items (2 bars: cost and selling price, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 2);
      if (vs.length < 2) return;
      const plot = axes(p, width, height, colors, {});
      bars(p, plot, vs, colors, progress);
      const gain = vs[1].value - vs[0].value;
      const pct = Math.round((gain / safe(Math.abs(vs[0].value))) * 100);
      caption(p, (gain >= 0 ? 'Profit ' : 'Loss ') + Math.abs(pct) + '%',
              width / 2, height * 0.93, colors, 26);
    }),

  // =========================================================================
  // Data and business
  // =========================================================================

  scatter: wide('Scatter plot', 'points showing whether two things move together',
    'items (3-8 points, value is y), ratio (-1 to 1, how strong the trend is)',
    ({ p, progress, width, height, params, items, colors }) => {
      const plot = axes(p, width, height, colors, { x: 'x', y: 'y' });
      const corr = num(params.ratio, 0.8, -1, 1);
      const n = Math.max(6, values(items, 8).length);
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.06, 2.4);
        if (on <= 0) continue;
        const t = (i + 0.5) / safe(n);
        const jitterY = ((i * 37) % 20) / 20 - 0.5;
        const y = 0.5 + corr * (t - 0.5) + jitterY * 0.24;
        junction(p, plot.x(t), plot.y(Math.min(1, Math.max(0, y))), colors.accent, 18 * on);
      }
      if (progress > 0.7) {
        setDash(p, true);
        wire(p, plot.x(0.03), plot.y(0.5 + corr * -0.47), plot.x(0.97), plot.y(0.5 + corr * 0.47),
             colors.good, 3);
        setDash(p, false);
      }
    }),

  'line-chart': wide('Line chart', 'a value tracked over time',
    'items (3-8 points, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 8);
      if (vs.length < 2) return;
      const plot = axes(p, width, height, colors, {});
      const max = Math.max(...vs.map((v) => Math.abs(v.value)), 1);
      const upto = Math.min(1, progress * 1.2);
      p.push();
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.beginShape();
      vs.forEach((v, i) => {
        const t = i / safe(vs.length - 1);
        if (t <= upto) p.vertex(plot.x(t), plot.y(Math.abs(v.value) / safe(max)));
      });
      p.endShape();
      p.pop();
      vs.forEach((v, i) => {
        const t = i / safe(vs.length - 1);
        if (t > upto) return;
        junction(p, plot.x(t), plot.y(Math.abs(v.value) / safe(max)), colors.text, 14);
        caption(p, v.label, plot.x(t), plot.bottom + 24, colors, 18);
      });
    }),

  'stacked-bar': wide('Stacked bars', 'categories each split into parts',
    'items (3-6 bars, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 6);
      if (!vs.length) return;
      const plot = axes(p, width, height, colors, {});
      const max = Math.max(...vs.map((v) => Math.abs(v.value)), 1);
      const slot = (plot.right - plot.left) / safe(vs.length);
      vs.forEach((v, i) => {
        const on = stagger(progress, i, 0.1);
        const total = (Math.abs(v.value) / safe(max)) * (plot.bottom - plot.top) * on;
        const x = plot.left + i * slot + slot * 0.2;
        const w = slot * 0.6;
        // Each bar split into three, so it reads as composition not magnitude.
        [0.5, 0.3, 0.2].forEach((share, k) => {
          const h = total * share;
          const y = plot.bottom - total + [0, total * 0.5, total * 0.8][k];
          p.push();
          p.noStroke();
          p.fill(tint(p, colors.accent, 230 - k * 60));
          p.rect(x, y, w, h);
          p.pop();
        });
        caption(p, v.label, x + w / 2, plot.bottom + 24, colors, 19);
      });
    }),

  gauge: square('Gauge', 'a single value on a dial',
    'ratio (0-1, how full), labelA (what it measures)',
    ({ p, progress, width, height, params, colors }) => {
      const target = num(params.ratio, 0.7, 0, 1);
      const v = target * Math.min(1, progress * 1.5);
      const cx = width / 2;
      const cy = height * 0.62;
      const r = Math.min(width, height) * 0.32;
      p.push();
      p.noFill();
      p.stroke(tint(p, colors.dim, 90));
      p.strokeWeight(24);
      p.arc(cx, cy, r * 2, r * 2, Math.PI, Math.PI * 2);
      p.stroke(colors.accent);
      p.arc(cx, cy, r * 2, r * 2, Math.PI, Math.PI + Math.PI * v);
      p.pop();
      title(p, Math.round(v * 100) + '%', cx, cy - 20, colors, 46);
      caption(p, clean(params.labelA, 18), cx, cy + 34, colors);
    }),

  funnel: square('Funnel', 'a quantity narrowing at each stage',
    'items (3-5 stages, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 5);
      if (vs.length < 2) return;
      const max = Math.max(...vs.map((v) => Math.abs(v.value)), 1);
      const top = height * 0.16;
      const band = (height * 0.62) / safe(vs.length);
      vs.forEach((v, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const w = (Math.abs(v.value) / safe(max)) * width * 0.62 * on;
        const y = top + i * band;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 230 - i * 34));
        p.rect(width / 2 - w / 2, y, w, band - 10, 6);
        p.pop();
        caption(p, v.label + '  ' + v.value, width / 2, y + band / 2 - 5, colors, 20);
      });
    }),

  'matrix-quadrant': square('Two by two', 'four quadrants formed by two axes',
    'labelA (x axis), labelB (y axis), items (up to 4 quadrant labels)',
    ({ p, progress, width, height, params, items, colors }) => {
      const names = labels(items, 4);
      const cx = width / 2;
      const cy = height * 0.48;
      const s = Math.min(width, height) * 0.34;
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.noFill();
      p.rect(cx - s, cy - s, s * 2, s * 2, 8);
      p.line(cx, cy - s, cx, cy + s);
      p.line(cx - s, cy, cx + s, cy);
      p.pop();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0 || !names[i]) return;
        caption(p, names[i], cx + dx * s * 0.5, cy + dy * s * 0.5, colors, 20);
      });
      caption(p, clean(params.labelA, 16), cx, cy + s + 34, colors, 20);
      caption(p, clean(params.labelB, 16), cx, cy - s - 28, colors, 20);
    }),

  // =========================================================================
  // Earth and space
  // =========================================================================

  'solar-system': square('Solar system', 'planets at their own distances and speeds',
    'count (3-6 planets)',
    ({ p, time, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 3, 6));
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.44;
      p.push();
      p.noStroke();
      p.fill('#ffd400');
      p.circle(cx, cy, 44);
      p.pop();
      for (let i = 1; i <= n; i++) {
        const r = (maxR * i) / safe(n);
        p.push();
        p.noFill();
        p.stroke(tint(p, colors.dim, 70));
        p.strokeWeight(2);
        p.circle(cx, cy, r * 2);
        p.pop();
        // Outer planets go slower, which is the one thing this has to get right.
        const a = time * 0.9 / Math.pow(i, 1.5);
        p.push();
        p.noStroke();
        p.fill(i % 2 === 0 ? colors.accent : colors.good);
        p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 20);
        p.pop();
      }
    }),

  'moon-phases': wide('Moon phases', 'the moon lit from one side as it goes round',
    'count (4-8 phases shown)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 5, 4, 8));
      const xs = spread(n, width * 0.12, width * 0.88);
      const cy = height * 0.48;
      const r = Math.min(width / safe(n) * 0.34, height * 0.2);
      xs.forEach((x, i) => {
        const on = stagger(progress, i, 0.1);
        if (on <= 0) return;
        const phase = i / safe(n - 1);
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.dim, 60));
        p.circle(x, cy, r * 2);
        p.fill(colors.text);
        // A half disc plus an ellipse gives every phase from new to full.
        p.arc(x, cy, r * 2, r * 2, -Math.PI / 2, Math.PI / 2, p.PIE);
        p.fill(tint(p, phase < 0.5 ? colors.dim : colors.text, phase < 0.5 ? 60 : 255));
        p.ellipse(x, cy, Math.abs(1 - phase * 2) * r * 2, r * 2);
        p.pop();
      });
      caption(p, 'New → Full', width / 2, height * 0.86, colors);
    }),

  seasons: wide('Seasons', 'a tilted earth at two points in its orbit',
    'labelA (first season), labelB (second season)',
    ({ p, width, height, params, colors }) => {
      const cy = height / 2;
      p.push();
      p.noStroke();
      p.fill('#ffd400');
      p.circle(width / 2, cy, 54);
      p.pop();
      [-1, 1].forEach((side, i) => {
        const x = width / 2 + side * width * 0.3;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 150));
        p.circle(x, cy, 84);
        p.stroke(colors.text);
        p.strokeWeight(3);
        // The tilt points the same way at both positions - that is the reason
        // there are seasons at all, and the usual thing a diagram gets wrong.
        p.line(x - 22, cy + 46, x + 22, cy - 46);
        p.pop();
        caption(p, clean(i === 0 ? params.labelA : params.labelB, 14)
          || (i === 0 ? 'Summer' : 'Winter'), x, cy + 84, colors);
      });
      p.push();
      p.noFill();
      p.stroke(tint(p, colors.dim, 80));
      p.strokeWeight(2);
      p.ellipse(width / 2, cy, width * 0.72, height * 0.5);
      p.pop();
    }),

  'water-cycle': wide('Water cycle', 'evaporation, cloud and rain going round',
    'no parameters',
    ({ p, time, width, height, colors }) => {
      const seaY = height * 0.78;
      p.push();
      p.noStroke();
      p.fill(tint(p, '#5aa9e6', 120));
      p.rect(0, seaY, width, height - seaY);
      p.fill(tint(p, colors.dim, 110));
      p.ellipse(width * 0.5, height * 0.24, width * 0.34, height * 0.16);
      p.ellipse(width * 0.4, height * 0.27, width * 0.2, height * 0.12);
      p.pop();
      for (let i = 0; i < 6; i++) {
        const t = ((time * 0.3 + i / 6) % 1);
        arrow(p, width * 0.2, seaY - t * (seaY - height * 0.32),
              width * 0.2, seaY - t * (seaY - height * 0.32) - 20, colors.accent, 3, 9);
      }
      for (let i = 0; i < 8; i++) {
        const t = ((time * 0.6 + i / 8) % 1);
        p.push();
        p.noStroke();
        p.fill('#5aa9e6');
        p.circle(width * 0.56 + (i % 4) * 34, height * 0.34 + t * (seaY - height * 0.34), 9);
        p.pop();
      }
      caption(p, 'Evaporation', width * 0.2, height * 0.56, colors, 20);
      caption(p, 'Rain', width * 0.66, height * 0.56, colors, 20);
    }),

  'earth-layers': square('Layers of the earth', 'the crust, mantle and core as shells',
    'items (up to 4 layer labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 4);
      const defaults = ['Crust', 'Mantle', 'Outer core', 'Inner core'];
      const cx = width / 2;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.4;
      const shells = [1, 0.74, 0.46, 0.24];
      shells.forEach((k, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        p.push();
        p.noStroke();
        p.fill(tint(p, i < 2 ? colors.accent : '#ff8c42', 90 + i * 40));
        p.circle(cx, cy, r * 2 * k * on);
        p.pop();
      });
      shells.forEach((k, i) => {
        caption(p, names[i] || defaults[i], cx + r * (k * 0.5 + 0.06), cy - r * k + 22, colors, 18);
      });
    }),

  'plate-tectonics': wide('Plate boundary', 'two plates meeting and pushing up a range',
    'mode ("collide", "spread" or "slide")',
    ({ p, progress, width, height, params, colors }) => {
      const mode = String(params.mode || 'collide');
      const cy = height * 0.58;
      const t = Math.min(1, progress);
      const shift = mode === 'spread' ? -t * width * 0.06 : t * width * 0.06;
      [-1, 1].forEach((side) => {
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.dim, 130));
        p.rect(side < 0 ? 0 : width / 2 + shift, cy,
               width / 2 - (side < 0 ? -shift : shift), height * 0.3);
        p.pop();
      });
      if (mode === 'collide') {
        p.push();
        p.noStroke();
        p.fill(colors.accent);
        p.triangle(width / 2 - 90, cy, width / 2, cy - 80 * t, width / 2 + 90, cy);
        p.pop();
      }
      arrow(p, width * 0.2, cy - 46, width * 0.2 + (mode === 'spread' ? -60 : 60), cy - 46, colors.accent, 4);
      arrow(p, width * 0.8, cy - 46, width * 0.8 + (mode === 'spread' ? 60 : -60), cy - 46, colors.accent, 4);
      caption(p, mode, width / 2, height * 0.94, colors);
    }),

  // =========================================================================
  // Process and general purpose
  // =========================================================================

  flowchart: wide('Flow chart', 'boxes joined by arrows, left to right',
    'items (2-5 steps, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (!names.length) return;
      const xs = spread(names.length, width * 0.16, width * 0.84);
      const cy = height / 2;
      const w = Math.min((width * 0.68) / safe(names.length) - 18, 190);
      names.forEach((name, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        if (i > 0 && stagger(progress, i - 1, 0.16) > 0.9) {
          arrow(p, xs[i - 1] + w / 2, cy, xs[i] - w / 2, cy, colors.accent, 4);
        }
        box(p, xs[i], cy, w, height * 0.24, name, colors, { lit: i === names.length - 1 });
      });
    }),

  cycle: square('Cycle', 'steps going round and returning to the start',
    'items (3-6 steps, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 6);
      if (names.length < 2) return;
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      names.forEach((name, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const a = (i / safe(names.length)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const next = ((i + 1) / safe(names.length)) * Math.PI * 2 - Math.PI / 2;
        arcArrow(p, cx, cy, r, a + 0.26, next - 0.26, tint(p, colors.accent, 180 * on), 4);
        bubble(p, x, y, 40 * on, '', colors, { lit: i === 0 });
        caption(p, name, x, y + 58, colors, 19);
      });
    }),

  pyramid: square('Pyramid', 'levels stacked from a wide base to a narrow top',
    'items (3-5 levels, top first)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (!names.length) return;
      const top = height * 0.2;
      const band = (height * 0.6) / safe(names.length);
      names.forEach((name, i) => {
        const on = stagger(progress, names.length - 1 - i, 0.14);
        if (on <= 0) return;
        const wTop = width * 0.14 + (i / safe(names.length)) * width * 0.56;
        const wBot = width * 0.14 + ((i + 1) / safe(names.length)) * width * 0.56;
        const y = top + i * band;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 230 - i * 34));
        p.beginShape();
        p.vertex(width / 2 - wTop / 2, y);
        p.vertex(width / 2 + wTop / 2, y);
        p.vertex(width / 2 + wBot / 2, y + band - 6);
        p.vertex(width / 2 - wBot / 2, y + band - 6);
        p.endShape();
        p.pop();
        caption(p, name, width / 2, y + band / 2, colors, 20);
      });
    }),

  'before-after': wide('Before and after', 'two states side by side with an arrow between',
    'labelA (before), labelB (after), items (up to 3 changes)',
    ({ p, progress, width, height, params, items, colors }) => {
      const changes = labels(items, 3);
      const cy = height * 0.42;
      const w = width * 0.3;
      box(p, width * 0.24, cy, w, height * 0.34, clean(params.labelA, 12) || 'Before', colors);
      if (progress > 0.35) {
        arrow(p, width * 0.42, cy, width * 0.58, cy, colors.accent, 6, 20);
      }
      if (progress > 0.5) {
        box(p, width * 0.76, cy, w, height * 0.34, clean(params.labelB, 12) || 'After', colors,
            { lit: true });
      }
      changes.forEach((c, i) => {
        const on = stagger(progress, i + 3, 0.12);
        if (on > 0) caption(p, c, width / 2, height * 0.72 + i * 30, colors, 19);
      });
    }),

  checklist: wide('Checklist', 'points ticked off one at a time',
    'items (2-5 points, each with a label)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (!names.length) return;
      const top = height * 0.24;
      const gap = (height * 0.52) / safe(names.length);
      names.forEach((name, i) => {
        const on = stagger(progress, i, 0.18);
        if (on <= 0) return;
        const y = top + i * gap;
        const x = width * 0.22;
        p.push();
        p.noFill();
        p.stroke(on > 0.6 ? colors.good : colors.dim);
        p.strokeWeight(4);
        p.rect(x - 22, y - 22, 44, 44, 6);
        if (on > 0.6) {
          p.strokeCap(p.ROUND);
          p.line(x - 10, y + 2, x - 2, y + 12);
          p.line(x - 2, y + 12, x + 12, y - 10);
        }
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(26);
        p.text(name, x + 40, y);
        p.pop();
      });
    }),

  'scale-balance': wide('Balance', 'two sides of a scale tipping towards the heavier',
    'items (2 sides, each with a label and a value)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 2);
      const a = vs[0]?.value ?? 1;
      const b = vs[1]?.value ?? 1;
      const tilt = Math.max(-0.3, Math.min(0.3, ((b - a) / safe(Math.abs(a) + Math.abs(b))) * 0.6))
        * Math.min(1, progress * 1.6);
      const cx = width / 2;
      const cy = height * 0.42;
      const arm = width * 0.3;
      p.push();
      p.translate(cx, cy);
      p.rotate(tilt);
      p.stroke(colors.text);
      p.strokeWeight(8);
      p.line(-arm, 0, arm, 0);
      p.pop();
      const pan = (side: number, v: { label: string; value: number } | undefined) => {
        const x = cx + side * arm * Math.cos(tilt);
        const y = cy + side * arm * Math.sin(tilt) + 54;
        p.push();
        p.noFill();
        p.stroke(colors.dim);
        p.strokeWeight(3);
        p.line(x, y - 54, x, y);
        p.pop();
        box(p, x, y + 22, 132, 46, v ? v.label : '', colors, { lit: side > 0 });
        if (v) caption(p, String(v.value), x, y + 66, colors, 20);
      };
      pan(-1, vs[0]);
      pan(1, vs[1]);
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.triangle(cx, cy + 6, cx - 30, cy + 74, cx + 30, cy + 74);
      p.pop();
    }),
};
