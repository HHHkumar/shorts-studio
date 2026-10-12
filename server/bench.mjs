// ---------------------------------------------------------------------------
// The test bench: a fixed set of questions, the pictures this app makes for
// them, and a person's mark on each one.
//
// Fixing one wrong picture at a time proves that picture is fixed and says
// nothing about the next. The bench is how the next one is counted: the same
// questions every time, every picture marked right, wrong or beside the point
// by someone who knows the subject, and a score that either moves or does not.
// A picture marked wrong stays in the set for good - it is the standing proof
// that the thing that let it through no longer does.
//
// Two files' worth of state, both committed so they travel with the code:
//   bench/cases/<id>.json   the question, its script, and the reviewer's verdicts
//   bench/marks.json        the marks, by case and by picture
// The frames a person marks from are drawn into out/bench/<id>/ and are not
// committed: they are a render of the case, and can always be drawn again.
//
// For each picture there are three opinions, and the score sets them against
// each other: the RULES (would it be drawn at all today?), the REVIEWER (would
// the picture check take it out?), and the PERSON, who is the truth.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { picturesIn } from './picture-words.mjs';
import { checkSketch } from './sketch-contract.mjs';
import { answerShown, sourceNumbers, unsourcedInVisual } from './number-source.mjs';
import { isFlagged, settle } from './picture-review.mjs';
import { cutLabels } from './sketch-fit.mjs';
import { circuitProblems } from './circuit-check.mjs';

/** The only ids this module reads or writes - no path can be smuggled in. */
export const CASE_ID = /^b-[a-z0-9]+(?:-[a-z0-9]+){0,12}$/;
export const MARKS = ['right', 'wrong', 'unrelated'];

const casesDir = (root) => path.join(root, 'bench', 'cases');
const marksFile = (root) => path.join(root, 'bench', 'marks.json');

const fileOf = (root, id) => {
  if (!CASE_ID.test(String(id || '')) || String(id).length > 80) throw new Error('That is not a case on the test bench.');
  return path.join(casesDir(root), id + '.json');
};

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const slug = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'case';

/** The parts of a design that decide how a frame looks. Nothing else is kept. */
const lookOf = (design) => {
  const d = design || {};
  return { layout: d.layout || 'doodle', mode: d.mode || 'light', orientation: d.orientation || 'portrait' };
};

/** Every case, oldest first. */
export function listCases(root) {
  const dir = casesDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && CASE_ID.test(f.slice(0, -5)))
    .map((f) => readJson(path.join(dir, f), null))
    .filter((c) => c && c.id && c.content && Array.isArray(c.content.script))
    .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)) || a.id.localeCompare(b.id));
}

export function readCase(root, id) {
  const c = readJson(fileOf(root, id), null);
  if (!c) throw new Error('That case is not on the test bench.');
  return c;
}

export function saveCase(root, c) {
  const file = fileOf(root, c && c.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(c, null, 1));
  return c;
}

export function deleteCase(root, id) {
  const file = fileOf(root, id);
  if (fs.existsSync(file)) fs.rmSync(file);
  const marks = readMarks(root);
  if (marks[id]) {
    delete marks[id];
    writeMarks(root, marks);
  }
}

/**
 * A new case from a script. `id` is given when it must be stable (a library
 * video is added once, under its own id); otherwise it is made from the topic.
 */
export function addCase(root, { id, source, content, design, now = new Date() }) {
  if (!content || !Array.isArray(content.script) || !content.question) throw new Error('A bench case needs a question and its script.');
  let caseId = id;
  if (!caseId) {
    const base = 'b-' + slug(content.topic || content.subject);
    caseId = base;
    for (let n = 2; fs.existsSync(path.join(casesDir(root), caseId + '.json')); n++) caseId = base + '-' + n;
  }
  // The media of a real video stays in the library: a bench case is its
  // script, and a frame of a diagram needs no voice clip or drawing.
  const script = content.script.map((line) => {
    const { doodleSrc: _d, stockSrc: _s, stockCredit: _c, stockId: _i, ...rest } = line || {};
    return rest;
  });
  return saveCase(root, {
    id: caseId,
    source: source || 'syllabus',
    addedAt: now.toISOString(),
    look: lookOf(design),
    content: { ...content, script, pictureReview: undefined },
    checkedAt: null,
    by: [],
    sawFrames: false,
    reviews: [],
  });
}

/** Every library video that is not on the bench yet, added under its own id. */
export function addLibraryVideos(root, videos) {
  const have = new Set(listCases(root).map((c) => c.id));
  const added = [];
  for (const v of videos || []) {
    if (!v || !v.id || !v.content || (v.content.videoKind && v.content.videoKind !== 'mcq')) continue;
    const id = 'b-' + String(v.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!CASE_ID.test(id) || have.has(id)) continue;
    // What the model asked for, before any check took a picture out of it.
    const content = restoreRemoved(v.content);
    if (!picturesIn(content).length) continue;
    added.push(addCase(root, { id, source: 'library', content, design: v.design, now: new Date(v.createdAt || Date.now()) }).id);
  }
  return added;
}

/** A script with the pictures a check took out put back: the bench judges what was asked for. */
function restoreRemoved(content) {
  const record = content.pictureReview;
  if (!record || !Array.isArray(record.reviews)) return content;
  const script = content.script.slice();
  for (const r of record.reviews) {
    const line = script[r.scene];
    if (r.removed && line && line.narration === r.narration && (!line.visual || line.visual.kind === 'none')) {
      const { pictureNote: _n, ...rest } = line;
      script[r.scene] = { ...rest, visual: r.removed };
    }
  }
  return { ...content, script };
}

/** The reviewer's verdicts on a case, as returned by reviewPictures. */
export function saveReviews(root, id, { reviews, by, sawFrames }) {
  const c = readCase(root, id);
  return saveCase(root, {
    ...c,
    checkedAt: new Date().toISOString(),
    by: by || [],
    sawFrames: Boolean(sawFrames),
    // Only what the bench needs: the frame is found again by its file name.
    reviews: (reviews || []).map((r) => ({ key: r.key, scene: r.scene, verdict: r.verdict, reason: r.reason, said: r.said })),
  });
}

export function readMarks(root) {
  const marks = readJson(marksFile(root), {});
  return marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
}

function writeMarks(root, marks) {
  fs.mkdirSync(path.dirname(marksFile(root)), { recursive: true });
  fs.writeFileSync(marksFile(root), JSON.stringify(marks, null, 1));
}

/** One mark on one picture. An empty mark takes it away. */
export function setMark(root, id, key, { mark, note = '', by = 'you' }) {
  fileOf(root, id);
  if (!/^[0-9a-f]{8}$/.test(String(key || ''))) throw new Error('That is not a picture on this case.');
  const marks = readMarks(root);
  const forCase = marks[id] || {};
  if (!mark) {
    delete forCase[key];
  } else {
    if (!MARKS.includes(mark)) throw new Error('A picture is marked right, wrong or beside the point.');
    forCase[key] = { mark, note: String(note || '').slice(0, 400), by: by === 'claude' ? 'claude' : 'you', at: new Date().toISOString() };
  }
  if (Object.keys(forCase).length) marks[id] = forCase; else delete marks[id];
  writeMarks(root, marks);
  return forCase[key] || null;
}

/** Why the rules would not draw this picture today. Empty when they would. */
export function refusedToday(visual, source, orientation = 'portrait', question = null) {
  const reasons = visual.kind === 'sketch' ? checkSketch(visual.sketch, visual.params || {}, visual.items || []) : [];
  // `question` is the video, passed only for the picture on its question scene.
  const answer = question && visual.kind === 'sketch' ? answerShown(visual, question) : [];
  if (answer.length) reasons.push('shows ' + answer.join(', ') + ' on the question scene, which is the answer');
  const bad = unsourcedInVisual(visual, source);
  if (bad.length) reasons.push('shows ' + bad.join(', ') + ', which the video never gives');
  if (visual.kind === 'sketch' && visual.sketch === 'circuit' && !reasons.length) {
    reasons.push(...circuitProblems(visual.params, orientation));
  } else if (visual.kind === 'sketch' && !reasons.length) {
    const cut = cutLabels(visual.sketch, visual.params || {}, visual.items || [], orientation);
    if (cut.length) reasons.push('has no room for "' + cut[0].label + '", which would be cut to "' + cut[0].drawn + '"');
  }
  return reasons;
}

/**
 * Everything the review page shows: each case, each picture on it, and the
 * three opinions about it. `frameUrl(caseId, scene)` says where a drawn frame
 * is, or returns '' when there is none yet.
 */
export function benchView(root, frameUrl = () => '') {
  const marks = readMarks(root);
  const cases = listCases(root).map((c) => {
    const content = c.content;
    const source = sourceNumbers(content);
    // Settled again from what each reviewer said, so a change to how they
    // are settled shows in the score at once, without paying for a re-check.
    const reviews = new Map((c.reviews || []).map((r) => [r.key, r.said && r.said.length ? { ...r, ...settle(r.said) } : r]));
    const mine = marks[c.id] || {};
    const pictures = picturesIn(content).map((p) => {
      const review = reviews.get(p.key) || null;
      const refused = refusedToday(p.visual, source, (c.look || {}).orientation, p.beat === 'question' ? content : null);
      const mark = mine[p.key] || null;
      return {
        key: p.key,
        scene: p.scene,
        beat: p.beat,
        kind: p.visual.kind === 'sketch' ? p.visual.sketch : p.visual.kind,
        narration: p.narration,
        words: p.words,
        frame: frameUrl(c.id, p.scene),
        refused,
        verdict: review ? review.verdict : '',
        reason: review ? review.reason : '',
        said: review && review.said ? review.said : [],
        // Shown in a video made today: the rules draw it and the check keeps it.
        shown: !refused.length && !(review && isFlagged(review.verdict)),
        mark: mark ? mark.mark : '',
        note: mark ? mark.note : '',
        markedBy: mark ? mark.by : '',
      };
    });
    const notDrawn = content.script
      .map((line, i) => ({ scene: i, note: (line && line.pictureNote) || '', none: !line || !line.visual || line.visual.kind === 'none' }))
      .filter((x) => x.note && x.none)
      .map(({ scene, note }) => ({ scene, note }));
    return {
      id: c.id,
      source: c.source,
      addedAt: c.addedAt,
      look: c.look,
      subject: content.subject || '',
      topic: content.topic || '',
      question: content.question || '',
      answer: (content.options || [])[content.correctIndex] || '',
      checkedAt: c.checkedAt || '',
      by: c.by || [],
      sawFrames: Boolean(c.sawFrames),
      pictures,
      notDrawn,
    };
  });
  // `provisional` counts a first pass by Claude as though it were confirmed:
  // a picture of where things stand before a person has been through them.
  return { cases, score: scoreBench(cases), provisional: scoreBench(cases, { includeSuggested: true }) };
}

const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

/**
 * The score. Only pictures a person has marked count, and "a person" means
 * confirmed marks: a first pass by Claude is a suggestion until it is.
 *
 *   asked       what the model asks for, before anything checks it
 *   shown       what reaches a video made today
 *   wrongShown  the number that has to be zero
 */
export function scoreBench(cases, { includeSuggested = false } = {}) {
  const s = {
    cases: cases.length,
    pictures: 0, marked: 0, suggested: 0, checked: 0,
    asked: { right: 0, wrong: 0, unrelated: 0 },
    shownRight: 0, shownWrong: 0, hiddenRight: 0, hiddenWrong: 0,
    byRules: { caught: 0, lostRight: 0 },
    byReviewer: { caught: 0, missed: 0, lostRight: 0, judged: 0 },
  };
  for (const c of cases) {
    for (const p of c.pictures) {
      s.pictures++;
      if (p.verdict) s.checked++;
      if (!p.mark) continue;
      if (p.markedBy === 'claude') s.suggested++;
      if (p.markedBy === 'claude' && !includeSuggested) continue;
      s.marked++;
      const good = p.mark === 'right';
      s.asked[p.mark]++;
      if (p.shown) { if (good) s.shownRight++; else s.shownWrong++; }
      else if (good) s.hiddenRight++; else s.hiddenWrong++;
      // Who did the catching - and what each cost in right pictures.
      if (p.refused.length) { if (good) s.byRules.lostRight++; else s.byRules.caught++; }
      else if (p.verdict) {
        s.byReviewer.judged++;
        const flagged = isFlagged(p.verdict);
        if (!good && flagged) s.byReviewer.caught++;
        if (!good && !flagged) s.byReviewer.missed++;
        if (good && flagged) s.byReviewer.lostRight++;
      }
    }
  }
  const bad = s.asked.wrong + s.asked.unrelated;
  return {
    ...s,
    // Of what the model asks for, how much is right: the raw material.
    askedRightPct: share(s.asked.right, s.marked),
    // Of what a viewer sees today, how much is right: the number that matters.
    shownRightPct: share(s.shownRight, s.shownRight + s.shownWrong),
    // Of the bad pictures, how many are stopped.
    caughtPct: share(s.hiddenWrong, bad),
    // Of the right pictures, how many survive the checks.
    keptPct: share(s.shownRight, s.asked.right),
  };
}
