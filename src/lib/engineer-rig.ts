import type { WordTiming } from './types';
import { detectEffects, type EffectKind } from './motion-lexicon';

// ---------------------------------------------------------------------------
// The channel's engineer, as a puppet.
//
// The drawings Gemini makes are stills: one pose, one expression, per scene.
// This is the same character rebuilt from lines - a circle for a head, a hard
// hat, a black T-shirt, stick limbs - so that the renderer can move him: he
// blinks, mimes the action words the voice says, waves, points at the diagram, jumps
// when the answer lands.
//
// Everything here is plain arithmetic on the time, so frame 300 is the same
// drawing whether it is reached by playing or seeking. The drawing itself is
// Engineer.tsx; this file only decides where every joint is.
//
// Coordinates are the model sheet's own pixels (public/mascot/mascot.jpg,
// 768 wide), so the proportions can be checked against it directly.
// ---------------------------------------------------------------------------

export interface Pt { x: number; y: number }

export const pt = (x: number, y: number): Pt => ({ x, y });

/** Where the fixed parts sit when he stands still, traced off the sheet. */
export const SHEET = {
  head: pt(372, 456),
  headR: 156,
  /** The point the head tilts about. */
  neck: pt(372, 612),
  shoulderL: pt(282, 692),
  shoulderR: pt(472, 690),
  hipL: pt(330, 826),
  hipR: pt(438, 822),
  footL: pt(328, 1098),
  footR: pt(452, 1094),
  /** The point the body leans about. */
  hips: pt(384, 824),
  upperArm: 82,
  forearm: 88,
  // A hair longer than hip to foot, so he stands with straight legs and
  // the knees only fold when he crouches or lands.
  thigh: 136.4,
  shin: 136.4,
} as const;

export type Eyes = 'dot' | 'wide' | 'happy' | 'closed';
export type Mouth = 'smile' | 'grin' | 'o' | 'flat' | 'frown';
export type Brows = 'none' | 'up' | 'worried';
export type Prop = 'none' | 'question' | 'exclaim' | 'sweat' | 'sparkle' | 'idea';

export interface Pose {
  /** Where each hand reaches for, with the body at rest. */
  lHand: Pt;
  rHand: Pt;
  /** Degrees; positive leans to his left, the viewer's right. */
  lean: number;
  /** How far the hips sink, bending the knees. Negative stands tall. */
  crouch: number;
  headTilt: number;
  /** Where he is looking, -1 to 1 on each axis. */
  look: Pt;
  eyes: Eyes;
  mouth: Mouth;
  brows: Brows;
  /** How far the hard hat jumps off his head. */
  hatLift: number;
  prop: Prop;
  /** Which hand, if any, has a pointing finger. */
  finger: 'none' | 'l' | 'r';
  /** Motion that belongs to the pose rather than to a moment. */
  wave: boolean;
  jump: boolean;
  /** 0 to 1: how much of the bounce is in, mid-change. */
  jumpWeight: number;
}

const BASE: Pose = {
  // Near full reach, so a resting arm hangs almost straight, as on the sheet.
  lHand: pt(238, 852),
  rHand: pt(512, 850),
  lean: 0,
  crouch: 0,
  headTilt: 0,
  look: pt(0, 0),
  eyes: 'dot',
  mouth: 'smile',
  brows: 'none',
  hatLift: 0,
  prop: 'none',
  finger: 'none',
  wave: false,
  jump: false,
  jumpWeight: 0,
};

const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p, jumpWeight: p.jump ? 1 : 0 });

/**
 * The poses he knows. Named for what they are for, so a scene direction
 * ("puzzled", "the reveal") can be mapped onto one without knowing the joints.
 */
export const POSES = {
  stand: pose({}),
  wave: pose({ rHand: pt(572, 556), wave: true, headTilt: 4, mouth: 'grin' }),
  point: pose({ rHand: pt(640, 648), finger: 'r', look: pt(1, 0), headTilt: 6, lean: 3 }),
  idea: pose({
    rHand: pt(512, 508), finger: 'r', look: pt(0.3, -1), mouth: 'grin', eyes: 'wide', prop: 'idea',
  }),
  think: pose({
    rHand: pt(414, 600), look: pt(0.7, -0.8), mouth: 'flat', headTilt: -7, prop: 'question',
  }),
  shock: pose({
    lHand: pt(222, 520), rHand: pt(522, 520), eyes: 'wide', mouth: 'o', brows: 'up', hatLift: 46,
    crouch: -8, prop: 'exclaim',
  }),
  cheer: pose({
    lHand: pt(206, 470), rHand: pt(540, 470), eyes: 'happy', mouth: 'grin', jump: true, prop: 'sparkle',
  }),
  teach: pose({ rHand: pt(604, 758), look: pt(0.8, 0.2), headTilt: 5, lean: 2 }),
  worried: pose({
    lHand: pt(236, 832), rHand: pt(512, 830), brows: 'worried', mouth: 'frown', look: pt(-0.4, 0.3),
    crouch: 10, prop: 'sweat',
  }),
  shrug: pose({
    lHand: pt(176, 742), rHand: pt(578, 740), brows: 'up', mouth: 'flat', headTilt: -8, crouch: -6,
  }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;
export const POSE_NAMES = Object.keys(POSES) as PoseName[];

/** One change of pose: from `at` seconds on, he takes up this pose. */
export interface Beat {
  at: number;
  pose: PoseName;
}

/**
 * How long a change of pose takes, in seconds. Long enough to read as a
 * movement rather than a jump cut; the first version's 0.42s with an
 * overshoot looked snappy and mechanical.
 */
export const POSE_SECONDS = 0.65;

/**
 * How far the hands and head trail the body through a change, in seconds.
 * Overlapping action: the body moves first and the limbs follow, which is
 * most of what makes a movement look loose rather than hinged.
 */
export const HAND_LAG = 0.08;
export const HEAD_LAG = 0.12;

// --- maths ------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => pt(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Starts and ends at rest - no jerk at either end - with the faintest settle
 * past the target, so a limb arrives instead of stopping dead.
 */
export function ease(t: number): number {
  const x = clamp01(t);
  const smoother = x * x * x * (x * (x * 6 - 15) + 10);
  return smoother + 0.05 * Math.sin(Math.PI * x) * Math.sin(Math.PI * x) * x;
}

/** 0 to 1 and back over a span: in over `rise`, out over `fall`, smooth. */
function envelope(since: number, span: number, rise: number, fall: number): number {
  if (since < 0 || since > span) return 0;
  const s = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  if (since < rise) return s(since / rise);
  if (since > span - fall) return s((span - since) / fall);
  return 1;
}

/** A repeatable 0-1 number for an integer, for blinks. */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Two-bone reach: where the elbow (or knee) goes for the hand (or foot) to
 * land on `target`. `bend` picks which side the joint folds to. A target out
 * of reach gets a straight limb pointing at it.
 */
export function reach(root: Pt, target: Pt, upper: number, lower: number, bend: 1 | -1): { joint: Pt; end: Pt } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const want = Math.hypot(dx, dy);
  const d = Math.max(Math.abs(upper - lower) + 0.001, Math.min(upper + lower - 0.001, want));
  const base = Math.atan2(dy, dx);
  const cos = (upper * upper + d * d - lower * lower) / (2 * upper * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cos)));
  const joint = pt(root.x + upper * Math.cos(base + bend * a), root.y + upper * Math.sin(base + bend * a));
  const end = pt(root.x + d * Math.cos(base), root.y + d * Math.sin(base));
  return { joint, end };
}

/**
 * The same reach, with the joint folding outward and downward: `side` -1 for
 * the viewer's left limb, 1 for the right. Elbows and knees point away from
 * the body and toward the floor whichever way the limb is aimed - a hanging
 * arm and a waving one fold in opposite senses, so no single `bend` would do.
 * Scoring on both keeps the choice steady as a hand sweeps across in front of
 * him, where "outward" alone would flip the elbow over mid-gesture.
 */
export function reachOut(root: Pt, target: Pt, upper: number, lower: number, side: 1 | -1): { joint: Pt; end: Pt } {
  const a = reach(root, target, upper, lower, 1);
  const b = reach(root, target, upper, lower, -1);
  const score = (j: Pt) => side * j.x + j.y;
  return score(a.joint) >= score(b.joint) ? a : b;
}

/** A point turned about a centre, in degrees. */
export function rotate(p: Pt, about: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  const x = p.x - about.x;
  const y = p.y - about.y;
  return pt(about.x + x * Math.cos(a) - y * Math.sin(a), about.y + x * Math.sin(a) + y * Math.cos(a));
}

/**
 * A limb as angles: the upper bone's direction and the bend at the joint, in
 * radians. Limbs are blended in these, not in hand positions. Blending hand
 * positions and re-solving each frame lets the elbow jump from one side of
 * the arm to the other whenever the hand passes close to the shoulder; an
 * angle blend is continuous by construction, and swings in an arc as a real
 * arm does.
 */
export interface LimbAngles { upper: number; bend: number }

/** Which way the joint folds for this target: out from the body, and down. */
export function foldFor(root: Pt, target: Pt, upper: number, lower: number, side: 1 | -1): 1 | -1 {
  const a = reach(root, target, upper, lower, 1);
  const b = reach(root, target, upper, lower, -1);
  const score = (j: Pt) => side * j.x + j.y;
  return score(a.joint) >= score(b.joint) ? 1 : -1;
}

export function toAngles(root: Pt, target: Pt, upper: number, lower: number, fold: 1 | -1): LimbAngles {
  const { joint, end } = reach(root, target, upper, lower, fold);
  const u = Math.atan2(joint.y - root.y, joint.x - root.x);
  const f = Math.atan2(end.y - joint.y, end.x - joint.x);
  return { upper: u, bend: wrap(f - u) };
}

export function fromAngles(root: Pt, a: LimbAngles, upper: number, lower: number): { joint: Pt; end: Pt } {
  const joint = pt(root.x + upper * Math.cos(a.upper), root.y + upper * Math.sin(a.upper));
  const f = a.upper + a.bend;
  return { joint, end: pt(joint.x + lower * Math.cos(f), joint.y + lower * Math.sin(f)) };
}

/** An angle brought into -pi..pi. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Blend two limbs, straight through, never "the short way round".
 *
 * An elbow has a range, not a circle: a sharply folded arm sits near 180
 * degrees of bend, and the short way from there flips to the other side.
 * The upper arm's angle does go round, so its seam is put where that arm
 * never points: up and inward, at his own head. (Straight across the body
 * was tried first; a hug for "cools" points there.)
 */
export function blendAngles(a: LimbAngles, b: LimbAngles, t: number, side: 1 | -1): LimbAngles {
  // Up-left for the viewer's right arm, up-right for the left one.
  const start = side > 0 ? -0.75 * Math.PI : -0.25 * Math.PI;
  const TAU = 2 * Math.PI;
  const seam = (x: number) => ((((x - start) % TAU) + TAU) % TAU) + start;
  const ua = seam(a.upper);
  const ub = seam(b.upper);
  return { upper: ua + (ub - ua) * t, bend: a.bend + (b.bend - a.bend) * t };
}

// --- the pose at a moment ---------------------------------------------------

/** The change of pose under way at `time`: from, to, and how far (0-1, raw). */
export function changeAt(beats: Beat[], time: number): { from: Pose; to: Pose; raw: number } {
  const sorted = [...(beats.length ? beats : [{ at: 0, pose: 'stand' as PoseName }])].sort((a, b) => a.at - b.at);
  let i = -1;
  for (let k = 0; k < sorted.length; k++) if (time >= sorted[k].at) i = k;
  if (i <= 0) {
    const only = POSES[sorted[Math.max(0, i)].pose] || POSES.stand;
    return { from: only, to: only, raw: 1 };
  }
  return {
    from: POSES[sorted[i - 1].pose] || POSES.stand,
    to: POSES[sorted[i].pose] || POSES.stand,
    raw: clamp01((time - sorted[i].at) / POSE_SECONDS),
  };
}

/**
 * The pose at `time`: the latest beat's, eased in from the one before over
 * POSE_SECONDS. Numbers blend; the face and props switch halfway, the way a
 * drawn change of expression happens on one frame rather than as a morph.
 */
export function poseAt(beats: Beat[], time: number): Pose {
  const { from, to, raw } = changeAt(beats, time);
  if (raw >= 1) return to;
  const t = ease(raw);
  const late = raw >= 0.5;
  return {
    lHand: lerpPt(from.lHand, to.lHand, t),
    rHand: lerpPt(from.rHand, to.rHand, t),
    lean: lerp(from.lean, to.lean, t),
    crouch: lerp(from.crouch, to.crouch, t),
    headTilt: lerp(from.headTilt, to.headTilt, t),
    look: lerpPt(from.look, to.look, t),
    hatLift: lerp(from.hatLift, to.hatLift, t),
    eyes: late ? to.eyes : from.eyes,
    mouth: late ? to.mouth : from.mouth,
    brows: late ? to.brows : from.brows,
    prop: late ? to.prop : from.prop,
    finger: late ? to.finger : from.finger,
    wave: late ? to.wave : from.wave,
    jump: late ? to.jump : from.jump,
    // The bounce blends by weight rather than switching, so it winds down
    // instead of stopping mid-air.
    jumpWeight: lerp(from.jump ? 1 : 0, to.jump ? 1 : 0, t),
  };
}

// --- blinking and miming ----------------------------------------------------

/**
 * How closed his eyes are, 0 to 1. A blink every three seconds or so, never
 * on a rhythm - regular blinking is the tell of an animated face.
 */
export function blink(time: number): number {
  const CLOSE = 0.16;
  let at = 0.8;
  for (let i = 0; at < time + 1; i++) {
    if (time >= at && time <= at + CLOSE) {
      const x = (time - at) / CLOSE;
      return Math.sin(Math.PI * x);
    }
    at += 2.2 + hash01(i + 101) * 2.4;
  }
  return 0;
}

/**
 * He does not talk - a flapping mouth on a stick figure read as awkward. He
 * mimes instead: when the narration says an action word, he acts it out.
 * "Flows" sweeps a hand across, "spins" circles a finger, "rises" lifts a
 * palm, "heats" fans his face. What each one does to him:
 */
export interface Mime {
  /** Where the hands go instead of the pose's, with the body at rest. */
  lHand?: Pt;
  rHand?: Pt;
  finger?: 'l' | 'r';
  look?: Pt;
  eyes?: Eyes;
  mouth?: Mouth;
  brows?: Brows;
  prop?: Prop;
  hatLift?: number;
  headTilt?: number;
  /** A hop of the whole body, up, in sheet px. */
  jolt?: number;
}

/** How long a mime lasts from its word, in seconds. */
export const MIME_SECONDS = 1.6;

/**
 * The quickest a mime comes in; an arm with further to go takes longer (see
 * figureAt). 0.3s for everything made the long ones a whip.
 */
export const MIME_IN = 0.45;

const sweep = (t: number) => ease(t);

/** A point at `r` from a shoulder, `deg` round from pointing right (90 is down). */
const around = (c: Pt, deg: number, r: number): Pt =>
  pt(c.x + r * Math.cos((deg * Math.PI) / 180), c.y + r * Math.sin((deg * Math.PI) / 180));

/**
 * The mime for an action word, `since` seconds after it was said.
 *
 * Every hand target stays well clear of its shoulder (70px and more): close
 * in, the arm folds flat and the smallest movement of the hand swings it
 * through half a circle.
 */
export function mimeFor(kind: EffectKind, since: number): Mime {
  const t = clamp01(since / MIME_SECONDS);
  const osc = (hz: number) => Math.sin(since * Math.PI * 2 * hz);
  switch (kind) {
    case 'flow':
      // A hand drawn across in front of him, eyes following it.
      // Low across the chest: a path through the shoulder folds the arm flat
      // and flips the elbow over.
      // The sweep waits for the hand to arrive: both at once added up to a whip.
      const along = sweep((since - 0.25) / 1.0);
      return { rHand: lerpPt(pt(330, 780), pt(630, 740), along), look: pt(-1 + 2 * along, 0.2) };
    case 'rise':
      return { rHand: lerpPt(pt(530, 820), pt(548, 548), sweep(t * 1.3)), look: pt(0.3, -1), brows: 'up' };
    case 'fall':
      return { rHand: lerpPt(pt(548, 560), pt(528, 840), sweep(t * 1.3)), look: pt(0.3, 1) };
    case 'spin': {
      // Circles a finger, twice round.
      const a = since * Math.PI * 2 * 1.3;
      return { rHand: pt(560 + 40 * Math.cos(a), 600 + 40 * Math.sin(a)), finger: 'r', look: pt(0.7, -0.3) };
    }
    case 'heat':
      // Fans his face with a hand, and sweats.
      return { rHand: pt(528 + osc(2.2) * 16, 528), mouth: 'frown', brows: 'worried', prop: 'sweat', look: pt(-0.3, 0) };
    case 'cool':
      // Hugs himself against the cold.
      return { lHand: pt(412, 716), rHand: pt(340, 718), brows: 'worried', mouth: 'flat', headTilt: osc(3) * 2 };
    case 'impact': {
      // Claps once: the hands meet a third of the way in.
      const meet = Math.sin(Math.PI * clamp01(t / 0.45));
      return { lHand: pt(296 + 70 * meet, 772 - 22 * meet), rHand: pt(452 - 70 * meet, 772 - 22 * meet), eyes: 'wide', jolt: 10 * meet };
    }
    case 'spark':
      // A jolt: hat up, eyes wide, hands up - then he settles.
      return {
        lHand: pt(236, 600), rHand: pt(508, 600), eyes: 'wide', brows: 'up', mouth: 'o',
        hatLift: 40 * Math.sin(Math.PI * clamp01(since / 0.7)), jolt: 16 * Math.sin(Math.PI * clamp01(since / 0.5)),
      };
    case 'burst': {
      // Arms flung open: each swings out and up at nearly full length, from
      // low across his front to high at his side. As an arc, not a line - a
      // straight line from chest to side runs over the shoulder.
      const open = sweep((since - 0.2) / 0.7);
      return {
        lHand: around(SHEET.shoulderL, lerp(60, 205, open), 150),
        rHand: around(SHEET.shoulderR, lerp(120, -25, open), 150),
        eyes: 'wide',
        mouth: 'o',
      };
    }
    case 'glow':
      // Jazz hands, and a grin.
      return {
        lHand: pt(222 + osc(3) * 6, 610), rHand: pt(524 - osc(3) * 6, 610), mouth: 'grin', eyes: 'happy', prop: 'sparkle',
      };
    case 'drip':
      // A finger tapping down, drop by drop - down and back up again, not
      // snapping back to the top, which read as a glitch.
      return { rHand: pt(548, 646 - Math.cos(since * Math.PI * 2 * 1.4) * 44), finger: 'r', look: pt(0.5, 1) };
    case 'wobble':
      // Both hands shaking, side to side.
      return { lHand: pt(228 + osc(2.6) * 16, 764), rHand: pt(520 + osc(2.6) * 16, 764), headTilt: osc(2.6) * 3 };
    default:
      return {};
  }
}

/** The mime running at `time`, and how far it is blended in (0 to 1). */
export function mimeAt(words: WordTiming[], time: number): { mime: Mime; weight: number; kind: EffectKind | null; since: number } {
  // The effects' own pacing: a mime needs room, and four a scene is plenty.
  for (const e of detectEffects(words, Infinity).reverse()) {
    const since = time - e.at;
    if (since < 0 || since > MIME_SECONDS) continue;
    return { mime: mimeFor(e.kind, since), weight: envelope(since, MIME_SECONDS, MIME_IN, 0.5), kind: e.kind, since };
  }
  return { mime: {}, weight: 0, kind: null, since: 0 };
}

// --- the whole figure at a moment ------------------------------------------

export interface Figure {
  /** Where the upper body has moved to: the hips' shift and the lean. */
  body: { dx: number; dy: number; lean: number };
  headTilt: number;
  look: Pt;
  eyes: Eyes;
  /** 0 open, 1 shut. */
  eyesShut: number;
  mouth: Mouth;
  brows: Brows;
  hatLift: number;
  prop: Prop;
  finger: 'none' | 'l' | 'r';
  arms: { l: { shoulder: Pt; elbow: Pt; hand: Pt }; r: { shoulder: Pt; elbow: Pt; hand: Pt } };
  legs: { l: { hip: Pt; knee: Pt; foot: Pt }; r: { hip: Pt; knee: Pt; foot: Pt } };
}

/**
 * Every joint at `time`, in sheet coordinates. Upper-body points are already
 * moved by the lean and the bob, so the drawing only has to join them up.
 */
export function figureAt(beats: Beat[], words: WordTiming[], time: number): Figure {
  const p = poseAt(beats, time);
  const head = poseAt(beats, time - HEAD_LAG);
  const change = changeAt(beats, time - HAND_LAG);
  const acting = mimeAt(words, time);
  const { mime, weight: w } = acting;
  const face = w > 0.5;

  // Breathing and a slow sway: slow enough to be felt rather than seen.
  const breath = Math.sin(time * Math.PI * 2 * 0.25) * 3;
  // A soft bounce rather than a hop off a hard floor: sin squared is still at
  // the bottom as well as the top, where abs(sin) had a corner.
  const bounce = Math.pow(Math.sin(time * Math.PI * 1.1), 2) * 46 * p.jumpWeight;
  const jolt = (mime.jolt || 0) * w;

  const dy = p.crouch + breath * 0.4 - bounce - jolt;
  const dx = 0;
  const lean = p.lean + Math.sin(time * Math.PI * 2 * 0.15) * 0.8;

  const move = (q: Pt): Pt => rotate(pt(q.x + dx, q.y + dy), pt(SHEET.hips.x + dx, SHEET.hips.y + dy), lean);

  // Arms are solved at rest, blended as angles (see LimbAngles), and only
  // then carried along with the body - moving them as a whole keeps every
  // bone its length.
  const UA = SHEET.upperArm;
  const FA = SHEET.forearm;
  const handOf = (pose: Pose, side: 1 | -1, at: number): Pt => {
    if (side < 0) return pose.lHand;
    const wave = pose.wave ? Math.sin(at * Math.PI * 2 * 1.2) * 24 : 0;
    return pt(pose.rHand.x + wave, pose.rHand.y + Math.abs(wave) * 0.15);
  };
  const arm = (side: 1 | -1) => {
    const shoulder = side < 0 ? SHEET.shoulderL : SHEET.shoulderR;
    const solve = (target: Pt, fold?: 1 | -1) =>
      toAngles(shoulder, target, UA, FA, fold ?? foldFor(shoulder, target, UA, FA, side));
    // The posed arm at any moment, trailing the body by HAND_LAG.
    const posed = (at: number) => {
      const c = changeAt(beats, at - HAND_LAG);
      return blendAngles(solve(handOf(c.from, side, at)), solve(handOf(c.to, side, at)), ease(c.raw), side);
    };
    let angles = posed(time);

    const mimed = side < 0 ? mime.lHand : mime.rHand;
    if (mimed && acting.kind) {
      // The elbow goes to whichever side is nearer where the arm already was
      // when the mime began, and keeps it however the hand travels. Choosing
      // afresh - every frame, or by a fixed rule - either flipped it over
      // mid-gesture or straightened the arm and refolded it the other way.
      const first = mimeFor(acting.kind, 0);
      const start = (side < 0 ? first.lHand : first.rHand) || mimed;
      const was = posed(time - acting.since);
      const gap = (a: LimbAngles) => {
        const b = blendAngles(was, a, 1, side);
        const w0 = blendAngles(was, was, 0, side);
        return Math.abs(b.upper - w0.upper) + Math.abs(b.bend - w0.bend);
      };
      const g1 = gap(solve(start, 1));
      const g2 = gap(solve(start, -1));
      const fold: 1 | -1 = g1 <= g2 ? 1 : -1;
      // And it takes its time over a long way: an arm going from his chin to
      // across his belly turns most of a circle, and gets up to 0.8s for it.
      const rise = Math.min(0.8, Math.max(MIME_IN, 0.3 + 0.1 * Math.min(g1, g2)));
      angles = blendAngles(angles, solve(mimed, fold), envelope(acting.since, MIME_SECONDS, rise, 0.5), side);
    }
    const { joint, end } = fromAngles(shoulder, angles, UA, FA);
    return { shoulder: move(shoulder), elbow: move(joint), hand: move(end) };
  };
  const armL = arm(-1);
  const armR = arm(1);

  // Feet stay planted, lifting only with the bounce; knees fold outward.
  const hipL = move(SHEET.hipL);
  const hipR = move(SHEET.hipR);
  const lift = bounce * 0.55;
  const legL = reachOut(hipL, pt(SHEET.footL.x, SHEET.footL.y - lift), SHEET.thigh, SHEET.shin, -1);
  const legR = reachOut(hipR, pt(SHEET.footR.x, SHEET.footR.y - lift), SHEET.thigh, SHEET.shin, 1);

  return {
    body: { dx, dy, lean },
    headTilt: head.headTilt + (mime.headTilt || 0) * w,
    look: mime.look ? lerpPt(head.look, mime.look, w) : head.look,
    eyes: (face && mime.eyes) || p.eyes,
    eyesShut: (face && mime.eyes === 'happy') || p.eyes === 'happy' ? 0 : blink(time),
    mouth: (face && mime.mouth) || p.mouth,
    brows: (face && mime.brows) || p.brows,
    hatLift: Math.max(p.hatLift, (mime.hatLift || 0) * w),
    prop: (face && mime.prop) || p.prop,
    finger: (face && mime.finger) || p.finger,
    arms: {
      l: armL,
      r: armR,
    },
    legs: {
      l: { hip: hipL, knee: legL.joint, foot: legL.end },
      r: { hip: hipR, knee: legR.joint, foot: legR.end },
    },
  };
}
