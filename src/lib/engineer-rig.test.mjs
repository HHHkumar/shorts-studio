// Run: node --import ./tools/ts-resolve.mjs src/lib/engineer-rig.test.mjs
//
// The animated engineer's joints. The drawing can only be judged by eye (see
// tools/engineer-preview.mjs); what can be pinned down here is that limbs keep
// their length, joints fold the right way, and nothing depends on anything
// but the time.

import assert from 'node:assert/strict';
import {
  blink, easeOutBack, figureAt, mouthOpen, POSE_NAMES, POSE_SECONDS, POSES, poseAt, pt, reach, reachOut,
  reactionAt, SHEET, syllables,
} from './engineer-rig.ts';

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

test('the throw overshoots a little and settles', () => {
  const peak = Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49)));
  assert.ok(peak > 1 && peak < 1.2, 'peak ' + peak);
  assert.ok(near(easeOutBack(1), 1) && near(easeOutBack(0), 0));
});

console.log('\ntalking, blinking, reacting');

test('syllables are counted roughly right', () => {
  assert.equal(syllables('current'), 2);
  assert.equal(syllables('engineer.'), 3);
  assert.equal(syllables('flows'), 1);
  assert.equal(syllables('the'), 1);
  assert.equal(syllables(''), 1);
});

test('the mouth is shut between words and moves during them', () => {
  const words = say('current flows here', 1);
  assert.equal(mouthOpen(words, 0.5), 0);
  const during = Array.from({ length: 20 }, (_, i) => mouthOpen(words, 1 + i * 0.017));
  assert.ok(Math.max(...during) > 0.4, 'never opened');
  assert.ok(Math.min(...during.slice(1)) < 0.3, 'never closed within the word');
});

test('he blinks now and then, briefly, and the same way every time', () => {
  const samples = Array.from({ length: 600 }, (_, i) => blink(i / 30));
  const shut = samples.filter((b) => b > 0.5).length;
  assert.ok(shut > 0, 'never blinked in 20 seconds');
  assert.ok(shut < 30, 'eyes shut too much: ' + shut + ' frames');
  assert.deepEqual(samples, Array.from({ length: 600 }, (_, i) => blink(i / 30)));
});

test('a spark knocks his hat up, and it comes back down', () => {
  const words = say('then sparks fly', 0);
  const at = words[1].start;
  assert.ok(reactionAt(words, at + 0.2).hatLift > 10);
  assert.equal(reactionAt(words, at + 2).hatLift, 0);
  assert.equal(reactionAt(words, at - 0.1).hatLift, 0, 'reacted before the word');
});

test('"rises" turns his eyes up, "heats" brings out the sweat', () => {
  assert.equal(reactionAt(say('it rises'), 0.5).look.y, -1);
  assert.equal(reactionAt(say('it heats'), 0.5).prop, 'sweat');
});

test('the whole figure is a function of the time alone', () => {
  const beats = [{ at: 0, pose: 'teach' }, { at: 1, pose: 'cheer' }];
  const words = say('the answer sparks joy', 0.2);
  assert.deepEqual(figureAt(beats, words, 1.37), figureAt(beats, words, 1.37));
});

console.log('\n' + passed + ' checks passed\n');
