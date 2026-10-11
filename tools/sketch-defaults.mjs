// What does each sketch put on screen when it is told nothing?
//
//   node --import ./tools/ts-resolve.mjs tools/sketch-defaults.mjs [name ...]
//
// A sketch given no parameters and no items should draw nothing that reads as
// a fact. This runs every one that way and prints the words and numbers it
// draws anyway - the invented phase angle, the made-up resistor value, the
// default label. Each line here is something a video could show that nobody
// stated; src/lib/sketch-contract.ts is where it is then made a requirement.

import { SKETCHES, SKETCH_NAMES } from '../src/remotion/sketches.ts';
import { sketchMarks, sketchTexts } from '../src/remotion/sketch-mock.mjs';

const only = process.argv.slice(2);
let blank = 0;
let numbers = 0;
for (const name of SKETCH_NAMES) {
  if (only.length && !only.includes(name)) continue;
  const def = SKETCHES[name];
  const texts = sketchTexts(def);
  const marks = sketchMarks(def);
  const hasNumber = texts.some((t) => /\d/.test(t));
  if (!marks) blank++;
  if (hasNumber) numbers++;
  console.log((marks ? (hasNumber ? '#' : ' ') : '-') + ' ' + name.padEnd(22) + ' [' + def.uses.slice(0, 60) + '] => ' + (marks ? texts.join(' | ').slice(0, 200) : '(blank)'));
}
console.log('\n' + blank + ' draw nothing, ' + numbers + ' print a number, of ' + SKETCH_NAMES.length);
