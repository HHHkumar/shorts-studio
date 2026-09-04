import type { WordTiming } from './types';

// ---------------------------------------------------------------------------
// Reading the narration for things that should move.
//
// Every explainer layout so far animates once on entry and then freezes. On a
// twenty second scene that is about one second of movement and nineteen of a
// still image, which is exactly what "minimal and unconvincing" means.
//
// The fix is not more authored animation - a storyboard cannot be trusted to
// choreograph twenty scenes, and asking it to would make every generation
// slower and more fragile. The narration ALREADY says what is happening. When
// the voice says "the steam flows into the turbine", something should flow. So
// the words are read, matched against a fixed vocabulary of physical verbs, and
// the matching effect is fired at the exact moment the word is spoken.
//
// Three rules keep it from becoming a mess:
//
//   * Fixed vocabulary. No effect exists that a word here cannot name.
//   * Spaced out. Two effects a second reads as a screensaver, not an
//     explanation, so a new one has to wait.
//   * Behind the content. These sit under the text and never compete with it.
//     An effect that makes a caption harder to read has cost more than it gave.
// ---------------------------------------------------------------------------

export type EffectKind =
  | 'flow'    // something travelling across, left to right
  | 'rise'    // upward drift: growth, increase, climbing
  | 'fall'    // downward drift: loss, decrease, sinking
  | 'spin'    // rotation: wheels, turbines, orbits
  | 'heat'    // warm glow swelling and fading
  | 'cool'    // cold tint settling
  | 'impact'  // a shove and a flash: collisions, blocks, walls
  | 'wobble'  // oscillation: waves, vibration, alternation
  | 'spark'   // electrical flecks
  | 'burst'   // particles thrown outward: release, escape, explosion
  | 'glow'    // a radial bloom
  | 'drip';   // droplets falling: water, rain, liquid

/**
 * The words that fire each effect, as stems.
 *
 * Matched by prefix against the spoken word, so "flow" catches "flows",
 * "flowing" and "flowed" without listing all three. Kept deliberately concrete:
 * these are physical happenings, not abstractions. A stem that is also a very
 * common ordinary word ("light", "up", "down") is left out however tempting,
 * because a false fire is worse than a missed one - the viewer sees something
 * happen that the narration did not mean.
 */
const VOCABULARY: Record<EffectKind, string[]> = {
  flow: ['flow', 'pour', 'travel', 'carri', 'carry', 'circulat', 'pump', 'stream',
    'feeds', 'transport', 'convey', 'deliver', 'channel'],
  rise: ['rise', 'rises', 'rising', 'rose', 'climb', 'ascend', 'increas', 'grow',
    'expand', 'swell', 'higher', 'upward', 'lift'],
  fall: ['fall', 'fell', 'drop', 'sink', 'sank', 'descend', 'decreas', 'shrink',
    'collaps', 'plunge', 'downward', 'lower'],
  spin: ['spin', 'spun', 'rotat', 'revolv', 'orbit', 'turbine', 'wheel', 'whirl',
    'twist', 'swirl'],
  heat: ['heat', 'hot', 'burn', 'warm', 'thermal', 'combust', 'boil', 'flame',
    'furnace', 'ignite', 'scorch'],
  cool: ['cool', 'cold', 'freez', 'froze', 'chill', 'condens', 'frost'],
  impact: ['collid', 'crash', 'impact', 'slam', 'smash', 'strike', 'struck',
    'block', 'barrier', 'obstacl', 'bounce', 'rebound'],
  wobble: ['vibrat', 'oscillat', 'alternat', 'resonat', 'wobbl', 'shake', 'shook',
    'tremor', 'flutter', 'pulsat'],
  spark: ['spark', 'electric', 'voltag', 'charg', 'lightning', 'discharg', 'arc',
    'circuit', 'amp', 'watt'],
  burst: ['explod', 'burst', 'erupt', 'blast', 'escap', 'eject', 'release',
    'shatter', 'rupture'],
  glow: ['glow', 'shine', 'shone', 'bright', 'illuminat', 'radiat', 'beam',
    'gleam', 'luminous'],
  drip: ['droplet', 'rain', 'drip', 'liquid', 'moist', 'condensate', 'leak',
    'splash', 'flood'],
};

/** How long each effect stays on screen once it fires, in seconds. */
export const EFFECT_SECONDS: Record<EffectKind, number> = {
  flow: 2.6,
  rise: 2.2,
  fall: 2.2,
  spin: 2.4,
  heat: 2.4,
  cool: 2.4,
  impact: 0.9,
  wobble: 2.2,
  spark: 1.6,
  burst: 1.6,
  glow: 2.0,
  drip: 2.6,
};

/** One effect, and the second of the scene it starts at. */
export interface TimedEffect {
  kind: EffectKind;
  /** Seconds from the start of the scene. */
  at: number;
  /** The spoken word that fired it. Shown in the editor, never on screen. */
  word: string;
}

/** At most this many in one scene, however many trigger words appear. */
const MAX_PER_SCENE = 4;
/** And never two closer together than this, or it reads as noise. */
const MIN_GAP_SECONDS = 2.2;

// Coerced, not just typed: word timings arrive as JSON from the voice service
// and from saved scripts, so a null word here is reachable at runtime whatever
// the type says.
const normalise = (s: unknown): string => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Which effect this spoken word fires, if any. */
export function effectForWord(word: string): EffectKind | null {
  const w = normalise(word);
  // Short words are almost all common English and match stems by accident.
  if (w.length < 3) return null;
  for (const kind of Object.keys(VOCABULARY) as EffectKind[]) {
    for (const stem of VOCABULARY[kind]) {
      if (w.startsWith(stem)) return kind;
    }
  }
  return null;
}

/**
 * Read a scene's narration and decide what should happen, and when.
 *
 * Needs real word timings to be worth anything: the whole point is that the
 * flow starts on the word "flows". Without them it returns nothing rather than
 * guessing, because an effect at the wrong moment is worse than none - it makes
 * the video look like it is reacting to something the viewer cannot hear.
 */
export function detectEffects(words: WordTiming[], sceneSeconds: number): TimedEffect[] {
  if (!Array.isArray(words) || !words.length) return [];

  const found: TimedEffect[] = [];
  for (const timing of words) {
    if (found.length >= MAX_PER_SCENE) break;
    const kind = effectForWord(timing.word);
    if (!kind) continue;

    const at = Number(timing.start);
    if (!Number.isFinite(at) || at < 0) continue;
    // No room left to play before the scene cuts.
    if (at > sceneSeconds - 0.6) break;

    const previous = found[found.length - 1];
    if (previous && at - previous.at < MIN_GAP_SECONDS) continue;

    found.push({ kind, at, word: timing.word });
  }
  return found;
}

/**
 * How far through an effect we are at this moment: 0 before, 1 at the end.
 *
 * Returns null when it is not running, so a caller can skip the work entirely
 * rather than render a fully transparent layer on every frame of every scene.
 */
export function effectProgress(effect: TimedEffect, time: number): number | null {
  const span = EFFECT_SECONDS[effect.kind] || 2;
  const t = (time - effect.at) / span;
  if (t < 0 || t > 1) return null;
  return t;
}

/** A 0-1 envelope that rises, holds, and falls, so nothing pops on or off. */
export function envelope(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t > 0.7) return Math.max(0, (1 - t) / 0.3);
  return 1;
}

/**
 * Which motion words this narration contains, for the editor.
 *
 * Same vocabulary the renderer uses, so what the editor promises is what the
 * video does.
 */
export function motionWordsIn(narration: string): { word: string; kind: EffectKind }[] {
  const out: { word: string; kind: EffectKind }[] = [];
  for (const word of String(narration || '').split(/\s+/)) {
    const kind = effectForWord(word);
    if (kind) out.push({ word: word.replace(/[^A-Za-z0-9-]/g, ''), kind });
  }
  return out;
}
