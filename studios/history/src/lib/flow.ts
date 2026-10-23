// ---------------------------------------------------------------------------
// Hand-off to Google Flow and Flow Music.
//
// Templates for when there is no AI key (the AI writes better ones, but these
// work), the music sections (the opening plus every chapter), and matching the
// clips that come back to their shots by file name.
// ---------------------------------------------------------------------------

import { spokenText } from './speech';
import { shotLabel } from './styles';
import { sceneSeconds, formatDuration } from './timeline';
import type { Effect, Motion, Project, Scene, Shot } from './types';

export const FLOW_URL = 'https://labs.google/fx/tools/flow';

export const CAMERA_WORDS: Record<Motion, string> = {
  auto: 'slow dolly in',
  'zoom-in': 'slow dolly in',
  'zoom-out': 'slow dolly out, revealing more of the scene',
  'pan-left': 'slow pan left',
  'pan-right': 'slow pan right',
  'pan-up': 'slow tilt up',
  'push-rotate': 'slow push in with a slight roll',
  drift: 'subtle handheld drift',
  'rack-focus': 'rack focus from soft to sharp',
  shake: 'a sudden camera shake that settles',
  whip: 'whip pan in, then settle',
  still: 'static camera',
};

export const ATMOSPHERE_WORDS: Record<Effect, string> = {
  none: '',
  heat: 'heat haze shimmering above the ground',
  dust: 'dust motes floating in the light',
  embers: 'sparks and embers drifting upwards',
  rain: 'rain falling steadily',
  snow: 'snow falling gently',
  fog: 'mist drifting slowly',
  flicker: 'firelight flickering across faces and walls',
  breeze: 'a breeze swaying plants, cloth and hair',
};

const SOUND_FOR: Record<Effect, string> = {
  none: 'soft room tone and a distant ambience',
  heat: 'hot dry wind',
  dust: 'a light breeze',
  embers: 'crackling fire',
  rain: 'rain',
  snow: 'cold wind',
  fog: 'wind and distant birds',
  flicker: 'crackling fire',
  breeze: 'a gentle breeze and rustling leaves',
};

export const KEEP_STYLE = 'Keep the exact illustrated art style, characters and composition of the first frame. No text, no captions.';

/** A workable motion prompt without AI: the picture, gentle life, the camera, the sound. */
export function templateMotionPrompt(scene: Scene, shot: Shot): string {
  const subject = (shot.imagePrompt || spokenText(scene.narration)).trim().replace(/\.$/, '');
  const air = ATMOSPHERE_WORDS[scene.effect];
  return [
    subject + '.',
    'Everything comes gently to life: people breathe, blink and make small natural movements, cloth and hair stir' + (air ? ', ' + air : '') + '.',
    'Camera: ' + CAMERA_WORDS[shot.motion] + '.',
    'Sound: ' + SOUND_FOR[scene.effect] + ' only. No dialogue, no music.',
    KEEP_STYLE,
  ].join(' ');
}

export interface MusicSection {
  sceneId: string;
  label: string;
  title: string;
  summary: string;
  seconds: number;
}

/** The opening, then each chapter: where a new piece of music can start. */
export function musicSections(project: Project): MusicSection[] {
  const starts = project.scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i === 0 || s.chapter.trim());
  return starts.map(({ s, i }, k) => {
    const end = k < starts.length - 1 ? starts[k + 1].i : project.scenes.length;
    const scenes = project.scenes.slice(i, end);
    return {
      sceneId: s.id,
      label: i === 0 ? 'Opening' : s.chapter.trim(),
      title: i === 0 ? (project.title || 'Opening') : s.chapter.trim(),
      summary: scenes.map((x) => spokenText(x.narration)).join(' ').split(/\s+/).slice(0, 110).join(' '),
      seconds: scenes.reduce((n, _x, j) => n + sceneSeconds(project, i + j), 0),
    };
  });
}

/** A workable Flow Music brief without AI. */
export function templateMusicPrompt(project: Project, section: MusicSection, index: number): string {
  const moods = ['curious and atmospheric, slowly drawing the listener in', 'warm and flowing, gently building', 'thoughtful with a quiet sense of wonder', 'lightly adventurous, with gentle momentum', 'reflective and resolving, a soft ending'];
  const mood = index === 0 ? moods[0] : moods[1 + ((index - 1) % (moods.length - 1))];
  return [
    'Instrumental cinematic documentary underscore for a history video: "' + (project.title || project.topic || 'history') + '" - ' + section.title + '.',
    'Use traditional instruments authentic to the time and place of the story, blended with soft strings and a light pad.',
    'Mood: ' + mood + '. Around 80 BPM.',
    'Length about ' + formatDuration(Math.max(30, section.seconds)) + '.',
    'INSTRUMENTAL ONLY - no vocals, no lyrics. Sparse in the mid-range so it sits under a voiceover; no abrupt ending.',
  ].join(' ');
}

/** Every shot with its label, in order. */
export function labelledShots(project: Project): { scene: Scene; shot: Shot; label: string; index: number }[] {
  return project.scenes.flatMap((scene, i) => scene.shots.map((shot, k) => ({ scene, shot, label: shotLabel(i, k), index: i })));
}

/** "03b.mp4", "scene-3b.mp4", "Scene 3 b.mp4" -> "3b". '' when there is no shot number in the name. */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  const m = base.match(/(\d+)\s*[-_ ]?\s*([a-z])?(?![a-z])/i);
  if (!m) return '';
  return String(Number(m[1])) + (m[2] ? m[2].toLowerCase() : '');
}
