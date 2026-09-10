import { SKETCHES, SKETCH_NAMES } from './sketches.ts';
import { SKETCH_CATALOGUE } from '../../server/sketch-catalogue.mjs';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Every sketch, drawn against a fake p5.
//
// With a library this size, the failure that matters is not "this diagram is
// ugly" - it is "this diagram threw, or put a shape at NaN, and the scene came
// out blank in a render nobody watched before uploading". A p5 canvas swallows
// a NaN coordinate silently: no error, no shape, no warning. So this stands in
// a recording p5 and drives every sketch through a whole scene's worth of
// frames, at both canvas shapes, with the inputs a model actually sends -
// including the empty and hostile ones.
//
// It cannot tell you a circuit is wired wrongly. It can tell you the circuit
// was drawn at all, stayed inside its canvas, and did not crash the render.
// ---------------------------------------------------------------------------

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

/** A p5 that draws nothing and remembers everything. */
function mockP5(width, height) {
  const bad = [];
  const drawn = [];
  let calls = 0;

  const check = (name, args) => {
    calls++;
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) {
        bad.push(name + '(' + args.join(', ') + ')');
        return;
      }
    }
  };
  // A drawing call, as opposed to a state change. Only these count as "drew".
  const marks = (name) => (...args) => { check(name, args); drawn.push(name); };
  const state = (name) => (...args) => { check(name, args); };

  const p = {
    CENTER: 'center', LEFT: 'left', RIGHT: 'right', TOP: 'top', BOTTOM: 'bottom',
    PIE: 'pie', ROUND: 'round', CORNER: 'corner',

    line: marks('line'), rect: marks('rect'), circle: marks('circle'),
    ellipse: marks('ellipse'), arc: marks('arc'), text: marks('text'),
    vertex: marks('vertex'), point: marks('point'), triangle: marks('triangle'),
    quad: marks('quad'), bezier: marks('bezier'),

    beginShape: state('beginShape'), endShape: state('endShape'),
    push: state('push'), pop: state('pop'),
    fill: state('fill'), noFill: state('noFill'),
    stroke: state('stroke'), noStroke: state('noStroke'),
    strokeWeight: state('strokeWeight'), strokeCap: state('strokeCap'),
    textAlign: state('textAlign'), textSize: state('textSize'),
    textStyle: state('textStyle'),
    translate: state('translate'), rotate: state('rotate'),
    rectMode: state('rectMode'), ellipseMode: state('ellipseMode'),

    radians: (d) => (d * Math.PI) / 180,
    // Deterministic, like the seeded random the real renderer uses.
    random: (a, b) => (b === undefined ? (a === undefined ? 0.5 : 0.5 * a) : a + (b - a) * 0.5),
    color: () => ({ setAlpha() {} }),
    drawingContext: { setLineDash() {} },
    width,
    height,
  };

  return { p, bad, drawn, get calls() { return calls; } };
}

const COLORS = { accent: '#4c9aff', text: '#ffffff', dim: '#94a3b8', good: '#3ddc97', bg: '#0b1020' };

/**
 * The inputs a model actually produces, from ideal down to hostile.
 *
 * The empty cases are not hypothetical: `items` is optional in the schema, and
 * a model that picks a chart sketch and forgets the numbers is a Tuesday.
 */
const CASES = [
  {
    name: 'typical',
    params: { mode: 'series', angle: 45, speed: 3, frequency: 3, amplitude: 0.7, count: 3, ratio: 1.5, labelA: 'Source', labelB: 'Load' },
    items: [
      { label: 'First', value: 40, symbol: '🔵' },
      { label: 'Second', value: 25, symbol: '🟢' },
      { label: 'Third', value: 20, symbol: '🟡' },
      { label: 'Fourth', value: 15, symbol: '🔴' },
    ],
  },
  { name: 'no params or items at all', params: {}, items: [] },
  {
    name: 'one item only',
    params: { mode: 'parallel', count: 1 },
    items: [{ label: 'Only', value: 1 }],
  },
  {
    name: 'hostile values',
    params: { mode: 'nonsense', angle: -999, speed: 1e6, frequency: 0, amplitude: -4, count: 99, ratio: 0, labelA: 'x'.repeat(120), labelB: '' },
    items: [
      { label: '', value: 0 },
      { label: 'zero', value: 0 },
      { label: 'negative', value: -50 },
      { label: 'huge', value: 1e9 },
      { label: 'not a number', value: NaN },
    ],
  },
];

const SHAPES = [
  { name: 'wide', width: 900, height: 460 },
  { name: 'square', width: 520, height: 520 },
  // A cramped box: the explainer panels give a sketch far less room than the
  // quiz layout does, and that is where off-canvas drawing shows up.
  { name: 'cramped', width: 300, height: 200 },
];

// --- every sketch, every case, every shape ------------------------------------
const threw = [];
const nanned = [];
const silent = [];
const escaped = [];

for (const name of SKETCH_NAMES) {
  const def = SKETCHES[name];
  for (const c of CASES) {
    for (const shape of SHAPES) {
      for (const progress of [0, 0.5, 1]) {
        const { p, bad, drawn } = mockP5(shape.width, shape.height);
        try {
          def.draw({
            p,
            frame: Math.round(progress * 90),
            time: progress * 3,
            progress,
            width: shape.width,
            height: shape.height,
            params: c.params,
            items: c.items,
            colors: COLORS,
          });
        } catch (e) {
          threw.push(name + ' [' + c.name + '/' + shape.name + '] ' + e.message);
          continue;
        }
        if (bad.length) nanned.push(name + ' [' + c.name + '/' + shape.name + '] ' + bad[0]);
        // Only the good-input case is required to draw something: refusing to
        // draw a pie with no numbers is correct behaviour, not a fault.
        if (c.name === 'typical' && progress === 1 && !drawn.length) {
          silent.push(name + ' [' + shape.name + ']');
        }
      }
    }
  }
}

ok('no sketch throws on any input', threw.length === 0, threw.slice(0, 3).join(' | '));
ok('no sketch emits a NaN or Infinite coordinate', nanned.length === 0, nanned.slice(0, 3).join(' | '));
ok('every sketch draws something when given good input', silent.length === 0, silent.slice(0, 5).join(', '));

// --- staying inside the canvas ------------------------------------------------
// Not a hard failure for every shape - a wave may legitimately run off the
// sides - but a diagram whose whole body sits outside a cramped panel is a
// blank scene, so the centre of mass has to land on the canvas.
for (const name of SKETCH_NAMES) {
  const shape = { width: 900, height: 460 };
  const rec = mockP5(shape.width, shape.height);
  const xs = [];
  const ys = [];
  const track = rec.p;
  for (const fn of ['line', 'rect', 'circle', 'text', 'vertex', 'arc', 'ellipse']) {
    const original = track[fn];
    track[fn] = (...args) => {
      original(...args);
      const nums = args.filter((a) => typeof a === 'number' && Number.isFinite(a));
      if (nums.length >= 2) { xs.push(nums[0]); ys.push(nums[1]); }
    };
  }
  try {
    SKETCHES[name].draw({
      p: track, frame: 45, time: 1.5, progress: 1,
      width: shape.width, height: shape.height,
      params: CASES[0].params, items: CASES[0].items, colors: COLORS,
    });
  } catch { continue; }
  if (!xs.length) continue;
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const inside = cx > -shape.width && cx < shape.width * 2 && cy > -shape.height && cy < shape.height * 2;
  if (!inside) escaped.push(name + ' centre at ' + Math.round(cx) + ',' + Math.round(cy));
}
ok('every sketch draws roughly on the canvas it was given', escaped.length === 0, escaped.join(', '));

// --- the catalogue the model is shown must match what exists ------------------
// Two lists in two languages that a model chooses between. A name in one and
// not the other is a sketch that can be requested and never drawn, or drawn and
// never requested - and both fail silently.
const catalogueNames = SKETCH_CATALOGUE.map((s) => s.name);
const missingHere = catalogueNames.filter((n) => !SKETCH_NAMES.includes(n));
const missingThere = SKETCH_NAMES.filter((n) => !catalogueNames.includes(n));
ok('every catalogued sketch exists', missingHere.length === 0, missingHere.join(', '));
ok('every sketch is catalogued', missingThere.length === 0, missingThere.join(', '));
ok('no duplicate names in the catalogue',
   new Set(catalogueNames).size === catalogueNames.length);

// --- the shape of each definition ---------------------------------------------
const malformed = SKETCH_NAMES.filter((n) => {
  const d = SKETCHES[n];
  return !d || !['wide', 'square'].includes(d.shape) || !d.label || !d.describe
    || !d.uses || typeof d.draw !== 'function';
});
ok('every sketch is fully described', malformed.length === 0, malformed.join(', '));

const vague = SKETCH_CATALOGUE.filter((s) => !s.describe || !s.uses);
ok('every catalogue entry tells the model what it is and what it takes', vague.length === 0,
   vague.map((s) => s.name).join(', '));

// --- the generated catalogue must not be stale --------------------------------
// server/sketch-catalogue.mjs is derived from these definitions. If somebody
// adds a sketch and forgets to regenerate, the model is never offered it - a
// silent loss, not an error - so the check is here rather than in a comment.
const { buildSource } = await import('../../tools/sync-catalogue.mjs');
const onDisk = fs.readFileSync(new URL('../../server/sketch-catalogue.mjs', import.meta.url), 'utf8');
ok('the generated catalogue is up to date',
   buildSource() === onDisk,
   'run: node --import ./tools/ts-resolve.mjs tools/sync-catalogue.mjs');

// --- the parallel circuit, specifically ---------------------------------------
// It used to run its branches horizontally between two FULL-HEIGHT vertical bus
// bars, which closed the outer wires into two large rectangles: a viewer saw a
// mystery box at each end with the resistors slung between them. Reported from
// a real video, so the geometry is asserted rather than trusted.
{
  const lines = [];
  const rects = [];
  const { p } = mockP5(900, 460);
  const rec = { ...p, line: (...a) => lines.push(a), rect: (...a) => rects.push(a) };
  SKETCHES.circuit.draw({
    p: rec, frame: 45, time: 1.5, progress: 1, width: 900, height: 460,
    params: { mode: 'parallel', count: 3, labelA: '12 V' },
    items: [{ label: 'R1' }, { label: 'R2' }, { label: 'R3' }],
    colors: COLORS,
  });
  const vertical = lines.filter(([x1, y1, x2, y2]) => Math.abs(x1 - x2) < 1);
  const horizontal = lines.filter(([x1, y1, x2, y2]) => Math.abs(y1 - y2) < 1);
  const fullHeight = vertical.filter(([x1, y1, x2, y2]) => Math.abs(y2 - y1) > 460 * 0.45);

  ok('the parallel circuit draws no full-height bus bars', fullHeight.length === 0,
     'found ' + fullHeight.length + ' - the two-big-boxes bug is back');
  ok('it draws a top and a bottom rail', horizontal.length >= 2);
  ok('it drops one branch per component', rects.length === 3, 'rects=' + rects.length);
}

// --- the two electrical diagrams that were reported as wrong -------------------
// Both came from a real video where the picture contradicted the narration, so
// the physics is asserted rather than eyeballed.

/** Run a sketch and keep every line and every string it drew. */
function record(name, params, w = 900, h = 460, progress = 1) {
  const lines = [];
  const texts = [];
  const { p } = mockP5(w, h);
  const rec = {
    ...p,
    line: (...a) => lines.push(a),
    vertex: (...a) => lines.push(a),
    text: (t, x, y) => texts.push({ t: String(t), x, y }),
  };
  SKETCHES[name].draw({
    p: rec, frame: 45, time: 0, progress, width: w, height: h,
    params, items: [], colors: COLORS,
  });
  return { lines, texts, said: texts.map((q) => q.t).join(' | ') };
}

{
  // waveform, phase mode. A POSITIVE angle means the second wave LAGS - it
  // happens later, so it peaks further RIGHT. This was inverted: `angle: 90`
  // for "current lags voltage" drew the current LEADING, which is a capacitor,
  // not the inductor the scene was about.
  const w = 900;
  const peakOf = (pts) => pts.reduce((best, q) => (q[1] < best[1] ? q : best), pts[0])[0];
  const trace = (params) => {
    const { lines } = record('waveform', params, w, 460);
    // Two curves are plotted as vertex runs; split them by the jump back to x=0.
    const runs = [];
    let cur = [];
    for (const pt of lines) {
      if (pt.length === 2 && cur.length && pt[0] < cur[cur.length - 1][0]) { runs.push(cur); cur = []; }
      if (pt.length === 2) cur.push(pt);
    }
    if (cur.length) runs.push(cur);
    return runs.filter((r) => r.length > 50);
  };

  const runs = trace({ mode: 'phase', angle: 90, frequency: 2 });
  ok('the phase waveform draws two curves', runs.length === 2, 'runs=' + runs.length);
  if (runs.length === 2) {
    const first = peakOf(runs[0]);
    const second = peakOf(runs[1]);
    // One period spans width/frequency; a 90 degree lag is a quarter of that.
    const quarter = (w / 2) / 4;
    const delta = second - first;
    ok('a positive angle draws the second wave LATER, not earlier',
       delta > 0, 'shift=' + Math.round(delta) + 'px (negative means it leads)');
    ok('and by about the right amount for ninety degrees',
       Math.abs(delta - quarter) < quarter * 0.4, 'got ' + Math.round(delta) + ', wanted ~' + Math.round(quarter));
  }

  const said = record('waveform', { mode: 'phase', angle: 90, frequency: 2 }).said;
  const parts = said.split(' | ').map((q) => q.trim());
  ok('the two curves are labelled at all',
     parts.includes('V') && parts.includes('I'), said.slice(0, 70));
  ok('and it says which one lags', /lags/i.test(said), said.slice(0, 90));
  ok('a negative angle says leads instead',
     /leads/i.test(record('waveform', { mode: 'phase', angle: -90, frequency: 2 }).said));
  ok('custom labels are honoured',
     /Vs/.test(record('waveform', { mode: 'phase', angle: 45, labelA: 'Vs', labelB: 'Is' }).said));
}

{
  // power-factor. Two faults: the angle was clamped to 70 so the ninety-degree
  // case could not be drawn, and the BASE was held constant so kVA grew without
  // limit - at 90 the apex left the canvas.
  const horiz = (lines) => lines.filter((l) => l.length === 4 && Math.abs(l[1] - l[3]) < 1);
  const vert = (lines) => lines.filter((l) => l.length === 4 && Math.abs(l[0] - l[2]) < 1);
  const lenOf = (l) => Math.hypot(l[2] - l[0], l[3] - l[1]);

  const at = (deg) => record('power-factor', { angle: deg }, 520, 520);

  const a90 = at(90);
  ok('ninety degrees is no longer clamped', /cos φ = 0\.00/.test(a90.said), a90.said.slice(0, 60));
  ok('and it says there is no real power', /no real power/i.test(a90.said));
  ok('at ninety the kW leg is gone', horiz(a90.lines).length === 0,
     'found ' + horiz(a90.lines).length + ' horizontal legs');
  ok('and kW is labelled as zero rather than left blank', /kW = 0/.test(a90.said));

  const a0 = at(0);
  ok('at zero the power factor is unity', /cos φ = 1\.00/.test(a0.said), a0.said.slice(0, 40));

  // The hypotenuse is what stays fixed. Held the old way, the height grew with
  // tan and ran off the canvas.
  const hyp = (r) => {
    const all = r.lines.filter((l) => l.length === 4);
    return Math.max(...all.map(lenOf));
  };
  const spread = [0, 30, 45, 60, 80, 90].map((d) => hyp(at(d)));
  const lo = Math.min(...spread);
  const hi = Math.max(...spread);
  ok('the apparent power stays the same size at every angle',
     hi - lo < hi * 0.06, spread.map(Math.round).join(', '));

  const tall = vert(at(89).lines).map(lenOf);
  ok('nothing runs off the canvas at a steep angle',
     Math.max(...tall, 0) < 520, String(Math.round(Math.max(...tall, 0))));
}

// --- the size of the library --------------------------------------------------
console.log('');
console.log('  sketches: ' + SKETCH_NAMES.length);
console.log('');

console.log(fails ? fails + ' FAILURES' : 'all sketch checks passed');
process.exit(fails ? 1 : 0);
