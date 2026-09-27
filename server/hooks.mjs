// ---------------------------------------------------------------------------
// Other ways to open the video: alternative hooks for the first line, and
// short thumbnail headlines to go with them. One Gemini text request, free
// tier.
//
// The first second decides whether a Short is watched, and the first hook a
// model writes is rarely its best - so the creator gets a handful in
// different styles to choose from. None may give the answer away: a hook
// that names the correct option is dropped, as the thumbnail brief does.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';
import { givesAnswerAway } from './thumbnail-brief.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    hooks: { type: 'ARRAY', items: { type: 'STRING' } },
    headlines: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['hooks', 'headlines'],
};

export const HOOK_SYSTEM = [
  'You write the opening line of a short educational video for electrical engineering students -',
  'the line said in the first two seconds that decides whether anyone keeps watching.',
  '',
  'Write:',
  '- hooks: 4 different opening lines, each in a different style: a question that makes the viewer',
  '  doubt what they know; a bold claim; a surprising everyday consequence; a challenge ("most people',
  '  get this wrong"). At most 14 words each. Spoken English, not a headline.',
  '- headlines: 3 thumbnail headlines, at most 5 words each, with the single most striking word',
  '  wrapped in *asterisks*.',
  '',
  'Rules: never reveal or hint at the correct answer. No emojis. No hashtags. Nothing that has to be',
  'true that you are not sure is true.',
  '',
  'Reply with the JSON object only.',
].join('\n');

export function buildHookRequest(content) {
  const c = content || {};
  const hookLine = (Array.isArray(c.script) ? c.script : []).find((s) => s && s.kind === 'hook');
  return [
    'SUBJECT: ' + (c.subject || ''),
    'TOPIC: ' + (c.topic || ''),
    'QUESTION: ' + (c.question || ''),
    Array.isArray(c.options) && c.options.length ? 'OPTIONS: ' + c.options.join(' | ') : '',
    'THE CURRENT HOOK: ' + ((hookLine && hookLine.narration) || c.hook || '(none)'),
  ].filter(Boolean).join('\n');
}

/** Tidy the reply: short enough, distinct, and none giving the answer away. */
export function tidyHooks(raw, content) {
  const correct = Array.isArray(content?.options) ? [content.options[content.correctIndex]].filter(Boolean) : [];
  const current = String((content?.script || []).find((s) => s && s.kind === 'hook')?.narration || content?.hook || '')
    .trim().toLowerCase();
  const clean = (list, maxWords) => {
    const seen = new Set();
    const out = [];
    for (const item of Array.isArray(list) ? list : []) {
      const s = String(item || '').replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
      if (!s) continue;
      if (s.replace(/\*/g, '').split(/\s+/).length > maxWords) continue;
      if (givesAnswerAway(s.replace(/\*/g, ''), correct)) continue;
      const key = s.toLowerCase();
      if (seen.has(key) || key === current) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  };
  return {
    hooks: clean(raw && raw.hooks, 16),
    headlines: clean(raw && raw.headlines, 6),
  };
}

export async function generateHooks({ apiKey, model, content }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  if (!content || !content.question) throw new Error('Generate a question first.');
  const body = {
    systemInstruction: { parts: [{ text: HOOK_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildHookRequest(content) }] }],
    generationConfig: { temperature: 1.0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model || 'gemini-2.5-flash') + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = (JSON.parse(raw).error || {}).message || ''; } catch { detail = raw.slice(0, 200); }
    if (res.status === 429) throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    throw new Error('Gemini could not write other hooks (' + res.status + '): ' + (detail || 'unknown'));
  }
  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent hooks that could not be read. Try again.');
  }
  return tidyHooks(parsed, content);
}
