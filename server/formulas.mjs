// ---------------------------------------------------------------------------
// Gemini writes the formula card: the formulas a question uses, as a
// revision sheet for the end of the video and the carousel.
//
// Text only, one request, free tier. What it writes is held to the card's
// shape by tidySheet() in src/lib/formula-card.ts, and each card's icon noun
// is turned into a drawing by the same Iconify lookup the explainer panels
// use - so the model names a thing ("ammeter"), never an icon id.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';
import { resolveIcon } from './icons.mjs';
import { GRAPH_KINDS, MAX_CARDS, tidySheet } from '../src/lib/formula-card.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const STRING = { type: 'STRING' };
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: STRING,
    cards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: STRING,
          formula: STRING,
          notes: { type: 'ARRAY', items: STRING },
          graph: {
            type: 'OBJECT',
            properties: {
              kind: { type: 'STRING', enum: [...GRAPH_KINDS] },
              x: STRING, y: STRING, label: STRING, label2: STRING,
            },
            required: ['kind', 'x', 'y', 'label', 'label2'],
          },
          icon: STRING,
        },
        required: ['name', 'formula', 'notes', 'graph', 'icon'],
        propertyOrdering: ['name', 'formula', 'notes', 'graph', 'icon'],
      },
    },
    working: { type: 'ARRAY', items: STRING },
  },
  required: ['title', 'cards', 'working'],
};

export const FORMULA_SYSTEM = [
  'You make the formula card for a short educational video about electrical engineering: a',
  'revision sheet, shown at the end, of the formulas the question uses - the kind of card a student',
  'saves before an exam.',
  '',
  'Write:',
  '- title: the topic and "Important Formulas", e.g. "Alternating Current - Important Formulas".',
  '- cards: 2 to ' + MAX_CARDS + ' formulas, in the order the solution uses them. Only formulas the',
  '  question actually needs, or the one or two it rests on. Never a formula the question does not use.',
  'For each card:',
  '- name: what the formula gives, in title case, e.g. "RMS Voltage". At most 40 characters.',
  '- formula: the formula in LaTeX, using only: letters and numbers, = + - / ( ), _ and ^ with braces',
  '  for more than one character (V_{rms}, I_0^2), \\frac{a}{b}, \\sqrt{x}, \\sin \\cos \\tan \\log \\ln,',
  '  Greek letters (\\omega \\phi \\theta \\pi \\Omega \\Delta), \\cdot \\times \\approx, and \\text{...}.',
  '  Symbols, not words: "V_{rms} = \\frac{V_0}{\\sqrt{2}}", not "RMS voltage = peak / root 2". At most',
  '  110 characters. The general formula, not the question\'s numbers.',
  '- notes: zero to two short lines saying what a symbol means, in the form "f = Frequency (Hz)" -',
  '  only symbols a student might not know. Plain text, no LaTeX.',
  '- graph: a small picture of what the formula means, or kind "none". Choose from:',
  '  sine (a sine wave; label = its peak, e.g. "V_0"), rms (a sine wave and its RMS level; label = the',
  '  RMS symbol, label2 = the peak), phasor (a phasor turning at omega; label = "\\omega", label2 = the',
  '  angle), phase-shift (voltage and current out of phase; label = the first wave, label2 = the',
  '  second), power-triangle (P, Q and S; label = the angle, e.g. "\\phi"), linear (one quantity',
  '  proportional to another; label = the slope, e.g. "R"), inverse (falls as one over the other),',
  '  exp-rise (charging towards a final value; label = the final value), exp-decay (discharging).',
  '  x and y are the axis symbols, e.g. "t" and "v". Use a graph only when it truly shows the',
  '  formula; "none" is better than a picture that does not fit.',
  '- icon: one plain noun for a small picture beside the card - a thing, never an idea: "light',
  '  bulb", "ammeter", "multimeter", "gear", "power button", "battery", "transformer", "magnet".',
  '',
  'Also write working: THIS question\'s solution, 2 to 5 lines in the same LaTeX, written out the',
  'way a teacher does on the board - the formula, then the question\'s numbers put in, then each',
  'simplification, ending with the answer and its unit. Every line after the first starts with "=".',
  'e.g. "V_{rms} = \\frac{V_0}{\\sqrt{2}}", "= \\frac{325}{\\sqrt{2}}", "= \\frac{325}{1.414}", "= 230\\,V".',
  'The numbers must be right and must reach the correct answer. For a question with no',
  'calculation, an empty list.',
  '',
  'Reply with the JSON object only.',
].join('\n');

/** What the model is told about the question: everything that says which formulas it used. */
export function buildFormulaRequest(content) {
  const c = content || {};
  const lines = ['SUBJECT: ' + (c.subject || ''), 'TOPIC: ' + (c.topic || '')];
  if (c.question) lines.push('QUESTION: ' + c.question);
  if (Array.isArray(c.options) && c.options.length) {
    lines.push('OPTIONS: ' + c.options.join(' | '));
    if (Number.isInteger(c.correctIndex) && c.options[c.correctIndex] !== undefined) {
      lines.push('CORRECT: ' + c.options[c.correctIndex]);
    }
  }
  if (c.answerLine) lines.push('ANSWER: ' + c.answerLine);
  const steps = Array.isArray(c.explanation) ? c.explanation.filter(Boolean) : [];
  if (steps.length) lines.push('WORKING: ' + steps.join(' / '));
  // Formulas the script already shows on screen are the strongest hint of all.
  const shown = (Array.isArray(c.script) ? c.script : [])
    .map((s) => s && s.visual && s.visual.kind === 'formula' && s.visual.formula)
    .filter(Boolean);
  if (shown.length) lines.push('FORMULAS SHOWN IN THE VIDEO: ' + shown.join(' / '));
  const said = (Array.isArray(c.script) ? c.script : [])
    .filter((s) => s && (s.kind === 'explain' || s.kind === 'answer') && s.narration)
    .map((s) => s.narration);
  if (said.length) lines.push('THE EXPLANATION, AS SPOKEN: ' + said.join(' '));
  return lines.join('\n');
}

/**
 * Give each card its icon's drawing, in place. A card whose noun finds
 * nothing simply has no icon; it is never an error.
 */
export async function attachFormulaIcons(sheet, { root }) {
  const cache = {};
  let resolved = 0;
  for (const card of sheet.cards) {
    if (!card.icon || (card.art && card.art.body)) continue;
    // A card with no icon breaks the column of icons down the sheet, so a
    // noun that finds nothing ("multimeter") tries its last word, then a
    // plain lightning bolt, which every electrical card can wear.
    const words = card.icon.trim().split(/\s+/);
    const tries = [card.icon, words.length > 1 ? words[words.length - 1] : '', 'lightning bolt'].filter(Boolean);
    let icon = null;
    for (const noun of tries) {
      icon = await resolveIcon(noun, { root, cache });
      if (icon) break;
    }
    if (!icon) continue;
    card.art = { body: icon.body, width: icon.width, height: icon.height };
    resolved++;
  }
  return resolved;
}

export async function generateFormulaSheet({ apiKey, model, content, root }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  if (!content || !content.question) throw new Error('Generate a question before writing its formula card.');

  const body = {
    systemInstruction: { parts: [{ text: FORMULA_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildFormulaRequest(content) }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
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
    throw new Error('Gemini could not write the formula card (' + res.status + '): ' + (detail || 'unknown'));
  }

  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent a formula card that could not be read. Try again.');
  }
  const sheet = tidySheet(parsed);
  if (!sheet) throw new Error('Gemini wrote no usable formulas for this question. Try again, or add them by hand.');
  if (root) await attachFormulaIcons(sheet, { root });
  return sheet;
}
