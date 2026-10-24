// Run: node server/timing-script.test.mjs
//
// A timing diagram in a script, as Gemini writes one, through the same
// normaliser every script goes through: kept when it is complete and its one
// stated fact holds, not drawn - with the reason on the scene - when not.

import { normalizeContent } from './gemini.mjs';
import { describePicture } from './picture-words.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

const quiz = (visual) => normalizeContent({
  subject: 'Digital Electronics', topic: 'JK flip-flop',
  question: 'A JK flip-flop has J = K = 1 for four clock pulses, starting with Q = 0. What is Q after each pulse?',
  options: ['1010', '1100', '0101', '1111'], correctIndex: 0,
  script: [
    { kind: 'question', narration: 'A JK flip-flop has J = K = 1 for four clock pulses, starting with Q = 0. What is Q after each pulse?' },
    { kind: 'explain', narration: 'With J and K both 1, every clock edge toggles Q: one, zero, one, zero.', visual },
  ],
}, { subject: 'Digital Electronics', topic: 'JK flip-flop', contentType: 'electrical' });
const scene = (c) => c.script.find((s) => s.kind === 'explain');

const good = quiz({ kind: 'sketch', sketch: 'timing-diagram', params: { mode: 'jk-flipflop', network: 'J=1111; K=1111', labelB: 'Q = 1010' } });
ok('a complete timing diagram whose fact holds is kept', scene(good).visual.kind === 'sketch' && scene(good).visual.sketch === 'timing-diagram', JSON.stringify(scene(good).pictureNote || ''));

const wrong = quiz({ kind: 'sketch', sketch: 'timing-diagram', params: { mode: 'jk-flipflop', network: 'J=1111; K=1111', labelB: 'Q = 1100' } });
ok('one that states a Q the circuit does not give is not drawn, and says why',
  scene(wrong).visual.kind === 'none' && /circuit gives 1010/.test(scene(wrong).pictureNote || ''), scene(wrong).pictureNote);

const noMode = quiz({ kind: 'sketch', sketch: 'timing-diagram', params: { network: 'J=1111; K=1111' } });
ok('one that does not say which circuit it is is not drawn', scene(noMode).visual.kind === 'none', scene(noMode).pictureNote);

const latch = quiz({ kind: 'sketch', sketch: 'timing-diagram', params: { mode: 'sr-latch', network: 'S=11; R=11' } });
ok('a latch with S and R both 1 is not drawn', scene(latch).visual.kind === 'none' && /together/.test(scene(latch).pictureNote || ''), scene(latch).pictureNote);

ok('the reviewer reads the simulated waves, not the settings',
  /Timing diagram of jk flip-flop over 4 cycles: J = 1111, K = 1111, Q = 1010/i.test(describePicture(scene(good).visual)), describePicture(scene(good).visual));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
