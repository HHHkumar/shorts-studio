import {
  DEFAULT_GOOGLE_IMAGE_MODEL, GOOGLE_IMAGE_MODELS, aspectFor, explainError, extractImage,
  generateGoogleImage, skeleton,
} from './google-images.mjs';
import { readGeneratedImage, saveImageBuffer } from './stock.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let fails = 0;
const ok = (n, c, extra='') => { console.log((c?'  ok  ':'  FAIL')+'  '+n+(extra?'  '+extra:'')); if(!c) fails++; };
const realFetch = globalThis.fetch;

// --- the frame we render is the frame we ask for ------------------------------
ok('portrait asks for 9:16', aspectFor('portrait') === '9:16');
ok('landscape asks for 16:9', aspectFor('landscape') === '16:9');
ok('an unknown orientation falls back to the short', aspectFor('') === '9:16');

// --- the catalogue ------------------------------------------------------------
ok('the default model is one we offer',
   GOOGLE_IMAGE_MODELS.some((m) => m.id === DEFAULT_GOOGLE_IMAGE_MODEL));
ok('the cheapest model is offered first', GOOGLE_IMAGE_MODELS[0].id === DEFAULT_GOOGLE_IMAGE_MODEL);
ok('every model has a label', GOOGLE_IMAGE_MODELS.every((m) => m.id && m.label));

// --- the error a creator will actually hit ------------------------------------
// Image generation is on NO Gemini free tier. This is the single message most
// likely to save somebody an hour, so it is asserted rather than hoped for.
const quota = JSON.stringify({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } });
ok('a quota refusal explains that billing is the likely cause',
   /billing/i.test(explainError(429, quota)));
ok('and says the free tier does not do this at all',
   /free tier/i.test(explainError(429, quota)));
ok('and reassures that scripts still work',
   /writes scripts for free|stays free|for free/i.test(explainError(429, quota)));
ok('a 403 also points at billing', /billing/i.test(explainError(403, '{}')));
ok('a bad key is not blamed on billing',
   /rejected/i.test(explainError(400, JSON.stringify({ error: { message: 'API key not valid' } })))
   && !/billing/i.test(explainError(400, JSON.stringify({ error: { message: 'API key not valid' } }))));
ok('a 500 says it is their end', /server error/i.test(explainError(500, '{}')));
ok('an unparseable body does not throw', typeof explainError(418, '<html>') === 'string');
ok('fieldViolations are folded into the message',
   /aspect/i.test(explainError(400, JSON.stringify({ error: { message: 'bad',
     details: [{ fieldViolations: [{ description: 'aspect_ratio is invalid' }] }] } }))));

// This endpoint wraps its errors in an ARRAY, unlike the rest of the Gemini API.
// Captured from the live API with a deliberately bad key - reading it as a bare
// object produced an error that said only "unknown".
const REAL_BAD_KEY = JSON.stringify([{
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' },
      { '@type': 'type.googleapis.com/google.rpc.LocalizedMessage', message: 'API key not valid.' },
    ],
  },
}]);
ok('an array-wrapped error is unwrapped', /rejected/i.test(explainError(400, REAL_BAD_KEY)),
   explainError(400, REAL_BAD_KEY));
ok('and never reports "unknown" when Google did say something',
   !/unknown/i.test(explainError(400, REAL_BAD_KEY)), explainError(400, REAL_BAD_KEY));
ok('a bare-object error still works too',
   /rejected/i.test(explainError(400, JSON.stringify({ error: { message: 'API key not valid' } }))));

// --- the call itself ----------------------------------------------------------
const PIXEL = 'iVBORw0KGgo=';
const mock = (status, body, capture) => {
  globalThis.fetch = async (url, init) => {
    if (capture) capture.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return { ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(body) };
  };
};

let calls = [];
mock(200, { interaction: { output_image: { data: PIXEL, mime_type: 'image/jpeg' } } }, calls);
let out = await generateGoogleImage({ apiKey: 'k', prompt: 'a fish', orientation: 'portrait' });
ok('returns the base64 image', out.base64 === PIXEL);
ok('returns the mime type', out.mimeType === 'image/jpeg');
ok('posts to the interactions endpoint', /\/v1beta\/interactions$/.test(calls[0].url));
ok('sends the key as a header, never in the URL',
   calls[0].headers['x-goog-api-key'] === 'k' && !/key=/.test(calls[0].url));
ok('asks for the right aspect ratio', calls[0].body.response_format.aspect_ratio === '9:16');
ok('asks for an image, not text', calls[0].body.response_format.type === 'image');
ok('uses the default model when none is named', calls[0].body.model === DEFAULT_GOOGLE_IMAGE_MODEL);
ok('sends exactly one input when there is no reference', calls[0].body.input.length === 1);

// A model we do not offer must not be forwarded verbatim.
calls = [];
mock(200, { interaction: { output_image: { data: PIXEL } } }, calls);
await generateGoogleImage({ apiKey: 'k', prompt: 'x', modelId: 'some-unreleased-thing' });
ok('an unoffered model falls back to the default', calls[0].body.model === DEFAULT_GOOGLE_IMAGE_MODEL);

calls = [];
mock(200, { interaction: { output_image: { data: PIXEL } } }, calls);
await generateGoogleImage({ apiKey: 'k', prompt: 'x', modelId: GOOGLE_IMAGE_MODELS[3].id });
ok('an offered model is sent through', calls[0].body.model === GOOGLE_IMAGE_MODELS[3].id);

// --- the style reference ------------------------------------------------------
calls = [];
mock(200, { interaction: { output_image: { data: PIXEL } } }, calls);
await generateGoogleImage({
  apiKey: 'k', prompt: 'a fish',
  reference: { base64: 'AAAA', mimeType: 'image/png' },
});
ok('a reference is sent as a second input', calls[0].body.input.length === 2);
ok('the reference goes as an image part',
   calls[0].body.input[1].type === 'image' && calls[0].body.input[1].data === 'AAAA');
ok('the reference keeps its mime type', calls[0].body.input[1].mime_type === 'image/png');
ok('the prompt asks the model to match it', /match the visual style/i.test(calls[0].body.input[0].text));

// Not every model takes a reference; losing the whole picture over the style
// match would be a poor trade.
calls = [];
let n = 0;
globalThis.fetch = async (url, init) => {
  calls.push(JSON.parse(init.body));
  n++;
  if (n === 1) return { ok: false, status: 400, headers: new Headers(), text: async () => '{"error":{"message":"image input not supported"}}' };
  return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ interaction: { output_image: { data: PIXEL } } }) };
};
out = await generateGoogleImage({ apiKey: 'k', prompt: 'x', reference: { base64: 'AAAA' } });
ok('a rejected reference is dropped and the image still drawn', out.base64 === PIXEL);
ok('the retry carries no reference', calls[1].input.length === 1);

// --- finding the image whatever shape it arrives in ---------------------------
// Reported as "Gemini answered but sent no image back": a 200 whose body did
// not match the one path we looked in. Google's docs show the request and not
// the response, `interaction.output_image` is an SDK convenience that need not
// exist on the wire, and this endpoint already wraps its ERRORS in an array -
// so the success body very likely is too. Every plausible shape is now tried.
const B64 = 'A'.repeat(600);
const shapes = {
  'documented convenience field': { interaction: { output_image: { data: B64, mime_type: 'image/png' } } },
  'array-wrapped, like its errors': [{ interaction: { output_image: { data: B64 } } }],
  'steps rather than output_image': { interaction: { steps: [{ content: [{ type: 'image', data: B64 }] }] } },
  'array-wrapped steps': [{ interaction: { steps: [{ content: [{ type: 'image', data: B64 }] }] } }],
  'generateContent inlineData': { candidates: [{ content: { parts: [{ inlineData: { data: B64, mimeType: 'image/png' } }] } }] },
  'generateContent snake_case': { candidates: [{ content: { parts: [{ inline_data: { data: B64 } }] } }] },
  'imagen predict': { predictions: [{ bytesBase64Encoded: B64 }] },
  'somewhere unexpected': { result: { payload: { nested: { image_bytes: B64, mime_type: 'image/webp' } } } },
};
for (const [name, body] of Object.entries(shapes)) {
  const got = extractImage(body);
  ok('finds the image in: ' + name, got !== null && got.base64 === B64, JSON.stringify(got && got.mimeType));
}
ok('a documented mime type is kept',
   extractImage(shapes['documented convenience field']).mimeType === 'image/png');
ok('an unexpected mime type is kept too',
   extractImage(shapes['somewhere unexpected']).mimeType === 'image/webp');

// It must NOT invent an image out of ordinary text.
const noImage = [
  { interaction: { steps: [{ content: [{ type: 'text', text: 'I cannot draw that.' }] }] } },
  { candidates: [{ content: { parts: [{ text: 'x'.repeat(900) }] } }] },
  { interaction: {} },
  {},
  [],
];
const invented = noImage.filter((b) => extractImage(b) !== null);
ok('a reply with no image yields null, not a false positive', invented.length === 0,
   JSON.stringify(invented[0] || '').slice(0, 90));
ok('a short base64-ish value is not mistaken for a picture',
   extractImage({ data: 'AAAA' }) === null);
ok('a cycle does not hang the search', (() => {
  const a = { nested: {} };
  a.nested.back = a;
  try { extractImage(a); return true; } catch { return false; }
})());

// When it genuinely is not there, the message has to say what DID arrive.
const refusal = JSON.stringify({ interaction: { steps: [{ content: [{ type: 'text', text: 'no' }] }] } });
ok('the skeleton names the keys', /interaction/.test(skeleton(refusal)), skeleton(refusal));
ok('the skeleton keeps no values',
   !/A{50}/.test(skeleton(JSON.stringify({ interaction: { output_image: { data: B64 } } }))));
ok('the skeleton survives a non-JSON body', /not JSON/.test(skeleton('<html>500</html>')));

mock(200, { interaction: { steps: [{ content: [{ type: 'text', text: 'refused' }] }] } });
let noImgErr = '';
try { await generateGoogleImage({ apiKey: 'k', prompt: 'x' }); } catch (e) { noImgErr = e.message; }
ok('the no-image error reports the shape it got', /shape/i.test(noImgErr) && /interaction/.test(noImgErr),
   noImgErr.slice(0, 110));

// --- falling back through the response shape ----------------------------------
mock(200, { interaction: { steps: [{ type: 'model_output', content: [{ type: 'image', data: PIXEL }] }] } });
out = await generateGoogleImage({ apiKey: 'k', prompt: 'x' });
ok('the image is found in steps when output_image is absent', out.base64 === PIXEL);

mock(200, { interaction: { steps: [] } });
let threw = '';
try { await generateGoogleImage({ apiKey: 'k', prompt: 'x' }); } catch (e) { threw = e.message; }
ok('an answer with no image at all is an error', /no image back/i.test(threw), threw.slice(0, 80));

// --- guards before the network ------------------------------------------------
globalThis.fetch = async () => { throw new Error('should not have been called'); };
threw = '';
try { await generateGoogleImage({ apiKey: '', prompt: 'x' }); } catch (e) { threw = e.message; }
ok('a missing key is caught before the network', /Gemini API key/i.test(threw), threw);
threw = '';
try { await generateGoogleImage({ apiKey: 'k', prompt: '   ' }); } catch (e) { threw = e.message; }
ok('an empty prompt is caught before the network', /no words to draw/i.test(threw), threw);

// --- writing it to disk, and reading it back as a reference -------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-img-'));
const saved = saveImageBuffer({
  buffer: Buffer.from('hello'), mimeType: 'image/jpeg',
  id: 'ai-1234', jobId: 'job-x', publicDir: tmp, folder: 'ai',
});
ok('a saved image lands under generated/ai', saved.src === 'generated/ai/job-x/ai-1234.jpg', saved.src);
ok('and is actually on disk', fs.existsSync(path.join(tmp, saved.src.split('/').join(path.sep))));
ok('reading it back gives base64', readGeneratedImage({ src: saved.src, publicDir: tmp }).base64
   === Buffer.from('hello').toString('base64'));

// The reference path comes from the browser. It is not trusted for a moment:
// getting this wrong turns "match this style" into a file-disclosure endpoint.
const attacks = [
  '../../../../etc/passwd',
  'generated/ai/job-x/../../../../package.json',
  '/etc/passwd',
  'C:\\Windows\\win.ini',
  'generated/../../secrets.txt',
  'package.json',
  '',
];
const leaked = attacks.filter((a) => readGeneratedImage({ src: a, publicDir: tmp }) !== null);
ok('no path outside public/ can be read as a reference', leaked.length === 0, leaked.join(', '));
ok('a file that does not exist returns null',
   readGeneratedImage({ src: 'generated/ai/job-x/nope.jpg', publicDir: tmp }) === null);
fs.rmSync(tmp, { recursive: true, force: true });

globalThis.fetch = realFetch;
console.log(fails ? '\n' + fails + ' FAILURES' : '\nall google image checks passed');
process.exit(fails ? 1 : 0);
