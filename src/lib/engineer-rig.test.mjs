// Run: node --import ./tools/ts-resolve.mjs src/lib/engineer-rig.test.mjs
//
// The animated engineer's joints. The drawing can only be judged by eye (see
// tools/engineer-preview.mjs); what can be pinned down here is that limbs keep
// their length, joints fold the right way, and nothing depends on anything
// but the time.

import assert from 'node:assert/strict';
import {
  blink, ease, figureAt as figureAtMimes, MIME_SECONDS, mimeAt as mimeAtMimes, mimesIn, POSE_NAMES, POSE_SECONDS, POSES, poseAt, pt, reach, reachOut, SHEET,
} from './engineer-rig.ts';
import { ENGINEER_POSES } from './doodle.ts';

// The tests speak in words; the rig takes timed mimes, as a video gives it.
const figureAt = (beats, words, time) => figureAtMimes(beats, mimesIn(words), time);
const mimeAt = (words, time) => mimeAtMimes(mimesIn(words), time);

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
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const say = (text, from = 0, per = 0.4) =>
  text.split(/\s+/).map((word, i) => ({ word, start: from + i * per, end: from + i * per + per * 0.85 }));

console.log('\nlimbs');

test('a reachable hand lands exactly on its target, bones unstretched', () => {
  const root = pt(0, 0);
  const { joint, end } = reach(root, pt(60, 90), 82, 88, 1);
  assert.ok(near(end.x, 60) && near(end.y, 90), 'hand at ' + JSON.stringify(end));
  assert.ok(near(dist(root, joint), 82), 'upper arm ' + dist(root, joint));
  assert.ok(near(dist(joint, end), 88), 'forearm ' + dist(joint, end));
});

test('an unreachable target gets a straight limb aimed at it, not a torn one', () => {
  const { joint, end } = reach(pt(0, 0), pt(1000, 0), 82, 88, 1);
  assert.ok(near(dist(pt(0, 0), end), 170, 0.01));
  assert.ok(Math.abs(joint.y) < 1, 'the elbow should be on the line, is at ' + joint.y);
});

test('elbows fold away from the body, hanging or raised', () => {
  // His right arm (viewer's left): the elbow is further left than the line
  // from shoulder to hand, whether the hand hangs or waves.
  for (const hand of [pt(238, 852), pt(200, 520)]) {
    const { joint } = reachOut(SHEET.shoulderL, hand, SHEET.upperArm, SHEET.forearm, -1);
    const t = (joint.y - SHEET.shoulderL.y) / (hand.y - SHEET.shoulderL.y);
    const onLine = SHEET.shoulderL.x + (hand.x - SHEET.shoulderL.x) * t;
    assert.ok(joint.x <= onLine + 0.01, 'elbow folds inward for hand at ' + JSON.stringify(hand));
  }
  for (const hand of [pt(512, 850), pt(572, 556)]) {
    const { joint } = reachOut(SHEET.shoulderR, hand, SHEET.upperArm, SHEET.forearm, 1);
    const t = (joint.y - SHEET.shoulderR.y) / (hand.y - SHEET.shoulderR.y);
    const onLine = SHEET.shoulderR.x + (hand.x - SHEET.shoulderR.x) * t;
    assert.ok(joint.x >= onLine - 0.01, 'elbow folds inward for hand at ' + JSON.stringify(hand));
  }
});

test('at rest he stands on both feet, legs nearly straight like the sheet', () => {
  const f = figureAt([{ at: 0, pose: 'stand' }], [], 0);
  for (const leg of [f.legs.l, f.legs.r]) {
    const span = dist(leg.hip, leg.foot);
    assert.ok(span > (SHEET.thigh + SHEET.shin) * 0.985, 'knee bent at rest: span ' + span.toFixed(1));
  }
  assert.ok(near(f.legs.l.foot.y, SHEET.footL.y, 3) && near(f.legs.r.foot.y, SHEET.footR.y, 3), 'feet off the floor');
});

console.log('\nposes');

test('the pose names the server knows are exactly the rig poses', () => {
  assert.deepEqual([...ENGINEER_POSES].sort(), [...POSE_NAMES].sort());
});

test('every pose is complete', () => {
  for (const name of POSE_NAMES) {
    const p = POSES[name];
    for (const key of ['lHand', 'rHand', 'look', 'eyes', 'mouth', 'brows', 'prop', 'finger']) {
      assert.ok(p[key] !== undefined, name + ' has no ' + key);
    }
  }
});

test('before the first change and after it settles, the pose is exact', () => {
  const beats = [{ at: 0, pose: 'stand' }, { at: 2, pose: 'wave' }];
  assert.deepEqual(poseAt(beats, 1.9), POSES.stand);
  assert.deepEqual(poseAt(beats, 2 + POSE_SECONDS + 0.01), POSES.wave);
});

test('mid-change the hand is on its way, and the face switches once, not morphs', () => {
  const beats = [{ at: 0, pose: 'stand' }, { at: 2, pose: 'shock' }];
  const early = poseAt(beats, 2 + POSE_SECONDS * 0.2);
  const late = poseAt(beats, 2 + POSE_SECONDS * 0.8);
  assert.ok(early.rHand.y < POSES.stand.rHand.y && early.rHand.y > POSES.shock.rHand.y - 40);
  assert.equal(early.eyes, 'dot');
  assert.equal(late.eyes, 'wide');
});

test('beats given out of order are played in order', () => {
  const p = poseAt([{ at: 3, pose: 'cheer' }, { at: 0, pose: 'think' }], 1);
  assert.equal(p.prop, 'question');
});

test('a change starts from rest and arrives at rest - no snap at either end', () => {
  const speed = (t) => (ease(t + 0.001) - ease(t)) / 0.001;
  assert.ok(near(ease(0), 0) && near(ease(1), 1));
  assert.ok(speed(0) < 0.05, 'starts with a jerk: ' + speed(0));
  assert.ok(Math.abs(speed(0.999)) < 0.3, 'stops dead: ' + speed(0.999));
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => ease(i / 100)));
  assert.ok(peak < 1.05, 'overshoots too far: ' + peak);
});

test('the hand trails the body through a change, and catches up', () => {
  const beats = [{ at: 0, pose: 'stand' }, { at: 1, pose: 'shock' }];
  const early = figureAt(beats, [], 1.1);
  const settled = figureAt(beats, [], 3);
  assert.ok(early.arms.r.hand.y > settled.arms.r.hand.y + 40, 'hand already up at 0.1s in');
});

console.log('\nblinking and miming');

test('he never talks: nothing about the mouth follows the words', () => {
  const beats = [{ at: 0, pose: 'stand' }];
  const words = say('this is a perfectly calm sentence', 0);
  const mouths = new Set(Array.from({ length: 60 }, (_, i) => figureAt(beats, words, i / 30).mouth));
  assert.deepEqual([...mouths], ['smile']);
});

test('he blinks now and then, briefly, and the same way every time', () => {
  const samples = Array.from({ length: 600 }, (_, i) => blink(i / 30));
  const shut = samples.filter((b) => b > 0.5).length;
  assert.ok(shut > 0, 'never blinked in 20 seconds');
  assert.ok(shut < 30, 'eyes shut too much: ' + shut + ' frames');
  assert.deepEqual(samples, Array.from({ length: 600 }, (_, i) => blink(i / 30)));
});

test('an action word starts a mime, which blends in and out', () => {
  const words = say('then the water flows away', 0);
  const at = words[3].start;
  assert.equal(mimeAt(words, at - 0.05).weight, 0, 'mimed before the word');
  assert.equal(mimeAt(words, at + 0.8).kind, 'flow');
  assert.equal(mimeAt(words, at + 0.8).weight, 1);
  assert.ok(mimeAt(words, at + 0.1).weight < 0.5, 'snapped in');
  assert.equal(mimeAt(words, at + MIME_SECONDS + 0.05).weight, 0, 'never let go');
});

test('"flows" draws his hand across, left to right, eyes following', () => {
  const beats = [{ at: 0, pose: 'stand' }];
  const words = say('water flows', 0);
  const a = figureAt(beats, words, words[1].start + 0.45);
  const b = figureAt(beats, words, words[1].start + 1.0);
  assert.ok(b.arms.r.hand.x > a.arms.r.hand.x + 40, 'hand did not travel right');
  assert.ok(b.look.x > a.look.x, 'eyes did not follow');
});

test('a spark knocks his hat up and widens his eyes, then he settles', () => {
  const beats = [{ at: 0, pose: 'stand' }];
  const words = say('then sparks fly', 0);
  const at = words[1].start;
  const hit = figureAt(beats, words, at + 0.35);
  assert.ok(hit.hatLift > 15, 'hat ' + hit.hatLift);
  assert.equal(hit.eyes, 'wide');
  assert.equal(figureAt(beats, words, at + MIME_SECONDS + 0.2).hatLift, 0);
});

test('everyday electrical words do not make him jump - only things that go bang', () => {
  assert.equal(mimesIn(say('the answer is low voltage')).length, 0, 'jolted at "voltage"');
  assert.equal(mimesIn(say('follow for one electrical question a day')).length, 0, 'jolted at "electrical"');
  assert.equal(mimesIn(say('the current in the circuit')).length, 0, 'jolted at "current"');
  assert.equal(mimesIn(say('then sparks fly'))[0].kind, 'spark');
  assert.equal(mimesIn(say('a lightning strike'))[0].kind, 'spark');
  assert.equal(mimesIn(say('the current flows'))[0].kind, 'flow', 'the flow was lost with the spark');
});

test('"heats" brings out the sweat, "rises" turns his eyes up', () => {
  const beats = [{ at: 0, pose: 'stand' }];
  assert.equal(figureAt(beats, say('it heats'), 1.0).prop, 'sweat');
  assert.ok(figureAt(beats, say('it rises'), 1.0).look.y < -0.9);
});

test('his elbow never flips over as a hand sweeps across in front of him', () => {
  const beats = [{ at: 0, pose: 'stand' }];
  const words = say('water flows', 0);
  let last = null;
  for (let i = 0; i <= 60; i++) {
    const f = figureAt(beats, words, words[1].start + (i / 60) * MIME_SECONDS);
    if (last) assert.ok(Math.hypot(f.arms.r.elbow.x - last.x, f.arms.r.elbow.y - last.y) < 25, 'elbow jumped at step ' + i);
    last = f.arms.r.elbow;
  }
});

test('no hand or elbow jumps between frames - any change of pose, any mime', () => {
  // At 30 frames a second. Two ways to fail: a flip - one frame's move far
  // bigger than the frames either side of it - and a whip, anything faster
  // than a limb can be followed by eye.
  const WHIP = 80;
  const worst = { d: 0, where: '' };
  const flips = [];
  const track = (label, sample) => {
    const frames = Array.from({ length: 76 }, (_, i) => sample(i / 30));
    for (const side of ['l', 'r']) {
      for (const joint of ['elbow', 'hand']) {
        const moves = frames.slice(1).map((f, i) => dist(f.arms[side][joint], frames[i].arms[side][joint]));
        moves.forEach((d, i) => {
          const where = label + ' ' + side + ' ' + joint + ' frame ' + (i + 1);
          if (d > worst.d) Object.assign(worst, { d, where });
          const around = Math.max(moves[i - 1] ?? 0, moves[i + 1] ?? 0);
          if (d > 20 && d > 3 * around) flips.push(where + ' (' + d.toFixed(0) + ' px)');
        });
      }
    }
  };
  for (const a of POSE_NAMES) {
    for (const b of POSE_NAMES) {
      if (a !== b) track(a + '->' + b, (t) => figureAt([{ at: 0, pose: a }, { at: 0.5, pose: b }], [], t));
    }
  }
  for (const line of ['water flows', 'it rises', 'it falls', 'it spins', 'it heats', 'it cools', 'they collide',
    'sparks fly', 'steam bursts', 'it glows', 'water drips', 'contacts vibrate']) {
    for (const pose of ['stand', 'teach', 'think']) {
      track(pose + ' + ' + line, (t) => figureAt([{ at: 0, pose }], say(line, 0.2), t));
    }
  }
  assert.deepEqual(flips, [], 'flipped');
  assert.ok(worst.d < WHIP, 'whipped ' + worst.d.toFixed(1) + ' px in a frame at ' + worst.where);
});

test('the whole figure is a function of the time alone', () => {
  const beats = [{ at: 0, pose: 'teach' }, { at: 1, pose: 'cheer' }];
  const words = say('the answer sparks joy', 0.2);
  assert.deepEqual(figureAt(beats, words, 1.37), figureAt(beats, words, 1.37));
});

console.log('\n' + passed + ' checks passed\n');
