import { SUBTOPICS } from '../subtopics.ts';
import { PLAN, coverageOf } from './coverage.ts';
import { FAMILIES } from './index.ts';

let fails = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (extra ? '  ' + extra : '')); if (!c) fails++; };

const missing = [];
for (const [subject, list] of Object.entries(SUBTOPICS)) {
  for (const sub of list) if (!coverageOf(subject, sub)) missing.push(subject + ': ' + sub);
}
ok('every subtopic is drawn by a family, served by illustration, or needs no diagram', missing.length === 0, missing.slice(0, 5).join(' | '));

const planned = new Set(PLAN.map((f) => f.id));
const orphans = FAMILIES.map((f) => f.type).filter((t) => !planned.has(t));
ok('every built family is in the plan, so its subtopics are counted', orphans.length === 0, orphans.join(', '));
ok('plan ids are unique', planned.size === PLAN.length);
for (const f of FAMILIES) {
  ok(f.type + ': has a label, a prompt and a subject filter', !!f.label && f.docs.length > 0 && f.fits instanceof RegExp);
}

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall coverage checks passed');
process.exit(fails ? 1 : 0);
