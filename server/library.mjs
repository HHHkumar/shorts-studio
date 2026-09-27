// ---------------------------------------------------------------------------
// The video library: every video made, kept on disk, so it can be reopened,
// fixed and rendered again - here or on the other computer.
//
// One JSON file per video in library/, committed with the code: the script,
// the design, the formula card, the voiceover's timings, what it cost and
// where it was rendered and published. The media it points at - voice clips,
// drawings - are not committed (they are large, and public/generated is
// ignored), so opening a video checks each one is really there and drops the
// ones that are not. A missing clip is then just a scene to record again,
// which the Voice step does on its own.
//
// Nothing secret is stored: API keys live in the browser and are never in
// what it sends here.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

/** The only ids this module reads or writes - no path can be smuggled in. */
export const VIDEO_ID = /^v-[0-9]{8}-[0-9]{6}-[a-z0-9]{4}$/;

export function newVideoId(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
    + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  return 'v-' + stamp + '-' + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

const fileOf = (dir, id) => {
  if (!VIDEO_ID.test(String(id || ''))) throw new Error('That is not a video in the library.');
  return path.join(dir, id + '.json');
};

const readEntry = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** What the list shows for one video. */
function summary(entry) {
  const c = entry.content || {};
  const ledger = Array.isArray(entry.ledger) ? entry.ledger : [];
  const renders = Array.isArray(entry.renders) ? entry.renders : [];
  return {
    id: entry.id,
    title: String(c.question || c.topic || 'Untitled').slice(0, 140),
    videoKind: c.videoKind || 'mcq',
    subject: c.subject || '',
    topic: c.topic || '',
    createdAt: entry.createdAt || '',
    updatedAt: entry.updatedAt || '',
    cents: ledger.reduce((n, l) => n + (Number(l.cents) || 0), 0),
    characters: ledger.reduce((n, l) => n + (Number(l.characters) || 0), 0),
    renders: renders.length,
    lastRender: renders.length ? renders[renders.length - 1] : null,
    published: entry.published || {},
  };
}

/**
 * Save a video. What the browser owns - the script, design, audio, ledger -
 * is replaced; what the server owns - when it was made, its renders, where it
 * was published - is kept from the file already there.
 */
export function saveVideo(dir, incoming, now = new Date()) {
  const id = incoming && incoming.id;
  const file = fileOf(dir, id);
  if (!incoming.content || typeof incoming.content !== 'object') throw new Error('There is no video to save.');
  fs.mkdirSync(dir, { recursive: true });
  const before = readEntry(file) || {};
  const entry = {
    id,
    createdAt: before.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    content: incoming.content,
    design: incoming.design || before.design || null,
    audio: incoming.audio || {},
    seo: incoming.seo ?? before.seo ?? null,
    ledger: Array.isArray(incoming.ledger) ? incoming.ledger : before.ledger || [],
    renders: before.renders || [],
    published: before.published || {},
  };
  fs.writeFileSync(file, JSON.stringify(entry, null, 1));
  return summary(entry);
}

/** Every video, newest first. */
export function listVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && VIDEO_ID.test(f.slice(0, -5)))
    .map((f) => readEntry(path.join(dir, f)))
    .filter((e) => e && e.id)
    .map(summary)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** The raw entries, for the planner and the publishers. */
export function allVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && VIDEO_ID.test(f.slice(0, -5)))
    .map((f) => readEntry(path.join(dir, f)))
    .filter((e) => e && e.id);
}

/**
 * Open a video, checking every file it points at is still on this machine.
 * Missing ones are dropped - a clip becomes a scene to record again, a
 * drawing a scene to draw again - and listed in `notes`.
 */
export function openVideo(dir, id, publicDir) {
  const entry = readEntry(fileOf(dir, id));
  if (!entry) throw new Error('That video is not in the library any more.');
  const exists = (src) => {
    if (!src || /^https?:\/\//i.test(src)) return true;
    const full = path.resolve(publicDir, String(src).replace(/^\/+/, ''));
    return full.startsWith(path.resolve(publicDir)) && fs.existsSync(full);
  };
  const notes = [];
  const audio = {};
  let lostClips = 0;
  for (const [k, clip] of Object.entries(entry.audio || {})) {
    if (clip && exists(clip.src)) audio[k] = clip; else lostClips++;
  }
  if (lostClips) notes.push(lostClips + ' voice clip' + (lostClips > 1 ? 's are' : ' is') + ' not on this computer - the Voice step will record just those.');

  let lostDrawings = 0;
  let lostPhotos = 0;
  const script = (entry.content?.script || []).map((line) => {
    const out = { ...line };
    if (out.doodleSrc && !exists(out.doodleSrc)) {
      delete out.doodleSrc;
      delete out.doodleProps;
      lostDrawings++;
    }
    if (out.stockSrc && !exists(out.stockSrc)) {
      delete out.stockSrc;
      lostPhotos++;
    }
    return out;
  });
  if (lostDrawings) notes.push(lostDrawings + ' drawing' + (lostDrawings > 1 ? 's are' : ' is') + ' not on this computer - draw ' + (lostDrawings > 1 ? 'them' : 'it') + ' again on the Look step.');
  if (lostPhotos) notes.push(lostPhotos + ' backdrop photo' + (lostPhotos > 1 ? 's are' : ' is') + ' not on this computer.');

  return { ...entry, content: { ...entry.content, script }, audio, notes };
}

export function deleteVideo(dir, id) {
  const file = fileOf(dir, id);
  if (fs.existsSync(file)) fs.rmSync(file);
}

/** Record a finished render, or a publication, against a video. Quietly nothing for an unknown id. */
export function recordOnVideo(dir, id, patch) {
  let file;
  try {
    file = fileOf(dir, id);
  } catch {
    return;
  }
  const entry = readEntry(file);
  if (!entry) return;
  if (patch.render) entry.renders = [...(entry.renders || []), patch.render];
  if (patch.published) entry.published = { ...(entry.published || {}), ...patch.published };
  fs.writeFileSync(file, JSON.stringify(entry, null, 1));
}

/**
 * The voiceover folders (generated/vo-...) some saved video still uses. The
 * daily clean-up spares them: deleting a library video's voice after a day
 * would quietly make every reopened video silent.
 */
export function mediaInUse(dir) {
  const used = new Set();
  for (const entry of allVideos(dir)) {
    for (const clip of Object.values(entry.audio || {})) {
      const m = /generated\/([^/]+)\//.exec(String(clip && clip.src || ''));
      if (m) used.add(m[1]);
    }
  }
  return used;
}
