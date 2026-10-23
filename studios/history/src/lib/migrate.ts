// Projects saved by an older version open in this one: missing fields get
// their defaults, and the one-picture-per-scene layout becomes one shot.

import { newProject } from './demo';
import { blankScene, newShot } from './script';
import { DEFAULT_DESIGN, DEFAULT_SHORT, DEFAULT_THUMBNAIL, DEFAULT_VOICE, type Project, type Scene } from './types';

type OldScene = Partial<Scene> & { image?: string; imagePrompt?: string; imageSource?: 'ai' | 'upload'; motion?: Scene['shots'][number]['motion'] };

export function migrateScene(raw: OldScene): Scene {
  const base = blankScene('');
  const shots = Array.isArray(raw.shots) && raw.shots.length
    ? raw.shots.map((s) => newShot(s))
    : [newShot({ image: raw.image || '', imagePrompt: raw.imagePrompt || '', imageSource: raw.imageSource, motion: raw.motion || 'auto' })];
  return {
    ...base,
    id: raw.id || base.id,
    narration: raw.narration || '',
    audio: raw.audio || null,
    effect: raw.effect || 'none',
    transition: raw.transition || 'auto',
    callouts: Array.isArray(raw.callouts) ? raw.callouts : [],
    chapter: raw.chapter || '',
    shots,
  };
}

export function migrateProject(p: Project & { styleRefSceneId?: string }): Project {
  const base = newProject(p.id);
  const scenes = (p.scenes || []).map((s) => migrateScene(s as OldScene));
  let styleRefShotId = p.styleRefShotId;
  if (!styleRefShotId && p.styleRefSceneId) {
    styleRefShotId = scenes.find((s) => s.id === p.styleRefSceneId)?.shots[0].id;
  }
  return {
    ...base,
    ...p,
    styleRefShotId,
    design: { ...DEFAULT_DESIGN, ...(p.design || {}) },
    voice: { ...DEFAULT_VOICE, ...(p.voice || {}) },
    publish: { ...base.publish, ...(p.publish || {}) },
    thumbnail: { ...DEFAULT_THUMBNAIL, ...(p.thumbnail || {}) },
    short: { ...DEFAULT_SHORT, ...(p.short || {}) },
    music: Array.isArray(p.music) ? p.music : [],
    kind: p.kind === 'news' ? 'news' : 'history',
    asOf: p.asOf || '',
    region: p.region || '',
    sources: Array.isArray(p.sources) ? p.sources : [],
    scenes,
  };
}
