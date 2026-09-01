// Run: node src/lib/ambient-pick.test.mjs
//
// The picker is what makes a backdrop feel chosen rather than switched on.
//
// Node cannot import the .ts modules directly, so - following what
// subtopics.test.mjs already does here - this reads both files as text, pulls
// out the rule table and the list of backdrop names, and replays the matching
// rule on them. That covers the part that can actually go wrong: a rule naming
// a backdrop that does not exist, two rules fighting over the same word, or a
// subject falling through to the fallback when it should not. The five-line
// function that walks the table is covered by the typechecker.

import fs from 'node:fs';

const pickSrc = fs.readFileSync(new URL('./ambient-pick.ts', import.meta.url), 'utf8');
const ambientSrc = fs.readFileSync(new URL('../remotion/ambient.ts', import.meta.url), 'utf8');

let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (cond) passed++;
  else failed++;
};

// --- what the renderer actually has -----------------------------------------

const known = new Set([...ambientSrc.matchAll(/\['([a-z]+)', '[^']+'\]/g)].map((m) => m[1]));

// --- the rule table ---------------------------------------------------------

const rules = [...pickSrc.matchAll(/\{ name: '([a-z]+)', words: \[([^\]]*)\] \}/g)].map((m) => ({
  name: m[1],
  words: [...m[2].matchAll(/'([^']+)'/g)].map((w) => w[1]),
}));

const fallback = (pickSrc.match(/const DEFAULT_AMBIENT = '([a-z]+)'/) || [])[1];

/** The same walk the module does: the first rule with a word in the text wins. */
const pick = (...text) => {
  const hay = text.filter(Boolean).join(' ').toLowerCase();
  if (!hay.trim()) return fallback;
  for (const rule of rules) if (rule.words.some((w) => hay.includes(w))) return rule.name;
  return fallback;
};

console.log('\nintegrity');

ok('the library has thirty backdrops', known.size === 30, String(known.size));
ok('the rule table was parsed', rules.length >= 15, rules.length + ' rules');
ok('a fallback is defined', !!fallback, String(fallback));
ok('the fallback is a real backdrop', known.has(fallback), String(fallback));

const bad = rules.filter((r) => !known.has(r.name)).map((r) => r.name);
ok('every rule points at a backdrop that exists', bad.length === 0, bad.join(', '));

const empty = rules.filter((r) => r.words.length === 0).map((r) => r.name);
ok('no rule has an empty word list', empty.length === 0, empty.join(', '));

// A word listed under two rules means the later one can never win on it, which
// is a silently dead rule rather than a loud error.
const seen = new Map();
const clashes = [];
for (const rule of rules) {
  for (const w of rule.words) {
    if (seen.has(w)) clashes.push(w + ' (' + seen.get(w) + ' vs ' + rule.name + ')');
    else seen.set(w, rule.name);
  }
}
ok('no keyword is claimed by two rules', clashes.length === 0, clashes.join('; '));

console.log('\nsubjects reach the right backdrop');

const cases = [
  [['Power Generation', 'thermal plant load factor'], 'equaliser'],
  [['Electronics', 'transistor circuit design'], 'board'],
  [['Power Systems', 'substation feeder busbar'], 'lattice'],
  [['Astronomy', 'the orbit of a planet'], 'galaxy'],
  [['Nuclear Physics', 'fission of an atom'], 'atom'],
  [['Chemistry', 'molecular bonds'], 'mesh'],
  [['Signals', 'harmonic waveform of an inverter'], 'scope'],
  [['Climate', 'renewable wind and solar'], 'topo'],
];
for (const [input, expected] of cases) {
  const got = pick(...input);
  ok(input[0] + ' -> ' + expected, got === expected, got === expected ? '' : 'got ' + got);
}

console.log('\nbehaviour');

ok('nothing to go on falls back', pick() === fallback && pick('', '   ') === fallback);
ok('an unrelated subject falls back', pick('a completely unrelated matter') === fallback);
ok('case does not matter', pick('TURBINE') === pick('turbine'));
ok('word order does not matter', pick('a plant', 'thermal') === pick('thermal', 'a plant'));
ok(
  'the same topic always gives the same answer',
  new Set([0, 1, 2, 3].map(() => pick('Power Generation', 'turbine'))).size === 1,
);

console.log('\n' + (failed ? failed + ' FAILURES' : passed + ' checks passed') + '\n');
process.exit(failed ? 1 : 0);
