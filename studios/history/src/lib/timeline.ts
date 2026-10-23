// ---------------------------------------------------------------------------
// Project -> frame-exact timeline.
//
// There is no manual timing anywhere. A scene lasts exactly as long as its
// narration plus a breath, rounded UP to a whole frame so a syllable is never
// clipped. A scene with no voice yet is estimated from its word count, so the
// preview is watchable from the moment a script exists.
//
// Everything inside a scene is placed on WORDS, not seconds: a shot cuts in on
// the word it names, a callout pops on its word. Re-record the line faster or
// slower and they all follow, because they are looked up in the new timings.
//
// A chapter scene starts with a short hold (the chapter card) before its
// narration; the clip, captions and every word-anchored event shift with it.
//
// Pictures overlap by `fadeFrames` at each scene boundary for the transition.
// Sound never overlaps - every clip starts on its own scene's first frame.
// ---------------------------------------------------------------------------

import { planBeats } from './beats';
import { estimateSeconds, estimateWords } from './script';
import {
  FPS, type Motion, type MusicSegment, type Point, type Project, type Scene, type TimedCallout, type TimedScene, type TimedShot,
  type Shot, type Transition, type VideoProps, type Word,
} from './types';

const AUTO_CYCLE: Exclude<Motion, 'auto'>[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'push-rotate', 'pan-up', 'drift'];

export function resolveMotion(motion: Motion, index: number): Exclude<Motion, 'auto'> {
  return motion === 'auto' ? AUTO_CYCLE[index % AUTO_CYCLE.length] : motion;
}

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Seconds of narration: the clip if there is one, else an estimate. */
export function spokenSeconds(scene: Scene): number {
  return scene.audio && usable(scene.audio.duration) ? scene.audio.duration : estimateSeconds(scene.narration);
}

export function sceneSeconds(project: Project, index: number): number {
  const scene = project.scenes[index];
  const hold = scene.chapter.trim() ? Math.max(0, project.design.chapterHold) : 0;
  return hold + spokenSeconds(scene) + Math.max(0, project.design.breath);
}

/** The words with their times, measured or estimated. */
export function sceneWords(scene: Scene): Word[] {
  if (scene.audio && scene.audio.words.length) return scene.audio.words;
  return estimateWords(scene.narration, 0.1, Math.max(0.5, spokenSeconds(scene) - 0.1));
}

/** Second (in the clip) a word index is spoken; clamps to the ends. */
export function wordTime(words: Word[], index: number): number {
  if (!words.length) return 0;
  const i = Math.max(0, Math.min(words.length - 1, Math.round(index)));
  return words[i].start;
}

const CENTRE: Point = { x: 0.5, y: 0.5 };

export function buildTimeline(project: Project, fps: number = FPS, format: VideoProps['format'] = 'landscape'): VideoProps {
  let cursor = 0;
  let autoMotion = 0;
  const scenes: TimedScene[] = project.scenes.map((scene, index) => {
    const frames = Math.max(1, Math.ceil(sceneSeconds(project, index) * fps));
    const leadIn = scene.chapter.trim() ? Math.round(Math.max(0, project.design.chapterHold) * fps) : 0;
    const words = sceneWords(scene);
    const frameOf = (wordIndex: number) => leadIn + Math.round(wordTime(words, wordIndex) * fps);

    // Shots: each cuts in on its word, never closer than a second to the one before
    // or to the end of the scene, so nothing flashes by.
    const minGap = Math.round(fps * 1);
    const starts: number[] = [];
    scene.shots.forEach((shot, i) => {
      if (i === 0) return starts.push(0);
      const prev = starts[starts.length - 1];
      const want = frameOf(shot.atWord);
      starts.push(Math.min(Math.max(want, prev + minGap), Math.max(prev + 1, frames - minGap)));
    });
    const shots: TimedShot[] = scene.shots.map((shot, i) => ({
      id: shot.id,
      image: shot.image,
      video: shot.video || '',
      videoSeconds: shot.videoSeconds || 0,
      videoSound: Boolean(shot.videoSound),
      motion: resolveMotion(shot.motion, autoMotion++),
      focus: shot.focus || CENTRE,
      layer: shot.layer && shot.layer.image ? shot.layer : null,
      elements: shot.elements || [],
      depth: typeof shot.depth === 'number' ? shot.depth : null,
      graphic: shot.graphic || null,
      credit: creditLine(shot, project.design.credits),
      from: starts[i],
      durationInFrames: Math.max(1, (i < starts.length - 1 ? starts[i + 1] : frames) - starts[i]),
    }));

    const callouts: TimedCallout[] = (scene.callouts || []).map((c) => ({
      ...c,
      at: Math.min(frameOf(c.atWord), Math.max(0, frames - 15)),
      until: frames,
    }));

    const transition: Exclude<Transition, 'auto'> = scene.transition && scene.transition !== 'auto'
      ? scene.transition
      : project.design.transition;

    const timed: TimedScene = {
      id: scene.id,
      index,
      narration: scene.narration,
      audioSrc: scene.audio ? scene.audio.src : '',
      words,
      effect: scene.effect,
      transition: index === 0 ? 'cut' : transition,
      chapter: scene.chapter.trim(),
      leadIn,
      voiceFrames: Math.round(spokenSeconds(scene) * fps),
      sourceLabel: project.kind === 'news' ? sourceLabel(project, scene) : '',
      shots,
      callouts,
      beats: [],
      startFrame: cursor,
      durationInFrames: frames,
    };
    cursor += frames;
    return timed;
  });

  // Never longer than the shortest scene, or a picture would still be arriving
  // when the one after it starts.
  const shortest = scenes.reduce((m, s) => Math.min(m, s.durationInFrames), Infinity);
  const fadeFrames = Math.max(0, Math.min(Math.round(project.design.crossfade * fps), Number.isFinite(shortest) ? shortest - 1 : 0));

  // News closes on a dated card, after the last word.
  const endCard = project.kind === 'news' && format === 'landscape' && scenes.length ? Math.round(fps * NEWS_END_SECONDS) : 0;
  const totalFrames = Math.max(fps, cursor + endCard);

  // Beats fill whatever is still too long - after the title card, if there is one.
  const titleUntil = titleCardShown({ title: project.title, design: project.design, format, scenes }, fps) ? TITLE_CARD_SECONDS * fps : 0;
  for (const sc of scenes) {
    sc.beats = planBeats({
      words: sc.words, frames: sc.durationInFrames, leadIn: sc.leadIn, fps, shots: sc.shots, callouts: sc.callouts,
      pace: project.design.pace, style: project.design.beats, seed: sc.index + 1,
      quietUntil: Math.max(0, titleUntil - sc.startFrame),
    });
  }
  return {
    title: project.title,
    scenes,
    design: project.design,
    fadeFrames,
    totalFrames,
    format,
    hook: '',
    endCard: '',
    music: musicSegments(project, scenes, totalFrames),
    kind: project.kind || 'history',
    asOf: project.kind === 'news' ? project.asOf : '',
  };
}

export const TITLE_CARD_SECONDS = 4;

/**
 * The title over the opening - unless a graphic (a headline, a chart, a map) is on screen in those
 * seconds: it carries its own words, and two sets of big words on top of each other are unreadable.
 */
export function titleCardShown(v: Pick<VideoProps, 'title' | 'design' | 'format' | 'scenes'>, fps: number = FPS): boolean {
  if (!v.design.titleCard || !v.title.trim() || v.format === 'portrait') return false;
  const end = TITLE_CARD_SECONDS * fps;
  return !v.scenes.some((sc) => sc.shots.some((sh) => sh.graphic && sc.startFrame + sh.from < end && sc.startFrame + sh.from + sh.durationInFrames > 0));
}

/** The on-screen credit for a shot's stock photo or clip, if one should show. */
export function creditLine(shot: Pick<Shot, 'credit' | 'video' | 'image' | 'graphic'>, mode: 'required' | 'all' | 'off' = 'required'): string {
  const c = shot.credit;
  if (!c || shot.graphic || mode === 'off' || (mode === 'required' && !c.required)) return '';
  return (shot.video ? 'Video: ' : 'Photo: ') + c.author + ' / ' + c.source + (c.license ? ', ' + c.license : '');
}

/** Seconds the dated end card holds at the end of a news video. */
export const NEWS_END_SECONDS = 3.5;

/** "Reuters · The Hindu": the publishers behind a scene, at most two. */
export function sourceLabel(project: Project, scene: Scene): string {
  const names = (scene.sources || [])
    .map((i) => project.sources[i])
    .filter(Boolean)
    .map((s) => s.publisher || s.title)
    .filter(Boolean);
  const unique = [...new Set(names)];
  return unique.slice(0, 2).join(' · ') + (unique.length > 2 ? ' +' + (unique.length - 2) : '');
}

/** "6 Oct 2026" from an ISO date; '' if it is not one. */
export function prettyDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear();
}

const MUSIC_BEDS: Record<string, string> = {
  calm: 'audio/bed-calm.wav',
  tense: 'audio/bed-tense.wav',
  upbeat: 'audio/bed-upbeat.wav',
};

/** The Look step's single track: a built-in bed, her own upload, or nothing. */
export function baseMusic(project: Project): string {
  return project.design.music === 'custom' ? project.design.musicSrc : MUSIC_BEDS[project.design.music] || '';
}

/**
 * The music as consecutive stretches. Each chapter cue with a track takes over
 * from its scene until the next one; before the first, the Look step's track plays.
 */
export function musicSegments(project: Project, scenes: TimedScene[], total: number): MusicSegment[] {
  const starts = new Map(scenes.map((s) => [s.id, s.startFrame]));
  const cues = (project.music || [])
    .filter((c) => c.src && starts.has(c.sceneId))
    .map((c) => ({ src: c.src, from: starts.get(c.sceneId) as number }))
    .sort((a, b) => a.from - b.from);
  const marks = [{ src: baseMusic(project), from: 0 }, ...cues];
  // A cue on the very first scene replaces the base track entirely.
  const list = marks.filter((m, i) => !(i < marks.length - 1 && marks[i + 1].from <= m.from));
  return list
    .map((m, i) => ({ src: m.src, from: m.from, to: i < list.length - 1 ? list[i + 1].from : total }))
    .filter((m) => m.src && m.to > m.from);
}

/** Timeline for a stretch of scenes only, starting at frame 0 - for the Short. */
export const HOOK_SECONDS = 4.6;

export function buildShortTimeline(project: Project, fps: number = FPS): VideoProps {
  const from = Math.max(0, Math.min(project.short.fromScene, project.scenes.length - 1));
  const to = Math.max(from, Math.min(project.short.toScene, project.scenes.length - 1));
  const kept = project.scenes.slice(from, to + 1);
  // The chapter music already playing where the Short starts carries on into it.
  const order = new Map(project.scenes.map((s, i) => [s.id, i]));
  const playing = (project.music || [])
    .filter((c) => c.src && (order.get(c.sceneId) ?? Infinity) <= from)
    .sort((a, b) => (order.get(b.sceneId) as number) - (order.get(a.sceneId) as number))[0];
  const music = (project.music || []).filter((c) => kept.some((s) => s.id === c.sceneId) && c.sceneId !== kept[0]?.id);
  if (playing && kept[0]) music.push({ ...playing, sceneId: kept[0].id });
  const sub: Project = {
    ...project,
    // A Short cannot spare a chapter card's pause.
    scenes: kept.map((s) => ({ ...s, chapter: '' })),
    design: { ...project.design, titleCard: false },
    music,
  };
  const t = buildTimeline(sub, fps, 'portrait');
  // No key words under the hook: two lines of big text at once is one too many.
  if (project.short.hook.trim() && t.scenes[0]) {
    const hookEnd = Math.round(fps * HOOK_SECONDS);
    for (const sc of t.scenes) sc.beats = sc.beats.filter((b) => b.kind !== 'pop' || sc.startFrame + b.at >= hookEnd);
  }
  // A little room at the end for the end card.
  const tail = Math.round(fps * 2.2);
  const totalFrames = t.totalFrames + tail;
  return {
    ...t,
    totalFrames,
    hook: project.short.hook,
    endCard: project.short.endCard,
    music: musicSegments(sub, t.scenes, totalFrames),
  };
}

/** "0:00 Intro / 1:12 Secret #1: The walls" - YouTube chapters from the chapter scenes. */
export function youtubeChapters(props: VideoProps, fps: number = FPS): string {
  const marks = props.scenes.filter((s) => s.chapter).map((s) => ({ at: s.startFrame / fps, title: s.chapter }));
  if (!marks.length) return '';
  const list = marks[0].at < 1 ? marks : [{ at: 0, title: 'Intro' }, ...marks];
  // YouTube's rules: starts at 0:00, at least three, each at least ten seconds long.
  const kept: typeof list = [];
  for (const m of list) if (!kept.length || m.at - kept[kept.length - 1].at >= 10) kept.push(m);
  if (kept.length < 3) return '';
  kept[0] = { ...kept[0], at: 0 };
  return kept.map((m) => formatDuration(m.at) + ' ' + m.title).join('\n');
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
