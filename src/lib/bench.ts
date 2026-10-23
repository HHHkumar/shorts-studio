// ---------------------------------------------------------------------------
// The test bench, as the browser sees it: what the helper sends (see
// server/bench.mjs), which syllabus questions to add next, and which pictures
// a filter shows.
// ---------------------------------------------------------------------------

import type { PictureVerdict } from './picture-review.ts';

export type BenchMark = 'right' | 'wrong' | 'unrelated';

export interface BenchPicture {
  key: string;
  scene: number;
  beat: string;
  /** The sketch's name, or "bars" / "compare". */
  kind: string;
  narration: string;
  words: string;
  /** Where its frame is, or '' when none has been drawn. */
  frame: string;
  /** Why the rules would not draw it today. Empty when they would. */
  refused: string[];
  verdict: PictureVerdict | '';
  reason: string;
  said: { by: string; verdict: PictureVerdict; reason: string }[];
  /** True when a video made today would show it. */
  shown: boolean;
  mark: BenchMark | '';
  note: string;
  markedBy: 'you' | 'claude' | '';
}

export interface BenchCase {
  id: string;
  source: 'library' | 'syllabus' | 'plan';
  addedAt: string;
  look: { layout: string; mode: string; orientation: string };
  subject: string;
  topic: string;
  question: string;
  answer: string;
  checkedAt: string;
  by: string[];
  sawFrames: boolean;
  pictures: BenchPicture[];
  notDrawn: { scene: number; note: string }[];
}

export interface BenchScore {
  cases: number;
  pictures: number;
  marked: number;
  suggested: number;
  checked: number;
  asked: Record<BenchMark, number>;
  shownRight: number;
  shownWrong: number;
  hiddenRight: number;
  hiddenWrong: number;
  byRules: { caught: number; lostRight: number };
  byReviewer: { caught: number; missed: number; lostRight: number; judged: number };
  askedRightPct: number | null;
  shownRightPct: number | null;
  caughtPct: number | null;
  keptPct: number | null;
}

export interface BenchView {
  cases: BenchCase[];
  score: BenchScore;
  /** The score with Claude's unconfirmed first pass counted as well. */
  provisional: BenchScore;
  /** Doodles reported wrong, newest first, each with what the picture rule would do with it today. */
  drawings?: DrawingReport[];
}

/** One doodle the creator said was wrong (server/bench.mjs reportDrawing). */
export interface DrawingReport {
  at: string;
  topic: string;
  scene: number;
  kind: string;
  narration: string;
  direction: { subject: string; action: string; props: string; gag: string };
  src: string;
  approved: string;
  unchecked: boolean;
  note: string;
  /** draw: the rule would still have it drawn - it has not learned from this one. */
  today: { outcome: 'draw' | 'approved' | 'none'; why: string; equipment: string };
}

export interface BenchQuestion {
  subject: string;
  topic: string;
  flavour: string;
}

/**
 * The next `count` questions to add: a spread over the syllabus, a subject at
 * a time in turn, skipping topics the bench already has. The same call always
 * picks the same questions, so two machines build the same bench.
 */
export function nextBenchQuestions(
  subjects: string[],
  subtopics: Record<string, string[]>,
  have: { subject: string; topic: string }[],
  count: number,
): BenchQuestion[] {
  const taken = new Set(have.map((h) => (h.subject + '|' + h.topic).toLowerCase()));
  const queues = subjects.map((subject) => ({
    subject,
    topics: (subtopics[subject] || []).filter((t) => !taken.has((subject + '|' + t).toLowerCase())),
  }));
  const out: BenchQuestion[] = [];
  for (let round = 0; out.length < count && queues.some((q) => q.topics.length > round); round++) {
    for (const q of queues) {
      if (out.length >= count) break;
      const topic = q.topics[round];
      if (!topic) continue;
      // A calculation and a concept in turn: each asks for different pictures.
      out.push({ subject: q.subject, topic, flavour: out.length % 2 === 0 ? 'Mathematical' : 'Theoretical' });
    }
  }
  return out;
}

export type BenchFilter = 'all' | 'todo' | 'bad' | 'disagree' | 'slipped';

const flagged = (v: string) => v === 'wrong' || v === 'unrelated';

/** Does this picture belong under this filter? */
export function inFilter(p: BenchPicture, filter: BenchFilter): boolean {
  if (filter === 'all') return true;
  // Still wants a person: never marked, or only suggested.
  if (filter === 'todo') return !p.mark || p.markedBy === 'claude';
  if (filter === 'bad') return p.mark === 'wrong' || p.mark === 'unrelated';
  // The reviewer and the mark say different things.
  if (filter === 'disagree') return Boolean(p.mark && p.verdict && p.verdict !== 'unsure' && flagged(p.verdict) !== (p.mark !== 'right'));
  // Marked bad, and a video made today would still show it.
  return p.mark !== '' && p.mark !== 'right' && p.shown;
}
