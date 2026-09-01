import type { WordTiming } from './types';

// ---------------------------------------------------------------------------
// Work out when each labelled thing is being spoken, so it can appear or light
// up at exactly that moment. The narration works through them in order, so this
// is a forward scan: find where each label's words begin in the spoken stream.
//
// Written for the four answer options, but every explainer panel uses it too -
// process steps, diagram boxes, timeline entries, recap points. That is the
// whole trick behind the reveals: nothing is timed by guesswork, everything is
// timed by the voice. A storyboard never has to author a reveal order, because
// the order is already in what the narrator says.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'of', 'or', 'and', 'to', 'in', 'on', 'at',
  'as', 'by', 'for', 'be', 'do', 'does', 'no', 'not', 'they', 'them',
]);

const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The words worth matching on: skips filler that appears everywhere. */
function keyWords(text: string): string[] {
  const all = text.split(/\s+/).map(normalise).filter(Boolean);
  const meaty = all.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return meaty.length ? meaty : all;
}

/**
 * Returns one start time per option, in seconds from the scene's first frame.
 *
 * If the narration cannot be matched confidently (a paraphrase, another
 * language, no timings at all) it falls back to spreading the options evenly
 * across the scene, which still reads as deliberate rather than broken.
 */
export function alignOptions(
  words: WordTiming[],
  options: string[],
  sceneSeconds: number,
): number[] {
  const evenly = options.map((_, i) => (sceneSeconds * i) / Math.max(1, options.length));
  if (!words.length || !options.length) return evenly;

  const spoken = words.map((w) => normalise(w.word));
  const starts: number[] = [];
  let cursor = 0;

  for (const option of options) {
    const keys = keyWords(option);
    if (!keys.length) {
      starts.push(NaN);
      continue;
    }

    let found = -1;
    for (let i = cursor; i < spoken.length; i++) {
      if (spoken[i] !== keys[0]) continue;
      // A single common word is weak evidence. When the option has more words,
      // require the second one to turn up close behind before trusting it.
      if (keys.length > 1) {
        const window = spoken.slice(i + 1, i + 6);
        if (!window.includes(keys[1])) continue;
      }
      found = i;
      break;
    }

    if (found === -1) {
      starts.push(NaN);
      continue;
    }
    starts.push(words[found].start);
    cursor = found + 1;
  }

  // Every option must have matched, and they must come out in reading order.
  const allMatched = starts.every((t) => Number.isFinite(t));
  const ascending = starts.every((t, i) => i === 0 || t >= starts[i - 1]);
  if (!allMatched || !ascending) return evenly;

  return starts;
}

/** Which option is being spoken at this moment, or -1 between options. */
export function activeOption(starts: number[], time: number, sceneSeconds: number): number {
  if (!starts.length) return -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    const end = i + 1 < starts.length ? starts[i + 1] : sceneSeconds;
    if (time >= starts[i] && time < end) return i;
  }
  return -1;
}

/**
 * The general form: `alignOptions` under a name that does not lie about what
 * it is used for. Both point at the same scan.
 */
export const alignLabels = alignOptions;

/**
 * How many entries have been reached by now, for panels that build up rather
 * than highlight. Always at least one, so a scene is never blank on entry.
 */
export function revealedCount(starts: number[], time: number): number {
  let n = 1;
  for (let i = 0; i < starts.length; i++) {
    if (Number.isFinite(starts[i]) && time >= starts[i]) n = i + 1;
  }
  return Math.min(Math.max(n, 1), starts.length);
}

/**
 * Which of these labels the narration never says.
 *
 * The reveals are timed by matching labels against the spoken words, so a label
 * the narrator never mentions can only fall back to an even spread. Same
 * matching rules as `alignLabels`, so the warning in the editor agrees with
 * what the renderer will actually do.
 */
export function missingLabels(narration: string, labels: string[]): string[] {
  const spoken = narration.split(/\s+/).map(normalise).filter(Boolean);
  const missing: string[] = [];
  let cursor = 0;

  for (const label of labels) {
    const keys = keyWords(label);
    if (!keys.length) continue;
    let found = -1;
    for (let i = cursor; i < spoken.length; i++) {
      if (spoken[i] !== keys[0]) continue;
      if (keys.length > 1 && !spoken.slice(i + 1, i + 6).includes(keys[1])) continue;
      found = i;
      break;
    }
    if (found === -1) missing.push(label);
    else cursor = found + 1;
  }
  return missing;
}
