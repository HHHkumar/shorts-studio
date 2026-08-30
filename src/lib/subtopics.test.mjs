import fs from 'node:fs';
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const sub = fs.readFileSync(new URL('./subtopics.ts', import.meta.url), 'utf8');

const listOf = (name) => {
  const m = api.match(new RegExp('export const ' + name + '[^=]*= \\[([\\s\\S]*?)\\];'));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};
// Keys in SUBTOPICS: quoted or bare identifiers before a colon + [
const keys = [...sub.matchAll(/^  (?:'([^']+)'|([A-Za-z]+)): \[/gm)].map((m) => m[1] || m[2]);

const subjects = listOf('SUBJECTS');
const electrical = listOf('ELECTRICAL_SUBJECTS');
const all = [...subjects, ...electrical];

const missing = all.filter((s) => !keys.includes(s));
const orphan = keys.filter((k) => !all.includes(k));

console.log('general subjects   :', subjects.length);
console.log('electrical areas   :', electrical.length);
console.log('subtopic lists     :', keys.length);
console.log('');
console.log('subjects with NO suggestions :', missing.length ? missing.join(', ') : 'none');
console.log('lists for a dead subject     :', orphan.length ? orphan.join(', ') : 'none');
console.log('');
const counts = [...sub.matchAll(/^  (?:'([^']+)'|([A-Za-z]+)): \[([\s\S]*?)\n  \],/gm)]
  .map((m) => [m[1] || m[2], [...m[3].matchAll(/'/g)].length / 2]);
console.log('total suggestions  :', counts.reduce((n, c) => n + c[1], 0));
const pg = counts.find((c) => c[0] === 'Power Generation');
console.log('power generation   :', pg ? pg[1] + ' sub-topics' : 'MISSING');
const thin = counts.filter((c) => c[1] < 7);
console.log('thin lists (<7)    :', thin.length ? thin.map((c) => c[0] + '=' + c[1]).join(', ') : 'none');
process.exit(missing.length || orphan.length ? 1 : 0);
