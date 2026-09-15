// ---------------------------------------------------------------------------
// What every figure family provides.
//
// A family is one kind of figure - a circuit, a phasor diagram, a pie chart, a
// triangle - covering every syllabus subtopic that is drawn that way. Adding a
// topic means adding a family: validate what the model wrote, work out the
// answer from it, tell the model how to write one. The renderer draws it, and
// the rest - the check against the correct option, the "?" before the reveal,
// the report in step 3 - comes for free.
// ---------------------------------------------------------------------------

import type { UnitClass } from './quantity.ts';

/** What a figure works out for its question: a quantity, or a word or phrase. */
export type FigureAnswer =
  | { kind: 'number'; value: number; unit: UnitClass }
  | { kind: 'text'; value: string };

export interface FigureFamily<F extends { type: string } = { type: string }> {
  type: F['type'];
  /** One line for people: what this family draws. */
  label: string;
  /**
   * Which videos are told about this family, tested against
   * "subject: topic". Families that could never apply stay out of the prompt,
   * which keeps it short enough for the model to follow.
   */
  fits: RegExp;
  normalize(raw: any): { figure: F | null; errors: string[] };
  /** The figure's own answer, worked out from its data. Null when it asks nothing. */
  answer(figure: F): FigureAnswer | null;
  /** How to write one, for the generation prompt. Short: every line costs attention. */
  docs: string[];
}

export const str = (v: unknown, max = 24): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};
