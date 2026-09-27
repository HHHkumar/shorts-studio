// ---------------------------------------------------------------------------
// Adding or removing one scene without losing the voiceover of the others.
//
// Clips are keyed by scene position, so a scene put in before the outro moves
// the outro's clip along by one. Wiping every clip, as a reorder has to, would
// cost a whole new voiceover for one added line; shifting them costs only the
// new scene, which the Voice step then records on its own.
// ---------------------------------------------------------------------------

import type { ScriptLine } from './types';
import { FORMULA_NARRATION } from './formula-card';

/**
 * The clips after a scene was put in at `at` (delta 1) or taken out from it
 * (delta -1). The new scene has none; the removed scene's is dropped.
 */
export function shiftAudio<T>(audio: Record<number, T>, at: number, delta: 1 | -1): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [key, clip] of Object.entries(audio)) {
    const i = Number(key);
    if (!Number.isInteger(i)) continue;
    if (delta === -1 && i === at) continue;
    out[i >= at ? i + delta : i] = clip;
  }
  return out;
}

/** Where the formula scene is, or -1. */
export const formulaSceneAt = (script: ScriptLine[]): number => script.findIndex((l) => l.kind === 'formulas');

/**
 * The script with the formula scene added: just before the outro - the sheet
 * is the last thing taught, the sign-off still the last thing said - or at
 * the end when there is no outro. Unchanged if it is already there.
 */
export function withFormulaScene(script: ScriptLine[], narration = FORMULA_NARRATION): { script: ScriptLine[]; at: number } {
  const existing = formulaSceneAt(script);
  if (existing >= 0) return { script, at: -1 };
  let outro = -1;
  script.forEach((l, i) => { if (l.kind === 'outro') outro = i; });
  const at = outro >= 0 ? outro : script.length;
  const line: ScriptLine = { kind: 'formulas', narration } as ScriptLine;
  return { script: [...script.slice(0, at), line, ...script.slice(at)], at };
}

/** The visuals the editor puts into an explanation scene, over Gemini's own choice. */
type Special = 'working' | 'reduce';
const SPECIAL = new Set<string>(['working', 'reduce']);

/** Where this special visual is shown, or -1. */
export const specialSceneAt = (script: ScriptLine[], kind: Special): number =>
  script.findIndex((l) => l.visual && l.visual.kind === kind);

/**
 * A special visual shown in the first explanation scene not already showing
 * one, in place of that scene's own visual - which is kept, to put back if
 * it is taken out. Unchanged when there is no such scene, or it is shown.
 */
export function withSpecial(script: ScriptLine[], kind: Special): ScriptLine[] {
  if (specialSceneAt(script, kind) >= 0) return script;
  const at = script.findIndex((l) => l.kind === 'explain' && !(l.visual && SPECIAL.has(l.visual.kind)));
  if (at < 0) return script;
  return script.map((l, i) => (i === at
    ? { ...l, visualWas: l.visual, visual: { kind } } as ScriptLine
    : l));
}

/** A special visual taken out, and the scene's own visual put back. */
export function withoutSpecial(script: ScriptLine[], kind: Special): ScriptLine[] {
  return script.map((l) => {
    if (!l.visual || l.visual.kind !== kind) return l;
    const { visualWas, ...rest } = l;
    return { ...rest, visual: visualWas || { kind: 'none' } } as ScriptLine;
  });
}

export const workingSceneAt = (script: ScriptLine[]) => specialSceneAt(script, 'working');
export const withWorking = (script: ScriptLine[]) => withSpecial(script, 'working');
export const withoutWorking = (script: ScriptLine[]) => withoutSpecial(script, 'working');

/** The script without the formula scene, and where it was (-1 if it was not there). */
export function withoutFormulaScene(script: ScriptLine[]): { script: ScriptLine[]; at: number } {
  const at = formulaSceneAt(script);
  if (at < 0) return { script, at };
  return { script: script.filter((_, i) => i !== at), at };
}
