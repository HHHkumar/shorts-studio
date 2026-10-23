// Bring a standalone History Studio's projects into this app.
//
//   node tools/import-history.mjs [path-to-history-studio]
//
// History Studio used to be its own program in a history-studio folder beside
// this one, and its projects were never committed: each computer has its own.
// This copies them in - the project files, the pictures and clips they are
// made of, and the finished videos - so they open under "History & news".
//
// It only ever copies. Nothing in the old folder is changed or removed, and a
// file already here is never overwritten, so it is safe to run twice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.resolve(process.argv[2] || path.join(ROOT, '..', 'history-studio'));
const TO = path.join(ROOT, 'studios', 'history');

// [what, from inside the old folder, to inside studios/history]
const PARTS = [
  ['projects', 'projects', 'projects'],
  ['pictures and clips', path.join('public', 'projects'), 'media'],
  ['finished videos', 'out', 'out'],
];

if (!fs.existsSync(path.join(FROM, 'package.json')) || !fs.existsSync(path.join(FROM, 'projects'))) {
  console.error('No History Studio projects found in ' + FROM + '.');
  console.error('Pass the folder: node tools/import-history.mjs C:\\path\\to\\history-studio');
  process.exit(1);
}

/** Copy a tree, keeping every file that is already here. Returns [copied, kept]. */
function copyTree(from, to) {
  let copied = 0;
  let kept = 0;
  if (!fs.existsSync(from)) return [0, 0];
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) {
      const [c, k] = copyTree(a, b);
      copied += c;
      kept += k;
    } else if (fs.existsSync(b)) {
      kept++;
    } else {
      fs.copyFileSync(a, b);
      copied++;
    }
  }
  return [copied, kept];
}

console.log('From ' + FROM);
for (const [what, from, to] of PARTS) {
  const [copied, kept] = copyTree(path.join(FROM, from), path.join(TO, to));
  console.log('  ' + what.padEnd(19) + copied + ' copied' + (kept ? ', ' + kept + ' already here' : ''));
}
console.log('\nOpen Shorts Studio and press "History & news" to see them.');
