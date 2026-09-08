import fs from 'node:fs';
import { APTITUDE_STYLE, aptitudeLines, examLines } from './gemini.mjs';
import { aptitudeBrief } from './explainer.mjs';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };

// The dropdowns live in the browser bundle and the prompt guidance lives here.
// Nothing but this check keeps the two in step, and a mismatch is silent: the
// creator picks a paper and the prompt quietly falls back to a different one.
const api = fs.readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const listOf = (name) => {
  const m = api.match(new RegExp('export const ' + name + '[^=]*= \\[([\\s\\S]*?)\\];'));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};

const exams = listOf('APTITUDE_EXAMS');
const sections = listOf('APTITUDE_SUBJECTS');

ok('the exam list was found in api.ts', exams.length > 0, 'found=' + exams.length);
ok('the section list was found in api.ts', sections.length > 0, 'found=' + sections.length);

const unstyled = exams.filter((e) => !APTITUDE_STYLE[e]);
ok('every exam in the dropdown has a style here', unstyled.length === 0, unstyled.join(', '));

const orphanStyles = Object.keys(APTITUDE_STYLE).filter((e) => !exams.includes(e));
ok('no style describes an exam the dropdown does not offer', orphanStyles.length === 0, orphanStyles.join(', '));

ok('the sections cover the numerical half',
   sections.some((s) => /Percentage/i.test(s)) && sections.some((s) => /Time, Speed/i.test(s)));
ok('the sections cover reasoning',
   sections.some((s) => /Syllogism/i.test(s)) && sections.some((s) => /Puzzles/i.test(s)));
ok('the sections cover the rest of the paper',
   sections.some((s) => /English/i.test(s))
   && sections.some((s) => /Current Affairs/i.test(s))
   && sections.some((s) => /Computer/i.test(s)));

// --- routing ------------------------------------------------------------------
const apt = (over = {}) => examLines({
  contentType: 'aptitude', subject: 'Time, Speed & Distance', exam: 'SSC CGL / CHSL', ...over,
}).join('\n');

ok('aptitude routes to the aptitude brief', /COMPETITIVE APTITUDE PRACTICE/.test(apt()));
ok('electrical still routes to its own brief',
   /EXAM PREPARATION/.test(examLines({ contentType: 'electrical', subject: 'Power Systems', exam: 'GATE EE' }).join('\n')));
ok('a curiosity video gets no exam framing at all',
   examLines({ contentType: 'general', subject: 'Physics' }).length === 0);

// The two briefs must not bleed into each other: an aptitude question has no
// per-phase values, and an electrical one has no alligation.
ok('the aptitude brief carries no electrical framing',
   !/per-phase|root three|Indian engineering practice/i.test(apt()));

// --- what makes the question teachable ----------------------------------------
ok('names the chosen paper', apt().includes('SSC CGL / CHSL'));
ok('names the section and fences it', apt().includes('Time, Speed & Distance') && /Stay inside it/.test(apt()));
ok('carries that paper’s style', apt().includes(APTITUDE_STYLE['SSC CGL / CHSL'].slice(0, 30)));

ok('demands the method, not just the answer', /teach the method/i.test(apt()));
ok('demands one step per scene', /one step per scene/i.test(apt()));
ok('demands the method be named aloud', /Name the approach out loud/i.test(apt()));
ok('demands the shortcut and its time saving', /shortcut/i.test(apt()) && /time it saves/i.test(apt()));
ok('demands the distractors be real mistakes', /mistake a real candidate makes/i.test(apt()));
ok('forbids random padding options', /Never pad with a random number/i.test(apt()));
ok('requires it to be solvable against a clock', /clock/i.test(apt()));
ok('requires exactly one defensible answer', /exactly one defensible answer/i.test(apt()));

// --- the exam actually changes the instruction --------------------------------
const ssc = apt();
const cat = apt({ exam: 'CAT / XAT / MBA entrance' });
ok('a different paper produces different guidance', ssc !== cat);
ok('CAT is told to hide an insight', /insight/i.test(cat));
ok('SSC is told to stay mental', /mental/i.test(ssc));

// A form saved before this feature, or switched over from electrical, carries an
// exam that means nothing here. It must fall back, not interpolate "undefined".
const stale = apt({ exam: 'GATE EE' });
ok('an exam from the other mode falls back to a real one', stale.includes('SSC CGL / CHSL'));
ok('a missing exam does not leak undefined', !/undefined/.test(apt({ exam: undefined })));

// --- the long-form mapping ----------------------------------------------------
const brief = aptitudeBrief({ exam: 'Banking — IBPS / SBI PO & Clerk' }).join('\n');

ok('the explainer brief exists and names the paper', brief.includes('Banking — IBPS / SBI PO & Clerk'));
ok('it is framed as a method lesson', /METHOD LESSON/.test(brief));
ok('it wants the viewer able to solve, not just to appreciate', /able to solve/i.test(brief));
ok('it uses the process panel for the steps', /`process`/.test(brief));
ok('it uses the versus panel for the shortcut', /`versus`/.test(brief));
ok('it uses the grid panel for the trap', /`grid`/.test(brief));
ok('it asks for a second example so the pattern transfers', /second, slightly different example/i.test(brief));
ok('it asks for a screenshot-able recap', /screenshot/i.test(brief));

// The default explainer brief says pictures instead of equations, which is
// wrong here - the working IS the picture. Make sure this overrides it.
ok('it overrides the no-equations default', /Show the arithmetic/i.test(brief));
ok('it keeps the numbers followable', /without pausing/i.test(brief));
ok('a brief with no exam still reads correctly', !/undefined|\(\)/.test(aptitudeBrief({}).join('\n')));

// aptitudeLines is what examLines delegates to; make sure it is not a stub.
ok('aptitudeLines is substantial', aptitudeLines({ subject: 'Algebra' }).length > 20);

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall aptitude checks passed');
process.exit(fails ? 1 : 0);
