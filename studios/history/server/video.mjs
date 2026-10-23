// ---------------------------------------------------------------------------
// Animating a picture with Google Veo, through the Gemini key.
//
//   POST models/<veo>:predictLongRunning   { instances:[{prompt, image}], parameters }
//   GET  <operation name>                  until done
//   -> response.generateVideoResponse.generatedSamples[0].video.uri
//   GET  that uri (with the key)           the mp4
//
// Slow (a minute or three) and billed per second of video, so it runs as a job
// the page polls, and is only ever started by an explicit press.
// ---------------------------------------------------------------------------

import path from 'node:path';
import { getVideoMetadata } from '@remotion/renderer';
import { fetchRetrying } from './retry.mjs';
import { measure } from './tts.mjs';
import { PUBLIC_DIR } from './projects.mjs';

/**
 * A clip's true length. Read with Remotion's own video reader - the engine that
 * will play it in the render - because the audio-metadata reader misreads
 * trimmed MP4s (a 3-second clip came back as 8.7). Falls back to that reader.
 */
export async function clipSeconds(src, buffer, fallback = 0) {
  try {
    const meta = await getVideoMetadata(path.join(PUBLIC_DIR, ...String(src).split('/')));
    if (meta && meta.durationInSeconds > 0) return meta.durationInSeconds;
  } catch {
    // not readable that way; try the other
  }
  return measure(buffer, 'video/mp4', fallback);
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Shown before a key has been asked what it can use. Cheapest first. */
export const VIDEO_MODELS = [
  { id: 'veo-3.1-lite-generate-preview', label: 'Veo 3.1 Lite — cheapest' },
  { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast — good and quick (recommended)' },
  { id: 'veo-3.1-generate-preview', label: 'Veo 3.1 — best quality, most expensive' },
];

/** The Veo models this key can actually use. */
export async function listVideoModels(apiKey) {
  const res = await fetchRetrying(BASE + '/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) return VIDEO_MODELS;
  const data = await res.json();
  const found = (data.models || [])
    .filter((m) => /veo/i.test(m.name || '') && (m.supportedGenerationMethods || []).includes('predictLongRunning'))
    .map((m) => String(m.name).replace(/^models\//, ''))
    .filter((id) => !/veo-2/i.test(id));
  if (!found.length) return VIDEO_MODELS;
  const known = new Map(VIDEO_MODELS.map((m) => [m.id, m.label]));
  const rank = (id) => (/lite/.test(id) ? 0 : /fast/.test(id) ? 1 : 2) + (/3\.1/.test(id) ? 0 : 10);
  return found.sort((a, b) => rank(a) - rank(b)).map((id) => ({ id, label: known.get(id) || id }));
}

/** jobId -> { status, stage, src, seconds, error } */
export const videoJobs = new Map();

/**
 * Start a clip. `save(buffer)` stores the mp4 and returns its public path.
 * Returns the job id at once; the work carries on in the background.
 */
export function startAnimation({ apiKey, model, prompt, image, mimeType, seconds, save }) {
  const jobId = 'veo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const job = { status: 'running', stage: 'Sending the picture to Veo…', src: '', seconds: 0, error: '' };
  videoJobs.set(jobId, job);

  (async () => {
    try {
      const op = await submit({ apiKey, model, prompt, image, mimeType, seconds });
      const started = Date.now();
      let done = null;
      while (!done) {
        await new Promise((r) => setTimeout(r, 8000));
        const elapsed = Math.round((Date.now() - started) / 1000);
        job.stage = 'Veo is animating… ' + elapsed + 's';
        if (elapsed > 600) throw new Error('Veo took more than 10 minutes. Try again, or a faster model.');
        const res = await fetchRetrying(BASE + '/' + op, { headers: { 'x-goog-api-key': apiKey } });
        const raw = await res.text();
        if (!res.ok) throw new Error(explain(res.status, raw));
        const data = JSON.parse(raw);
        if (data.error) throw new Error('Veo failed: ' + (data.error.message || JSON.stringify(data.error).slice(0, 200)));
        if (data.done) done = data;
      }
      const uri = findVideoUri(done);
      if (!uri) {
        const filtered = JSON.stringify(done).match(/raiMediaFilteredReasons[^\]]*\]/);
        throw new Error(filtered
          ? 'Veo would not animate this picture (safety filter). Try a different motion description or picture. ' + filtered[0].slice(0, 200)
          : 'Veo finished but sent no video back.');
      }
      job.stage = 'Downloading the clip…';
      const file = await fetchRetrying(uri, { headers: { 'x-goog-api-key': apiKey } }, { timeoutMs: 180000 });
      if (!file.ok) throw new Error('Could not download the clip from Google (' + file.status + ').');
      const buffer = Buffer.from(await file.arrayBuffer());
      job.src = save(buffer);
      job.seconds = await clipSeconds(job.src, buffer, seconds);
      job.status = 'done';
      job.stage = 'Done';
    } catch (err) {
      job.status = 'error';
      job.error = (err && err.message) || String(err);
      console.log('[veo] ' + job.error);
    }
  })();

  return jobId;
}

async function submit({ apiKey, model, prompt, image, mimeType, seconds }) {
  const body = (imageField) => JSON.stringify({
    instances: [{ prompt, image: imageField }],
    parameters: {
      aspectRatio: '16:9',
      resolution: '720p',
      durationSeconds: String([4, 6, 8].includes(Number(seconds)) ? Number(seconds) : 6),
      personGeneration: 'allow_adult',
    },
  });
  const send = (imageField) => fetchRetrying(BASE + '/models/' + encodeURIComponent(model) + ':predictLongRunning', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: body(imageField),
  }, { attempts: 2 });

  // The documented shape first; the older Vertex-style field if this endpoint wants that instead.
  let res = await send({ inlineData: { mimeType, data: image } });
  let raw = await res.text();
  if (res.status === 400 && /inlineData|image/i.test(raw)) {
    res = await send({ bytesBase64Encoded: image, mimeType });
    raw = await res.text();
  }
  if (!res.ok) throw new Error(explain(res.status, raw));
  const data = JSON.parse(raw);
  if (!data.name) throw new Error('Veo did not start a job. Reply was: ' + raw.slice(0, 200));
  return data.name;
}

/** The documented path, then anything that looks like a video link. */
export function findVideoUri(op) {
  const samples = op && op.response && op.response.generateVideoResponse && op.response.generateVideoResponse.generatedSamples;
  if (samples && samples[0] && samples[0].video && samples[0].video.uri) return samples[0].video.uri;
  const text = JSON.stringify(op || {});
  const m = text.match(/"uri"\s*:\s*"(https:[^"]+)"/);
  return m ? m[1] : '';
}

function explain(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    const e = Array.isArray(j) ? (j[0] || {}).error : j.error;
    detail = (e && e.message) || '';
  } catch {
    detail = String(raw).slice(0, 200);
  }
  if (status === 429 || /quota|billing|RESOURCE_EXHAUSTED/i.test(detail)) {
    return 'Google would not make the clip: Veo needs billing on the Gemini key, and may be rate-limited. (' + detail.slice(0, 160) + ')';
  }
  if (status === 404) return 'That Veo model is not available to this key. Pick another in the list.';
  if (status === 403) return 'The key is not allowed to use Veo (403). Check billing and the Generative Language API.';
  return 'Veo error ' + status + ': ' + (detail || 'unknown');
}
