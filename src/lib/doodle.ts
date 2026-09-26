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

/**
 * What a scene's drawing is OF.
 *
 *   mascot       - the engineer, reacting or doing something. For the beats
 *                  that need a face: the hook, the question, the reveal.
 *   illustration - the thing itself, with nobody in it: a transformer on a
 *                  pole, electrons drifting through a wire. For the beats that
 *                  explain, where a face would only be in the way.
 *
 * A video that is nothing but the engineer is a video about the engineer.
 */
export type DoodleSubject = 'mascot' | 'illustration';

export const DOODLE_SUBJECTS: { id: DoodleSubject; label: string }[] = [
  { id: 'mascot', label: 'The engineer' },
  { id: 'illustration', label: 'An illustration' },
];

/**
 * The animated engineer's poses, by name. The joints are in engineer-rig.ts;
 * the names live here too because the server loads this file without a
 * bundler, and a test holds the two lists together.
 */
export const ENGINEER_POSES = [
  'stand', 'wave', 'point', 'idea', 'think', 'shock', 'cheer', 'teach', 'worried', 'shrug',
] as const;

export type EngineerPose = (typeof ENGINEER_POSES)[number];

export const POSE_LABELS: Record<EngineerPose, string> = {
  stand: 'Standing',
  wave: 'Waving',
  point: 'Pointing',
  idea: 'Has an idea',
  think: 'Thinking',
  shock: 'Shocked',
  cheer: 'Cheering',
  teach: 'Explaining',
  worried: 'Worried',
  shrug: 'Shrugging',
};

/** One scene, directed: what is drawn, what it does or shows, and the joke. */
export interface DoodleDirection {
  /**
   * The engineer only: his pose when he is animated. Optional because
   * directions written before he was animated lack it - poseFor() reads one
   * out of the words instead.
   */
  pose?: EngineerPose;
  /** Optional because directions written before illustrations existed lack it - they were all the engineer. */
  subject?: DoodleSubject;
  /** The engineer: what they are doing. An illustration: what the picture shows. */
  action: string;
  /** The engineer: how they feel. An illustration: its mood, or empty. */
  emotion: string;
  props: string;
  /** 'none' for a scene with no joke in it. */
  gag: string;
}

/** The written fields of a direction. */
export type TextField = 'action' | 'emotion' | 'props' | 'gag';

/** The field labels change with the subject, so the boxes always say what goes in them. */
export function fieldLabels(subject: DoodleSubject | undefined): Record<TextField, string> {
  return subject === 'illustration'
    ? { action: 'Shows', emotion: 'Mood', props: 'Also in it', gag: 'Gag' }
    : { action: 'Doing', emotion: 'Feeling', props: 'With', gag: 'Gag' };
}

export const DOODLE_FIELD_LIMITS: Record<TextField, number> = {
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
  const subject: DoodleSubject = r.subject === 'illustration' ? 'illustration' : 'mascot';
  const pose = ENGINEER_POSES.includes(r.pose as EngineerPose) ? (r.pose as EngineerPose) : undefined;
  return {
    subject,
    ...(subject === 'mascot' && pose ? { pose } : {}),
    action,
    // An illustration has no face to feel anything; an empty mood is allowed.
    emotion: clean(r.emotion, DOODLE_FIELD_LIMITS.emotion) || (subject === 'mascot' ? 'friendly' : ''),
    props: clean(r.props, DOODLE_FIELD_LIMITS.props),
    gag: clean(r.gag, DOODLE_FIELD_LIMITS.gag) || 'none',
  };
}

// --- the animated engineer ----------------------------------------------------

/** Words in a direction that say which pose it means, most telling first. */
const POSE_WORDS: [RegExp, EngineerPose][] = [
  // Before 'idea', which "no idea" would otherwise match.
  [/\b(shrug|who knows|no idea|dunno)/i, 'shrug'],
  [/\b(idea|eureka|realis|realiz|light ?bulb)/i, 'idea'],
  [/\b(shock|alarm|surpris|startl|stunned|jump(s|ed)? back|gasp|horrif|whoa)/i, 'shock'],
  [/\b(cheer|celebrat|triumph|delight|thrill|overjoy|victor|punch(es)? the air|arms? up)/i, 'cheer'],
  [/\b(worr|nervous|anxious|scared|afraid|sweat|uneasy|dread)/i, 'worried'],
  [/\b(puzzl|confus|curious|wonder|ponder|think|scratch|unsure|doubt|hmm)/i, 'think'],
  [/\b(wav(e|es|ing)\b|greet|hello|goodbye|bye\b|sign(s|ing)? off)/i, 'wave'],
  [/\b(point|gestur|look(s|ing)? at|indicat)/i, 'point'],
  [/\b(explain|teach|present|demonstrat|show(s|ing)?)/i, 'teach'],
];

/** The pose a scene of this kind takes when nothing else says. */
const POSE_BY_KIND: Partial<Record<SceneKind, EngineerPose>> = {
  intro: 'wave',
  hook: 'shock',
  question: 'think',
  options: 'think',
  countdown: 'think',
  answer: 'cheer',
  explain: 'teach',
  outro: 'wave',
  title: 'wave',
  recap: 'teach',
  metaphor: 'idea',
};

/**
 * The engineer's pose for a scene: the one Gemini chose, or failing that the
 * one its words describe - feeling first, then what he is doing - or failing
 * that the usual one for the kind of scene.
 */
export function poseFor(direction: DoodleDirection | null | undefined, kind: SceneKind | string): EngineerPose {
  if (direction && direction.pose && ENGINEER_POSES.includes(direction.pose)) return direction.pose;
  for (const text of [direction && direction.emotion, direction && direction.action]) {
    if (!text) continue;
    for (const [pattern, pose] of POSE_WORDS) if (pattern.test(text)) return pose;
  }
  return POSE_BY_KIND[kind as SceneKind] || 'stand';
}

/** How one doodle scene is staged. */
export interface DoodleStaging {
  /** The animated engineer is in it. */
  engineer: boolean;
  /** Its drawing is the things beside him, placed beside him. */
  beside: boolean;
  /** Its drawing fills the picture on its own: an illustration, or a still of the engineer. */
  still: boolean;
}

const NOTHING: DoodleStaging = { engineer: false, beside: false, still: false };

/**
 * What a scene shows, in one place, so the video, the preview and the panel
 * never disagree.
 *
 *   An engineer scene, animated: the engineer, and beside him the drawing of
 *   whatever is with him, if there is one. Directing is enough for him to be
 *   there; nothing has to be drawn.
 *
 *   An engineer scene drawn before he was animated has him in the picture, so
 *   it is shown as that still, with no second engineer beside it - until it
 *   is redrawn.
 *
 *   Everything else: the drawing, if there is one.
 */
export function stagingFor(line: ScriptLine | null | undefined, showVisuals = true, animated = true): DoodleStaging {
  if (!line || !wantsDoodle(line, showVisuals)) return NOTHING;
  const d = line.doodle;
  const engineerScene = Boolean(d) && (d!.subject || 'mascot') === 'mascot';
  if (animated && engineerScene) {
    if (line.doodleSrc && !line.doodleProps) return { engineer: false, beside: false, still: true };
    return { engineer: true, beside: Boolean(line.doodleSrc), still: false };
  }
  return { engineer: false, beside: false, still: Boolean(line.doodleSrc) };
}

/**
 * Whether a directed scene has a picture still to draw. An animated engineer
 * with nothing named beside him has none: he is the picture, for free.
 */
export function needsDrawing(line: ScriptLine | null | undefined, animated = true): boolean {
  const d = line && line.doodle;
  if (!d) return false;
  if (animated && (d.subject || 'mascot') === 'mascot') {
    if (!d.props.trim()) return false;
    // Drawn with the engineer in it, before he was animated: draw it again,
    // as the things beside him.
    return !line!.doodleSrc || !line!.doodleProps;
  }
  // With the animation off, an engineer scene drawn for him to stand beside
  // has no engineer in it at all: draw it again, with him.
  if ((d.subject || 'mascot') === 'mascot' && line!.doodleProps) return true;
  return !line!.doodleSrc;
}
