// ---------------------------------------------------------------------------
// Which sub-topics have a diagram, and which have nothing.
//
//     node --import ./tools/ts-resolve.mjs tools/sketch-coverage.mjs
//     node --import ./tools/ts-resolve.mjs tools/sketch-coverage.mjs --gaps
//
// Not a test - a report. The sketch library is chosen by a model from names and
// one-line descriptions, so the useful question is not "how many sketches are
// there" but "for this sub-topic, is there one whose words overlap at all". A
// crude keyword overlap answers that well enough to point at the empty areas,
// which is all this is for.
// ---------------------------------------------------------------------------

import { SUBTOPICS } from '../src/lib/subtopics.ts';
import { SKETCHES, SKETCH_NAMES } from '../src/remotion/sketches.ts';

const STOP = new Set([
  'and', 'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'with', 'from', 'by', 'as', 'at',
  'its', 'it', 'their', 'or', 'is', 'are', 'be', 'that', 'this', 'use', 'used', 'using',
  'how', 'why', 'what', 'when', 'where', 'one', 'two', 'three', 'up', 'down', 'out', 'into',
  'each', 'every', 'them', 'they', 'has', 'have', 'not', 'no', 'all', 'any', 'more', 'most',
  'basics', 'basic', 'problems', 'problem', 'questions', 'question', 'rule', 'rules', 'law',
  'laws', 'type', 'types', 'kind', 'kinds', 'shown', 'show', 'shows',
]);

const words = (s) => new Set(
  String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w)),
);

// Every sketch as a bag of words: its name, its label and its description.
const sketchWords = SKETCH_NAMES.map((name) => ({
  name,
  bag: words(name + ' ' + SKETCHES[name].label + ' ' + SKETCHES[name].describe),
}));

const overlap = (a, b) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

const rows = [];
for (const [subject, list] of Object.entries(SUBTOPICS)) {
  for (const topic of list) {
    const bag = words(subject + ' ' + topic);
    const scored = sketchWords
      .map((s) => ({ name: s.name, score: overlap(bag, s.bag) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    rows.push({ subject, topic, best: scored[0], count: scored.length });
  }
}

const covered = rows.filter((r) => r.count > 0);
const bare = rows.filter((r) => r.count === 0);

// Per subject, so the empty AREAS show up rather than scattered single topics.
const bySubject = new Map();
for (const r of rows) {
  const s = bySubject.get(r.subject) || { total: 0, bare: 0 };
  s.total++;
  if (r.count === 0) s.bare++;
  bySubject.set(r.subject, s);
}

if (process.argv.includes('--gaps')) {
  for (const r of bare) console.log(r.subject + '  |  ' + r.topic);
  process.exit(0);
}

console.log('sketches          : ' + SKETCH_NAMES.length);
console.log('sub-topics        : ' + rows.length);
console.log('with a candidate  : ' + covered.length
  + '  (' + Math.round((covered.length / rows.length) * 100) + '%)');
console.log('with nothing      : ' + bare.length);
console.log('');
console.log('Emptiest areas (sub-topics with no candidate sketch):');
[...bySubject.entries()]
  .filter(([, s]) => s.bare > 0)
  .sort((a, b) => b[1].bare - a[1].bare)
  .slice(0, 22)
  .forEach(([subject, s]) => {
    console.log('  ' + String(s.bare).padStart(3) + ' / ' + String(s.total).padEnd(3) + '  ' + subject);
  });
