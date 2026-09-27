// Run: node server/library.test.mjs
//
// The video library: saving, listing, reopening on a machine that lacks some
// of the media, and keeping the voice of saved videos from the clean-up.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  deleteVideo, listVideos, mediaInUse, newVideoId, openVideo, recordOnVideo, saveVideo, VIDEO_ID,
} from './library.mjs';

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-'));
const dir = path.join(tmp, 'library');
const pub = path.join(tmp, 'public');
fs.mkdirSync(path.join(pub, 'generated', 'vo-abc'), { recursive: true });
fs.writeFileSync(path.join(pub, 'generated', 'vo-abc', 's0.mp3'), 'x');
fs.mkdirSync(path.join(pub, 'generated', 'doodle', 'd1'), { recursive: true });
fs.writeFileSync(path.join(pub, 'generated', 'doodle', 'd1', 's1.jpg'), 'x');

const content = (question) => ({
  question, topic: 'AC', subject: 'Electrical', videoKind: 'mcq',
  script: [
    { kind: 'hook', narration: 'a' },
    { kind: 'question', narration: 'b', doodleSrc: 'generated/doodle/d1/s1.jpg', doodleProps: true },
    { kind: 'answer', narration: 'c', doodleSrc: 'generated/doodle/gone/s2.jpg' },
  ],
});
const audio = {
  0: { src: 'generated/vo-abc/s0.mp3', duration: 2, words: [] },
  1: { src: 'generated/vo-gone/s1.mp3', duration: 2, words: [] },
};

test('ids are safe, and nothing else is accepted as one', () => {
  const id = newVideoId(new Date(2026, 8, 27, 10, 5, 9));
  assert(VIDEO_ID.test(id) && id.startsWith('v-20260927-100509-'), id);
  let threw = false;
  try { saveVideo(dir, { id: '../../etc/passwd', content: {} }); } catch { threw = true; }
  assert(threw, 'a path was accepted as an id');
});

const id = newVideoId();

test('a saved video is listed, with what it cost', () => {
  saveVideo(dir, { id, content: content('What is RMS?'), design: { layout: 'doodle' }, audio,
    ledger: [{ what: 'drawing', cents: 4 }, { what: 'voice', characters: 320 }] });
  const list = listVideos(dir);
  assert(list.length === 1 && list[0].title === 'What is RMS?', JSON.stringify(list));
  assert(list[0].cents === 4 && list[0].characters === 320, 'costs not totalled');
});

test('saving again keeps when it was made and what the server recorded', () => {
  recordOnVideo(dir, id, { render: { file: 'out/video-1.mp4', at: 'now' } });
  recordOnVideo(dir, id, { published: { youtube: 'https://youtu.be/x' } });
  const first = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')).createdAt;
  saveVideo(dir, { id, content: content('What is RMS, really?'), audio: {} });
  const saved = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  assert(saved.createdAt === first, 'createdAt changed');
  assert(saved.renders.length === 1 && saved.published.youtube, 'lost the renders or the publication');
  assert(listVideos(dir)[0].title === 'What is RMS, really?');
});

test('opening on a machine without some media drops just those, and says so', () => {
  saveVideo(dir, { id, content: content('What is RMS?'), audio });
  const v = openVideo(dir, id, pub);
  assert(Object.keys(v.audio).join() === '0', 'kept a missing clip: ' + Object.keys(v.audio));
  assert(v.content.script[1].doodleSrc && v.content.script[1].doodleProps, 'dropped a drawing that is there');
  assert(!v.content.script[2].doodleSrc, 'kept a missing drawing');
  assert(v.notes.length === 2, v.notes.join(' | '));
});

test('the voice of a saved video is spared by the daily clean-up', () => {
  const used = mediaInUse(dir);
  assert(used.has('vo-abc') && used.has('vo-gone'), [...used].join());
});

test('a render recorded against an unknown video is quietly nothing', () => {
  recordOnVideo(dir, 'v-20260101-000000-zzzz', { render: { file: 'x' } });
  recordOnVideo(dir, 'nonsense', { render: { file: 'x' } });
});

test('deleting takes it off the list', () => {
  deleteVideo(dir, id);
  assert(listVideos(dir).length === 0);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + passed + ' checks passed');
