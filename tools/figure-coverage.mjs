// ---------------------------------------------------------------------------
// How much of the syllabus has a computed figure.
//
//     node --import ./tools/ts-resolve.mjs tools/figure-coverage.mjs
//     node --import ./tools/ts-resolve.mjs tools/figure-coverage.mjs --list
//
// --list prints every subtopic under the family, illustration or text heading
// it lands in, so the classification can be read and argued with.
// ---------------------------------------------------------------------------

import { SUBTOPICS } from '../src/lib/subtopics.ts';
import { PLAN, coverageOf } from '../src/lib/figures/coverage.ts';
import { FAMILIES } from '../src/lib/figures/index.ts';

export function measure() {
  const byFamily = new Map(PLAN.map((f) => [f.id, []]));
  const illustration = [];
  const text = [];
  const missing = [];
  for (const [subject, list] of Object.entries(SUBTOPICS)) {
    for (const sub of list) {
      const c = coverageOf(subject, sub);
      const name = subject + ': ' + sub;
      if (!c) missing.push(name);
      else if (c.kind === 'text') text.push(name);
      else if (c.kind === 'illustration') illustration.push(name);
      else byFamily.get(c.family.id).push(name);
    }
  }
  return { byFamily, illustration, text, missing };
}

if (process.argv[1] && process.argv[1].endsWith('figure-coverage.mjs')) {
  const { byFamily, illustration, text, missing } = measure();
  const total = [...byFamily.values()].reduce((s, l) => s + l.length, 0) + illustration.length + text.length + missing.length;
  const built = new Set(FAMILIES.map((f) => f.type));
  let covered = 0;
  console.log('\nFIGURE FAMILIES, in build order\n');
  for (const f of PLAN) {
    const n = byFamily.get(f.id).length;
    const done = built.has(f.id);
    if (done) covered += n;
    console.log('  ' + (done ? '[built]  ' : '[planned]') + '  ' + String(n).padStart(3) + '  ' + f.label);
    if (process.argv.includes('--list')) byFamily.get(f.id).forEach((t) => console.log('               - ' + t));
  }
  const computed = [...byFamily.values()].reduce((s, l) => s + l.length, 0);
  console.log('\n  subtopics drawn by a computed figure family: ' + computed);
  console.log('    of which built: ' + covered + ' (' + Math.round((covered / computed) * 100) + '%)');
  console.log('  descriptive, served by illustrations:        ' + illustration.length);
  console.log('  no diagram helps:                            ' + text.length);
  if (process.argv.includes('--list')) {
    console.log('\nILLUSTRATION'); illustration.forEach((t) => console.log('  - ' + t));
    console.log('\nTEXT ONLY'); text.forEach((t) => console.log('  - ' + t));
  }
  if (missing.length) {
    console.log('\nUNCLASSIFIED (' + missing.length + ')');
    missing.forEach((t) => console.log('  - ' + t));
  }
  console.log('\n  total ' + total);
}
