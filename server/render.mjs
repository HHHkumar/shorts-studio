// ---------------------------------------------------------------------------
// Renders the Remotion composition to a real .mp4 file.
//
// This is the one job that cannot run inside the browser: it needs a headless
// Chrome to draw 1080x1920 frames and ffmpeg to encode them. Everything else
// the app does happens in your browser tab.
// ---------------------------------------------------------------------------

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';

// fileURLToPath is required here: the project path may contain spaces.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'out');

/** jobId -> { status, progress, stage, message, url, error } */
export const jobs = new Map();

let bundlePromise = null;

/** Bundling takes ~20-40s the first time, then it is cached for the session. */
function getBundle(onStage) {
  if (!bundlePromise) {
    onStage('Preparing the video engine (first render only, this takes a minute)…');
    bundlePromise = bundle({
      entryPoint: ENTRY,
      publicDir: PUBLIC_DIR,
      onProgress: () => undefined,
    }).catch((err) => {
      bundlePromise = null; // let the next attempt retry from scratch
      throw err;
    });
  }
  return bundlePromise;
}

/**
 * The bundler takes a one-off *copy* of public/ when it builds. Because we cache
 * the bundle between renders, a voiceover recorded after that copy would be
 * missing and the video would come out silent. Re-syncing the audio folder into
 * the bundle before every render keeps the cache fast and the sound correct.
 */
function syncAudioIntoBundle(bundleDir) {
  const src = path.join(PUBLIC_DIR, 'generated');
  if (!fs.existsSync(src)) return;
  const dest = path.join(bundleDir, 'public', 'generated');
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

export function startRender(jobId, inputProps, quality) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fileName = jobId + '.mp4';
  const outputLocation = path.join(OUT_DIR, fileName);

  const job = {
    status: 'running',
    progress: 0,
    stage: 'Starting…',
    url: '',
    error: '',
  };
  jobs.set(jobId, job);

  const setStage = (stage) => {
    job.stage = stage;
  };

  (async () => {
    try {
      setStage('Checking the rendering browser…');
      await ensureBrowser();

      const serveUrl = await getBundle(setStage);

      setStage('Collecting the voiceover clips…');
      syncAudioIntoBundle(serveUrl);

      setStage('Reading the timeline…');
      const composition = await selectComposition({
        serveUrl,
        id: 'QuizVideo',
        inputProps,
      });

      setStage('Drawing frames…');
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        audioCodec: 'aac',
        crf: quality === 'high' ? 18 : quality === 'low' ? 28 : 23,
        outputLocation,
        inputProps,
        onProgress: ({ progress, renderedFrames, stitchStage }) => {
          job.progress = progress;
          job.stage =
            stitchStage === 'muxing'
              ? 'Adding the sound track…'
              : 'Drawing frames… ' + renderedFrames + ' / ' + composition.durationInFrames;
        },
      });

      job.progress = 1;
      job.stage = 'Done';
      job.status = 'done';
      job.url = '/out/' + fileName;
    } catch (err) {
      job.status = 'error';
      job.error = friendlyRenderError(err);
      job.stage = 'Failed';
    }
  })();

  return jobId;
}

function friendlyRenderError(err) {
  const msg = (err && err.message) || String(err);
  if (/ENOSPC|no space/i.test(msg)) return 'Your disk is full, so the video could not be written.';
  if (/EBUSY|EPERM|locked/i.test(msg)) {
    return 'The output file is locked. Close any video player that has the last render open, then try again.';
  }
  if (/Timed out/i.test(msg)) {
    return 'A frame took too long to draw. Try a shorter video or the Simple layout. (' + msg.slice(0, 160) + ')';
  }
  if (/download|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(msg)) {
    return 'Network problem while preparing the renderer. Check your internet connection and try again.';
  }
  return msg;
}

export const paths = { ROOT, OUT_DIR, PUBLIC_DIR };
