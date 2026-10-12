// Draw the standard characteristics, to check each against the textbook.
//
//   node --import ./tools/ts-resolve.mjs tools/curve-preview.mjs [--look=simple] [--landscape]
//
// One frame per curve in src/remotion/sketches-curves.ts - the torque of an
// induction motor against slip, series resonance, the thyristor, the B-H loop
// and the rest - as a video would show it at the end of its scene, into
// out/frames/curves/. These are fixed pictures whose whole value is that their
// shape is right, so the way to trust one is to look at it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSceneFrames } from '../server/render.mjs';
import { buildScenes } from '../src/lib/timeline.ts';
import { DEFAULT_DESIGN } from '../src/lib/theme.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const look = (process.argv.find((a) => a.startsWith('--look=')) || '--look=doodle').slice(7);
const landscape = process.argv.includes('--landscape');

const CASES = [
  { sketch: 'torque-slip', params: { mode: 'single' }, say: 'Torque rises to a maximum and falls to zero at synchronous speed.' },
  { sketch: 'torque-slip', params: { mode: 'rotor-resistance' }, say: 'Raising rotor resistance moves the peak towards standstill.' },
  { sketch: 'resonance-curve', params: { mode: 'single' }, say: 'The bandwidth lies between the two half-power points.' },
  { sketch: 'resonance-curve', params: { mode: 'q-factor' }, say: 'A higher quality factor gives a sharper curve.' },
  { sketch: 'scr-characteristic', params: {}, say: 'The latching current is higher than the holding current.' },
  { sketch: 'hysteresis-loop', params: { mode: 'loop' }, say: 'Retentivity and coercive force on the loop.' },
  { sketch: 'hysteresis-loop', params: { mode: 'soft-hard' }, say: 'Soft iron has a narrow loop, hard steel a wide one.' },
  { sketch: 'magnetisation-curve', params: {}, say: 'The curve bends over as the iron saturates.' },
  { sketch: 'transformer-efficiency', params: {}, say: 'Efficiency is greatest when copper loss equals iron loss.' },
  { sketch: 'v-curves', params: {}, say: 'Armature current is least at unity power factor.' },
  { sketch: 'dc-motor-curves', params: {}, say: 'A series motor slows steeply as the load rises.' },
  { sketch: 'power-time', params: {}, items: [{ label: 'One bulb', value: 100, symbol: '10' }, { label: 'Ten bulbs', value: 1000, symbol: '1' }], say: 'Both use one kilowatt-hour.' },
  { sketch: 'power-time', params: {}, items: [{ label: 'Heater', value: 2000, symbol: '3' }], say: 'Two kilowatts for three hours is six units.' },
  { sketch: 'phasors', params: { mode: 'fan' }, items: [{ label: 'Vr', value: 1, symbol: '0' }, { label: 'Ic', value: 0.45, symbol: '90' }], say: 'The charging current leads the receiving end voltage by ninety degrees.' },
  { sketch: 'phasors', params: { mode: 'sum' }, items: [{ label: 'Vr', value: 1, symbol: '0' }, { label: 'Ic X', value: 0.18, symbol: '180' }, { label: 'Vs', value: 0.82, symbol: '0' }], say: 'The drop subtracts, so the sending end voltage is the smaller.' },
  { sketch: 'phasors', params: { mode: 'fan' }, items: [{ label: 'V', value: 1, symbol: '0' }, { label: 'I', value: 0.7, symbol: '-60' }], say: 'The current lags the voltage by sixty degrees.' },
  { sketch: 'phasors', params: { mode: 'sum' }, items: [{ label: 'V', value: 1, symbol: '0' }, { label: 'I Xs', value: 0.5, symbol: '60' }, { label: 'E', value: 1.32, symbol: '19.1' }], say: 'The excitation voltage is the terminal voltage plus the reactance drop.' },
  { sketch: 'phasors', params: { mode: 'fan' }, items: [{ label: 'VR', value: 1, symbol: '0' }, { label: 'VL', value: 0.8, symbol: '90' }, { label: 'VC', value: 0.5, symbol: '-90' }], say: 'The inductor and capacitor voltages are in opposition.' },
];

const script = CASES.map((c) => ({
  kind: 'explain', narration: c.say,
  visual: { kind: 'sketch', sketch: c.sketch, caption: '', params: c.params, items: c.items || [] },
}));
const content = {
  videoKind: 'mcq', subject: 'Electrical Machines', topic: 'Characteristics', difficulty: 'Medium', hook: '',
  question: 'A preview of the standard characteristics.', options: ['a', 'b', 'c', 'd'], correctIndex: 0, answerLine: '',
  explanation: [], funFact: '', outro: '', hashtags: [], motifSymbols: [], script,
};
const design = { ...DEFAULT_DESIGN, layout: look, mode: 'light', orientation: landscape ? 'landscape' : 'portrait', music: 'none', sfx: false };
const { scenes, totalDurationInFrames } = buildScenes(script, {}, design, 30, 0);
const out = await renderSceneFrames(
  { content, scenes, design, fps: 30, totalDurationInFrames },
  script.map((_, i) => i),
  { folder: 'frames/curves' + (look === 'doodle' ? '' : '-' + look) + (landscape ? '-landscape' : ''), scale: 0.5 },
);
CASES.forEach((c, i) => {
  const frame = out.frames.find((f) => f.scene === i);
  console.log((frame ? path.relative(ROOT, frame.file) : '(no frame)') + '  ' + c.sketch + ' ' + JSON.stringify(c.params));
});
process.exit(0);
