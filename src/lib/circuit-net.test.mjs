// Run: node --import ./tools/ts-resolve.mjs src/lib/circuit-net.test.mjs
//
// This replaced a `mode` enum that named two shapes. The reason it exists is
// that a question can describe many more than two, and until each one had been
// hand-drawn the model picked the nearest wrong shape - so the picture
// contradicted the words beside it, which is worse than having no picture.
//
// So the tests are about COVERAGE and about refusing what it cannot read. A
// wrong circuit drawn confidently is the failure being designed out.

import assert from 'node:assert/strict';
import { countLeaves, layoutNet, parseNet } from './circuit-net.ts';

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

/** A readable shape string, so a wrong parse says what it read. */
const show = (n) => (n.kind === 'leaf'
  ? n.label
  : '(' + n.kids.map(show).join(n.kind === 'series' ? ' + ' : ' | ') + ')');

console.log('\nreading a network');

test('the arrangement that started this draws correctly', () => {
  // "Two in parallel, that combination in series with the third."
  assert.equal(show(parseNet('12 + (12 | 12)')), '(12 + (12 | 12))');
});

test('and so does its mirror image', () => {
  assert.equal(show(parseNet('(12 + 12) | 12')), '((12 + 12) | 12)');
});

test('parallel binds tighter than series, as it does on paper', () => {
  // R1 + R2 | R3 is R1 in series with the pair, not the pair of (R1+R2) and R3.
  assert.equal(show(parseNet('R1 + R2 | R3')), '(R1 + (R2 | R3))');
});

test('flat runs of either work without brackets', () => {
  assert.equal(show(parseNet('4 | 4 | 4')), '(4 | 4 | 4)');
  assert.equal(show(parseNet('2 + 3 + 4')), '(2 + 3 + 4)');
});

test('nesting goes as deep as the question needs', () => {
  assert.equal(show(parseNet('10 + (20 | (5 + 5))')), '(10 + (20 | (5 + 5)))');
  assert.equal(show(parseNet('((1 + 2) | 3) + 4')), '(((1 + 2) | 3) + 4)');
});

test('a label keeps whatever is written in it', () => {
  // Values arrive with units, decimals and prefixes; only the operators and
  // brackets are ours.
  assert.equal(show(parseNet('4.7k ohm | 1k')), '(4.7k ohm | 1k)');
  assert.equal(show(parseNet('R_load')), 'R_load');
});

test('a doubled bar means the same as one', () => {
  assert.equal(show(parseNet('12 || 12')), '(12 | 12)');
});

test('one component on its own is a network too', () => {
  assert.equal(show(parseNet('12')), '12');
});

console.log('\nrefusing what it cannot read');

test('anything malformed returns null rather than a guess', () => {
  // The caller falls back to the old modes on null. Drawing half a parse would
  // be drawing a different circuit from the one described.
  for (const bad of ['', '   ', '12 +', '+ 12', '(12 | 12', '12 | 12)', '()', '|', null, undefined]) {
    assert.equal(parseNet(bad), null, JSON.stringify(bad));
  }
});

console.log('\nplacing it');

const box = (net, w = 800, h = 300) => layoutNet(parseNet(net), 0, 0, w, h);

test('every component gets exactly one box', () => {
  for (const net of ['12', '2 + 3 + 4', '4 | 4 | 4', '12 + (12 | 12)', '((1 + 2) | 3) + 4']) {
    const laid = box(net);
    assert.equal(laid.boxes.length, countLeaves(parseNet(net)), net);
  }
});

test('series runs across, parallel stacks down', () => {
  const series = box('2 + 3 + 4').boxes;
  assert.ok(series[0].x < series[1].x && series[1].x < series[2].x, 'series should spread sideways');
  assert.ok(new Set(series.map((b) => Math.round(b.y))).size === 1, 'series should stay on one line');

  const parallel = box('4 | 4 | 4').boxes;
  assert.ok(parallel[0].y < parallel[1].y && parallel[1].y < parallel[2].y, 'parallel should stack');
  assert.ok(new Set(parallel.map((b) => Math.round(b.x))).size === 1, 'parallel should share a column');
});

test('nothing is ever placed outside the rectangle it was given', () => {
  // A branch off the canvas is invisible, and the circuit it belongs to is
  // then silently wrong rather than obviously broken.
  for (const net of ['12', '4 | 4 | 4 | 4', '1 + 2 + 3 + 4 + 5', '10 + (20 | (5 + 5))',
    '((1 | 2) + (3 | 4)) | 5']) {
    const laid = layoutNet(parseNet(net), 10, 20, 600, 240);
    for (const b of laid.boxes) {
      assert.ok(b.x >= 10 && b.x + b.w <= 610, net + ': box escaped sideways');
      assert.ok(b.y >= 20 && b.y + laid.boxH <= 260, net + ': box escaped vertically');
    }
    for (const w of laid.wires) {
      for (const v of [w.x1, w.x2]) assert.ok(v >= 9.9 && v <= 610.1, net + ': wire escaped sideways');
      for (const v of [w.y1, w.y2]) assert.ok(v >= 19.9 && v <= 260.1, net + ': wire escaped vertically');
    }
  }
});

test('a crowded network gets smaller parts, not overlapping ones', () => {
  // Four branches in the room one resistor had used to draw at full size with
  // the labels sitting on the box above.
  const roomy = layoutNet(parseNet('12'), 0, 0, 600, 240);
  const crowded = layoutNet(parseNet('1 | 2 | 3 | 4 | 5'), 0, 0, 600, 240);
  assert.ok(crowded.boxH < roomy.boxH, 'boxes should shrink to fit');

  const ys = crowded.boxes.map((b) => b.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] - ys[i - 1] > crowded.boxH, 'branches overlap each other');
    assert.ok(ys[i] - ys[i - 1] > crowded.labelGap, 'a label would land on the box above');
  }
});

test('every branch is wired at both ends', () => {
  // A box with no lead either side is a component floating in space.
  const laid = box('12 + (12 | 12)');
  for (const b of laid.boxes) {
    const mid = b.y + laid.boxH / 2;
    const near = (v, t) => Math.abs(v - t) < 1;
    assert.ok(laid.wires.some((w) => near(w.y1, mid) && near(w.x2, b.x)), 'no lead in');
    assert.ok(laid.wires.some((w) => near(w.y1, mid) && near(w.x1, b.x + b.w)), 'no lead out');
  }
});

test('a parallel block is marked as joined at both ends', () => {
  // Without the junction dots a branch meeting a rail reads as two wires
  // crossing, which is a different circuit.
  assert.ok(box('4 | 4').dots.length >= 2);
  assert.equal(box('2 + 3').dots.length, 0, 'a plain series chain has no junctions');
});

console.log('\n' + passed + ' checks passed\n');
