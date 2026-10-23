// ---------------------------------------------------------------------------
// History Studio's part of the helper server.
//
// History Studio was its own app, with its own helper on port 3040. It now
// lives inside Shorts Studio, and this file is mounted on that helper by
// mountHistory() below: every route here answers under /api/history, its
// renders under /history/out, its pictures and clips under /projects. One
// server, one set of keys, one start command.
//
// It exists because a browser tab cannot do four things this app needs:
//   1. call the AI services without exposing keys to the wider internet,
//   2. write pictures and voice clips to disk where the renderer can read them,
//   3. save projects between sessions,
//   4. render the video, which needs Node, headless Chrome and ffmpeg.
//
// It listens on 127.0.0.1 only, so nothing on your network can reach it. API
// keys stay in the browser's storage and are forwarded per request; they are
// never written to disk.
// ---------------------------------------------------------------------------

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { listModels } from './gemini.mjs';
import { CLAUDE_MODELS, listClaudeModels } from './claude.mjs';
import { TONES } from './writer.mjs';
import { chatPrompt, importReply, runTask, TASKS } from './tasks.mjs';
import { NEWS_CATEGORIES, research, trending } from './news.mjs';
import { align, listVoices, measure, quota, speak, VOICE_MODELS } from './tts.mjs';
import { DEFAULT_GOOGLE_IMAGE_MODEL, generateGoogleImage, GOOGLE_IMAGE_MODELS } from './images.mjs';
import {
  checkId, deleteProject, MEDIA_DIR, listProjects, newId, pruneMedia, readMedia, readProject, saveMedia, saveProject,
} from './projects.mjs';
import { jobs, listRenders, OUT_DIR, renderThumbnail, startRender } from './render.mjs';
import { downloadCandidate, PROVIDERS, searchStock } from './stock.mjs';
import { clipSeconds, listVideoModels, startAnimation, VIDEO_MODELS, videoJobs } from './video.mjs';
import { ensureAmbience } from './audio-gen.mjs';
import { PACK_FOLDER, writePack } from './flow.mjs';
import { PUBLIC_DIR } from './projects.mjs';

// Every /api route below, on a router of its own. Its own body limit too:
// pictures and recordings arrive as base64, far past what a script needs.
const app = express.Router();
app.use(express.json({ limit: '80mb' }));

const ok = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[error]', err && err.message ? err.message : err);
    if (!res.headersSent) res.status(400).json({ error: (err && err.message) || 'Something went wrong.' });
  }
};

const need = (value, message) => {
  if (!value) throw new Error(message);
  return value;
};
const geminiKey = (req) => need(req.header('x-gemini-key'), 'No Gemini API key yet. Add it on the Keys step.');
const claudeKey = (req) => need(req.header('x-claude-key'), 'No Claude API key yet. Add it on the Keys step.');
const elevenKey = (req) => need(req.header('x-eleven-key'), 'No ElevenLabs API key yet. Add it on the Keys step, or record the voice yourself.');

const fromBase64 = (b64) => {
  const buf = Buffer.from(String(b64 || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new Error('The file came through empty. Try again.');
  return buf;
};

// --- basics -------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    claudeModels: CLAUDE_MODELS,
    voiceModels: VOICE_MODELS,
    imageModels: GOOGLE_IMAGE_MODELS,
    defaultImageModel: DEFAULT_GOOGLE_IMAGE_MODEL,
    tones: Object.keys(TONES),
  });
});

app.post('/check-keys', ok(async (req, res) => {
  const out = { gemini: 'skipped', claude: 'skipped', elevenlabs: 'skipped', pexels: 'skipped', pixabay: 'skipped' };
  const g = req.header('x-gemini-key');
  const c = req.header('x-claude-key');
  const e = req.header('x-eleven-key');
  const px = req.header('x-pexels-key');
  const pb = req.header('x-pixabay-key');
  // A stock key is "ok" when a real search with it comes back without an error.
  const stockCheck = async (provider, keys) => {
    const r = await searchStock({ query: 'mountain', providers: [provider], keys, perProvider: 3 });
    if (!r.results.length) throw new Error(r.notes[0] || 'no results');
  };
  const run = async (name, fn) => {
    try {
      await fn();
      out[name] = 'ok';
    } catch (err) {
      out[name] = (err && err.message) || 'failed';
    }
  };
  await Promise.all([
    g ? run('gemini', () => listModels(g)) : null,
    c ? run('claude', () => listClaudeModels(c)) : null,
    e ? run('elevenlabs', () => listVoices(e)) : null,
    px ? run('pexels', () => stockCheck('pexels', { pexels: px })) : null,
    pb ? run('pixabay', () => stockCheck('pixabay', { pixabay: pb })) : null,
  ]);
  res.json(out);
}));

app.get('/gemini/models', ok(async (req, res) => res.json({ models: await listModels(geminiKey(req)) })));
app.get('/claude/models', ok(async (req, res) => res.json({ models: await listClaudeModels(claudeKey(req)) })));

// --- writing ----------------------------------------------------------------------

const providerKey = (req, provider) => (provider === 'claude' ? claudeKey(req) : geminiKey(req));

// Every AI job, through a key...
const AI_ROUTES = { news: 'news', write: 'story', direct: 'direct', callouts: 'callouts', motion: 'motion', music: 'music', thumbnail: 'thumbnail', elements: 'elements', storyboard: 'storyboard', voice: 'voice' };
for (const [route, task] of Object.entries(AI_ROUTES)) {
  app.post('/story/' + route, ok(async (req, res) => {
    const { provider = 'gemini', model, ...options } = req.body || {};
    res.json(await runTask(provider, providerKey(req, provider), model, TASKS[task](options)));
  }));
}

// News: live research (Google Search through Gemini, or Claude's web search).
app.post('/news/research', ok(async (req, res) => {
  const { provider = 'gemini', model, ...options } = req.body || {};
  res.json(await research(provider, providerKey(req, provider), model, options));
}));
app.post('/news/trending', ok(async (req, res) => {
  const { provider = 'gemini', model, ...options } = req.body || {};
  res.json(await trending(provider, providerKey(req, provider), model, options));
}));
app.get('/news/categories', (_req, res) => res.json({ categories: NEWS_CATEGORIES }));

// ...or by hand, through any chatbot, when the credits run out: the same job as
// one message to paste, and the reply read back through the same checks.
const taskFor = (name, options) => {
  if (!Object.prototype.hasOwnProperty.call(TASKS, name)) throw new Error('Unknown job: ' + name);
  return TASKS[name](options || {});
};
app.post('/chat/prompt/:task', ok(async (req, res) => {
  const task = taskFor(req.params.task, req.body);
  res.json({ prompt: chatPrompt(task), needsPicture: Boolean(task.needsPicture) });
}));
app.post('/chat/import/:task', ok(async (req, res) => {
  const { reply, ...options } = req.body || {};
  res.json(importReply(taskFor(req.params.task, options), reply));
}));

// --- voice ----------------------------------------------------------------------------

app.get('/voices', ok(async (req, res) => res.json({ voices: await listVoices(elevenKey(req)) })));
app.get('/eleven/quota', ok(async (req, res) => res.json({ quota: await quota(elevenKey(req)) })));

app.post('/voice/speak', ok(async (req, res) => {
  const { projectId, sceneId, text, previous, next, settings } = req.body || {};
  checkId(projectId);
  const result = await speak(elevenKey(req), text, settings || {}, { previous, next });
  if (!result) throw new Error('This scene has no narration to speak.');
  const src = saveMedia(projectId, 'audio', sceneId, '.mp3', result.buffer);
  res.json({ src, duration: result.duration, words: result.words, timed: result.words.length > 0 });
}));

/** A clip recorded on the mic, as WAV. Timed by ElevenLabs if there is a key, else by the browser. */
app.post('/voice/upload', ok(async (req, res) => {
  const { projectId, sceneId, text, audioBase64, mimeType = 'audio/wav' } = req.body || {};
  checkId(projectId);
  const buffer = fromBase64(audioBase64);
  const ext = /mpeg|mp3/.test(mimeType) ? '.mp3' : /webm/.test(mimeType) ? '.webm' : /ogg/.test(mimeType) ? '.ogg' : '.wav';
  const src = saveMedia(projectId, 'audio', sceneId, ext, buffer);
  const duration = await measure(buffer, mimeType, 0);

  let words = [];
  let alignError = '';
  const key = req.header('x-eleven-key');
  if (key && String(text || '').trim()) {
    try {
      words = await align(key, buffer, 'take' + ext, mimeType, text);
    } catch (err) {
      alignError = (err && err.message) || 'alignment failed';
      console.log('[align] ' + alignError);
    }
  }
  res.json({ src, duration, words, timed: words.length > 0, alignError });
}));

// --- pictures ---------------------------------------------------------------------------

app.post('/image/draw', ok(async (req, res) => {
  const { projectId, sceneId, prompt, model, referenceSrc, aspect } = req.body || {};
  checkId(projectId);
  let reference = null;
  const refBytes = referenceSrc ? readMedia(referenceSrc) : null;
  if (refBytes) reference = { base64: refBytes.toString('base64'), mimeType: /\.png$/i.test(referenceSrc) ? 'image/png' : 'image/jpeg' };

  const image = await generateGoogleImage({
    apiKey: geminiKey(req),
    prompt,
    orientation: 'landscape',
    modelId: model || DEFAULT_GOOGLE_IMAGE_MODEL,
    reference,
    aspectRatio: aspect === '1:1' ? '1:1' : '',
    matchLine:
      'The attached image is an earlier scene from the same video. Match its art style, line work, palette and '
      + 'lighting exactly, and draw any recurring characters so they look like the same people. Draw the NEW scene '
      + 'described above - a different moment, not a copy of the reference.',
  });
  const ext = /png/.test(image.mimeType) ? '.png' : '.jpg';
  const src = saveMedia(projectId, 'images', sceneId, ext, Buffer.from(image.base64, 'base64'));
  res.json({ src, referenced: image.referenced });
}));

app.post('/image/upload', ok(async (req, res) => {
  const { projectId, sceneId, fileName = '', dataBase64 } = req.body || {};
  checkId(projectId);
  const ext = path.extname(String(fileName)).toLowerCase() || '.jpg';
  res.json({ src: saveMedia(projectId, 'images', sceneId, ext, fromBase64(dataBase64)) });
}));

app.post('/music/upload', ok(async (req, res) => {
  const { projectId, fileName = '', dataBase64 } = req.body || {};
  checkId(projectId);
  const ext = path.extname(String(fileName)).toLowerCase();
  res.json({ src: saveMedia(projectId, 'music', 'music', ext, fromBase64(dataBase64)), name: path.basename(String(fileName)) });
}));

// --- Free stock photos and videos ------------------------------------------------------

const stockKeys = (req) => ({ pexels: req.header('x-pexels-key') || '', pixabay: req.header('x-pixabay-key') || '' });

app.get('/stock/providers', (_req, res) => res.json({ providers: PROVIDERS }));

app.post('/stock/search', ok(async (req, res) => {
  const { query, type, providers } = req.body || {};
  res.json(await searchStock({ query, type: type === 'video' ? 'video' : 'photo', providers, keys: stockKeys(req) }));
}));

/** Download a picked photo or clip into the project, and hand back where it went plus its credit. */
app.post('/stock/use', ok(async (req, res) => {
  const { projectId, shotId, candidate } = req.body || {};
  checkId(projectId);
  if (!candidate || !candidate.full || !candidate.credit) throw new Error('Nothing was picked.');
  const file = await downloadCandidate(candidate);
  const src = saveMedia(projectId, file.type === 'video' ? 'video' : 'images', shotId, file.ext, file.buffer);
  const c = candidate.credit;
  const credit = {
    source: String(c.source || '').slice(0, 80), author: String(c.author || '').slice(0, 120), authorUrl: String(c.authorUrl || '').slice(0, 500),
    license: String(c.license || '').slice(0, 60), licenseUrl: String(c.licenseUrl || '').slice(0, 500), pageUrl: String(c.pageUrl || '').slice(0, 500),
    required: Boolean(c.required),
  };
  res.json({ src, type: file.type, seconds: file.type === 'video' ? await clipSeconds(src, file.buffer, Number(candidate.duration) || 0) : 0, credit });
}));

// --- AI-animated clips (Veo) --------------------------------------------------------

app.get('/video/models', ok(async (req, res) => {
  const key = req.header('x-gemini-key');
  res.json({ models: key ? await listVideoModels(key) : VIDEO_MODELS });
}));

app.post('/video/animate', ok(async (req, res) => {
  const { projectId, shotId, imageSrc, prompt, model, seconds } = req.body || {};
  checkId(projectId);
  const bytes = readMedia(imageSrc);
  if (!bytes) throw new Error('That picture is not on disk any more. Draw or upload it again.');
  const jobId = startAnimation({
    apiKey: geminiKey(req),
    model: String(model || VIDEO_MODELS[1].id),
    prompt: String(prompt || '').slice(0, 2000),
    image: bytes.toString('base64'),
    mimeType: /\.png$/i.test(imageSrc) ? 'image/png' : 'image/jpeg',
    seconds: Number(seconds) || 6,
    save: (buffer) => saveMedia(projectId, 'video', shotId, '.mp4', buffer),
  });
  res.json({ jobId });
}));

/** A clip made elsewhere - Google Flow, or anything else - for one shot. */
app.post('/video/upload', ok(async (req, res) => {
  const { projectId, shotId, fileName = '', dataBase64 } = req.body || {};
  checkId(projectId);
  const ext = path.extname(String(fileName)).toLowerCase() || '.mp4';
  if (ext !== '.mp4' && ext !== '.webm') throw new Error('Use an MP4 clip (Flow downloads MP4).');
  const buffer = fromBase64(dataBase64);
  const src = saveMedia(projectId, 'video', shotId, ext, buffer);
  res.json({ src, seconds: await clipSeconds(src, buffer, 0) });
}));

app.post('/flow/pack', ok(async (req, res) => {
  const { projectId, ...pack } = req.body || {};
  checkId(projectId);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  res.json(writePack(OUT_DIR, pack));
}));

app.get('/video/:id', (req, res) => {
  const job = videoJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That animation is not running any more (the helper was restarted).' });
  res.json(job);
});

// --- projects --------------------------------------------------------------------------------

app.get('/projects', (_req, res) => res.json({ projects: listProjects() }));
app.post('/projects/new-id', (_req, res) => res.json({ id: newId() }));
app.get('/projects/:id', ok(async (req, res) => res.json({ project: readProject(req.params.id) })));
app.put('/projects/:id', ok(async (req, res) => {
  const project = req.body && req.body.project;
  if (!project || project.id !== req.params.id) throw new Error('Project id mismatch.');
  res.json({ updatedAt: saveProject(project) });
}));
app.delete('/projects/:id', ok(async (req, res) => {
  deleteProject(req.params.id);
  res.json({ ok: true });
}));
app.post('/projects/:id/tidy', ok(async (req, res) => {
  res.json({ removed: pruneMedia(readProject(req.params.id)) });
}));

// --- render -------------------------------------------------------------------------------------

app.post('/render', ok(async (req, res) => {
  const { projectId, props, quality, composition } = req.body || {};
  checkId(projectId);
  if (!props || !Array.isArray(props.scenes) || !props.scenes.length) throw new Error('There is nothing to render yet.');
  res.json({ jobId: startRender(projectId, props, quality === 'draft' ? 'draft' : 'full', composition) });
}));

app.post('/thumbnail', ok(async (req, res) => {
  const { projectId, props } = req.body || {};
  checkId(projectId);
  if (!props || !props.image) throw new Error('Pick a picture for the thumbnail first.');
  res.json(await renderThumbnail(projectId, props));
}));

app.get('/render/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That render is not running any more (the helper was restarted).' });
  res.json(job);
});

app.get('/renders', (_req, res) => res.json({ renders: listRenders() }));

/** Renders still going, so a reloaded page can pick its progress bar back up. */
app.get('/render-jobs', (_req, res) => {
  res.json({ jobs: [...jobs.entries()].map(([id, j]) => ({ id, ...j })).filter((j) => j.status === 'running') });
});

/** Show the finished videos in File Explorer. */
app.post('/open-output', (req, res) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Optionally a pack folder inside out/ - only one of ours, never an arbitrary path.
  const sub = String((req.body && req.body.folder) || '');
  const target = PACK_FOLDER.test(sub) && fs.existsSync(path.join(OUT_DIR, sub)) ? path.join(OUT_DIR, sub) : OUT_DIR;
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref();
  res.json({ ok: true });
});

/**
 * Put History Studio on a helper server. Called before that server's own body
 * parser, so a large upload reaches the 80 MB limit above instead of the
 * smaller one a quiz script needs.
 */
export function mountHistory(server) {
  // Finished videos, under a path of their own: /out is Shorts Studio's.
  server.use('/history/out', express.static(OUT_DIR, { maxAge: 0 }));
  // Pictures and voice clips, for the live preview. Served from here rather than
  // by Vite, which only knows about public files that existed when it started.
  // File names are unique per take, so they can be cached hard.
  server.use('/projects', express.static(MEDIA_DIR, { maxAge: '7d', fallthrough: false }));
  server.use('/api/history', app);

  // Wind, fire and rain loops: synthesised once, on the first start.
  try {
    const made = ensureAmbience(PUBLIC_DIR);
    if (made.length) console.log('  Made ambience sounds: ' + made.join(', '));
  } catch (err) {
    console.log('  Could not make the ambience sounds: ' + (err && err.message));
  }
}
