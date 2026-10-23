// The checks. Run with:  npm test
//
// Exercises the real modules (TypeScript included, via tools/ts-resolve.mjs)
// rather than copies of their logic.

import assert from 'node:assert/strict';
import { splitScript, estimateWords, countWords, sentences, isStale, blankScene, newShot, findWord } from '../src/lib/script.ts';
import { buildTimeline, buildShortTimeline, resolveMotion, youtubeChapters, wordTime } from '../src/lib/timeline.ts';
import { migrateProject } from '../src/lib/migrate.ts';
import { applySuggestions, defaultCallout } from '../src/lib/callouts.ts';
import { keyPixels, greenness } from '../src/lib/chroma.ts';
import { cameraAt, parallax } from '../src/remotion/camera.ts';
import { normalizeCallouts } from '../server/writer.mjs';
import { findVideoUri } from '../server/video.mjs';
import { labelFromFileName, musicSections, templateMotionPrompt, templateMusicPrompt, KEEP_STYLE } from '../src/lib/flow.ts';
import { writePack } from '../server/flow.mjs';
import { TASKS, chatPrompt, importReply, normalizeElements, skeleton } from '../server/tasks.mjs';
import { saveMedia, deleteProject } from '../server/projects.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newProject, demoProject } from '../src/lib/demo.ts';
import { composePrompt, allPrompts } from '../src/lib/styles.ts';
import { phrases } from '../src/lib/captions.ts';
import { speechBounds, encodeWav } from '../src/lib/recorder.ts';
import { normalizeStory, normalizeDirect, buildStoryPrompt, buildDirectPrompt } from '../server/writer.mjs';
import { toJsonSchema } from '../server/claude.mjs';
import { charsToWords } from '../server/tts.mjs';

let passed = 0;
const failures = [];
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (err) {
    failures.push(name + '\n    ' + (err && err.message ? err.message.split('\n').join('\n    ') : err));
  }
};

// --- splitting a pasted script ---------------------------------------------

await test('blank lines are scene breaks', () => {
  const s = splitScript('You wake up and the air is already trying to kill you. It is not even noon.\n\nYet people lived here for thousands of years without any electricity.');
  assert.equal(s.length, 2);
});

await test('a long paragraph is split at sentence ends, never mid-sentence', () => {
  const para = Array.from({ length: 12 }, (_, i) => 'This is sentence number ' + (i + 1) + ' about mud bricks.').join(' ');
  const s = splitScript(para);
  assert.ok(s.length >= 2, 'expected several scenes, got ' + s.length);
  for (const piece of s) assert.match(piece, /\.$/);
  assert.equal(s.join(' '), para);
});

await test('headings, SCENE labels and [stage directions] are dropped', () => {
  const s = splitScript('## Part one\n\nSCENE 1:\n\n[MUSIC SWELLS] The Nile flooded every summer, and every family depended on it.');
  assert.equal(s.length, 1);
  assert.equal(s[0], 'The Nile flooded every summer, and every family depended on it.');
});

await test('crumbs are merged into a neighbour', () => {
  const s = splitScript('Heat.\n\nThe walls were thick, made of mud brick that soaked up the sun all day long.');
  assert.equal(s.length, 1);
  assert.ok(s[0].startsWith('Heat.'));
});

await test('empty input is no scenes', () => {
  assert.deepEqual(splitScript('   \n\n  '), []);
});

await test('sentences keep closing quotes', () => {
  assert.deepEqual(sentences('He said "go." Then left!'), ['He said "go."', 'Then left!']);
});

// --- word timing estimates ---------------------------------------------------

await test('estimated words cover the speech in order', () => {
  const w = estimateWords('You wake up, and the air is hot. Very hot.', 0.2, 4.2);
  assert.equal(w.length, 10);
  assert.ok(Math.abs(w[0].start - 0.2) < 1e-9);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].start);
  assert.ok(w[w.length - 1].end <= 4.2 + 1e-9);
});

await test('stale when the narration changed after recording', () => {
  const s = { narration: 'b', audio: { text: 'a' } };
  assert.equal(isStale(s), true);
  assert.equal(isStale({ narration: 'a ', audio: { text: 'a' } }), false);
  assert.equal(isStale({ narration: 'a', audio: null }), false);
});

// --- captions -----------------------------------------------------------------

await test('phrases are short and cover every word once', () => {
  const words = estimateWords('You wake up and the air is already trying to kill you. It is not even noon, and the sand outside is hot enough to blister skin.', 0, 10);
  const p = phrases(words);
  assert.equal(p.flatMap((x) => x.words).length, words.length);
  for (const x of p) assert.ok(x.words.length <= 7);
  assert.ok(p.some((x) => /you\.$/.test(x.words[x.words.length - 1].word)), 'a phrase should end at the full stop');
  for (let i = 0; i < p.length - 1; i++) assert.ok(p[i].end >= p[i + 1].start, 'no blank gap between phrases');
});

// --- timeline ------------------------------------------------------------------

await test('a scene lasts its audio plus the breath, rounded up to a frame', () => {
  const p = newProject('abcdef');
  p.design.breath = 0.35;
  const a = blankScene('one');
  a.audio = { src: 'x.mp3', duration: 2.01, words: [], source: 'mic', timed: false, text: 'one' };
  const b = blankScene('two');
  b.shots[0].motion = 'still';
  b.effect = 'dust';
  p.scenes = [a, b];
  const t = buildTimeline(p);
  assert.equal(t.scenes[0].durationInFrames, Math.ceil((2.01 + 0.35) * 30));
  assert.equal(t.scenes[1].startFrame, t.scenes[0].durationInFrames);
  assert.equal(t.totalFrames, t.scenes[0].durationInFrames + t.scenes[1].durationInFrames);
  assert.equal(t.scenes[1].shots[0].motion, 'still');
  assert.ok(t.scenes[1].words.length > 0, 'unvoiced scenes still get caption timings');
});

await test('crossfade never exceeds the shortest scene', () => {
  const p = demoProject();
  p.design.crossfade = 10;
  const t = buildTimeline(p);
  const shortest = Math.min(...t.scenes.map((s) => s.durationInFrames));
  assert.ok(t.fadeFrames < shortest);
});

await test('a NaN duration does not poison the timeline', () => {
  const p = demoProject();
  p.scenes[0].audio = { src: 'x', duration: NaN, words: [], source: 'eleven', timed: false, text: p.scenes[0].narration };
  const t = buildTimeline(p);
  for (const s of t.scenes) assert.ok(Number.isFinite(s.startFrame) && s.durationInFrames > 0);
});

await test('auto motion varies from scene to scene', () => {
  assert.notEqual(resolveMotion('auto', 0), resolveMotion('auto', 1));
  assert.equal(resolveMotion('pan-left', 3), 'pan-left');
});

// --- prompts ---------------------------------------------------------------------

await test('picture prompt carries subject, cast and style, and forbids text', () => {
  const p = newProject('abcdef');
  p.styleBible = 'Neferu, a girl in a white linen dress.';
  const prompt = composePrompt(p, { imagePrompt: 'Neferu wetting reed mats at dawn' }, 'ignored');
  assert.match(prompt, /^Neferu wetting reed mats/);
  assert.match(prompt, /white linen dress/);
  assert.match(prompt, /comic/i);
  assert.match(prompt, /No text/);
  assert.match(composePrompt(p, { imagePrompt: '' }, 'The walls were thick.'), /^The walls were thick/);
  assert.match(allPrompts(demoProject()), /Scene 3/);
});

// --- writer output repair ---------------------------------------------------------

await test('story output is repaired: bad enums, markdown, empty scenes', () => {
  const r = normalizeStory({
    title: '**How** Egyptians beat the heat',
    scenes: [
      { narration: 'You wake up.', imagePrompt: 'A girl wakes', effect: 'lava', motion: 'spin' },
      { narration: '', imagePrompt: 'dropped' },
      { narration: 'Walls were thick.', imagePrompt: 'Mud walls', effect: 'heat', motion: 'zoom-in' },
    ],
    tags: ['#egypt', 'history'],
  });
  assert.equal(r.title, 'How Egyptians beat the heat');
  assert.equal(r.scenes.length, 2);
  assert.equal(r.scenes[0].effect, 'none');
  assert.equal(r.scenes[0].motion, 'auto');
  assert.equal(r.scenes[1].effect, 'heat');
  assert.deepEqual(r.tags, ['egypt', 'history']);
  assert.deepEqual(r.factNotes, []);
});

await test('a story with no scenes is an error, not an empty video', () => {
  assert.throws(() => normalizeStory({ title: 'x', scenes: [] }));
});

await test('directing her script always returns exactly one plan per scene, in order', () => {
  const r = normalizeDirect({ scenes: [{ index: 2, imagePrompt: 'two', effect: 'dust', motion: 'auto' }, { index: 1, imagePrompt: 'one', effect: 'none', motion: 'auto' }] }, 3);
  assert.equal(r.scenes.length, 3);
  assert.equal(r.scenes[0].imagePrompt, 'one');
  assert.equal(r.scenes[1].imagePrompt, 'two');
  assert.equal(r.scenes[2].imagePrompt, '');
});

await test('prompts state the length budget and the scene count', () => {
  const s = buildStoryPrompt({ topic: 'Roman toilets', minutes: 9, tone: 'immersive', language: 'Kannada' });
  assert.match(s, /1350 words/);
  assert.match(s, /45 scenes/);
  assert.match(s, /Kannada/);
  const d = buildDirectPrompt({ narrations: ['a', 'b', 'c'] });
  assert.match(d, /exactly 3 scenes/);
  assert.match(d, /^3\. c$/m);
});

await test('the story schema translates for Claude with enums and required keys', async () => {
  // The schema is not exported, so rebuild the scene part the way Claude sees it.
  const js = toJsonSchema({ type: 'OBJECT', properties: { effect: { type: 'STRING', enum: ['none', 'heat'] }, index: { type: 'INTEGER' } } });
  assert.equal(js.type, 'object');
  assert.deepEqual(js.properties.effect.enum, ['none', 'heat']);
  assert.equal(js.properties.index.type, 'integer');
  assert.equal(js.additionalProperties, false);
  assert.deepEqual(js.required, ['effect', 'index']);
});

// --- ElevenLabs timings ---------------------------------------------------------------

await test('character timings group into words', () => {
  const chars = [...'Hi there'];
  const starts = chars.map((_, i) => i * 0.1);
  const ends = chars.map((_, i) => i * 0.1 + 0.08);
  const w = charsToWords(chars, starts, ends);
  assert.deepEqual(w.map((x) => x.word), ['Hi', 'there']);
  assert.ok(Math.abs(w[1].start - 0.3) < 1e-9);
});

// --- recording ---------------------------------------------------------------------------

await test('speech bounds find the talking between two silences', () => {
  const rate = 8000;
  const s = new Float32Array(rate * 3);
  for (let i = rate; i < rate * 2; i++) s[i] = Math.sin(i / 5) * 0.5;
  const b = speechBounds(s, rate);
  assert.ok(Math.abs(b.start / rate - 1) < 0.05, 'start ' + b.start / rate);
  assert.ok(Math.abs(b.end / rate - 2) < 0.05, 'end ' + b.end / rate);
});

await test('WAV header describes the samples', async () => {
  const wav = encodeWav(new Float32Array(100), 44100);
  const buf = new DataView(await wav.arrayBuffer());
  assert.equal(buf.byteLength, 44 + 200);
  assert.equal(buf.getUint32(24, true), 44100);
  assert.equal(buf.getUint16(22, true), 1);
});


// --- shots, chapters, callouts ------------------------------------------------------

const timedWords = (text, perWord = 0.5) => text.split(' ').map((w, i) => ({ word: w, start: i * perWord, end: i * perWord + 0.4 }));

await test('a second shot cuts in exactly on its word', () => {
  const p = newProject('abcdef');
  const s = blankScene('one two three four five six seven eight nine ten');
  s.audio = { src: 'x', duration: 5, words: timedWords(s.narration), source: 'eleven', timed: true, text: s.narration };
  s.shots.push(newShot({ atWord: 6 }));
  p.scenes = [s];
  const t = buildTimeline(p);
  const [first, second] = t.scenes[0].shots;
  assert.equal(second.from, 6 * 0.5 * 30);
  assert.equal(first.durationInFrames, second.from);
  assert.equal(second.from + second.durationInFrames, t.scenes[0].durationInFrames);
});

await test('cuts are never closer than a second, and never past the end', () => {
  const p = newProject('abcdef');
  const s = blankScene('a b c d e f');
  s.audio = { src: 'x', duration: 3, words: timedWords(s.narration), source: 'eleven', timed: true, text: s.narration };
  s.shots.push(newShot({ atWord: 0 }), newShot({ atWord: 99 }));
  p.scenes = [s];
  const t = buildTimeline(p).scenes[0];
  assert.ok(t.shots[1].from >= 30, 'second shot at least 1s in, got ' + t.shots[1].from);
  assert.ok(t.shots[2].from <= t.durationInFrames - 1);
  for (const sh of t.shots) assert.ok(sh.durationInFrames >= 1);
});

await test('a chapter holds before the narration, and everything word-timed moves with it', () => {
  const p = newProject('abcdef');
  p.design.chapterHold = 2;
  const s = blankScene('one two three four');
  s.audio = { src: 'x', duration: 2, words: timedWords(s.narration), source: 'eleven', timed: true, text: s.narration };
  s.chapter = 'Secret #1: The walls';
  s.callouts = [defaultCallout('label', 2, { text: 'here' })];
  p.scenes = [s];
  const t = buildTimeline(p).scenes[0];
  assert.equal(t.leadIn, 60);
  assert.equal(t.callouts[0].at, 60 + 1 * 30);
  assert.equal(t.callouts[0].from, undefined, 'the timing never overwrites the callout numbers');
  assert.equal(t.durationInFrames, Math.ceil((2 + 2 + p.design.breath) * 30));
});

await test('YouTube chapters start at 0:00 and need three', () => {
  const p = demoProject();
  const long = 'word '.repeat(40).trim();
  p.scenes = [0, 1, 2, 3].map(() => blankScene(long));
  p.scenes[1].chapter = 'Secret #1: Walls';
  p.scenes[2].chapter = 'Secret #2: Wind';
  const out = youtubeChapters(buildTimeline(p));
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^0:00 Intro$/);
  assert.match(lines[1], /^0:\d\d Secret #1: Walls$/);
  p.scenes[2].chapter = '';
  assert.equal(youtubeChapters(buildTimeline(p)), '');
});

await test('the Short is its own stretch, from frame 0, with room for the end card', () => {
  const p = demoProject();
  p.short = { fromScene: 1, toScene: 2, hook: 'Why?', endCard: 'More' };
  p.scenes[1].chapter = 'Chapter';
  const t = buildShortTimeline(p);
  assert.equal(t.format, 'portrait');
  assert.equal(t.scenes.length, 2);
  assert.equal(t.scenes[0].startFrame, 0);
  assert.equal(t.scenes[0].leadIn, 0, 'no chapter pause in a Short');
  assert.ok(t.totalFrames > t.scenes[1].startFrame + t.scenes[1].durationInFrames);
  assert.equal(t.hook, 'Why?');
});

await test('word times clamp to the words that exist', () => {
  const w = timedWords('a b c');
  assert.equal(wordTime(w, -3), 0);
  assert.equal(wordTime(w, 99), 1);
  assert.equal(wordTime([], 2), 0);
});

await test('finding a word ignores case and punctuation, and plural endings', () => {
  const t = 'The Great Pyramid, built for Khufu, used 2.3 million blocks.';
  assert.equal(findWord(t, 'pyramid'), 2);
  assert.equal(findWord(t, 'Khufu'), 5);
  assert.equal(findWord(t, 'million blocks'), 8);
  assert.equal(findWord('Three pyramids stood', 'pyramid'), 1, 'a singular finds its plural');
  assert.equal(findWord(t, 'block'), 9);
  assert.equal(findWord(t, 'zebra'), -1);
});

await test('old one-picture projects open as one shot per scene', () => {
  const old = { id: 'abcdef', title: 'x', scenes: [{ id: 's1', narration: 'hi', imagePrompt: 'p', image: 'projects/abcdef/images/a.jpg', motion: 'pan-left', effect: 'dust', audio: null }], styleRefSceneId: 's1' };
  const p = migrateProject(old);
  assert.equal(p.scenes[0].shots.length, 1);
  assert.equal(p.scenes[0].shots[0].image, 'projects/abcdef/images/a.jpg');
  assert.equal(p.scenes[0].shots[0].motion, 'pan-left');
  assert.equal(p.scenes[0].transition, 'auto');
  assert.deepEqual(p.scenes[0].callouts, []);
  assert.equal(p.styleRefShotId, p.scenes[0].shots[0].id);
  assert.ok(p.thumbnail && p.short && p.design.chapterHold > 0);
  assert.doesNotThrow(() => buildTimeline(p));
});

await test('AI suggestions land on the right words and keep what she added', () => {
  const p = demoProject();
  p.scenes[0].callouts = [defaultCallout('label', 0, { text: 'mine' })];
  const r = applySuggestions(p, {
    chapters: [{ scene: 3, title: 'Secret #1: Walls' }],
    callouts: [
      { scene: 1, kind: 'thermometer', word: 'noon,', text: 'Midday', value: 50, from: 20, to: 0, unit: '°C' },
      { scene: 3, kind: 'label', word: 'mud brick', text: 'Mud brick', value: 0, from: 0, to: 0, unit: '' },
      { scene: 2, kind: 'bogus', word: 'cities', text: 'x', value: 0, from: 0, to: 0, unit: '' },
    ],
  });
  assert.equal(r.scenes[0].callouts.length, 2);
  assert.equal(r.scenes[0].callouts[1].value, 50);
  assert.equal(r.scenes[0].callouts[1].atWord, findWord(p.scenes[0].narration, 'noon'));
  assert.equal(r.scenes[2].chapter, 'Secret #1: Walls');
  assert.equal(r.scenes[2].callouts[0].atWord, findWord(p.scenes[2].narration, 'mud'));
  assert.equal(r.scenes[1].callouts.length, 0, 'unknown kinds are dropped');
});

await test('callout suggestions are repaired: bad scenes and kinds, junk numbers', () => {
  const r = normalizeCallouts({
    chapters: [{ scene: 9, title: 'x' }, { scene: 2, title: '**Walls**' }],
    callouts: [{ scene: 1, kind: 'weird', word: 'sun', text: 'Sun', value: 'lots' }, { scene: 1, kind: 'pin', word: '' }],
  }, 3);
  assert.deepEqual(r.chapters, [{ scene: 2, title: 'Walls' }]);
  assert.equal(r.callouts.length, 1);
  assert.equal(r.callouts[0].kind, 'label');
  assert.equal(r.callouts[0].value, 0);
});

// --- camera ---------------------------------------------------------------------------

await test('every camera move is finite across its whole span', () => {
  const moves = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'push-rotate', 'drift', 'rack-focus', 'shake', 'whip', 'still'];
  for (const m of moves) {
    for (const f of [0, 1, 15, 100, 299]) {
      const c = cameraAt(m, f, 300, 30, 0.6, { x: 0.2, y: 0.8 });
      for (const v of Object.values(c)) assert.ok(Number.isFinite(v), m + ' frame ' + f + ' gave ' + JSON.stringify(c));
      assert.ok(c.scale >= 1, m + ' must never show the picture edge (scale ' + c.scale + ')');
    }
  }
});

await test('the same frame always gives the same camera (renders out of order)', () => {
  assert.deepEqual(cameraAt('shake', 7, 90, 30, 1, { x: 0.5, y: 0.5 }), cameraAt('shake', 7, 90, 30, 1, { x: 0.5, y: 0.5 }));
  assert.deepEqual(cameraAt('drift', 40, 90, 30, 1, { x: 0.5, y: 0.5 }), cameraAt('drift', 40, 90, 30, 1, { x: 0.5, y: 0.5 }));
});

await test('rack focus and whip start blurred and end sharp', () => {
  assert.ok(cameraAt('rack-focus', 0, 200, 30, 0.6, { x: 0.5, y: 0.5 }).blur > 5);
  assert.equal(cameraAt('rack-focus', 60, 200, 30, 0.6, { x: 0.5, y: 0.5 }).blur, 0);
  assert.ok(cameraAt('whip', 0, 200, 30, 0.6, { x: 0.5, y: 0.5 }).blur > 10);
  assert.ok(cameraAt('whip', 30, 200, 30, 0.6, { x: 0.5, y: 0.5 }).blur < 0.5);
});

await test('zooms head towards the focus point', () => {
  const c = cameraAt('zoom-in', 299, 300, 30, 1, { x: 0.9, y: 0.1 });
  assert.ok(c.tx < 0 && c.ty > 0, 'a focus top-right pulls the frame left and down: ' + JSON.stringify(c));
});

await test('parallax exaggerates the move for layers in front', () => {
  const c = cameraAt('pan-right', 250, 300, 30, 1, { x: 0.5, y: 0.5 });
  const l = parallax(c, 1.7);
  assert.ok(Math.abs(l.tx) > Math.abs(c.tx));
  assert.ok(l.scale > c.scale);
});

// --- green screen -----------------------------------------------------------------------

await test('green screen: border green goes, the character stays, green on the character survives', () => {
  const w = 20;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inside = x >= 6 && x < 14 && y >= 4 && y < 18;
      const belt = inside && y === 10 && x >= 8 && x < 12;
      const [r, g, b] = belt ? [20, 200, 30] : inside ? [180, 120, 90] : [0, 255, 0];
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  const removed = keyPixels(data, w, h);
  const alpha = (x, y) => data[(y * w + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0);
  assert.equal(alpha(19, 19), 0);
  assert.equal(alpha(10, 6), 255, 'the character is kept');
  assert.ok(alpha(10, 10) > 0, 'a green belt inside the character is not keyed');
  assert.ok(removed > 0.6 && removed < 0.8, 'removed ' + removed);
  assert.equal(greenness(180, 120, 90), 0);
  assert.equal(greenness(0, 255, 0), 1);
});

// --- Veo ------------------------------------------------------------------------------------

await test('the finished Veo operation yields its video link', () => {
  assert.equal(findVideoUri({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://x/v.mp4' } }] } } }), 'https://x/v.mp4');
  assert.equal(findVideoUri({ done: true, response: { other: { video: { uri: 'https://y/z' } } } }), 'https://y/z');
  assert.equal(findVideoUri({ done: true, response: {} }), '');
});

// --- Google Flow / Flow Music hand-off ---------------------------------------------------

await test('clip file names find their shot', () => {
  assert.equal(labelFromFileName('03b.mp4'), '3b');
  assert.equal(labelFromFileName('scene-3b.mp4'), '3b');
  assert.equal(labelFromFileName('Scene 12 c.mp4'), '12c');
  assert.equal(labelFromFileName('7.mp4'), '7');
  assert.equal(labelFromFileName('3-final.mp4'), '3');
  assert.equal(labelFromFileName('clip.mp4'), '');
});

await test('music plays in stretches: base track until the first chapter track, then each until the next', () => {
  const p = demoProject();
  p.design.music = 'calm';
  p.music = [
    { sceneId: p.scenes[1].id, prompt: '', src: 'projects/x/music/a.mp3', name: 'a' },
    { sceneId: p.scenes[2].id, prompt: 'brief only, no track yet', src: '', name: '' },
  ];
  const t = buildTimeline(p);
  assert.deepEqual(t.music.map((m) => m.src), ['audio/bed-calm.wav', 'projects/x/music/a.mp3']);
  assert.equal(t.music[0].from, 0);
  assert.equal(t.music[0].to, t.scenes[1].startFrame);
  assert.equal(t.music[1].to, t.totalFrames);
  p.music.push({ sceneId: p.scenes[0].id, prompt: '', src: 'projects/x/music/open.mp3', name: 'o' });
  assert.equal(buildTimeline(p).music[0].src, 'projects/x/music/open.mp3', 'a track on the opening replaces the base');
  p.design.music = 'none';
  p.music = [];
  assert.deepEqual(buildTimeline(p).music, []);
});

await test('a Short carries on with the chapter music already playing', () => {
  const p = demoProject();
  p.design.music = 'none';
  p.music = [{ sceneId: p.scenes[0].id, prompt: '', src: 'projects/x/music/open.mp3', name: 'o' }];
  p.short = { fromScene: 1, toScene: 2, hook: '', endCard: '' };
  const t = buildShortTimeline(p);
  assert.equal(t.music.length, 1);
  assert.equal(t.music[0].src, 'projects/x/music/open.mp3');
  assert.equal(t.music[0].from, 0);
  assert.equal(t.music[0].to, t.totalFrames);
});

await test('music sections: the opening plus one per chapter, covering every scene', () => {
  const p = demoProject();
  p.scenes[2].chapter = 'Secret #1: Walls';
  const secs = musicSections(p);
  assert.deepEqual(secs.map((s) => s.label), ['Opening', 'Secret #1: Walls']);
  const total = buildTimeline(p).totalFrames / 30;
  assert.ok(Math.abs(secs[0].seconds + secs[1].seconds - total) < 0.2, 'sections add up to the video');
  assert.match(templateMusicPrompt(p, secs[1], 1), /INSTRUMENTAL ONLY/);
});

await test('template motion prompts keep the style and name the camera and sound', () => {
  const p = demoProject();
  p.scenes[0].shots[0].motion = 'pan-left';
  const m = templateMotionPrompt(p.scenes[0], p.scenes[0].shots[0]);
  assert.ok(m.includes(KEEP_STYLE));
  assert.match(m, /slow pan left/);
  assert.match(m, /heat haze/);
  assert.match(m, /No dialogue/);
});

await test('a Flow pack has numbered frames, the prompts in order, and a how-to', () => {
  const id = 'flowpacktest1';
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const a = saveMedia(id, 'images', 'a', '.jpg', jpg);
  const b = saveMedia(id, 'images', 'b', '.jpg', jpg);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-pack-'));
  try {
    const r = writePack(out, {
      title: 'Test: pack!',
      items: [{ label: '3b', image: a, prompt: 'first' }, { label: '12', image: b, prompt: 'second' }, { label: '4', image: 'projects/nope/images/x.jpg', prompt: 'missing' }],
      music: [{ label: 'Opening', prompt: 'drone' }],
    });
    const dir = path.join(out, r.folder);
    assert.equal(r.frames, 2);
    assert.ok(fs.existsSync(path.join(dir, 'frames', '03b.jpg')));
    assert.ok(fs.existsSync(path.join(dir, 'frames', '12.jpg')));
    const prompts = fs.readFileSync(path.join(dir, 'prompts.txt'), 'utf8');
    assert.ok(prompts.indexOf('first') < prompts.indexOf('second'));
    assert.match(prompts, /save the clip as 03b\.mp4/);
    assert.match(fs.readFileSync(path.join(dir, 'music-prompts.txt'), 'utf8'), /drone/);
    assert.match(fs.readFileSync(path.join(dir, 'HOW-TO.txt'), 'utf8'), /Frames to Video/);
    assert.match(r.folder, /^flow-pack-test-pack-/);
    assert.throws(() => writePack(out, { title: 'x', items: [{ label: '1', image: 'projects/nope/images/x.jpg', prompt: '' }] }));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
    deleteProject(id);
  }
});

// --- any-chatbot fallback ----------------------------------------------------------------

await test('the chatbot prompt carries the instructions, the job and the answer shape', () => {
  const prompt = chatPrompt(TASKS.story({ topic: 'Roman toilets', minutes: 3, tone: 'playful', language: 'Hindi' }));
  assert.match(prompt, /illustrated YouTube explainers/);
  assert.match(prompt, /Topic: Roman toilets/);
  assert.match(prompt, /Hindi/);
  assert.match(prompt, /```json/);
  assert.match(prompt, /"scenes": \[/);
  assert.match(prompt, /one of: none \| heat/);
  assert.doesNotMatch(prompt, /Return only the JSON object\.\s*\n--------/);
});

await test('a pasted chatbot reply is read like an API answer, with chatter and stray notes around it', () => {
  const reply = 'Sure! Here is your script:\n```json\n{"title": "Roman toilets", "titleIdeas": [], "styleBible": "x", '
    + '"scenes": [{"narration": "You sit down.", "imagePrompt": "A bench", "effect": "dust", "motion": "auto", "chapter": ""}], '
    + '"description": "d", "tags": ["rome"], "factNotes": [] /* notes */}\n```\nHope that helps!';
  const r = importReply(TASKS.story({ topic: 'x' }), reply);
  assert.equal(r.title, 'Roman toilets');
  assert.equal(r.scenes.length, 1);
  assert.equal(r.scenes[0].effect, 'dust');
});

await test('a reply that came in two pieces ("continue") is joined back together', () => {
  const part1 = '```json\n{"chapters": [{"scene": 2, "title": "Walls"}], "callouts": [{"scene": 1, "kind": "date", "word": "Egypt",';
  const part2 = '```json\n "text": "Egypt, 1500 BC", "value": 0, "from": 0, "to": 0, "unit": ""}]}\n```';
  const r = importReply(TASKS.callouts({ narrations: ['In Egypt it was hot.', 'The walls.'], title: 't' }), part1 + '\n\n' + part2);
  assert.equal(r.chapters[0].title, 'Walls');
  assert.equal(r.callouts[0].text, 'Egypt, 1500 BC');
});

await test('a reply with no JSON gives a message she can act on', () => {
  assert.throws(() => importReply(TASKS.story({ topic: 'x' }), 'Sorry, I cannot help with that.'), /Copy the WHOLE reply/);
});

await test('every job has a chatbot version', () => {
  const jobs = {
    story: { topic: 't' }, direct: { narrations: ['a'] }, callouts: { narrations: ['a'] }, motion: { shots: [{ label: '1', narration: 'a' }] },
    music: { sections: [{ label: 'Opening', title: 't', summary: 's', length: '1:00' }] }, thumbnail: { title: 't' }, elements: {},
  };
  for (const [name, body] of Object.entries(jobs)) {
    const p = chatPrompt(TASKS[name](body));
    assert.match(p, /HOW TO ANSWER/, name);
    assert.ok(p.length > 200, name);
  }
  assert.match(chatPrompt(TASKS.elements({})), /picture is attached/);
});

await test('the answer skeleton spells out arrays, numbers and choices', () => {
  const sk = skeleton({ type: 'OBJECT', properties: { a: { type: 'ARRAY', items: { type: 'STRING', description: 'x' } }, n: { type: 'NUMBER', description: 'how many' }, k: { type: 'STRING', enum: ['p', 'q'] } } });
  assert.match(sk, /"<x>"/);
  assert.match(sk, /more items of the same shape/);
  assert.match(sk, /0 {2}\/\* how many \*\//);
  assert.match(sk, /one of: p \| q/);
});

// --- living picture ----------------------------------------------------------------------

await test('element suggestions: 0-1000 grid to 0-1, a 0-1 answer is not squashed, junk is dropped', () => {
  const r = normalizeElements({
    elements: [
      { kind: 'smoke', x: 720, y: 360, size: 100, intensity: 0.8, angle: 0 },
      { kind: 'birds', x: 0.25, y: 0.2, size: 0.2, intensity: 9, angle: 180 },
      { kind: 'dragon', x: 500, y: 500, size: 100 },
    ],
    horizon: 580,
    effect: 'breeze',
  });
  assert.equal(r.elements.length, 2);
  assert.ok(Math.abs(r.elements[0].x - 0.72) < 1e-9 && Math.abs(r.elements[0].size - 0.1) < 1e-9);
  assert.ok(Math.abs(r.elements[1].x - 0.25) < 1e-9, 'a 0-1 answer stays where it was meant');
  assert.equal(r.elements[1].intensity, 1.5);
  assert.equal(r.depth, 0.58);
  assert.equal(r.effect, 'breeze');
  assert.equal(normalizeElements({ elements: [], horizon: -1, effect: 'x' }).depth, null);
  assert.equal(normalizeElements({ elements: [], horizon: -1, effect: 'x' }).effect, 'none');
});

await test('shots carry their elements and depth into the timeline', () => {
  const p = demoProject();
  p.scenes[0].shots[0].elements = [{ id: 'e1', kind: 'birds', x: 0.3, y: 0.2, size: 0.2, intensity: 1, angle: 0 }];
  p.scenes[0].shots[0].depth = 0.6;
  const t = buildTimeline(p).scenes[0].shots[0];
  assert.equal(t.elements.length, 1);
  assert.equal(t.depth, 0.6);
  assert.equal(buildTimeline(p).scenes[1].shots[0].depth, null);
});

await test('chapter titles keep their # (only a heading marker at the start is removed)', () => {
  const r = normalizeStory({ scenes: [{ narration: '## Opening line', imagePrompt: '', effect: 'none', motion: 'auto', chapter: 'Secret #1: Clay' }] });
  assert.equal(r.scenes[0].chapter, 'Secret #1: Clay');
  assert.equal(r.scenes[0].narration, 'Opening line');
});

// --- news explainers -----------------------------------------------------------------------

const { normalizeNews, buildNewsPrompt } = await import('../server/news-writer.mjs');
const { outletOf, normalizeTrending } = await import('../server/news.mjs');
const { sourceLabel, prettyDate, NEWS_END_SECONDS } = await import('../src/lib/timeline.ts');
const { niceTicks } = await import('../src/remotion/graphics/theme.ts');
const { applyNews, sourcesBlock, needsPicture } = await import('../src/lib/news.ts');

const newsReply = {
  title: 'India–EU deal, explained',
  titleIdeas: [],
  scenes: [
    { narration: 'India and the EU have signed a trade deal.', visual: 'headline', imagePrompt: '', graphic: { title: 'India and EU sign trade deal', items: [], unit: '', countries: [], quote: '', who: '', role: 'Explained', leftTitle: '', leftPoints: [], rightTitle: '', rightPoints: [], value: 0, from: 0 }, sources: [1, 2, 9], effect: 'heat', motion: 'zoom-in', chapter: '' },
    { narration: 'Trade has grown fast.', visual: 'bars', imagePrompt: '', graphic: { title: 'Trade', items: [{ label: 'EU', value: 136, note: '' }], unit: 'bn' }, sources: [1], effect: 'none', motion: 'auto', chapter: '' },
    { narration: 'Here is where it applies.', visual: 'map', imagePrompt: '', graphic: { title: 'Signatories', countries: ['India', 'France'] }, sources: [], effect: 'none', motion: 'auto', chapter: 'What happened' },
    { narration: 'A port at dawn.', visual: 'picture', imagePrompt: 'Container port at dawn', graphic: {}, sources: [2], effect: 'fog', motion: 'pan-left', chapter: '' },
  ],
  sources: [{ title: 'Model listed', publisher: 'X', url: 'https://x', date: '' }],
  description: 'd', tags: ['#trade'], factNotes: ['Dairy terms not yet published'],
};

await test('news output: graphics need their data, sources are numbered from 1, research sources win', () => {
  const given = [{ title: 'Pact signed', publisher: 'Reuters', url: 'https://reuters.com/a', date: '2026-10-05' }, { title: 'Deal', publisher: 'The Hindu', url: 'https://thehindu.com/b', date: '' }];
  const r = normalizeNews(newsReply, given);
  assert.equal(r.sources.length, 2, 'the research list is authoritative over the model’s');
  assert.deepEqual(r.scenes[0].sources, [0, 1], 'out-of-range source 9 dropped, 1-based made 0-based');
  assert.equal(r.scenes[0].graphic.kind, 'headline');
  assert.equal(r.scenes[0].effect, 'none', 'graphics get no atmosphere');
  assert.equal(r.scenes[0].motion, 'still');
  assert.equal(r.scenes[1].graphic, null, 'a bar chart with one bar falls back to a picture');
  assert.deepEqual(r.scenes[2].graphic.countries, ['India', 'France']);
  assert.equal(r.scenes[3].graphic, null);
  assert.equal(r.scenes[3].effect, 'fog');
  assert.equal(normalizeNews(newsReply, []).sources[0].publisher, 'X', 'without research, the chatbot’s list is used');
});

await test('news prompt: from a brief it lists numbered sources; without one it tells the chatbot to search', () => {
  const withBrief = buildNewsPrompt({ story: 'Deal', asOf: '2026-10-06', brief: 'BRIEF TEXT', sources: [{ publisher: 'Reuters', title: 'Pact', url: 'https://r', date: '' }], minutes: 4 });
  assert.match(withBrief, /1\. Reuters - Pact - https:\/\/r/);
  assert.match(withBrief, /BRIEF TEXT/);
  assert.match(withBrief, /600 words/);
  assert.match(buildNewsPrompt({ story: 'Deal' }), /SEARCH THE WEB NOW/);
  assert.match(chatPrompt(TASKS.news({ story: 'Deal' })), /"visual": "one of: picture \| map \| bars/);
});

await test('outlets get readable names', () => {
  assert.equal(outletOf('https://www.reuters.com/world/x'), 'Reuters');
  assert.equal(outletOf('https://www.thehindu.com/news/x'), 'The Hindu');
  assert.equal(outletOf('https://news.example.co.in/a'), 'Example');
  assert.equal(outletOf('not a url', 'bbc.com'), 'BBC');
});

await test('trending replies are read even with chatter, and capped', () => {
  const items = normalizeTrending('Here you go:\n```json\n[{"headline":"A","summary":"s","why":"w","category":"Tech","date":"2026-10-05","heat":14},{"summary":"no headline"}]\n```');
  assert.equal(items.length, 1);
  assert.equal(items[0].heat, 10);
  assert.deepEqual(normalizeTrending('nothing here'), []);
});

await test('news timeline: source tags per scene and a dated end card', () => {
  const p = applyNews(newProject('newsx1'), normalizeNews(newsReply, [{ title: 'a', publisher: 'Reuters', url: '', date: '' }, { title: 'b', publisher: 'The Hindu', url: '', date: '' }]), '2026-10-06');
  const t = buildTimeline(p);
  assert.equal(t.kind, 'news');
  assert.equal(t.scenes[0].sourceLabel, 'Reuters · The Hindu');
  assert.equal(t.scenes[2].sourceLabel, '');
  const last = t.scenes[t.scenes.length - 1];
  assert.equal(t.totalFrames - (last.startFrame + last.durationInFrames), Math.round(NEWS_END_SECONDS * 30));
  assert.equal(prettyDate('2026-10-06'), '6 Oct 2026');
  assert.equal(prettyDate('nope'), '');
  assert.equal(p.scenes[0].shots[0].graphic.kind, 'headline');
  assert.equal(needsPicture(p.scenes[0].shots[0]), false, 'a graphic shot needs no picture');
  assert.equal(needsPicture(p.scenes[3].shots[0]), true);
  assert.match(sourcesBlock(p), /^Sources:\n- Reuters: a/);
  assert.equal(buildShortTimeline({ ...p, short: { fromScene: 0, toScene: 1, hook: '', endCard: 'x' } }).asOf, '2026-10-06');
  const history = buildTimeline(demoProject());
  assert.equal(history.asOf, '');
  assert.equal(sourceLabel(demoProject(), demoProject().scenes[0]), '');
});

await test('chart axes use round numbers', () => {
  assert.deepEqual(niceTicks(44.8, 88.2, 3), [50, 75]);
  assert.deepEqual(niceTicks(0, 100, 3), [0, 50, 100]);
  assert.ok(niceTicks(0.012, 0.031, 4).every((v) => Number.isFinite(v)));
});

// --- stock photos and videos ------------------------------------------------------------------

const { licenceAllowed, needsAttribution } = await import('../server/stock.mjs');
const { creditLine, titleCardShown } = await import('../src/lib/timeline.ts');
const { creditsBlock } = await import('../src/lib/news.ts');
const { defaultQuery } = await import('../src/lib/stock.ts');

await test('only licences fit for a monetised, cropped video get through', () => {
  for (const ok of ['CC BY-SA 4.0', 'CC BY 2.0', 'CC0', 'Public domain', 'PDM', 'Attribution 3.0']) assert.equal(licenceAllowed(ok), true, ok);
  for (const no of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'Fair use', 'All rights reserved', '', 'Non-free']) assert.equal(licenceAllowed(no), false, no || '(empty)');
});

await test('attribution is required for CC BY and BY-SA, not for CC0 or public domain', () => {
  assert.equal(needsAttribution('CC BY-SA 4.0'), true);
  assert.equal(needsAttribution('CC BY 2.0'), true);
  assert.equal(needsAttribution('CC0'), false);
  assert.equal(needsAttribution('Public domain'), false);
  assert.equal(needsAttribution('Pexels License'), false);
});

await test('on-screen credits follow the Look setting', () => {
  const credit = { source: 'Wikimedia Commons', author: 'Diego Delso', authorUrl: '', license: 'CC BY-SA 4.0', licenseUrl: '', pageUrl: 'https://c/1', required: true };
  const shot = { credit, image: 'x.jpg', video: '', graphic: null };
  assert.equal(creditLine(shot, 'required'), 'Photo: Diego Delso / Wikimedia Commons, CC BY-SA 4.0');
  assert.equal(creditLine({ ...shot, video: 'v.mp4' }, 'required').slice(0, 6), 'Video:');
  assert.equal(creditLine({ ...shot, credit: { ...credit, required: false } }, 'required'), '');
  assert.equal(creditLine({ ...shot, credit: { ...credit, required: false } }, 'all').length > 0, true);
  assert.equal(creditLine(shot, 'off'), '');
  assert.equal(creditLine({ ...shot, graphic: { kind: 'map' } }, 'all'), '', 'a graphic shot shows no photo credit');
  const p = demoProject();
  p.scenes[0].shots[0].credit = credit;
  p.scenes[1].shots[0].credit = credit; // the same photo twice is credited once
  assert.equal(buildTimeline(p).scenes[0].shots[0].credit.startsWith('Photo: Diego'), true);
  const block = creditsBlock(p);
  assert.match(block, /^Image & video credits:\n- Diego Delso \/ Wikimedia Commons \(CC BY-SA 4\.0\)\n {2}https:\/\/c\/1$/);
  assert.equal(creditsBlock(demoProject()), '');
});

await test('the opening title stays off a graphic opening', () => {
  const p = demoProject();
  p.title = 'Why it matters';
  p.design.titleCard = true;
  assert.equal(titleCardShown(buildTimeline(p)), true);
  p.scenes[0].shots[0].graphic = { kind: 'headline', title: 'Big news', subtitle: '', items: [], unit: '', note: '' };
  assert.equal(titleCardShown(buildTimeline(p)), false);
  p.design.titleCard = false;
  p.scenes[0].shots[0].graphic = null;
  assert.equal(titleCardShown(buildTimeline(p)), false);
});

await test('stock searches start from the writer’s phrase, else the picture description', () => {
  assert.equal(defaultQuery({ stockQuery: 'Taj Mahal sunrise', imagePrompt: 'x' }), 'Taj Mahal sunrise');
  assert.equal(defaultQuery({ stockQuery: '', imagePrompt: 'A wide shot of the Red Fort in Delhi, at dusk' }), 'Red Fort Delhi, dusk'.replace(',', ''));
  assert.equal(defaultQuery({ stockQuery: '', imagePrompt: '' }, 'Monsoon clouds over Mumbai'), 'Monsoon clouds over Mumbai');
});

await test('the writers suggest a stock search per scene', () => {
  const s = normalizeStory({ scenes: [{ narration: 'Hi.', imagePrompt: 'p', effect: 'none', motion: 'auto', chapter: '', stockQuery: '**Taj Mahal**' }] });
  assert.equal(s.scenes[0].stockQuery, 'Taj Mahal');
  const n = normalizeNews({ scenes: [{ narration: 'Hi.', visual: 'picture', imagePrompt: 'p', graphic: {}, sources: [], effect: 'none', motion: 'auto', chapter: '', stockQuery: 'Indian parliament building' }] }, []);
  assert.equal(n.scenes[0].stockQuery, 'Indian parliament building');
  assert.match(chatPrompt(TASKS.story({ topic: 't' })), /"stockQuery"/);
});

// --- beats and storyboards ---------------------------------------------------------------------

const { keywords, planBeats, punchAt, holdStats } = await import('../src/lib/beats.ts');
const { storyboardTask, normalizeStoryboard } = await import('../server/storyboard.mjs');
const { applyStoryboard, batches, beatStarts, removeEmptyShots, storyboardBody, storyboardCount, storyboardPlan } = await import('../src/lib/storyboard.ts');
const { sceneWords } = await import('../src/lib/timeline.ts');
const { ART_STYLES } = await import('../src/lib/styles.ts');
const sceneWordsCount = (sc) => sceneWords(sc).length;

const spoken = (text, wps = 2.5) => text.split(' ').map((w, i) => ({ word: w, start: i / wps, end: (i + 0.8) / wps }));

await test('key words: numbers with their unit, names, acronyms on their own', () => {
  const k = keywords(spoken('Police stopped 300 MPs near Nirvachan Sadan in New Delhi. Congress MP Priyanka Gandhi Vadra spoke. The march went on.'));
  const texts = k.map((x) => x.text);
  assert.ok(texts.includes('300 MPs'), texts.join('|'));
  assert.ok(texts.includes('Nirvachan Sadan'));
  assert.ok(texts.includes('New Delhi'));
  assert.ok(texts.includes('Priyanka Gandhi Vadra'));
  assert.ok(texts.includes('MP'));
  assert.ok(!texts.includes('Police') && !texts.includes('The'), 'a capital that only starts a sentence is not a name');
  assert.ok(keywords(spoken('It cost ₹500 crore to build.')).some((x) => x.text === '₹500 crore'));
});

const longScene = (style, pace = 3, extra = {}) => {
  const words = spoken('In the summer of 1857 the old city of Delhi woke to the sound of drums and the smell of smoke as 300 soldiers rode in from Meerut across the Yamuna and nobody in the Red Fort knew what would happen next');
  const frames = Math.ceil((words[words.length - 1].end + 0.4) * 30);
  const shots = [{ id: 'a', from: 0, durationInFrames: frames, graphic: null, focus: { x: 0.6, y: 0.4 } }];
  return { words, frames, leadIn: 0, fps: 30, shots, callouts: [], pace, style, seed: 1, ...extra };
};

await test('beats fill every long hold, on words, and never crowd each other', () => {
  const o = longScene('mix');
  const beats = planBeats(o);
  assert.ok(beats.length >= 4, 'beats: ' + beats.length);
  const stats = holdStats([{ leadIn: 0, durationInFrames: o.frames, shots: o.shots, callouts: [], beats }], 30);
  assert.ok(stats.withoutBeats > 12 && stats.longest <= 3 * 1.3, JSON.stringify(stats));
  const starts = new Set(o.words.map((w) => Math.round(w.start * 30)));
  for (const b of beats) assert.ok(starts.has(b.at), 'beat on a word start: ' + b.at);
  for (let i = 1; i < beats.length; i++) assert.ok(beats[i].at - beats[i - 1].at >= 36, 'spacing');
  assert.ok(beats.some((b) => b.kind === 'pop') && beats.some((b) => b.kind === 'punch'), 'mix has both');
  assert.ok(beats.filter((b) => b.kind === 'pop').every((b) => b.until > b.at && b.until - b.at <= 48));
  assert.deepEqual(planBeats(o), beats, 'the same script always gets the same beats');
});

await test('beat styles, pace off, quiet openings and graphics', () => {
  assert.ok(planBeats(longScene('zoom')).every((b) => b.kind === 'punch'));
  assert.deepEqual(planBeats(longScene('mix', 0)), []);
  assert.ok(planBeats(longScene('mix', 3, { quietUntil: 150 })).every((b) => b.at >= 150));
  const g = longScene('words');
  g.shots[0].graphic = { kind: 'bars' };
  const gb = planBeats(g);
  assert.ok(gb.length && gb.every((b) => b.kind === 'punch' && b.zoom <= 1.06), 'graphics get gentle punches, no words over their words');
  // Punches go in, then back out from the same point.
  const p = planBeats(longScene('zoom')).filter((b) => b.kind === 'punch');
  assert.ok(p[0].zoom > 1 && p[1].zoom === 1 && p[1].fx === p[0].fx);
  assert.equal(punchAt(p, p[0].at + 10, 0, 9999, 30).zoom, p[0].zoom);
  assert.equal(punchAt(p, p[0].at - 1, 0, 9999, 30).zoom, 1);
});

await test('the timeline carries beats, after the title card, and none under the Short hook', () => {
  const p = demoProject();
  p.design.pace = 2;
  assert.ok(buildTimeline(p).scenes.some((s) => s.beats.length), 'a demo scene gets beats');
  p.design.pace = 0;
  assert.ok(buildTimeline(p).scenes.every((s) => !s.beats.length));
  p.design.pace = 2;
  p.design.beats = 'words';
  p.short = { fromScene: 0, toScene: 2, hook: 'Why?', endCard: 'x' };
  const short = buildShortTimeline(p);
  for (const sc of short.scenes) for (const b of sc.beats) if (b.kind === 'pop') assert.ok(sc.startFrame + b.at >= 30 * 4.6);
  const old = demoProject();
  delete old.design.pace;
  assert.equal(migrateProject(old).design.pace, 3, 'projects saved before beats get the default');
});

await test('storyboard beats: about every N seconds, on phrase ends, no scraps', () => {
  const text = 'In 1600, a group of London merchants asked for permission to sell pepper. 257 years later, they ruled 300 million people. Nobody broke down the door. We opened it, and we handed them a pen.';
  const words = spoken(text);
  const starts = beatStarts(words, 2);
  assert.equal(starts[0], 0);
  assert.ok(starts.length >= 5 && starts.length <= 9, 'beats: ' + starts.length);
  for (let k = 1; k < starts.length; k++) {
    const len = words[starts[k]].start - words[starts[k - 1]].start;
    assert.ok(len >= 1.5 - 1e-9, 'beat ' + k + ' too short: ' + len);
    assert.ok(starts[k] - starts[k - 1] >= 3);
  }
  const seams = starts.slice(1).filter((i) => /[,.;:!?]$/.test(words[i - 1].word) || /^(and|but|a|the|to|in|on|at|with|for)$/i.test(words[i].word)).length;
  assert.ok(seams >= starts.length - 2, 'most beats start at a seam: after a comma or full stop, or before "and"/"the"/"to"');
  const said = (k) => words.slice(starts[k], starts[k + 1] ?? words.length).map((w) => w.word).join(' ');
  assert.ok(starts.every((_, k) => !/ (of|the|a)$/.test(said(k))), 'no beat ends on "of", "the" or "a"');
  assert.ok(!starts.slice(1).some((i) => /^(million|percent|of)$/.test(words[i].word)), 'never "300 | million"');
  const lastLen = words[words.length - 1].end - words[starts[starts.length - 1]].start;
  assert.ok(lastLen >= 1.2, 'the last beat is not a scrap');
  assert.ok(beatStarts(words, 6).length < starts.length, 'a slower storyboard has fewer beats');
  const held = beatStarts(words, 2, 4);
  assert.ok(words[held[1]].start >= 4, 'a graphic opening is held long enough to read');
});

await test('storyboard: planned in batches, applied one shot per beat, made pictures kept, undoable', () => {
  const p = demoProject();
  p.styleBible = '';
  const plan = storyboardPlan(p, 2);
  assert.equal(plan.length, p.scenes.length);
  assert.ok(plan.every((s) => s.beats.length === s.starts.length && s.beats.join(' ').split(/\s+/).length === sceneWordsCount(p.scenes[s.sceneIndex])));
  const parts = batches(plan, 6);
  assert.equal(parts.flat().length, plan.length, 'batches keep every scene once');
  const body = storyboardBody(p, parts[0], 'Ink cartoon');
  const task = storyboardTask(body);
  assert.match(task.prompt, /Scene 1 \(\d+ beats?\)/);
  assert.match(task.prompt, /no style bible yet/);
  const s1 = plan[0];
  const reply = { styleBible: 'Ravi, a tired clerk.', scenes: [{ index: 1, shots: s1.beats.map((b, k) => ({ beat: k + 1, imagePrompt: '**Picture ' + (k + 1) + '**', stockQuery: 'q' + (k + 1) })).concat([{ beat: 99, imagePrompt: 'not a beat', stockQuery: '' }]) }] };
  const r = normalizeStoryboard(reply, body.scenes);
  assert.equal(r.scenes[0].shots.length, s1.beats.length, 'beats outside the plan are dropped');
  assert.equal(r.scenes[0].shots[0].imagePrompt, 'Picture 1');
  // An extra shot that is already drawn, right where beat 2 starts, stays instead of a new one.
  const made = newShot({ atWord: s1.starts[1], image: 'drawn.jpg' });
  p.scenes[0].shots.push(made);
  const { project, added } = applyStoryboard(p, plan, r);
  const shots = project.scenes[0].shots;
  assert.equal(added, s1.starts.length - 2);
  assert.equal(shots.length, s1.starts.length);
  assert.ok(shots.some((s) => s.image === 'drawn.jpg'), 'pictures already made are kept');
  assert.deepEqual(shots.map((s) => s.atWord), [...shots.map((s) => s.atWord)].sort((a, b) => a - b));
  assert.equal(project.styleBible, 'Ravi, a tired clerk.', 'the style bible written by the planner is used when there was none');
  assert.equal(project.scenes[1], p.scenes[1], 'scenes not in the reply are untouched');
  const undone = removeEmptyShots(project);
  assert.equal(undone.project.scenes[0].shots.length, 2);
  assert.match(chatPrompt(TASKS.storyboard(body)), /"beat"/);
  assert.ok(storyboardCount(p, 2).total > storyboardCount(p, 6).total);
});

await test('the ink style, the witty tone, and boxed captions are offered', () => {
  assert.ok(ART_STYLES.some((s) => s.id === 'ink'));
  assert.match(buildStoryPrompt({ topic: 'x', tone: 'witty', minutes: 3 }), /Deadpan/);
});

// --- ElevenLabs v4 and voice directions ---------------------------------------------------------

const speech = await import('../src/lib/speech.ts');
const tts = await import('../server/tts.mjs');
const vd = await import('../server/voice-direction.mjs');
const { buildNewsPrompt: newsPromptV4 } = await import('../server/news-writer.mjs');
const { isStale: staleV4, narrationWords: wordsV4, countWords: countV4, estimateWords: estimateV4, splitScript: splitV4 } = await import('../src/lib/script.ts');

await test('voice directions are spoken to the voice, never by it', () => {
  const line = '[amused] They asked to sell pepper. [long pause] Then they stayed.';
  assert.equal(speech.spokenText(line), 'They asked to sell pepper. Then they stayed.');
  assert.equal(speech.supportsTags('eleven_v4'), true);
  assert.equal(speech.supportsTags('eleven_v4_turbo'), true);
  assert.equal(speech.supportsTags('eleven_v3'), true);
  assert.equal(speech.supportsTags('eleven_multilingual_v2'), false);
  assert.equal(speech.textForModel(line, 'eleven_v4'), line);
  assert.equal(speech.textForModel(line, 'eleven_flash_v2_5'), 'They asked to sell pepper. Then they stayed.');
  assert.ok(speech.sameWords(line, 'They asked to sell pepper. Then they stayed.'));
  assert.ok(!speech.sameWords(line, 'They asked to sell spices. Then they stayed.'));
  assert.deepEqual(speech.splitTags('[warm] Hi').map((p) => p.tag), [true, false]);
  // Words, counts, estimated timings and cut points all ignore the tags.
  assert.deepEqual(wordsV4(line), ['They', 'asked', 'to', 'sell', 'pepper.', 'Then', 'they', 'stayed.']);
  assert.equal(countV4(line), 8);
  assert.equal(estimateV4(line, 0, 4).length, 8);
  // The server splits words by exactly the same rule.
  assert.equal(tts.spokenText(line), speech.spokenText(line));
});

await test('pasted scripts keep voice directions but drop stage notes', () => {
  const [scene] = splitV4('[MUSIC] [warm] You wake up and the air is already trying to kill you. [pause] Yet whole cities lived through it, summer after summer, for three thousand years.');
  assert.ok(scene.includes('[warm]') && scene.includes('[pause]'));
  assert.ok(!scene.includes('[MUSIC]'));
});

await test('a new direction re-voices an ElevenLabs take, not a recording', () => {
  const sc = (source, text) => ({ narration: '[warm] Hello there.', audio: { source, text, src: 'a', duration: 1, timed: true, words: [] } });
  assert.equal(staleV4(sc('eleven', 'Hello there.')), true);
  assert.equal(staleV4(sc('mic', 'Hello there.')), false);
  assert.equal(staleV4(sc('mic', 'Hello friend.')), true);
});

await test('timed words never include a tag, even if the alignment does', () => {
  const chars = [...'[warm] Hi there. [long pause] Bye'];
  const t = chars.map((_, i) => i / 10);
  assert.deepEqual(tts.charsToWords(chars, t, t).map((w) => w.word), ['Hi', 'there.', 'Bye']);
});

await test('v4 gets the tags and no old-model settings; older models get bare words', () => {
  const v4 = tts.speakBodies('[warm] Hello.', { modelId: 'eleven_v4', stability: 0.4 }, { previous: '[sad] Before.', next: 'After.' });
  assert.equal(v4[0].text, '[warm] Hello.');
  assert.equal(v4[0].previous_text, '[sad] Before.');
  assert.equal(v4[0].voice_settings.style, undefined);
  assert.equal(v4[1].previous_text, undefined, 'the second try drops the neighbouring text');
  assert.deepEqual(v4[v4.length - 1].voice_settings, { stability: 0.5 }, 'the last try asks for nothing but a stability step');
  const v2 = tts.speakBodies('[warm] Hello.', { modelId: 'eleven_multilingual_v2' }, { previous: '[sad] Before.' });
  assert.equal(v2[0].text, 'Hello.');
  assert.equal(v2[0].previous_text, 'Before.');
  assert.equal(v2[0].voice_settings.use_speaker_boost, true);
});

await test('a rejected setting is retried with less, not failed', async () => {
  const real = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    if (sent.length === 1) return new Response(JSON.stringify({ detail: { message: 'previous_text is not supported for this model' } }), { status: 400 });
    const chars = [...'Hello there.'];
    return new Response(JSON.stringify({
      audio_base64: Buffer.from('x').toString('base64'),
      alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.08) },
    }), { status: 200 });
  };
  try {
    const r = await tts.speak('k', '[warm] Hello there.', { voiceId: 'v', modelId: 'eleven_v4' }, { previous: 'Before.' });
    assert.equal(sent.length, 2);
    assert.ok(sent[0].previous_text && !sent[1].previous_text);
    assert.deepEqual(r.words.map((w) => w.word), ['Hello', 'there.']);
  } finally {
    globalThis.fetch = real;
  }
});

await test('writers add voice directions only for a v4 voice, and news keeps them neutral', () => {
  const on = buildStoryPrompt({ topic: 'x', tone: 'witty', minutes: 2, voiceTags: true });
  assert.match(on, /ElevenLabs v4/);
  assert.match(on, /\[deadpan\]/);
  assert.doesNotMatch(buildStoryPrompt({ topic: 'x', tone: 'witty', minutes: 2 }), /ElevenLabs v4/);
  const news = newsPromptV4({ story: 'x', minutes: 3, voiceTags: true });
  assert.match(news, /never to signal approval, scorn or alarm/);
  assert.doesNotMatch(news, /\[sarcastic\]/);
});

await test('"Add voice directions" keeps every word, or keeps the scene as it was', () => {
  const list = ['They asked to sell pepper.', 'Then they stayed for 257 years.'];
  const r = vd.normalizeDirectVoice({ scenes: [
    { index: 1, narration: '[amused] They asked to sell pepper.' },
    { index: 2, narration: '[deadpan] Then they stayed for three centuries.' },
  ] }, list);
  assert.equal(r.scenes[0].narration, '[amused] They asked to sell pepper.');
  assert.equal(r.scenes[0].changed, true);
  assert.equal(r.scenes[1].narration, list[1], 'changed words are refused');
  assert.equal(r.rejected, 1);
  assert.match(chatPrompt(TASKS.voice({ narrations: list, tone: 'witty' })), /NOT change the words/);
});

await test('captions and cut points line up with the spoken words of a directed scene', () => {
  const p = demoProject();
  p.scenes[0].narration = '[warm] ' + p.scenes[0].narration.replace(/\. /, '. [pause] ');
  const t = buildTimeline(p);
  assert.ok(t.scenes[0].words.every((w) => !w.word.includes('[')));
  assert.equal(t.scenes[0].words.length, wordsV4(p.scenes[0].narration).length);
});

console.log('\n  ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  for (const f of failures) console.log('\n  ✗ ' + f);
  process.exit(1);
}
