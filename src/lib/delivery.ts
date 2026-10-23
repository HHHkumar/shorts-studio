// ---------------------------------------------------------------------------
// How the voice says each line: an Eleven v4 audio tag per scene.
//
// Eleven v4 performs a line the way a bracketed direction in front of it asks
// - "[curious] What happens to the current when..." - where v2 read the same
// words in one even tone whatever they were. A quiz has a shape a single tone
// flattens: intrigue on the hook, a real question, calm while the options are
// read, confidence on the answer, warmth while it is explained.
//
// The narration is also the on-screen text, so the direction cannot live in
// it. It is a field of its own, `delivery`, written by Gemini beside each line
// and put in front of the words only on their way to the voice. The captions
// never see it: tts.mjs takes the bracketed characters back out of the timings.
//
// Directions are held to a vocabulary rather than trusted. A tag is an
// instruction to a model that was also trained on sound effects, so a word
// outside it can come back as a noise ("[thunderous]"), an accent, a shout or
// a laugh nobody wrote into the captions. Anything else falls back to the
// usual direction for that kind of scene.
//
// Pure, no DOM, .ts imports only: the server loads it through type stripping.
// ---------------------------------------------------------------------------

/** The models that perform audio tags. Any other model would read "[curious]" out loud. */
export const takesAudioTags = (modelId: string | null | undefined): boolean => /^eleven_v[34](?:_|$)/.test(String(modelId || ''));

/** The usual direction for each kind of scene, when none was written or the one written was refused. */
export const DELIVERY_BY_KIND: Record<string, string> = {
  intro: 'warm, friendly',
  hook: 'intrigued, playful',
  question: 'curious, clear',
  options: 'clear, measured',
  countdown: '',
  answer: 'confident, pleased',
  explain: 'warm, clear',
  outro: 'upbeat, friendly',
  // The explainer's own beats.
  title: 'warm, friendly',
  metaphor: 'thoughtful, warm',
  process: 'clear, steady',
  timeline: 'clear, steady',
  grid: 'clear, measured',
  versus: 'clear, curious',
  recap: 'confident, clear',
  diagram: 'clear, steady',
  motion: 'clear, steady',
  formulas: 'clear, measured',
};

/**
 * Every word a direction may use. Emotions a teacher has, how loud and how
 * fast, and the small words that join them - nothing that is a sound, an
 * accent, a character, a shout, a cry or a pause (a pause at the start of a
 * line is dead air the scene timing would have to carry).
 */
export const DELIVERY_WORDS = new Set([
  // how it feels
  'excited', 'playful', 'amazed', 'proud', 'optimistic', 'curious', 'intrigued', 'thoughtful', 'confident', 'warm',
  'friendly', 'calm', 'content', 'surprised', 'impressed', 'serious', 'encouraging', 'reassuring', 'enthusiastic',
  'cheerful', 'upbeat', 'energetic', 'mysterious', 'dramatic', 'teasing', 'earnest', 'sincere', 'gentle', 'pleased',
  'delighted', 'relaxed', 'focused', 'knowing', 'wry', 'mischievous', 'conspiratorial', 'bright', 'lively', 'eager',
  'patient', 'satisfied', 'triumphant', 'astonished', 'puzzled', 'intrigue', 'suspense', 'wonder', 'awe',
  // how it is said
  'softly', 'quietly', 'hushed', 'whispers', 'whispering', 'clearly', 'clear', 'firmly', 'firm', 'measured',
  'conversational', 'crisp', 'emphatic', 'deliberate', 'deliberately', 'slowly', 'slow', 'steady', 'steadily', 'brisk',
  'quick', 'snappy', 'punchy', 'matter-of-fact', 'plainly', 'simply',
  // the words that join them
  'a', 'an', 'the', 'and', 'of', 'in', 'with', 'like', 'slightly', 'little', 'bit', 'very', 'gently', 'warmly',
  'smile', 'tone', 'building', 'leaning', 'teaching', 'teacher', 'explaining', 'sharing', 'secret', 'revealing',
  'reveal', 'confidence', 'energy', 'lightly', 'quiet',
]);

/** The small words that join directions, and say nothing on their own. */
export const JOINING_WORDS = new Set(['a', 'an', 'the', 'and', 'of', 'in', 'with', 'like', 'slightly', 'little', 'bit', 'very']);

/** The vocabulary as the script writer is shown it: the words that direct, not the ones that join. */
export const deliveryPromptWords = (): string[] => [...DELIVERY_WORDS].filter((w) => !JOINING_WORDS.has(w));

/** At most this many directions in one tag: more and they blur into each other. */
export const MAX_PARTS = 3;
/** A direction this long is a sentence, not a tag. */
export const MAX_LENGTH = 48;

/**
 * A direction made safe to send, or '' when nothing in it is. Brackets, quotes
 * and case are taken out; each comma-separated part is kept only if every word
 * in it is in the vocabulary.
 */
export function cleanDelivery(raw: unknown): string {
  const text = String(raw == null ? '' : raw).toLowerCase().replace(/[[\](){}"'`*_]/g, ' ');
  const parts: string[] = [];
  for (const piece of text.split(/[,;/|]+/)) {
    const words = piece.trim().split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 4) continue;
    if (!words.every((w) => DELIVERY_WORDS.has(w))) continue;
    // A part that is only joining words directs nothing.
    if (words.every((w) => JOINING_WORDS.has(w))) continue;
    const part = words.join(' ');
    if (!parts.includes(part)) parts.push(part);
    if (parts.length === MAX_PARTS) break;
  }
  let out = parts.join(', ');
  while (out.length > MAX_LENGTH && parts.length > 1) out = parts.splice(-1) && parts.join(', ');
  return out.length > MAX_LENGTH ? '' : out;
}

/** The direction a scene is spoken with: its own, if it passes, else the usual one for its kind. */
export function deliveryFor(line: { kind?: string; delivery?: string } | null | undefined): string {
  const own = cleanDelivery(line && line.delivery);
  if (own) return own;
  return DELIVERY_BY_KIND[String((line && line.kind) || '')] ?? DELIVERY_BY_KIND.explain;
}

/** A bracketed direction at the very start of a line - "[slow and clear] ..." - however many there are. */
const LEADING_TAGS = /^\s*((?:\[[^\[\]\n]{1,80}\]\s*)+)/;

/** Directions already in front of the text, and the words after them. */
export function splitLeadingTags(text: string): { tags: string; rest: string } {
  const m = String(text || '').match(LEADING_TAGS);
  if (!m) return { tags: '', rest: String(text || '').trim() };
  return { tags: m[1].trim().replace(/\s+/g, ' '), rest: String(text).slice(m[0].length).trim() };
}

/**
 * The text as the voice receives it: the scene's direction in front, unless
 * the text already carries one, the model would read it out, or there is no
 * scene to take one from (a tool speaking a bare word means only that word).
 */
export function directedText(text: string, line: { kind?: string; delivery?: string } | null | undefined, modelId: string): string {
  const said = String(text || '').trim();
  if (!said || !line || !takesAudioTags(modelId) || splitLeadingTags(said).tags) return said;
  const tag = deliveryFor(line);
  return tag ? '[' + tag + '] ' + said : said;
}

/**
 * Character timings with every bracketed direction taken out, wherever it is.
 * ElevenLabs times the characters it was SENT, tags included; left in, "[warm,"
 * and "clear]" would become two words on screen and push every highlight after
 * them one word late.
 */
export function dropBracketed(
  characters: string[],
  starts: number[],
  ends: number[],
): { characters: string[]; starts: number[]; ends: number[] } {
  const out = { characters: [] as string[], starts: [] as number[], ends: [] as number[] };
  let depth = 0;
  let justClosed = false;
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (ch === '[') { depth++; continue; }
    if (ch === ']' && depth > 0) { depth--; justClosed = depth === 0; continue; }
    if (depth > 0) continue;
    // The space after a tag belongs to the tag; keep only one between words.
    if (justClosed && /\s/.test(ch)) {
      const prev = out.characters[out.characters.length - 1];
      if (prev === undefined || /\s/.test(prev)) continue;
    }
    justClosed = false;
    out.characters.push(ch);
    out.starts.push(starts[i]);
    out.ends.push(ends[i]);
  }
  return out;
}
