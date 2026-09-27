// ---------------------------------------------------------------------------
// A rehearsal against the real services, before a real video depends on them.
//
// The unit tests prove the code handles a well-formed reply; only the live
// model proves it sends one. This runs one sample question through the
// features that call Gemini for text - the formula card and the doodle
// directions - on the free tier, and checks what comes back has the shape the
// video needs: poses from the list, formulas that typeset, graphs that exist.
// Nothing is drawn and nothing is voiced, so it spends no credit.
// ---------------------------------------------------------------------------

import { generateFormulaSheet } from './formulas.mjs';
import { generateDoodleDirections } from './doodle-directions.mjs';
import { doodleScenes, ENGINEER_POSES } from '../src/lib/doodle.ts';
import { GRAPH_KINDS, parseMath } from '../src/lib/formula-card.ts';

/** A question every feature has something to say about. */
export const SAMPLE = {
  videoKind: 'mcq',
  subject: 'Basic Electrical Engineering',
  topic: 'Alternating current',
  difficulty: 'easy',
  question: 'A sine wave has a peak of 325 V. What is its RMS value?',
  options: ['230 V', '325 V', '162 V', '460 V'],
  correctIndex: 0,
  answerLine: 'About 230 volts.',
  explanation: ['V rms = V0 / root 2', '325 / 1.414 = 230 V'],
  funFact: 'Indian mains is 230 V RMS; its peak is 325 V.',
  outro: 'Follow for one electrical question a day.',
  hashtags: [],
  motifSymbols: [],
  script: [
    { kind: 'hook', narration: 'Your wall socket hides a number bigger than 230.' },
    { kind: 'question', narration: 'A sine wave peaks at 325 volts. What is its RMS value?' },
    { kind: 'options', narration: '230, 325, 162, or 460 volts?' },
    { kind: 'countdown', narration: '' },
    { kind: 'answer', narration: 'The answer is about 230 volts.' },
    { kind: 'explain', narration: 'Divide the peak by root two: 325 over 1.414 is 230.' },
    { kind: 'outro', narration: 'Follow for one electrical question a day.' },
  ],
};

const check = (name, ok, detail = '') => ({ name, ok: Boolean(ok), detail });

/** Judge a formula sheet from the live model. Pure, so it is tested without a network. */
export function judgeSheet(sheet) {
  if (!sheet) return [check('Formula card written', false, 'No usable card came back.')];
  const cards = sheet.cards || [];
  // A formula the parser read as nothing but words has lost its maths - usually
  // LaTeX commands written without their backslashes.
  const flat = cards.filter((c) => parseMath(c.formula).every((n) => n.t === 'text' && n.style === 'word'));
  return [
    check('Formula card written', cards.length >= 2, cards.length + ' cards'),
    check('Every formula typesets', !flat.length, flat.length ? 'Read as plain words: ' + flat.map((c) => c.formula).join('; ') : ''),
    check('Graphs from the list', cards.every((c) => GRAPH_KINDS.includes(c.graph.kind)),
      cards.map((c) => c.graph.kind).join(', ')),
    check('Some cards have a graph', cards.some((c) => c.graph.kind !== 'none')),
    check('Every card has an icon', cards.every((c) => c.icon), cards.filter((c) => !c.icon).map((c) => c.name).join(', ')),
  ];
}

/** Judge doodle directions from the live model. */
export function judgeDirections(directions, scenes) {
  const got = scenes.map((i) => directions[i]).filter(Boolean);
  const mascot = got.filter((d) => (d.subject || 'mascot') === 'mascot');
  const posed = mascot.filter((d) => d.pose && ENGINEER_POSES.includes(d.pose));
  const poses = posed.map((d) => d.pose);
  const repeats = poses.filter((p, i) => i > 0 && p === poses[i - 1]).length;
  return [
    check('Every scene directed', got.length === scenes.length, got.length + ' of ' + scenes.length),
    check('The engineer is in some scenes', mascot.length > 0),
    check('Every engineer scene has a pose', posed.length === mascot.length,
      (mascot.length - posed.length) + ' without a pose from the list'),
    check('Poses vary', repeats === 0, poses.join(', ')),
  ];
}

export async function liveCheck({ apiKey, model, root }) {
  const results = [];
  try {
    const sheet = await generateFormulaSheet({ apiKey, model, content: SAMPLE, root });
    results.push(...judgeSheet(sheet));
  } catch (e) {
    results.push(check('Formula card written', false, e.message));
  }
  try {
    const scenes = doodleScenes(SAMPLE.script, true);
    const out = await generateDoodleDirections({ apiKey, model, content: SAMPLE, scenes, energy: 'lively', animated: true });
    results.push(...judgeDirections(out.directions, scenes));
  } catch (e) {
    results.push(check('Every scene directed', false, e.message));
  }
  return results;
}
