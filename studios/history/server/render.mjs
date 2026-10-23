// ---------------------------------------------------------------------------
// Renders the video to an .mp4.
//
// The one job that cannot run inside the browser: it needs a headless Chrome
// to draw the frames and ffmpeg to encode them. A nine-minute video is about
// 16,000 frames, so this takes a while - the 720p draft is there to check the
// whole thing quickly before spending the time on 1080p.
// ---------------------------------------------------------------------------

import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { MEDIA_DIR, PUBLIC_DIR, ROOT } from './projects.mjs';

const ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');
export const OUT_DIR = path.join(ROOT, 'out');
const BUNDLE_PUBLIC = path.join(ROOT, '.cache', 'bundle-public');

/** jobId -> { status, progress, stage, url, file, error, startedAt } */
export const jobs = new Map();

let bundlePromise = null;

/** Bundling takes ~20-40s the first time, then it is reused for the session. */
function getBundle(onStage) {
  if (!bundlePromise) {
    onStage('Preparing the video engine (first render only, about a minute)…');
    // The bundle copies its public folder once, and public/projects holds every
    // project's media. So it is given an empty one, and each render copies in
    // just the project it needs (below).
    fs.mkdirSync(BUNDLE_PUBLIC, { recursive: true });
    bundlePromise = bundle({
      entryPoint: ENTRY,
      publicDir: BUNDLE_PUBLIC,
      onProgress: () => undefined,
    }).catch((err) => {
      bundlePromise = null;
      throw err;
    });
  }
  return bundlePromise;
}

/**
 * The bundler takes a one-off copy of public/ when it is built, so a picture
 * drawn or a line re-recorded after that would be missing from the render.
 * Copy this project's media in fresh before every render.
 */
function syncProjectIntoBundle(bundleDir, projectId) {
  const src = path.join(MEDIA_DIR, projectId);
  const dest = path.join(bundleDir, 'public', 'projects', projectId);
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
  for (const folder of ['audio', 'fonts']) {
    const from = path.join(PUBLIC_DIR, folder);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(bundleDir, 'public', folder), { recursive: true, force: true });
  }
}

const slug = (s) => String(s || 'history-video').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'history-video';

export const COMPOSITIONS = ['HistoryVideo', 'HistoryShort'];

export function startRender(projectId, inputProps, quality, composition = 'HistoryVideo') {
  const id = COMPOSITIONS.includes(composition) ? composition : 'HistoryVideo';
  const short = id === 'HistoryShort';
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jobId = 'render-' + projectId + '-' + Date.now().toString(36);
  const fileName = slug(inputProps.title) + (short ? '-short' : '') + '-' + (quality === 'draft' ? 'draft' : short ? '1080x1920' : '1080p') + '-' + stamp + '.mp4';
  const outputLocation = path.join(OUT_DIR, fileName);

  const job = { status: 'running', progress: 0, stage: 'Starting…', url: '', file: '', error: '', startedAt: Date.now(), projectId };
  jobs.set(jobId, job);

  (async () => {
    try {
      console.log('[render] ' + jobId + ' started (' + quality + ', ' + inputProps.scenes.length + ' scenes)');
      job.stage = 'Checking the rendering browser…';
      await ensureBrowser();
      const serveUrl = await getBundle((s) => { job.stage = s; });

      job.stage = 'Collecting pictures and voice clips…';
      syncProjectIntoBundle(serveUrl, projectId);

      job.stage = 'Reading the timeline…';
      const composition = await selectComposition({ serveUrl, id, inputProps });

      job.stage = 'Drawing frames…';
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        audioCodec: 'aac',
        crf: quality === 'draft' ? 26 : 19,
        scale: quality === 'draft' ? 2 / 3 : 1,
        outputLocation,
        inputProps,
        // The heat shimmer and grain are SVG filters; give slow frames room.
        timeoutInMilliseconds: 120000,
        onProgress: ({ progress, renderedFrames, stitchStage }) => {
          job.progress = progress;
          job.stage = stitchStage === 'muxing'
            ? 'Adding the sound…'
            : 'Drawing frames… ' + renderedFrames + ' / ' + composition.durationInFrames;
        },
      });

      job.progress = 1;
      job.stage = 'Done';
      job.status = 'done';
      job.url = '/history/out/' + encodeURIComponent(fileName);
      console.log('[render] ' + jobId + ' done in ' + Math.round((Date.now() - job.startedAt) / 1000) + 's -> ' + fileName);
      job.file = outputLocation;
    } catch (err) {
      job.status = 'error';
      job.error = friendlyRenderError(err);
      job.stage = 'Failed';
      console.error('[render]', err && err.stack ? err.stack : err);
    }
  })();

  return jobId;
}

function friendlyRenderError(err) {
  const msg = (err && err.message) || String(err);
  if (/ENOSPC|no space/i.test(msg)) return 'Your disk is full, so the video could not be written.';
  if (/EBUSY|EPERM|locked/i.test(msg)) return 'The output file is locked. Close any video player that has it open, then try again.';
  if (/Timed out/i.test(msg)) return 'A frame took too long to draw. Try again, or turn off heat haze on a few scenes. (' + msg.slice(0, 160) + ')';
  if (/download|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(msg)) return 'Network problem while preparing the renderer. Check your internet connection and try again.';
  return msg;
}

/** One thumbnail PNG. Synchronous for the caller: it is one frame, not thousands. */
export async function renderThumbnail(projectId, inputProps) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const serveUrl = await getBundle(() => undefined);
  syncProjectIntoBundle(serveUrl, projectId);
  await ensureBrowser();
  const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps });
  const fileName = 'thumbnail-' + projectId + '-' + Date.now().toString(36) + '.png';
  const output = path.join(OUT_DIR, fileName);
  await renderStill({ composition, serveUrl, inputProps, output, imageFormat: 'png' });
  return { url: '/history/out/' + fileName, file: output };
}

/** Finished videos, newest first. */
export function listRenders() {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.mp4') || f.endsWith('.png'))
    .map((f) => {
      const st = fs.statSync(path.join(OUT_DIR, f));
      return { name: f, url: '/history/out/' + encodeURIComponent(f), bytes: st.size, at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
}
