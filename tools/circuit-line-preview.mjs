// Draw circuits from the circuit line, to see them rather than imagine them.
//
//   node --import ./tools/ts-resolve.mjs tools/circuit-line-preview.mjs [--look=simple] [--landscape]
//
// Each case is a circuit a real video needed and drew wrongly - a series RLC
// as three resistors, a line's capacitance as resistors on a battery - written
// the way the line now lets it be written. The first frame of a pair is the
// question scene, where a part marked "?" is hidden and nothing flows; the
// second is an explanation scene, with the answer out. Frames go to
// out/frames/circuit-line/, and each case's reading - or the reason it was
// refused - is printed beside it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSceneFrames } from '../server/render.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';
import { readCircuitLine } from '../src/lib/circuit-line.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const look = (process.argv.find((a) => a.startsWith('--look=')) || '--look=doodle').slice(7);
const landscape = process.argv.includes('--landscape');

const CASES = [
  { say: 'A series RLC circuit across an AC supply.', params: { network: 'R + L + C', labelA: 'Vs', mode: 'ac' } },
  { say: 'A meter of 99 ohms and its shunt share 100 milliamperes.', params: { network: 'Rm=99Ω | Rsh=1Ω?', labelA: '100 mA', mode: 'dc', labelB: 'I(Rm) = 1 mA' } },
  { say: 'The short circuit test: 30 volts drives 20 amperes through the winding impedance.', params: { network: 'Req=0.5Ω + Xeq=j1.414Ω', labelA: '30 V', mode: 'ac', labelB: 'I = 20 A' } },
  { say: 'The line draws a charging current through its shunt capacitance.', params: { network: 'L + (C | Load)', labelA: 'Vs', mode: 'ac' } },
  { say: 'The armature drop is the supply less the back EMF.', params: { network: 'Ra=0.5Ω + Eb=210V', labelA: '220 V', mode: 'dc', labelB: 'I = 20 A' } },
  { say: 'Four ohms in series with six and three in parallel.', params: { network: '4Ω + (6Ω | 3Ω)', labelB: 'R = 6 Ω' } },
  { say: 'A resistance, an inductive reactance and a capacitive one.', params: { network: 'R=3Ω + XL=8Ω + XC=4Ω', labelA: '100 V', mode: 'ac', labelB: 'I = 20 A' } },
  { say: 'An ammeter in series and a voltmeter across the load.', params: { network: 'A + (V | R=10Ω)', labelA: '12 V', mode: 'dc' } },
  { say: 'The thyristor in series with the lamp, and the switch open.', params: { network: 'R=10Ω + SCR + lamp + switch open', labelA: '230 V', mode: 'ac' } },
  { say: 'Three branches after a series resistor.', params: { network: 'R1=2Ω + (R2=6Ω | R3=3Ω | R4=2Ω)', labelA: '12 V', mode: 'dc', labelB: 'I(R3) = 1.33 A' } },
  { say: 'A ladder: series, shunt, series, shunt.', params: { network: 'R1=1Ω + (R2=2Ω | (R3=1Ω + R4=1Ω))', labelA: '6 V', mode: 'dc', labelB: 'I = 3 A' } },
  { say: 'Two in series, in parallel with two more, and a fifth.', params: { network: '(R1=1Ω + R2=2Ω) | (R3=3Ω + R4=4Ω) | R5=5Ω', labelA: '9 V', mode: 'dc' } },
];

const script = [];
for (const c of CASES) {
  const visual = { kind: 'sketch', sketch: 'circuit', caption: '', params: c.params, items: [] };
  script.push({ kind: 'question', narration: c.say, visual });
  script.push({ kind: 'explain', narration: c.say, visual });
}
const content = {
  videoKind: 'mcq', subject: 'Network Theory', topic: 'Circuits', difficulty: 'Medium', hook: '',
  question: 'A preview of the circuit line.', options: ['a', 'b', 'c', 'd'], correctIndex: 0, answerLine: '',
  explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: [], script,
};
const design = { ...DEFAULT_DESIGN, layout: look, mode: 'light', orientation: landscape ? 'landscape' : 'portrait', music: 'none', sfx: false };
const { scenes, totalDurationInFrames } = buildScenes(script, {}, design, 30, 0);
const out = await renderSceneFrames(
  { content, scenes, design, fps: 30, totalDurationInFrames },
  script.map((_, i) => i),
  { folder: 'frames/circuit-line' + (look === 'doodle' ? '' : '-' + look) + (landscape ? '-landscape' : ''), scale: 0.5 },
);

CASES.forEach((c, i) => {
  const { line, errors } = readCircuitLine(c.params);
  const frame = out.frames.find((f) => f.scene === i * 2 + 1);
  console.log('\n' + JSON.stringify(c.params));
  console.log(line ? '  ' + line.words + (line.solved ? '' : '  [drawn, not solved]') : '  REFUSED: ' + errors.join('; '));
  if (frame) console.log('  ' + path.relative(ROOT, frame.file));
});
process.exit(0);
