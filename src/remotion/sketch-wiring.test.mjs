// Run: node --import ./tools/ts-resolve.mjs src/remotion/sketch-wiring.test.mjs
//
// Is the circuit actually wired? The other sketch test proves every sketch
// draws something and stays in its canvas - and says of itself that it
// "cannot tell you a circuit is wired wrongly". This one can, for the circuit
// sketches that have a switch or a battery in a wire.
//
// Written after a video showed "Closed - current flows" under a switch with
// bare gaps either side of it: the gap in the wire was sized as a share of the
// canvas and the switch in pixels, so at the portrait figure's width the two
// no longer met. Nothing threw, nothing was NaN, every shape was on canvas. It
// was just wrong, where every viewer could see it.
//
// The check is geometric, drawn against a recording p5: along the switch's
// wire, the lines must join end to end when the switch is closed and must NOT
// when it is open; and the wire into a battery must reach its plates.

import { SKETCHES } from './sketches.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };

/** A p5 that draws nothing and records every line and circle. */
function recorder() {
  const lines = [];
  const circles = [];
  const self = new Proxy({}, {
    get(_, key) {
      if (key === 'line') return (x1, y1, x2, y2) => { lines.push({ x1, y1, x2, y2 }); return self; };
      if (key === 'circle') return (x, y, d) => { circles.push({ x, y, d }); return self; };
      if (key === 'textWidth') return () => 10;
      // Everything else - styles, text, colour objects - is a no-op that can be chained.
      return () => self;
    },
  });
  return { p: self, lines, circles };
}

const COLORS = { accent: '#e0301e', text: '#1c1c1c', dim: '#888888', good: '#1f9d55', bg: '#fbf8f1' };

function draw(name, width, height, params, progress) {
  const r = recorder();
  SKETCHES[name].draw({ p: r.p, frame: 0, time: 0, progress, width, height, params, items: [], colors: COLORS });
  return r;
}

const near = (a, b, tol = 0.75) => Math.abs(a - b) <= tol;

/** The stretches of `span` that no horizontal line at `y` covers. */
function horizontalGaps(lines, y, span) {
  const cover = lines
    .filter((l) => near(l.y1, y) && near(l.y2, y))
    .map((l) => [Math.min(l.x1, l.x2), Math.max(l.x1, l.x2)])
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let reach = span[0];
  for (const [a, b] of cover) {
    if (a > reach + 1) gaps.push([reach, a]);
    reach = Math.max(reach, b);
  }
  if (reach < span[1] - 1) gaps.push([reach, span[1]]);
  return gaps;
}

/** Same, down a vertical wire at `x`. */
function verticalGaps(lines, x, span) {
  const flipped = lines.map((l) => ({ x1: l.y1, y1: l.x1, x2: l.y2, y2: l.x2 }));
  return horizontalGaps(flipped, x, span);
}

/** The two small dots a switch puts on its contacts: the row the switch sits in. */
function switchRow(circles) {
  const dots = circles.filter((c) => c.d <= 20);
  for (const a of dots) for (const b of dots) if (a !== b && near(a.y, b.y)) return a.y;
  return null;
}

/** Battery plates: short horizontal lines, the long one above the short one, centred on a vertical wire. */
function batteryPlates(lines) {
  const plates = lines.filter((l) => near(l.y1, l.y2) && Math.abs(l.x2 - l.x1) > 8 && Math.abs(l.x2 - l.x1) < 60);
  for (const top of plates) {
    for (const bottom of plates) {
      const cx = (top.x1 + top.x2) / 2;
      if (top === bottom || !near(cx, (bottom.x1 + bottom.x2) / 2, 1)) continue;
      if (bottom.y1 <= top.y1 || bottom.y1 - top.y1 > 30) continue;
      if (Math.abs(top.x2 - top.x1) <= Math.abs(bottom.x2 - bottom.x1)) continue;
      return { x: cx, top: top.y1, bottom: bottom.y1 };
    }
  }
  return null;
}

// The figure box in a portrait video is 940 wide, in a landscape one 620. The
// bug lived only in the first; test both, and one well past either.
const SIZES = [[940, 620], [620, 420], [1400, 700]];

console.log('\nthe switch');

for (const [w, h] of SIZES) {
  test('closed at ' + w + 'x' + h + ': the switch\'s wire is continuous', () => {
    const { lines, circles } = draw('switch-circuit', w, h, { mode: 'closed' }, 1);
    const y = switchRow(circles);
    assert(y !== null, 'no switch contacts found');
    const row = lines.filter((l) => near(l.y1, y) && near(l.y2, y));
    const span = [Math.min(...row.map((l) => Math.min(l.x1, l.x2))), Math.max(...row.map((l) => Math.max(l.x1, l.x2)))];
    const gaps = horizontalGaps(lines, y, span);
    assert(!gaps.length, 'bare gaps in a closed circuit at x = ' + gaps.map((g) => g.map(Math.round).join('-')).join(', '));
  });

  test('open at ' + w + 'x' + h + ': the circuit is visibly broken, and the blade lifts clear', () => {
    const { lines, circles } = draw('switch-circuit', w, h, { mode: 'open' }, 0);
    const y = switchRow(circles);
    const row = lines.filter((l) => near(l.y1, y) && near(l.y2, y));
    const span = [Math.min(...row.map((l) => Math.min(l.x1, l.x2))), Math.max(...row.map((l) => Math.max(l.x1, l.x2)))];
    const gaps = horizontalGaps(lines, y, span);
    assert(gaps.length === 1, 'an open switch should leave exactly one break, found ' + gaps.length);
    const blade = lines.find((l) => !near(l.y1, l.y2) && (near(l.y1, y) || near(l.y2, y)) && Math.abs(l.x2 - l.x1) > 10);
    assert(blade, 'no raised blade');
    const lift = Math.abs(blade.y2 - blade.y1);
    const length = Math.hypot(blade.x2 - blade.x1, blade.y2 - blade.y1);
    assert(lift / length > 0.18, 'the blade barely lifts - an open switch that looks shut (' + Math.round((lift / length) * 100) + '%)');
  });
}

console.log('\nthe batteries');

for (const name of ['switch-circuit', 'led-circuit']) {
  for (const [w, h] of SIZES) {
    test(name + ' at ' + w + 'x' + h + ': the wire reaches both battery plates', () => {
      const { lines } = draw(name, w, h, { mode: 'closed' }, 1);
      const b = batteryPlates(lines);
      assert(b, 'no battery found');
      const wire = lines.filter((l) => near(l.x1, b.x) && near(l.x2, b.x));
      assert(wire.length >= 2, 'no vertical wire into the battery');
      const span = [Math.min(...wire.map((l) => Math.min(l.y1, l.y2))), Math.max(...wire.map((l) => Math.max(l.y1, l.y2)))];
      const gaps = verticalGaps(lines, b.x, span);
      // The only uncovered stretch may be between the plates - that is the battery.
      assert(gaps.length === 1, 'expected one gap (the battery), found ' + gaps.length);
      assert(near(gaps[0][0], b.top, 1) && near(gaps[0][1], b.bottom, 1),
        'the wire stops ' + Math.round(b.top - gaps[0][0]) + ' px short of the top plate and '
        + Math.round(gaps[0][1] - b.bottom) + ' px short of the bottom one');
    });
  }
}

console.log('\n' + passed + ' checks passed');
