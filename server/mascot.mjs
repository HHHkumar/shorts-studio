// ---------------------------------------------------------------------------
// The mascot: one doodle engineer, drawn the same way in every video.
//
// A recurring character is what turns a run of explainer shorts into a channel
// somebody recognises in a feed. It only works if the character is actually
// the same every time - and image models drift. By the sixth scene the hard
// hat is gone and the head is a different shape.
//
// Three things hold the character still, and this module owns all three:
//
//   THE BIBLE. A written description repeated word for word in every prompt.
//   Few features, all distinctive: a model holds three strong traits far
//   better than ten weak ones.
//
//   THE MODEL SHEET. One approved drawing of the character, kept in
//   public/mascot/ and committed to the repo, so both machines draw the same
//   engineer. Every scene is drawn against it as a reference image.
//
//   ITS OWN REFERENCE LINE. The backdrop pipeline asks a reference for "same
//   treatment, different subject" - which, for a character, is exactly the
//   wrong instruction. This one asks for the same character, doing something
//   new, and nothing else copied.
//
// Words never go in the picture. Image models misspell labels, and a label
// that is wrong on screen is worse than none, so the renderer adds text.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { readGeneratedImage } from './stock.mjs';

/**
 * The look: a quick marker sketch on white paper, with red as the only colour.
 *
 * Red is not decoration here, it is meaning. Anything electrical and live is
 * red - sparks, current, the probe tip, the wire that bites - so the colour
 * tells the viewer where the danger or the action is before they have read a
 * word. That is a rule an electrical channel can own.
 */
export const DOODLE_LOOK = [
  'Hand-drawn doodle cartoon in black marker ink on plain white paper.',
  'Loose, slightly wobbly single-weight lines, like a quick whiteboard sketch.',
  'Flat: no shading, no gradients, no texture, no grey.',
  'The only colour is one bright red, used sparingly for the lightning bolt on the hat and for',
  'anything electrical and live: sparks, current, live wires, a probe tip.',
  'Doodle symbols such as question marks, exclamation marks and lightning bolts are fine.',
  'No words, letters, numbers or labels anywhere in the picture - and no written sound effects',
  'either: no zzz, zap, bzzt, boom, pow or anything like them, and no speech bubbles.',
].join(' ');

/**
 * How wild one scene is drawn. Chosen per scene by src/lib/doodle.ts, which
 * caps the dial by scene kind.
 *
 * This used to be one sentence inside the look - "sweat drops, stress
 * squiggles and zig-zag zap marks" - which put all of it in every scene. The
 * test's calm teaching beat came back sweating beside a sparking probe it was
 * never given. So calm names what to leave out, including sparks on anything
 * the scene did not ask to be live.
 */
export const ENERGY_LINES = {
  calm: 'Energy: calm. A clear, relaxed pose and a simple, readable expression. No sweat drops, '
    + 'no stress squiggles, no zap marks, no sparks and no motion lines. Nothing electrical, live '
    + 'or sparking unless the props name it.',
  lively: 'Energy: lively. An expressive pose and face, with at most one or two small marks where the '
    + 'emotion needs them, such as a sweat drop or a few motion lines. Sparks only on something the '
    + 'props name as live.',
  chaotic: 'Energy: chaotic. Full cartoon: an exaggerated pose, motion lines, sweat drops, stress '
    + 'squiggles and red zig-zag zap marks.',
};

const energyLine = (energy) => ENERGY_LINES[energy] || ENERGY_LINES.lively;

/** What every drawing of the engineer must get right. */
const BIBLE = [
  'THE CHARACTER - draw the engineer exactly like this, every time:',
  'a stick-figure electrical engineer.',
  'Head: a perfectly round white circle outlined in black, no hair.',
  'On the head: a white hard hat outlined in black, with one small solid red lightning bolt on the front.',
  'Face: two small solid black dot eyes and a simple one-line mouth; no nose, no ears, no eyebrows',
  'unless the emotion needs them.',
  'Body: arms and legs are single black lines; hands are small plain circles; feet are short flat strokes.',
  'Proportions never change: the head is about a quarter of the engineer\'s height.',
].join(' ');

/**
 * Four directions for the character, each adding ONE trait to the bible.
 *
 * One trait each so that the choice is a real choice - four near-identical
 * stick figures would ask the creator to judge noise. Whichever is adopted,
 * its trait becomes part of the bible for good.
 */
export const MASCOT_VARIANTS = [
  { id: 'classic', label: 'Classic — just the hat', trait: 'Body: a single straight black line.' },
  {
    id: 'specs',
    label: 'Specs — round glasses',
    trait: 'Body: a single straight black line. The engineer wears round black-rimmed glasses.',
  },
  {
    id: 'defenders',
    label: 'Ear defenders — site-ready',
    trait: 'Body: a single straight black line. The engineer wears chunky black ear defenders, '
      + 'one round cup over each side of the head, joined by a band over the hard hat.',
  },
  {
    id: 'shirt',
    label: 'T-shirt — a little more body',
    trait: 'Body: a small solid black T-shirt shape instead of a single line; arms and legs are '
      + 'still single black lines.',
  },
];

export const DEFAULT_VARIANT = MASCOT_VARIANTS[0].id;

const variantOf = (id) => MASCOT_VARIANTS.find((v) => v.id === id) || MASCOT_VARIANTS[0];

/** The whole character description for one variant. */
export function bibleFor(variantId) {
  return BIBLE + ' ' + variantOf(variantId).trait;
}

/**
 * Asking a reference image for the same CHARACTER, not the same style.
 *
 * The line names what to take from the reference and, just as importantly,
 * what to leave: its pose and its background. Without the second half the
 * model tends to redraw the model sheet with a prop added.
 */
export const CHARACTER_MATCH_LINE = [
  'The attached image is the model sheet for this character.',
  'Draw this exact same engineer - same round head, same hard hat with the red lightning bolt,',
  'same face, same line weight and proportions - doing what is described above.',
  'Take only the character from the reference. Do not copy its pose or its background.',
].join(' ');

/**
 * The same sheet, used the other way: for an illustration it is a STYLE
 * reference, so a drawing of a transformer has the engineer's line and red
 * and paper - and must not have the engineer in it.
 */
export const ILLUSTRATION_MATCH_LINE = [
  'The attached image shows the drawing style to match: the same black marker line, the same',
  'single red, the same white paper. Draw the subject described above in exactly that style.',
  'Do not draw the character from the reference, or any person, face or figure.',
].join(' ');

/** The picture that becomes the model sheet, if it is chosen. */
export function mascotDesignPrompt(variantId) {
  return [
    DOODLE_LOOK,
    bibleFor(variantId),
    'Draw the engineer once, full body, standing and facing the viewer, relaxed and friendly,',
    'one hand raised in a wave and the other at the side.',
    'Centred, filling about two thirds of the height of the frame.',
    'Plain white paper behind, and nothing else in the picture at all.',
  ].join('\n\n');
}

// --- the test ----------------------------------------------------------------

/**
 * Six beats of one real question, written by hand for the test.
 *
 * Hand-written on purpose: the test is whether the CHARACTER holds, and a
 * model writing the scene directions would be a second variable in the same
 * experiment. The beats walk through the emotional range a video needs -
 * puzzled, alarmed, thinking, zapped, triumphant, teaching - because a
 * character that survives only its calm poses has not survived.
 *
 * The question: an energy meter's disc keeps turning with every load switched
 * off. The answer is creeping.
 *
 * Each beat is directed as action, emotion, props and gag - the shape the
 * scene writer will use once this test says the idea works.
 */
export const TEST_BEATS = [
  {
    id: 'hook',
    energy: 'lively',
    label: 'Hook — puzzled',
    action: 'stands in front of a wall-mounted electricity meter, head tilted, scratching the side of the hard hat',
    emotion: 'puzzled',
    props: 'a wall-mounted electricity meter with a round window showing a flat disc',
    gag: 'three small doodled question marks floating above the head',
  },
  {
    id: 'question',
    energy: 'lively',
    label: 'Question — alarmed',
    action: 'points at the meter with one arm straight out, leaning back',
    emotion: 'alarmed, eyes wide, mouth a small round O',
    props: 'the same meter, its disc drawn with red spin motion lines; a switched-off lamp and an unplugged plug on the floor',
    gag: 'a single sweat drop flying off the head',
  },
  {
    id: 'think',
    energy: 'calm',
    label: 'Thinking',
    action: 'sits cross-legged on the floor, chin resting on one hand',
    emotion: 'concentrating, eyes looking up',
    props: 'a thought cloud above the head containing a tiny spinning disc',
    gag: 'small curly squiggles around the head for thinking hard',
  },
  {
    id: 'zap',
    energy: 'chaotic',
    label: 'Gag — zapped',
    action: 'touches a tangle of wires with a multimeter probe and gets a harmless cartoon zap; body stiff, arms out',
    emotion: 'shocked, eyes as spirals',
    props: 'a handheld multimeter in one hand, a tangle of black wires with one red live wire',
    gag: 'red zig-zag zap lines all around the body, and the hard hat lifted an inch above the head by the shock',
  },
  {
    id: 'answer',
    energy: 'lively',
    label: 'Answer — got it',
    action: 'jumps in the air with both arms raised',
    emotion: 'delighted, huge grin',
    props: 'a lightbulb drawn in red outline glowing above the head',
    gag: 'motion lines under the feet and little stars around the bulb',
  },
  {
    id: 'explain',
    energy: 'calm',
    label: 'Explain — teaching',
    action: 'stands beside a blank whiteboard, pointing at it with a marker pen',
    emotion: 'confident and friendly, small smile',
    props: 'a large blank whiteboard on a stand, nothing written on it',
    gag: 'none - a calm teaching beat',
  },
];

/**
 * One scene with the engineer in it.
 *
 * The engineer is the hero of the frame, not a backdrop. That is the opposite
 * of every other picture this studio draws, which is why it has its own
 * composition lines.
 *
 * Two framings:
 *   'tall'   - the lab's 9:16 test, with white space above and below.
 *   'square' - a video scene. The renderer puts the words in their own band
 *              beside the picture rather than over it, so the drawing is
 *              composed tight, with a margin of empty paper all round that the
 *              renderer fades out to blend the picture into the page.
 */
export function doodleScenePrompt(beat, variantId, { energy, framing = 'tall' } = {}) {
  const say = (s) => String(s || '').trim().replace(/[.\s]+$/, '');
  const gag = beat.gag && !/^none/i.test(beat.gag) ? 'Gag: ' + say(beat.gag) + '.' : '';

  // An illustration: the thing itself, drawn the way a teacher sketches on a
  // whiteboard - no character, so no bible, and nothing about a face.
  if (beat.subject === 'illustration') {
    return [
      DOODLE_LOOK,
      energyLine(energy || beat.energy),
      [
        'THE PICTURE: ' + say(beat.action) + '.',
        beat.emotion ? 'Mood: ' + say(beat.emotion) + '.' : '',
        beat.props ? 'Also in it: ' + say(beat.props) + '.' : '',
        gag,
      ].filter(Boolean).join(' '),
      'No people, faces, hands or characters anywhere in this picture - only the things named.',
      [
        'Square picture. The subject drawn large and clear in the middle, simple enough to read at a',
        'glance on a phone, like a teacher\'s quick sketch on a whiteboard. Everything else is plain',
        'white paper. Keep a margin of empty paper all round - nothing touches the edges.',
      ].join(' '),
    ].join('\n\n');
  }

  const direction = [
    'THE SCENE: the engineer ' + say(beat.action) + '.',
    'Emotion: ' + say(beat.emotion) + '.',
    beat.props ? 'Props: ' + say(beat.props) + '.' : '',
    gag,
  ].filter(Boolean).join(' ');

  const composition = framing === 'square'
    ? [
      'Square picture. The engineer is drawn large and whole, head to feet, in the middle, with the',
      'named props close by. Only the props named are drawn; everything else is plain white paper.',
      'Keep a margin of empty paper all round - nothing touches the edges.',
    ]
    : [
      'The engineer is the centre of the picture, drawn large and whole, head to feet.',
      'Only the props named are drawn; everything else is plain white paper.',
      'Leave clear white space above and below for words to be added later.',
    ];

  return [
    DOODLE_LOOK,
    energyLine(energy || beat.energy),
    bibleFor(variantId),
    direction,
    composition.join(' '),
  ].join('\n\n');
}

// --- the approved mascot, on disk ---------------------------------------------

/** Where the approved model sheet lives. Committed - both machines need it. */
const DIR = 'mascot';
const META = 'mascot.json';
/** The only file names this module will ever read or write. */
const SHEET_FILE = /^mascot\.(jpg|png|webp)$/;

/** The adopted mascot, or null if none has been chosen yet. */
export function readMascot(publicDir) {
  const metaPath = path.join(publicDir, DIR, META);
  if (!fs.existsSync(metaPath)) return null;
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
  if (!meta || !SHEET_FILE.test(String(meta.file || ''))) return null;
  if (!fs.existsSync(path.join(publicDir, DIR, meta.file))) return null;
  return {
    src: DIR + '/' + meta.file,
    variant: variantOf(meta.variant).id,
    label: variantOf(meta.variant).label,
    model: String(meta.model || ''),
    adoptedAt: String(meta.adoptedAt || ''),
  };
}

/** The model sheet as a reference image, or null. */
export function readMascotImage(publicDir) {
  const mascot = readMascot(publicDir);
  if (!mascot) return null;
  const file = path.join(publicDir, mascot.src);
  const buffer = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { base64: buffer.toString('base64'), mimeType };
}

/**
 * Make one of the drawn designs THE mascot.
 *
 * The path comes from the browser, so it goes through the same validation as
 * every other generated image - and must also be one of the design drawings,
 * under generated/mascot/, so this cannot be pointed at a scene backdrop or at
 * anything else in public/.
 */
export function adoptMascot({ src, variant, model = '', publicDir, now = new Date() }) {
  const rel = String(src || '');
  if (!/^generated\/mascot\//.test(rel)) throw new Error('Only a drawn mascot design can be adopted.');
  const image = readGeneratedImage({ src: rel, publicDir });
  if (!image) throw new Error('That design is no longer on disk. Draw the designs again.');

  const ext = image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const dir = path.join(publicDir, DIR);
  fs.mkdirSync(dir, { recursive: true });

  // One model sheet, ever: an older one in another format would otherwise sit
  // beside it and be the one somebody opens by mistake.
  for (const f of fs.readdirSync(dir)) if (SHEET_FILE.test(f)) fs.unlinkSync(path.join(dir, f));

  const file = 'mascot.' + ext;
  fs.writeFileSync(path.join(dir, file), Buffer.from(image.base64, 'base64'));
  fs.writeFileSync(path.join(dir, META), JSON.stringify({
    file,
    variant: variantOf(variant).id,
    model: String(model || ''),
    adoptedAt: now.toISOString(),
  }, null, 2) + '\n');

  return readMascot(publicDir);
}
