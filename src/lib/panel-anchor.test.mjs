// Run: node src/lib/panel-anchor.test.mjs
//
// The anchor decides where an effect fires. It is worked out rather than
// measured, which means it can silently disagree with where the panel actually
// drew the thing - and a spin aimed at the wrong box is worse than one aimed at
// the middle, because it points confidently at nothing.
//
// So these check the property that matters: the anchor MOVES with the active
// item, in the direction the panel lays items out.

import assert from 'node:assert/strict';
import { activeIndex, anchorFor, CENTRE, revealOrder } from './panel-anchor.ts';

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

const onFrame = (a) => a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1;

console.log('\nreveal order');

test('it is the order the panel lights things up in', () => {
  assert.deepEqual(
    revealOrder({ nodes: [{ label: 'A' }, { label: 'B' }] }),
    ['A', 'B'],
  );
  assert.deepEqual(
    revealOrder({ leftLabel: 'L', rightLabel: 'R', steps: [{ label: 'S' }] }),
    ['L', 'R', 'S'],
  );
});

test('an empty or missing panel has no order', () => {
  assert.deepEqual(revealOrder(undefined), []);
  assert.deepEqual(revealOrder({}), []);
});

console.log('\nwhere the effect fires');

const diagram = {
  nodes: [
    { id: 'a', label: 'Reservoir', col: 0, row: 0 },
    { id: 'b', label: 'Turbine', col: 1, row: 0 },
    { id: 'c', label: 'Generator', col: 2, row: 0 },
  ],
};

test('a chain of boxes anchors left, middle, then right', () => {
  const xs = [0, 1, 2].map((i) => anchorFor('diagram', diagram, i, true).x);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2], JSON.stringify(xs));
  // The middle box should be near the middle of the frame.
  assert.ok(Math.abs(xs[1] - 0.5) < 0.05, 'middle box at ' + xs[1]);
});

test('a stacked diagram anchors down the frame, not across', () => {
  const stacked = {
    nodes: [
      { id: 'a', label: 'A', col: 0, row: 0 },
      { id: 'b', label: 'B', col: 0, row: 1 },
      { id: 'c', label: 'C', col: 0, row: 2 },
    ],
  };
  const ys = [0, 1, 2].map((i) => anchorFor('diagram', stacked, i, true).y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2], JSON.stringify(ys));
});

test('a wide process anchors across, a tall one down', () => {
  const three = { steps: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] };
  const across = [0, 2].map((i) => anchorFor('process', three, i, true).x);
  assert.ok(across[0] < across[1], 'landscape should spread horizontally');

  const down = [0, 2].map((i) => anchorFor('process', three, i, false).y);
  assert.ok(down[0] < down[1], 'portrait should stack vertically');
});

test('a grid wraps, so the fourth item is back on the left and lower', () => {
  const grid = { steps: Array.from({ length: 6 }, (_, i) => ({ label: 'S' + i })) };
  const first = anchorFor('grid', grid, 0, true);
  const fourth = anchorFor('grid', grid, 3, true);
  assert.ok(Math.abs(fourth.x - first.x) < 0.02, 'should be in the same column');
  assert.ok(fourth.y > first.y, 'should be on the row below');
});

test('two sides anchor to their own side', () => {
  const versus = { leftLabel: 'L', rightLabel: 'R', leftPoints: ['a'], rightPoints: ['b'] };
  assert.ok(anchorFor('versus', versus, 0, true).x < 0.5);
  assert.ok(anchorFor('versus', versus, 1, true).x > 0.5);
});

test('a motion scene anchors on its own accented actor', () => {
  const panel = {
    actors: [
      { id: 'dam', icon: 'dam', x: 0.8, y: 0.5 },
      { id: 'fish', icon: 'fish', x: 0.2, y: 0.7, accent: true },
    ],
  };
  const a = anchorFor('motion', panel, 0, true);
  // The fish is on the left, so the anchor must be left of centre.
  assert.ok(a.x < 0.5, 'anchored at ' + a.x);
});

console.log('\nwhen there is nothing to aim at');

/** The middle of the panel area, which sits above the caption band. */
const middle = (landscape) => anchorFor('title', { title: 'x' }, 0, landscape);

test('a title card anchors in the middle of the panel, not of the frame', () => {
  const a = middle(true);
  assert.equal(a.x, 0.5);
  // Above frame centre, because the caption band takes the bottom of the frame.
  assert.ok(a.y < 0.5 && a.y > 0.4, 'anchored at y=' + a.y);
});

test('every way of saying "nothing to aim at" gives the same point', () => {
  // Three code paths mean the same thing; if they drift, an effect jumps a few
  // percent up the frame for no reason a viewer could explain.
  const expected = middle(true);
  assert.deepEqual(anchorFor('diagram', diagram, -1, true), expected);
  assert.deepEqual(anchorFor('diagram', undefined, 0, true), expected);
  assert.deepEqual(anchorFor('process', {}, 0, true), expected);
});

test('an index past the end clamps to the last item', () => {
  const a = anchorFor('diagram', diagram, 99, true);
  const last = anchorFor('diagram', diagram, 2, true);
  assert.deepEqual(a, last);
});

test('every anchor lands somewhere on the frame', () => {
  // An anchor off the frame would put an effect where nobody can see it.
  for (const kind of ['diagram', 'process', 'grid', 'timeline', 'recap', 'versus', 'metaphor', 'motion', 'title']) {
    for (const i of [-1, 0, 1, 5, 99]) {
      for (const landscape of [true, false]) {
        const a = anchorFor(kind, diagram, i, landscape);
        assert.ok(onFrame(a), kind + ' index ' + i + ' -> ' + JSON.stringify(a));
      }
    }
  }
});

console.log('\nfollowing the voice');

test('the active item advances as the narration reaches each label', () => {
  const words = 'first the reservoir then the turbine and then the generator'
    .split(' ').map((word, i) => ({ word, start: i, end: i + 1 }));
  const early = activeIndex(diagram, words, 2, 12);
  const late = activeIndex(diagram, words, 11, 12);
  assert.ok(late > early, 'expected the index to advance, got ' + early + ' then ' + late);
});

test('nothing to reveal means nothing is active', () => {
  assert.equal(activeIndex({ title: 'x' }, [], 1, 10), -1);
  assert.equal(activeIndex(undefined, [], 1, 10), -1);
});

console.log('\n' + passed + ' checks passed\n');
