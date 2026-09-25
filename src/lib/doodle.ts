// ---------------------------------------------------------------------------
// Doodle mode: which scenes get a drawing of the engineer, and how wild each
// one is allowed to be.
//
// Shared by the server, which writes the prompts, and the browser, which shows
// the plan and the price before anything is drawn. Pure logic on purpose - no
// React, no DOM, and every import carries its .ts extension, so Node can load
// it through type stripping exactly as it loads the figure engine.
// ---------------------------------------------------------------------------

import type { SceneKind, ScriptLine } from './types.ts';

/** How much stress, sweat and sparks a scene is drawn with. */
export type DoodleEnergy = 'calm' | 'lively' | 'chaotic';

export const DOODLE_ENERGIES: { id: DoodleEnergy; label: string; hint: string }[] = [
  { id: 'calm', label: 'Calm', hint: 'Clear poses, no stress marks. For careful teaching.' },
  { id: 'lively', label: 'Lively', hint: 'Expressive, with a sweat drop or motion lines where it helps.' },
  { id: 'chaotic', label: 'Chaotic', hint: 'Full cartoon: zaps, squiggles, spiral eyes. Hooks and reveals only.' },
];

export const DEFAULT_DOODLE_ENERGY: DoodleEnergy = 'lively';

const RANK: Record<DoodleEnergy, number> = { calm: 0, lively: 1, chaotic: 2 };
const BY_RANK: DoodleEnergy[] = ['calm', 'lively', 'chaotic'];

/**
 * The most a scene of each kind may have, whatever the dial says.
 *
 * The mascot test drew its "teaching" beat with sweat drops and a sparking
 * probe, because the look asked for chaos in every scene. A sparking probe
 * while the explanation is on screen tells the viewer something is dangerous
 * when nothing is - so scenes that teach are held calm even on "chaotic", and
 * only the beats built for a reaction (the hook, the reveal) may go all the way.
 */
const CEILING: Partial<Record<SceneKind, DoodleEnergy>> = {
  explain: 'calm',
  recap: 'calm',
  process: 'calm',
  timeline: 'calm',
  grid: 'calm',
  versus: 'calm',
  intro: 'lively',
  outro: 'lively',
  title: 'lively',
  metaphor: 'lively',
  question: 'lively',
  options: 'lively',
  countdown: 'lively',
  hook: 'chaotic',
  answer: 'chaotic',
};

/** What the dial becomes for one scene: the lower of the dial and the scene's ceiling. */
export function energyFor(kind: SceneKind | string, requested: DoodleEnergy | string | undefined): DoodleEnergy {
  const asked: DoodleEnergy = requested && requested in RANK ? (requested as DoodleEnergy) : DEFAULT_DOODLE_ENERGY;
  const ceiling = CEILING[kind as SceneKind] || 'lively';
  return BY_RANK[Math.min(RANK[asked], RANK[ceiling])];
}

/**
 * Explainer layouts that are a picture in their own right. A doodle beside a
 * diagram is two pictures competing for one frame.
 */
const SELF_ILLUSTRATED: SceneKind[] = ['diagram', 'motion'];

/**
 * Does this scene get a drawing of the engineer?
 *
 * Not when it already shows its own graphic. A computed circuit, a chart or a
 * sketch is there because it is accurate, and a cartoon beside it would pull
 * the eye away from the one thing on screen that has been checked.
 */
export function wantsDoodle(line: ScriptLine | null | undefined, showVisuals = true): boolean {
  if (!line) return false;
  if (SELF_ILLUSTRATED.includes(line.kind)) return false;
  if (showVisuals && line.visual && line.visual.kind && line.visual.kind !== 'none') return false;
  return true;
}

/** The scenes of a script that get a drawing, by index. */
export function doodleScenes(script: ScriptLine[] | null | undefined, showVisuals = true): number[] {
  return (Array.isArray(script) ? script : [])
    .map((line, i) => (wantsDoodle(line, showVisuals) ? i : -1))
    .filter((i) => i >= 0);
}

/** One scene, directed: what the engineer does, feels and holds, and the joke. */
export interface DoodleDirection {
  action: string;
  emotion: string;
  props: string;
  /** 'none' for a scene with no joke in it. */
  gag: string;
}

export const DOODLE_FIELD_LIMITS: Record<keyof DoodleDirection, number> = {
  action: 160,
  emotion: 70,
  props: 200,
  gag: 120,
};

const clean = (value: unknown, max: number): string => {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s\S*$/, '').replace(/[,;:\s]+$/, '');
};

/** A direction with every field present, trimmed and within its length. Null if there is no action. */
export function tidyDirection(raw: unknown): DoodleDirection | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const action = clean(r.action, DOODLE_FIELD_LIMITS.action);
  if (!action) return null;
  return {
    action,
    emotion: clean(r.emotion, DOODLE_FIELD_LIMITS.emotion) || 'friendly',
    props: clean(r.props, DOODLE_FIELD_LIMITS.props),
    gag: clean(r.gag, DOODLE_FIELD_LIMITS.gag) || 'none',
  };
}
