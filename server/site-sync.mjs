// ---------------------------------------------------------------------------
// A published video onto electricalmcqs.in: its question into the site's
// question bank, and the video onto /watch/ and its topic page.
//
// The site is its own repository beside this one (SITE_DIR, by default
// ../electricalmcqs). This writes its two content files - public/questions.json
// and content/videos.json - and runs its page builder, and stops there.
// Putting the site live is a deploy the creator does, on purpose: it is a
// public change.
//
// A question already in the bank is not added twice, and a video already
// listed is updated in place rather than listed again.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export const SITE_URL = 'https://electricalmcqs.in';

const LETTERS = ['A', 'B', 'C', 'D'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function siteDirFor(root) {
  return process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : path.resolve(root, '..', 'electricalmcqs');
}

const files = (siteDir) => ({
  bank: path.join(siteDir, 'public', 'questions.json'),
  videos: path.join(siteDir, 'content', 'videos.json'),
});

/** What the site has: whether it is there at all, and its topics (with their subjects). */
export function siteInfo(siteDir) {
  const f = files(siteDir);
  if (!fs.existsSync(f.bank) || !fs.existsSync(f.videos)) return { found: false, topics: [], questions: 0, videos: 0 };
  const bank = JSON.parse(fs.readFileSync(f.bank, 'utf8'));
  const videos = JSON.parse(fs.readFileSync(f.videos, 'utf8'));
  const topics = new Map();
  for (const q of bank.questions || []) if (q.topic && !topics.has(q.topic)) topics.set(q.topic, q.subject || '');
  return {
    found: true,
    topics: [...topics.entries()].map(([topic, subject]) => ({ topic, subject })),
    questions: (bank.questions || []).length,
    videos: (videos.videos || []).length,
  };
}

/**
 * The site topic nearest this video's own: most shared words with its topic,
 * then its subject. A topic page only lists videos filed under one of the
 * bank's own topic names, so a near miss would link nowhere.
 */
export function bestTopic(content, topics) {
  const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
  const mine = words(content.topic);
  const subject = words(content.subject);
  let best = null;
  let bestScore = 0;
  for (const t of topics) {
    const theirs = words(t.topic);
    let score = 0;
    for (const w of theirs) {
      if (mine.has(w)) score += 3;
      else if (subject.has(w)) score += 1;
      // "transformer" and "transformers" are the same topic.
      else if ([...mine].some((m) => m.startsWith(w) || w.startsWith(m))) score += 2;
    }
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

/** A YouTube id from an id or any of its url shapes; empty if it is neither. */
export function youtubeId(input) {
  const s = String(input || '').trim();
  const m = /(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
}

/** An Instagram reel or post code from its url or the code itself. */
export function instagramCode(input) {
  const s = String(input || '').trim();
  const m = /instagram\.com\/(?:reel|p|reels)\/([A-Za-z0-9_-]{5,20})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{5,20}$/.test(s) ? s : '';
}

/** The bank entry for this video's question. */
export function bankEntry(content, topic, now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hash = Math.abs([...String(content.question)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)).toString(36).slice(0, 5);
  const options = {};
  (content.options || []).slice(0, 4).forEach((o, i) => { options[LETTERS[i]] = String(o); });
  return {
    id: 'SS-' + stamp + '-' + hash,
    subject: topic.subject || content.subject || '',
    topic: topic.topic,
    difficulty: ['Easy', 'Medium', 'Hard'].find((d) => d.toLowerCase() === String(content.difficulty || '').toLowerCase()) || 'Medium',
    question: content.question,
    options,
    correct: LETTERS[content.correctIndex] || 'A',
    explanation: [content.answerLine, ...(content.explanation || [])].filter(Boolean).join(' '),
    illustration: '',
    tags: ['video'],
  };
}

/**
 * Write the video onto the site. Returns what was done; runs the page
 * builder unless `build` is false (the tests).
 */
export async function syncToSite({ siteDir, content, topic, youtube, instagram, published, seconds, title, build = true }) {
  const f = files(siteDir);
  if (!fs.existsSync(f.bank) || !fs.existsSync(f.videos)) {
    throw new Error('The website is not at ' + siteDir + '. Set SITE_DIR to where electricalmcqs is checked out.');
  }
  const yt = youtubeId(youtube);
  const ig = instagramCode(instagram);
  if (!yt && !ig) throw new Error('Give the YouTube link, the Instagram link, or both - the site needs somewhere to play it.');
  if (!topic || !topic.topic) throw new Error('Choose which of the site\'s topics this video belongs to.');
  if (!Array.isArray(content.options) || content.options.length !== 4) throw new Error('Only a four-option question can go into the question bank.');

  const notes = [];
  const bank = JSON.parse(fs.readFileSync(f.bank, 'utf8'));
  const have = (bank.questions || []).find((q) => norm(q.question) === norm(content.question));
  if (have) {
    notes.push('The question was in the bank already (' + have.id + '), so it was not added again.');
  } else {
    bank.questions = [...(bank.questions || []), bankEntry(content, topic)];
    bank.count = bank.questions.length;
    fs.writeFileSync(f.bank, JSON.stringify(bank));
    notes.push('Added the question to the bank, under ' + topic.topic + '.');
  }

  const list = JSON.parse(fs.readFileSync(f.videos, 'utf8'));
  const entry = {
    youtube: yt,
    instagram: ig,
    title: String(title || content.question).slice(0, 110),
    question: content.question,
    topic: topic.topic,
    published: published || new Date().toISOString().slice(0, 10),
    seconds: Math.round(Number(seconds) || 0),
  };
  const videos = Array.isArray(list.videos) ? list.videos : [];
  const at = videos.findIndex((v) => (yt && v.youtube === yt) || (ig && v.instagram === ig) || norm(v.question) === norm(content.question));
  if (at >= 0) {
    videos[at] = { ...videos[at], ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== '' && v !== 0)) };
    notes.push('The video was listed already; its entry was updated.');
  } else {
    videos.unshift(entry);
    notes.push('Listed the video on /watch/ and on the ' + topic.topic + ' page.');
  }
  list.videos = videos;
  fs.writeFileSync(f.videos, JSON.stringify(list, null, 2) + '\n');

  let output = '';
  if (build) {
    output = await new Promise((resolve, reject) => {
      execFile(process.execPath, ['tools/build.mjs'], { cwd: siteDir, timeout: 120000 }, (err, stdout, stderr) => {
        if (err) reject(new Error('The site\'s page builder failed: ' + (stderr || err.message).slice(0, 400)));
        else resolve(String(stdout || ''));
      });
    });
    notes.push('Rebuilt the pages. Deploy the site to put it live.');
  }
  return { notes, output: output.slice(-1500), url: SITE_URL + '/watch/' };
}
