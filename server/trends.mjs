// ---------------------------------------------------------------------------
// "What is worth making a video about right now?"
//
// Uses Gemini's Google Search grounding, so the model actually searches the
// live web rather than answering from a training cut-off. That means no extra
// API key: the Gemini key you already have does it.
//
// Grounding cannot be combined with a strict responseSchema, so this asks for
// JSON in the text and parses it defensively. It is a discovery step only -
// once you pick a topic, the normal generator takes over with its schema
// intact.
// ---------------------------------------------------------------------------

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

import { fetchRetrying } from './retry.mjs';

const SYSTEM = [
  'You find topics that are genuinely being talked about right now, and judge which of them would',
  'make a good short quiz or explainer video.',
  '',
  'Search the web before answering. Do not answer from memory - recency is the entire point.',
  '',
  'A good candidate has all of these:',
  '- People are actively discussing it this week or this month, not five years ago.',
  '- There is a real, checkable fact at the centre of it. Not an opinion, not a prediction.',
  '- It contains something counter-intuitive, or a number most people would guess wrong.',
  '- It can be explained honestly in under a minute.',
  '',
  'Reject: pure opinion pieces, celebrity news, anything political, anything where the interesting',
  'claim is still disputed, and evergreen textbook topics that are not actually trending.',
  '',
  'Reply with a JSON array and nothing else. Exactly this shape:',
  '[',
  '  {',
  '    "topic": "a specific searchable topic, 3-8 words",',
  '    "why": "one sentence on why it is being talked about right now",',
  '    "angle": "the counter-intuitive question or fact a video should be built around",',
  '    "heat": 1-10, how strongly it is trending',
  '  }',
  ']',
  '',
  '"topic" goes straight into a video generator as the subject, so make it concrete and specific.',
  'Return 8 items, most strongly trending first.',
].join('\n');

function buildPrompt(o) {
  const lines = [];
  const electrical = o.contentType === 'electrical';

  lines.push('Find 8 topics worth making a video about right now.');
  lines.push('');

  if (electrical) {
    lines.push('Domain: electrical engineering, power systems and energy.');
    if (o.subject) lines.push('Bias towards this area if anything current fits it: ' + o.subject + '.');
    lines.push('Good sources of movement here: grid incidents and blackouts, new generation capacity,');
    lines.push('battery storage, renewable integration, transmission projects, standards changes,');
    lines.push('EV charging infrastructure, and notable equipment failures.');
    if (o.exam) lines.push('The audience is: ' + o.exam + '.');
  } else {
    lines.push('Domain: science, technology, maths and engineering.');
    if (o.subject) lines.push('Bias towards ' + o.subject + ' if anything current fits it.');
    lines.push('Good sources of movement here: new research results, space missions, health findings,');
    lines.push('AI and computing, climate and environment, and surprising records or measurements.');
  }

  if (o.region) lines.push('Weight towards what is being discussed in ' + o.region + ' where relevant.');
  lines.push('');
  lines.push('Search first. Then return the JSON array.');
  return lines.join('\n');
}

export async function findTrending(apiKey, model, options = {}) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(options) }] }],
    // This is what makes it search rather than recall.
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.5, topP: 0.95 },
  };

  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Gemini sent back something that was not JSON. Try again.');
  }

  const candidate = payload.candidates && payload.candidates[0];
  if (!candidate) {
    const blocked = payload.promptFeedback && payload.promptFeedback.blockReason;
    throw new Error(blocked
      ? 'Gemini refused this search (' + blocked + '). Try a different area.'
      : 'Gemini returned no results. Try again.');
  }

  const text = ((candidate.content && candidate.content.parts) || [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  const items = normalizeItems(parseLoose(text));
  if (!items.length) {
    throw new Error('Nothing usable came back. Try again, or pick a different subject.');
  }

  return { items, sources: extractSources(candidate), searches: extractSearches(candidate) };
}

/** The model may wrap its array in prose or a code fence. */
function parseLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return [];
    }
  }
}

const clean = (v, max = 200) =>
  (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim().slice(0, max);

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item && typeof item === 'object' ? item : {};
      let heat = Number(o.heat);
      if (!Number.isFinite(heat)) heat = 5;
      return {
        topic: clean(o.topic, 90),
        why: clean(o.why, 220),
        angle: clean(o.angle, 220),
        heat: Math.max(1, Math.min(10, Math.round(heat))),
      };
    })
    .filter((i) => i.topic)
    .slice(0, 10);
}

/** The pages Gemini actually consulted, so a claim can be checked. */
function extractSources(candidate) {
  const meta = candidate.groundingMetadata || {};
  const chunks = meta.groundingChunks || [];
  const seen = new Set();
  return chunks
    .map((c) => c && c.web)
    .filter(Boolean)
    .map((w) => ({ title: clean(w.title, 120) || w.uri, uri: w.uri }))
    .filter((s) => s.uri && !seen.has(s.uri) && seen.add(s.uri))
    .slice(0, 8);
}

function extractSearches(candidate) {
  const meta = candidate.groundingMetadata || {};
  return (meta.webSearchQueries || []).map((q) => clean(q, 80)).filter(Boolean).slice(0, 6);
}

function explainError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.error && j.error.message) || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }

  // The usual cause of a 400 here is a model that cannot search.
  if (status === 400 && /tool|search|function/i.test(detail)) {
    return 'This Gemini model cannot search the web. Pick a 2.5 model (Flash or Pro) in the model '
      + 'dropdown and try again.';
  }
  if (status === 400 && /API key not valid/i.test(detail)) {
    return 'That Gemini API key was rejected. Check for stray spaces and paste it again.';
  }
  if (status === 403) return 'Gemini refused the key (403). Make sure the Generative Language API is enabled.';
  if (status === 404) return 'Your key cannot use that model. Reload the page and pick another.';
  if (status === 429) return 'Gemini rate limit hit. Wait about a minute and try again.';
  if (status === 503) {
    return 'Google’s servers are busy, and the tool already retried three times. Wait a few seconds, '
      + 'or switch to a Flash model.';
  }
  if (status >= 500) return 'Google had a server error (' + status + '). It was retried automatically.';
  return 'Gemini error ' + status + ': ' + (detail || 'unknown');
}
