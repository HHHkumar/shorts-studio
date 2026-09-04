// Run: node --import ./tools/ts-resolve.mjs src/lib/motion-physics.test.mjs
//
// This exists because the fault it guards against is invisible in a still.
// Every frame of a darting animation looks correct on its own; what is wrong is
// the DISTANCE BETWEEN two frames. So the scene is stepped frame by frame and
// the movement measured, which is the only way to see it without watching.
//
// The threshold is the whole point. Two percent of the frame per frame is sixty
// percent of the frame per second - already brisk. Anything past that reads as
// a thing being flung rather than travelling.

import assert from 'node:assert/strict';
import { beatDuration, gapToNextBeat, safeBand, stateAt, toSafe } from './motion-physics.ts';

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

const FPS = 30;
/** The band a 16:9 scene with a title actually draws into. */
const BAND = safeBand(true, true);
/** A figure's footprint, in the same space positions are computed in. */
const UNIT = { x: (0.16 * 1080 / 1920) / BAND.span, y: 0.16 / BAND.height };
const LIMIT = 2.0;

/** Step a scene and report the worst single-frame movement, as % of frame. */
function worstJump(actors, beats, starts, seconds = 9) {
  const positionOf = (id) => {
    const t = actors.find((a) => a.id === id);
    return t ? { x: t.x, y: t.y, scale: t.scale || 1 } : null;
  };
  let prev = null;
  let worst = 0;
  let at = 0;
  for (let f = 0; f <= seconds * FPS; f++) {
    const time = f / FPS;
    const raw = stateAt(actors[0], beats, starts, time, positionOf, UNIT);
    assert.ok(Number.isFinite(raw.x) && Number.isFinite(raw.y), 'NaN position at ' + time + 's');
    // The DRAWN position, not the storyboard one: measuring the unsquashed
    // coordinates reports movement the viewer never sees.
    const s = toSafe(raw.x, raw.y, BAND);
    if (prev) {
      const d = Math.hypot(s.x - prev.x, s.y - prev.y);
      if (d > worst) { worst = d; at = time; }
    }
    prev = s;
  }
  return { worst: worst * 100, at };
}

const pair = (fromX, toX) => [
  { id: 'a', icon: 'fish', x: fromX, y: 0.55 },
  { id: 'b', icon: 'dam', x: toX, y: 0.5, scale: 1.4 },
];

console.log('\nnothing darts');

test('a short journey and a long one both travel at a sane speed', () => {
  // A fixed duration per verb was the original fault: the same 1.15 seconds
  // carried an actor a tenth of the frame or three quarters of it.
  for (const [from, to] of [[0.45, 0.55], [0.12, 0.6], [0.05, 0.95]]) {
    const r = worstJump(pair(from, to), [{ actor: 'a', action: 'move', to: 'b' }], [0.5]);
    assert.ok(r.worst < LIMIT, (Math.abs(to - from) * 100).toFixed(0) + '% travel jumped '
      + r.worst.toFixed(2) + '%/frame at ' + r.at.toFixed(2) + 's');
  }
});

test('beats bunched together do not compound into a lurch', () => {
  // Two beats running at once on one actor used to add their movements. Real
  // narration puts cues this close all the time.
  const beats = [
    { actor: 'a', action: 'move', to: 'b' },
    { actor: 'a', action: 'blocked', to: 'b' },
  ];
  for (const gap of [3, 1.5, 0.8, 0.4, 0.2, 0.05]) {
    const r = worstJump(pair(0.12, 0.6), beats, [1, 1 + gap]);
    assert.ok(r.worst < LIMIT, 'gap ' + gap + 's jumped ' + r.worst.toFixed(2)
      + '%/frame at ' + r.at.toFixed(2) + 's');
  }
});

test('every verb stays under the limit on its own', () => {
  for (const action of ['appear', 'move', 'blocked', 'climb', 'pulse', 'spin', 'exit']) {
    const r = worstJump(pair(0.15, 0.75), [{ actor: 'a', action, to: 'b' }], [0.5]);
    assert.ok(r.worst < LIMIT, action + ' jumped ' + r.worst.toFixed(2) + '%/frame');
  }
});

test('a whole four-beat scene never lurches', () => {
  const actors = [
    { id: 'fish', icon: 'fish', x: 0.1, y: 0.6, accent: true },
    { id: 'dam', icon: 'dam', x: 0.5, y: 0.55, scale: 1.4 },
    { id: 'ladder', icon: 'stairs', x: 0.8, y: 0.4, hidden: true },
  ];
  const beats = [
    { actor: 'fish', action: 'move', to: 'dam' },
    { actor: 'fish', action: 'blocked', to: 'dam' },
    { actor: 'ladder', action: 'appear' },
    { actor: 'fish', action: 'climb', to: 'ladder' },
  ];
  const r = worstJump(actors, beats, [0.8, 2.4, 4.6, 5.4], 12);
  assert.ok(r.worst < LIMIT, 'jumped ' + r.worst.toFixed(2) + '%/frame at ' + r.at.toFixed(2) + 's');
});

console.log('\npacing');

test('a longer journey takes longer, rather than going faster', () => {
  const near = beatDuration({ action: 'move' }, 2);
  const far = beatDuration({ action: 'move' }, 8);
  assert.ok(far > near, near + ' vs ' + far);
});

test('but never so long that it outstays the sentence', () => {
  assert.ok(beatDuration({ action: 'move' }, 500) <= 2.5);
});

test('and never so short that it reads as a cut', () => {
  assert.ok(beatDuration({ action: 'move' }, 0) >= 0.5);
});

test('a bounce gets longer than a walk over the same ground', () => {
  // It covers the distance about two and a half times, in and back twice.
  assert.ok(beatDuration({ action: 'blocked' }, 5) > beatDuration({ action: 'move' }, 5));
});

test('a gesture has no distance, so its length is fixed', () => {
  assert.equal(beatDuration({ action: 'pulse' }, 1), beatDuration({ action: 'pulse' }, 40));
});

console.log('\ninterruption');

test('the gap to the same actor next beat is found, ignoring other actors', () => {
  const beats = [
    { actor: 'a', action: 'move' },
    { actor: 'b', action: 'pulse' },
    { actor: 'a', action: 'blocked' },
  ];
  assert.equal(gapToNextBeat(beats, [1, 2, 4], 0), 3);
});

test('an actor with nothing else to do runs its beat in full', () => {
  assert.equal(gapToNextBeat([{ actor: 'a', action: 'move' }], [1], 0), Infinity);
});

test('an interrupted beat stops where it got to, and does not snap back', () => {
  // The next beat has to continue from the actual position, or the actor
  // teleports at the hand-over.
  const actors = pair(0.1, 0.9);
  const beats = [
    { actor: 'a', action: 'move', to: 'b' },
    { actor: 'a', action: 'pulse' },
  ];
  const positionOf = (id) => {
    const t = actors.find((x) => x.id === id);
    return t ? { x: t.x, y: t.y, scale: t.scale || 1 } : null;
  };
  const before = stateAt(actors[0], beats, [0.5, 1.0], 0.99, positionOf, UNIT);
  const after = stateAt(actors[0], beats, [0.5, 1.0], 1.05, positionOf, UNIT);
  assert.ok(Math.abs(after.x - before.x) < 0.02, 'snapped from ' + before.x + ' to ' + after.x);
  assert.ok(before.x > 0.1, 'should have made some progress before being cut off');
});

console.log('\n' + passed + ' checks passed\n');
