import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  IMAGE_STYLES,
  aspectFor,
  buildPrompt,
  explainError,
  explainFailure,
  generateImage,
} from './images.mjs';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };
const realFetch = globalThis.fetch;

// --- the frame we render is the frame we ask for ------------------------------
ok('portrait asks for 9:16', aspectFor('portrait') === '9:16');
ok('landscape asks for 16:9', aspectFor('landscape') === '16:9');
ok('an unknown orientation falls back to the short', aspectFor('') === '9:16');

// --- prompt building ----------------------------------------------------------
const p = buildPrompt({ query: 'eddy currents', subject: 'Physics', topic: 'induction' });
ok('prompt keeps the scene query', p.includes('eddy currents'));
ok('prompt adds the subject as context', p.includes('Physics'));
ok('prompt carries a style', p.includes('editorial') || p.includes('photographic'));
ok('prompt leaves room for the caption', /centre of the frame/i.test(p));
ok('prompt bans lettering', /no text/i.test(p));

ok('an empty query generates nothing',
   buildPrompt({ query: '   ', subject: 'Physics' }) === '');

// The context clause is noise when the query already says it.
ok('context is dropped when the query already contains it',
   !buildPrompt({ query: 'physics of a pendulum', subject: 'physics' }).includes('in the context of'));

for (const style of IMAGE_STYLES) {
  const out = buildPrompt({ query: 'a fish', styleId: style.id });
  ok('style "' + style.id + '" reaches the prompt', out.includes(style.prompt.slice(0, 24)));
}

ok('an unknown style falls back rather than throwing',
   buildPrompt({ query: 'a fish', styleId: 'nope' }).length > 0);

// --- errors a creator can act on ---------------------------------------------
ok('401 blames the key', /key was rejected/i.test(explainError(401, '{}')));
ok('403 blames the plan, not the script', /Pro plan/i.test(explainError(403, '{}')));
ok('403 says the voiceover still works', /voiceover/i.test(explainError(403, '{}')));
ok('a plan message in the body is caught on any status',
   /Pro plan/i.test(explainError(400, JSON.stringify({ detail: { message: 'upgrade your subscription' } }))));
ok('429 says to wait', /rate limit/i.test(explainError(429, '{}')));
ok('500 says it is their end', /server error/i.test(explainError(500, '{}')));
ok('an unparseable body does not throw', typeof explainError(418, '<html>') === 'string');

ok('moderation asks for a reword', /reword/i.test(explainFailure({ failure_reason: 'moderated' })));
ok('charging failure names the plan', /plan and credit/i.test(explainFailure({ failure_reason: 'charging_failed' })));
ok('an unknown reason still says something', explainFailure({}).length > 10);

// --- the create-then-poll flow ------------------------------------------------
// A fake ElevenLabs. `script` is the sequence of poll bodies to hand back.
const mockApi = (script, { createStatus = 200, createBody = { id: 'gen_1', status: 'pending' } } = {}) => {
  const calls = [];
  let poll = 0;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const isCreate = (init.method || 'GET') === 'POST';
    const status = isCreate ? createStatus : 200;
    const body = isCreate ? createBody : script[Math.min(poll++, script.length - 1)];
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    };
  };
  return calls;
};

// Two "generating" replies, then the image.
let calls = mockApi([
  { status: 'generating', id: 'gen_1' },
  { status: 'generating', id: 'gen_1' },
  { status: 'completed', id: 'gen_1', content_url: 'https://signed/x.png', content_mime_type: 'image/png' },
]);
let out = await generateImage({
  apiKey: 'k', prompt: 'a fish', orientation: 'portrait', pollMs: 0, wait: async () => {},
});
ok('polls until the image lands', out.url === 'https://signed/x.png', 'calls=' + calls.length);
ok('reports the mime type', out.mimeType === 'image/png');
ok('creates before polling', calls[0].method === 'POST' && calls[1].method === 'GET');
ok('polls the id it was given', calls[1].url.endsWith('/flows/image/gen_1'));

const sent = JSON.parse(calls[0].body);
ok('sends the requested aspect ratio', sent.aspect_ratio === '9:16');
ok('sends the default model when none is named', sent.model_id === DEFAULT_IMAGE_MODEL);

// A model we do not offer must not be forwarded verbatim.
calls = mockApi([{ status: 'completed', id: 'g', content_url: 'https://signed/y.png' }]);
await generateImage({ apiKey: 'k', prompt: 'x', modelId: 'bytedance-seedream-5-pro', pollMs: 0, wait: async () => {} });
ok('an unoffered model falls back to the default',
   JSON.parse(calls[0].body).model_id === DEFAULT_IMAGE_MODEL);

calls = mockApi([{ status: 'completed', id: 'g', content_url: 'https://signed/y.png' }]);
await generateImage({ apiKey: 'k', prompt: 'x', modelId: IMAGE_MODELS[3].id, pollMs: 0, wait: async () => {} });
ok('an offered model is sent through', JSON.parse(calls[0].body).model_id === IMAGE_MODELS[3].id);

// A failure mid-poll must surface as the friendly reason, not as a hang.
mockApi([{ status: 'failed', id: 'g', failure_reason: 'moderated', error_message: 'nope' }]);
let threw = '';
try {
  await generateImage({ apiKey: 'k', prompt: 'x', pollMs: 0, wait: async () => {} });
} catch (e) { threw = e.message; }
ok('a failed generation throws the friendly reason', /reword/i.test(threw), threw);

// A create that is refused must not start polling at all.
calls = mockApi([], { createStatus: 403, createBody: { detail: { message: 'nope' } } });
threw = '';
try {
  await generateImage({ apiKey: 'k', prompt: 'x', pollMs: 0, wait: async () => {} });
} catch (e) { threw = e.message; }
ok('a refused create explains the plan', /Pro plan/i.test(threw), threw);
ok('a refused create does not poll', calls.length === 1, 'calls=' + calls.length);

// Waiting for ever is not an option; the clock is what stops it.
mockApi([{ status: 'generating', id: 'g' }]);
let clock = 0;
threw = '';
try {
  await generateImage({
    apiKey: 'k', prompt: 'x', pollMs: 0, timeoutMs: 5000,
    now: () => clock, wait: async () => { clock += 1500; },
  });
} catch (e) { threw = e.message; }
ok('a generation that never finishes gives up with the wait time', /5 seconds/.test(threw), threw);

// --- the guards that run before any network call ------------------------------
globalThis.fetch = async () => { throw new Error('should not have been called'); };
threw = '';
try { await generateImage({ apiKey: '', prompt: 'x' }); } catch (e) { threw = e.message; }
ok('a missing key is caught before the network', /API key/i.test(threw), threw);

threw = '';
try { await generateImage({ apiKey: 'k', prompt: '  ' }); } catch (e) { threw = e.message; }
ok('an empty prompt is caught before the network', /no words to draw/i.test(threw), threw);

// --- the catalogue itself -----------------------------------------------------
ok('the default model is one we offer', IMAGE_MODELS.some((m) => m.id === DEFAULT_IMAGE_MODEL));
ok('no ByteDance model is offered (they need separate approval)',
   !IMAGE_MODELS.some((m) => /bytedance|seedream/i.test(m.id)));
ok('every model has a label', IMAGE_MODELS.every((m) => m.id && m.label));
ok('every style has a label and a prompt', IMAGE_STYLES.every((s) => s.id && s.label && s.prompt));

globalThis.fetch = realFetch;
// --- a prompt the creator wrote ----------------------------------------------
// imageQuery is written for a stock SEARCH - two or three nouns - and handing
// that to an image model gets a literal, flat reading of two words. So the
// scene can carry a described prompt instead, and it wins.

const written = buildPrompt({
  query: 'copper wire', custom: 'a coil glowing as current builds',
  subject: 'Physics', topic: 'Induction', styleId: 'editorial',
});
ok('a written prompt replaces the search words',
   written.startsWith('a coil glowing as current builds'), written.slice(0, 60));
ok('and the style is still appended', /photographic editorial backdrop/.test(written));
ok('and the composition rule survives an edit', /centre of the frame/i.test(written));
ok('the subject is not guessed over a written prompt',
   !/in the context of/.test(written), written.slice(0, 90));
ok('search words are still used when nothing was written',
   buildPrompt({ query: 'copper wire', subject: 'Physics', styleId: 'editorial' })
     .startsWith('copper wire'));
ok('an empty written prompt falls back rather than drawing nothing',
   buildPrompt({ query: 'copper wire', custom: '   ', styleId: 'editorial' }).startsWith('copper wire'));
ok('no words at all still yields nothing', buildPrompt({ query: '', custom: '' }) === '');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall image checks passed');
process.exit(fails ? 1 : 0);
