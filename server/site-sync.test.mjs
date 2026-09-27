// Run: node server/site-sync.test.mjs
//
// A video onto the website: into the bank once, onto the list once, under a
// topic the site really has - against a throwaway copy of the site's files.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bestTopic, instagramCode, siteInfo, syncToSite, youtubeId } from './site-sync.mjs';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const site = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
fs.mkdirSync(path.join(site, 'public'));
fs.mkdirSync(path.join(site, 'content'));
fs.writeFileSync(path.join(site, 'public', 'questions.json'), JSON.stringify({
  generated: 'x', count: 1,
  questions: [{ id: 'KEB-1', subject: 'Circuits', topic: 'AC Fundamentals', question: 'Old question?', options: {}, correct: 'A' },
    { id: 'KEB-2', subject: 'Machines', topic: 'Transformers', question: 'Another?', options: {}, correct: 'B' }],
}));
fs.writeFileSync(path.join(site, 'content', 'videos.json'), JSON.stringify({ _readme: ['keep me'], videos: [] }));

const content = {
  subject: 'Basic Electrical', topic: 'RMS value of alternating current', difficulty: 'easy',
  question: 'What is the RMS value of a 325 V peak sine wave?', options: ['230 V', '325 V', '162 V', '460 V'],
  correctIndex: 0, answerLine: 'About 230 V.', explanation: ['Divide the peak by root two.'],
};

test('links in any shape give their ids', () => {
  assert(youtubeId('https://youtube.com/shorts/ABCDEFGHIJK?feature=share') === 'ABCDEFGHIJK');
  assert(youtubeId('https://youtu.be/ABCDEFGHIJK') === 'ABCDEFGHIJK' && youtubeId('ABCDEFGHIJK') === 'ABCDEFGHIJK');
  assert(youtubeId('not a link') === '');
  assert(instagramCode('https://www.instagram.com/reel/DXyZ123abc/') === 'DXyZ123abc');
});

test('the nearest topic the site really has is chosen', () => {
  const info = siteInfo(site);
  assert(info.found && info.topics.length === 2, JSON.stringify(info));
  assert(bestTopic({ topic: 'RMS value of alternating current', subject: 'AC Fundamentals' }, info.topics).topic === 'AC Fundamentals');
  assert(bestTopic({ topic: 'Transformer efficiency', subject: '' }, info.topics).topic === 'Transformers');
});

test('a video goes into the bank and onto the list, once', async () => {
  const topic = { topic: 'AC Fundamentals', subject: 'Circuits' };
  await syncToSite({ siteDir: site, content, topic, youtube: 'https://youtu.be/ABCDEFGHIJK', seconds: 41.6, build: false });
  const again = await syncToSite({ siteDir: site, content, topic, youtube: 'ABCDEFGHIJK', instagram: 'DXyZ123abc', build: false });
  const bank = JSON.parse(fs.readFileSync(path.join(site, 'public', 'questions.json'), 'utf8'));
  const list = JSON.parse(fs.readFileSync(path.join(site, 'content', 'videos.json'), 'utf8'));
  assert(bank.questions.length === 3 && bank.count === 3, 'bank: ' + bank.questions.length);
  const added = bank.questions[2];
  assert(added.correct === 'A' && added.options.D === '460 V' && added.topic === 'AC Fundamentals', JSON.stringify(added));
  assert(list.videos.length === 1 && list.videos[0].instagram === 'DXyZ123abc' && list.videos[0].seconds === 42, JSON.stringify(list.videos));
  assert(list._readme[0] === 'keep me', 'lost the readme');
  assert(again.notes.some((n) => /already/.test(n)), again.notes.join(' | '));
});

test('nothing to play, no topic, or no site: refused with a reason', async () => {
  const refuse = async (args, pattern) => {
    let msg = '';
    try { await syncToSite({ siteDir: site, content, topic: { topic: 'AC Fundamentals' }, build: false, ...args }); } catch (e) { msg = e.message; }
    assert(pattern.test(msg), 'expected ' + pattern + ', got: ' + msg);
  };
  await refuse({}, /YouTube link/);
  await refuse({ youtube: 'ABCDEFGHIJK', topic: null }, /topics/);
  await refuse({ youtube: 'ABCDEFGHIJK', siteDir: path.join(site, 'nope') }, /not at/);
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
}
fs.rmSync(site, { recursive: true, force: true });
console.log('\n' + passed + ' checks passed');
