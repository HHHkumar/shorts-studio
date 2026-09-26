import type { WordTiming } from './types';
import { effectForWord, type EffectKind } from './motion-lexicon';

// ---------------------------------------------------------------------------
// The channel's engineer, as a puppet.
//
// The drawings Gemini makes are stills: one pose, one expression, per scene.
// This is the same character rebuilt from lines - a circle for a head, a hard
// hat, a black T-shirt, stick limbs - so that the renderer can move him: he
// talks when the voice talks, blinks, waves, points at the diagram, jumps
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
};

const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });

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

/** How long a change of pose takes, in seconds. */
export const POSE_SECONDS = 0.42;

// --- maths ------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => pt(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Overshoots a little and settles: a limb thrown, not slid. */
export function easeOutBack(t: number): number {
  const c1 = 1.5;
  const c3 = c1 + 1;
  const u = clamp01(t) - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** A repeatable 0-1 number for an integer, for blinks and flaps. */
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
 * The same reach, with the joint folding away from the body: `side` -1 for
 * his right (the viewer's left), 1 for the other. Elbows and knees point
 * outward whichever way the limb is aimed - a hanging arm and a waving one
 * fold in opposite senses, so no single `bend` would do for both.
 */
export function reachOut(root: Pt, target: Pt, upper: number, lower: number, side: 1 | -1): { joint: Pt; end: Pt } {
  const a = reach(root, target, upper, lower, 1);
  const b = reach(root, target, upper, lower, -1);
  return side * a.joint.x >= side * b.joint.x ? a : b;
}

/** A point turned about a centre, in degrees. */
export function rotate(p: Pt, about: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  const x = p.x - about.x;
  const y = p.y - about.y;
  return pt(about.x + x * Math.cos(a) - y * Math.sin(a), about.y + x * Math.sin(a) + y * Math.cos(a));
}

// --- the pose at a moment ---------------------------------------------------

/**
 * The pose at `time`: the latest beat's, eased in from the one before over
 * POSE_SECONDS. Numbers blend; the face and props switch halfway, the way a
 * drawn change of expression happens on one frame rather than as a morph.
 */
export function poseAt(beats: Beat[], time: number): Pose {
  const sorted = [...(beats.length ? beats : [{ at: 0, pose: 'stand' as PoseName }])].sort((a, b) => a.at - b.at);
  let i = -1;
  for (let k = 0; k < sorted.length; k++) if (time >= sorted[k].at) i = k;
  if (i <= 0) return POSES[sorted[Math.max(0, i)].pose] || POSES.stand;

  const from = POSES[sorted[i - 1].pose] || POSES.stand;
  const to = POSES[sorted[i].pose] || POSES.stand;
  const raw = clamp01((time - sorted[i].at) / POSE_SECONDS);
  if (raw >= 1) return to;
  const t = easeOutBack(raw);
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
  };
}

// --- talking, blinking, reacting -------------------------------------------

/** Rough syllables in a word: runs of vowels, at least one. */
export function syllables(word: string): number {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * How open his mouth is, 0 to 1: one flap per syllable of the word being
 * said, closed between words. Not lip-sync - a stick figure has no lips - but
 * the rhythm matches the voice, which is what the eye checks.
 */
export function mouthOpen(words: WordTiming[], time: number): number {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (time < w.start || time > w.end) continue;
    const span = Math.max(0.05, w.end - w.start);
    const n = syllables(w.word);
    const phase = ((time - w.start) / span) * n;
    const within = phase - Math.floor(phase);
    // Some syllables open wider than others, or the flap reads as a machine.
    const size = 0.55 + 0.45 * hash01(i * 7 + Math.floor(phase));
    return Math.pow(Math.sin(Math.PI * within), 0.8) * size;
  }
  return 0;
}

/**
 * How closed his eyes are, 0 to 1. A blink every three seconds or so, never
 * on a rhythm - regular blinking is the tell of an animated face.
 */
export function blink(time: number): number {
  const CLOSE = 0.14;
  let at = 0.8;
  for (let i = 0; at < time + 1; i++) {
    if (time >= at && time <= at + CLOSE) {
      return 1 - Math.abs((time - at) / CLOSE - 0.5) * 2;
    }
    at += 2.2 + hash01(i + 101) * 2.4;
  }
  return 0;
}

/** A reaction to an action word just spoken, laid over the pose. */
export interface Reaction {
  hatLift: number;
  headTilt: number;
  look: Pt | null;
  eyes: Eyes | null;
  /** Sideways shake of the whole body, in sheet px. */
  shake: number;
  prop: Prop | null;
}

const CALM: Reaction = { hatLift: 0, headTilt: 0, look: null, eyes: null, shake: 0, prop: null };

/** How long a reaction lasts after its word, in seconds. */
export const REACT_SECONDS = 0.9;

/**
 * What the latest action word does to him. A spark jolts him and his hat
 * hops; "rises" makes him look up; "heats" brings out the sweat.
 */
export function reactionAt(words: WordTiming[], time: number): Reaction {
  let kind: EffectKind | null = null;
  let since = 0;
  for (const w of words) {
    if (w.start > time) break;
    const k = effectForWord(w.word);
    if (k && time - w.start <= REACT_SECONDS) {
      kind = k;
      since = time - w.start;
    }
  }
  if (!kind) return CALM;
  const decay = 1 - since / REACT_SECONDS;
  switch (kind) {
    case 'spark':
    case 'impact':
    case 'burst':
      return {
        ...CALM,
        hatLift: 34 * Math.sin(Math.min(1, since / 0.45) * Math.PI),
        eyes: since < 0.5 ? 'wide' : null,
        shake: Math.sin(since * Math.PI * 2 * 11) * 7 * decay,
      };
    case 'rise':
    case 'glow':
      return { ...CALM, look: pt(0, -1) };
    case 'fall':
    case 'drip':
      return { ...CALM, look: pt(0, 1) };
    case 'heat':
      return { ...CALM, prop: 'sweat' };
    case 'cool':
      return { ...CALM, shake: Math.sin(since * Math.PI * 2 * 14) * 4 * decay };
    case 'spin':
    case 'wobble':
      return { ...CALM, headTilt: Math.sin(since * Math.PI * 2 * 1.6) * 9 * decay };
    case 'flow':
      return { ...CALM, look: pt(-1 + 2 * clamp01(since / REACT_SECONDS), 0) };
    default:
      return CALM;
  }
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
  /** 0 closed, 1 wide: the talking flap. */
  talk: number;
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
  const react = reactionAt(words, time);
  const talk = mouthOpen(words, time);

  // Breathing, and a nod on the beat of the speech.
  const breath = Math.sin(time * Math.PI * 2 * 0.28) * 3;
  const nod = talk * 4;
  const hop = p.jump ? Math.abs(Math.sin(time * Math.PI * 2.4)) * 70 : 0;

  const dy = p.crouch + breath * 0.4 - hop;
  const dx = react.shake;
  const lean = p.lean + Math.sin(time * Math.PI * 2 * 0.17) * 0.8;

  const move = (q: Pt): Pt => rotate(pt(q.x + dx, q.y + dy), pt(SHEET.hips.x + dx, SHEET.hips.y + dy), lean);

  // The waving hand swings from the elbow; everything else reaches as posed.
  const wave = p.wave ? Math.sin(time * Math.PI * 2 * 1.8) * 28 : 0;
  const lTarget = move(p.lHand);
  const rTarget = move(pt(p.rHand.x + wave, p.rHand.y + Math.abs(wave) * 0.2));
  const shoulderL = move(SHEET.shoulderL);
  const shoulderR = move(SHEET.shoulderR);
  const armL = reachOut(shoulderL, lTarget, SHEET.upperArm, SHEET.forearm, -1);
  const armR = reachOut(shoulderR, rTarget, SHEET.upperArm, SHEET.forearm, 1);

  // Feet stay planted unless he has jumped; knees fold outward.
  const hipL = move(SHEET.hipL);
  const hipR = move(SHEET.hipR);
  const lift = Math.max(0, hop - 24);
  const legL = reachOut(hipL, pt(SHEET.footL.x, SHEET.footL.y - lift), SHEET.thigh, SHEET.shin, -1);
  const legR = reachOut(hipR, pt(SHEET.footR.x, SHEET.footR.y - lift), SHEET.thigh, SHEET.shin, 1);

  return {
    body: { dx, dy, lean },
    headTilt: p.headTilt + react.headTilt + nod * 0.5,
    look: react.look || p.look,
    eyes: react.eyes || p.eyes,
    eyesShut: p.eyes === 'happy' ? 0 : blink(time),
    mouth: p.mouth,
    talk,
    brows: p.brows,
    hatLift: Math.max(p.hatLift, react.hatLift),
    prop: react.prop || p.prop,
    finger: p.finger,
    arms: {
      l: { shoulder: shoulderL, elbow: armL.joint, hand: armL.end },
      r: { shoulder: shoulderR, elbow: armR.joint, hand: armR.end },
    },
    legs: {
      l: { hip: hipL, knee: legL.joint, foot: legL.end },
      r: { hip: hipR, knee: legR.joint, foot: legR.end },
    },
  };
}
