// ---------------------------------------------------------------------------
// The Kannada alphabet (ವರ್ಣಮಾಲೆ) and the timeline that reads it aloud.
//
// The modern school varnamale: 13 vowels, 2 yogavahas, 25 grouped consonants
// in five vargas, and 9 ungrouped ones - 49 letters. ಌ and ೠ are left out, as
// the textbooks now leave them out.
//
// The video lights each letter while the voice says it. Every letter has its
// own clip, so the timing needs no guessing: a letter stays lit for exactly as
// long as its own recording, plus a breath. With no clips at all (before the
// voice has been recorded) each beat falls back to a fixed length, so the
// grid can be previewed and checked silent.
//
// Pure data and arithmetic - no React, no Remotion - so the tool that records
// the voice and the composition that draws it read the same list.
// ---------------------------------------------------------------------------

export type GroupId = 'svara' | 'yogavaha' | 'ka' | 'cha' | 'tta' | 'ta' | 'pa' | 'avargiya';

export interface LetterGroup {
  id: GroupId;
  /** As a Kannada teacher names it. */
  kannada: string;
  english: string;
  colour: string;
}

export const GROUPS: Record<GroupId, LetterGroup> = {
  svara:    { id: 'svara',    kannada: 'ಸ್ವರಗಳು',     english: 'Vowels',               colour: '#E8833A' },
  yogavaha: { id: 'yogavaha', kannada: 'ಯೋಗವಾಹಗಳು',  english: 'Yogavahas',            colour: '#9B5DE5' },
  ka:       { id: 'ka',       kannada: 'ಕ ವರ್ಗ',      english: 'ka-varga · throat',     colour: '#2A9D8F' },
  cha:      { id: 'cha',      kannada: 'ಚ ವರ್ಗ',      english: 'cha-varga · palate',    colour: '#3A86FF' },
  tta:      { id: 'tta',      kannada: 'ಟ ವರ್ಗ',      english: 'ṭa-varga · roof',       colour: '#E63973' },
  ta:       { id: 'ta',       kannada: 'ತ ವರ್ಗ',      english: 'ta-varga · teeth',      colour: '#C77D00' },
  pa:       { id: 'pa',       kannada: 'ಪ ವರ್ಗ',      english: 'pa-varga · lips',       colour: '#4C9A2A' },
  avargiya: { id: 'avargiya', kannada: 'ಅವರ್ಗೀಯ ವ್ಯಂಜನಗಳು', english: 'Ungrouped consonants', colour: '#6D597A' },
};

export interface Letter {
  /** Stable, filename-safe: names the voice clip. */
  id: string;
  glyph: string;
  /** ISO 15919, the romanisation Kannada dictionaries use. */
  roman: string;
  group: GroupId;
}

const row = (group: GroupId, pairs: string): Letter[] =>
  pairs.split(' ').map((pair) => {
    const [glyph, roman] = pair.split(':');
    return { id: '', glyph, roman, group };
  });

export const LETTERS: Letter[] = [
  ...row('svara', 'ಅ:a ಆ:ā ಇ:i ಈ:ī ಉ:u ಊ:ū ಋ:ṛ ಎ:e ಏ:ē ಐ:ai ಒ:o ಓ:ō ಔ:au'),
  ...row('yogavaha', 'ಅಂ:aṁ ಅಃ:aḥ'),
  ...row('ka', 'ಕ:ka ಖ:kha ಗ:ga ಘ:gha ಙ:ṅa'),
  ...row('cha', 'ಚ:ca ಛ:cha ಜ:ja ಝ:jha ಞ:ña'),
  ...row('tta', 'ಟ:ṭa ಠ:ṭha ಡ:ḍa ಢ:ḍha ಣ:ṇa'),
  ...row('ta', 'ತ:ta ಥ:tha ದ:da ಧ:dha ನ:na'),
  ...row('pa', 'ಪ:pa ಫ:pha ಬ:ba ಭ:bha ಮ:ma'),
  ...row('avargiya', 'ಯ:ya ರ:ra ಲ:la ವ:va ಶ:śa ಷ:ṣa ಸ:sa ಹ:ha ಳ:ḷa'),
].map((letter, i) => ({ ...letter, id: 'l' + String(i + 1).padStart(2, '0') }));

// ---------------------------------------------------------------------------
// What the voice says between the letters. Each is its own clip too.
// ---------------------------------------------------------------------------

export interface Spoken {
  id: string;
  text: string;
}

export const LINES = {
  intro:    { id: 'intro',    text: 'ಕನ್ನಡ ವರ್ಣಮಾಲೆ' },
  svara:    { id: 'svara',    text: 'ಸ್ವರಗಳು' },
  yogavaha: { id: 'yogavaha', text: 'ಯೋಗವಾಹಗಳು' },
  vargiya:  { id: 'vargiya',  text: 'ವರ್ಗೀಯ ವ್ಯಂಜನಗಳು' },
  avargiya: { id: 'avargiya', text: 'ಅವರ್ಗೀಯ ವ್ಯಂಜನಗಳು' },
  outro:    { id: 'outro',    text: 'ಕನ್ನಡ ವರ್ಣಮಾಲೆಯಲ್ಲಿ ನಲವತ್ತೊಂಬತ್ತು ಅಕ್ಷರಗಳಿವೆ' },
} satisfies Record<string, Spoken>;

/** Every clip the video can play, in the order it plays them. */
export function allSpoken(): Spoken[] {
  const out: Spoken[] = [];
  for (const seg of segmentPlan()) {
    out.push(seg.kind === 'letter' ? { id: LETTERS[seg.letter].id, text: LETTERS[seg.letter].glyph } : seg.line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The timeline.
// ---------------------------------------------------------------------------

export type SegmentKind = 'title' | 'section' | 'letter' | 'outro';

type Planned =
  | { kind: 'title' | 'section' | 'outro'; line: Spoken; section?: GroupId }
  | { kind: 'letter'; letter: number };

/** Which section heading is spoken before the first letter of which group. */
const SECTION_BEFORE: Partial<Record<GroupId, Spoken>> = {
  svara: LINES.svara,
  yogavaha: LINES.yogavaha,
  ka: LINES.vargiya,
  avargiya: LINES.avargiya,
};

function segmentPlan(): Planned[] {
  const plan: Planned[] = [{ kind: 'title', line: LINES.intro }];
  LETTERS.forEach((letter, i) => {
    const before = SECTION_BEFORE[letter.group];
    if (before && (i === 0 || LETTERS[i - 1].group !== letter.group)) {
      plan.push({ kind: 'section', line: before, section: letter.group });
    }
    plan.push({ kind: 'letter', letter: i });
  });
  plan.push({ kind: 'outro', line: LINES.outro });
  return plan;
}

export interface Clip {
  /** Path under public/, for staticFile(). */
  src: string;
  /** Seconds, as measured from the file. */
  duration: number;
}

export type Clips = Record<string, Clip>;

export interface Segment {
  kind: SegmentKind;
  from: number;
  frames: number;
  /** The clip to play at `from`, if one was recorded. */
  clip: Clip | null;
  text: string;
  /** Index into LETTERS - for a letter, that letter; otherwise -1. */
  letter: number;
  /** The group a section heading introduces. */
  section: GroupId | null;
}

/** Silence after each clip, in seconds. Longer after headings so they land. */
const BREATH: Record<SegmentKind, number> = { title: 0.9, section: 0.6, letter: 0.45, outro: 1.6 };
/** Shortest a beat may be, so one clipped recording cannot flash past. */
const FLOOR: Record<SegmentKind, number> = { title: 2.4, section: 1.4, letter: 1.0, outro: 3.5 };
/** Clip length assumed when none was recorded. */
const SILENT: Record<SegmentKind, number> = { title: 1.6, section: 1.0, letter: 0.7, outro: 2.5 };

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function buildTimeline(clips: Clips | null | undefined, fps: number): Segment[] {
  let cursor = 0;
  return segmentPlan().map((p) => {
    const id = p.kind === 'letter' ? LETTERS[p.letter].id : p.line.id;
    const found = clips?.[id];
    const clip = found && usable(found.duration) ? found : null;
    const spoken = clip ? clip.duration : SILENT[p.kind];
    const seconds = Math.max(FLOOR[p.kind], spoken + BREATH[p.kind]);
    const frames = Math.max(1, Math.ceil(seconds * fps));
    const seg: Segment = {
      kind: p.kind,
      from: cursor,
      frames,
      clip,
      text: p.kind === 'letter' ? LETTERS[p.letter].glyph : p.line.text,
      letter: p.kind === 'letter' ? p.letter : -1,
      section: p.kind === 'section' ? p.section ?? null : null,
    };
    cursor += frames;
    return seg;
  });
}

export function totalFrames(timeline: Segment[]): number {
  const last = timeline[timeline.length - 1];
  return last ? last.from + last.frames : 1;
}

/** The segment playing at a frame; past the end, the last one. */
export function segmentAt(timeline: Segment[], frame: number): Segment {
  for (const seg of timeline) if (frame < seg.from + seg.frames) return seg;
  return timeline[timeline.length - 1];
}

/**
 * How many letters have been said by a frame - the ones drawn as learned.
 * During a letter's own beat it is the current one, not yet counted.
 */
export function lettersBefore(timeline: Segment[], frame: number): number {
  const seg = segmentAt(timeline, frame);
  if (seg.kind === 'outro') return LETTERS.length;
  if (seg.kind === 'letter') return seg.letter;
  const next = timeline.find((s) => s.from >= seg.from && s.kind === 'letter');
  return next ? next.letter : LETTERS.length;
}
