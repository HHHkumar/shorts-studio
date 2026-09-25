// ---------------------------------------------------------------------------
// A square carousel post, made from the same question as the video.
//
// The Reel is watched once; a carousel is swiped, saved and come back to before
// an exam. So the slides are a study card, in the order a reader wants it:
//
//   1. the question and its options  - answer it in your head, or in a comment
//   2. the answer                    - all four options, the right one marked
//   3. the worked figure, if any     - every value on it now shown
//   4. why, one step at a time       - as many slides as the steps need
//   5. the fun fact and a follow     - the reason to save it
//
// Nothing here draws. This plans the slides and sizes their text so nothing
// overflows a 1080 square - the renderer in src/remotion/Carousel.tsx just
// follows the plan. Plain TypeScript with no React, so the server can import
// it and the tests can check the arithmetic.
// ---------------------------------------------------------------------------

import type { QuizContent } from './types.ts';
import { isSetupSafe } from './figures/index.ts';

export const SLIDE_SIZE = 1080;
/** Instagram's own ceiling for one carousel. */
export const MAX_SLIDES = 20;

/** Inner width of a slide, after its side padding. */
export const CONTENT_WIDTH = SLIDE_SIZE - 2 * 84;
/** Height left for the body between the header strip and the footer strip. */
export const BODY_HEIGHT = SLIDE_SIZE - 150 - 150;

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Average glyph width as a fraction of the font size, erring wide so text never overflows. */
const DISPLAY_CHAR = 0.6;
const BODY_CHAR = 0.54;

export type Slide =
  | { kind: 'question'; kicker: string; question: string; questionSize: number; options: string[]; optionSize: number; figure: boolean }
  | { kind: 'options'; prompt: string; options: string[]; optionSize: number }
  | { kind: 'answer'; options: string[]; correctIndex: number; optionSize: number; answerLine: string; answerSize: number }
  | { kind: 'worked'; caption: string }
  | { kind: 'why'; steps: { number: number; text: string }[]; size: number; part: number; parts: number }
  /** `picture`: height kept at the foot of the body for the mascot, in the Doodle look. 0 for none. */
  | { kind: 'outro'; fact: string; factSize: number; cta: string; handle: string; picture: number };

export interface CarouselPlan {
  slides: Slide[];
  /** Anything worth telling the creator, e.g. why a slide was split. */
  notes: string[];
}

/** How many lines `text` wraps to at this size, wrapping on words the way a browser does. */
export function wrapLines(text: string, fontSize: number, width: number, charFactor = BODY_CHAR): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * charFactor)));
  let lines = 0;
  for (const paragraph of String(text || '').split('\n')) {
    let used = 0;
    lines++;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (used === 0) {
        // A word longer than the line breaks across lines of its own.
        lines += Math.floor((len - 1) / perLine);
        used = ((len - 1) % perLine) + 1;
      } else if (used + 1 + len <= perLine) {
        used += 1 + len;
      } else {
        lines++;
        lines += Math.floor((len - 1) / perLine);
        used = ((len - 1) % perLine) + 1;
      }
    }
  }
  return lines;
}

export const textHeight = (text: string, size: number, width: number, lineHeight: number, charFactor = BODY_CHAR) =>
  wrapLines(text, size, width, charFactor) * size * lineHeight;

/** The option rows as the renderer lays them out: a letter badge, the text, padding, a gap. */
export const OPTION = { badge: 1.9, padY: 22, gap: 18, lineHeight: 1.22 };
export function optionsHeight(options: string[], size: number): number {
  const textWidth = CONTENT_WIDTH - size * OPTION.badge - 3 * 22;
  return options.reduce((h, o) => h + Math.max(size * OPTION.lineHeight * wrapLines(o, size, textWidth), size * OPTION.badge)
    + 2 * OPTION.padY, 0) + OPTION.gap * Math.max(0, options.length - 1);
}

/** The largest size in [min, max], stepping down by 2, for which `fits` holds - or null. */
function largest(max: number, min: number, fits: (size: number) => boolean): number | null {
  for (let s = max; s >= min; s -= 2) if (fits(s)) return s;
  return null;
}

const QUESTION_LH = 1.12;
const STEP = { lineHeight: 1.3, gap: 34, number: 1.6 };
export const QUESTION_GAP = 44;
/** Room the answer line takes under the options on the answer slide. */
const ANSWER_GAP = 36;

/** The explanation, one entry per step: the written steps, or failing that the explain scenes. */
export function rationaleSteps(content: QuizContent): string[] {
  const clean = (s: unknown) => String(s || '').replace(/\s+/g, ' ').trim();
  const written = (content.explanation || []).map(clean).filter(Boolean);
  if (written.length) return written;
  return (content.script || [])
    .filter((l) => l.kind === 'explain')
    .map((l) => clean(l.narration || l.onScreen))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Room for the mascot on the closing slide, in the Doodle look: the waving
 * engineer under the sign-off, the same model sheet the video is drawn from.
 * Smaller when there is a fun fact to fit as well.
 */
export const OUTRO_PICTURE = { alone: 440, withFact: 280 };

export function planCarousel(content: QuizContent, opts: { channelName?: string; picture?: boolean } = {}): CarouselPlan {
  const notes: string[] = [];
  const slides: Slide[] = [];
  const options = (content.options || []).map((o) => String(o || '').trim()).filter(Boolean);
  const isQuiz = options.length >= 2 && content.correctIndex >= 0 && content.correctIndex < options.length;
  const question = String(content.question || content.topic || '').trim();
  const kicker = [content.subject, content.topic].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  const figure = Boolean(content.figure && isSetupSafe(content.figure));

  // --- the question -----------------------------------------------------------------
  const qHeight = (s: number) => textHeight(question, s, CONTENT_WIDTH, QUESTION_LH, DISPLAY_CHAR);
  if (figure) {
    // The figure takes most of the square, so the question stays short above it
    // and the options get a slide of their own.
    const size = largest(56, 36, (s) => qHeight(s) <= BODY_HEIGHT * 0.34) ?? 34;
    slides.push({ kind: 'question', kicker, question, questionSize: size, options: [], optionSize: 0, figure: true });
    if (isQuiz) {
      const optionSize = largest(50, 30, (s) => optionsHeight(options, s) <= BODY_HEIGHT - 90) ?? 28;
      slides.push({ kind: 'options', prompt: 'Which one is right?', options, optionSize });
    }
  } else if (isQuiz) {
    let together: { q: number; o: number } | null = null;
    for (let o = 44; o >= 30 && !together; o -= 2) {
      const q = largest(76, 42, (s) => qHeight(s) + QUESTION_GAP + optionsHeight(options, o) <= BODY_HEIGHT);
      if (q !== null) together = { q, o };
    }
    if (together) {
      slides.push({ kind: 'question', kicker, question, questionSize: together.q, options, optionSize: together.o, figure: false });
    } else {
      notes.push('The question is long, so the options have a slide of their own.');
      const size = largest(80, 34, (s) => qHeight(s) <= BODY_HEIGHT) ?? 32;
      slides.push({ kind: 'question', kicker, question, questionSize: size, options: [], optionSize: 0, figure: false });
      const optionSize = largest(50, 28, (s) => optionsHeight(options, s) <= BODY_HEIGHT - 90) ?? 26;
      slides.push({ kind: 'options', prompt: 'Which one is right?', options, optionSize });
    }
  } else {
    const size = largest(84, 38, (s) => qHeight(s) <= BODY_HEIGHT) ?? 36;
    slides.push({ kind: 'question', kicker, question, questionSize: size, options: [], optionSize: 0, figure: false });
  }

  // --- the answer ---------------------------------------------------------------------
  if (isQuiz) {
    const answerLine = String(content.answerLine || '').trim();
    let fit: { o: number; a: number } | null = null;
    for (let a = 44; a >= 32 && !fit; a -= 2) {
      const aH = answerLine ? textHeight(answerLine, a, CONTENT_WIDTH, 1.25) + ANSWER_GAP : 0;
      const o = largest(44, 28, (s) => optionsHeight(options, s) + aH + 60 <= BODY_HEIGHT);
      if (o !== null) fit = { o, a };
    }
    slides.push({
      kind: 'answer', options, correctIndex: content.correctIndex, answerLine,
      optionSize: fit ? fit.o : 26, answerSize: fit ? fit.a : 30,
    });
  }

  // --- the figure, worked out ------------------------------------------------------------
  if (content.figure) slides.push({ kind: 'worked', caption: 'Worked out' });

  // --- why: as many slides as the steps need ---------------------------------------------
  const steps = rationaleSteps(content);
  if (steps.length) {
    const stepWidth = CONTENT_WIDTH - 56 * STEP.number - 24;
    const stepHeight = (text: string, s: number) => Math.max(textHeight(text, s, stepWidth, STEP.lineHeight), s * STEP.number);
    const budget = BODY_HEIGHT - 90;
    // One size for every "why" slide, so the pages read as one piece: the largest
    // at which no single step overflows a page on its own.
    const size = largest(48, 34, (s) => steps.every((t) => stepHeight(t, s) <= budget)) ?? 32;
    const pages: { number: number; text: string }[][] = [[]];
    let used = 0;
    steps.forEach((text, i) => {
      const h = stepHeight(text, size) + (pages[pages.length - 1].length ? STEP.gap : 0);
      if (pages[pages.length - 1].length && used + h > budget) {
        pages.push([]);
        used = stepHeight(text, size);
      } else {
        used += h;
      }
      pages[pages.length - 1].push({ number: i + 1, text });
    });
    pages.forEach((page, i) => slides.push({ kind: 'why', steps: page, size, part: i + 1, parts: pages.length }));
  }

  // --- the fun fact and the follow ----------------------------------------------------------
  const fact = String(content.funFact || '').trim();
  const handle = String(opts.channelName || '').trim();
  // The picture only goes in if the fact still fits beside it at a readable
  // size. A long fact keeps the whole slide: the words matter more than the
  // drawing, and a drawing squeezed over text is worse than none.
  const factFits = (picture: number) =>
    largest(52, 32, (s) => textHeight(fact, s, CONTENT_WIDTH - 120, 1.3) <= BODY_HEIGHT - 330 - picture);
  let factSize = 0;
  let picture = 0;
  if (fact) {
    const withPicture = opts.picture ? factFits(OUTRO_PICTURE.withFact) : null;
    if (withPicture) {
      factSize = withPicture;
      picture = OUTRO_PICTURE.withFact;
    } else {
      factSize = factFits(0) ?? 30;
    }
  } else if (opts.picture) {
    picture = OUTRO_PICTURE.alone;
  }
  slides.push({ kind: 'outro', fact, factSize, cta: 'Save this for revision. Follow for one every day.', handle, picture });

  if (slides.length > MAX_SLIDES) {
    notes.push('Trimmed to ' + MAX_SLIDES + ' slides, the most Instagram takes in one post.');
    slides.splice(MAX_SLIDES - 1, slides.length - MAX_SLIDES);
    // "Why 3 of 7" would promise pages that were cut.
    const why = slides.filter((s): s is Extract<Slide, { kind: 'why' }> => s.kind === 'why');
    why.forEach((s) => { s.parts = why.length; });
  }
  return { slides, notes };
}

/** The file name for slide `i` (0-based), sorted correctly in any file browser. */
export const slideFileName = (i: number) => 'slide-' + String(i + 1).padStart(2, '0') + '.png';
