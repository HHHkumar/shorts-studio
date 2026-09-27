// ---------------------------------------------------------------------------
// A video in another language: the same question, script and formula card,
// translated - the maths, the circuit, the look and the scene structure left
// exactly as they are. One Gemini text request, free tier.
//
// What is sent is only what is read or heard; what comes back is merged into
// a copy of the video field by field and scene by scene, so a reply that
// drops a scene or reorders the options cannot scramble the video - anything
// missing keeps its original words. Formulas are never translated: V_{rms} is
// V_{rms} in every language.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

import { LANGUAGES } from '../src/lib/languages.ts';

export { LANGUAGES };

const STR = { type: 'STRING' };
const LIST = { type: 'ARRAY', items: STR };
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    question: STR, options: LIST, answerLine: STR, explanation: LIST, funFact: STR, outro: STR, hook: STR,
    narrations: LIST, onScreens: LIST,
    formulaTitle: STR, formulaNames: LIST, formulaNotes: { type: 'ARRAY', items: LIST },
  },
  required: ['question', 'options', 'answerLine', 'explanation', 'funFact', 'outro', 'hook', 'narrations', 'onScreens'],
};

export function translateSystem(language) {
  return [
    'You translate a short educational video about electrical engineering into ' + language + '.',
    'It is spoken aloud by a voice and read on screen by students preparing for Indian exams.',
    '',
    'Rules:',
    '- Natural, spoken ' + language + ' as an Indian engineering teacher says it - not a word-for-word',
    '  rendering. Keep the technical terms students use in class; where English terms are normal in',
    '  ' + language + ' teaching (voltage, current, RMS, transformer), keep them, in ' + language + ' script.',
    '- Keep every number, unit and symbol exactly: 325 V stays 325 V.',
    '- Return every list with exactly as many entries as it was given, in the same order - one',
    '  narration per scene, even an empty one; one option per option.',
    '- Never change which option is correct, and never add or remove information.',
    '',
    'Reply with the JSON object only.',
  ].join('\n');
}

/** What is sent to be translated: only words a viewer reads or hears. */
export function translationRequest(content) {
  const c = content || {};
  const sheet = c.formulas && Array.isArray(c.formulas.cards) ? c.formulas : null;
  return JSON.stringify({
    question: c.question || '',
    options: c.options || [],
    answerLine: c.answerLine || '',
    explanation: c.explanation || [],
    funFact: c.funFact || '',
    outro: c.outro || '',
    hook: c.hook || '',
    narrations: (c.script || []).map((s) => s.narration || ''),
    onScreens: (c.script || []).map((s) => s.onScreen || ''),
    ...(sheet ? {
      formulaTitle: sheet.title || '',
      formulaNames: sheet.cards.map((k) => k.name || ''),
      formulaNotes: sheet.cards.map((k) => k.notes || []),
    } : {}),
  });
}

const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const sameLength = (list, original) => Array.isArray(list) && list.length === original.length;

/**
 * The translated video: a copy of `content` with the reply's words put in.
 * Anything missing, or a list of the wrong length, keeps the original.
 */
export function mergeTranslation(content, reply, language) {
  const r = reply && typeof reply === 'object' ? reply : {};
  const c = content;
  const script = (c.script || []).map((line, i) => ({
    ...line,
    narration: sameLength(r.narrations, c.script) ? String(r.narrations[i] ?? line.narration) : line.narration,
    onScreen: sameLength(r.onScreens, c.script) ? String(r.onScreens[i] ?? line.onScreen ?? '') : line.onScreen,
  }));
  const options = sameLength(r.options, c.options || []) ? r.options.map(String) : c.options;
  let formulas = c.formulas;
  if (formulas && Array.isArray(formulas.cards)) {
    formulas = {
      ...formulas,
      title: str(r.formulaTitle, formulas.title),
      cards: formulas.cards.map((card, i) => ({
        ...card,
        name: sameLength(r.formulaNames, formulas.cards) ? str(r.formulaNames[i], card.name) : card.name,
        notes: sameLength(r.formulaNotes, formulas.cards) && Array.isArray(r.formulaNotes[i])
          ? r.formulaNotes[i].map(String) : card.notes,
      })),
    };
  }
  return {
    ...c,
    question: str(r.question, c.question),
    options,
    answerLine: str(r.answerLine, c.answerLine),
    explanation: sameLength(r.explanation, c.explanation || []) ? r.explanation.map(String) : c.explanation,
    funFact: str(r.funFact, c.funFact),
    outro: str(r.outro, c.outro),
    hook: str(r.hook, c.hook),
    script,
    ...(formulas ? { formulas } : {}),
    language,
  };
}

export async function translateContent({ apiKey, model, content, language }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  if (!LANGUAGES.includes(language)) throw new Error('Choose a language to translate into.');
  if (!content || !Array.isArray(content.script)) throw new Error('There is no video to translate.');
  const body = {
    systemInstruction: { parts: [{ text: translateSystem(language) }] },
    contents: [{ role: 'user', parts: [{ text: translationRequest(content) }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
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
    throw new Error('Gemini could not translate the video (' + res.status + '): ' + (detail || 'unknown'));
  }
  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent a translation that could not be read. Try again.');
  }
  return mergeTranslation(content, parsed, language);
}
