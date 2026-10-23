// ---------------------------------------------------------------------------
// Audio tags: voice directions written into the narration.
//
// ElevenLabs v4 (and v3) follow stage directions in square brackets, written
// right before the words they affect: "[amused] They asked to sell pepper.
// [long pause] They ended up ruling India." The tags are spoken TO the voice,
// never BY it - so everywhere the words themselves matter (captions, word
// timings, cut points, picture prompts, the teleprompter's word count) they are
// taken out, and older models, which would read them aloud, never see them.
// ---------------------------------------------------------------------------

/** "[warm]", "[long pause]", "[whispering, fearful]" - up to 60 characters, no nested brackets. */
export const AUDIO_TAG = /\[[^[\]\n]{1,60}\]/g;

/** Models that follow audio tags; every other model would say "open bracket warm". */
export const supportsTags = (modelId: string | undefined): boolean => /^eleven_v(3|4)/.test(String(modelId || ''));

/**
 * The words as they are heard: each tag becomes a space. Exactly the same rule as the
 * server's (server/tts.mjs), so the words here and the timed words there line up one to one.
 */
export function spokenText(text: string): string {
  return String(text || '').replace(AUDIO_TAG, ' ').replace(/\s+/g, ' ').trim();
}

export const hasTags = (text: string): boolean => new RegExp(AUDIO_TAG.source).test(String(text || ''));

/** What is sent to the voice: the tags for a model that follows them, the bare words for any other. */
export const textForModel = (text: string, modelId: string | undefined): string =>
  supportsTags(modelId) ? String(text || '').replace(/\s+/g, ' ').trim() : spokenText(text);

/** The narration split into words and tags, for showing tags as directions (teleprompter, editor). */
export function splitTags(text: string): { text: string; tag: boolean }[] {
  const out: { text: string; tag: boolean }[] = [];
  let last = 0;
  for (const m of String(text || '').matchAll(AUDIO_TAG)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), tag: false });
    out.push({ text: m[0], tag: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), tag: false });
  return out;
}

/** True when two narrations say exactly the same words, whatever their tags. */
export const sameWords = (a: string, b: string): boolean => {
  const norm = (t: string) => spokenText(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
};

export const stripTags = (text: string): string => spokenText(text);
