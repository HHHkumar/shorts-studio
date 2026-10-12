import type p5 from 'p5';
import type { SketchColors, SketchDef } from './sketches';
import { arrow, axes, caption, clean, curve, junction, num, setDash, wire, type Plot } from './sketch-parts';
import { angleBetween, phasorSum, readPhasors } from '../lib/phasors';

// ---------------------------------------------------------------------------
// The standard characteristics: the curves an electrical paper keeps asking
// about, each drawn from its own equation.
//
// A script about the torque of an induction motor asked for "a graph" and got
// an upward quadratic; one about a thyristor's holding current got a diode's
// forward curve; one about a lamp burning steadily for ten hours got a rising
// curve with strips under it. The library had a curve for none of them, so the
// model reached for the nearest shape it did have - and a curve of the wrong
// shape is a wrong statement.
//
// Each sketch here is one characteristic, and it is the right one: the torque
// against slip really is 2 / (s/sm + sm/s) of its maximum, so its peak really
// does sit at s = R2/X2 and really does keep its height as R2 is raised. The
// landmarks an examiner asks about are marked and named. Nothing is given a
// number - these are shapes and relationships, true of every machine of the
// kind - so there is nothing for a script to get wrong by leaving a knob out.
//
// The equations are written beside each curve, so a reader who knows the
// subject can check the drawing against the textbook rather than trust it.
// ---------------------------------------------------------------------------

type Draw = SketchDef['draw'];

const wide = (label: string, describe: string, uses: string, draw: Draw): SketchDef =>
  ({ shape: 'wide', label, describe, uses, draw });

const square = (label: string, describe: string, uses: string, draw: Draw): SketchDef =>
  ({ shape: 'square', label, describe, uses, draw });

/** Type that scales with the canvas, so a label is as readable on a phone as on a desktop. */
const sizeFor = (width: number, height: number, base = 27) =>
  Math.max(13, Math.min(base * 1.25, (Math.min(width, height * 1.5) / 900) * base));

/** A label that sits beside a point rather than centred on it. */
function note(
  p: p5, text: string, x: number, y: number, colors: SketchColors, size: number,
  align: 'left' | 'right' | 'center' = 'center', colour?: string,
) {
  const t = clean(text, 60);
  if (!t) return;
  p.push();
  p.noStroke();
  p.fill(colour || colors.dim);
  p.textAlign(align === 'left' ? p.LEFT : align === 'right' ? p.RIGHT : p.CENTER, p.CENTER);
  p.textSize(size);
  p.text(t, x, y);
  p.pop();
}

/** A dashed guide from a point down to the x axis and across to the y axis. */
function drops(p: p5, plot: Plot, t: number, v: number, colors: SketchColors, toX = true, toY = true) {
  setDash(p, true);
  if (toX) wire(p, plot.x(t), plot.y(v), plot.x(t), plot.bottom, colors.dim, 2);
  if (toY) wire(p, plot.left, plot.y(v), plot.x(t), plot.y(v), colors.dim, 2);
  setDash(p, false);
}

/** A curve given as points, revealed along its length. */
function path(p: p5, pts: [number, number][], colour: string, progress: number, w = 5, dashed = false) {
  const upto = Math.max(0, Math.min(1, progress));
  const n = Math.floor((pts.length - 1) * upto);
  if (n < 1) return;
  setDash(p, dashed);
  p.push();
  p.noFill();
  p.stroke(colour);
  p.strokeWeight(w);
  p.beginShape();
  for (let i = 0; i <= n; i++) p.vertex(pts[i][0], pts[i][1]);
  p.endShape();
  p.pop();
  setDash(p, false);
}

/** Axes through the middle of the canvas, for a characteristic with four quadrants. */
function crossAxes(
  p: p5, width: number, height: number, colors: SketchColors, labels: { x: string; y: string }, size: number,
  origin: { x: number; y: number } = { x: 0.5, y: 0.5 },
) {
  const left = width * 0.07;
  const right = width * 0.93;
  const top = height * 0.1;
  const bottom = height * 0.86;
  const ox = left + (right - left) * origin.x;
  const oy = top + (bottom - top) * origin.y;
  arrow(p, left, oy, right, oy, colors.dim, 3, 12);
  arrow(p, ox, bottom, ox, top, colors.dim, 3, 12);
  note(p, labels.x, right, oy + size * 1.1, colors, size * 0.85, 'right');
  note(p, labels.y, ox + size * 0.6, top + size * 0.2, colors, size * 0.85, 'left');
  // x and y run from -1 to 1 either side of the origin, and each side has its
  // own scale: with the origin off-centre, a forward quadrant is drawn large
  // without the reverse one being pushed off the canvas.
  return {
    ox, oy,
    x: (v: number) => ox + v * (v >= 0 ? (right - ox) * 0.96 : (ox - left) * 0.96),
    y: (v: number) => oy - v * (v >= 0 ? (oy - top) * 0.94 : (bottom - oy) * 0.94),
  };
}

/** Torque as a fraction of the maximum, at slip s, for a motor whose peak is at slip sm. */
export const torqueAt = (s: number, sm: number) => 2 / (s / sm + sm / s);

/** Series-resonance current as a fraction of its peak, at x = f / f0, for quality factor q. */
export const resonanceAt = (x: number, q: number) => 1 / Math.sqrt(1 + q * q * (x - 1 / x) * (x - 1 / x));

export const CURVE_SKETCHES: Record<string, SketchDef> = {
  // T / Tmax = 2 / (s/sm + sm/s),  sm = R2 / X2.  Tmax does not depend on R2.
  'torque-slip': wide('Torque against slip',
    'the torque of a three-phase induction motor from standstill to synchronous speed: the starting torque, the maximum (breakdown) torque and the slip it happens at. Use for: induction motor torque-slip characteristic, starting torque, breakdown or pull-out torque, the effect of rotor resistance, slip-ring motor starting',
    'mode ("single" for one motor\'s curve, "rotor-resistance" for the family as rotor resistance is raised - the peak keeps its height and moves towards standstill, reaching it when R2 = X2)',
    ({ p, progress, width, height, params, colors }) => {
      const f = sizeFor(width, height);
      const family = String(params.mode || '').toLowerCase() === 'rotor-resistance';
      const plot = axes(p, width, height, colors, { x: 'Speed', y: 'Torque' });
      // Speed runs left to right, so slip runs from 1 at standstill to 0.
      const at = (sm: number) => (t: number) => 0.86 * torqueAt(Math.max(1e-4, 1 - t), sm);
      note(p, 's = 1', plot.x(0), plot.bottom + f * 0.75, colors, f * 0.8, 'left');
      note(p, family ? 's = 0' : 's = 0: synchronous speed', plot.x(1), plot.bottom + f * 0.75, colors, f * 0.8, 'right');

      if (family) {
        // Three rotor resistances. The last is R2 = X2, whose peak is at standstill.
        const peaks = [0.2, 0.5, 1];
        peaks.forEach((sm, i) => {
          curve(p, plot, at(sm), i === peaks.length - 1 ? colors.accent : colors.text, progress * 1.3 - i * 0.12, i === peaks.length - 1 ? 6 : 4);
        });
        if (progress > 0.55) {
          setDash(p, true);
          wire(p, plot.left, plot.y(0.86), plot.x(0.8), plot.y(0.86), colors.dim, 2);
          setDash(p, false);
          note(p, 'Same maximum torque', plot.x(0.42), plot.y(0.86) - f * 0.8, colors, f * 0.85);
          arrow(p, plot.x(0.74), plot.y(0.97), plot.x(0.1), plot.y(0.97), colors.dim, 3, 12);
          note(p, 'R2 rising', plot.x(0.42), plot.y(0.97) - f * 0.7, colors, f * 0.85);
          junction(p, plot.x(0), plot.y(0.86), colors.accent, 14);
          // Under the curves, where nothing else is drawn.
          note(p, 'R2 = X2: maximum torque at starting', plot.x(0.42), plot.y(0.14), colors, f * 0.82, 'center', colors.accent);
        }
        return;
      }

      const sm = 0.2;
      curve(p, plot, at(sm), colors.accent, progress * 1.2, 6);
      if (progress > 0.45) {
        junction(p, plot.x(0), plot.y(at(sm)(0)), colors.text, 14);
        note(p, 'Starting torque', plot.x(0.04), plot.y(at(sm)(0)) + f * 1.0, colors, f * 0.85, 'left');
      }
      if (progress > 0.65) {
        drops(p, plot, 1 - sm, 0.86, colors);
        junction(p, plot.x(1 - sm), plot.y(0.86), colors.accent, 14);
        note(p, 'Maximum torque', plot.x(1 - sm) - f * 0.5, plot.y(0.86) - f * 0.85, colors, f * 0.85, 'right', colors.accent);
        // Beside its guide and under the curve, clear of the axis labels.
        note(p, 's = R2 / X2', plot.x(1 - sm) - f * 0.4, plot.y(0.28), colors, f * 0.82, 'right');
      }
      if (progress > 0.85) junction(p, plot.x(1), plot.y(0), colors.text, 12);
    }),

  // I / Imax = 1 / sqrt(1 + Q^2 (f/f0 - f0/f)^2).  Half power where that is 1/sqrt 2; BW = f0 / Q.
  'resonance-curve': wide('Series resonance',
    'the current in a series RLC circuit against frequency: the peak at the resonant frequency, the two half-power points at 0.707 of it, and the bandwidth between them. Use for: series resonance, resonant frequency, half-power points, bandwidth, quality factor and selectivity',
    'mode ("single" for one curve with its bandwidth marked, "q-factor" to set a sharp high-Q curve against a flat low-Q one)',
    ({ p, progress, width, height, params, colors }) => {
      const f = sizeFor(width, height);
      const compare = String(params.mode || '').toLowerCase() === 'q-factor';
      const plot = axes(p, width, height, colors, { y: 'Current' });
      // The axis is named at its far end: f1, f0 and f2 are written under its middle.
      note(p, 'Frequency', plot.right, plot.bottom + f * 0.8, colors, f * 0.8, 'right');
      // The frequency axis runs from 0.3 to 1.9 of the resonant frequency.
      const lo = 0.3;
      const span = 1.6;
      const xOf = (ratio: number) => (ratio - lo) / span;
      const at = (q: number) => (t: number) => 0.88 * resonanceAt(lo + span * t, q);

      if (compare) {
        curve(p, plot, at(8), colors.accent, progress * 1.2, 6);
        curve(p, plot, at(1.6), colors.text, progress * 1.2 - 0.15, 4);
        if (progress > 0.6) {
          setDash(p, true);
          wire(p, plot.x(xOf(1)), plot.bottom, plot.x(xOf(1)), plot.y(0.88), colors.dim, 2);
          setDash(p, false);
          note(p, 'f0', plot.x(xOf(1)), plot.bottom + f * 0.75, colors, f * 0.85);
          // In the gap between the two curves, to the right of the peak.
          note(p, 'High Q: narrow', plot.x(xOf(1.2)), plot.y(0.42), colors, f * 0.85, 'left', colors.accent);
          note(p, 'Low Q: wide', plot.x(xOf(1.6)), plot.y(0.72), colors, f * 0.85, 'center');
        }
        return;
      }

      const q = 4;
      curve(p, plot, at(q), colors.accent, progress * 1.2, 6);
      // x - 1/x = -1/q and +1/q.
      const f1 = (-1 / q + Math.sqrt(1 / (q * q) + 4)) / 2;
      const f2 = (1 / q + Math.sqrt(1 / (q * q) + 4)) / 2;
      const half = 0.88 / Math.SQRT2;
      if (progress > 0.5) {
        setDash(p, true);
        wire(p, plot.x(xOf(1)), plot.bottom, plot.x(xOf(1)), plot.y(0.88), colors.dim, 2);
        wire(p, plot.left, plot.y(0.88), plot.x(xOf(1)), plot.y(0.88), colors.dim, 2);
        setDash(p, false);
        note(p, 'f0', plot.x(xOf(1)), plot.bottom + f * 0.75, colors, f * 0.85);
        note(p, 'Imax', plot.left - f * 0.3, plot.y(0.88), colors, f * 0.8, 'right');
      }
      if (progress > 0.7) {
        setDash(p, true);
        wire(p, plot.left, plot.y(half), plot.x(xOf(f2)), plot.y(half), colors.dim, 2);
        wire(p, plot.x(xOf(f1)), plot.bottom, plot.x(xOf(f1)), plot.y(half), colors.dim, 2);
        wire(p, plot.x(xOf(f2)), plot.bottom, plot.x(xOf(f2)), plot.y(half), colors.dim, 2);
        setDash(p, false);
        junction(p, plot.x(xOf(f1)), plot.y(half), colors.text, 13);
        junction(p, plot.x(xOf(f2)), plot.y(half), colors.text, 13);
        note(p, '0.707 Imax', plot.left - f * 0.3, plot.y(half), colors, f * 0.72, 'right');
        note(p, 'f1', plot.x(xOf(f1)) - f * 0.5, plot.bottom + f * 0.75, colors, f * 0.85);
        note(p, 'f2', plot.x(xOf(f2)) + f * 0.5, plot.bottom + f * 0.75, colors, f * 0.85);
      }
      if (progress > 0.85) {
        const y = plot.y(half * 0.42);
        arrow(p, plot.x(xOf(1)), y, plot.x(xOf(f1)), y, colors.accent, 3, 10);
        arrow(p, plot.x(xOf(1)), y, plot.x(xOf(f2)), y, colors.accent, 3, 10);
        // In the open corner of the plot: under the arrows it lay across the guides.
        note(p, 'Bandwidth = f2 - f1 = f0 / Q', plot.right, plot.y(0.94), colors, f * 0.8, 'right', colors.accent);
      }
    }),

  // Forward: blocks up to the breakover voltage VBO, then latches into conduction.
  // It stays on while the current is above the holding current IH; to latch on in
  // the first place it must reach the latching current IL, and IL > IH.
  'scr-characteristic': wide('Thyristor characteristic',
    'the voltage-current characteristic of a thyristor (SCR): forward blocking up to the breakover voltage, forward conduction, the latching current and the lower holding current, and reverse blocking to breakdown. Use for: SCR or thyristor V-I characteristic, latching and holding current, forward breakover voltage, turn-on and turn-off',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const f = sizeFor(width, height);
      const a = crossAxes(p, width, height, colors, { x: 'Anode voltage', y: 'Anode current' }, f, { x: 0.34, y: 0.7 });
      const P = (x: number, y: number): [number, number] => [a.x(x), a.y(y)];
      const line = (from: [number, number], to: [number, number], n = 12): [number, number][] =>
        Array.from({ length: n + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);

      // Reverse: a small leakage, then avalanche breakdown.
      const reverse: [number, number][] = [...line(P(0, 0), P(-0.62, -0.05)), ...line(P(-0.62, -0.05), P(-0.7, -0.14), 4), ...line(P(-0.7, -0.14), P(-0.74, -0.8), 10)];
      // Forward blocking: a small leakage up to the breakover voltage.
      const blocking: [number, number][] = [...line(P(0, 0), P(0.78, 0.07)), ...line(P(0.78, 0.07), P(0.84, 0.13), 4)];
      // The jump into conduction: a region the device passes through, not one it rests in.
      const jump = line(P(0.84, 0.13), P(0.13, 0.2), 14);
      // Conduction: about a volt across it, whatever the current.
      const conduction = line(P(0.13, 0.2), P(0.2, 0.95), 14);

      path(p, reverse, colors.text, progress * 2.4, 4);
      path(p, blocking, colors.accent, progress * 2.4 - 0.3, 6);
      path(p, jump, colors.accent, progress * 2.4 - 0.7, 3, true);
      path(p, conduction, colors.accent, progress * 2.4 - 1, 6);

      if (progress > 0.45) {
        note(p, 'Forward blocking', a.x(0.5), a.oy + f * 0.8, colors, f * 0.78);
        setDash(p, true);
        wire(p, a.x(0.84), a.oy, a.x(0.84), a.y(0.13), colors.dim, 2);
        setDash(p, false);
        note(p, 'VBO', a.x(0.9), a.y(0.13) - f * 0.9, colors, f * 0.8);
      }
      if (progress > 0.6) {
        note(p, 'Conduction', a.x(0.2) + f * 0.5, a.y(0.86), colors, f * 0.82, 'left', colors.accent);
        note(p, 'Reverse blocking', a.x(-0.34), a.oy - f * 0.8, colors, f * 0.78);
        note(p, 'Breakdown', a.x(-0.74) + f * 0.4, a.y(-0.7), colors, f * 0.78, 'left');
      }
      if (progress > 0.78) {
        // The holding current is where conduction ends; the latching current is above it.
        const hold = 0.2;
        const latch = 0.38;
        const xOn = (y: number) => 0.13 + ((0.2 - 0.13) * (y - 0.2)) / (0.95 - 0.2);
        setDash(p, true);
        wire(p, a.ox, a.y(hold), a.x(xOn(hold)), a.y(hold), colors.dim, 2);
        wire(p, a.ox, a.y(latch), a.x(xOn(latch)), a.y(latch), colors.dim, 2);
        setDash(p, false);
        junction(p, a.x(xOn(hold)), a.y(hold), colors.text, 13);
        junction(p, a.x(xOn(latch)), a.y(latch), colors.text, 13);
        note(p, 'IH holding', a.ox - f * 0.3, a.y(hold), colors, f * 0.78, 'right');
        note(p, 'IL latching', a.ox - f * 0.3, a.y(latch), colors, f * 0.78, 'right');
      }
    }),

  // Energy = power x time: the area of the rectangle.
  'power-time': wide('Power over time',
    'steady power drawn against the time it runs: the energy used is the area of the rectangle. Two loads may be set together, to show a high power for a short time against a low power for a long time. Use for: energy = power x time, kilowatt-hours and units of electricity, comparing the energy of two loads',
    'items (1-2 loads; label is its name, value is its power in watts, and symbol is the hours it runs, e.g. {"label": "One bulb", "value": 100, "symbol": "10"})',
    ({ p, progress, width, height, items, colors }) => {
      const f = sizeFor(width, height);
      const loads = (items || []).slice(0, 2)
        .map((it) => ({ name: clean(it.label, 18), watts: Number(it.value), hours: Number(String(it.symbol ?? '').replace(/[^0-9.]/g, '')) }))
        .filter((l) => Number.isFinite(l.watts) && l.watts > 0 && Number.isFinite(l.hours) && l.hours > 0);
      if (!loads.length) return;
      const plot = axes(p, width, height, colors, { x: 'Time, hours', y: 'Power, watts' });
      const maxW = Math.max(...loads.map((l) => l.watts));
      const maxH = Math.max(...loads.map((l) => l.hours));
      const tidy = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
      const energy = (wh: number) => (wh >= 1000 ? tidy(wh / 1000) + ' kWh' : tidy(wh) + ' Wh');

      loads.forEach((l, i) => {
        const grow = Math.max(0, Math.min(1, progress * 2 - i * 0.5));
        if (grow <= 0) return;
        const w = (l.hours / maxH) * 0.92 * grow;
        const h = (l.watts / maxW) * 0.86;
        const colour = i === 0 ? colors.accent : colors.text;
        p.push();
        p.stroke(colour);
        p.strokeWeight(5);
        const fill = p.color(colour);
        fill.setAlpha(46);
        p.fill(fill);
        p.rect(plot.x(0), plot.y(h), plot.x(w) - plot.x(0), plot.y(0) - plot.y(h));
        p.pop();
        if (grow < 1) return;
        // What each side is, on the axes; what the area comes to, inside it.
        note(p, tidy(l.watts) + ' W', plot.left - f * 0.3, plot.y(h), colors, f * 0.78, 'right', colour);
        note(p, tidy(l.hours) + ' h', plot.x(w), plot.bottom + f * 0.75, colors, f * 0.78, 'center', colour);
        // A tall narrow load is labelled above itself; a low wide one inside its far end.
        const tall = h > 0.5 && w < 0.4;
        const text = (l.name ? l.name + ': ' : '') + energy(l.watts * l.hours);
        const roomy = loads.length === 1 && w > 0.45 && h > 0.3;
        if (roomy) note(p, text, (plot.x(0) + plot.x(w)) / 2, plot.y(h / 2), colors, f * 1.05, 'center', colour);
        else if (tall) note(p, text, plot.x(w) + f * 0.5, plot.y(h * 0.72), colors, f * 0.82, 'left', colour);
        else note(p, text, plot.x(w) - f * 0.5, plot.y(h) - f * 0.75, colors, f * 0.82, 'right', colour);
      });
    }),

  // Descending branch B = Bs tanh(k (H + Hc)), ascending B = Bs tanh(k (H - Hc)).
  // B at H = 0 is the retentivity; H at B = 0 is the coercive force.
  'hysteresis-loop': wide('Hysteresis loop',
    'the B-H loop of a magnetic material: saturation, the flux density left when the field is removed (retentivity), and the reverse field needed to cancel it (coercive force). The area of the loop is the hysteresis loss each cycle. Use for: hysteresis, B-H curve, retentivity or residual magnetism, coercivity, hysteresis loss, soft and hard magnetic materials',
    'mode ("loop" for one loop with its landmarks, "soft-hard" to set a narrow soft-iron loop against a wide hard-steel one)',
    ({ p, progress, width, height, params, colors }) => {
      const f = sizeFor(width, height);
      const both = String(params.mode || '').toLowerCase() === 'soft-hard';
      const a = crossAxes(p, width, height, colors, { x: 'H', y: 'B' }, f);
      const k = 3.2;
      const loop = (hc: number, bs: number): { down: [number, number][]; up: [number, number][] } => {
        const down: [number, number][] = [];
        const up: [number, number][] = [];
        for (let i = 0; i <= 60; i++) {
          const h = 0.9 - (1.8 * i) / 60;
          down.push([a.x(h), a.y(bs * Math.tanh(k * (h + hc)))]);
          up.push([a.x(-h), a.y(bs * Math.tanh(k * (-h - hc)))]);
        }
        return { down, up };
      };

      if (both) {
        const hard = loop(0.42, 0.78);
        const soft = loop(0.1, 0.78);
        path(p, hard.down, colors.text, progress * 2, 4);
        path(p, hard.up, colors.text, progress * 2 - 0.5, 4);
        path(p, soft.down, colors.accent, progress * 2 - 0.4, 6);
        path(p, soft.up, colors.accent, progress * 2 - 0.9, 6);
        if (progress > 0.7) {
          note(p, 'Soft iron: narrow, low loss', a.x(-0.92), a.y(0.92), colors, f * 0.8, 'left', colors.accent);
          note(p, 'Hard steel: wide, a magnet', a.x(0.92), a.y(-0.92), colors, f * 0.8, 'right');
        }
        return;
      }

      const hc = 0.28;
      const bs = 0.8;
      const one = loop(hc, bs);
      path(p, one.down, colors.accent, progress * 2, 6);
      path(p, one.up, colors.accent, progress * 2 - 0.6, 6);
      const br = bs * Math.tanh(k * hc);
      if (progress > 0.55) {
        junction(p, a.x(0), a.y(br), colors.text, 14);
        note(p, 'Br retentivity', a.x(0) - f * 0.5, a.y(br) - f * 0.9, colors, f * 0.8, 'right');
      }
      if (progress > 0.7) {
        junction(p, a.x(-hc), a.y(0), colors.text, 14);
        note(p, 'Hc coercive force', a.x(-hc) - f * 0.5, a.y(0) - f * 0.8, colors, f * 0.8, 'right');
      }
      if (progress > 0.85) {
        note(p, 'Saturation', a.x(0.86), a.y(bs) - f * 0.8, colors, f * 0.8, 'right');
        note(p, 'Loop area = loss per cycle', a.x(0.95), a.y(-0.6), colors, f * 0.78, 'right');
      }
    }),

  // E rises in proportion to the field current while the iron is unsaturated (the
  // air-gap line), then bends over as it saturates. It starts above zero: residual flux.
  'magnetisation-curve': wide('Magnetisation curve',
    'the open-circuit characteristic of a generator: generated EMF against field current, straight at first along the air-gap line, bending over at the knee as the iron saturates, and starting from a small residual voltage. Use for: open-circuit characteristic (OCC), magnetisation curve, saturation, the air-gap line, residual magnetism, voltage build-up of a shunt generator',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const f = sizeFor(width, height);
      const plot = axes(p, width, height, colors, { x: 'Field current', y: 'Generated EMF' });
      const residual = 0.05;
      const b = 2.1;
      const occ = (t: number) => residual + (0.84 * Math.tanh(b * t)) / Math.tanh(b);
      const slope = (0.84 * b) / Math.tanh(b);
      curve(p, plot, occ, colors.accent, progress * 1.2, 6);
      if (progress > 0.4) {
        setDash(p, true);
        const reach = (1 - residual) / slope;
        wire(p, plot.x(0), plot.y(residual), plot.x(reach), plot.y(1), colors.dim, 3);
        setDash(p, false);
        note(p, 'Air-gap line', plot.x(reach) + f * 0.4, plot.y(0.97), colors, f * 0.82, 'left');
      }
      if (progress > 0.6) {
        junction(p, plot.x(0), plot.y(residual), colors.text, 13);
        wire(p, plot.x(0.012), plot.y(residual), plot.x(0.2), plot.y(0.1), colors.dim, 2);
        note(p, 'Residual voltage', plot.x(0.21), plot.y(0.1), colors, f * 0.78, 'left');
        junction(p, plot.x(0.42), plot.y(occ(0.42)), colors.text, 13);
        note(p, 'Knee', plot.x(0.42) + f * 0.5, plot.y(occ(0.42)) + f * 0.5, colors, f * 0.82, 'left');
      }
      if (progress > 0.8) note(p, 'Saturation', plot.x(0.97), plot.y(occ(0.97)) + f * 0.9, colors, f * 0.82, 'right', colors.accent);
    }),

  // Efficiency = output / (output + iron loss + copper loss). Iron loss is constant;
  // copper loss goes as the square of the load. The maximum is where the two are equal.
  'transformer-efficiency': wide('Efficiency against load',
    'the efficiency of a transformer against its load, with the constant iron loss and the copper loss that grows as the square of the load: efficiency is greatest where the two losses are equal. Use for: transformer efficiency, the condition for maximum efficiency, iron (core) loss and copper loss, all-day efficiency',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const f = sizeFor(width, height);
      const plot = axes(p, width, height, colors, { x: 'Load', y: '' });
      // The load axis runs from a light load to 1.3 of full load. Iron loss is half
      // the full-load copper loss, so the two are equal at 0.707 of full load. The
      // losses are drawn larger than a real transformer's, or the maximum - a
      // fraction of a percent in practice - could not be seen at all.
      const from = 0.08;
      const span = 1.3 - from;
      const iron = 0.06;
      const copper = 0.12;
      const best = Math.sqrt(iron / copper);
      const eta = (x: number) => x / (x + iron + copper * x * x);
      const loadAt = (t: number) => from + span * t;
      // Efficiency across the top of the plot; the two losses along the bottom.
      const etaY = (t: number) => 0.44 + ((eta(loadAt(t)) - 0.55) / 0.32) * 0.5;
      const scale = 0.3 / (copper * 1.3 * 1.3);
      curve(p, plot, etaY, colors.accent, progress * 1.2, 6);
      curve(p, plot, () => iron * scale, colors.dim, progress * 1.2 - 0.1, 4);
      curve(p, plot, (t) => copper * loadAt(t) * loadAt(t) * scale, colors.text, progress * 1.2 - 0.2, 4);
      if (progress > 0.5) {
        note(p, 'Efficiency', plot.x(0.97), plot.y(etaY(0.97)) + f * 0.9, colors, f * 0.85, 'right', colors.accent);
        note(p, 'Copper loss', plot.x(0.97), plot.y(copper * 1.3 * 1.3 * scale) - f * 0.8, colors, f * 0.8, 'right');
        note(p, 'Iron loss', plot.x(0.08), plot.y(iron * scale) - f * 0.7, colors, f * 0.8, 'left');
      }
      if (progress > 0.75) {
        const t = (best - from) / span;
        setDash(p, true);
        wire(p, plot.x(t), plot.bottom, plot.x(t), plot.y(etaY(t)), colors.dim, 2);
        setDash(p, false);
        junction(p, plot.x(t), plot.y(iron * scale), colors.text, 13);
        junction(p, plot.x(t), plot.y(etaY(t)), colors.accent, 14);
        note(p, 'Maximum: copper loss = iron loss', plot.x(t), plot.y(etaY(t)) - f * 0.9, colors, f * 0.8, 'center', colors.accent);
      }
    }),

  // At constant load the armature current is least at unity power factor. Less
  // field current than that and the motor draws lagging current; more, leading.
  'v-curves': wide('V-curves',
    'the armature current of a synchronous motor against its field current at constant load: a V whose lowest point is unity power factor, lagging when under-excited and leading when over-excited. Use for: synchronous motor V-curves, excitation and power factor, the synchronous condenser',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const f = sizeFor(width, height);
      const plot = axes(p, width, height, colors, { x: 'Field current', y: 'Armature current' });
      // Three loads. A heavier load lifts the V and moves its foot to the right.
      const loads = [{ floor: 0.12, foot: 0.4 }, { floor: 0.3, foot: 0.47 }, { floor: 0.48, foot: 0.54 }];
      const v = (l: { floor: number; foot: number }) => (t: number) => Math.hypot(l.floor, 1.75 * (t - l.foot));
      loads.forEach((l, i) => curve(p, plot, v(l), i === loads.length - 1 ? colors.accent : colors.text, progress * 1.3 - i * 0.1, i === loads.length - 1 ? 6 : 4));
      if (progress > 0.55) {
        setDash(p, true);
        wire(p, plot.x(loads[0].foot), plot.y(loads[0].floor), plot.x(loads[2].foot + 0.05), plot.y(loads[2].floor + 0.13), colors.dim, 3);
        setDash(p, false);
        loads.forEach((l) => junction(p, plot.x(l.foot), plot.y(l.floor), colors.text, 12));
        note(p, 'Unity power factor', plot.x(loads[2].foot + 0.05), plot.y(loads[2].floor + 0.2), colors, f * 0.8, 'center');
      }
      if (progress > 0.75) {
        note(p, 'Lagging', plot.x(0.13), plot.y(0.2), colors, f * 0.85, 'center');
        note(p, 'under-excited', plot.x(0.13), plot.y(0.2) + f * 0.9, colors, f * 0.7, 'center');
        note(p, 'Leading', plot.x(0.87), plot.y(0.2), colors, f * 0.85, 'center');
        note(p, 'over-excited', plot.x(0.87), plot.y(0.2) + f * 0.9, colors, f * 0.7, 'center');
      }
    }),

  // Shunt: flux is constant, so speed barely falls with load. Series: flux follows
  // the current, so speed falls steeply - and runs away as the load is taken off.
  'dc-motor-curves': wide('DC motor speed against torque',
    'how the speed of a DC motor changes with its load torque: a shunt motor holds almost constant speed, a series motor runs fast at light load and slows steeply, and a compound motor lies between. Use for: DC motor speed-torque characteristics, shunt, series and compound motors, why a series motor must never run unloaded, choosing a motor for a load',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const f = sizeFor(width, height);
      const plot = axes(p, width, height, colors, { y: 'Speed' });
      note(p, 'Torque', plot.right, plot.bottom + f * 0.8, colors, f * 0.8, 'right');
      // All three are drawn through the same full-load point, which is how
      // they are compared: there they agree, and they differ either side of it.
      const rated = 0.7;
      const shunt = (t: number) => 0.5 + 0.086 * (rated - t);
      const series = (t: number) => 0.5 * Math.sqrt((rated + 0.05) / (t + 0.05));
      const compound = (t: number) => 0.5 + 0.22 * (1 - Math.sqrt(t / rated));
      curve(p, plot, shunt, colors.text, progress * 1.3, 5);
      curve(p, plot, compound, colors.dim, progress * 1.3 - 0.12, 4);
      curve(p, plot, (t) => (series(t) > 1.04 ? NaN : series(t)), colors.accent, progress * 1.3 - 0.24, 6);
      if (progress > 0.6) {
        // Named at the light-load end, where the three stand furthest apart.
        note(p, 'Shunt', plot.x(0.03), plot.y(shunt(0.03)) + f * 0.85, colors, f * 0.85, 'left');
        note(p, 'Compound', plot.x(0.06), plot.y(compound(0.06)) - f * 0.8, colors, f * 0.85, 'left');
        note(p, 'Series', plot.x(0.2), plot.y(series(0.2)) - f * 0.5, colors, f * 0.85, 'left', colors.accent);
        junction(p, plot.x(rated), plot.y(0.5), colors.text, 13);
        setDash(p, true);
        wire(p, plot.x(rated), plot.bottom, plot.x(rated), plot.y(0.5), colors.dim, 2);
        setDash(p, false);
        note(p, 'Full load', plot.x(rated), plot.bottom + f * 0.8, colors, f * 0.8, 'center');
      }
      if (progress > 0.8) note(p, 'Series: runs away at no load', plot.x(0.97), plot.y(0.93), colors, f * 0.78, 'right', colors.accent);
    }),

  // Each phasor has its own length and angle. Added head to tail, the last is
  // their sum - and src/lib/phasors.ts refuses the diagram if it is not.
  phasors: square('Phasor diagram',
    'two to four phasors, each at its own angle and length, either all from one point or added head to tail with their resultant. Use for: phasor diagrams, which quantity leads or lags, a voltage as the sum of another voltage and a drop (a line, a transformer, an alternator), the two-wattmeter method, capacitor and inductor currents',
    'items (2-4 phasors: label is its name, value its length against the others, symbol its angle in degrees anticlockwise from the horizontal - e.g. {"label": "Ic", "value": 0.4, "symbol": "90"} leads a phasor at 0 by ninety degrees, and "-90" lags it), mode ("fan" to draw them all from one point, "sum" to add them head to tail - the LAST one is their resultant, and is checked: it must equal the sum of the others, or nothing is drawn)',
    ({ p, progress, width, height, params, items, colors }) => {
      const list = readPhasors(items).filter((ph) => ph.label && Number.isFinite(ph.length) && ph.length > 0 && Number.isFinite(ph.angle));
      if (list.length < 2) return;
      const adding = String(params.mode || '').toLowerCase() === 'sum' && list.length >= 3;
      // Names are the only words on a phasor diagram, so they are set large.
      const f = sizeFor(width, height, 34);
      const vec = (ph: { length: number; angle: number }) => ({
        x: ph.length * Math.cos((ph.angle * Math.PI) / 180),
        y: ph.length * Math.sin((ph.angle * Math.PI) / 180),
      });

      // Every arrow as a start and an end, in the phasors' own plane (y upwards).
      type Seg = { from: { x: number; y: number }; to: { x: number; y: number }; label: string; total: boolean; angle: number };
      const segs: Seg[] = [];
      if (adding) {
        let at = { x: 0, y: 0 };
        for (const ph of list.slice(0, -1)) {
          const v = vec(ph);
          const to = { x: at.x + v.x, y: at.y + v.y };
          segs.push({ from: at, to, label: ph.label, total: false, angle: ph.angle });
          at = to;
        }
        // Drawn to where the parts actually end, so the triangle closes exactly.
        segs.push({ from: { x: 0, y: 0 }, to: at, label: list[list.length - 1].label, total: true, angle: phasorSum(list.slice(0, -1)).angle });
      } else {
        for (const ph of list) segs.push({ from: { x: 0, y: 0 }, to: vec(ph), label: ph.label, total: false, angle: ph.angle });
      }

      const xs = segs.flatMap((s) => [s.from.x, s.to.x]);
      const ys = segs.flatMap((s) => [s.from.y, s.to.y]);
      const spanX = Math.max(1e-6, Math.max(...xs) - Math.min(...xs));
      const spanY = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
      // A diagram that is all along one line still gets room either side of it.
      const scale = Math.min((width * 0.7) / spanX, (height * 0.6) / Math.max(spanY, spanX * 0.25));
      const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
      const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
      const X = (x: number) => width / 2 + (x - midX) * scale;
      const Y = (y: number) => height * 0.5 - (y - midY) * scale;

      // The reference direction, through the origin.
      setDash(p, true);
      wire(p, width * 0.08, Y(0), width * 0.92, Y(0), colors.dim, 2);
      setDash(p, false);

      // Arrows that lie along one line are set on separate rows: a drop drawn
      // back along the voltage it is taken from is otherwise one arrow, and the
      // sum cannot be seen at all. The parts climb above the reference line, each
      // with room for its name; their resultant sits below it.
      const collinear = (a: Seg, b: Seg) => Math.abs(Math.sin(((a.angle - b.angle) * Math.PI) / 180)) < 0.09;
      const inLine = adding && segs.every((s) => collinear(s, segs[0]));
      const row = f * 2.3;
      // "Up" on the page, at right angles to the first arrow.
      const first = segs[0];
      const firstLen = Math.hypot(first.to.x - first.from.x, first.to.y - first.from.y) || 1;
      const up = { x: -(first.to.y - first.from.y) / firstLen, y: -(first.to.x - first.from.x) / firstLen };
      if (up.y > 0) { up.x = -up.x; up.y = -up.y; }
      const rowOf = (s: Seg, i: number): number => (!inLine ? 0 : s.total ? -1 : i);

      segs.forEach((s, i) => {
        const on = Math.max(0, Math.min(1, progress * 2.2 - i * 0.45));
        if (on <= 0) return;
        const dx = s.to.x - s.from.x;
        const dy = s.to.y - s.from.y;
        const len = Math.hypot(dx, dy) || 1;
        const px = up.x * row * rowOf(s, i);
        const py = up.y * row * rowOf(s, i);
        const x1 = X(s.from.x) + px;
        const y1 = Y(s.from.y) + py;
        const x2 = X(s.from.x + dx * on) + px;
        const y2 = Y(s.from.y + dy * on) + py;
        const colour = s.total ? colors.accent : i === 0 ? colors.text : adding ? colors.text : colors.accent;
        arrow(p, x1, y1, x2, y2, colour, s.total || i === 0 ? 6 : 5, 16);
        if (on < 1) return;
        // Named beside its tip when they share an origin; beside its middle when chained.
        const ux = dx / len;
        const uy = -dy / len;
        if (inLine) {
          // Each name on the outer side of its own row.
          const side = s.total ? -1 : 1;
          note(p, s.label, (x1 + x2) / 2 + up.x * side * f * 0.85, (y1 + y2) / 2 + up.y * side * f * 0.85, colors, f, 'center', colour);
        } else if (adding) {
          const side = s.total ? -1 : 1;
          const lx = (x1 + x2) / 2 + -uy * side * f * 0.95;
          const ly = (y1 + y2) / 2 + ux * side * f * 0.95;
          note(p, s.label, lx, ly, colors, f, 'center', colour);
        } else {
          // One that lies along the reference line is named just above it, so
          // the dashed line does not run through its name.
          const along = Math.abs(uy) < 0.09;
          note(p, s.label, x2 + ux * f * 0.9, y2 + uy * f * 0.9 - (along ? f * 0.75 : 0), colors, f, ux > 0.3 ? 'left' : ux < -0.3 ? 'right' : 'center', colour);
        }
      });

      // The angle each makes with the first, when they share an origin: a
      // square for a right angle, an arc and its size for any other.
      if (!adding && progress > 0.75) {
        const base = list[0].angle;
        list.slice(1).forEach((ph, k) => {
          const between = angleBetween(ph.angle, base);
          if (between < 0.5 || Math.abs(between - 180) < 0.5) return;
          const signed = ((((ph.angle - base) % 360) + 540) % 360) - 180;
          const r = Math.min(width, height) * (0.1 + k * 0.045);
          const a0 = (-base * Math.PI) / 180;
          const a1 = (-ph.angle * Math.PI) / 180;
          if (Math.abs(between - 90) < 0.5) {
            const k2 = r * 0.42;
            const u0 = { x: Math.cos(a0) * k2, y: Math.sin(a0) * k2 };
            const u1 = { x: Math.cos(a1) * k2, y: Math.sin(a1) * k2 };
            wire(p, X(0) + u0.x, Y(0) + u0.y, X(0) + u0.x + u1.x, Y(0) + u0.y + u1.y, colors.dim, 3);
            wire(p, X(0) + u1.x, Y(0) + u1.y, X(0) + u0.x + u1.x, Y(0) + u0.y + u1.y, colors.dim, 3);
            return;
          }
          p.push();
          p.noFill();
          p.stroke(colors.dim);
          p.strokeWeight(3);
          // Anticlockwise on the page is a falling angle on the screen.
          if (signed > 0) p.arc(X(0), Y(0), r * 2, r * 2, a1, a0);
          else p.arc(X(0), Y(0), r * 2, r * 2, a0, a1);
          p.pop();
          const mid = (-(base + signed / 2) * Math.PI) / 180;
          note(p, Math.round(between) + '°', X(0) + Math.cos(mid) * (r + f * 0.9), Y(0) + Math.sin(mid) * (r + f * 0.9), colors, f * 0.8);
        });
      }
    }),
};
