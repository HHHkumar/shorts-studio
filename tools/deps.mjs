// Are the packages this studio needs installed? Run before `npm start`.
//
// The studio is worked on from two computers through git. A `git pull` that
// brings a new package (the map packages History Studio's news graphics use,
// say) and no `npm install` used to end in a stack trace from deep inside the
// helper or a blank page - a long way from "run npm install". This says it
// first, by name, before anything is launched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The packages package.json names that node_modules does not have. */
export function missingPackages(root = ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const wanted = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  return wanted.filter((name) => !fs.existsSync(path.join(root, 'node_modules', ...name.split('/'), 'package.json')));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const missing = missingPackages();
  if (missing.length) {
    console.error('');
    console.error('  Some packages the studio needs are not installed:');
    console.error('    ' + missing.slice(0, 12).join(', ') + (missing.length > 12 ? ' and ' + (missing.length - 12) + ' more' : ''));
    console.error('');
    console.error('  This happens after a git pull that added one. Run this once, then start again:');
    console.error('');
    console.error('    npm install');
    console.error('');
    process.exit(1);
  }
}
