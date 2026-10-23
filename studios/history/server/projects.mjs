// ---------------------------------------------------------------------------
// Projects on disk.
//
// A nine-minute video is not made in one sitting, so every project is saved as
// it changes and can be reopened later:
//
//   projects/<id>.json               the script, settings and file references
//   public/projects/<id>/images/     pictures (drawn or uploaded)
//   public/projects/<id>/audio/      voice clips (ElevenLabs or the mic)
//   public/projects/<id>/music/      her own music track, if any
//
// Media lives under public/ because that is where both the live preview (Vite)
// and the renderer (Remotion) look for it.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
// Shorts Studio's public folder, which both studios share: the same fonts and
// the same synthesised sounds, byte for byte, and the one folder its page and
// its renderer read from. This studio lives at studios/history inside it.
export const PUBLIC_DIR = path.resolve(ROOT, '..', '..', 'public');
export const MEDIA_DIR = path.join(PUBLIC_DIR, 'projects');

export const PROJECT_ID = /^[a-z0-9]{6,24}$/;
const SCENE_ID = /^[a-z0-9]{1,40}$/;

export const MEDIA_KINDS = {
  images: ['.jpg', '.jpeg', '.png', '.webp'],
  audio: ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
  video: ['.mp4', '.webm'],
  music: ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
};

export function checkId(id) {
  if (!PROJECT_ID.test(String(id || ''))) throw new Error('That is not a project this app made.');
  return id;
}

export function newId() {
  return Date.now().toString(36) + randomBytes(3).toString('hex');
}

const fileFor = (id) => path.join(PROJECTS_DIR, checkId(id) + '.json');

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
        const scenes = Array.isArray(p.scenes) ? p.scenes : [];
        const images = scenes.flatMap(sceneImages);
        return {
          id: p.id,
          title: p.title || p.topic || 'Untitled',
          updatedAt: p.updatedAt || '',
          scenes: scenes.length,
          pictures: images.length,
          voiced: scenes.filter((s) => s.audio).length,
          cover: images[0] || '',
        };
      } catch {
        return null;
      }
    })
    .filter((p) => p && PROJECT_ID.test(p.id))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** A scene's pictures, from either the shots layout or the older one-picture layout. */
function sceneImages(s) {
  if (Array.isArray(s.shots)) return s.shots.map((h) => h.image).filter(Boolean);
  return s.image ? [s.image] : [];
}

export function readProject(id) {
  const file = fileFor(id);
  if (!fs.existsSync(file)) throw new Error('That project is not on this computer any more.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveProject(project) {
  if (!project || typeof project !== 'object') throw new Error('Nothing to save.');
  checkId(project.id);
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const next = { ...project, updatedAt: new Date().toISOString() };
  // Write-then-rename, so a crash mid-save never leaves half a project.
  const tmp = fileFor(project.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 1));
  fs.renameSync(tmp, fileFor(project.id));
  return next.updatedAt;
}

export function deleteProject(id) {
  checkId(id);
  fs.rmSync(fileFor(id), { force: true });
  fs.rmSync(path.join(MEDIA_DIR, id), { recursive: true, force: true });
}

/**
 * Write one media file for a project and return its public/-relative path.
 * Names are built here, never taken from the browser.
 */
export function saveMedia(projectId, kind, sceneId, ext, buffer) {
  checkId(projectId);
  const allowed = MEDIA_KINDS[kind];
  if (!allowed) throw new Error('Unknown media kind.');
  const e = String(ext || '').toLowerCase();
  if (!allowed.includes(e)) throw new Error('That file type is not supported here. Use ' + allowed.join(', ') + '.');
  const scene = SCENE_ID.test(String(sceneId || '')) ? sceneId : 'file';
  const name = scene + '-' + randomBytes(3).toString('hex') + e;
  const dir = path.join(MEDIA_DIR, projectId, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  return 'projects/' + projectId + '/' + kind + '/' + name;
}

/** Read back a picture this app saved, for use as a style reference. Null if it is not ours. */
export function readMedia(relative) {
  const rel = String(relative || '');
  if (!/^projects\/[a-z0-9]{6,24}\/(images|audio|music|video)\/[a-z0-9-]+\.[a-z0-9]+$/.test(rel)) return null;
  const file = path.join(PUBLIC_DIR, ...rel.split('/'));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

/**
 * Remove media files the project no longer points at - old takes, replaced
 * pictures. Only ever inside that project's own folder.
 */
export function pruneMedia(project) {
  const dir = path.join(MEDIA_DIR, checkId(project.id));
  if (!fs.existsSync(dir)) return 0;
  const keep = new Set();
  for (const s of project.scenes || []) {
    if (s.image) keep.add(s.image);
    for (const h of s.shots || []) {
      if (h.image) keep.add(h.image);
      if (h.video) keep.add(h.video);
      if (h.layer && h.layer.image) keep.add(h.layer.image);
    }
    if (s.audio && s.audio.src) keep.add(s.audio.src);
  }
  if (project.design && project.design.musicSrc) keep.add(project.design.musicSrc);
  let removed = 0;
  for (const kind of Object.keys(MEDIA_KINDS)) {
    const sub = path.join(dir, kind);
    if (!fs.existsSync(sub)) continue;
    for (const f of fs.readdirSync(sub)) {
      const rel = 'projects/' + project.id + '/' + kind + '/' + f;
      if (!keep.has(rel)) {
        fs.rmSync(path.join(sub, f), { force: true });
        removed++;
      }
    }
  }
  return removed;
}
