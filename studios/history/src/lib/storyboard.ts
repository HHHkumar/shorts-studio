// ---------------------------------------------------------------------------
// Storyboard: a new picture every couple of seconds.
//
// Fast explainers change the drawing on almost every phrase. This splits each
// scene into beats - at commas and full stops, about `every` seconds apart -
// and gives every beat a shot of its own, cutting in on its first word. The
// AI (or any chatbot) then writes one picture per beat; Draw or Stock fills them.
// ---------------------------------------------------------------------------

import type { StoryboardBody, StoryboardResult } from './api';
import { newShot } from './script';
import { sceneWords } from './timeline';
import type { Project, Scene, Shot, Word } from './types';

/** A shot nobody has filled or touched yet: safe to replace or take out again. */
export const emptyShot = (s: Shot): boolean => !s.image && !s.video && !s.graphic && !s.layer && !(s.elements || []).length;

const PHRASE_END = /[,;:—–)"”’]$/;
const SENTENCE_END = /[.!?]["'”’)]*$/;
/** A new clause starts here: a good place to cut when a long phrase has no comma. */
const CLAUSE = new Set('and but so or while because which who when where after before as then until though although yet'.split(' '));
/** Never cut straight after these: "the | Red Fort", "of | four percent". */
const GLUE = new Set('a an the of to in on at for by with from into than his her their its my our your this that these those very more most'.split(' '));
/** Never cut straight before these: "Bank | of India", "7.1 | percent". */
const TAIL = new Set('of s percent per cent crore lakh million billion'.split(' '));
/** A new phrase starts with these, so cutting just before one reads naturally: "...the bank rate | to 5.75 percent". */
const STARTERS = new Set('a an the to in on at for with by from into onto over under through across during beyond his her their its our your my this these those'.split(' '));
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const ends = (w: string) => SENTENCE_END.test(w) || PHRASE_END.test(w);

/**
 * Where each beat starts (word indexes; the first is always 0).
 *
 * Each cut is chosen from the words 0.75 to 2 beats into the current one, by score:
 * after a full stop is best, then after a comma, then before a new clause ("and",
 * "but", "while"); inside "the | Red Fort", "August | 2026" or just before a phrase
 * finishes is worst; and every point is pulled towards the target length. So beats
 * keep the pace and still fall on the seams of the sentence. The last beat is never
 * a scrap. `firstHold` keeps the opening shot up longer (a graphic needs reading).
 */
export function beatStarts(words: Word[], every: number, firstHold = 0): number[] {
  if (!words.length || !(every > 0)) return [0];
  const end = words[words.length - 1].end;
  // When the phrase running at each word finishes: cutting just before that leaves a scrap.
  const phraseDone: number[] = new Array(words.length);
  for (let i = words.length - 1, t = end; i >= 0; i--) {
    if (ends(words[i].word)) t = words[i].end;
    phraseDone[i] = t;
  }
  const score = (i: number, len: number, target: number) => {
    const prev = words[i - 1].word;
    const next = bare(words[i].word);
    let s = SENTENCE_END.test(prev) ? 4 : PHRASE_END.test(prev) ? 3 : CLAUSE.has(next) ? 1.5 : STARTERS.has(next) ? 1 : -1;
    if (!ends(prev) && (GLUE.has(bare(prev)) || TAIL.has(bare(words[i].word)) || /\d/.test(prev) || /^[\d₹$€£]/.test(words[i].word))) s -= 5;
    if (!ends(prev) && phraseDone[i] - words[i].start < every * 0.75) s -= 3;
    // "Reserve | Bank of India": two capitalised words in a row are one name.
    if (!ends(prev) && /^\p{Lu}/u.test(prev) && /^\p{Lu}/u.test(words[i].word)) s -= 4;
    return s - (2 * Math.abs(len - target)) / target;
  };
  const starts = [0];
  let at = 0;
  for (;;) {
    const first = starts.length === 1 && firstHold > 0;
    const target = first ? Math.max(firstHold, every) : every;
    const lo = first ? firstHold * 0.9 : every * 0.75;
    const hi = first ? Math.max(firstHold * 1.6, every * 2) : every * 2;
    // Search the usual window; when every cut in it is a bad one, let the beat run longer for a better seam.
    const search = (limit: number) => {
      let best = -1;
      let bestScore = -Infinity;
      for (let i = at + 3; i < words.length; i++) {
        const len = words[i].start - words[at].start;
        if (len > limit) break;
        if (len < lo || end - words[i].start < every * 0.75) continue;
        const sc = score(i, len, target);
        if (sc > bestScore) { bestScore = sc; best = i; }
      }
      return { best, bestScore };
    };
    let { best, bestScore } = search(hi);
    if (bestScore < -1) {
      const wider = search(hi * 1.6);
      if (wider.bestScore > bestScore) ({ best, bestScore } = wider);
    }
    // Only bad seams left, and not much talk to go: one longer beat beats a broken phrase.
    if (best < 0 || (bestScore < -3 && end - words[at].start <= every * 3)) break;
    starts.push(best);
    at = best;
  }
  return starts;
}

export type StoryboardPlan = { sceneIndex: number; starts: number[]; beats: string[] }[];

/** Every scene's beats, with the words of each. */
export function storyboardPlan(p: Project, every: number): StoryboardPlan {
  return p.scenes.map((sc, i) => {
    const words = sceneWords(sc);
    const starts = beatStarts(words, every, sc.shots[0]?.graphic ? 4 : 0);
    const beats = starts.map((s, k) => words.slice(s, k + 1 < starts.length ? starts[k + 1] : words.length).map((w) => w.word).join(' '));
    return { sceneIndex: i, starts, beats };
  });
}

/** How many beats the storyboard has, and how many have no picture yet - counted as applyStoryboard places them. */
export function storyboardCount(p: Project, every: number) {
  const plan = storyboardPlan(p, every);
  const total = plan.reduce((a, s) => a + s.starts.length, 0);
  const toDraw = plan.reduce((a, s) => {
    const [first, ...rest] = p.scenes[s.sceneIndex].shots;
    const kept = rest.filter((x) => !emptyShot(x));
    return a + (emptyShot(first) ? 1 : 0) + s.starts.slice(1).filter((at) => !kept.some((x) => Math.abs(x.atWord - at) <= 2)).length;
  }, 0);
  return { total, toDraw };
}

/** What the planner is asked: the beats of some scenes (a batch), numbered as in the whole video. */
export function storyboardBody(p: Project, plan: StoryboardPlan, styleName: string): StoryboardBody {
  return {
    title: p.title,
    styleName,
    styleBible: p.styleBible,
    kind: p.kind || 'history',
    scenes: plan.map((s) => {
      const first = p.scenes[s.sceneIndex].shots[0];
      return {
        index: s.sceneIndex + 1,
        beats: s.beats,
        // The opening picture stays when it is already made; the planner draws the rest around it.
        keepFirst: first.graphic ? 'a ' + first.graphic.kind + ' graphic' : !emptyShot(first) ? first.imagePrompt || 'an existing picture' : '',
      };
    }),
  };
}

/** Batches of whole scenes, about `size` beats each, so a long video is planned in parts. */
export function batches(plan: StoryboardPlan, size = 40): StoryboardPlan[] {
  const out: StoryboardPlan[] = [];
  let cur: StoryboardPlan = [];
  let n = 0;
  for (const s of plan) {
    if (cur.length && n + s.starts.length > size) { out.push(cur); cur = []; n = 0; }
    cur.push(s);
    n += s.starts.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * One shot per beat. Pictures already made stay where they are (the first shot,
 * and any extra shot near a beat); empty extra shots are replaced by the plan.
 */
export function applyStoryboard(p: Project, plan: StoryboardPlan, r: StoryboardResult): { project: Project; added: number } {
  let added = 0;
  const scenes = p.scenes.map((sc, i) => {
    const beatPlan = plan.find((x) => x.sceneIndex === i);
    const got = r.scenes.find((x) => x.index === i + 1);
    if (!beatPlan || !got) return sc;
    const prompt = (k: number) => got.shots.find((s) => s.beat === k + 1) || { imagePrompt: '', stockQuery: '' };
    const [first, ...rest] = sc.shots;
    const kept = rest.filter((s) => !emptyShot(s));
    const opening = emptyShot(first) ? { ...first, imagePrompt: prompt(0).imagePrompt || first.imagePrompt, stockQuery: prompt(0).stockQuery || first.stockQuery } : first;
    const fresh = beatPlan.starts.slice(1)
      .map((at, k) => ({ at, beat: prompt(k + 1) }))
      .filter(({ at, beat }) => (beat.imagePrompt || beat.stockQuery) && !kept.some((s) => Math.abs(s.atWord - at) <= 2))
      .map(({ at, beat }) => newShot({ atWord: at, imagePrompt: beat.imagePrompt, stockQuery: beat.stockQuery }));
    added += fresh.length;
    return { ...sc, shots: [opening, ...[...kept, ...fresh].sort((a, b) => a.atWord - b.atWord)] } as Scene;
  });
  const styleBible = p.styleBible.trim() ? p.styleBible : r.styleBible || p.styleBible;
  return { project: { ...p, styleBible, scenes }, added };
}

/** Takes out the extra shots that are still empty - an undo for a plan you do not like. */
export function removeEmptyShots(p: Project): { project: Project; removed: number } {
  let removed = 0;
  const scenes = p.scenes.map((sc) => {
    const keep = sc.shots.filter((s, k) => k === 0 || !emptyShot(s));
    removed += sc.shots.length - keep.length;
    return keep.length === sc.shots.length ? sc : { ...sc, shots: keep };
  });
  return { project: { ...p, scenes }, removed };
}
