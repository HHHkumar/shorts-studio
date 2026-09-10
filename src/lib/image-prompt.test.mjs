import { draftImagePrompt } from './image-prompt.ts';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

const content = { subject: 'Electrical Machines', topic: 'Inductors' };
const line = (o) => ({ kind: 'explain', narration: '', imageQuery: '', ...o });

// --- an explaining beat drafts from what it says ------------------------------
let d = draftImagePrompt(
  line({ narration: 'So you push current through the coil, and your magnetic field builds up.' }),
  content,
);
ok('drafts from the narration', /current through the coil/.test(d), d);
ok('drops the second person', !/\byou\b|\byour\b/i.test(d), d);
ok('drops the opening discourse word', !/^so\b/i.test(d), d);
ok('names the subject', /Electrical Machines/.test(d));

ok('a subject already said is not repeated',
   (draftImagePrompt(line({ narration: 'The rules of Physics get strange down here somewhere' }),
     { subject: 'Physics', topic: '' }).match(/Physics/g) || []).length === 1);

// --- a rhetorical beat must NOT draft from what it says -----------------------
// "Most people get this wrong" describes the viewer, not a picture. Drafting
// from it produced a prompt about nothing at all, which is what this is for.
for (const kind of ['hook', 'outro', 'intro', 'countdown', 'options', 'title', 'recap']) {
  const got = draftImagePrompt(
    line({ kind, narration: 'Most people get this one wrong. Follow for more.' }), content,
  );
  ok('"' + kind + '" ignores its rhetorical narration',
     !/most people|follow for more/i.test(got) && got.length > 0, got);
}
ok('a hook draws the topic instead',
   /Inductors/.test(draftImagePrompt(line({ kind: 'hook', narration: 'You will get this wrong.' }), content)));
ok('a hook with no topic falls back to its search words',
   draftImagePrompt(line({ kind: 'hook', imageQuery: 'copper coil' }), { subject: '', topic: '' })
     === 'copper coil');

// --- length and shape ---------------------------------------------------------
d = draftImagePrompt(line({ narration: 'word '.repeat(120) }), { subject: '', topic: '' });
ok('a long narration is clipped', d.length <= 180, String(d.length));
ok('and never mid-word or on a comma', !/\s$/.test(d) && !/[,;:]$/.test(d), JSON.stringify(d.slice(-14)));

// --- falling back -------------------------------------------------------------
ok('a thin narration falls back to the search words',
   draftImagePrompt(line({ narration: 'Yes.', imageQuery: 'copper coil' }), { subject: '', topic: '' })
     === 'copper coil');
ok('no narration and no query falls back to the topic',
   /Inductors/.test(draftImagePrompt(line({}), content)));
ok('nothing at all yields an empty string, not junk',
   draftImagePrompt(line({}), { subject: '', topic: '' }) === '');

// --- it is fed model output, so it must not throw -----------------------------
const junk = [
  [null, null], [undefined, undefined], [{}, {}],
  [line({ narration: 12345 }), content],
  [line({ narration: '   ', imageQuery: '   ' }), { subject: '  ', topic: '  ' }],
  [{ kind: 42, narration: {} }, { subject: [] }],
];
const threw = junk.filter(([l, c]) => {
  try { draftImagePrompt(l, c); return false; } catch { return true; }
});
ok('junk in never throws', threw.length === 0, String(threw.length));
ok('and always returns a string',
   junk.every(([l, c]) => { try { return typeof draftImagePrompt(l, c) === 'string'; } catch { return false; } }));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall image prompt checks passed');
process.exit(fails ? 1 : 0);
