// ---------------------------------------------------------------------------
// ElevenLabs image generation.
//
// The same key that speaks the script can also draw the backdrop. That matters
// here for one reason above all others: a generated image can be born 9:16.
//
// Stock libraries are overwhelmingly landscape, so every Pexels photo we use in
// a short is a centre-crop of something composed for a wider frame - the subject
// drifts off-axis and the edges that carried the meaning are the first thing
// thrown away. Asking for the aspect ratio we actually render at removes that
// whole class of problem, and it lets one video's scenes share a house style
// instead of being twelve unrelated photographers' work stitched together.
//
// The API is two calls, not one:
//
//   POST /v1/flows/image        -> { id, status: 'pending' }
//   GET  /v1/flows/image/{id}   -> poll until 'completed', then content_url
//
// content_url is a signed link that expires about an hour out, so the caller
// downloads it to disk immediately - same reasoning as the voiceover clips and
// the stock photos. A render must not depend on a remote host still being up.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';

const API = 'https://api.elevenlabs.io/v1';

/**
 * Which models may be asked for, cheapest-and-fastest first.
 *
 * Deliberately absent: the ByteDance Seedream models. ElevenLabs disables those
 * for API keys by default and needs a separate approval, so offering them here
 * would mean a dropdown whose first choice fails for almost everybody.
 */
export const IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash — fastest, cheapest (recommended)' },
  { id: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite — cheapest of all' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash — older, still quick' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro — best quality, slowest' },
  { id: 'gpt-image-1.5', label: 'GPT Image 1.5 — strongest at text in the picture' },
  { id: 'gpt-image-2', label: 'GPT Image 2 — newest OpenAI model' },
];

export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';

/**
 * The look every scene in one video shares.
 *
 * A backdrop is not the subject of the frame - the read-along text is - so each
 * of these ends by asking for room to put words over the middle. Without that
 * the model happily centres a bright detailed object exactly where the caption
 * has to go, and the scrim in StockLayer then has to be turned up so far that
 * the picture may as well not be there.
 */
export const IMAGE_STYLES = [
  {
    id: 'editorial',
    label: 'Editorial photo — real-looking, magazine lighting',
    prompt:
      'a photographic editorial backdrop, natural light, shallow depth of field, muted colours, '
      + 'no text and no lettering of any kind',
  },
  {
    id: 'diagram',
    label: 'Clean diagram — flat vector, textbook clarity',
    prompt:
      'a clean flat vector illustration in the style of a modern science textbook, bold simple '
      + 'shapes, limited palette, generous negative space, no text and no labels',
  },
  {
    id: 'cinematic',
    label: 'Cinematic — dark, dramatic, high contrast',
    prompt:
      'a dark cinematic still, dramatic rim lighting against a near-black background, volumetric '
      + 'haze, high contrast, no text and no lettering of any kind',
  },
  {
    id: 'blueprint',
    label: 'Blueprint — technical drawing on dark paper',
    prompt:
      'a technical blueprint drawing, thin cyan line work on a deep navy ground, drafting style, '
      + 'no text and no dimension labels',
  },
];

const DEFAULT_STYLE = IMAGE_STYLES[0];

/**
 * Turn the scene's search words into something worth generating.
 *
 * `imageQuery` is written for a stock search, so it is a bare noun phrase -
 * "eddy currents", "fish gills". Handed to an image model unchanged that gets
 * you a literal, flat clip-art reading of two words. The subject and topic give
 * it the context a photographer would have been briefed with, and the style
 * suffix is what keeps scene four looking like it belongs beside scene three.
 */
export function buildPrompt({ query, custom = '', subject = '', topic = '', styleId = '' } = {}) {
  const written = String(custom || '').trim();
  const term = written || String(query || '').trim();
  if (!term) return '';

  const style = IMAGE_STYLES.find((s) => s.id === styleId) || DEFAULT_STYLE;

  // Subject and topic are context, not the subject of the picture, so they are
  // only mentioned when they add something the query does not already say - and
  // never when the creator has written the subject out themselves, because at
  // that point they have said what they want and guessing over the top of it is
  // how a described scene turns back into a stock-photo search.
  const context = written ? '' : [subject, topic]
    .map((s) => String(s || '').trim())
    .filter((s) => s && !term.toLowerCase().includes(s.toLowerCase()))
    .join(', ');

  // The style and the composition line are appended whatever the subject is.
  // They are what make a run of scenes look like one set and keep the middle of
  // the frame clear for the caption, so an edited prompt keeps both guarantees
  // rather than trading them away for control of the wording.
  return [
    term,
    context ? '(in the context of ' + context + ')' : '',
    '—',
    style.prompt + '.',
    'Composed as a background: keep the centre of the frame calm and uncluttered so caption text',
    'can sit over it legibly.',
  ]
    .filter(Boolean)
    .join(' ');
}


/** The frame we are actually rendering, in the shape the API names it. */
export function aspectFor(orientation) {
  return orientation === 'landscape' ? '16:9' : '9:16';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate one image and wait for it.
 *
 * Returns { url, mimeType, id }. The url is signed and short-lived: download it
 * now, do not store it.
 */
export async function generateImage({
  apiKey,
  prompt,
  orientation = 'portrait',
  modelId = DEFAULT_IMAGE_MODEL,
  pollMs = 1500,
  timeoutMs = 120000,
  now = () => Date.now(),
  wait = sleep,
} = {}) {
  if (!apiKey) throw new Error('No ElevenLabs API key was sent. Add it on the Keys step.');
  const text = String(prompt || '').trim();
  if (!text) throw new Error('There are no words to draw from. Type what this scene should show.');

  const model = IMAGE_MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_IMAGE_MODEL;

  const started = await fetchRetrying(API + '/flows/image', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: model,
      prompt: text,
      aspect_ratio: aspectFor(orientation),
    }),
  });

  const startedRaw = await started.text();
  if (!started.ok) throw new Error(explainError(started.status, startedRaw));

  const { id } = parseJson(startedRaw);
  if (!id) throw new Error('ElevenLabs accepted the request but did not say what to wait for.');

  // Poll. Generation is seconds, not minutes, but a Pro model under load can
  // sit in the queue - so we wait on a clock rather than on a fixed attempt
  // count, and say plainly how long we waited if it never lands.
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await wait(pollMs);

    const res = await fetchRetrying(API + '/flows/image/' + encodeURIComponent(id), {
      headers: { 'xi-api-key': apiKey },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(explainError(res.status, raw));

    const body = parseJson(raw);

    if (body.status === 'completed') {
      if (!body.content_url) throw new Error('ElevenLabs finished but returned no image to download.');
      return { id, url: body.content_url, mimeType: body.content_mime_type || 'image/png' };
    }
    if (body.status === 'failed') throw new Error(explainFailure(body));
  }

  throw new Error(
    'ElevenLabs was still drawing after ' + Math.round(timeoutMs / 1000) + ' seconds, so the tool '
    + 'gave up. Try a Flash model, which usually answers in a few seconds.',
  );
}

function parseJson(raw) {
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/** The API says why it gave up; say it in words a creator can act on. */
export function explainFailure(body = {}) {
  const detail = String(body.error_message || '').slice(0, 300);
  switch (body.failure_reason) {
    case 'moderated':
      return 'ElevenLabs refused that prompt as unsafe. Reword the search words for this scene.';
    case 'invalid_parameters':
      return 'ElevenLabs rejected the request settings: ' + (detail || 'unknown') + '.';
    case 'charging_failed':
      return 'ElevenLabs could not charge that generation. Check the plan and credit on your account.';
    case 'timeout':
      return 'ElevenLabs timed out drawing that image. Press Generate again, or pick a Flash model.';
    case 'model_error':
    case 'dependency_failed':
      return 'The image model failed on that prompt (' + (detail || 'no detail') + '). Try again.';
    default:
      return 'ElevenLabs could not make that image' + (detail ? ': ' + detail : '.');
  }
}

/**
 * Same job as tts.mjs's explainError, and deliberately not shared with it: the
 * advice differs. A 401 is the same key problem, but a 403 here almost always
 * means the plan, and telling a creator to "shorten the script" would be wrong.
 */
export function explainError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.detail && (j.detail.message || j.detail.status)) || j.message || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }

  if (status === 401) {
    return 'That ElevenLabs API key was rejected. Copy it again from elevenlabs.io and re-paste it.';
  }
  if (status === 403 || status === 402 || /plan|subscription|tier/i.test(detail)) {
    return 'ElevenLabs image generation needs a Pro plan or above on the API. The same key still '
      + 'does the voiceover on any plan — use Pexels and NASA for backdrops instead.';
  }
  if (status === 422) return 'ElevenLabs rejected the prompt or settings: ' + (detail || 'unknown');
  if (status === 429) return 'ElevenLabs rate limit hit. Wait a few seconds and press Generate again.';
  if (status >= 500) return 'ElevenLabs had a server error (' + status + '). Try again in a moment.';
  return 'ElevenLabs image error ' + status + ': ' + (detail || 'unknown');
}
