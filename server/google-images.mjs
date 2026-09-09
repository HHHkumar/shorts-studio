// ---------------------------------------------------------------------------
// Image generation through the Gemini key.
//
// The same key that writes the script draws the backdrop, which is the whole
// reason this exists: the ElevenLabs path needs a Pro plan, and this one needs
// only billing enabled on a key the creator already has.
//
// Simpler than ElevenLabs in every way that matters. One call, no job id, no
// polling, no signed URL racing an expiry - the image comes back as base64 in
// the response body. The caller writes it straight to disk.
//
//   POST /v1beta/interactions
//   { model, input: [{type:'text', text}], response_format: {...} }
//   -> interaction.output_image.data   (base64)
//
// It also takes REFERENCE IMAGES in the same `input` array, which is what makes
// a whole video look like one set rather than twelve unrelated pictures: every
// scene after the first is drawn against the first one.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Cheapest first. Every one of these needs billing enabled - Google marks image
 * generation "Free Tier: Not available" on every model it has, which is the
 * single fact most likely to send somebody round in circles.
 */
export const GOOGLE_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Flash Lite — cheapest, ~3c an image (recommended)' },
  { id: 'gemini-3.1-flash-image', label: 'Flash — better, and best at matching a reference' },
  { id: 'gemini-2.5-flash-image', label: 'Flash 2.5 — the older model, ~4c' },
  { id: 'gemini-3-pro-image', label: 'Pro — best quality, ~13c an image' },
];

export const DEFAULT_GOOGLE_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

/** Lite is documented as 1K only, so 1K is what everything asks for. */
const IMAGE_SIZE = '1K';

/** The frame we are actually rendering, in the shape this API names it. */
export const aspectFor = (orientation) => (orientation === 'landscape' ? '16:9' : '9:16');

/**
 * Draw one image.
 *
 * `reference` is an optional { base64, mimeType } of an image already drawn for
 * this video. When present the model is asked to match its look, which is the
 * difference between a set and a scrapbook.
 *
 * Returns { base64, mimeType }.
 */
export async function generateGoogleImage({
  apiKey,
  prompt,
  orientation = 'portrait',
  modelId = DEFAULT_GOOGLE_IMAGE_MODEL,
  reference = null,
} = {}) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const text = String(prompt || '').trim();
  if (!text) throw new Error('There are no words to draw from. Type what this scene should show.');

  const model = GOOGLE_IMAGE_MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_GOOGLE_IMAGE_MODEL;

  const build = (withReference) => {
    const input = [{ type: 'text', text: withReference ? text + '\n\n' + MATCH_LINE : text }];
    if (withReference && reference && reference.base64) {
      input.push({
        type: 'image',
        mime_type: reference.mimeType || 'image/jpeg',
        data: reference.base64,
      });
    }
    return JSON.stringify({
      model,
      input,
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
        aspect_ratio: aspectFor(orientation),
        image_size: IMAGE_SIZE,
      },
    });
  };

  const send = (withReference) => fetchRetrying(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: build(withReference),
  }, { timeoutMs: 120000 });

  const wanted = Boolean(reference && reference.base64);
  let res = await send(wanted);
  let raw = await res.text();

  // Not every image model takes a reference. Losing the whole picture over the
  // style match would be a poor trade, so it is dropped and tried again - the
  // same shape as the thinking-config retry in gemini.mjs.
  if (!res.ok && wanted && res.status >= 400 && res.status < 500) {
    res = await send(false);
    raw = await res.text();
  }

  if (!res.ok) throw new Error(explainError(res.status, raw));

  const payload = parseJson(raw);
  const out = payload.interaction && payload.interaction.output_image;
  const base64 = (out && out.data) || firstImageInSteps(payload);
  if (!base64) throw new Error('Gemini answered but sent no image back. Try again.');

  return { base64, mimeType: (out && out.mime_type) || 'image/jpeg' };
}

/** Asked alongside a reference image. Kept short: a long brief fights the picture. */
const MATCH_LINE =
  'Match the visual style, palette and lighting of the reference image exactly. '
  + 'Same treatment, different subject.';

/** The convenience field is not guaranteed; the steps always carry it. */
function firstImageInSteps(payload) {
  const steps = (payload.interaction && payload.interaction.steps) || [];
  for (const step of steps) {
    for (const part of step.content || []) {
      if (part && part.type === 'image' && part.data) return part.data;
    }
  }
  return '';
}

function parseJson(raw) {
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * The message a creator can act on.
 *
 * The billing case is first and worded plainly, because it is by far the most
 * likely: image generation is not on Google's free tier for any model, and the
 * error Google returns for it does not say the word "billing" anywhere near
 * clearly enough.
 */
export function explainError(status, raw) {
  let detail = '';
  let violations = '';
  try {
    const parsed = JSON.parse(raw);
    // This endpoint wraps its errors in an ARRAY - [{ error: {...} }] - where
    // the rest of the Gemini API returns a bare object. Confirmed against the
    // live API, not assumed: reading it as an object gave an empty message and
    // an error that said only "unknown".
    const j = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
    detail = (j.error && j.error.message) || '';
    for (const d of (j.error && j.error.details) || []) {
      for (const v of d.fieldViolations || []) violations += (v.description || '') + ' ';
      if (d.reason) violations += d.reason + ' ';
    }
  } catch {
    detail = String(raw).slice(0, 300);
  }
  const all = detail + ' ' + violations;

  if (status === 429 || /quota|billing|free tier|not available|RESOURCE_EXHAUSTED|PERMISSION/i.test(all)) {
    return 'Google would not draw that image. Image generation is NOT on the Gemini free tier for '
      + 'any model, so the key needs billing enabled on its project — the same key writes scripts '
      + 'for free either way. If billing is already on, you may just have hit a rate limit: wait a '
      + 'moment and press Draw again.'
      + (detail ? ' (' + detail.slice(0, 160) + ')' : '');
  }
  if (status === 400 && /API key not valid/i.test(all)) {
    return 'That Gemini API key was rejected. Check for stray spaces and paste it again.';
  }
  if (status === 400) {
    // Both, not either. Google's message is the vague half and the violation is
    // the useful one - keeping only the message is what made the last one of
    // these take an afternoon.
    const both = [detail, violations.trim()].filter(Boolean).join(' — ');
    return 'Gemini rejected the image request: ' + (both || 'unknown');
  }
  if (status === 403) {
    return 'Gemini refused the key for image generation (403). Make sure billing is enabled and the '
      + 'Generative Language API is turned on for that project.';
  }
  if (status >= 500) return 'Google had a server error (' + status + ') drawing that image. Try again.';
  return 'Gemini image error ' + status + ': ' + (detail || 'unknown');
}
