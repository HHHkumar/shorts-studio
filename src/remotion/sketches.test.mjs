import { SKETCHES, SKETCH_NAMES } from './sketches.ts';
import { SKETCH_CATALOGUE } from '../../server/sketch-catalogue.mjs';
import fs from 'node:fs';
import { mockP5, sketchMarks, sketchTexts } from './sketch-mock.mjs';
import { checkSketch, contractFor } from '../../server/sketch-contract.mjs';

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

/**
 * "Good input" is not the same list for every sketch: one that reads a number
 * out of each item's symbol is given nothing to draw by an emoji.
 */
const GOOD_ITEMS = {
  'power-time': [{ label: 'One bulb', value: 100, symbol: '10' }, { label: 'Ten bulbs', value: 1000, symbol: '1' }],
  phasors: [{ label: 'V', value: 1, symbol: '0' }, { label: 'I', value: 0.6, symbol: '-60' }],
};
const itemsFor = (name, c) => (c.name === 'typical' && GOOD_ITEMS[name] ? GOOD_ITEMS[name] : c.items);

/** And a sketch that simulates what it is told draws nothing from settings meant for another. */
const GOOD_PARAMS = {
  'timing-diagram': { mode: 'jk-flipflop', network: 'J=1100; K=0110' },
  'block-diagram': { network: 'R > +A > G > C; C > H > -A' },
};
const paramsFor = (name, c) => (c.name === 'typical' && GOOD_PARAMS[name] ? { ...c.params, ...GOOD_PARAMS[name] } : c.params);

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
            params: paramsFor(name, c),
            items: itemsFor(name, c),
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
      params: CASES[0].params, items: itemsFor(name, CASES[0]), colors: COLORS,
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

  // The Ferranti effect: the receiving end is LARGER and in phase. With no
  // angle, a default of 60 degrees drew it lagging by 60, and there was no way
  // to draw it larger at all.
  const ferranti = { mode: 'phase', ratio: 1.25, frequency: 2, labelA: 'Vs', labelB: 'Vr' };
  const fr = trace(ferranti);
  const height = (pts) => Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
  ok('no angle draws no phase shift', fr.length === 2 && Math.abs(peakOf(fr[1]) - peakOf(fr[0])) < 6,
     fr.length === 2 ? 'shift=' + Math.round(peakOf(fr[1]) - peakOf(fr[0])) + 'px' : 'runs=' + fr.length);
  ok('a ratio above 1 draws the second wave larger', fr.length === 2 && Math.abs(height(fr[1]) / height(fr[0]) - 1.25) < 0.05,
     fr.length === 2 ? 'ratio=' + (height(fr[1]) / height(fr[0])).toFixed(2) : '');
  const fs_ = record('waveform', ferranti).said;
  ok('and the caption says so, without inventing a lag', /Vr > Vs, in phase/.test(fs_) && !/lags/.test(fs_), fs_);
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

// --- a printed number must be the number that was asked for -------------------
// Three separate bug reports have now had the same shape: a parameter clamped
// to whatever happened to be drawable, and then PRINTED. The caption said 12
// where the narration said 18, said cos 0.34 where the narration said zero.
// A wrong number on screen is worse than no diagram, because it is the one
// thing a viewer will copy down.
//
// The rule: where a value is displayed, the drawing degrades and the number
// does not.
{
  const shown = (name, params) => record(name, params, 900, 460).said;

  // fraction-bar: the case from the report, and some worse ones.
  for (const [num_, den] of [[5, 18], [3, 7], [7, 16], [1, 20], [9, 24], [7, 100]]) {
    const said = shown('fraction-bar', { ratio: num_, count: den });
    ok('fraction-bar says ' + num_ + ' / ' + den + ' when asked for it',
       said.includes(num_ + ' / ' + den), said.slice(0, 40));
  }
  ok('a huge denominator draws a proportional bar rather than lying',
     /too many parts/.test(shown('fraction-bar', { ratio: 7, count: 100 })));
  ok('a small denominator still draws real parts',
     !/too many parts/.test(shown('fraction-bar', { ratio: 5, count: 18 })));

  // gears: 1:10 is an ordinary reduction and was captioned 1:4.
  for (const r of [2, 5, 8, 12]) {
    ok('gears says 1 : ' + r + ' when asked for it',
       shown('gears', { ratio: r }).includes('1 : ' + r), shown('gears', { ratio: r }).slice(0, 30));
  }

  // letter-shift: ROT13 was out of range and captioned +6.
  for (const k of [3, 13, 25]) {
    ok('letter-shift says +' + k + ' when asked for it',
       shown('letter-shift', { count: k, labelA: 'CODE' }).includes('+' + k + ' each letter'));
  }

  // binary-number: the value was clamped to fit eight bits, then printed.
  for (const v of [42, 200, 1000, 65535]) {
    ok('binary-number prints ' + v + ' when asked for it',
       shown('binary-number', { ratio: v }).includes('= ' + v),
       shown('binary-number', { ratio: v }).slice(-20));
  }

  // power-factor, from the previous report - kept here so the class is covered
  // in one place rather than three.
  ok('power-factor prints the cosine it was actually given',
     shown('power-factor', { angle: 90 }).includes('cos φ = 0.00'));
  ok('and does not silently pick a different angle',
     shown('power-factor', { angle: 60 }).includes('cos φ = 0.50'));
}

// --- the pictures found wrong by looking at the frames ---------------------------
{
  // switch-circuit closed itself half way through whatever the mode, so "open"
  // - under a line about a device turning OFF - ended "Closed — current flows".
  const end = (mode) => record('switch-circuit', { mode }, 900, 460, 1).said;
  ok('a switch asked to end open ends open', /Open/.test(end('open')) && !/Closed/.test(end('open')), end('open'));
  ok('and one asked to end closed ends closed', /Closed/.test(end('closed')), end('closed'));
  ok('each starts the other way, so the scene shows the switching',
     /Closed/.test(record('switch-circuit', { mode: 'open' }, 900, 460, 0.1).said)
     && /Open/.test(record('switch-circuit', { mode: 'closed' }, 900, 460, 0.1).said));

  // The same fault in three more: each switched itself half way through
  // whatever its mode, so one state could never be the picture left on screen.
  const final = (name, mode) => record(name, { mode }, 900, 460, 1).said;
  ok('a breaker told to stay closed ends closed', /CLOSED/.test(final('circuit-breaker', 'closed')) && !/TRIPPED/.test(final('circuit-breaker', 'closed')), final('circuit-breaker', 'closed'));
  ok('and one told to trip ends tripped', /TRIPPED/.test(final('circuit-breaker', 'trip')));
  ok('a relay told to be open ends de-energised', !/Energised/.test(final('relay', 'open')), final('relay', 'open'));
  ok('and one told to close ends energised', /Energised/.test(final('relay', 'closed')), final('relay', 'closed'));
  ok('a transistor told to be off ends off', !/it conducts/.test(final('transistor', 'off')), final('transistor', 'off'));
  ok('and one told to be on ends conducting', /it conducts/.test(final('transistor', 'on')), final('transistor', 'on'));

  // Two waves in phase and the same size lie on top of each other: one curve
  // on screen under a legend for two. The second is dashed so both show.
  const dashes = (params) => {
    const calls = [];
    const { p } = mockP5(900, 460);
    const rec = { ...p, drawingContext: { setLineDash: (d) => calls.push(d.length) } };
    SKETCHES.waveform.draw({ p: rec, frame: 45, time: 0, progress: 1, width: 900, height: 460, params, items: [], colors: COLORS });
    return calls.some((n) => n > 0);
  };
  ok('a wave lying exactly on another is dashed', dashes({ mode: 'phase', angle: 0, labelA: 'V', labelB: 'I' }));
  ok('and is solid as soon as the two differ',
     !dashes({ mode: 'phase', angle: 90, labelA: 'V', labelB: 'I' }) && !dashes({ mode: 'phase', angle: 0, ratio: 1.2, labelA: 'Vs', labelB: 'Vr' }));
}

// --- the standard characteristics are the right shape ------------------------------
// These are fixed pictures whose whole value is that the curve is the true one.
// A torque-slip curve was once drawn as an upward quadratic and a thyristor as
// a diode; the equations and the landmarks are held here.
{
  const { torqueAt, resonanceAt } = await import('./sketches-curves.ts');
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

  // T/Tmax = 2 / (s/sm + sm/s): the maximum is 1, at s = sm, whatever sm is.
  for (const sm of [0.1, 0.2, 0.5, 1]) {
    let best = 0;
    let at = 0;
    for (let s = 0.001; s <= 1.0001; s += 0.001) if (torqueAt(s, sm) > best) { best = torqueAt(s, sm); at = s; }
    ok('torque peaks at slip ' + sm + ', at the same height', near(best, 1, 1e-5) && near(at, sm, 0.0015), 'peak ' + best.toFixed(4) + ' at s=' + at.toFixed(3));
  }
  ok('with R2 = X2 the peak is at standstill', near(torqueAt(1, 1), 1));
  ok('torque is zero at synchronous speed', torqueAt(1e-9, 0.2) < 1e-6);
  ok('starting torque rises as rotor resistance rises, up to R2 = X2',
     torqueAt(1, 0.2) < torqueAt(1, 0.5) && torqueAt(1, 0.5) < torqueAt(1, 1));

  // Half power is 1/sqrt 2 of the peak current, and f2 - f1 = f0 / Q exactly.
  for (const q of [2, 4, 10]) {
    const f1 = (-1 / q + Math.sqrt(1 / (q * q) + 4)) / 2;
    const f2 = (1 / q + Math.sqrt(1 / (q * q) + 4)) / 2;
    ok('resonance at Q = ' + q + ': half-power points 0.707 high and f0/Q apart',
       near(resonanceAt(f1, q), Math.SQRT1_2, 1e-9) && near(resonanceAt(f2, q), Math.SQRT1_2, 1e-9) && near(f2 - f1, 1 / q, 1e-9));
  }
  ok('the resonant peak is at f0', near(resonanceAt(1, 4), 1) && resonanceAt(0.9, 4) < 1 && resonanceAt(1.1, 4) < 1);

  // On the drawing itself: what is higher up the canvas has the smaller y.
  const where = (name, params, text) => {
    const hit = record(name, params, 900, 460, 1).texts.find((t) => t.t.includes(text));
    return hit ? hit : null;
  };
  const latch = where('scr-characteristic', {}, 'IL latching');
  const hold = where('scr-characteristic', {}, 'IH holding');
  ok('the thyristor names both currents', Boolean(latch && hold));
  ok('and draws the latching current ABOVE the holding current', Boolean(latch && hold) && latch.y < hold.y, latch && hold ? latch.y.toFixed(0) + ' against ' + hold.y.toFixed(0) : '');
  ok('the thyristor is not the diode: it has a breakover voltage and a reverse breakdown',
     Boolean(where('scr-characteristic', {}, 'VBO') && where('scr-characteristic', {}, 'Breakdown')));

  const said = (name, params, items = []) => {
    const texts = [];
    const { p } = mockP5(900, 460);
    SKETCHES[name].draw({ p: { ...p, text: (t) => texts.push(String(t)) }, frame: 90, time: 3, progress: 1, width: 900, height: 460, params, items, colors: COLORS });
    return texts.join(' | ');
  };
  // Energy is worked out from what was given, never written by the model.
  const equal = said('power-time', {}, [{ label: 'One bulb', value: 100, symbol: '10' }, { label: 'Ten bulbs', value: 1000, symbol: '1' }]);
  ok('100 W for 10 h and 1000 W for 1 h both come to 1 kWh', (equal.match(/1 kWh/g) || []).length === 2, equal);
  ok('2 kW for 3 h is 6 kWh', /6 kWh/.test(said('power-time', {}, [{ label: 'Heater', value: 2000, symbol: '3' }])));
  ok('a load with no hours is not drawn at all', said('power-time', {}, [{ label: 'Heater', value: 2000 }]) === '');
}

// --- a sketch's own caption is written whole -------------------------------------
// Captions were cut to 28 letters, and a reviewer looking at a real video
// called one "a cut-off caption": "Rotor lags the field — that".
{
  const says = (name, params) => record(name, params, 900, 460, 1).said;
  ok('the induction motor finishes its sentence', /that gap is slip/.test(says('induction-motor', { ratio: 0.05 })), says('induction-motor', { ratio: 0.05 }));
  ok('and so does the venturi', /lower pressure/.test(says('bernoulli', {})), says('bernoulli', {}));
  ok('and the logarithm', /ten times the last/.test(says('logarithm', { labelA: 'x', labelB: 'log x' })));
}

// --- nothing is stated by default ----------------------------------------------
// A sketch told nothing used to draw its defaults as though they were facts: a
// phasor at 35 degrees, a power factor of 0.81, a meter reading 12.4 volts,
// branch currents of 3, 2 and 5 amps. The contract now refuses a sketch that
// was not given what it lists - so the ones still allowed to draw when told
// nothing must say nothing that reads as a measurement.
{
  // Fixed pictures whose numbers are true of every case, or are only counters.
  const TRUE_ANYWHERE = new Set([
    'three-phase',     // "120° apart"
    'rms-value',       // "RMS = 0.707 × peak"
    'binary-search',   // "1 left" - where the search ends
    'nuclear-decay',   // "1 half life, 2 half lifes"
    'energy-levels',   // "n=1, n=2"
    'normal-curve',    // "-1σ, +1σ"
  ]);
  const inventing = [];
  const blank = [];
  for (const name of SKETCH_NAMES) {
    const freeToDraw = checkSketch(name, {}, []).length === 0;
    if (!freeToDraw) continue;
    if (!sketchMarks(SKETCHES[name])) blank.push(name);
    const numbers = sketchTexts(SKETCHES[name]).filter((t) => /\d/.test(t));
    if (numbers.length && !TRUE_ANYWHERE.has(name)) inventing.push(name + ' [' + numbers.join(' | ') + ']');
  }
  ok('no sketch that may be drawn untold prints a number of its own', inventing.length === 0, inventing.join(', '));
  ok('and none of them draws a blank', blank.length === 0, blank.join(', '));

  // The other half: a sketch that draws nothing when told nothing must be one
  // the contract refuses, or it reaches a video as an empty scene.
  const emptyButAllowed = SKETCH_NAMES.filter((n) => !sketchMarks(SKETCHES[n]) && checkSketch(n, {}, []).length === 0);
  ok('every sketch that is blank without its items is refused without them', emptyButAllowed.length === 0, emptyButAllowed.join(', '));
  ok('every sketch has a contract', SKETCH_NAMES.every((n) => contractFor(n)));
}

// --- the size of the library --------------------------------------------------
console.log('');
console.log('  sketches: ' + SKETCH_NAMES.length);
console.log('');

console.log(fails ? fails + ' FAILURES' : 'all sketch checks passed');
process.exit(fails ? 1 : 0);
