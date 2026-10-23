// ---------------------------------------------------------------------------
// ElevenLabs text-to-speech.
//
// We use the "with-timestamps" endpoint, which returns the audio AND the exact
// second every character is spoken. That is what makes the karaoke captions and
// the picture/sound sync frame-accurate instead of guessed.
// ---------------------------------------------------------------------------

import { collapseTimings, expandForSpeech } from './speech.mjs';
import { directedText, dropBracketed, splitLeadingTags } from '../src/lib/delivery.ts';
import { parseBuffer } from 'music-metadata';
import { fetchRetrying } from './retry.mjs';

const API = 'https://api.elevenlabs.io/v1';
const OUTPUT_FORMAT = 'mp3_44100_128'; // constant bitrate => reliable duration

export async function listVoices(apiKey) {
  const res = await fetchRetrying(API + '/voices', { headers: { 'xi-api-key': apiKey } });
  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));
  const data = JSON.parse(raw);
  return (data.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category || '',
    description: (v.labels && [v.labels.accent, v.labels.gender, v.labels.age, v.labels.use_case]
      .filter(Boolean).join(' · ')) || '',
    previewUrl: v.preview_url || '',
  }));
}

/**
 * Speak one line. Returns { buffer, duration, words } or null for empty text.
 *
 * `scene`, when given, is the script line the text came from: its kind and its
 * `delivery` decide the audio tag a v3 or v4 voice is directed with (see
 * src/lib/delivery.ts). Text that already starts with a tag keeps its own.
 */
export async function speak(apiKey, text, settings, scene = null) {
  const modelId = settings.modelId || 'eleven_v4';
  const line = directedText((text || '').trim(), scene, modelId);
  if (!line) return null;

  // The direction goes to the voice as it is; only the words after it are
  // expanded, and only they are on screen.
  const { tags, rest } = splitLeadingTags(line);
  if (!rest) return null;
  // The voice hears "ten megawatts"; the screen keeps "10 MW". See speech.mjs.
  const expanded = expandForSpeech(rest);
  const { written, map } = expanded;
  const spoken = tags ? tags + ' ' + expanded.spoken : expanded.spoken;

  const caps = modelCaps(modelId);
  const voiceSettings = {
    stability: clamp(settings.stability, 0, 1, 0.45),
    similarity_boost: clamp(settings.similarity, 0, 1, 0.75),
    use_speaker_boost: true,
  };
  if (caps.style) voiceSettings.style = clamp(settings.style, 0, 1, 0.3);
  const speed = clamp(settings.speed, 0.7, 1.2, 1);
  if (caps.speed && speed !== 1) voiceSettings.speed = speed;

  const body = JSON.stringify({
    text: spoken,
    model_id: modelId,
    voice_settings: voiceSettings,
  });

  const url =
    API + '/text-to-speech/' + encodeURIComponent(settings.voiceId) +
    '/with-timestamps?output_format=' + OUTPUT_FORMAT;

  let res = await fetchRetrying(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body,
  });

  // Some models/accounts do not offer timestamps. Fall back to plain audio;
  // captions then show the whole line instead of highlighting word by word.
  if (res.status === 400 || res.status === 404) {
    const plainUrl =
      API + '/text-to-speech/' + encodeURIComponent(settings.voiceId) +
      '?output_format=' + OUTPUT_FORMAT;
    const plain = await fetchRetrying(plainUrl, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body,
    });
    if (!plain.ok) throw new Error(explainError(plain.status, await plain.text()));
    const buffer = Buffer.from(await plain.arrayBuffer());
    return { buffer, duration: await measure(buffer, 0), words: [] };
  }

  if (!res.ok) throw new Error(explainError(res.status, await res.text()));

  const data = await res.json();
  const buffer = Buffer.from(data.audio_base64, 'base64');
  // Prefer `alignment` over `normalized_alignment`. The normalised version is
  // the text after ElevenLabs' own processing, which for non-Latin scripts can
  // come back romanised - that is what turned Kannada narration into English on
  // screen. `alignment` maps to the characters we actually sent, so the words
  // shown are always the words the script says.
  const alignment = data.alignment || data.normalized_alignment || null;

  let words = [];
  let alignmentEnd = 0;
  if (alignment && Array.isArray(alignment.characters)) {
    const allEnds = alignment.character_end_times_seconds || [];
    // The timings cover the characters sent, tags and all; a tag is a
    // direction, not words, so it comes out before anything is grouped.
    const { characters, starts, ends } = dropBracketed(
      alignment.characters, alignment.character_start_times_seconds || [], allEnds,
    );
    // Timed against the spoken text, then folded back onto the written words,
    // so a caption never shows the expansion the voice needed.
    words = collapseTimings(charsToWords(characters, starts, ends), written, map);
    alignmentEnd = allEnds.length ? allEnds[allEnds.length - 1] : 0;
  }

  return { buffer, duration: await measure(buffer, alignmentEnd), words };
}

/** True length of the mp3, falling back to the last spoken timestamp. */
async function measure(buffer, fallback) {
  try {
    const meta = await parseBuffer(buffer, { mimeType: 'audio/mpeg' }, { duration: true });
    const d = meta && meta.format && meta.format.duration;
    if (d && d > 0) return Math.max(d, fallback);
  } catch {
    // ignore and use the fallback
  }
  return fallback > 0 ? fallback : 2;
}

/** Group per-character timings into whole words. */
function charsToWords(characters, starts, ends) {
  const words = [];
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

function explainError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.detail && (j.detail.message || j.detail.status)) || j.message || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }
  if (status === 401) return 'That ElevenLabs API key was rejected. Copy it again from elevenlabs.io and re-paste it.';
  if (status === 402 || /quota/i.test(detail)) {
    return 'Your ElevenLabs character quota is used up for this month. Shorten the script or upgrade the plan.';
  }
  if (status === 422) return 'ElevenLabs rejected the text or voice settings: ' + detail;
  if (status === 429) return 'ElevenLabs rate limit hit. Wait a few seconds and press Make voiceover again.';
  if (status >= 500) return 'ElevenLabs had a server error (' + status + '). Try again in a moment.';
  return 'ElevenLabs error ' + status + ': ' + (detail || 'unknown');
}

// `style` and `speed`: whether the model takes those two settings at all. The
// v4 family dropped both sliders, so neither is sent to it - the app hides
// them too, rather than letting a slider do nothing.
// `indic`: speaks Kannada, Telugu, Malayalam, Marathi, Bengali and Gujarati.
// v2 and Flash cover Hindi and Tamil only, and read the rest with an accent
// that is plainly wrong; the translate step offers all eight.
export const VOICE_MODELS = [
  { id: 'eleven_v4', label: 'Eleven v4 — most natural, 90+ languages (recommended)', style: false, speed: false, indic: true },
  { id: 'eleven_v4_turbo', label: 'Eleven v4 Turbo — faster v4', style: false, speed: false, indic: true },
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — previous generation', style: true, speed: true, indic: false },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — fastest, lowest cost', style: true, speed: true, indic: false },
  // Deprecated by ElevenLabs in favour of Flash, but kept: a browser that saved
  // it would otherwise show v4 in the dropdown while still recording Turbo.
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 — deprecated, use Flash', style: true, speed: true, indic: false },
];

/** What a model accepts. A model not in the list is sent everything, as before. */
export function modelCaps(modelId) {
  return VOICE_MODELS.find((m) => m.id === modelId) || { style: true, speed: true };
}
