// Run: node server/block-script.test.mjs
//
// A block diagram in a script, as Gemini writes one, through the normaliser
// every script goes through: kept when it reads and its stated transfer
// function is its own, not drawn - with the reason on the scene - when not.

import { normalizeContent } from './gemini.mjs';
import { describePicture } from './picture-words.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

const SYMBOLIC = 'A system has forward path G and feedback H. What is its closed-loop transfer function?';
const quiz = (visual, question = SYMBOLIC) => normalizeContent({
  subject: 'Control Systems', topic: 'Closed-loop transfer function',
  question,
  options: ['G/(1+GH)', 'G/(1-GH)', 'GH/(1+G)', '1/(1+GH)'], correctIndex: 0,
  script: [
    { kind: 'question', narration: question },
    { kind: 'explain', narration: 'The error is R minus HC, so C equals G times that.', visual },
  ],
}, { subject: 'Control Systems', topic: 'Closed-loop transfer function', contentType: 'electrical' });
const scene = (c) => c.script.find((s) => s.kind === 'explain');

const good = quiz({ kind: 'sketch', sketch: 'block-diagram', params: { network: 'R > +A > G > C; C > H > -A', labelB: 'C/R = G/(1+GH)' } });
ok('a negative-feedback loop with the right C/R is kept', scene(good).visual.sketch === 'block-diagram', scene(good).pictureNote || '');

const wrong = quiz({ kind: 'sketch', sketch: 'block-diagram', params: { network: 'R > +A > G > C; C > H > -A', labelB: 'C/R = G/(1-GH)' } });
ok('the same loop stating the positive-feedback answer is not drawn',
  scene(wrong).visual.kind === 'none' && /different transfer function/.test(scene(wrong).pictureNote || ''), scene(wrong).pictureNote);

const broken = quiz({ kind: 'sketch', sketch: 'block-diagram', params: { network: 'R > G > C; R > H > G' } });
ok('one that adds two signals at a block is not drawn, and says where', scene(broken).visual.kind === 'none' && /at G/.test(scene(broken).pictureNote || ''), scene(broken).pictureNote);

const tf = quiz({ kind: 'sketch', sketch: 'block-diagram', params: { network: 'R > +A > G > C; C > -A', labelB: 'C/R = 10/(s+11)' }, items: [{ label: 'G', symbol: '10/(s+1)' }] },
  'A unity-feedback system has G(s) = 10/(s+1). What is its closed-loop transfer function?');
ok('a block with its own transfer function, in unity feedback, checked', scene(tf).visual.sketch === 'block-diagram', scene(tf).pictureNote || '');

const invented = quiz({ kind: 'sketch', sketch: 'block-diagram', params: { network: 'R > +A > G > C; C > H > -A' }, items: [{ label: 'G', symbol: '25/(s+4)' }] });
ok('a transfer function the question never gave is not drawn into a box', invented.script.find((s) => s.kind === 'explain').visual.kind === 'none',
  invented.script.find((s) => s.kind === 'explain').pictureNote);

ok('the reviewer reads the wiring and the stated function',
  /Block diagram from R to C: R into \(\+\) junction A, junction A into G, G into C, C into H, H into \(-\) junction A\. Stated: C\/R = G\/\(1\+GH\)/.test(describePicture(scene(good).visual)), describePicture(scene(good).visual));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
