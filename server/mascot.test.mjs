// Run: node server/mascot.test.mjs
//
// The doodle mascot: that every prompt carries the same character, that the
// reference line asks for the character rather than a different subject, and
// that adopting a design cannot be pointed at anything but a design.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  adoptMascot, bibleFor, CHARACTER_MATCH_LINE, DEFAULT_VARIANT, DOODLE_LOOK, doodleScenePrompt,
  MASCOT_VARIANTS, mascotDesignPrompt, readMascot, readMascotImage, TEST_BEATS,
} from './mascot.mjs';
import { saveImageBuffer } from './stock.mjs';

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
const throws = (fn, pattern, message) => {
  try { fn(); } catch (err) {
    if (pattern.test(err.message)) return;
    throw new Error(message + ' - threw the wrong thing: ' + err.message);
  }
  throw new Error(message + ' - did not throw');
};

/** A throwaway public/ folder, so nothing touches the real mascot. */
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-test-'));
/** One pixel of PNG - enough to be a real image on disk. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

console.log('\nthe character');

test('every variant keeps the core of the bible', () => {
  for (const v of MASCOT_VARIANTS) {
    const bible = bibleFor(v.id);
    assert(/round/.test(bible) && /hard hat/.test(bible) && /red lightning bolt/.test(bible),
      v.id + ' lost a core trait');
  }
});

test('each variant adds something the others do not', () => {
  const traits = MASCOT_VARIANTS.map((v) => bibleFor(v.id));
  assert(new Set(traits).size === traits.length, 'two variants describe the same character');
});

test('an unknown variant falls back to the default rather than to nothing', () => {
  assert(bibleFor('no-such-thing') === bibleFor(DEFAULT_VARIANT));
});

test('the look forbids lettering, because image models misspell it', () => {
  assert(/No words, letters, numbers or labels/.test(DOODLE_LOOK));
});

test('red is the only colour, and it means electricity', () => {
  assert(/only colour is one bright red/.test(DOODLE_LOOK));
  assert(/electrical and live/.test(DOODLE_LOOK));
});

console.log('\nthe prompts');

test('a design prompt is the look, the character and a plain pose - no scene', () => {
  const p = mascotDesignPrompt('specs');
  assert(p.includes(DOODLE_LOOK) && p.includes(bibleFor('specs')), 'missing look or bible');
  assert(/nothing else in the picture/.test(p), 'a model sheet must be the character alone');
});

test('every test scene carries the same bible, word for word', () => {
  const bible = bibleFor('defenders');
  for (const beat of TEST_BEATS) {
    assert(doodleScenePrompt(beat, 'defenders').includes(bible), beat.id + ' dropped the bible');
  }
});

test('a scene prompt puts the engineer in the middle, whole', () => {
  const p = doodleScenePrompt(TEST_BEATS[0], DEFAULT_VARIANT);
  assert(/centre of the picture/.test(p) && /head to feet/.test(p));
});

test('a scene leaves room for the words the renderer adds', () => {
  assert(/white space above and below/.test(doodleScenePrompt(TEST_BEATS[1], DEFAULT_VARIANT)));
});

test('a beat with no gag says nothing about one', () => {
  const calm = TEST_BEATS.find((b) => /^none/i.test(b.gag));
  assert(calm, 'expected one calm beat in the test');
  assert(!/Gag:/.test(doodleScenePrompt(calm, DEFAULT_VARIANT)), 'wrote "Gag: none" into the prompt');
});

test('the six beats cover calm, alarm and the zap - not six calm poses', () => {
  const emotions = TEST_BEATS.map((b) => b.emotion).join(' ');
  assert(TEST_BEATS.length === 6, 'the test is six scenes');
  assert(/alarmed/.test(emotions) && /shocked/.test(emotions) && /confident/.test(emotions));
});

test('no beat asks for writing on the whiteboard', () => {
  const board = TEST_BEATS.find((b) => /whiteboard/.test(b.props));
  assert(board && /blank/.test(board.props) && /nothing written/.test(board.props));
});

console.log('\nthe reference line');

test('it asks for the same character, never a different subject', () => {
  assert(!/different subject/i.test(CHARACTER_MATCH_LINE),
    'the backdrop line would tell the model NOT to draw the character');
  assert(/exact same engineer/.test(CHARACTER_MATCH_LINE));
});

test('it says what to leave behind: the pose and the background', () => {
  assert(/Do not copy its pose or its background/.test(CHARACTER_MATCH_LINE));
});

console.log('\nadopting a design');

test('with nothing adopted there is no mascot, not a crash', () => {
  const dir = scratch();
  assert(readMascot(dir) === null && readMascotImage(dir) === null);
});

test('a drawn design becomes the model sheet, with its variant recorded', () => {
  const dir = scratch();
  const saved = saveImageBuffer({ buffer: PNG, mimeType: 'image/png', id: 'specs', jobId: 'design-x', publicDir: dir, folder: 'mascot' });
  const m = adoptMascot({ src: saved.src, variant: 'specs', model: 'gemini-3-pro-image', publicDir: dir, now: new Date('2026-09-25T10:00:00Z') });
  assert(m.src === 'mascot/mascot.png', 'wrong file: ' + m.src);
  assert(m.variant === 'specs' && m.model === 'gemini-3-pro-image' && m.adoptedAt === '2026-09-25T10:00:00.000Z');
  const img = readMascotImage(dir);
  assert(img && img.mimeType === 'image/png' && Buffer.from(img.base64, 'base64').equals(PNG), 'sheet not readable');
});

test('adopting again replaces the sheet rather than leaving two', () => {
  const dir = scratch();
  const a = saveImageBuffer({ buffer: PNG, mimeType: 'image/png', id: 'a', jobId: 'd1', publicDir: dir, folder: 'mascot' });
  adoptMascot({ src: a.src, variant: 'classic', publicDir: dir });
  const b = saveImageBuffer({ buffer: PNG, mimeType: 'image/jpeg', id: 'b', jobId: 'd2', publicDir: dir, folder: 'mascot' });
  adoptMascot({ src: b.src, variant: 'shirt', publicDir: dir });
  const sheets = fs.readdirSync(path.join(dir, 'mascot')).filter((f) => /^mascot\.(jpg|png|webp)$/.test(f));
  assert(sheets.length === 1 && sheets[0] === 'mascot.jpg', 'left: ' + sheets.join(', '));
  assert(readMascot(dir).variant === 'shirt');
});

test('a scene backdrop cannot be adopted as the mascot', () => {
  const dir = scratch();
  const saved = saveImageBuffer({ buffer: PNG, mimeType: 'image/png', id: 'scene', jobId: 'job', publicDir: dir, folder: 'ai' });
  throws(() => adoptMascot({ src: saved.src, variant: 'classic', publicDir: dir }), /Only a drawn mascot design/, 'adopted a backdrop');
});

test('a path out of public/ is refused', () => {
  const dir = scratch();
  throws(() => adoptMascot({ src: 'generated/mascot/../../../secret.png', variant: 'classic', publicDir: dir }),
    /no longer on disk/, 'followed a traversal');
});

test('a design that has been deleted says so', () => {
  const dir = scratch();
  throws(() => adoptMascot({ src: 'generated/mascot/design-x/gone.png', variant: 'classic', publicDir: dir }),
    /no longer on disk/, 'adopted a missing file');
});

test('a hand-edited mascot.json pointing elsewhere is ignored', () => {
  const dir = scratch();
  fs.mkdirSync(path.join(dir, 'mascot'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mascot', 'mascot.json'), JSON.stringify({ file: '../../etc/passwd', variant: 'classic' }));
  assert(readMascot(dir) === null && readMascotImage(dir) === null);
});

console.log('\n' + passed + ' checks passed');
