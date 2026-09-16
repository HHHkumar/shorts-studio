// ---------------------------------------------------------------------------
// A thumbnail designed by Gemini.
//
// Two calls, split on purpose:
//
//   1. the brief - Gemini reads the chosen title and description and decides
//      the headline, the one word to colour, the layout, and the picture
//      behind it. Text only, so it costs next to nothing and can be re-rolled.
//   2. the art - Gemini's image model paints that picture, with NO words in it.
//
// The words are then set by Remotion on top, not painted by the image model.
// Image models still misspell, invent letters and smear small type, and a
// thumbnail whose headline says "Tranformer" is worse than no thumbnail. Set as
// real type the headline is always spelled right, always in the channel's
// fonts, and can be edited without paying for the picture again.
//
// The one rule the brief must never break: a quiz thumbnail does not give the
// answer away. Which option is correct is never sent, and a suggestion that
// repeats the correct option anyway is taken back out here.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const THUMBNAIL_LAYOUTS = ['statement', 'question', 'number', 'split'];

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    accentWord: { type: 'STRING' },
    kicker: { type: 'STRING' },
    badge: { type: 'STRING' },
    layout: { type: 'STRING', enum: THUMBNAIL_LAYOUTS },
    figure: { type: 'STRING' },
    symbol: { type: 'STRING' },
    scene: { type: 'STRING' },
  },
  required: ['headline', 'accentWord', 'kicker', 'badge', 'layout', 'figure', 'symbol', 'scene'],
  propertyOrdering: ['headline', 'accentWord', 'kicker', 'badge', 'layout', 'figure', 'symbol', 'scene'],
};

const SYSTEM = [
  'You art-direct thumbnails for an educational channel. A thumbnail is seen about 200 pixels',
  'wide, among thirty others, for a fifth of a second. It has to stop the scroll and be true.',
  '',
  'headline: 2 to 5 words. Punchy, curiosity-driven, readable at a glance. Built from the title,',
  '  not a copy of it. Never the answer to the question. No ALL CAPS, no emoji, no hashtags.',
  'accentWord: the single word of the headline that carries the hook - copied exactly from it.',
  'kicker: 1 to 3 words above the headline - the subject or the exam. May be empty.',
  'badge: a very short corner tag such as the exam name ("GATE EE", "SSC CGL"), or empty.',
  'layout: "question" when the headline asks something; "number" when one striking figure from',
  '  the QUESTION (never the answer) carries it; "split" when one emoji says the topic; else',
  '  "statement".',
  'figure: only for "number" - at most 6 characters, taken from the question. Otherwise empty.',
  'symbol: exactly one emoji for the topic.',
  'scene: the picture behind the words, for an image model. One bold, instantly recognisable',
  '  subject tied to the topic (a glowing transformer core, a speeding train, a stack of coins),',
  '  dramatic lighting, strong colour contrast, a sense of energy or tension. Describe the subject',
  '  and mood only, in one or two sentences. Never ask for words, numbers, labels or diagrams',
  '  with writing on them, and never show the answer.',
  '',
  'Reply with the JSON object only.',
].join('\n');

export function buildBriefPrompt({ content = {}, title = '', description = '', shape = 'landscape' } = {}) {
  const lines = [
    'Design a ' + (shape === 'portrait' ? '9:16 Shorts / Reels cover' : '16:9 YouTube thumbnail') + '.',
    '',
    'TITLE: ' + (title || content.question || ''),
  ];
  if (description) lines.push('DESCRIPTION: ' + String(description).slice(0, 1200));
  lines.push('SUBJECT: ' + (content.subject || ''));
  lines.push('TOPIC: ' + (content.topic || ''));
  if (content.question) lines.push('QUESTION IN THE VIDEO: ' + content.question);
  // The options are sent so Gemini knows what NOT to put on the cover. Which
  // one is correct is deliberately not.
  if (Array.isArray(content.options) && content.options.length) {
    lines.push('ANSWER OPTIONS (never show any of these): ' + content.options.join(' | '));
  }
  lines.push('');
  lines.push('Return the JSON object only.');
  return lines.join('\n');
}

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Lower case, letters and digits only - for asking whether two bits of text say the same thing. */
const bare = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}.]/gu, '');

/** True when `text` repeats an answer option, which would give the quiz away. */
export function givesAnswerAway(text, options) {
  const t = bare(text);
  if (!t) return false;
  return (Array.isArray(options) ? options : []).some((o) => {
    const opt = bare(o);
    // Short options ("A", "2") match inside almost anything, so only a whole match counts.
    if (!opt) return false;
    return opt.length <= 2 ? t === opt : t.includes(opt);
  });
}

const EMOJI = /\p{Extended_Pictographic}/u;

/** Wrap the accent word in *asterisks* - the Thumbnail composition's own markup. */
export function markAccent(headline, accentWord) {
  const word = clean(accentWord, 40);
  if (!word) return headline;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')(?=$|[^\\p{L}\\p{N}])', 'iu');
  return re.test(headline) ? headline.replace(re, (_, before, found) => before + '*' + found + '*') : headline;
}

/** Words that make an image model draw lettering, however politely they are asked not to. */
const TEXT_WORDS = /\b(text|words?|letters?|lettering|labels?|captions?|titles?|headlines?|typography|written|writing|numbers?|digits?|signs?)\b/gi;

export function normalizeBrief(raw, content = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  // Only the correct option is a spoiler. Naming a wrong one is just part of the question.
  const options = Array.isArray(content.options) && content.options[content.correctIndex] !== undefined
    ? [content.options[content.correctIndex]] : [];
  const notes = [];

  let headline = clean(r.headline, 60);
  if (!headline || givesAnswerAway(headline, options)) {
    if (headline) notes.push('The suggested headline gave the answer away, so the hook is used instead.');
    headline = clean(content.hook || content.topic || content.question, 60);
  }
  // The composition caps nothing, and past six words nothing reads at feed size.
  const words = headline.split(' ');
  if (words.length > 6) headline = words.slice(0, 6).join(' ');

  let layout = THUMBNAIL_LAYOUTS.includes(r.layout) ? r.layout : 'statement';
  let figure = clean(r.figure, 8);
  if (figure && givesAnswerAway(figure, options)) {
    notes.push('The suggested figure was the answer, so it was left off.');
    figure = '';
  }
  if (layout === 'number' && !figure) layout = 'statement';
  if (layout !== 'number') figure = '';

  const symbolRaw = typeof r.symbol === 'string' ? r.symbol.trim() : '';
  const symbol = EMOJI.test(symbolRaw) ? [...new Intl.Segmenter().segment(symbolRaw)][0].segment : '';
  if (layout === 'split' && !symbol) layout = 'statement';

  let kicker = clean(r.kicker, 28);
  if (givesAnswerAway(kicker, options)) kicker = '';
  let badge = clean(r.badge, 14);
  if (givesAnswerAway(badge, options)) badge = '';

  let scene = clean(r.scene, 600).replace(TEXT_WORDS, '').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  if (!scene) scene = 'a bold dramatic image about ' + (content.topic || content.subject || 'the topic');

  return {
    title: markAccent(headline, r.accentWord),
    kicker,
    badge,
    layout,
    figure,
    symbol,
    scene,
    notes,
  };
}

/**
 * The prompt the image model actually gets: the scene, where to put it so the
 * headline has somewhere to sit, and the no-lettering rule said as plainly as
 * it can be.
 */
export function buildArtPrompt({ scene, shape = 'landscape', accent = '' } = {}) {
  const portrait = shape === 'portrait';
  const colour = /^#[0-9a-f]{6}$/i.test(accent) ? ' Let ' + accent + ' be the dominant accent colour of the light.' : '';
  return [
    'Eye-catching thumbnail background art: ' + String(scene || '').trim().replace(/\.?$/, '.'),
    'Bold saturated colour, dramatic rim lighting, high contrast, crisp focus on one hero subject,',
    'cinematic depth, a feeling of energy.' + colour,
    portrait
      ? 'Composition: the hero subject fills the lower half of a tall 9:16 frame; the top half is calm, darker, uncluttered negative space.'
      : 'Composition: the hero subject sits in the right third of a wide 16:9 frame; the left half is calm, darker, uncluttered negative space.',
    'Absolutely no text, letters, numbers, symbols, logos, watermarks, captions or user-interface elements anywhere in the image.',
  ].join(' ');
}

export async function generateThumbnailBrief({ apiKey, model, content, title, description, shape }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildBriefPrompt({ content, title, description, shape }) }] }],
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
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
    throw new Error('Gemini could not design the thumbnail (' + res.status + '): ' + (detail || 'unknown'));
  }

  let parsed = null;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent a thumbnail design that could not be read. Try again.');
  }
  return normalizeBrief(parsed, content);
}
