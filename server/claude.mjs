// ---------------------------------------------------------------------------
// Claude as an alternative to Gemini for writing the content.
//
// Same job, same contract: given a system prompt, a user prompt and a schema,
// return the parsed object. `callClaude` is a drop-in for `callGemini`, so the
// quiz generator and the storyboard generator pick a provider and are otherwise
// untouched.
//
// Two callers deliberately do NOT: trends.mjs needs Google Search grounding to
// answer about this week rather than from training, and seo.mjs builds its own
// request with its own prompt. Both still use the Gemini key, and step 2 says so
// when Claude is selected rather than letting it surface as a failure on step 7.
//
// Three things differ from the Gemini path and are worth knowing:
//
//   * The official SDK does the HTTP, not our own fetch wrapper. That means the
//     retry and timeout handling here is the SDK's rather than retry.mjs.
//
//   * JSON comes from `output_config.format`. The old trick of prefilling the
//     assistant turn with a brace is not just discouraged now, it is rejected
//     with a 400 on every current model.
//
//   * The schemas in this project are written in Gemini's dialect - uppercase
//     type names, `propertyOrdering` - so they are translated on the way out.
//     One schema, two providers, no second copy to keep in step.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';

/** Shown in the dropdown before a key has been entered. */
export const CLAUDE_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — best quality (recommended)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — faster and cheaper' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, simplest questions' },
];

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

const TYPES = {
  OBJECT: 'object',
  STRING: 'string',
  ARRAY: 'array',
  INTEGER: 'integer',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
};

/**
 * Translate a Gemini response schema into JSON Schema.
 *
 * Deliberately a translation rather than a second set of schemas: the quiz and
 * storyboard shapes are long, and two copies would drift the moment either
 * provider's prompt changed.
 */
export function toJsonSchema(node) {
  if (!node || typeof node !== 'object') return { type: 'string' };

  const type = TYPES[node.type] || String(node.type || 'string').toLowerCase();
  const out = { type };
  if (node.description) out.description = node.description;
  if (Array.isArray(node.enum) && node.enum.length) out.enum = node.enum.slice();

  if (type === 'object') {
    const props = node.properties || {};
    out.properties = {};
    for (const key of Object.keys(props)) out.properties[key] = toJsonSchema(props[key]);
    // Structured output needs to know exactly which keys may appear; without
    // this the model is free to invent fields the normalizer would drop anyway.
    out.additionalProperties = false;
    // Every property is listed as required, ignoring the schema's own
    // `required` array. Strict structured output pairs `additionalProperties:
    // false` with an exhaustive `required`, so a partial list is rejected. The
    // cost is that the model must emit the optional keys too - an empty
    // `visual`, a `panel` on a scene that does not draw one - and the
    // normalizers already discard those, which is why this is safe here and
    // would not be in general.
    out.required = Object.keys(props);
  }

  if (type === 'array') out.items = toJsonSchema(node.items);

  return out;
}

/**
 * One structured call to Claude.
 *
 * Streamed on purpose. A five minute storyboard is a lot of output, and a
 * non-streaming request that large risks running into the HTTP timeout before
 * the model has finished - the same failure the Gemini path hit from the other
 * direction when a thinking model ate its whole budget.
 */
export async function callClaude(apiKey, model, { system, prompt, schema, label }) {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const chosen = model || DEFAULT_CLAUDE_MODEL;
  const started = Date.now();

  let message;
  try {
    const stream = client.messages.stream({
      model: chosen,
      max_tokens: 32000,
      system,
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: toJsonSchema(schema) } },
    });
    message = await stream.finalMessage();
  } catch (err) {
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log('[claude] ' + (label || 'call') + ' failed after ' + seconds + 's');
    throw new Error(explainClaudeError(err));
  }

  const seconds = Math.round((Date.now() - started) / 1000);

  // A safety decline arrives as a normal 200 with no usable content, so it has
  // to be checked before the content is read.
  if (message.stop_reason === 'refusal') {
    const why = (message.stop_details && message.stop_details.category) || 'unspecified';
    throw new Error('Claude declined this topic (' + why + '). Try a different one.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude ran out of room before finishing. Lower the target length and try again.');
  }

  const text = (message.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  console.log('[claude] ' + (label || 'call') + ' answered in ' + seconds + 's');

  if (!text) throw new Error('Claude returned an empty script. Try again.');

  try {
    return JSON.parse(text);
  } catch {
    // output_config makes this very unlikely, but a thrown SyntaxError here
    // would reach the creator as raw parser noise.
    console.log('[claude] ' + (label || 'call') + ' sent unreadable output. First 300 characters:');
    console.log(text.slice(0, 300));
    throw new Error('Claude did not answer in the format the tool needs. Try again.');
  }
}

/** The models this key can actually use, newest and most capable first. */
export async function listClaudeModels(apiKey) {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const seen = [];
  try {
    for await (const model of client.models.list()) seen.push(model);
  } catch (err) {
    throw new Error(explainClaudeError(err));
  }

  const usable = seen
    .map((m) => ({ id: m.id, label: m.display_name || m.id }))
    // Only the text models write scripts.
    .filter((m) => /^claude-/i.test(m.id));

  if (!usable.length) return CLAUDE_MODELS;

  usable.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  const best = usable[0];
  return usable.map((m) => ({
    id: m.id,
    label: m.label + (m.id === best.id ? ' — recommended' : ''),
  }));
}

/**
 * Sort order: newest generation first, then Opus above Sonnet above Haiku.
 * Version has to outweigh family, or an old Opus would outrank a current Sonnet.
 */
function rank(id) {
  const version = parseFloat((id.match(/-(\d+(?:[-.]\d+)?)$/) || [])[1]?.replace('-', '.') || '0');
  let family = 9;
  if (/opus/i.test(id)) family = 1;
  else if (/sonnet/i.test(id)) family = 2;
  else if (/haiku/i.test(id)) family = 3;
  return -version * 10 + family;
}

function explainClaudeError(err) {
  const status = err && err.status;
  const detail = (err && err.message) || String(err);

  if (err instanceof Anthropic.AuthenticationError || status === 401) {
    return 'That Claude API key was rejected. Check for stray spaces and paste it again.';
  }
  if (err instanceof Anthropic.PermissionDeniedError || status === 403) {
    return 'Claude refused the key (403). Check the key has not been revoked.';
  }
  if (err instanceof Anthropic.RateLimitError || status === 429) {
    return 'Claude rate limit hit. Wait about a minute and try again.';
  }
  if (status === 404) {
    return 'Your key cannot use that Claude model. Reload the page and pick another.';
  }
  if (status === 400 && /credit balance|billing/i.test(detail)) {
    return 'Your Anthropic account has no credit left. Top it up, or switch back to Gemini on step 2.';
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Could not reach Claude. Check your internet connection and try again.';
  }
  if (status >= 500) {
    return 'Anthropic had a server error (' + status + '). It was retried automatically; try again.';
  }
  return 'Claude error: ' + detail;
}
