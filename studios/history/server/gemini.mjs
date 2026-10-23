// ---------------------------------------------------------------------------
// Gemini: listing the models a key can use, and one structured-JSON call.
//
// Lifted from Shorts Studio's server/gemini.mjs, where every retry and error
// message here was earned against the live API. Only the quiz-specific parts
// were left behind.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';
import { callClaude } from './claude.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// ---------------------------------------------------------------------------
// Model listing
// ---------------------------------------------------------------------------

/**
 * Ask the key which models it can actually use. Hard-coding a list goes stale
 * every few months and produces a confusing 404, so the dropdown is built from
 * whatever Google says this specific key has access to.
 */
export async function listModels(apiKey) {
  const collected = [];
  let pageToken = '';

  for (let page = 0; page < 5; page++) {
    const url = ENDPOINT + '?pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetchRetrying(url, { headers: { 'x-goog-api-key': apiKey } });
    const raw = await res.text();
    if (!res.ok) throw new Error(explainGeminiError(res.status, raw));

    const data = JSON.parse(raw);
    for (const m of data.models || []) collected.push(m);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const usable = collected
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      displayName: m.displayName || '',
    }))
    .filter((m) => /^gemini-/i.test(m.id))
    // These exist but cannot write a JSON quiz script.
    .filter((m) => !/embedding|aqa|vision|image|audio|tts|live|realtime|robotics|computer-use/i.test(m.id));

  const seen = new Set();
  const unique = usable.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));

  unique.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

  // Recommend a plain "flash" build if the key has one - best speed/cost balance.
  const recommended = unique.find((m) => /^gemini-[\d.]+-flash$/i.test(m.id)) || unique[0];

  return unique.map((m) => ({
    id: m.id,
    label:
      (m.displayName || m.id) +
      (recommended && m.id === recommended.id ? ' — recommended' : '') +
      (isPreview(m.id) ? ' (preview)' : ''),
  }));
}

const isPreview = (id) => /preview|exp|latest|-\d{2}-\d{2}$/i.test(id);

/**
 * Sort order, most important first: stable builds before previews, newer
 * generations before older ones, then flash / pro / flash-lite within a
 * generation. Version has to outweigh family, or an old 1.5 Flash would
 * outrank the current 2.5 Pro.
 */
function rank(id) {
  const previewPenalty = isPreview(id) ? 1000 : 0;
  const version = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');

  let family = 9;
  if (/flash-lite/i.test(id)) family = 3;
  else if (/flash/i.test(id)) family = 1;
  else if (/pro/i.test(id)) family = 2;

  return previewPenalty - version * 10 + family;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * One call to whichever model the creator picked.
 *
 * The two providers take the same four things and return the same parsed
 * object, so everything above this line - the quiz prompt, the storyboard
 * prompt, the schemas, the normalizers - is written once and does not care.
 */
export function callModel(provider, apiKey, model, request) {
  return provider === 'claude'
    ? callClaude(apiKey, model, request)
    : callGemini(apiKey, model, request);
}


/**
 * One structured-JSON call to Gemini, with every failure translated into
 * something a person can act on.
 *
 * Shared with the explainer storyboard: the two generators differ only in their
 * prompt and their schema, and duplicating the retry, parse and error handling
 * would mean fixing the same bug twice.
 */
/**
 * Stop a thinking model from spending its entire output budget reasoning.
 *
 * A Gemini 3 Flash was seen taking 87 seconds over a NINETY SECOND script -
 * about nine scenes - and then finishing with MAX_TOKENS having emitted no
 * JSON at all. The thinking counts against the same budget as the answer, so
 * left alone the model can reason itself out of room before it starts writing.
 *
 * The knob differs by generation, and a model that does not recognise the one
 * it is sent rejects the whole request, so the caller drops it and retries.
 */
export function thinkingFor(model) {
  const version = parseFloat((String(model).match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');
  // Both knobs live INSIDE thinkingConfig. This used to spread `thinkingLevel`
  // straight into generationConfig, where it is an unknown field - so every
  // Gemini 3 request was rejected on its first attempt and only worked at all
  // because the caller strips the setting and tries again.
  if (version >= 3) return { thinkingConfig: { thinkingLevel: 'low' } };
  if (version >= 2.5) return { thinkingConfig: { thinkingBudget: 8192 } };
  return null;
}

/**
 * How much room to give the answer.
 *
 * MUST be set. Leaving it out does not mean "the model's maximum" - the API
 * defaults it to 8192 whatever the model can actually do, and on a thinking
 * model the reasoning is spent out of that same 8192 before a word of the
 * answer is written. A long explainer needs about 5,500 tokens of JSON on its
 * own; add a thinking budget of 8192 and the default is not close.
 *
 * That is the failure this fixes: a script that starts correctly and stops in
 * the middle of a scene, on exactly the long videos that need the room most.
 *
 * Generous rather than calculated, because an unused ceiling costs nothing -
 * billing is for tokens produced, not tokens allowed. Sized per generation
 * because the older models cannot go above 8192 and reject the request if
 * asked to; the caller drops the field and retries if one does.
 */
export function outputCapFor(model) {
  const version = parseFloat((String(model).match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');
  // 2.5 and later document 65,536 output tokens. 32,768 is four times what the
  // longest storyboard needs, with the whole thinking budget on top, and stays
  // clear of the ceiling on every model in the dropdown.
  if (version >= 2.5) return 32768;
  // 2.0 and earlier top out at 8192, which is also the default - so asking
  // changes nothing and risks a rejection for no gain.
  return null;
}

/** True when a 400 is complaining about the output ceiling rather than the ask. */
export const rejectedOutputCap = (raw) =>
  /maxOutputTokens|max_output_tokens/i.test(String(raw));

/** True when a 400 is complaining about the thinking field rather than the ask. */
export const rejectedThinking = (raw) =>
  /thinking|thinkingLevel|thinkingConfig|thinkingBudget|Unknown name|not supported/i.test(String(raw));

export async function callGemini(apiKey, model, { system, prompt, schema, temperature, label, images = [] }) {
  const buildBody = (thinking, cap) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    // Pictures (for the vision calls) go after the words: { mimeType, base64 }.
    contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } }))] }],
    generationConfig: {
      temperature,
      topP: 0.95,
      ...(cap ? { maxOutputTokens: cap } : {}),
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...(thinking || {}),
    },
  });

  const send = (thinking, cap) => fetchRetrying(
    ENDPOINT + '/' + encodeURIComponent(model) + ':generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: buildBody(thinking, cap),
    },
    {
      // A long explainer on a thinking model genuinely takes minutes. Cutting
      // it off at the default would throw away work that was about to arrive.
      timeoutMs: 240000,
      onRetry: (attempt, reason) =>
        console.log('[gemini] ' + (label || 'call') + ': ' + reason + ', retrying (' + attempt + '/2)'),
    },
  );

  const started = Date.now();
  const thinking = thinkingFor(model);
  let cap = outputCapFor(model);
  let res = await send(thinking, cap);
  let raw = await res.text();

  // An older or unusual model may not know a field. Losing the request over an
  // optimisation would be worse than doing without it. The ceiling is checked
  // first: it is the newer of the two settings and the likelier to be refused.
  if (!res.ok && res.status === 400 && cap && rejectedOutputCap(raw)) {
    console.log('[gemini] ' + (label || 'call') + ': model will not take that output ceiling, retrying without');
    cap = null;
    res = await send(thinking, null);
    raw = await res.text();
  }
  if (!res.ok && res.status === 400 && thinking && rejectedThinking(raw)) {
    console.log('[gemini] ' + (label || 'call') + ': model does not take a thinking setting, retrying without');
    res = await send(null, cap);
    raw = await res.text();
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!res.ok) {
    console.log('[gemini] ' + (label || 'call') + ' failed after ' + seconds + 's (' + res.status + ')');
    // The field that failed, printed where somebody debugging will see it.
    // Google buries this in error.details and puts "Request contains an invalid
    // argument" in the message, which on its own tells you nothing at all.
    const why = fieldViolations(raw);
    if (why) console.log('[gemini] ' + (label || 'call') + ' rejected: ' + why);
    throw new Error(explainGeminiError(res.status, raw));
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Gemini sent back something that was not JSON. Try again.');
  }

  // What it actually spent, against what it was allowed. Not logged before,
  // which is exactly why a script stopping half way through was hard to read:
  // "ran out of room" and "wandered off" look identical without these numbers.
  const used = payload.usageMetadata || {};
  const answer = Number(used.candidatesTokenCount) || 0;
  const thoughts = Number(used.thoughtsTokenCount) || 0;
  const ceiling = cap ? ' of ' + cap : ' (default ceiling)';
  console.log('[gemini] ' + (label || 'call') + ' answered in ' + seconds + 's'
    + ' - ' + (answer + thoughts) + ceiling + ' tokens'
    + (thoughts ? ' (' + thoughts + ' of them thinking)' : ''));

  const candidate = payload.candidates && payload.candidates[0];
  if (!candidate) {
    const blocked = payload.promptFeedback && payload.promptFeedback.blockReason;
    throw new Error(
      blocked
        ? 'Gemini refused this topic (' + blocked + '). Try a different topic.'
        : 'Gemini returned no result. Try again.',
    );
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    // Blaming the script length here was wrong and sent people the wrong way:
    // a ninety second explainer is about nine scenes, and it still happened,
    // because the budget went on reasoning rather than on the answer. Say which
    // of the two actually ran out.
    const wrote = ((candidate.content && candidate.content.parts) || [])
      .filter((part) => part && part.thought !== true)
      .some((part) => part.text);
    console.log('[gemini] ' + (label || 'call') + ' hit MAX_TOKENS after ' + seconds
      + 's (wrote some answer: ' + wrote + ')');
    throw new Error(
      wrote
        ? 'Gemini stopped part way through the script. The output ceiling is now set generously, '
          + 'so this usually means the model wandered rather than ran short: try again, and if it '
          + 'keeps happening on the same topic, shorten the target length or pick another model.'
        : 'This model spent its whole budget thinking and never started writing. It is a known '
          + 'trait of the newest Flash models on long structured output. Pick a 2.5 model in the '
          + 'dropdown - they are reliable for this - or try again.',
    );
  }

  const parts = (candidate.content && candidate.content.parts) || [];

  // Thinking models return their reasoning as parts flagged `thought`. Joining
  // those in front of the answer produces a string that is prose followed by
  // JSON, which then fails to parse - and the brace-scan fallback below would
  // happily lock on to a brace inside the reasoning and produce nonsense. The
  // answer is only ever in the parts that are not thoughts.
  const answerParts = parts.filter((p) => p && p.thought !== true);
  const text = answerParts.map((p) => p.text || '').join('').trim();

  if (!text) {
    const thoughtOnly = parts.length > 0;
    console.log(
      '[gemini] ' + (label || 'call') + ' returned no answer'
      + ' (parts: ' + parts.length + ', finishReason: ' + (candidate.finishReason || 'none') + ')',
    );
    throw new Error(
      thoughtOnly
        ? 'This model returned its reasoning but no script. That usually means it does not support '
          + 'the structured output this tool asks for. Pick a different model in the dropdown.'
        : 'Gemini returned an empty script. Try again.',
    );
  }

  const parsed = parseJsonLoosely(text);
  if (!parsed) {
    // Print what actually arrived, so a model that answers in an unexpected
    // shape can be identified instead of guessed at.
    console.log('[gemini] ' + (label || 'call') + ' sent unreadable output. First 300 characters:');
    console.log(text.slice(0, 300));
    throw new Error(
      'This model did not answer in the format the tool needs. Pick another model in the dropdown - '
      + 'the PowerShell window shows what it sent instead.',
    );
  }

  return parsed;
}

/**
 * Read the JSON out of a reply, whether it arrived bare, in a code fence, or
 * with a sentence in front of it. Returns null rather than throwing, so the
 * caller can report something useful instead of a raw SyntaxError.
 */
export function parseJsonLoosely(text) {
  const attempt = (candidate) => {
    try {
      const value = JSON.parse(candidate);
      // Must be a plain object. Every schema here returns one, and an array
      // slipping through would be normalised into a script full of nothing.
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inFence = attempt(fenced[1].trim());
    if (inFence) return inFence;
  }

  // Try each opening brace in turn rather than just the first one. Reasoning
  // text is full of braces - "use {a} and {b}" - and anchoring on the first
  // would splice that prose onto the real answer and fail. Walking forward
  // finds the brace where the actual object starts.
  const end = text.lastIndexOf('}');
  if (end === -1) return null;
  let from = 0;
  for (let tries = 0; tries < 50; tries++) {
    const start = text.indexOf('{', from);
    if (start === -1 || start >= end) break;
    const braced = attempt(text.slice(start, end + 1));
    if (braced) return braced;
    from = start + 1;
  }

  return null;
}

/**
 * Pull the part of a Google error that actually says what is wrong.
 *
 * `error.message` on a 400 is the useless "Request contains an invalid
 * argument." The field that failed is in `error.details`, as a BadRequest with
 * fieldViolations - and throwing that away is what turned a one-line fix into
 * an afternoon. Anything found here is appended to the message.
 */
export function fieldViolations(raw) {
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return '';
  }
  const details = (j && j.error && j.error.details) || [];
  const out = [];
  for (const d of details) {
    for (const v of d.fieldViolations || []) {
      const where = v.field ? v.field + ': ' : '';
      out.push(where + (v.description || ''));
    }
    if (!d.fieldViolations && d.reason) out.push(String(d.reason));
  }
  return out.join('; ').slice(0, 400);
}

function explainGeminiError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.error && j.error.message) || '';
  } catch {
    detail = raw.slice(0, 300);
  }
  const why = fieldViolations(raw);
  if (why) detail = detail ? detail + ' (' + why + ')' : why;
  if (status === 400 && /API key not valid/i.test(detail)) {
    return 'That Gemini API key was rejected. Check for stray spaces and paste it again.';
  }
  if (status === 403) return 'Gemini refused the key (403). Make sure the Generative Language API is enabled for it.';
  if (status === 404) {
    return 'Your key cannot use that Gemini model. Reload the page so the dropdown refreshes with the models your key does have, then pick one from the top of the list.';
  }
  if (status === 429) return 'Gemini rate limit hit. Wait about a minute and press Write again.';
  if (status === 503) {
    return 'Google’s servers are busy right now, and the tool already retried three times. Wait a few seconds and press the button again — or switch to a Flash model, which is far less contended than Pro.';
  }
  if (status >= 500) return 'Google had a server error (' + status + '). It was retried automatically; try again in a moment.';
  return 'Gemini error ' + status + ': ' + (detail || 'unknown');
}

