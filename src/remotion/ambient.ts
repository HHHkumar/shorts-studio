import type p5 from 'p5';
import type { SketchArgs } from './P5Sketch';

// ---------------------------------------------------------------------------
// Ambient backdrops.
//
// These are the layer behind everything: not diagrams, not information, just
// something alive under the words so a scene does not read as text on a flat
// colour. Thirty of them, built from ten generators with three presets each,
// because ten well-made systems with variations beat thirty rushed one-offs.
//
// Four rules keep them from making the videos worse.
//
//   1. They sit UNDER the content at low opacity. If a backdrop ever competes
//      with a caption for attention it has failed at its only job.
//   2. They are a pure function of absolute video time, not scene time, so the
//      motion runs continuously through the whole video instead of restarting
//      at every cut.
//   3. They are cheap. No per-pixel work - a full-frame noise field costs more
//      than everything else in the render put together. Vector shapes only, a
//      few hundred per frame, on a half-resolution canvas.
//   4. Nothing is measured in raw pixels. Every size, distance and count is
//      derived from the canvas, so a look reads the same in a 9:16 phone frame
//      and a 16:9 one instead of turning into a dense blob in the smaller of
//      the two.
//
// Determinism is inherited from P5Sketch, which re-seeds p.random() before
// every draw. A sketch may therefore call p.random() freely to lay things out,
// as long as it calls it in the same order every frame and animates from
// `time`.
// ---------------------------------------------------------------------------

export interface AmbientColors {
  accent: string;
  text: string;
  bg: string;
}

export interface AmbientArgs extends SketchArgs {
  colors: AmbientColors;
  /** Which variation of the family to draw. */
  preset: string;
}

export interface AmbientDef {
  label: string;
  /** The generator family, used to group the picker. */
  group: string;
  draw: (a: AmbientArgs) => void;
}

/** A colour at a given alpha. p5 wants its own colour objects for this. */
function tint(p: p5, hex: string, alpha: number) {
  const c = p.color(hex);
  c.setAlpha(Math.max(0, Math.min(255, alpha * 255)));
  return c;
}

/**
 * The two numbers every generator scales by.
 *
 * `s` converts a length: 1 means "as long as the reference frame's diagonal
 * would suggest". `n` converts a count, by area, so a wide frame gets
 * proportionally more particles rather than the same number spread thinner.
 */
function metrics(width: number, height: number) {
  const REF_DIAGONAL = 1100; // a half-resolution 9:16 frame
  const REF_AREA = 540 * 960;
  return {
    s: Math.hypot(width, height) / REF_DIAGONAL,
    n: Math.min(2.5, Math.max(0.35, (width * height) / REF_AREA)),
    min: Math.min(width, height),
    max: Math.max(width, height),
  };
}

const pick = <T,>(table: Record<string, T>, preset: string, fallback: string): T =>
  table[preset] ?? table[fallback];

// ---------------------------------------------------------------------------
// 1. Particles - drifting motes
// ---------------------------------------------------------------------------

function particles({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    dust: { count: 130, size: [3, 9], rise: 14, drift: 22, alpha: 0.8, accent: false },
    embers: { count: 90, size: [4, 13], rise: 46, drift: 34, alpha: 0.65, accent: true },
    bokeh: { count: 28, size: [46, 150], rise: 18, drift: 14, alpha: 0.2, accent: true },
  }, preset, 'dust');

  const count = Math.round(spec.count * m.n);
  p.noStroke();

  for (let i = 0; i < count; i++) {
    const x0 = p.random(width);
    const y0 = p.random(height);
    const size = p.random(spec.size[0], spec.size[1]) * m.s;
    const speed = p.random(0.5, 1.5);
    const phase = p.random(p.TWO_PI);

    // Wrapped rather than respawned: a mote that leaves the top comes back in
    // at the bottom, so the field never thins out over a long video.
    const y = ((y0 - time * spec.rise * m.s * speed) % height + height) % height;
    const x = x0 + Math.sin(time * 0.35 * speed + phase) * spec.drift * m.s;

    p.fill(tint(p, spec.accent ? colors.accent : colors.text, spec.alpha * p.random(0.4, 1)));
    p.circle(x, y, size);
  }
}

// ---------------------------------------------------------------------------
// 2. Flow - streamlines through a slowly turning field
// ---------------------------------------------------------------------------

function flow({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    silk: { lines: 42, steps: 26, step: 26, weight: 2.4, alpha: 0.6, cells: 2.2 },
    current: { lines: 26, steps: 34, step: 32, weight: 4.2, alpha: 0.56, cells: 1.4 },
    smoke: { lines: 60, steps: 20, step: 20, weight: 1.8, alpha: 0.46, cells: 3.6 },
  }, preset, 'silk');

  // The noise is sampled in units of the frame, not pixels. Sampling in pixels
  // meant a small canvas covered almost none of the field, every angle came out
  // the same, and the "flow" was a bundle of parallel lines leaving one corner.
  const scale = spec.cells / m.max;

  const lines = Math.round(spec.lines * m.n);
  p.noFill();
  p.strokeCap(p.ROUND);

  for (let i = 0; i < lines; i++) {
    let x = p.random(-0.1, 1.1) * width;
    let y = p.random(-0.1, 1.1) * height;
    p.stroke(tint(p, i % 3 === 0 ? colors.accent : colors.text, spec.alpha));
    p.strokeWeight(spec.weight * m.s);
    p.beginShape();
    for (let s = 0; s < spec.steps; s++) {
      p.vertex(x, y);
      // The third noise axis is time, so the whole field turns slowly instead
      // of the lines sliding across a static one.
      const angle = p.noise(x * scale, y * scale, time * 0.05) * p.TWO_PI * 2;
      x += Math.cos(angle) * spec.step * m.s;
      y += Math.sin(angle) * spec.step * m.s;
    }
    p.endShape();
  }
}

// ---------------------------------------------------------------------------
// 3. Network - nodes joined when they drift close together
// ---------------------------------------------------------------------------

function network({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    constellation: { count: 44, reach: 0.3, dot: 5, alpha: 0.72, wander: 0.03 },
    mesh: { count: 64, reach: 0.22, dot: 4, alpha: 0.58, wander: 0.018 },
    lattice: { count: 26, reach: 0.42, dot: 9, alpha: 0.62, wander: 0.01 },
  }, preset, 'constellation');

  const count = Math.round(spec.count * m.n);
  // Reach is a fraction of the frame, so the mesh has the same density
  // everywhere. In pixels it joined every node to every other on a small canvas
  // and produced a solid scribble.
  const reach = spec.reach * m.min;
  const wander = spec.wander * m.min;

  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x0 = p.random(width);
    const y0 = p.random(height);
    const a = p.random(p.TWO_PI);
    const b = p.random(p.TWO_PI);
    nodes.push({
      x: x0 + Math.cos(time * 0.2 + a) * wander,
      y: y0 + Math.sin(time * 0.17 + b) * wander,
    });
  }

  p.strokeWeight(1.6 * m.s);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d > reach) continue;
      // Faded by distance, so links appear and vanish gently rather than
      // snapping on at the threshold.
      p.stroke(tint(p, colors.accent, spec.alpha * (1 - d / reach) * 0.7));
      p.line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
    }
  }

  p.noStroke();
  p.fill(tint(p, colors.text, spec.alpha));
  for (const n of nodes) p.circle(n.x, n.y, spec.dot * m.s);
}

// ---------------------------------------------------------------------------
// 4. Waves - stacked bands
// ---------------------------------------------------------------------------

function waves({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    ripple: { bands: 10, amp: 0.045, freq: 1.6, weight: 2.2, alpha: 0.3, speed: 0.9, ribbon: 0 },
    aurora: { bands: 5, amp: 0.09, freq: 0.8, weight: 0, alpha: 0.16, speed: 0.45, ribbon: 0.07 },
    scope: { bands: 3, amp: 0.085, freq: 4.5, weight: 3.4, alpha: 0.4, speed: 2.2, ribbon: 0 },
  }, preset, 'ripple');

  const at = (t: number, mid: number, phase: number) =>
    mid
    + Math.sin(t * p.TWO_PI * spec.freq + time * spec.speed + phase) * height * spec.amp
    + Math.sin(t * p.TWO_PI * spec.freq * 2.3 - time * spec.speed * 0.6) * height * spec.amp * 0.4;

  for (let b = 0; b < spec.bands; b++) {
    const mid = (height * (b + 0.5)) / spec.bands;
    const phase = b * 0.7;
    const colour = b % 2 === 0 ? colors.accent : colors.text;

    if (spec.ribbon) {
      // A ribbon between two offset curves. Filling all the way down to the
      // base instead, as this first did, just stacked opaque slabs until the
      // whole frame was a solid block.
      const thickness = height * spec.ribbon;
      p.noStroke();
      p.fill(tint(p, colour, spec.alpha));
      p.beginShape();
      for (let x = 0; x <= width; x += 14) p.vertex(x, at(x / width, mid, phase));
      for (let x = width; x >= 0; x -= 14) p.vertex(x, at(x / width, mid, phase) + thickness);
      p.endShape(p.CLOSE);
      continue;
    }

    p.noFill();
    p.stroke(tint(p, colour, spec.alpha));
    p.strokeWeight(spec.weight * m.s);
    p.beginShape();
    for (let x = 0; x <= width; x += 12) p.vertex(x, at(x / width, mid, phase));
    p.endShape();
  }
}

// ---------------------------------------------------------------------------
// 5. Orbits - concentric rings
// ---------------------------------------------------------------------------

function orbits({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    rings: { count: 7, dots: 1, tilt: 0, alpha: 0.55, speed: 0.3, reach: 0.46 },
    atom: { count: 3, dots: 2, tilt: 1, alpha: 0.68, speed: 0.9, reach: 0.42 },
    gyro: { count: 5, dots: 0, tilt: 1, alpha: 0.6, speed: 0.5, reach: 0.44 },
  }, preset, 'rings');

  const cx = width / 2;
  const cy = height / 2;
  // Sized off the SHORT edge, so the outer ring stays inside the frame instead
  // of running off both sides and leaving a mostly empty picture.
  const max = m.min * spec.reach;

  for (let i = 1; i <= spec.count; i++) {
    const r = (max * i) / spec.count;
    const spin = time * spec.speed * (i % 2 === 0 ? 1 : -1) * (1 / i);

    p.push();
    p.translate(cx, cy);
    if (spec.tilt) p.rotate(spin);
    p.noFill();
    p.stroke(tint(p, i % 2 === 0 ? colors.accent : colors.text, spec.alpha));
    p.strokeWeight(2.2 * m.s);
    p.ellipse(0, 0, r * 2, spec.tilt ? r * (0.34 + i * 0.14) * 2 : r * 2);
    p.pop();

    for (let d = 0; d < spec.dots; d++) {
      const a = spin * 2 + (d * p.TWO_PI) / Math.max(1, spec.dots);
      p.noStroke();
      p.fill(tint(p, colors.accent, Math.min(1, spec.alpha * 2)));
      p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * (spec.tilt ? r * 0.45 : r), 14 * m.s);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Cells - a grid that breathes
// ---------------------------------------------------------------------------

function cells({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    matrix: { across: 13, round: 0, alpha: 0.34, speed: 1.4, lit: 0.4 },
    board: { across: 9, round: 0.14, alpha: 0.3, speed: 0.6, lit: 0.55 },
    pixels: { across: 20, round: 0.1, alpha: 0.28, speed: 2.2, lit: 0.3 },
  }, preset, 'matrix');

  // Cell size follows the short edge, so the pattern keeps its proportions in
  // either orientation.
  const size = m.min / spec.across;
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const pad = size * 0.16;
  const box = size - pad * 2;

  p.noStroke();
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // One draw per cell, in a fixed order, so the pattern is stable frame to
      // frame. Every cell gets a faint outline of a tile; the lit ones pulse on
      // top. Drawing only the lit ones read as scattered noise rather than as a
      // grid with something happening in it.
      const seed = p.random();
      p.fill(tint(p, colors.text, spec.alpha * 0.12));
      p.rect(c * size + pad, r * size + pad, box, box, box * spec.round);

      if (seed > spec.lit) continue;
      const pulse = (Math.sin(time * spec.speed + (c + r) * 0.6 + seed * 10) + 1) / 2;
      p.fill(tint(p, seed > spec.lit * 0.55 ? colors.accent : colors.text, spec.alpha * pulse));
      p.rect(c * size + pad, r * size + pad, box, box, box * spec.round);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Beams - light sweeping from a point
// ---------------------------------------------------------------------------

function beams({ p, time, width, height, colors, preset }: AmbientArgs) {
  const spec = pick({
    beams: { count: 9, from: [0.5, -0.08], spread: 1, alpha: 0.14, speed: 0.1, width: 0.3 },
    lighthouse: { count: 3, from: [0.5, 0.5], spread: 2, alpha: 0.16, speed: 0.35, width: 0.16 },
    fan: { count: 13, from: [0.06, 1.06], spread: 0.62, alpha: 0.13, speed: 0.06, width: 0.34 },
  }, preset, 'beams');

  const ox = width * spec.from[0];
  const oy = height * spec.from[1];
  const reach = Math.hypot(width, height) * 1.4;
  const spread = spec.spread * Math.PI;

  p.noStroke();
  for (let i = 0; i < spec.count; i++) {
    const base = (i / spec.count) * spread + time * spec.speed;
    // `width` is the fraction of the gap between beams that the beam fills.
    // At 1 they meet; the first version used a half-gap half-angle, which made
    // them overlap into one solid block of colour.
    const half = (spread / spec.count) * spec.width * 0.5;
    p.fill(tint(p, i % 2 === 0 ? colors.accent : colors.text, spec.alpha));
    p.triangle(
      ox, oy,
      ox + Math.cos(base - half) * reach, oy + Math.sin(base - half) * reach,
      ox + Math.cos(base + half) * reach, oy + Math.sin(base + half) * reach,
    );
  }
}

// ---------------------------------------------------------------------------
// 8. Spiral
// ---------------------------------------------------------------------------

function spiral({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    galaxy: { arms: 3, dots: 150, turns: 2.4, size: [3, 12], alpha: 0.42, speed: 0.1, reach: 0.62 },
    vortex: { arms: 1, dots: 280, turns: 5.5, size: [2, 7], alpha: 0.34, speed: 0.28, reach: 0.66 },
    helix: { arms: 2, dots: 130, turns: 1.6, size: [4, 14], alpha: 0.36, speed: 0.16, reach: 0.58 },
  }, preset, 'galaxy');

  const cx = width / 2;
  const cy = height / 2;
  const max = m.max * spec.reach;

  p.noStroke();
  for (let arm = 0; arm < spec.arms; arm++) {
    const offset = (arm * p.TWO_PI) / spec.arms;
    for (let i = 0; i < spec.dots; i++) {
      const t = i / spec.dots;
      const wobble = p.random(-0.09, 0.09);
      const a = offset + t * p.TWO_PI * spec.turns + time * spec.speed + wobble;
      const r = t * max;
      p.fill(tint(p, arm % 2 === 0 ? colors.accent : colors.text, spec.alpha * (1 - t * 0.55)));
      p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, p.random(spec.size[0], spec.size[1]) * m.s);
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Bars - columns rising from the base
// ---------------------------------------------------------------------------

function bars({ p, time, width, height, colors, preset }: AmbientArgs) {
  const spec = pick({
    equaliser: { count: 34, max: 0.3, speed: 1.8, alpha: 0.4, round: 0.3, mirror: false },
    skyline: { count: 24, max: 0.24, speed: 0.22, alpha: 0.36, round: 0, mirror: false },
    spectrum: { count: 52, max: 0.17, speed: 2.6, alpha: 0.4, round: 0.5, mirror: true },
  }, preset, 'equaliser');

  const w = width / spec.count;
  const baseY = spec.mirror ? height * 0.5 : height;

  p.noStroke();
  for (let i = 0; i < spec.count; i++) {
    const seed = p.random();
    const h =
      height * spec.max *
      (0.25 + 0.75 * Math.abs(Math.sin(time * spec.speed * (0.4 + seed) + i * 0.5)));
    const bw = w * 0.66;
    const radius = bw * spec.round;
    p.fill(tint(p, i % 3 === 0 ? colors.accent : colors.text, spec.alpha));
    p.rect(i * w + w * 0.17, baseY - h, bw, h, radius);
    if (spec.mirror) p.rect(i * w + w * 0.17, baseY, bw, h * 0.6, radius);
  }
}

// ---------------------------------------------------------------------------
// 10. Contours - noise drawn as height lines
// ---------------------------------------------------------------------------

function contours({ p, time, width, height, colors, preset }: AmbientArgs) {
  const m = metrics(width, height);
  const spec = pick({
    topo: { rings: 12, cells: 2.4, wobble: 0.5, weight: 2.6, alpha: 0.52, speed: 0.06 },
    isobars: { rings: 7, cells: 1.5, wobble: 0.34, weight: 4, alpha: 0.48, speed: 0.11 },
    dunes: { rings: 18, cells: 3.4, wobble: 0.72, weight: 2, alpha: 0.44, speed: 0.04 },
  }, preset, 'topo');

  const cx = width / 2;
  const cy = height / 2;
  const max = m.max * 0.75;
  const scale = spec.cells / m.max;

  p.noFill();
  p.strokeWeight(spec.weight * m.s);
  for (let ring = 1; ring <= spec.rings; ring++) {
    const base = (max * ring) / spec.rings;
    p.stroke(tint(p, ring % 3 === 0 ? colors.accent : colors.text, spec.alpha));
    p.beginShape();
    for (let a = 0; a <= p.TWO_PI + 0.1; a += 0.12) {
      // The radius is pushed in and out by a noise field that drifts with time.
      // One loop per ring, so the classic contour-map look costs almost nothing.
      const n = p.noise(
        Math.cos(a) * base * scale + 10,
        Math.sin(a) * base * scale + 10,
        time * spec.speed + ring * 0.08,
      );
      const r = base * (1 + (n - 0.5) * spec.wobble);
      p.vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    p.endShape(p.CLOSE);
  }
}

// ---------------------------------------------------------------------------

const FAMILIES: { group: string; fn: (a: AmbientArgs) => void; presets: [string, string][] }[] = [
  { group: 'Particles', fn: particles, presets: [['dust', 'Dust motes'], ['embers', 'Embers'], ['bokeh', 'Bokeh']] },
  { group: 'Flow', fn: flow, presets: [['silk', 'Silk'], ['current', 'Current'], ['smoke', 'Smoke']] },
  { group: 'Network', fn: network, presets: [['constellation', 'Constellation'], ['mesh', 'Mesh'], ['lattice', 'Lattice']] },
  { group: 'Waves', fn: waves, presets: [['ripple', 'Ripple'], ['aurora', 'Aurora'], ['scope', 'Oscilloscope']] },
  { group: 'Orbits', fn: orbits, presets: [['rings', 'Rings'], ['atom', 'Atom'], ['gyro', 'Gyroscope']] },
  { group: 'Cells', fn: cells, presets: [['matrix', 'Matrix'], ['board', 'Circuit board'], ['pixels', 'Pixels']] },
  { group: 'Beams', fn: beams, presets: [['beams', 'Light beams'], ['lighthouse', 'Lighthouse'], ['fan', 'Fan']] },
  { group: 'Spiral', fn: spiral, presets: [['galaxy', 'Galaxy'], ['vortex', 'Vortex'], ['helix', 'Helix']] },
  { group: 'Bars', fn: bars, presets: [['equaliser', 'Equaliser'], ['skyline', 'Skyline'], ['spectrum', 'Spectrum']] },
  { group: 'Contours', fn: contours, presets: [['topo', 'Topographic'], ['isobars', 'Isobars'], ['dunes', 'Dunes']] },
];

/** Every backdrop, keyed by the name stored in the design settings. */
export const AMBIENTS: Record<string, AmbientDef> = {};
for (const family of FAMILIES) {
  for (const [preset, label] of family.presets) {
    AMBIENTS[preset] = {
      label,
      group: family.group,
      draw: (a) => family.fn({ ...a, preset }),
    };
  }
}

export const AMBIENT_NAMES = Object.keys(AMBIENTS);

/** The picker groups them by family, in the order defined above. */
export const AMBIENT_GROUPS = FAMILIES.map((f) => ({
  group: f.group,
  items: f.presets.map(([name, label]) => ({ name, label })),
}));
