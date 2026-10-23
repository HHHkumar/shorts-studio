// Run: node server/equipment.test.mjs
//
// The approved equipment drawings on disk: what can be approved, what is
// kept, and what can never be reached from the browser. Every check runs in a
// folder of its own, never in the studio's public/.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addCustomKind, approveCandidate, approvedDrawings, candidatesFor, discardCandidate, equipmentView, kindsFor, readEquipment,
  saveUpload, wantedCounts, withdrawApproval,
} from './equipment.mjs';
import { judgeDrawing } from '../src/lib/drawable.ts';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const throws = (fn, pattern) => {
  try { fn(); return false; } catch (err) { return pattern.test(err.message); }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'equipment-'));
const pub = path.join(root, 'public');
const lib = path.join(root, 'library');
fs.mkdirSync(pub, { recursive: true });
fs.mkdirSync(lib, { recursive: true });
// One pixel is a picture as far as the store is concerned.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('\nan empty store');
ok('nothing is approved before anything is', Object.keys(readEquipment(pub).approved).length === 0 && approvedDrawings(pub).ids.length === 0);
ok('every catalogue kind is listed', kindsFor(pub).some((k) => k.id === 'analog-meter'));

console.log('\nfrom candidate to approved');
const up = saveUpload({ id: 'analog-meter', dataUrl: PNG, publicDir: pub });
ok('an upload is a candidate, under generated/', /^generated\/equipment\/analog-meter\/u-[a-z0-9]+\.png$/.test(up.src), up.src);
ok('and is listed as one', candidatesFor(pub, 'analog-meter')[0] === up.src);
const approved = approveCandidate({ id: 'analog-meter', src: up.src, publicDir: pub });
ok('approving copies it into equipment/, where it is committed', /^equipment\/analog-meter-[a-f0-9]{6}\.png$/.test(approved.src) && fs.existsSync(path.join(pub, approved.src)));
ok('it is recorded as uploaded, with its date', approved.source === 'uploaded' && approved.at.length > 10);
ok('the rule now shows it', judgeDrawing('an analog meter', approvedDrawings(pub).ids).outcome === 'approved');
ok('and the page can find its file', approvedDrawings(pub).srcFor('analog-meter') === approved.src);
ok('it is no longer a candidate once approved', !candidatesFor(pub, 'analog-meter').includes(up.src));

console.log('\nwhat the browser cannot do');
ok('approve a file that is not a candidate of that kind', throws(() => approveCandidate({ id: 'motor', src: up.src, publicDir: pub }), /Only a drawing made or uploaded for motor/));
ok('approve a path that climbs out', throws(() => approveCandidate({ id: 'analog-meter', src: 'generated/equipment/analog-meter/../../../secret.png', publicDir: pub }), /Only a drawing/));
ok('approve for a kind that does not exist', throws(() => approveCandidate({ id: 'flux-capacitor', src: up.src, publicDir: pub }), /no equipment called/));
ok('upload something that is not a picture', throws(() => saveUpload({ id: 'motor', dataUrl: 'data:text/html;base64,PGgxPg==', publicDir: pub }), /PNG, JPEG or WebP/));
ok('throw away an approved drawing', throws(() => discardCandidate({ id: 'analog-meter', src: approved.src, publicDir: pub }), /Only a candidate/));

console.log('\nreplaced and withdrawn drawings keep their files');
const second = saveUpload({ id: 'analog-meter', dataUrl: PNG, publicDir: pub });
const next = approveCandidate({ id: 'analog-meter', src: second.src, publicDir: pub });
ok('a second approval replaces the first', next.src !== approved.src && approvedDrawings(pub).srcFor('analog-meter') === next.src);
ok('and the first file is still there, for videos that show it', fs.existsSync(path.join(pub, approved.src)));
withdrawApproval({ id: 'analog-meter', publicDir: pub });
ok('withdrawn, it is no longer offered', approvedDrawings(pub).ids.length === 0 && judgeDrawing('an analog meter', approvedDrawings(pub).ids).outcome === 'none');
ok('and its file is kept too', fs.existsSync(path.join(pub, next.src)));
ok('both are on record as withdrawn', readEquipment(pub).withdrawn.length === 2);

console.log('\nthe creator\'s own kinds');
addCustomKind({ name: 'Buchholz relay', draw: 'a Buchholz relay: a small gas-collecting chamber in the pipe between the tank and the conservator', publicDir: pub });
ok('a kind added by name is listed, and matched by that name', kindsFor(pub).some((k) => k.id === 'buchholz-relay')
  && judgeDrawing('a buchholz relay on the pipe', [], kindsFor(pub)).wanted.includes('buchholz-relay'));
ok('the same name twice is refused', throws(() => addCustomKind({ name: 'Buchholz relay', draw: 'something long enough to pass', publicDir: pub }), /already on the list/));
ok('a kind with no description of what to draw is refused', throws(() => addCustomKind({ name: 'Stator', draw: 'a stator', publicDir: pub }), /Describe what the drawing should show/));

console.log('\nwhat the saved videos asked for');
fs.writeFileSync(path.join(lib, 'v-20260101-000000-aaaa.json'), JSON.stringify({
  design: { animatedEngineer: true },
  content: { script: [
    { kind: 'explain', doodle: { subject: 'mascot', action: 'points', emotion: 'curious', props: 'an ammeter', gag: 'none' } },
    { kind: 'explain', doodle: { subject: 'illustration', action: 'a transformer and a voltmeter', emotion: '', props: '', gag: 'none' } },
    { kind: 'hook', doodle: { subject: 'mascot', action: 'waves', emotion: 'happy', props: '', gag: 'none' } },
  ] },
}));
const counts = wantedCounts(pub, lib);
ok('equipment named in saved directions is counted', counts['analog-meter'] === 2 && counts.transformer === 1, JSON.stringify(counts));
const view = equipmentView(pub, lib);
ok('the page puts the most wanted first', view.kinds[0].id === 'analog-meter' && view.kinds[0].wanted === 2);

fs.rmSync(root, { recursive: true, force: true });
console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
