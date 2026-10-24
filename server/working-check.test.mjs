// Run: node server/working-check.test.mjs
//
// Does a worked solution add up: every line of numbers equal to the one
// before it, and the last equal to the correct option. The workings below
// are the shapes Gemini writes; the first two are from saved videos.

import { checkWorking, evaluateWorking, latexToMath, optionValue } from './working-check.mjs';
import { holdWorkingToItsSums } from './formulas.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const T = String.raw;

console.log('\nreading the notation');
ok('a fraction, a root and a power', latexToMath(T`\frac{325}{\sqrt{2}}`) === '((325)/(sqrt(2)))', latexToMath(T`\frac{325}{\sqrt{2}}`));
ok('a nested fraction and an nth root', latexToMath(T`\frac{1}{\frac{1}{4} + \frac{1}{4}}`) !== null && latexToMath(T`\sqrt[3]{27}`) === 'nthRoot(27,3)');
ok('times, pi, degrees and the thin space before a unit',
  latexToMath(T`2 \times \pi \times 50 \times 0.1`) === '2 * pi * 50 * 0.1' && /deg/.test(latexToMath(T`\cos 60^{\circ}`)) && latexToMath(T`5\,\Omega`) === '5 Ω');
ok('thousands separators are not decimal commas', latexToMath('1,500') === '1500');

console.log('\nwhat is arithmetic and what is algebra');
const seen = evaluateWorking([T`|Z| = \sqrt{R^2 + (X_L - X_C)^2}`, T`= \sqrt{4^2 + (12 - 9)^2}`, T`= \sqrt{16 + 9}`, T`= 5\,\Omega`]);
ok('the formula line is skipped, the three lines of numbers are read', seen.length === 3 && seen.map((v) => v.value).join() === '5,5,5', JSON.stringify(seen.map((v) => v.value)));
ok('a line that still has letters in it is not evaluated', evaluateWorking([T`= \frac{V}{R}`, T`= 2R`]).length === 0);
ok('both sides of a line with two equals signs are read', evaluateWorking([T`= \frac{325}{\sqrt{2}} = 229.8\,V`]).length === 2);

console.log('\nworkings that add up');
const saved = [
  [[T`|Z| = \sqrt{R^2 + (X_L - X_C)^2}`, T`= \sqrt{4^2 + (12 - 9)^2}`, T`= \sqrt{16 + 9}`, T`= 5\,\Omega`], '5 ohms'],
  [[T`Z = \sqrt{R^2 + (X_L - X_C)^2}`, T`= \sqrt{4^2 + (7 - 4)^2}`, T`= \sqrt{16 + 9}`, T`= 5\,\Omega`], '5 ohms'],
  [[T`V_{rms} = \frac{V_0}{\sqrt{2}}`, T`= \frac{325}{\sqrt{2}}`, T`= \frac{325}{1.414}`, T`= 230\,V`], '230 V'],
  [[T`X_L = 2\pi f L`, T`= 2 \times \pi \times 50 \times 0.1`, T`= 31.4\,\Omega`], '31.4 Ω'],
  [[T`R = R_1 + R_2`, T`= 1.2\,k\Omega + 1000`, T`= 2200\,\Omega`], '2.2 kΩ'],
  [[T`E = P \times t`, T`= 2\,kW \times 5\,h`, T`= 10\,kWh`], '10 units'],
  [[T`\eta = \frac{P_{out}}{P_{in}} \times 100\%`, T`= \frac{4600}{5000} \times 100\%`, T`= 92\%`], '92%'],
  [[T`R_{sh} = \frac{R_m}{\frac{I}{I_m} - 1}`, T`= \frac{99}{999}`, T`\approx 0.099\,\Omega`], '0.099 ohms'],
  [[T`BW = \frac{\omega_0}{Q}`, T`= \frac{1000}{10}`, T`= 100\,\text{rad/s}`], '100 rad/s'],
];
ok('a rounded last step after \\approx is still read', evaluateWorking([T`= \frac{99}{999}`, T`\approx 0.099\,\Omega`]).length === 2);
ok('rad/s is read as a unit', evaluateWorking([T`= 100\,\text{rad/s}`]).length === 1);
for (const [lines, answer] of saved) {
  const r = checkWorking(lines, answer);
  ok('"' + lines[lines.length - 1] + '" for ' + answer, r.problems.length === 0, r.problems.join(' '));
}

console.log('\nworkings that do not');
const slip = checkWorking([T`Z = \sqrt{R^2 + X^2}`, T`= \sqrt{3^2 + 4^2}`, T`= \sqrt{9 + 16}`, T`= 25\,\Omega`], '5 ohms');
ok('a step that does not follow is caught, and named', slip.problems.length === 1 && /Line 4 comes to 25, but line 3 before it comes to 5/.test(slip.problems[0]), slip.problems.join(' '));
const sum = checkWorking([T`P = VI`, T`= 230 \times 5`, T`= 1250\,W`], '1150 W');
ok('a wrong product is caught', sum.problems.length === 1, sum.problems.join(' '));
const ends = checkWorking([T`I = \frac{V}{R}`, T`= \frac{12}{4}`, T`= 3\,A`], '4 A');
ok('a right sum that ends at the wrong option is caught', ends.problems.length === 1 && /ends at 3 A, but the answer is 4 A/.test(ends.problems[0]), ends.problems.join(' '));
const units = checkWorking([T`R = \frac{V}{I}`, T`= \frac{10}{5\,mA}`], '2 kΩ');
ok('units it cannot settle are not taken for an error', units.problems.length === 0, units.problems.join(' '));

console.log('\nreading an option');
ok('"2.2 kΩ" is 2200 ohms, "5 ohms" is 5, "92%" is 92', optionValue('2.2 kΩ').si === 2200 && optionValue('5 ohms').si === 5 && optionValue('92%').value === 92);
ok('an option with two numbers, or none, is not one answer', optionValue('5 A and 3 A') === null && optionValue('Both together') === null);
ok('no working, or no numbers, is nothing to check', checkWorking([], '5 A').problems.length === 0 && checkWorking(['P = VI'], '').checked === 0);

console.log('\non the formula card');
const quiz = { options: ['3 A', '4 A', '12 A', '48 A'], correctIndex: 0 };
const good = holdWorkingToItsSums({ title: 't', cards: [], working: [T`I = \frac{V}{R}`, T`= \frac{12}{4}`, T`= 3\,A`] }, quiz);
ok('a working that adds up stays on the card', good.working.length === 3 && !good.workingNote);
const bad = holdWorkingToItsSums({ title: 't', cards: [{ name: 'Ohm' }], working: [T`I = \frac{V}{R}`, T`= \frac{12}{4}`, T`= 4\,A`] }, quiz);
ok('one that does not is taken off, the cards stay, and the card says why',
  !bad.working && bad.cards.length === 1 && /left out: Line 3 comes to 4, but line 2 before it comes to 3/.test(bad.workingNote), bad.workingNote);

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
