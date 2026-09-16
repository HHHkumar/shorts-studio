// ---------------------------------------------------------------------------
// Figures: the diagram OF THE QUESTION, rather than a diagram about its topic.
//
// A sketch from the library is picked by name and shows a generic idea - "a
// circuit", "a magnetic field". That is why a question about a junction with
// 2 A and 4 A coming in and 1 A going out was illustrated with three resistors
// in parallel: the library had nothing closer, and the model was told to use a
// diagram generously. A figure is written for the one question in hand, every
// number on it is computed, and it is shown only when that computation agrees
// with the answer the video is about to give.
//
// This file is the registry. Each family lives in its own file and is listed
// in FAMILIES below; nothing else needs to change to add one, apart from the
// component that draws it in src/remotion/Figure.tsx.
//
// Pure data and arithmetic. The server imports this directly, so every import
// keeps its .ts extension and nothing here may touch React or the DOM.
// ---------------------------------------------------------------------------

import { CIRCUIT_FAMILY, type Circuit } from './circuit.ts';
import { JUNCTION_FAMILY, type Junction } from './junction.ts';
import { AC_FAMILY, type AcFigure } from './ac.ts';
import { POWER_TRIANGLE_FAMILY, type PowerTriangle } from './power-triangle.ts';
import { THREE_PHASE_FAMILY, type ThreePhase } from './three-phase.ts';
import type { FigureAnswer, FigureFamily } from './family.ts';
import { formatQuantity, parseQuantity, sameValue } from './quantity.ts';

export type Figure = Circuit | Junction | AcFigure | PowerTriangle | ThreePhase;

export const FAMILIES: FigureFamily<any>[] = [JUNCTION_FAMILY, CIRCUIT_FAMILY, AC_FAMILY, POWER_TRIANGLE_FAMILY, THREE_PHASE_FAMILY];
const BY_TYPE = new Map(FAMILIES.map((f) => [f.type, f]));

/** What the question's correct option said, against what the figure works out. */
export interface FigureCheck {
  /**
   * match     - the figure's working gives the correct option.
   * mismatch  - it gives a different one. Either the figure or the answer is wrong.
   * unchecked - the figure asks nothing, or the option cannot be compared with it.
   * invalid   - the model wrote a figure that cannot be drawn honestly.
   */
  status: 'match' | 'mismatch' | 'unchecked' | 'invalid';
  /** The figure's own answer, formatted: "5 A". */
  computed?: string;
  /** The correct option as written. */
  option?: string;
  /** Why an invalid figure was refused, in words a creator can act on. */
  problems?: string[];
}

/**
 * A figure the renderer can trust, or null with the reasons it was refused.
 *
 * Accepts the figure as an object or as the JSON text the model writes it in:
 * it travels as a string so the response schema stays small no matter how many
 * families exist - a schema that grew with every family would eventually be
 * refused outright, as the sketch enum once was.
 */
export function normalizeFigure(raw: any): { figure: Figure | null; errors: string[] } {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || text === 'none' || text === '{}' || text === 'null') return { figure: null, errors: [] };
    try {
      value = JSON.parse(text);
    } catch {
      // Prose around the object is forgiven; an object cut off part-way is not.
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      try {
        if (start < 0 || end <= start) throw new Error('no complete object');
        value = JSON.parse(text.slice(start, end + 1));
      } catch {
        return { figure: null, errors: ['the figure was not valid JSON'] };
      }
    }
  }
  if (!value || typeof value !== 'object' || !value.type || value.type === 'none') return { figure: null, errors: [] };
  const family = BY_TYPE.get(String(value.type));
  if (!family) return { figure: null, errors: ['unknown figure type: ' + String(value.type).slice(0, 20)] };
  return family.normalize(value);
}

/** The value or phrase the figure itself works out for its question. */
export function answerFigure(figure: Figure): FigureAnswer | null {
  const family = BY_TYPE.get(figure.type);
  return family ? family.answer(figure) : null;
}

export function formatAnswer(answer: FigureAnswer): string {
  return answer.kind === 'number' ? formatQuantity(answer.value, answer.unit) : answer.value;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Compare a figure's answer with the correct option.
 *
 * Numbers: units are compared when the option has one, so "5 W" does not pass
 * for a current of 5 A, and an option with no number in it - "It doubles" -
 * cannot be checked, and says so rather than pretending it passed. Words: the
 * option must contain the figure's phrase, so "North-east" matches "north east".
 */
export function checkFigure(figure: Figure, correctOption: string): FigureCheck {
  const solved = answerFigure(figure);
  if (!solved) return { status: 'unchecked', option: correctOption };
  const computed = formatAnswer(solved);
  if (solved.kind === 'text') {
    const want = words(solved.value);
    const have = ' ' + words(correctOption) + ' ';
    if (!want) return { status: 'unchecked', computed, option: correctOption };
    return { status: have.includes(' ' + want + ' ') ? 'match' : 'mismatch', computed, option: correctOption };
  }
  const stated = parseQuantity(correctOption);
  if (!stated) return { status: 'unchecked', computed, option: correctOption };
  const unitsAgree = !stated.unit || !solved.unit || stated.unit === solved.unit;
  const agree = unitsAgree && sameValue(stated.value, solved.value);
  return { status: agree ? 'match' : 'mismatch', computed, option: correctOption };
}

/** The families a video on this subject and topic may use. */
export function familiesFor(subject: string, topic: string): FigureFamily<any>[] {
  const text = (subject || '') + ': ' + (topic || '');
  return FAMILIES.filter((f) => f.fits.test(text));
}

/**
 * The part of the generation prompt that teaches the figures.
 *
 * Only the families that fit the subject are described. A GK video is told
 * there are none, which is the honest answer, rather than being shown fifteen
 * formats it must ignore.
 */
export function figurePromptLines(subject: string, topic: string): string[] {
  const fitting = familiesFor(subject, topic);
  if (!fitting.length) {
    return ['THE FIGURE. No figure types apply to this subject: set "figure" to "none".'];
  }
  const lines = [
    'THE FIGURE. When the question is about a specific situation that one of the figure types below',
    'can draw, write it in "figure" as a JSON object IN A STRING, so the video draws THAT situation',
    'with its real values - not a generic picture of the topic. Every number on it is worked out from',
    'what you write and checked against your correct option; a figure that does not check out is',
    'thrown away. When none of these types fits the question, set "figure" to "none".',
    'Show it with visual kind "figure" on the question scene - what is asked appears as "?" - and on',
    'the explain scenes that work through it. Set "highlight" to the id or label of the part a scene',
    'is about.',
    '',
  ];
  for (const family of fitting) {
    lines.push('- type "' + family.type + '": ' + family.label);
    family.docs.forEach((d) => lines.push('  ' + d));
  }
  return lines;
}

export { formatQuantity, parseQuantity } from './quantity.ts';
export type { FigureAnswer, FigureFamily } from './family.ts';
export type { Circuit, CircuitElement, CircuitNode, ElementKind } from './circuit.ts';
export type { Junction, Branch } from './junction.ts';
export type { AcFigure, AcSignal } from './ac.ts';
export type { PowerTriangle } from './power-triangle.ts';
export type { ThreePhase } from './three-phase.ts';
