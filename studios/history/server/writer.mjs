// ---------------------------------------------------------------------------
// The story writer.
//
// Two jobs, one output shape:
//
//   writeStory    a topic in, a whole narrated storyboard out
//   directScript  a script the creator wrote in, pictures planned for it -
//                 her words are never changed, only illustrated
//
// Both return scenes of { narration, imagePrompt, effect, motion } plus a
// "style bible" (the recurring cast and setting, so scene 40 draws the same
// girl as scene 2), YouTube copy, and a list of claims worth double-checking.
// ---------------------------------------------------------------------------


const CHAPTER_HINT = 'Empty, unless a new section of the story starts with this scene - then its chapter title, e.g. "Secret #1: The walls". '
  + 'Aim for 4-7 chapters across the video (not counting the opening), never two in a row.';

import { voiceGuide } from './voice-direction.mjs';

export const STOCK_QUERY_HINT = 'A 2-5 word search for a REAL photo or video of this moment on free stock sites and Wikimedia Commons: the place, object, activity or named public figure (e.g. "Taj Mahal sunrise", "clay water pot", "Indian parliament building"). Plain English nouns, no style words.';

export const EFFECTS = ['none', 'heat', 'dust', 'embers', 'rain', 'snow', 'fog', 'flicker', 'breeze'];
export const MOTIONS = ['auto', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'push-rotate', 'drift', 'rack-focus', 'shake', 'whip', 'still'];

export const WORDS_PER_MINUTE = 150;

export const TONES = {
  immersive:
    'Immersive second person. Put the viewer INSIDE the past: "You wake up and the air is already trying to kill you." '
    + 'Present tense, sensory, a little dramatic, then pull back to explain how and why it worked.',
  documentary:
    'Calm, authoritative documentary narrator. Measured and clear, with the occasional vivid image. Third person.',
  storyteller:
    'Warm fireside storyteller. "Imagine…", "Now picture this…". Follows one or two ordinary people through the story.',
  playful:
    'Light, witty and curious. Surprising modern comparisons, gentle humour, never silly about real suffering.',
  witty:
    'Deadpan and witty, like a sharp friend who has read everything. Short punchy sentences, dry understatement, a framing '
    + 'device carried through the whole video (a guest book, a receipt, a court case, a group chat) and a running gag. '
    + 'Every joke still states a real fact. Write so a new picture can land on almost every phrase: concrete nouns, '
    + 'vivid actions. Never mock real suffering.',
};

const SCENE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    narration: { type: 'STRING', description: 'Exactly what the narrator says over this picture. 20-40 words. Plain spoken sentences, no stage directions.' },
    imagePrompt: {
      type: 'STRING',
      description: 'For an illustrator, in English: who is in the frame (named cast from the style bible), what they are doing, where, time of day, framing (wide / medium / close-up), mood. One clear moment. Never any written text or labels in the picture.',
    },
    effect: { type: 'STRING', enum: EFFECTS, description: 'A subtle moving atmosphere that suits the picture, or none. Use sparingly: most scenes are none.' },
    motion: { type: 'STRING', enum: MOTIONS, description: 'Slow camera move over the still picture. auto unless a specific move helps (pan-up to reveal something tall, zoom-in on a detail, shake for an impact, rack-focus for a reveal).' },
    chapter: { type: 'STRING', description: CHAPTER_HINT },
    stockQuery: { type: 'STRING', description: STOCK_QUERY_HINT },
  },
  required: ['narration', 'imagePrompt', 'effect', 'motion', 'chapter', 'stockQuery'],
  propertyOrdering: ['narration', 'imagePrompt', 'effect', 'motion', 'chapter', 'stockQuery'],
};

const COMMON = {
  title: { type: 'STRING', description: 'A curiosity-driven YouTube title, under 70 characters, no clickbait lies.' },
  titleIdeas: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Three alternative titles.' },
  styleBible: {
    type: 'STRING',
    description: 'In English, 2-4 sentences: the recurring characters with names, ages, clothing and one distinctive feature each, plus the setting and colour palette. Every picture prompt is drawn with this, so it keeps the cast looking the same.',
  },
  description: { type: 'STRING', description: 'YouTube description in the narration language: 2 short paragraphs, then 3-5 relevant hashtags on the last line.' },
  tags: { type: 'ARRAY', items: { type: 'STRING' }, description: '10-15 search tags.' },
  factNotes: {
    type: 'ARRAY',
    items: { type: 'STRING' },
    description: 'Claims in the script that are debated, simplified or uncertain, each with a short note - so the creator knows what to double-check before publishing. Empty if none.',
  },
};

export const STORY_SCHEMA = {
  type: 'OBJECT',
  properties: { ...COMMON, scenes: { type: 'ARRAY', items: SCENE_SCHEMA } },
  required: ['title', 'titleIdeas', 'styleBible', 'scenes', 'description', 'tags', 'factNotes'],
  propertyOrdering: ['title', 'titleIdeas', 'styleBible', 'scenes', 'description', 'tags', 'factNotes'],
};

const DIRECT_SCENE = {
  type: 'OBJECT',
  properties: {
    index: { type: 'INTEGER', description: 'The scene number exactly as given, starting at 1.' },
    imagePrompt: SCENE_SCHEMA.properties.imagePrompt,
    effect: SCENE_SCHEMA.properties.effect,
    motion: SCENE_SCHEMA.properties.motion,
    chapter: { type: 'STRING', description: CHAPTER_HINT },
    stockQuery: { type: 'STRING', description: STOCK_QUERY_HINT },
  },
  required: ['index', 'imagePrompt', 'effect', 'motion', 'chapter', 'stockQuery'],
  propertyOrdering: ['index', 'imagePrompt', 'effect', 'motion', 'chapter', 'stockQuery'],
};

export const DIRECT_SCHEMA = {
  type: 'OBJECT',
  properties: { ...COMMON, scenes: { type: 'ARRAY', items: DIRECT_SCENE } },
  required: ['title', 'titleIdeas', 'styleBible', 'scenes', 'description', 'tags', 'factNotes'],
  propertyOrdering: ['title', 'titleIdeas', 'styleBible', 'scenes', 'description', 'tags', 'factNotes'],
};

export const STORY_SYSTEM = [
  'You write narrated, illustrated YouTube explainers about the curious little details of history:',
  'how ordinary people lived, coped, built, ate, cooled their homes, cleaned their teeth.',
  'Each video is a sequence of illustrated scenes; each scene is one picture held while one or two sentences are spoken.',
  '',
  'What makes these videos work:',
  '- A cold open that drops the viewer into a vivid moment, then poses the curious question within the first 20 seconds.',
  '- Then peel the answer back layer by layer - usually 4 to 7 distinct "secrets" or mechanisms - each one concrete,',
  '  with a sensory detail and a modern comparison (temperatures in °C, sizes against familiar things).',
  '- Plain spoken language. Short sentences. Written for the ear, not the page. No lists read aloud, no "firstly".',
  '- Real history. Use what the evidence supports; say "historians think" or "probably" where it is uncertain;',
  '  never present a popular myth as fact. Everything uncertain goes in factNotes too.',
  '- End with a short reflective close that ties back to the opening image. At most one soft line inviting viewers to subscribe.',
  '- Scenes flow: each picture is a different moment or angle, never the same composition twice in a row.',
  '- Picture prompts name the recurring cast from the style bible, so the same people appear across the video.',
  '- Respectful of every culture and of real suffering; nothing gory.',
].join('\n');

export function buildStoryPrompt(o) {
  const minutes = clampNum(o.minutes, 1, 20, 8);
  const words = Math.round(minutes * WORDS_PER_MINUTE);
  const scenes = Math.max(4, Math.round(words / 30));
  const tone = TONES[o.tone] || TONES.immersive;
  const lines = [
    'Topic: ' + String(o.topic || '').trim(),
  ];
  if (String(o.notes || '').trim()) lines.push('Angle, facts to include, or things to avoid (from the creator): ' + String(o.notes).trim());
  lines.push('Audience: ' + (String(o.audience || '').trim() || 'curious adults, no prior knowledge'));
  lines.push('Tone: ' + tone);
  lines.push('Narration language: ' + (o.language || 'English') + '. Picture prompts and the style bible are always in English.');
  lines.push('Picture style the illustrator will use: ' + (o.styleName || 'bold comic illustration') + '. Write prompts that suit it.');
  lines.push('');
  lines.push('Length: about ' + minutes + ' minutes spoken, which is about ' + words + ' words of narration in total,');
  lines.push('across about ' + scenes + ' scenes of 20-40 words each. Hit the length - do not stop early.');
  lines.push('');
  if (o.voiceTags) lines.push(voiceGuide({ tone: o.tone, kind: 'history' }), '');
  lines.push('Return only the JSON object.');
  return lines.join('\n');
}

export const DIRECT_SYSTEM = [
  'You are the art director for a narrated, illustrated YouTube history explainer.',
  'The creator has already written and split the script into numbered scenes. Do NOT change, rewrite or return the narration.',
  'For every scene, plan one picture that shows what is being said at that moment, plus a subtle atmosphere effect and camera move.',
  'Invent a small recurring cast and setting (the style bible) that fits the script, and use those names in the prompts so',
  'the same people appear throughout. Pictures must never contain written text. Also write YouTube copy, and list any',
  'claims in the script that are debated or likely myths in factNotes, so the creator can check them.',
].join('\n');

export function buildDirectPrompt(o) {
  const scenes = (Array.isArray(o.narrations) ? o.narrations : []).map((t, i) => (i + 1) + '. ' + String(t || '').trim());
  return [
    'Working title: ' + (String(o.title || '').trim() || '(none yet - suggest one)'),
    'Narration language: ' + (o.language || 'English') + '. Picture prompts and the style bible are in English.',
    'Picture style the illustrator will use: ' + (o.styleName || 'bold comic illustration') + '.',
    '',
    'There are exactly ' + scenes.length + ' scenes. Return exactly ' + scenes.length + ' scene entries, numbered to match.',
    '',
    scenes.join('\n'),
    '',
    'Return only the JSON object.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Repair: the rest of the app trusts these shapes, so they are enforced here.
// ---------------------------------------------------------------------------

const clean = (v, fallback = '') => {
  const s = typeof v === 'string' ? v : '';
  const out = s.replace(/\*\*/g, '').replace(/[*_`]/g, '').replace(/^#+s*/, '').replace(/\s+/g, ' ').trim();
  return out || fallback;
};

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

const strings = (v, max) => (Array.isArray(v) ? v.map((x) => clean(x)).filter(Boolean).slice(0, max) : []);

function common(c) {
  return {
    title: clean(c.title).slice(0, 100),
    titleIdeas: strings(c.titleIdeas, 5),
    styleBible: clean(c.styleBible).slice(0, 1200),
    description: typeof c.description === 'string' ? c.description.trim().slice(0, 4500) : '',
    tags: strings(c.tags, 20).map((t) => t.replace(/^#/, '')),
    factNotes: strings(c.factNotes, 20),
  };
}

export function normalizeStory(input) {
  const c = input && typeof input === 'object' ? input : {};
  const scenes = (Array.isArray(c.scenes) ? c.scenes : [])
    .map((s) => ({
      narration: clean(s && s.narration),
      imagePrompt: clean(s && s.imagePrompt),
      effect: pick(s && s.effect, EFFECTS, 'none'),
      motion: pick(s && s.motion, MOTIONS, 'auto'),
      chapter: clean(s && s.chapter).slice(0, 60),
      stockQuery: clean(s && s.stockQuery).slice(0, 80),
    }))
    .filter((s) => s.narration);
  if (!scenes.length) throw new Error('The writer returned no scenes. Try again, or try another model.');
  return { ...common(c), scenes };
}

export function normalizeDirect(input, count) {
  const c = input && typeof input === 'object' ? input : {};
  const byIndex = new Map();
  (Array.isArray(c.scenes) ? c.scenes : []).forEach((s, i) => {
    const n = Number.isInteger(s && s.index) ? s.index : i + 1;
    if (!byIndex.has(n)) byIndex.set(n, s);
  });
  // Always exactly one plan per scene, in order. A scene the model skipped
  // gets an empty prompt (the app then draws from its narration) rather than
  // shifting every later picture onto the wrong words.
  const scenes = Array.from({ length: count }, (_, i) => {
    const s = byIndex.get(i + 1) || {};
    return {
      imagePrompt: clean(s.imagePrompt),
      effect: pick(s.effect, EFFECTS, 'none'),
      motion: pick(s.motion, MOTIONS, 'auto'),
      chapter: clean(s.chapter).slice(0, 60),
      stockQuery: clean(s.stockQuery).slice(0, 80),
    };
  });
  return { ...common(c), scenes };
}

// ---------------------------------------------------------------------------
// Callouts and chapters for a finished script
// ---------------------------------------------------------------------------

export const CALLOUT_KINDS = ['label', 'arrow', 'circle', 'date', 'counter', 'thermometer', 'pin', 'route', 'timeline'];

export const CALLOUTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    chapters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scene: { type: 'INTEGER', description: 'Scene number, from 1.' },
          title: { type: 'STRING', description: 'Chapter title, e.g. "Secret #2: Wet reed mats". Short.' },
        },
        required: ['scene', 'title'],
        propertyOrdering: ['scene', 'title'],
      },
    },
    callouts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scene: { type: 'INTEGER', description: 'Scene number, from 1.' },
          kind: { type: 'STRING', enum: CALLOUT_KINDS },
          word: { type: 'STRING', description: 'The exact word (or two) from that scene\'s narration it should appear on, copied letter for letter.' },
          text: { type: 'STRING', description: 'What it says on screen: 1-4 words. For a date stamp, the place and date. Empty for a bare circle.' },
          value: { type: 'NUMBER', description: 'counter/thermometer: the number reached. timeline: the year being talked about (negative = BC). Else 0.' },
          from: { type: 'NUMBER', description: 'counter: start number (usually 0). thermometer: start temperature. timeline: first year of the bar (negative = BC). Else 0.' },
          to: { type: 'NUMBER', description: 'timeline: last year of the bar. Else 0.' },
          unit: { type: 'STRING', description: 'counter/thermometer unit, e.g. "°C", " km", " tonnes". Else empty.' },
        },
        required: ['scene', 'kind', 'word', 'text', 'value', 'from', 'to', 'unit'],
        propertyOrdering: ['scene', 'kind', 'word', 'text', 'value', 'from', 'to', 'unit'],
      },
    },
  },
  required: ['chapters', 'callouts'],
  propertyOrdering: ['chapters', 'callouts'],
};

export const CALLOUTS_SYSTEM = [
  'You are the motion-graphics editor for an illustrated history explainer on YouTube.',
  'Given the numbered narration, choose on-screen callouts that make the story easier to follow and keep the eye busy:',
  '- date stamps when a place and time is first established;',
  '- counters for striking numbers (distances, counts, sizes), thermometers for temperatures;',
  '- labels, arrows and circles to name the thing being explained in the picture (a wind catcher, a clay pot);',
  '- map pins and routes when places or journeys come up; a timeline when the era matters.',
  'About one callout for every two scenes - never clutter, never two in one scene unless they belong together.',
  'The word must be copied exactly from the narration of that scene. Numbers must match what the narration says.',
  'Also split the story into 4-7 chapters (the opening scene needs none) with short, intriguing titles.',
].join('\n');


export function normalizeCallouts(parsed, n) {
  const p = parsed && typeof parsed === 'object' ? parsed : {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    chapters: (Array.isArray(p.chapters) ? p.chapters : [])
      .map((c) => ({ scene: Math.round(num(c && c.scene)), title: clean(c && c.title).slice(0, 60) }))
      .filter((c) => c.scene >= 1 && c.scene <= n && c.title),
    callouts: (Array.isArray(p.callouts) ? p.callouts : [])
      .map((c) => ({
        scene: Math.round(num(c && c.scene)),
        kind: CALLOUT_KINDS.includes(c && c.kind) ? c.kind : 'label',
        word: clean(c && c.word),
        text: clean(c && c.text).slice(0, 40),
        value: num(c && c.value),
        from: num(c && c.from),
        to: num(c && c.to),
        unit: c && typeof c.unit === 'string' ? c.unit.slice(0, 12) : '',
      }))
      .filter((c) => c.scene >= 1 && c.scene <= n && c.word),
  };
}

export const THUMB_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING', description: '2-4 punchy words for the thumbnail, in the video language. Not the title repeated.' },
    highlight: { type: 'STRING', description: 'The one word (or number) from text to paint in a loud colour.' },
  },
  required: ['text', 'highlight'],
  propertyOrdering: ['text', 'highlight'],
};


function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
