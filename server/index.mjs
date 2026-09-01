// ---------------------------------------------------------------------------
// The small local helper server.
//
// It exists for three reasons only:
//   1. it keeps your API keys off the public internet (nothing leaves your PC
//      except the calls to Google and ElevenLabs themselves),
//   2. it writes the voiceover mp3 files to disk so Remotion can read them,
//   3. it runs the actual video render, which needs Node, not a browser.
//
// It listens on 127.0.0.1 only, so nothing on your network can reach it.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { generateContent, listModels } from './gemini.mjs';
import { generateStoryboard } from './explainer.mjs';
import { listVoices, speak, VOICE_MODELS } from './tts.mjs';
import { jobs as renderJobs, startRender, paths } from './render.mjs';
import { ensureAudioAssets, MUSIC_MOODS } from './audio-gen.mjs';
import { validateContent, DEEPSEEK_MODELS } from './deepseek.mjs';
import { findTrending } from './trends.mjs';
import { searchStock, downloadStock } from './stock.mjs';
import { generateSeo } from './seo.mjs';

const PORT = Number(process.env.PORT || 3030);
const GENERATED_DIR = path.join(paths.PUBLIC_DIR, 'generated');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Finished videos are served from here.
app.use('/out', express.static(paths.OUT_DIR, { maxAge: 0 }));

const ok = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[error]', err && err.message ? err.message : err);
    if (!res.headersSent) {
      res.status(400).json({ error: (err && err.message) || 'Something went wrong.' });
    }
  }
};

// --- basic info -------------------------------------------------------------

// Only used before a key is entered; the dropdown is replaced by the live list
// from /api/gemini/models as soon as we can ask Google what the key supports.
const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiModels: GEMINI_MODELS,
    voiceModels: VOICE_MODELS,
    musicMoods: MUSIC_MOODS,
    deepseekModels: DEEPSEEK_MODELS,
  });
});

// --- your own music track ---------------------------------------------------

const MUSIC_DIR = path.join(GENERATED_DIR, 'music');
const AUDIO_TYPES = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];

app.post('/api/music', express.raw({ type: '*/*', limit: '40mb' }), ok(async (req, res) => {
  const raw = String(req.header('x-filename') || 'track.mp3');
  const ext = path.extname(raw).toLowerCase();
  if (!AUDIO_TYPES.includes(ext)) {
    throw new Error('That file type is not supported. Use an MP3, WAV, M4A, AAC or OGG file.');
  }
  if (!req.body || !req.body.length) throw new Error('The file came through empty. Try choosing it again.');

  // Never trust the name from the browser for a path.
  const safe = path.basename(raw, ext).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'track';
  const fileName = safe + '-' + Date.now().toString(36) + ext;

  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(MUSIC_DIR, fileName), req.body);

  res.json({ src: 'generated/music/' + fileName, name: raw, bytes: req.body.length });
}));

// The real list, straight from the user's own key. The static list above is only
// a fallback for the moment before a key has been entered.
app.get('/api/gemini/models', ok(async (req, res) => {
  const apiKey = req.header('x-gemini-key');
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const models = await listModels(apiKey);
  if (!models.length) {
    throw new Error('This Gemini key has no text models available to it. Check the key in Google AI Studio.');
  }
  res.json({ models });
}));

// --- key check (free: it only lists models, it does not generate anything) ---

app.post('/api/check-keys', ok(async (req, res) => {
  const { geminiKey, elevenKey, deepseekKey } = req.body || {};
  const result = { gemini: 'skipped', elevenlabs: 'skipped', deepseek: 'skipped' };

  if (geminiKey) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': geminiKey },
    });
    result.gemini = r.ok
      ? 'ok'
      : r.status === 400 || r.status === 403
        ? 'That Gemini key was rejected. Check for extra spaces when pasting.'
        : 'Gemini replied with error ' + r.status + '.';
  }

  if (elevenKey) {
    const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': elevenKey } });
    if (r.ok) {
      const user = await r.json().catch(() => ({}));
      const sub = user.subscription || {};
      const used = sub.character_count;
      const limit = sub.character_limit;
      result.elevenlabs = 'ok';
      if (typeof used === 'number' && typeof limit === 'number') {
        result.elevenlabsQuota = { used, limit, left: Math.max(0, limit - used) };
      }
    } else {
      result.elevenlabs =
        r.status === 401
          ? 'That ElevenLabs key was rejected. Copy it again from elevenlabs.io.'
          : 'ElevenLabs replied with error ' + r.status + '.';
    }
  }

  if (deepseekKey) {
    // Listing models costs nothing and proves both the key and the balance.
    const r = await fetch('https://api.deepseek.com/models', {
      headers: { Authorization: 'Bearer ' + deepseekKey },
    });
    result.deepseek = r.ok
      ? 'ok'
      : r.status === 401
        ? 'That DeepSeek key was rejected. Copy it again from platform.deepseek.com.'
        : r.status === 402
          ? 'That DeepSeek key works but the account has no credit left.'
          : 'DeepSeek replied with error ' + r.status + '.';
  }

  res.json(result);
}));

// --- free stock imagery (Pexels + NASA) -------------------------------------

app.post('/api/stock/search', ok(async (req, res) => {
  const { query, orientation, providers } = req.body || {};
  const results = await searchStock({
    pexelsKey: req.header('x-pexels-key') || '',
    query,
    orientation,
    providers,
  });
  res.json({ results });
}));

app.post('/api/stock/pick', ok(async (req, res) => {
  const { url, id, jobId } = req.body || {};
  const safeJob = String(jobId || 'default').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'default';
  const saved = await downloadStock({ url, id, jobId: safeJob, publicDir: paths.PUBLIC_DIR });
  res.json(saved);
}));

// --- what is worth making a video about right now ----------------------------

app.post('/api/trending', ok(async (req, res) => {
  const { apiKey, model, options } = req.body || {};
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const result = await findTrending(apiKey, model || 'gemini-2.5-flash', options || {});
  res.json(result);
}));

// --- the second opinion: DeepSeek checks Gemini's question -------------------

app.post('/api/validate', ok(async (req, res) => {
  const { apiKey, model, content, options } = req.body || {};
  if (!apiKey) throw new Error('No DeepSeek API key was sent. Add it on the Keys step.');
  if (!content || !content.question || !Array.isArray(content.options)) {
    throw new Error('There is no question to check yet.');
  }
  const report = await validateContent(apiKey, model || 'deepseek-chat', content, options || {});
  res.json({ report });
}));

// --- step 1: write the question and the script ------------------------------

app.post('/api/generate', ok(async (req, res) => {
  const { apiKey, model, options } = req.body || {};
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const o = options || {};
  const explainer = o.videoKind === 'explainer';
  const chosen = model || 'gemini-2.5-flash';

  // Say what is happening before it happens. A long explainer can take a
  // couple of minutes, and a silent window is indistinguishable from a hang.
  console.log(
    '[generate] ' + (explainer ? 'storyboard' : 'quiz') + ' - ' + chosen
    + ', ' + (o.targetSeconds || '?') + 's target'
    + (explainer ? ' - long scripts take a while, please wait' : ''),
  );

  // Two quite different videos, two prompts, one route. The rest of the
  // pipeline cannot tell them apart, which is the point.
  const content = explainer
    ? await generateStoryboard(apiKey, chosen, o)
    : await generateContent(apiKey, chosen, o);

  console.log('[generate] done - ' + content.script.length + ' scenes');
  res.json({ content });
}));

// --- title, tags and description for the upload form ------------------------

app.post('/api/seo', ok(async (req, res) => {
  const { apiKey, model, content, options } = req.body || {};
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  if (!content || !content.question) throw new Error('Generate a question before writing metadata.');
  const seo = await generateSeo(apiKey, model || 'gemini-2.5-flash', content, options || {});
  res.json({ seo });
}));

// --- step 2: voices ---------------------------------------------------------

app.get('/api/voices', ok(async (req, res) => {
  const apiKey = req.header('x-el-key');
  if (!apiKey) throw new Error('No ElevenLabs API key was sent. Add it on the Keys step.');
  res.json({ voices: await listVoices(apiKey) });
}));

// --- step 3: the voiceover, one file per scene ------------------------------

/** jobId -> { status, done, total, stage, tracks, error } */
const ttsJobs = new Map();

app.post('/api/voiceover', ok(async (req, res) => {
  const { apiKey, settings, script } = req.body || {};
  if (!apiKey) throw new Error('No ElevenLabs API key was sent. Add it on the Keys step.');
  if (!settings || !settings.voiceId) throw new Error('Pick a voice first.');
  if (!Array.isArray(script) || !script.length) throw new Error('There is no script to read out.');

  const jobId = 'vo-' + randomUUID().slice(0, 8);
  const dir = path.join(GENERATED_DIR, jobId);
  fs.mkdirSync(dir, { recursive: true });

  const speakable = script.filter((line) => (line.narration || '').trim());
  const job = {
    status: 'running',
    done: 0,
    total: speakable.length,
    stage: 'Warming up the voice…',
    tracks: {},
    error: '',
  };
  ttsJobs.set(jobId, job);
  res.json({ jobId, total: job.total });

  // Sequential on purpose: ElevenLabs limits how many requests may overlap,
  // and a queue of 8 short lines is only a few seconds anyway.
  (async () => {
    try {
      for (let i = 0; i < script.length; i++) {
        const line = script[i];
        const text = (line.narration || '').trim();
        if (!text) continue;

        job.stage = 'Recording line ' + (job.done + 1) + ' of ' + job.total + '…';
        const result = await speak(apiKey, text, settings);
        if (!result) continue;

        const fileName = 's' + i + '.mp3';
        fs.writeFileSync(path.join(dir, fileName), result.buffer);
        job.tracks[i] = {
          src: 'generated/' + jobId + '/' + fileName,
          duration: result.duration,
          words: result.words,
        };
        job.done += 1;
      }
      job.status = 'done';
      job.stage = 'Voiceover ready';
    } catch (err) {
      job.status = 'error';
      job.error = (err && err.message) || 'The voiceover failed.';
      job.stage = 'Failed';
    }
  })();
}));

app.get('/api/voiceover/:id', (req, res) => {
  const job = ttsJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That voiceover job is not running any more.' });
  res.json(job);
});

// --- step 4: render ---------------------------------------------------------

app.post('/api/render', ok(async (req, res) => {
  const { props, quality } = req.body || {};
  if (!props || !Array.isArray(props.scenes) || !props.scenes.length) {
    throw new Error('There is nothing to render yet. Generate a question first.');
  }
  const jobId = 'video-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  startRender(jobId, props, quality || 'medium');
  res.json({ jobId });
}));

app.get('/api/render/:id', (req, res) => {
  const job = renderJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That render job is not running any more.' });
  res.json(job);
});

// --- housekeeping -----------------------------------------------------------

/** Throw away voiceover audio from previous days so the folder cannot grow forever. */
function cleanOldAudio() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const dropOldChildren = (dir, matches) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      if (!matches(entry)) continue;
      const full = path.join(dir, entry);
      if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { recursive: true, force: true });
    }
  };

  try {
    // Voiceover jobs sit directly under generated/; stock images are one level
    // deeper, so only the individual job folders inside it may be removed -
    // never the "stock" folder itself, which would take today's work with it.
    dropOldChildren(GENERATED_DIR, (e) => e.startsWith('vo-'));
    dropOldChildren(path.join(GENERATED_DIR, 'stock'), () => true);
  } catch {
    // never let cleanup stop the server from booting
  }
}

// Say something before doing anything. Every line below this used to run in
// silence, so a slow disk or a locked file was indistinguishable from a crash:
// the window simply sat there with nothing in it.
console.log('');
console.log('  Starting the Shorts Studio helper...');

/** Housekeeping must never be the reason the server does not come up. */
const step = (what, fn) => {
  const started = Date.now();
  try {
    const result = fn();
    const ms = Date.now() - started;
    if (ms > 400) console.log('  ' + what + ' took ' + (ms / 1000).toFixed(1) + 's.');
    return result;
  } catch (err) {
    console.log('  Could not ' + what + ': ' + ((err && err.message) || err));
    console.log('  Carrying on anyway.');
    return null;
  }
};

step('create the working folders', () => {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.mkdirSync(paths.OUT_DIR, { recursive: true });
});

// Windows will sometimes hand out a port another process already holds, only to
// fail a moment later. Announcing success from the listen callback therefore
// printed "helper is running" and then "port is already taken" immediately
// underneath it. The banner waits instead, and the error cancels it, so the
// window never claims something that is not true.
let announce = null;

const server = app.listen(PORT, '127.0.0.1', () => {
  announce = setTimeout(() => {
    console.log('');
    console.log('  Shorts Studio helper is running (port ' + PORT + ').');
    console.log('  Your browser should open by itself in a moment.');
    console.log('  If it does not, use the "Local:" address printed just below by VITE.');
    console.log('  Finished videos are saved in:  ' + paths.OUT_DIR);
    console.log('');

    // Deliberately after listening. Neither of these is needed to answer a
    // request, and doing them first meant the port stayed shut while they ran.
    step('tidy up old voiceovers', cleanOldAudio);
    const audio = step('prepare the music and effects', () => ensureAudioAssets(paths.PUBLIC_DIR));
    if (audio && audio.written.length) {
      console.log('  Generated ' + audio.written.length + ' audio assets.');
    }
  }, 250);
  announce.unref?.();
});

// The listen error fires on the server, not on the app. Attached to the app it
// would never run - and this is the branch that matters most, because a second
// copy already holding the port is the usual reason the helper never appears.
server.on('error', (err) => {
  if (announce) clearTimeout(announce);
  console.log('');
  if (err && err.code === 'EADDRINUSE') {
    console.log('  Port ' + PORT + ' is already taken, so the helper cannot start.');
    console.log('  Another copy of the tool is almost certainly still running.');
    console.log('  Close the other PowerShell window, or run this and try again:');
    console.log('');
    console.log('    Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen |');
    console.log('      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }');
  } else if (err && err.code === 'EACCES') {
    console.log('  Windows refused to open port ' + PORT + '. Check your firewall settings.');
  } else {
    console.log('  The helper could not start: ' + ((err && err.message) || err));
  }
  console.log('');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  // Without this the process exits printing a stack trace nobody can act on.
  console.log('');
  console.log('  The helper stopped unexpectedly: ' + ((err && err.message) || err));
  console.log('  Press Ctrl + C, then run npm start again.');
  process.exit(1);
});
