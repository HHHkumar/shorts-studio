// Run: node server/publish-kit.test.mjs
//
// Chapters are the part worth testing hardest. YouTube does not complain about
// a malformed list, it silently ignores the whole thing - so a list that is one
// rule short looks exactly like a tool that never wrote one.

import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import {
  buildChapters, buildCredits, buildDescription, buildPublishKit, buildUploadSheet, slug, stamp,
} from './publish-kit.mjs';

/**
 * Pull one file back out of a zip this module made.
 *
 * Written here rather than imported so the test reads the archive the way an
 * unrelated program would - if this stops working, the zip is wrong.
 */
function unzipEntry(buf, wanted) {
  let at = 0;
  while (at + 30 < buf.length && buf.readUInt32LE(at) === 0x04034b50) {
    const csize = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const extraLen = buf.readUInt16LE(at + 28);
    const name = buf.toString('utf8', at + 30, at + 30 + nameLen);
    const dataAt = at + 30 + nameLen + extraLen;
    if (name === wanted) {
      return inflateRawSync(buf.subarray(dataAt, dataAt + csize)).toString('utf8');
    }
    at = dataAt + csize;
  }
  throw new Error('no entry called ' + wanted);
}

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

const FPS = 30;

/** Scenes laid end to end, each `seconds` long, exactly as the timeline does. */
function lay(seconds, kinds = []) {
  let cursor = 0;
  return seconds.map((s, i) => {
    const scene = {
      kind: kinds[i] || 'explain',
      narration: 'Some narration for scene ' + (i + 1) + ' here.',
      startFrame: cursor,
      durationInFrames: Math.round(s * FPS),
    };
    cursor += scene.durationInFrames;
    return scene;
  });
}

console.log('\ntimestamps');

test('under an hour is m:ss with no padded minutes', () => {
  assert.equal(stamp(0), '0:00');
  assert.equal(stamp(9), '0:09');
  assert.equal(stamp(75), '1:15');
  assert.equal(stamp(599), '9:59');
});

test('past an hour it grows a field', () => {
  assert.equal(stamp(3600), '1:00:00');
  assert.equal(stamp(3725), '1:02:05');
});

test('junk does not produce a broken stamp', () => {
  assert.equal(stamp(-5), '0:00');
  assert.equal(stamp(0.4), '0:00');
});

console.log('\nchapters');

test('a long video gets chapters, and the first is 0:00 exactly', () => {
  const chapters = buildChapters(lay([20, 20, 20, 20, 20]), FPS);
  assert.ok(chapters.length >= 3);
  assert.equal(chapters[0].seconds, 0);
  assert.equal(stamp(chapters[0].seconds), '0:00');
});

test('a short video gets none, rather than an invalid list', () => {
  // 45 seconds. YouTube would ignore the list, so offering one is worse than not.
  assert.deepEqual(buildChapters(lay([15, 15, 15]), FPS), []);
});

test('scenes under ten seconds are merged, not listed', () => {
  // Twelve five-second scenes: one chapter each would be refused outright.
  const chapters = buildChapters(lay(Array(12).fill(5)), FPS);
  assert.ok(chapters.length >= 3, 'expected a usable list, got ' + chapters.length);
  for (let i = 1; i < chapters.length; i++) {
    assert.ok(chapters[i].seconds - chapters[i - 1].seconds >= 10,
      'chapters ' + (i - 1) + ' and ' + i + ' are too close together');
  }
});

test('the last chapter always has ten seconds left to run', () => {
  // A two-second scene on the end must not become a chapter of its own.
  const chapters = buildChapters(lay([30, 30, 30, 2]), FPS);
  const last = chapters[chapters.length - 1];
  assert.ok(92 - last.seconds >= 10, 'last chapter has only ' + (92 - last.seconds) + 's');
});

test('fewer than three possible chapters means none at all', () => {
  assert.deepEqual(buildChapters(lay([60, 30]), FPS), []);
});

test('a panel title becomes the chapter name', () => {
  const scenes = lay([20, 20, 20, 20]);
  scenes[1].panel = { title: 'A way over' };
  const chapters = buildChapters(scenes, FPS);
  assert.ok(chapters.some((c) => c.title === 'A way over'), JSON.stringify(chapters));
});

test('a scene with no panel still gets a readable name', () => {
  const chapters = buildChapters(lay([20, 20, 20, 20], ['title', 'motion', 'recap', 'outro']), FPS);
  assert.ok(chapters.every((c) => c.title && c.title.length > 1 && c.title.length < 60),
    JSON.stringify(chapters));
});

test('nonsense in gives an empty list rather than a throw', () => {
  assert.deepEqual(buildChapters(null, FPS), []);
  assert.deepEqual(buildChapters(undefined, FPS), []);
  assert.deepEqual(buildChapters([{}, {}], FPS), []);
  assert.deepEqual(buildChapters([{ startFrame: 'x', durationInFrames: null }], FPS), []);
});

test('a missing frame rate falls back to the one the app uses', () => {
  // Not an empty list: every video this tool makes is 30fps, so assuming that
  // gives correct timestamps, and refusing would lose real chapters over a
  // field somebody forgot to pass.
  const chapters = buildChapters(lay([30, 30, 30]), 0);
  assert.equal(chapters.length, 3);
  assert.equal(stamp(chapters[1].seconds), '0:30');
});

console.log('\ncredits');

test('an icon set that needs a credit is called out', () => {
  const credits = buildCredits({ script: [{ panel: { actors: [{ iconName: 'game-icons:dam' }] } }] }, []);
  assert.match(credits, /A CREDIT IS REQUIRED/);
  assert.match(credits, /game-icons/);
});

test('permissive icon sets are listed as needing nothing', () => {
  const credits = buildCredits({ script: [{ panel: { actors: [{ iconName: 'mdi:fish' }] } }] }, []);
  assert.match(credits, /NO CREDIT REQUIRED/);
  assert.doesNotMatch(credits, /A CREDIT IS REQUIRED/);
});

test('stock photo credits are carried through', () => {
  const credits = buildCredits({ script: [{ stockCredit: 'Photo by A Person on Pexels' }] }, []);
  assert.match(credits, /A Person/);
});

test('the music is always declared as ours', () => {
  // The commonest worry about a generated video is a copyright claim on the
  // bed. The answer is knowable, so it is stated every time.
  assert.match(buildCredits({ script: [] }, []), /Nothing to credit/);
});

console.log('\nthe description that actually gets pasted');

test('chapters and hashtags end up inside the description', () => {
  const out = buildDescription(
    { description: 'The body.', hashtags: ['#rivers', '#salmon'] },
    [{ seconds: 0, title: 'Start' }, { seconds: 30, title: 'Middle' }],
    '',
  );
  assert.match(out, /The body\./);
  assert.match(out, /CHAPTERS/);
  assert.match(out, /0:00 Start/);
  assert.match(out, /#rivers #salmon/);
});

test('a required credit is placed in the description automatically', () => {
  assert.match(buildDescription({ description: 'B' }, [], 'Icons by game-icons (CC BY 3.0).'),
    /game-icons/);
});

test('the description is capped at what YouTube accepts', () => {
  const out = buildDescription({ description: 'x'.repeat(9000), hashtags: [] }, [], '');
  assert.ok(out.length <= 5000, out.length + ' characters');
});

console.log('\nfilenames');

test('a title becomes a safe filename', () => {
  assert.equal(slug('How does a fish get past a dam?'), 'how-does-a-fish-get-past-a-dam');
  assert.equal(slug('10 MW / 50% - really?'), '10-mw-50-really');
});

test('a title with nothing usable in it still gives a filename', () => {
  assert.equal(slug('???'), 'video');
  assert.equal(slug(''), 'video');
});

const CONTENT = {
  topic: 'Dams and fish',
  subject: 'Environment',
  question: 'How does a fish get past a dam?',
  videoKind: 'explainer',
  script: [{ kind: 'motion', panel: { actors: [{ iconName: 'mdi:fish' }] } }],
};

const SEO = {
  titles: ['How does a fish get past a dam?', 'The ladder that saved the salmon'],
  description: 'Why a wall of concrete ends a salmon run, and what fixes it.',
  tags: ['rivers', 'salmon', 'engineering'],
  hashtags: ['#rivers', '#salmon'],
  pinnedComment: 'What should we cover next?',
  thumbnailText: 'A way over',
};

console.log('\nthe upload sheet');

const sheet = (over = {}) => buildUploadSheet({
  content: CONTENT,
  design: { orientation: 'landscape' },
  seo: SEO,
  title: SEO.titles[0],
  description: 'The description body.',
  tagLine: 'rivers, salmon',
  credits: 'MUSIC AND SOUND\n  Nothing to credit.',
  hasThumbnail: true,
  ...over,
});

test('the sheet walks the upload form in order', () => {
  const text = sheet();
  const order = ['1. TITLE', '2. DESCRIPTION', '3. TAGS', '4. THUMBNAIL',
    '5. AFTER PUBLISHING', '6. CREDITS'];
  let cursor = -1;
  for (const heading of order) {
    const at = text.indexOf(heading);
    assert.ok(at > cursor, heading + ' is missing or out of order');
    cursor = at;
  }
});

test('a title within the limit shows its count, not a warning', () => {
  const text = sheet();
  assert.match(text, /1\. TITLE\s+\(\d+\/100\)/);
  assert.doesNotMatch(text, /OVER THE 100 LIMIT/);
});

test('an over-long title is flagged loudly rather than silently cut', () => {
  // Trimming it here would hand someone a title YouTube truncates mid-word,
  // which they would only discover after publishing.
  const long = 'A'.repeat(140);
  const text = sheet({ title: long });
  assert.match(text, /OVER THE 100 LIMIT/);
  assert.match(text, /140 CHARACTERS/);
  assert.ok(text.includes(long), 'the full title should still be there to edit');
});

test('a missing thumbnail says what to do about it', () => {
  assert.match(sheet({ hasThumbnail: false }), /go back to step 7/);
  assert.match(sheet({ hasThumbnail: true }), /thumbnail\.png/);
});

test('the unchosen titles are kept, since the choice is often reconsidered', () => {
  const text = sheet();
  assert.match(text, /The others you were offered/);
  assert.ok(text.includes(SEO.titles[1]));
});

test('empty fields say so rather than leaving a confusing blank', () => {
  assert.match(sheet({ tagLine: '', seo: { titles: [] } }), /\(none written\)/);
});

console.log('\nthe whole kit');

test('the kit is a real zip with everything in it', () => {
  const kit = buildPublishKit({
    content: CONTENT,
    design: { orientation: 'landscape' },
    seo: SEO,
    title: SEO.titles[0],
    scenes: lay([20, 20, 20, 20]),
    fps: FPS,
    thumbnail: Buffer.from('89504e470d0a1a0a', 'hex'),
  });
  assert.equal(kit.name, 'how-does-a-fish-get-past-a-dam-upload-kit.zip');
  // Local file header at the front, end-of-central-directory at the back.
  assert.equal(kit.buffer.readUInt32LE(0), 0x04034b50);
  assert.equal(kit.buffer.readUInt32LE(kit.buffer.length - 22), 0x06054b50);
  assert.ok(kit.hasThumbnail);
  assert.ok(kit.chapters >= 3);

  const raw = kit.buffer.toString('latin1');
  for (const name of ['UPLOAD.txt', 'title.txt', 'description.txt', 'tags.txt',
    'hashtags.txt', 'pinned-comment.txt', 'chapters.txt', 'credits.txt',
    'metadata.json', 'thumbnail.png']) {
    assert.ok(raw.includes(name), 'missing entry: ' + name);
  }
});

test('a kit without a thumbnail is still worth having', () => {
  const kit = buildPublishKit({
    content: CONTENT, design: {}, seo: SEO, title: SEO.titles[0],
    scenes: lay([20, 20, 20, 20]), fps: FPS, thumbnail: null,
  });
  assert.equal(kit.hasThumbnail, false);
  assert.ok(!kit.buffer.toString('latin1').includes('thumbnail.png'));
});

test('a kit with no metadata written yet does not throw', () => {
  const kit = buildPublishKit({
    content: CONTENT, design: {}, seo: null, title: '', scenes: [], fps: FPS, thumbnail: null,
  });
  assert.ok(kit.buffer.length > 100);
  assert.equal(kit.chapters, 0);
});

test('the machine-readable seconds agree with the printed timestamp', () => {
  // These are two views of one mark. When they disagree, a script that seeks
  // to `seconds` lands somewhere other than where the description points, and
  // nothing in the output looks wrong until you watch it.
  const kit = buildPublishKit({
    content: CONTENT, design: {}, seo: SEO, title: SEO.titles[0],
    scenes: lay([13.4, 12.7, 11.9, 16.3, 14.2]), fps: FPS, thumbnail: null,
  });
  const json = JSON.parse(unzipEntry(kit.buffer, 'metadata.json'));
  assert.ok(json.chapters.length >= 3);
  for (const c of json.chapters) {
    assert.equal(c.start, stamp(c.seconds), c.title + ': ' + c.start + ' vs ' + c.seconds + 's');
  }
});

test('the subject is left out when it only repeats the topic', () => {
  const same = { ...CONTENT, subject: CONTENT.topic };
  assert.doesNotMatch(sheet({ content: same }), /Subject:/);
});

test('a subject that says something new is kept', () => {
  const different = { ...CONTENT, subject: 'Civil engineering' };
  assert.match(sheet({ content: different }), /Subject:\s+Civil engineering/);
});

console.log('\n' + passed + ' checks passed\n');
