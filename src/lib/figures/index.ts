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
// Pure data and arithmetic. The server imports this directly, so every import
// keeps its .ts extension and nothing here may touch React or the DOM.
// ---------------------------------------------------------------------------

import { answerCircuit, normalizeCircuit, type Circuit } from './circuit.ts';
import { answerJunction, normalizeJunction, type Junction } from './junction.ts';
import { formatQuantity, parseQuantity, sameValue, type UnitClass } from './quantity.ts';

export type Figure = Circuit | Junction;
export const FIGURE_TYPES = ['junction', 'circuit'] as const;

/** What the question's correct option said, against what the figure works out. */
export interface FigureCheck {
  /**
   * match     - the figure's arithmetic gives the correct option's value.
   * mismatch  - it gives a different one. Either the figure or the answer is wrong.
   * unchecked - the figure asks nothing, or the option states no number.
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

/** A figure the renderer can trust, or null with the reasons it was refused. */
export function normalizeFigure(raw: any): { figure: Figure | null; errors: string[] } {
  if (!raw || typeof raw !== 'object' || !raw.type || raw.type === 'none') return { figure: null, errors: [] };
  if (raw.type === 'junction') {
    const { junction, errors } = normalizeJunction(raw);
    return { figure: junction, errors };
  }
  if (raw.type === 'circuit') {
    const { circuit, errors } = normalizeCircuit(raw);
    return { figure: circuit, errors };
  }
  return { figure: null, errors: ['unknown figure type: ' + String(raw.type).slice(0, 20)] };
}

/** The value the figure itself works out for its question. */
export function answerFigure(figure: Figure): { value: number; unit: UnitClass } | null {
  return figure.type === 'junction' ? answerJunction(figure) : answerCircuit(figure);
}

/**
 * Compare a figure's answer with the correct option.
 *
 * Units are compared when the option has one, so "5 W" does not pass for a
 * current of 5 A. An option with no number in it - "It doubles" - cannot be
 * checked, and says so rather than pretending it passed.
 */
export function checkFigure(figure: Figure, correctOption: string): FigureCheck {
  const solved = answerFigure(figure);
  if (!solved) return { status: 'unchecked', option: correctOption };
  const computed = formatQuantity(solved.value, solved.unit);
  const stated = parseQuantity(correctOption);
  if (!stated) return { status: 'unchecked', computed, option: correctOption };
  const unitsAgree = !stated.unit || stated.unit === solved.unit;
  const agree = unitsAgree && sameValue(stated.value, solved.value);
  return { status: agree ? 'match' : 'mismatch', computed, option: correctOption };
}

export { formatQuantity, parseQuantity } from './quantity.ts';
export type { Circuit, CircuitElement, CircuitNode, ElementKind } from './circuit.ts';
export type { Junction, Branch } from './junction.ts';
