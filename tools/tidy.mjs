// Free the space that scratch work takes, and nothing else.
//
//   npm run tidy            say what would go, and how much
//   npm run tidy -- --yes   remove it
//
// Only folders that are made again by themselves are ever removed: the stills
// the preview tools draw, the back test's frames, and History Studio's render
// cache. Finished videos, the library, voice clips, drawings and bench frames
// are listed so you can see where the space is, and never touched - deleting
// a render is your decision, made in Explorer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YES = process.argv.includes('--yes');

/** Made again by the tool that made them, the next time it runs. */
const SCRATCH = [
  ['stills', 'stills the preview tools and the smoke test draw'],
  [path.join('out', 'backtest'), 'frames from the last back test'],
  [path.join('out', 'frames'), 'frames drawn by tools/picture-frames.mjs'],
  [path.join('studios', 'history', '.cache'), "History Studio's render cache"],
];

/** Kept, and only measured. */
const KEPT = [
  ['out', 'your finished videos and their job files'],
  [path.join('public', 'generated'), 'voice clips, doodles, backdrops, thumbnails'],
  [path.join('studios', 'history', 'media'), "History Studio's pictures, recordings and clips"],
  [path.join('studios', 'history', 'out'), "History Studio's finished videos"],
];

function sizeOf(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  let n = 0;
  for (const e of fs.readdirSync(p)) n += sizeOf(path.join(p, e));
  return n;
}

const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';

let freed = 0;
console.log(YES ? '\nRemoving scratch:' : '\nScratch that can go (run with --yes to remove it):');
for (const [rel, what] of SCRATCH) {
  const full = path.join(ROOT, rel);
  const n = sizeOf(full);
  if (!n) continue;
  freed += n;
  console.log('  ' + mb(n).padStart(8) + '  ' + rel.padEnd(28) + what);
  if (YES) fs.rmSync(full, { recursive: true, force: true });
}
if (!freed) console.log('  nothing - already tidy');
else console.log('  ' + mb(freed).padStart(8) + '  ' + (YES ? 'freed' : 'in all'));

console.log('\nKept, never touched by this:');
for (const [rel, what] of KEPT) {
  const n = sizeOf(path.join(ROOT, rel)) - (rel === 'out' ? SCRATCH.filter(([s]) => s.startsWith('out' + path.sep)).reduce((t, [s]) => t + sizeOf(path.join(ROOT, s)), 0) : 0);
  if (n > 0) console.log('  ' + mb(n).padStart(8) + '  ' + rel.padEnd(28) + what);
}
console.log('');
