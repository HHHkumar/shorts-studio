// Replay the picture rules over videos already made.
//
//   node tools/picture-replay.mjs [library-or-bench-folder]
//
// Every saved video still holds the pictures the model asked for. This runs
// each one past the rules a new script now faces - the sketch contract, the
// number-source rule and the label fit - and prints which would be drawn today and which would
// be dropped, with the reason. It answers "what do the rules actually catch?"
// on real scripts instead of invented examples, and costs nothing to run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSketch } from '../server/sketch-contract.mjs';
import { sourceNumbers, unsourcedInVisual } from '../server/number-source.mjs';
import { cutLabels } from '../server/sketch-fit.mjs';
import { workedOutProblems } from '../server/sketch-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(ROOT, process.argv[2] || 'library');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

let kept = 0;
let dropped = 0;
for (const f of files) {
  let entry;
  try { entry = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const c = entry.content || entry;
  if (!c || !Array.isArray(c.script)) continue;
  const source = sourceNumbers(c);
  const lines = [];
  c.script.forEach((s, i) => {
    const v = s && s.visual;
    if (!v || (v.kind !== 'sketch' && v.kind !== 'bars')) return;
    const what = v.kind === 'sketch' ? v.sketch + ' ' + JSON.stringify(v.params || {}) : 'bars ' + (v.items || []).map((it) => it.value).join(', ');
    const problems = v.kind === 'sketch' ? checkSketch(v.sketch, v.params || {}, v.items || []) : [];
    const bad = unsourcedInVisual(v, source);
    if (bad.length) problems.push('shows ' + bad.join(', ') + ', which the video never gives');
    if (v.kind === 'sketch' && !problems.length) problems.push(...workedOutProblems(v.sketch, v.params, v.items));
    if (v.kind === 'sketch' && v.sketch !== 'circuit' && !problems.length) {
      const cut = cutLabels(v.sketch, v.params || {}, v.items || []);
      if (cut.length) problems.push('"' + cut[0].label + '" would be cut to "' + cut[0].drawn + '"');
    }
    if (problems.length) dropped++; else kept++;
    lines.push('  ' + (problems.length ? 'DROP' : 'keep') + '  ' + String(i).padStart(2) + '  ' + what.slice(0, 96) + (problems.length ? '\n          - ' + problems.join('; ') : ''));
  });
  if (lines.length) console.log('\n' + (c.topic || f) + '\n' + lines.join('\n'));
}
console.log('\n' + kept + ' would be drawn, ' + dropped + ' would be dropped, of ' + (kept + dropped));
