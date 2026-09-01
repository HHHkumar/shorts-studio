import type { DesignSettings, Scene, ScriptLine, WordTiming } from './types';
import { FPS } from './types';

/** What the voiceover step gives us back for one script line. */
export interface AudioResult {
  src: string; // path relative to public/, e.g. "generated/job123/s2.mp3"
  duration: number; // seconds - the server's header estimate
  words: WordTiming[];
  /** Exact decoded length, measured in the browser. Preferred when present. */
  measuredDuration?: number;
  /** Where sound actually starts and stops inside the clip. */
  speechStart?: number;
  speechEnd?: number;
  /** Shift applied to word timings to cancel the mp3 encoder delay. */
  captionOffset?: number;
}

/**
 * Turn the written script plus the measured audio into a frame-exact timeline.
 *
 * Sync is decided entirely here, and it rests on three rules:
 *
 *   1. A scene is never shorter than its own narration. Durations round *up*,
 *      so a scene can never clip the last syllable off a line.
 *   2. The audio for a scene lives inside that scene's Sequence, so it starts
 *      on the scene's first frame by construction - there is no offset to drift.
 *   3. Length comes from the decoded audio when we have it, not from an
 *      estimate of the file header.
 */
export function buildScenes(
  script: ScriptLine[],
  audio: Record<number, AudioResult>,
  design: DesignSettings,
  fps: number = FPS,
): { scenes: Scene[]; totalDurationInFrames: number } {
  let cursor = 0;
  const scenes: Scene[] = [];

  script.forEach((line, i) => {
    const a = audio[i];
    const spoken = a ? audibleLength(a, design) : 0;
    // A short breath after each line so it never feels clipped.
    const padded = spoken > 0 ? spoken + design.scenePaddingSeconds : 0;

    let seconds: number;
    if (line.kind === 'countdown') {
      // The countdown lasts at least as long as the user asked for, and at
      // least as long as anything spoken over it.
      seconds = Math.max(design.countdownSeconds, padded);
      // Thinking time turned all the way down means: no countdown at all.
      if (seconds <= 0) return;
    } else if (spoken > 0) {
      // Real audio beats any guess: the scene is exactly its narration plus a
      // breath. The floor only guards against a freakishly short clip.
      seconds = Math.max(padded, 0.8);
    } else {
      // Nothing recorded yet - estimate from the word count so the preview works.
      seconds = minSecondsFor(line);
    }

    // Round up, never down: half a frame of clipped speech is audible. The
    // final guard is the important one: Math.max(1, NaN) is NaN, so without it
    // a single bad measurement makes every later scene overlap the last.
    const rounded = Math.ceil(seconds * fps);
    const durationInFrames = Number.isFinite(rounded) ? Math.max(1, rounded) : Math.max(1, Math.ceil(minSecondsFor(line) * fps));

    scenes.push({
      ...line,
      id: 's' + i,
      audioSrc: a ? a.src : '',
      audioDuration: a ? trueDuration(a) : 0,
      words: a ? a.words : [],
      captionOffset: a && a.captionOffset ? a.captionOffset : 0,
      stockSrc: line.stockSrc || '',
      stockCredit: line.stockCredit || '',
      startFrame: cursor,
      durationInFrames,
    });
    cursor += durationInFrames;
  });

  return { scenes, totalDurationInFrames: Math.max(fps, cursor) };
}

/** A number we are willing to lay a timeline out with. */
const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** The most trustworthy length we have for a clip, or 0 if we have none. */
export function trueDuration(a: AudioResult): number {
  if (usable(a.measuredDuration)) return a.measuredDuration;
  // Guarded rather than returned raw: a duration that came back as undefined or
  // NaN used to flow straight into the frame maths, and one NaN there poisons
  // the running cursor - so every scene after it gets a nonsense start frame
  // and they stop being laid end to end.
  return usable(a.duration) ? a.duration : 0;
}

/**
 * How much of the clip we actually need on screen.
 *
 * With "trim trailing silence" on we stop shortly after the last sound instead
 * of sitting through the tail the voice model left behind, which is what makes
 * a video feel tight rather than draggy. Only silence is ever cut.
 */
function audibleLength(a: AudioResult, design: DesignSettings): number {
  const full = trueDuration(a);
  if (!usable(full)) return 0;
  if (!design.trimTrailingSilence) return full;
  if (!usable(a.speechEnd)) return full;
  // Leave a little air after the last sound so nothing sounds guillotined.
  return Math.min(full, a.speechEnd + 0.12);
}

/** Floor length for a scene that has no audio yet, so the preview still works. */
function minSecondsFor(line: ScriptLine): number {
  const words = line.narration.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return line.kind === 'outro' ? 2 : 1.5;
  // ~2.6 words per second is a natural narration pace.
  return Math.max(1.5, words / 2.6);
}

export const framesToClock = (frames: number, fps: number = FPS): string => {
  const total = Math.round(frames / fps);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
};

/**
 * ElevenLabs returns per-character timings. Group them into words so captions
 * can highlight one word at a time.
 */
export function charsToWords(
  characters: string[],
  starts: number[],
  ends: number[],
): WordTiming[] {
  const words: WordTiming[] = [];
  let buf = '';
  let start = 0;
  let end = 0;

  const flush = () => {
    const w = buf.trim();
    if (w) words.push({ word: w, start, end });
    buf = '';
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (!buf) start = starts[i] ?? end;
    buf += ch;
    end = ends[i] ?? start;
  }
  flush();
  return words;
}
