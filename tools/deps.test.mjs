// Run: node tools/deps.test.mjs
//
// The check before `npm start`: it names the packages package.json wants and
// node_modules lacks, and says nothing when everything is there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { missingPackages } from './deps.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

ok('this checkout has everything it needs', missingPackages().length === 0, missingPackages().join(', '));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-'));
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
  dependencies: { 'd3-geo': '3.1.1', '@remotion/player': '4.0.518' }, devDependencies: { typescript: '7' },
}));
fs.mkdirSync(path.join(root, 'node_modules', 'typescript'), { recursive: true });
fs.writeFileSync(path.join(root, 'node_modules', 'typescript', 'package.json'), '{}');
const missing = missingPackages(root);
ok('after a pull that added packages, each missing one is named, scoped ones too', missing.join() === 'd3-geo,@remotion/player', missing.join());
fs.rmSync(root, { recursive: true, force: true });

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
