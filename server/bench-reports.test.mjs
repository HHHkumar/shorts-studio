// Run: node server/bench-reports.test.mjs
//
// "Wrong picture": a diagram reported from a video in progress lands on the
// test bench marked wrong by you; a doodle lands in bench/drawings.json with
// what the picture rule would do with it today. All in a folder of its own.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { benchView, drawingReportsView, readCase, readDrawingReports, readMarks, reportDrawing, reportPicture } from './bench.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const throws = (fn, pattern) => {
  try { fn(); return false; } catch (err) { return pattern.test(err.message); }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-reports-'));
fs.mkdirSync(path.join(root, 'public'), { recursive: true });

const bars = { kind: 'bars', caption: 'Current, A', items: [{ label: 'Branch 1', value: 2 }, { label: 'Branch 2', value: 3 }] };
const content = {
  subject: 'Basic Electrical Engineering', topic: 'Kirchhoff current law',
  question: 'Two branches carry 2 A and 3 A into a node. What leaves it?',
  options: ['5 A', '1 A', '6 A', '0 A'], correctIndex: 0,
  script: [
    { kind: 'question', narration: 'Two branches carry 2 A and 3 A into a node. What leaves it?' },
    { kind: 'explain', narration: 'The 2 A and the 3 A add.', visual: bars },
    { kind: 'outro', narration: 'Follow for more.' },
  ],
};

console.log('\na diagram reported wrong');
const first = reportPicture(root, { videoId: 'v-20261024-101010-abcd', content, design: { layout: 'doodle' }, scene: 1, note: 'the bars are in the wrong order' });
ok('the video becomes a bench case under its own id', first.caseId === 'b-v-20261024-101010-abcd' && fs.existsSync(path.join(root, 'bench', 'cases', first.caseId + '.json')));
const mark = readMarks(root)[first.caseId][first.key];
ok('the picture is marked wrong, by you, with what you said', mark && mark.mark === 'wrong' && mark.by === 'you' && /wrong order/.test(mark.note), JSON.stringify(mark));
ok('and it counts on the bench', benchView(root).score.marked === 1);

const again = reportPicture(root, { videoId: 'v-20261024-101010-abcd', content, design: {}, scene: 1, note: '' });
ok('reported twice, it is the same case and the same mark', again.caseId === first.caseId && Object.keys(readMarks(root)[first.caseId]).length === 1);

const edited = { ...content, script: content.script.map((l, i) => (i === 1 ? { ...l, visual: { ...bars, caption: 'Current in amps' } } : l)) };
const later = reportPicture(root, { videoId: 'v-20261024-101010-abcd', content: edited, design: {}, scene: 1, note: 'still wrong' });
ok('a different picture in the same video gets a case that holds it', later.caseId === first.caseId + '-2' && readCase(root, later.caseId).content.script[1].visual.caption === 'Current in amps');

ok('a scene with no picture cannot be reported', throws(() => reportPicture(root, { videoId: 'v-1', content, scene: 0 }), /no picture to report/));

console.log('\na doodle reported wrong');
const line = {
  kind: 'explain', narration: 'Both wattmeters read the same.',
  doodle: { subject: 'illustration', action: 'two wattmeters connected to three supply lines', emotion: '', props: '', gag: 'none' },
  doodleSrc: 'generated/doodle/job/s4-abc.png',
};
reportDrawing(root, { videoId: 'v-x', topic: 'Two-wattmeter method', scene: 4, line, animated: true, note: 'the needles are both at zero' });
const reports = readDrawingReports(root);
ok('it is written to bench/drawings.json with what was asked for', reports.length === 1 && reports[0].direction.action.includes('wattmeters') && reports[0].note.includes('zero'));
const view = drawingReportsView(root);
ok('today the rule refuses it, and says why', view[0].today.outcome === 'none' && /circuit or a connection/.test(view[0].today.why), JSON.stringify(view[0].today));
reportDrawing(root, { topic: 'Kirchhoff', scene: 2, line: { ...line, doodle: { ...line.doodle, action: 'a tired hourglass' } }, note: 'too much sand' });
ok('one the rule would still draw is shown as such, newest first', drawingReportsView(root)[0].today.outcome === 'draw');
ok('the bench view carries them', benchView(root).drawings.length === 2);
ok('a scene with no drawing cannot be reported', throws(() => reportDrawing(root, { scene: 1, line: { kind: 'explain', narration: 'x' } }), /no drawing to report/));

fs.rmSync(root, { recursive: true, force: true });
console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
