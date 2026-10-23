// ---------------------------------------------------------------------------
// The approved equipment drawings, on disk.
//
// src/lib/equipment.ts lists the kinds - what each must show, what to check -
// and src/lib/drawable.ts refuses to let an image model draw any of them
// afresh. This is where the drawings a person HAS checked are kept:
//
//   public/equipment/index.json       which drawing is approved for which kind,
//                                     the creator's own kinds, and the ones
//                                     withdrawn. Committed, like the mascot:
//                                     both computers show the same drawings.
//   public/equipment/<id>-<hex>.<ext>  the approved drawings themselves.
//   public/generated/equipment/<id>/  candidates, drawn or uploaded, waiting
//                                     to be looked at. Not committed.
//
// A withdrawn drawing keeps its file. A video made with it still names that
// file, and a re-render must not come out with a hole in it; it is only no
// longer offered to new scenes.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { allKinds, equipmentId, isEquipmentId } from '../src/lib/equipment.ts';
import { drawnText, judgeDrawing } from '../src/lib/drawable.ts';
import { doodleScenePrompt, ILLUSTRATION_MATCH_LINE, readMascot, readMascotImage } from './mascot.mjs';
import { generateGoogleImage } from './google-images.mjs';
import { saveImageBuffer } from './stock.mjs';

const DIR = 'equipment';
const INDEX = 'index.json';
const APPROVED_FILE = /^[a-z0-9]+(?:-[a-z0-9]+){0,6}\.(png|jpg|webp)$/;
const CANDIDATE = (id) => new RegExp('^generated/equipment/' + id + '/[a-z]-[a-z0-9]{6,12}\\.(png|jpg|webp)$');
/** An uploaded drawing larger than this is a photograph of a poster, not a drawing - and its base64 would not fit the helper's 10 MB body limit. */
const MAX_UPLOAD = 6 * 1024 * 1024;

const empty = () => ({ approved: {}, custom: [], withdrawn: [] });

/** The index as it is on disk, every part present and every name checked. */
export function readEquipment(publicDir) {
  const file = path.join(publicDir, DIR, INDEX);
  let raw = empty();
  try {
    raw = { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
  const approved = {};
  for (const [id, entry] of Object.entries(raw.approved || {})) {
    if (!isEquipmentId(id) || !entry || !APPROVED_FILE.test(String(entry.file || ''))) continue;
    if (!fs.existsSync(path.join(publicDir, DIR, entry.file))) continue;
    approved[id] = { file: entry.file, src: DIR + '/' + entry.file, at: String(entry.at || ''), source: entry.source === 'uploaded' ? 'uploaded' : 'drawn' };
  }
  const custom = (Array.isArray(raw.custom) ? raw.custom : [])
    .filter((k) => k && isEquipmentId(k.id) && typeof k.name === 'string' && Array.isArray(k.words))
    .map((k) => ({ id: k.id, name: k.name, words: k.words.map(String), draw: String(k.draw || ''), check: String(k.check || ''), custom: true }));
  const withdrawn = Array.isArray(raw.withdrawn) ? raw.withdrawn.filter((w) => w && isEquipmentId(w.id)) : [];
  return { approved, custom, withdrawn };
}

function writeIndex(publicDir, store) {
  const dir = path.join(publicDir, DIR);
  fs.mkdirSync(dir, { recursive: true });
  const approved = Object.fromEntries(Object.entries(store.approved).map(([id, e]) => [id, { file: e.file, at: e.at, source: e.source }]));
  const custom = store.custom.map(({ id, name, words, draw, check }) => ({ id, name, words, draw, check }));
  fs.writeFileSync(path.join(dir, INDEX), JSON.stringify({ approved, custom, withdrawn: store.withdrawn }, null, 2) + '\n');
}

/** Every kind, the creator's own included. */
export function kindsFor(publicDir) {
  return allKinds(readEquipment(publicDir).custom);
}

function kindOf(publicDir, id) {
  const kind = kindsFor(publicDir).find((k) => k.id === id);
  if (!kind) throw new Error('There is no equipment called "' + id + '" on the list.');
  return kind;
}

/** The ids with an approved drawing, and where each drawing is. */
export function approvedDrawings(publicDir) {
  const { approved } = readEquipment(publicDir);
  return { ids: Object.keys(approved), srcFor: (id) => (approved[id] ? approved[id].src : '') };
}

/** Candidates for one kind, newest first. */
export function candidatesFor(publicDir, id) {
  const dir = path.join(publicDir, 'generated', DIR, id);
  if (!isEquipmentId(id) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => CANDIDATE(id).test('generated/equipment/' + id + '/' + f))
    .map((f) => ({ f, at: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .map(({ f }) => 'generated/' + DIR + '/' + id + '/' + f);
}

/**
 * How many scenes in the saved videos named each kind and found no approved
 * drawing: the order worth approving them in.
 */
export function wantedCounts(publicDir, libraryDir) {
  const kinds = kindsFor(publicDir);
  const { ids } = approvedDrawings(publicDir);
  const counts = {};
  if (!libraryDir || !fs.existsSync(libraryDir)) return counts;
  for (const f of fs.readdirSync(libraryDir).filter((n) => /^v-.*\.json$/.test(n))) {
    let video;
    try { video = JSON.parse(fs.readFileSync(path.join(libraryDir, f), 'utf8')); } catch { continue; }
    const animated = !video.design || video.design.animatedEngineer !== false;
    for (const line of (video.content && video.content.script) || []) {
      const text = line && line.doodle ? drawnText(line.doodle, animated) : '';
      if (!text) continue;
      for (const w of judgeDrawing(text, ids, kinds).wanted) counts[w] = (counts[w] || 0) + 1;
    }
  }
  return counts;
}

/** Everything the Drawings page shows, most wanted first. */
export function equipmentView(publicDir, libraryDir) {
  const store = readEquipment(publicDir);
  const wanted = wantedCounts(publicDir, libraryDir);
  const kinds = allKinds(store.custom).map((k, order) => ({
    id: k.id, name: k.name, words: k.words, draw: k.draw, check: k.check, custom: Boolean(k.custom), order,
    approved: store.approved[k.id] ? { src: store.approved[k.id].src, at: store.approved[k.id].at, source: store.approved[k.id].source } : null,
    candidates: candidatesFor(publicDir, k.id),
    wanted: wanted[k.id] || 0,
  }));
  kinds.sort((a, b) => b.wanted - a.wanted || a.order - b.order);
  // Names that came up and have no kind at all: the creator can add one by that name.
  const known = new Set(kinds.map((k) => k.id));
  const unlisted = Object.entries(wanted).filter(([w]) => !known.has(w)).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  return { kinds, unlisted, approvedCount: Object.keys(store.approved).length };
}

/**
 * Draw one candidate for a kind, in the doodle look, matched to the mascot's
 * model sheet for its line and its red - and never with the engineer in it.
 */
export async function drawCandidate({ apiKey, modelId, id, publicDir }) {
  const kind = kindOf(publicDir, id);
  if (!kind.draw.trim()) throw new Error('Say what a drawing of ' + kind.name + ' should show first.');
  const mascot = readMascot(publicDir);
  const sheet = readMascotImage(publicDir);
  const prompt = doodleScenePrompt(
    { subject: 'illustration', action: kind.draw, emotion: '', props: '', gag: 'none' },
    mascot ? mascot.variant : undefined,
    { energy: 'calm', framing: 'square' },
  );
  const { base64, mimeType } = await generateGoogleImage({
    apiKey, prompt, modelId, aspectRatio: '1:1', reference: sheet, matchLine: ILLUSTRATION_MATCH_LINE,
  });
  const saved = saveImageBuffer({
    buffer: Buffer.from(base64, 'base64'), mimeType, id: 'd-' + randomBytes(4).toString('hex'), jobId: id,
    publicDir, folder: DIR,
  });
  return { src: saved.src, prompt };
}

/** A drawing the creator made or has the right to use, kept as a candidate until approved. */
export function saveUpload({ id, dataUrl, publicDir }) {
  kindOf(publicDir, id);
  const m = String(dataUrl || '').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Upload a PNG, JPEG or WebP picture.');
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length) throw new Error('That picture came through empty.');
  if (buffer.length > MAX_UPLOAD) throw new Error('That picture is over 6 MB. A drawing does not need to be that large.');
  const saved = saveImageBuffer({
    buffer, mimeType: 'image/' + m[1], id: 'u-' + randomBytes(4).toString('hex'), jobId: id, publicDir, folder: DIR,
  });
  return { src: saved.src };
}

/** Make a candidate THE drawing of its kind. The one before it, if any, is withdrawn but kept. */
export function approveCandidate({ id, src, publicDir, now = new Date() }) {
  kindOf(publicDir, id);
  const rel = String(src || '');
  if (!CANDIDATE(id).test(rel)) throw new Error('Only a drawing made or uploaded for ' + id + ' can be approved for it.');
  const from = path.join(publicDir, ...rel.split('/'));
  if (!fs.existsSync(from)) throw new Error('That drawing is no longer on disk. Draw or upload it again.');
  const ext = path.extname(from).slice(1).toLowerCase();
  const file = id + '-' + randomBytes(3).toString('hex') + '.' + ext;
  fs.mkdirSync(path.join(publicDir, DIR), { recursive: true });
  fs.copyFileSync(from, path.join(publicDir, DIR, file));
  // Moved, not copied: once approved it is no longer a candidate to choose.
  fs.rmSync(from, { force: true });

  const store = readEquipment(publicDir);
  if (store.approved[id]) store.withdrawn.push({ id, file: store.approved[id].file, at: now.toISOString(), why: 'replaced' });
  store.approved[id] = { file, at: now.toISOString(), source: path.basename(from).startsWith('u-') ? 'uploaded' : 'drawn' };
  writeIndex(publicDir, store);
  return readEquipment(publicDir).approved[id];
}

/** No longer offered to new scenes. The file stays, for the videos that already show it. */
export function withdrawApproval({ id, publicDir, now = new Date() }) {
  const store = readEquipment(publicDir);
  if (!store.approved[id]) throw new Error('There is no approved drawing of ' + id + ' to withdraw.');
  store.withdrawn.push({ id, file: store.approved[id].file, at: now.toISOString(), why: 'withdrawn' });
  delete store.approved[id];
  writeIndex(publicDir, store);
}

/** A kind the catalogue lacks - a Buchholz relay, a stator - added by name. */
export function addCustomKind({ name, draw, check, publicDir }) {
  const label = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const id = equipmentId(label);
  if (!id) throw new Error('Give the equipment a name, in letters.');
  const store = readEquipment(publicDir);
  if (allKinds(store.custom).some((k) => k.id === id)) throw new Error(label + ' is already on the list.');
  const brief = String(draw || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (brief.length < 20) throw new Error('Describe what the drawing should show, in a sentence or two: the parts, and how they sit.');
  const kind = {
    id, name: label, words: [label.toLowerCase()], draw: brief,
    check: String(check || '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'It shows ' + label.toLowerCase() + ' as described, and nothing that is not there.',
  };
  store.custom.push(kind);
  writeIndex(publicDir, store);
  return kind;
}

/** Throw a candidate away. Only ever a candidate: an approved drawing is withdrawn, never deleted. */
export function discardCandidate({ id, src, publicDir }) {
  const rel = String(src || '');
  if (!isEquipmentId(id) || !CANDIDATE(id).test(rel)) throw new Error('Only a candidate can be thrown away.');
  fs.rmSync(path.join(publicDir, ...rel.split('/')), { force: true });
}
