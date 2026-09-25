// Run: node tools/ports.test.mjs
//
// What `npm run free-ports` is allowed to stop. Only this studio's own Vite
// and helper - never anything else that happens to hold the port. Getting this
// wrong would stop somebody else's program.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOurs } from './ports.mjs';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('\nours');

test('this folder\'s Vite, as Windows reports it', () => {
  assert(isOurs('"node"   "' + ROOT + '\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js"'));
});

test('the helper, started the way npm start starts it', () => {
  assert(isOurs('"C:\\Program Files\\nodejs\\node.exe" server/index.mjs'));
  assert(isOurs('node server\\index.mjs'));
});

test('case and slash direction do not matter', () => {
  assert(isOurs('node ' + ROOT.toUpperCase().replace(/\\/g, '/') + '/node_modules/vite/bin/vite.js'));
});

console.log('\nnot ours - left alone');

test('another project\'s Vite', () => {
  assert(!isOurs('"node" "C:\\Users\\someone\\other-app\\node_modules\\vite\\bin\\vite.js"'));
});

test('a program that merely listens on the same port', () => {
  assert(!isOurs('"C:\\Program Files\\nodejs\\node.exe" -e "require(\'net\').createServer().listen(5173)"'));
});

test('a different server that happens to be called index.mjs', () => {
  assert(!isOurs('node api/index.mjs'));
  assert(!isOurs('node myserver/index.mjs'));
});

test('something that is not node at all', () => {
  assert(!isOurs('C:\\Windows\\System32\\svchost.exe -k LocalService'));
});

test('an unknown command line is never ours', () => {
  assert(!isOurs('') && !isOurs(undefined) && !isOurs(null));
});

console.log('\n' + passed + ' checks passed');
