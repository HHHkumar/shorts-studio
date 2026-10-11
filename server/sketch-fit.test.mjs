// Run: node server/sketch-fit.test.mjs
//
// A label is drawn whole, or the sketch is not drawn. Each case is a label
// that reached a real video cut short.

import { canDrawSketches, cutLabels } from './sketch-fit.mjs';
import { answerShown } from './number-source.mjs';
import { dropAnswerOnQuestion, normalizeContent } from './gemini.mjs';

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

test('the sketches can be run here, so the check really looks', () => {
  assert(canDrawSketches(), 'the sketches did not load - every other check in this file would pass by looking at nothing');
});

test('"Keep dependent sources" would have come out as "Keep dependent sourc"', () => {
  const cut = cutLabels('misconception', { labelA: 'Kill all sources', labelB: 'Keep dependent sources' }, []);
  assert(cut.length === 1 && cut[0].drawn === 'Keep dependent sourc', JSON.stringify(cut));
});

test('"Constant Load Torque" as "Constant L", and a meter reading "Measure"', () => {
  assert(cutLabels('torque', { angle: 45, labelA: 'Constant Load Torque' }, [])[0].drawn === 'Constant L');
  assert(cutLabels('multimeter', { labelA: 'Test Source', labelB: 'Measure Response' }, [])[0].drawn === 'Measure');
});

test('labels that fit are left alone', () => {
  assert(!cutLabels('phasor', { angle: -90, labelA: 'Vr', labelB: 'Ic' }, []).length);
  assert(!cutLabels('capacitor-field', { labelA: 'Air dielectric' }, []).length);
  assert(!cutLabels('misconception', { labelA: 'Rm / m = 0.100 Ω', labelB: 'Rm / (m-1) = 0.099 Ω' }, []).length);
  assert(!cutLabels('graph', { mode: 'linear', labelA: 'Speed ω', labelB: 'Back EMF Eb' }, []).length);
});

test('the entries of a list are held to the same rule', () => {
  const cut = cutLabels('flowchart', {}, [{ label: 'Open the terminals' }, { label: 'Apply a test source at the terminals' }, { label: 'Measure' }]);
  assert(cut.some((c) => c.label === 'Apply a test source at the terminals'), JSON.stringify(cut));
  assert(!cutLabels('flowchart', {}, [{ label: 'Kill sources' }, { label: 'Apply test' }, { label: 'Measure' }]).length, 'short entries were refused');
});

test('a label the sketch never draws is nobody\'s business', () => {
  assert(!cutLabels('particles', { labelA: 'Bundled conductors here' }, []).length);
  assert(!cutLabels('not-a-sketch', { labelA: 'Something long enough' }, []).length);
});

const scene = (visual, narration = 'A meter and its shunt.') => normalizeContent({
  question: 'A galvanometer of 99 ohms reads full scale at 10 milliamperes. What shunt extends it to 10 amperes?',
  options: ['0.099 ohms', '0.99 ohms', '9.9 ohms', '99 ohms'], correctIndex: 0,
  script: [
    { kind: 'question', narration: 'A galvanometer of 99 ohms reads full scale at 10 milliamperes. What shunt extends it to 10 amperes?', visual },
    { kind: 'explain', narration, visual },
  ],
}, { subject: 'Measurements', topic: 'Shunts', difficulty: 'Medium', intro: '' }).script;

test('a script is refused a sketch whose label would be cut, and is told why', () => {
  const s = scene({ kind: 'sketch', sketch: 'misconception', params: { labelA: 'Kill all sources', labelB: 'Keep dependent sources' } });
  const line = s.find((l) => l.kind === 'explain');
  assert(line.visual.kind === 'none', 'the sketch was drawn');
  assert(/no room for "Keep dependent sources"/.test(line.pictureNote), line.pictureNote);
});

test('the question scene does not show the answer', () => {
  const circuit = { kind: 'sketch', sketch: 'circuit', params: { network: '99 | 0.099' }, items: [] };
  const video = { question: 'A 99 ohm meter. What shunt extends it to 10 amperes?', options: ['0.099 ohms', '1 ohm'], correctIndex: 0 };
  assert(answerShown(circuit, video).join() === '0.099', answerShown(circuit, video).join());
  assert(!answerShown({ ...circuit, params: { network: '99 | 5' } }, video).length, 'a number that is not the answer was called the answer');

  const s = scene(circuit, 'The shunt is 0.099 ohms beside the 99 ohm coil.');
  const q = s.find((l) => l.kind === 'question');
  assert(q.visual.kind === 'none' && /which is the answer/.test(q.pictureNote), JSON.stringify(q));
  // After the reveal, the same circuit is the explanation.
  assert(s.find((l) => l.kind === 'explain').visual.kind === 'sketch', 'the explanation lost its circuit too');
  assert(dropAnswerOnQuestion([{ kind: 'question', narration: 'q', visual: { kind: 'formula', formula: 'x = 0.099' } }], video)[0].visual.kind === 'formula', 'only sketches are looked at');
});

console.log('\n' + passed + ' checks passed');
