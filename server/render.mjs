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
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

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
 *
 * Not only the audio: everything that can change while the helper is running.
 *   generated - voiceovers, backdrops, doodle drawings, thumbnail art
 *   mascot    - the model sheet; redesigning it mid-session would otherwise
 *               leave the carousel and the thumbnail drawing the old engineer
 *               until the helper was restarted
 *   fonts     - small, and the Doodle look is wrong without them
 */
const LIVE_FOLDERS = ['generated', 'mascot', 'fonts'];

function syncAudioIntoBundle(bundleDir) {
  for (const folder of LIVE_FOLDERS) {
    const src = path.join(PUBLIC_DIR, folder);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(bundleDir, 'public', folder);
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
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

/**
 * Render one thumbnail PNG.
 *
 * Shares the video's bundle, so after the first render of a session this costs
 * a couple of seconds rather than the minute a cold bundle takes. Synchronous
 * from the caller's point of view - it is one frame, not nine thousand, so
 * there is no job to poll.
 */
export async function renderThumbnail(inputProps) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fileName = 'thumbnail-' + Date.now() + '.png';
  const output = path.join(OUT_DIR, fileName);

  const serveUrl = await getBundle(() => undefined);
  syncAudioIntoBundle(serveUrl);
  await ensureBrowser();

  const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps });
  await renderStill({ composition, serveUrl, inputProps, output, imageFormat: 'png' });

  return { fileName, url: '/out/' + fileName, bytes: fs.statSync(output).size };
}

/** A carousel folder name this app made - the only shape accepted back from the browser. */
export const CAROUSEL_FOLDER = /^carousel-[0-9]{13}$/;

/**
 * Every slide of the square carousel post, into its own folder under out/.
 *
 * `slides` is the plan from src/lib/carousel.ts. Each slide is one still of
 * the same composition, taken at its last frame so the entrance animations it
 * shares with the video have finished. Sequential: the slides share one
 * browser, and a handful of stills is a few seconds either way.
 */
export async function renderCarousel({ content, design, channelName, slides, mascot = '' }, onProgress = () => undefined) {
  const folder = 'carousel-' + Date.now();
  const dir = path.join(OUT_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });

  const serveUrl = await getBundle(() => undefined);
  syncAudioIntoBundle(serveUrl);
  await ensureBrowser();

  const files = [];
  for (let index = 0; index < slides.length; index++) {
    onProgress(index, slides.length);
    const inputProps = {
      content, design, channelName: channelName || '', slide: slides[index], index, total: slides.length, mascot,
    };
    const composition = await selectComposition({ serveUrl, id: 'CarouselSlide', inputProps });
    const fileName = 'slide-' + String(index + 1).padStart(2, '0') + '.png';
    await renderStill({
      composition, serveUrl, inputProps, imageFormat: 'png',
      output: path.join(dir, fileName),
      frame: composition.durationInFrames - 1,
    });
    files.push({ fileName, url: '/out/' + folder + '/' + fileName, kind: slides[index].kind });
  }
  return { folder, dir, files };
}

/** The PNGs of a carousel made earlier, in slide order. [] when the folder is gone or not ours. */
export function readCarousel(folder) {
  if (!CAROUSEL_FOLDER.test(String(folder || ''))) return [];
  const dir = path.join(OUT_DIR, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^slide-\d{2}\.png$/.test(f))
    .sort()
    .map((name) => ({ name, data: fs.readFileSync(path.join(dir, name)) }));
}

export const paths = { ROOT, OUT_DIR, PUBLIC_DIR };
