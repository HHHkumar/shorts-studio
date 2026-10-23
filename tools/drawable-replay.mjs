// Run: node tools/drawable-replay.mjs [--all]
//
// Every doodle direction in the library, judged by today's rule: what an image
// model would still be asked to draw, what would be an approved drawing, and
// what would be left to the engineer. Prints the equipment the videos named
// most, which is the order worth approving drawings in.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawnText, judgeDrawing } from '../src/lib/drawable.ts';
import { approvedDrawings, kindsFor } from '../server/equipment.mjs';
import { drawingReportsView } from '../server/bench.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const all = process.argv.includes('--all');
// The drawings approved on the Drawings page, and the kinds the creator added.
const kinds = kindsFor(path.join(ROOT, 'public'));
const approved = approvedDrawings(path.join(ROOT, 'public')).ids;

const tally = { draw: 0, approved: 0, none: 0 };
const wanted = new Map();
const rows = [];
const dir = path.join(ROOT, 'library');
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^v-.*\.json$/.test(n)) : []) {
  let video;
  try { video = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const animated = !video.design || video.design.animatedEngineer !== false;
  for (const line of (video.content && video.content.script) || []) {
    if (!line.doodle) continue;
    const text = drawnText(line.doodle, animated);
    if (!text) continue;
    const v = judgeDrawing(text, approved, kinds);
    tally[v.outcome]++;
    for (const w of v.wanted) wanted.set(w, (wanted.get(w) || 0) + 1);
    rows.push((v.outcome === 'draw' ? 'DRAW    ' : v.outcome === 'approved' ? 'APPROVED' : 'NONE    ') + ' ' + text.slice(0, 96)
      + (v.outcome === 'none' ? '\n           -> ' + v.why : v.outcome === 'approved' ? '\n           -> ' + v.equipment : ''));
  }
}

if (all) console.log(rows.join('\n') + '\n');
const total = tally.draw + tally.approved + tally.none;
console.log(total + ' pictures directed in the library');
console.log('  ' + tally.draw + ' everyday: an image model draws them');
console.log('  ' + tally.approved + ' shown as an approved drawing');
console.log('  ' + tally.none + ' not drawn: the engineer explains');
const most = [...wanted.entries()].sort((a, b) => b[1] - a[1]);
if (most.length) {
  console.log('\nEquipment named, with no approved drawing (scenes):');
  for (const [name, n] of most) console.log('  ' + String(n).padStart(3) + '  ' + name);
}

// The doodles reported wrong with the button, and what the rule does with each today.
const reports = drawingReportsView(ROOT);
if (reports.length) {
  console.log('\nReported wrong (' + reports.length + '):');
  for (const r of reports) {
    const asked = r.direction.subject === 'illustration' ? r.direction.action : r.direction.props || r.direction.action;
    console.log('  ' + (r.today.outcome === 'draw' ? 'STILL DRAWN ' : r.today.outcome === 'approved' ? 'APPROVED    ' : 'REFUSED     ')
      + asked.slice(0, 80) + (r.note ? '  - you said: ' + r.note.slice(0, 60) : ''));
  }
}
