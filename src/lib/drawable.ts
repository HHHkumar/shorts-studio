// ---------------------------------------------------------------------------
// What an image model may draw for a doodle scene.
//
// Every diagram in a video is computed, checked against its own numbers and
// read by two reviewers. The doodles beside the engineer were not: an image
// model was asked for "two wattmeters connected to three supply lines, one
// needle resting at zero" and whatever came back went into the video. It
// cannot draw a connection it does not understand, and it never says so.
//
// So the line is drawn by what the picture would have to get RIGHT:
//
//   everyday things  - a light bulb, an hourglass, water in pipes, a seesaw.
//                      Nothing to get wrong. Drawn as before.
//   anything that    - a circuit, a connection, a curve, a symbol, field lines,
//   states a fact      a meter reading, the inside of a machine, an exact
//                      count. Never drawn: the video draws those itself, in
//                      scenes that are checked.
//   equipment        - a transformer, a motor, a tower, a meter. Shown only as
//                      the drawing a person approved (equipment.ts), never
//                      drawn afresh.
//
// When a scene is left with nothing an image model may draw, the engineer
// stands there on his own. No picture beats an unverified one.
// ---------------------------------------------------------------------------

import type { DoodleDirection, EngineerPose } from './doodle.ts';
import { EQUIPMENT, findPhrases, type EquipmentKind, type Found } from './equipment.ts';

/** What a drawing would be stating, and the words that give it away. */
const STATES_A_FACT: [RegExp, string][] = [
  [/\b(circuits?|schematics?|blueprints?|wiring|wired|series loop|in series|in parallel|connect(?:s|ed|ing|ion|ions)?|hooked up|jumpers?|short(?:ed|ing)? (?:out|across|together)|test leads?)\b/i, 'a circuit or a connection'],
  [/\b(diagrams?|charts?|graphs?|curves?|plots?|axis|axes|waveforms?|sine waves?|sinusoids?|square waves?|phasors?|vectors?|characteristics?|quarter cycle|half cycle)\b/i, 'a graph or a diagram'],
  [/\b(symbols?|(?:voltage|current|dependent|independent|diamond(?:-shaped)?|circular) sources?)\b/i, 'a circuit symbol'],
  [/\b(cross[- ]sections?|cut[- ]?aways?|exploded views?|x-ray|see-through|internals?|inner workings|the inside of|inside (?:a|an|the) (?:machine|motor|meter|transformer|generator|cable|relay|breaker|battery))\b/i, 'the inside of a machine'],
  [/\b(field lines?|flux|lines of force|magnetic fields?|electric fields?|field coils? fad\w*)\b/i, 'a field or its lines'],
  [/\b(readings?|reads|deflection|deflects|deflecting|full[- ]scale|zero (?:stop|mark|peg)|at zero|to zero|reverse direction|digits)\b/i, 'a meter reading'],
  [/\b(clockwise|anticlockwise|counter-?clockwise|polarity|north pole|south pole|(?:positive|negative) (?:terminal|plate|charge|side))\b/i, 'a direction or a polarity'],
  [/\b((?:two|three|four|five|six|several|separate|multiple) (?:separate )?panels?|panels? showing|split[- ]screen)\b/i, 'several panels, which read as a diagram'],
];

/** An arrow drawn to say something, as against one in a target. */
const ARROW = /\barrows?\b/i;
const NOT_THAT_ARROW = /\b(archery|bullseye|bow and arrow|quiver|target)\b/i;

/** More things than an image model can be trusted to count. */
const BIG_COUNT = /\b(five|six|seven|eight|nine|ten|eleven|twelve|dozen|fifteen|twenty|[5-9]|[1-9]\d+)\b(?! (?:o'?clock|minutes?|seconds?|hours?))/i;

/**
 * Parts and plant with no drawing in the catalogue. Naming one is not a fact,
 * but nobody has approved what it looks like - and the creator can add it on
 * the Drawings page, by this name, to change that.
 */
export const TECHNICAL_WORDS = [
  'winding', 'field winding', 'field coil', 'magnetic coil', 'bushing', 'conservator', 'tap changer', 'armature',
  'commutator', 'slip ring', 'brush gear', 'stator', 'rotor', 'pole shoe', 'yoke', 'lamination', 'iron core',
  'laminated core', 'transformer core', 'substation', 'switchgear', 'switchyard', 'contactor', 'rectifier',
  'inverter', 'converter', 'chopper', 'turbine', 'boiler', 'condenser', 'penstock', 'reactor', 'solenoid',
  'electromagnet', 'electrode', 'anode', 'cathode', 'semiconductor', 'circuit board', 'heat sink', 'thermocouple',
  'transducer', 'potentiometer', 'rheostat', 'variac', 'dynamo', 'exciter', 'governor', 'synchroscope',
  'insulator', 'capacitor bank', 'earthing rod', 'earth electrode', 'current transformer', 'potential transformer',
  'voltage transformer', 'instrument transformer', 'autotransformer', 'auto-transformer', 'op-amp', 'amplifier',
  'logic gate', 'microcontroller', 'stepper motor', 'servo motor', 'universal motor',
];

/** Marks a bare technical word among the kinds while both are being looked for. */
const BARE = '~';

export interface DrawingVerdict {
  /**
   * draw     - an image model may draw it.
   * approved - show the approved drawing of `equipment`, and draw nothing.
   * none     - no picture: the engineer on his own.
   */
  outcome: 'draw' | 'approved' | 'none';
  /** The kind whose approved drawing is shown. */
  equipment?: string;
  /** Why nothing is drawn, as the end of a sentence that starts "it asked for". Empty unless outcome is none. */
  why: string;
  /** Equipment it named that has no approved drawing: kind ids, then bare names. */
  wanted: string[];
}

const nameOf = (id: string, kinds: EquipmentKind[]) => (kinds.find((k) => k.id === id) || { name: id }).name.toLowerCase();

const listOf = (names: string[]) =>
  names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];

/**
 * Judge the words a picture would be drawn from.
 *
 * An approved drawing wins over everything: it is a checked picture of a thing
 * the scene names, whatever else the words went on to ask for. Short of that,
 * anything that states a fact, or names equipment nobody has approved, is not
 * drawn at all.
 */
export function judgeDrawing(text: string, approved: Iterable<string> = [], kinds: EquipmentKind[] = EQUIPMENT): DrawingVerdict {
  const said = String(text || '').replace(/\s+/g, ' ').trim();
  if (!said) return { outcome: 'none', why: 'nothing', wanted: [] };

  const ok = new Set(approved);
  // Kinds and bare words are looked for together, so that "a transformer core"
  // is a core nobody has drawn and not a transformer somebody has.
  const claimed = new Set(kinds.flatMap((k) => k.words));
  const found: Found[] = findPhrases(said, [
    ...kinds.flatMap((k) => k.words.map((phrase) => ({ id: k.id, phrase }))),
    ...TECHNICAL_WORDS.filter((w) => !claimed.has(w)).map((phrase) => ({ id: BARE + phrase, phrase })),
  ]);
  const ids = [...new Set(found.filter((f) => !f.id.startsWith(BARE)).map((f) => f.id))];
  const loose = [...new Set(found.filter((f) => f.id.startsWith(BARE)).map((f) => f.id.slice(BARE.length)))];
  const wanted = [...ids.filter((id) => !ok.has(id)), ...loose];

  const have = ids.find((id) => ok.has(id));
  if (have) return { outcome: 'approved', equipment: have, why: '', wanted };

  for (const [pattern, what] of STATES_A_FACT) {
    if (pattern.test(said)) return { outcome: 'none', why: what + ', which an image model cannot be trusted to draw', wanted };
  }
  if (ARROW.test(said) && !NOT_THAT_ARROW.test(said)) {
    return { outcome: 'none', why: 'arrows that state a direction or a size, which an image model cannot be trusted to draw', wanted };
  }
  if (BIG_COUNT.test(said)) return { outcome: 'none', why: 'an exact count of things, which an image model miscounts', wanted };

  if (wanted.length) {
    const names = [...ids.filter((id) => !ok.has(id)).map((id) => nameOf(id, kinds)), ...loose];
    return { outcome: 'none', why: 'a ' + listOf(names) + ', and no drawing of one has been approved yet', wanted };
  }
  return { outcome: 'draw', why: '', wanted: [] };
}

/**
 * The words an image model would be given for a scene. The animated engineer
 * is drawn by the renderer, so only what stands beside him is drawn; a still
 * of him, or an illustration, is drawn from everything.
 */
export function drawnText(direction: DoodleDirection | null | undefined, animated = true): string {
  if (!direction) return '';
  const gag = /^none\b/i.test(direction.gag || '') ? '' : direction.gag || '';
  const beside = animated && (direction.subject || 'mascot') === 'mascot';
  return (beside ? [direction.props, gag] : [direction.action, direction.props, gag]).filter((s) => s && s.trim()).join('. ');
}

export interface Settled {
  direction: DoodleDirection;
  /** The approved kind this scene shows, if it shows one. */
  equipment?: string;
  /** What to tell the creator, or empty. */
  note: string;
  wanted: string[];
}

/** The engineer on his own, in the pose the scene had or the one its kind takes. */
const alone = (direction: DoodleDirection, pose: EngineerPose): DoodleDirection => ({
  subject: 'mascot',
  pose: direction.pose || pose,
  action: 'stands and explains, one hand raised',
  emotion: direction.subject === 'illustration' ? 'friendly' : direction.emotion || 'friendly',
  props: '',
  gag: 'none',
});

/**
 * A direction, held to what may be drawn.
 *
 * A scene that may not be drawn is not left with a hole in it: it becomes the
 * engineer explaining, which is always true. One that names approved equipment
 * keeps its words and shows the approved drawing - as the picture itself, or
 * beside the animated engineer.
 */
export function settleDirection(
  direction: DoodleDirection,
  { approved = [], kinds = EQUIPMENT, animated = true, pose = 'teach' as EngineerPose, forced = false } = {},
): Settled {
  // An engineer scene with nothing beside him has nothing to judge.
  const text = drawnText(direction, animated);
  if (!text) return { direction, note: '', wanted: [] };

  const verdict = judgeDrawing(text, approved, kinds);
  if (verdict.outcome === 'draw' || (forced && verdict.outcome === 'none')) return { direction, note: '', wanted: verdict.wanted };

  if (verdict.outcome === 'approved') {
    // Without the animation an engineer scene is one still with him drawn in
    // it, and he cannot be drawn in beside an approved picture - so the
    // approved picture is the scene.
    const still = !animated && (direction.subject || 'mascot') === 'mascot';
    return {
      direction: still ? { ...direction, subject: 'illustration' } : direction,
      equipment: verdict.equipment,
      note: '',
      wanted: verdict.wanted,
    };
  }

  const illustration = (direction.subject || 'mascot') === 'illustration';
  const was = illustration ? 'the illustration' : 'the picture beside the engineer';
  // The animated engineer keeps his own direction - only what stood beside him
  // goes. A still of him, or an illustration, was drawn from all of it.
  const beside = animated && !illustration;
  return {
    direction: beside ? { ...direction, props: '', gag: 'none' } : alone(direction, pose),
    note: was + ' asked for ' + verdict.why + ', so the engineer explains it on his own.',
    wanted: verdict.wanted,
  };
}
