// ---------------------------------------------------------------------------
// ElevenLabs: speaking a scene, and timing a recording someone made themselves.
//
// speak()  uses the "with-timestamps" endpoint, which returns the audio AND the
//          second every character is spoken - that is what makes the captions
//          land on the right word. The neighbouring scenes' text is sent too,
//          so a nine-minute video recorded one scene at a time still sounds
//          like one continuous read rather than fifty separate takes.
//
// Eleven v4 (and v3) follow voice directions written into the text as audio
// tags - "[amused] They asked to sell pepper. [long pause] Then they stayed." -
// so those models get the tags, and every other model gets the bare words
// (they would read "[amused]" aloud). Timed words never include a tag.
//
// align()  takes a clip recorded on the mic plus its script and returns when
//          each word is said (forced alignment). Without an ElevenLabs key the
//          browser spreads the words evenly instead, which is close enough for
//          phrase-at-a-time captions.
// ---------------------------------------------------------------------------

import { parseBuffer } from 'music-metadata';
import { fetchRetrying } from './retry.mjs';

const API = 'https://api.elevenlabs.io/v1';
const OUTPUT_FORMAT = 'mp3_44100_128'; // constant bitrate => reliable duration

export const VOICE_MODELS = [
  { id: 'eleven_v4', label: 'Eleven v4 — most expressive, follows [voice directions] (recommended)' },
  { id: 'eleven_v4_turbo', label: 'Eleven v4 Turbo — fast, follows [voice directions]' },
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — steady long narration, no directions' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 — faster, half the credits' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — fastest, lowest cost' },
];

export async function listVoices(apiKey) {
  const res = await fetchRetrying(API + '/voices', { headers: { 'xi-api-key': apiKey } });
  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));
  const data = JSON.parse(raw);
  return (data.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category || '',
    description: (v.labels && [v.labels.accent, v.labels.gender, v.labels.age, v.labels.use_case, v.labels.description]
      .filter(Boolean).join(' · ')) || '',
    previewUrl: v.preview_url || '',
  }));
}

/** Characters left this month, or null if the key is not allowed to say. */
export async function quota(apiKey) {
  const res = await fetchRetrying(API + '/user/subscription', { headers: { 'xi-api-key': apiKey } });
  if (!res.ok) return null;
  const s = await res.json();
  return { used: s.character_count, limit: s.character_limit, tier: s.tier || '' };
}

/** "[warm]", "[long pause]" - the same pattern as src/lib/speech.ts. */
const AUDIO_TAG = /\[[^[\]\n]{1,60}\]/g;
export const supportsTags = (modelId) => /^eleven_v(3|4)/.test(String(modelId || ''));
/** The words as heard: each tag becomes a space (the same rule as the browser's spokenText). */
export const spokenText = (text) => String(text || '').replace(AUDIO_TAG, ' ').replace(/\s+/g, ' ').trim();
const forModel = (text, modelId) => (supportsTags(modelId) ? String(text || '').replace(/\s+/g, ' ').trim() : spokenText(text));

/**
 * The requests to try, best first. Newer models may not take every setting older
 * ones did (style, speaker boost, neighbouring text), so each fallback asks for less
 * rather than failing the whole scene.
 */
export function speakBodies(text, settings, context = {}) {
  const model = settings.modelId || 'eleven_v4';
  const expressive = supportsTags(model);
  const stability = clamp(settings.stability, 0, 1, 0.45);
  const similarity = clamp(settings.similarity, 0, 1, 0.75);
  const speed = clamp(settings.speed, 0.7, 1.2, 1);
  const full = { stability, similarity_boost: similarity };
  if (!expressive) Object.assign(full, { style: clamp(settings.style, 0, 1, 0.3), use_speaker_boost: true });
  if (speed !== 1) full.speed = speed;
  const base = { text: forModel(text, model), model_id: model };
  const withContext = { ...base, voice_settings: full };
  if (context.previous) withContext.previous_text = forModel(context.previous, model).slice(-600);
  if (context.next) withContext.next_text = forModel(context.next, model).slice(0, 600);
  const bodies = [withContext, { ...base, voice_settings: full }];
  // Last resort for the expressive models: stability on its three steps (creative, natural, robust), nothing else.
  if (expressive) bodies.push({ ...base, voice_settings: { stability: [0, 0.5, 1].reduce((a, b) => (Math.abs(b - stability) < Math.abs(a - stability) ? b : a)) } });
  return bodies.filter((b, i) => i === 0 || JSON.stringify(b) !== JSON.stringify(bodies[i - 1]));
}

/** Speak one scene. Returns { buffer, duration, words } or null for empty text. */
export async function speak(apiKey, text, settings, context = {}) {
  if (!spokenText(text)) return null;
  if (!settings.voiceId) throw new Error('Pick a voice first.');

  const voice = encodeURIComponent(settings.voiceId);
  const post = (path, body) => fetchRetrying(API + '/text-to-speech/' + voice + path + '?output_format=' + OUTPUT_FORMAT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const bodies = speakBodies(text, settings, context);
  let res = null;
  let lastError = '';
  for (const body of bodies) {
    res = await post('/with-timestamps', body);
    if (res.ok) break;
    // 400/422: this request asked for something the model does not take - try asking for less.
    if (res.status !== 400 && res.status !== 422) throw new Error(explainError(res.status, await res.text()));
    lastError = explainError(res.status, await res.text());
  }

  // Some models/accounts do not offer timestamps at all. Fall back to plain audio;
  // the browser then spreads the words across the clip.
  if (!res.ok) {
    const plain = await post('', bodies[bodies.length - 1]);
    if (!plain.ok) throw new Error(lastError || explainError(plain.status, await plain.text()));
    const buffer = Buffer.from(await plain.arrayBuffer());
    return { buffer, duration: await measure(buffer, 'audio/mpeg', 0), words: [] };
  }

  const data = await res.json();
  const buffer = Buffer.from(data.audio_base64, 'base64');
  // `alignment` maps to the characters we sent; `normalized_alignment` can come
  // back romanised for non-Latin scripts, which would put the wrong words on screen.
  const alignment = data.alignment || data.normalized_alignment || null;
  let words = [];
  let lastEnd = 0;
  if (alignment && Array.isArray(alignment.characters)) {
    const starts = alignment.character_start_times_seconds || [];
    const ends = alignment.character_end_times_seconds || [];
    words = charsToWords(alignment.characters, starts, ends);
    lastEnd = ends.length ? ends[ends.length - 1] : 0;
  }
  return { buffer, duration: await measure(buffer, 'audio/mpeg', lastEnd), words };
}

/**
 * When each word of `text` is said in a recording. Returns [] if ElevenLabs
 * could not align it - the caller falls back to an even spread.
 */
export async function align(apiKey, buffer, fileName, mimeType, text) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);
  form.append('text', spokenText(text));
  const res = await fetchRetrying(API + '/forced-alignment', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  }, { attempts: 2, timeoutMs: 90000 });
  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));
  const data = JSON.parse(raw);
  return (Array.isArray(data.words) ? data.words : [])
    .map((w) => ({ word: String(w.text || '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }))
    .filter((w) => w.word);
}

/** True length of a clip, falling back to the last spoken timestamp. */
export async function measure(buffer, mimeType, fallback = 0) {
  try {
    const meta = await parseBuffer(buffer, { mimeType }, { duration: true });
    const d = meta && meta.format && meta.format.duration;
    if (d && d > 0) return Math.max(d, fallback);
  } catch {
    // ignore and use the fallback
  }
  return fallback > 0 ? fallback : 2;
}

/** Group per-character timings into whole words. Audio tags, if the alignment includes them, are not words. */
export function charsToWords(characters, starts, ends) {
  const words = [];
  let buf = '';
  let start = 0;
  let end = 0;
  const flush = () => {
    const w = buf.trim();
    if (w) words.push({ word: w, start, end });
    buf = '';
  };
  let inTag = false;
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (ch === '[') { flush(); inTag = true; continue; }
    if (inTag) { if (ch === ']') inTag = false; continue; }
    if (/\s/.test(ch)) { flush(); continue; }
    if (!buf) start = typeof starts[i] === 'number' ? starts[i] : end;
    buf += ch;
    end = typeof ends[i] === 'number' ? ends[i] : start;
  }
  flush();
  return words;
}

function clamp(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function explainError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.detail && (j.detail.message || j.detail.status || (typeof j.detail === 'string' ? j.detail : ''))) || j.message || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }
  if (status === 401) return 'That ElevenLabs API key was rejected. Copy it again from elevenlabs.io and re-paste it.';
  if (status === 402 || /quota/i.test(detail)) {
    return 'Your ElevenLabs character quota is used up for this month. Record the rest yourself, or upgrade the plan.';
  }
  if (status === 422) return 'ElevenLabs rejected the text or voice settings: ' + detail;
  if (status === 429) return 'ElevenLabs rate limit hit. Wait a few seconds and try again.';
  if (status >= 500) return 'ElevenLabs had a server error (' + status + '). Try again in a moment.';
  return 'ElevenLabs error ' + status + ': ' + (detail || 'unknown');
}
