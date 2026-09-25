// ---------------------------------------------------------------------------
// Drawing prompts for the scenes no photo can honestly show.
//
// When the script is written, Gemini leaves a scene's photo search empty if no
// real photograph fits it - "why the current lags the voltage" has no stock
// photo, and a misleading one is worse than none. Those scenes used to end up
// with no backdrop at all.
//
// A drawing is not bound by what a camera can capture, so this asks Gemini for
// the other thing: a short description of a picture that CAN be drawn for the
// idea - a metaphor, an apparatus, a process made visible - written from the
// scene's own narration. The style and the "keep the middle clear for text"
// line are still added by images.mjs, so every scene looks like one set.
//
// Two rules are enforced here rather than trusted to the model:
//   - nothing drawn before the answer scene shows the answer;
//   - no words that make an image model paint lettering.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';
import { givesAnswerAway, stripLettering } from './thumbnail-brief.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Long enough to describe one picture; longer and the model starts to paint a comic strip. */
export const PROMPT_LIMIT = 400;
/** One request, however long the explainer: the whole script is context for every scene. */
export const MAX_SCENES = 40;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    prompts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { scene: { type: 'INTEGER' }, prompt: { type: 'STRING' } },
        required: ['scene', 'prompt'],
        propertyOrdering: ['scene', 'prompt'],
      },
    },
  },
  required: ['prompts'],
};

const SYSTEM = [
  'You write prompts for an image model that draws the backdrop behind one scene of a short',
  'educational video. These are scenes where no real photograph fits, so describe something that',
  'can be DRAWN: an apparatus, a process made visible, a clear visual metaphor for the idea.',
  '',
  'For each scene you are asked about, write one prompt:',
  '- One or two sentences, under 60 words, about ONE clear subject tied to what that scene says.',
  '- Concrete and visual: objects, materials, motion, light. "Electrons as glowing beads drifting',
  '  through a copper wire", not "the concept of current".',
  '- No text, letters, numbers, equations, labels, signs or charts with writing in the picture.',
  '- No real, named people; no logos or brands.',
  '- Do not describe an art style or a colour palette - the style is chosen separately and',
  '  added for every scene, so the video looks like one set.',
  '- Scenes marked BEFORE THE ANSWER must not show or hint at which option is correct. Keep them',
  '  about the situation in the question, never its resolution.',
  '',
  'Reply with the JSON object only: {"prompts": [{"scene": <number>, "prompt": "..."}]}.',
].join('\n');

/** Where the answer is revealed. -1 when there is no answer scene (an explainer). */
export function answerSceneIndex(content) {
  return (content && Array.isArray(content.script) ? content.script : []).findIndex((l) => l && l.kind === 'answer');
}

export function buildScenePromptRequest(content, scenes) {
  const script = Array.isArray(content && content.script) ? content.script : [];
  const answerAt = answerSceneIndex(content);
  const wanted = new Set(scenes);
  const lines = [
    'SUBJECT: ' + (content.subject || ''),
    'TOPIC: ' + (content.topic || ''),
  ];
  if (content.question) lines.push('QUESTION: ' + content.question);
  if (Array.isArray(content.options) && content.options.length) {
    lines.push('OPTIONS: ' + content.options.join(' | '));
  }
  lines.push('', 'THE SCRIPT, scene by scene (write prompts only for scenes marked WRITE):');
  script.forEach((line, i) => {
    const said = String((line && (line.narration || line.onScreen)) || '').replace(/\s+/g, ' ').trim();
    const flags = [
      wanted.has(i) ? 'WRITE' : '',
      wanted.has(i) && answerAt >= 0 && i < answerAt ? 'BEFORE THE ANSWER' : '',
    ].filter(Boolean).join(', ');
    lines.push('  scene ' + i + ' [' + (line && line.kind) + ']' + (flags ? ' (' + flags + ')' : '') + ': ' + (said || '(no narration)'));
  });
  lines.push('', 'Return prompts for scenes ' + [...wanted].join(', ') + '.');
  return lines.join('\n');
}

/** A plain prompt from what the video is about, for when a suggestion had to be thrown away. */
function fallbackPrompt(content) {
  const about = [content.topic, content.subject].map((s) => String(s || '').trim()).filter(Boolean);
  return about.length ? 'An evocative, uncluttered scene suggesting ' + about.join(' in ') : '';
}

/**
 * The prompts keyed by scene index, keeping only the scenes that were asked for,
 * with spoilers and lettering taken out. Scenes the model skipped are left out,
 * so the caller can tell them from ones it answered.
 */
export function normalizeScenePrompts(raw, content, scenes) {
  const wanted = new Set(scenes);
  const answerAt = answerSceneIndex(content);
  const correct = Array.isArray(content.options) ? content.options[content.correctIndex] : undefined;
  const prompts = {};
  const notes = [];

  const list = raw && Array.isArray(raw.prompts) ? raw.prompts : [];
  for (const item of list) {
    const scene = Number(item && item.scene);
    if (!Number.isInteger(scene) || !wanted.has(scene) || prompts[scene] !== undefined) continue;
    let prompt = stripLettering(String((item && item.prompt) || '').replace(/[*_`#]/g, ''));
    // Cut an over-long one at a word, not through it.
    if (prompt.length > PROMPT_LIMIT) prompt = prompt.slice(0, PROMPT_LIMIT).replace(/\s\S*$/, '').trim();
    if (!prompt) continue;
    if (answerAt >= 0 && scene < answerAt && correct !== undefined && givesAnswerAway(prompt, [correct])) {
      notes.push('Scene ' + scene + ': the suggested picture gave the answer away, so a plainer one is used.');
      prompt = fallbackPrompt(content);
      if (!prompt) continue;
    }
    prompts[scene] = prompt;
  }
  return { prompts, notes };
}

export async function generateScenePrompts({ apiKey, model, content, scenes }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const script = Array.isArray(content && content.script) ? content.script : [];
  const valid = [...new Set((Array.isArray(scenes) ? scenes : []).map(Number))]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < script.length)
    .slice(0, MAX_SCENES);
  if (!valid.length) throw new Error('There are no scenes to write prompts for.');

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildScenePromptRequest(content, valid) }] }],
    generationConfig: { temperature: 0.8, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
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
    if (res.status === 400 && /API key not valid/i.test(detail)) throw new Error('That Gemini API key was rejected. Check it on the Keys step.');
    if (res.status === 429) throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    throw new Error('Gemini could not write the drawing prompts (' + res.status + '): ' + (detail || 'unknown'));
  }

  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent prompts that could not be read. Try again.');
  }
  const out = normalizeScenePrompts(parsed, content, valid);
  const missing = valid.filter((i) => out.prompts[i] === undefined);
  if (missing.length) out.notes.push('No prompt came back for scene' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + ' - try again for those.');
  return out;
}
