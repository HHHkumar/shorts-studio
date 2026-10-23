// ---------------------------------------------------------------------------
// Every AI job in the studio, defined once.
//
// A task is { system, prompt, schema, normalize, images? }. It can be run two ways:
//
//   runTask      through an API key (Gemini or Claude), with the schema enforced
//   chatPrompt   as one block of text to paste into ANY chatbot - the Gemini app,
//                ChatGPT, Claude.ai - for when the API credits run out.
//                importReply then reads the reply back through the SAME
//                normalizer, so a pasted answer is treated exactly like an API one.
// ---------------------------------------------------------------------------

import { callModel, parseJsonLoosely } from './gemini.mjs';
import * as W from './writer.mjs';
import * as F from './flow.mjs';
import { readMedia } from './projects.mjs';
import { storyboardTask } from './storyboard.mjs';
import { directVoiceTask } from './voice-direction.mjs';
import { buildNewsPrompt, NEWS_SCHEMA, NEWS_SYSTEM, normalizeNews } from './news-writer.mjs';

const clean = (v) => (typeof v === 'string' ? v : '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const strip = (prompt) => prompt.replace(/\n*Return only the JSON object\.\s*$/, '');

export const ELEMENT_KINDS = ['smoke', 'steam', 'fire', 'glow', 'birds', 'clouds', 'sunrays', 'shimmer', 'ripples', 'leaves', 'fireflies', 'sand'];

const ELEMENTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    elements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ELEMENT_KINDS },
          x: { type: 'INTEGER', description: 'Across the picture, 0 (left edge) to 1000 (right edge).' },
          y: { type: 'INTEGER', description: 'Down the picture, 0 (top edge) to 1000 (bottom edge).' },
          size: { type: 'INTEGER', description: 'How big, in the same units as x (e.g. 120 = 12% of the picture width).' },
          intensity: { type: 'NUMBER', description: '0.3 subtle to 1.5 strong. Usually 0.6-1.' },
          angle: { type: 'INTEGER', description: 'Direction of travel in degrees for birds, sand and leaves (0 = to the right, 180 = to the left). Else 0.' },
          why: { type: 'STRING', description: 'What in the picture it belongs to, in a few words.' },
        },
        required: ['kind', 'x', 'y', 'size', 'intensity', 'angle', 'why'],
        propertyOrdering: ['kind', 'x', 'y', 'size', 'intensity', 'angle', 'why'],
      },
    },
    horizon: { type: 'INTEGER', description: 'If this is an outdoor scene with a clear horizon and open foreground, the y (0-1000) of the horizon line; otherwise -1.' },
    effect: { type: 'STRING', enum: W.EFFECTS, description: 'The one whole-picture atmosphere that suits it best, or none.' },
  },
  required: ['elements', 'horizon', 'effect'],
  propertyOrdering: ['elements', 'horizon', 'effect'],
};

const ELEMENTS_SYSTEM = [
  'You are a motion designer bringing a still illustration to life for a history documentary, with small animated elements:',
  '- smoke: rises from a chimney, forge, fire pit or incense. Place it exactly at the TOP of the source.',
  '- steam: light and quick, from a pot, bath or wet hot surface. At the top of the source.',
  '- fire: a small flickering flame for torches, lamps, hearths. At the base of the flame.',
  '- glow: warm flickering light around a lamp, candle, window or fire. Centred on the light.',
  '- birds: a small flock crossing open sky. In empty sky, with the direction they fly.',
  '- clouds: soft clouds drifting in open sky, near the top.',
  '- sunrays: beams from the sun or a bright window. At the light source.',
  '- shimmer: glints on water (river, pool, sea). Centred on the water, size = its width.',
  '- ripples: rings on still water. On the water.',
  '- leaves: leaves or petals drifting down from a tree. At the canopy.',
  '- fireflies: glowing specks at dusk or night, in gardens or fields.',
  '- sand: wind-blown sand streaks along desert ground.',
  'Choose 0 to 5 elements, ONLY where the picture actually shows their source. Fewer and well placed beats many.',
  'Never put anything over a face or the main subject. Coordinates are on a 0-1000 grid over the picture.',
].join('\n');

export const TASKS = {
  /** A news explainer: from a research brief through a key, or researched by the chatbot itself. */
  news(o) {
    if (!clean(o.story)) throw new Error('Type the news story first.');
    const given = o.brief && Array.isArray(o.sources) ? o.sources : [];
    return {
      system: NEWS_SYSTEM,
      prompt: buildNewsPrompt(o),
      schema: NEWS_SCHEMA,
      temperature: 0.5,
      label: 'news',
      normalize: (p) => normalizeNews(p, given),
    };
  },

  story(o) {
    if (!clean(o.topic)) throw new Error('Type a topic first.');
    return { system: W.STORY_SYSTEM, prompt: W.buildStoryPrompt(o), schema: W.STORY_SCHEMA, temperature: 0.85, label: 'story', normalize: (p) => W.normalizeStory(p) };
  },

  direct(o) {
    const n = Array.isArray(o.narrations) ? o.narrations.length : 0;
    if (!n) throw new Error('There are no scenes to plan pictures for yet.');
    return { system: W.DIRECT_SYSTEM, prompt: W.buildDirectPrompt(o), schema: W.DIRECT_SCHEMA, temperature: 0.7, label: 'direct', normalize: (p) => W.normalizeDirect(p, n) };
  },

  callouts(o) {
    const list = (Array.isArray(o.narrations) ? o.narrations : []).map((t, i) => (i + 1) + '. ' + clean(t));
    if (!list.length) throw new Error('There is no script yet.');
    return {
      system: W.CALLOUTS_SYSTEM,
      prompt: 'Video: ' + (o.title || '(untitled)') + '\n\n' + list.join('\n') + '\n\nReturn only the JSON object.',
      schema: W.CALLOUTS_SCHEMA,
      temperature: 0.5,
      label: 'callouts',
      normalize: (p) => W.normalizeCallouts(p, list.length),
    };
  },

  motion(o) {
    const list = (Array.isArray(o.shots) ? o.shots : []).slice(0, 80);
    if (!list.length) throw new Error('Tick at least one shot to animate first.');
    const lines = list.map((s) => [
      'Shot ' + s.label + ':',
      '  Narration over it: ' + clean(s.narration),
      '  The picture shows: ' + (clean(s.picture) || '(see narration)'),
      s.camera ? '  Wanted camera move: ' + clean(s.camera) : '',
      s.atmosphere ? '  Atmosphere: ' + clean(s.atmosphere) : '',
    ].filter(Boolean).join('\n'));
    const wanted = new Set(list.map((s) => String(s.label)));
    return {
      system: F.MOTION_SYSTEM,
      prompt: 'Art style of the pictures: ' + (o.styleName || 'illustration') + '\n\n' + lines.join('\n\n') + '\n\nReturn only the JSON object.',
      schema: F.MOTION_SCHEMA,
      temperature: 0.7,
      label: 'motion',
      normalize: (p) => ({
        shots: (Array.isArray(p.shots) ? p.shots : [])
          .map((s) => ({ label: clean(s && String(s.label)), prompt: clean(s && s.prompt) }))
          .filter((s) => wanted.has(s.label) && s.prompt),
      }),
    };
  },

  music(o) {
    const list = (Array.isArray(o.sections) ? o.sections : []).slice(0, 20);
    if (!list.length) throw new Error('There are no sections to write music for.');
    const lines = list.map((s) => 'Section "' + s.label + '" - ' + clean(s.title) + ' - length ' + clean(s.length) + '\n  What is said: ' + clean(s.summary).slice(0, 700));
    const wanted = new Set(list.map((s) => String(s.label)));
    return {
      system: F.MUSIC_SYSTEM,
      prompt: 'Video: ' + (o.title || '(untitled)') + '\n\n' + lines.join('\n\n') + '\n\nReturn only the JSON object.',
      schema: F.MUSIC_SCHEMA,
      temperature: 0.8,
      label: 'music',
      normalize: (p) => ({
        sections: (Array.isArray(p.sections) ? p.sections : [])
          .map((s) => ({ label: clean(s && s.label), prompt: clean(s && s.prompt) }))
          .filter((s) => wanted.has(s.label) && s.prompt),
      }),
    };
  },

  thumbnail(o) {
    return {
      system: 'You write YouTube thumbnail text for curiosity-driven history explainers: 2-4 huge words that make people need to know, complementing (never repeating) the title.',
      prompt: 'Title: ' + (o.title || '') + '\nTopic: ' + (o.topic || '') + '\nReturn only the JSON object.',
      schema: W.THUMB_SCHEMA,
      temperature: 0.9,
      label: 'thumbnail',
      normalize: (p) => ({ text: clean(p.text).slice(0, 40), highlight: clean(p.highlight).slice(0, 20) }),
    };
  },

  storyboard: storyboardTask,
  voice: directVoiceTask,

  elements(o) {
    const bytes = o.image ? readMedia(o.image) : null;
    return {
      system: ELEMENTS_SYSTEM,
      prompt: [
        'The attached picture is one shot of the video.',
        o.picture ? 'It was drawn from this description: ' + clean(o.picture) : '',
        o.narration ? 'Narration over it: ' + clean(o.narration) : '',
        '',
        'Return only the JSON object.',
      ].filter((l) => l !== '').join('\n'),
      schema: ELEMENTS_SCHEMA,
      temperature: 0.3,
      label: 'elements',
      // Through the API the picture is sent; in a chatbot she attaches it.
      images: bytes ? [{ mimeType: /\.png$/i.test(o.image) ? 'image/png' : 'image/jpeg', base64: bytes.toString('base64') }] : [],
      needsPicture: true,
      normalize: (p) => normalizeElements(p),
    };
  },
};

const clampN = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeElements(p) {
  const e = p && typeof p === 'object' ? p : {};
  // Some chatbots answer 0-1 instead of 0-1000; scale those up rather than piling everything in the corner.
  const scale = (v) => (Number(v) > 0 && Number(v) <= 1 ? Number(v) * 1000 : Number(v));
  const horizon = scale(e.horizon);
  return {
    elements: (Array.isArray(e.elements) ? e.elements : [])
      .filter((x) => x && ELEMENT_KINDS.includes(x.kind))
      .slice(0, 8)
      .map((x) => ({
        kind: x.kind,
        x: clampN(scale(x.x) / 1000, 0, 1, 0.5),
        y: clampN(scale(x.y) / 1000, 0, 1, 0.5),
        size: clampN(scale(x.size) / 1000, 0.02, 0.9, 0.15),
        intensity: clampN(x.intensity, 0.2, 1.5, 0.8),
        angle: clampN(x.angle, -360, 360, 0),
        why: clean(x.why).slice(0, 80),
      })),
    depth: Number.isFinite(horizon) && horizon > 100 && horizon < 900 ? Math.round(horizon) / 1000 : null,
    effect: W.EFFECTS.includes(e.effect) ? e.effect : 'none',
  };
}

/** Run a task through an API key. */
export async function runTask(provider, apiKey, model, task) {
  const parsed = await callModel(provider, apiKey, model, task);
  return task.normalize(parsed);
}

/** Turn a Gemini-style schema into a fill-in-the-blanks JSON example for a chatbot. */
export function skeleton(node, depth = 0) {
  if (!node || typeof node !== 'object') return '"..."';
  const pad = '  '.repeat(depth + 1);
  const end = '  '.repeat(depth);
  switch (node.type) {
    case 'OBJECT': {
      const keys = node.propertyOrdering || Object.keys(node.properties || {});
      return '{\n' + keys.map((k) => pad + JSON.stringify(k) + ': ' + skeleton(node.properties[k], depth + 1)).join(',\n') + '\n' + end + '}';
    }
    case 'ARRAY':
      return '[\n' + pad + skeleton(node.items, depth + 1) + ',\n' + pad + '"... more items of the same shape ..."\n' + end + ']';
    case 'INTEGER':
    case 'NUMBER':
      return '0' + (node.description ? '  /* ' + node.description.replace(/\*\//g, '') + ' */' : '');
    default:
      if (Array.isArray(node.enum)) return JSON.stringify('one of: ' + node.enum.join(' | '));
      return JSON.stringify(node.description ? '<' + node.description + '>' : '<text>');
  }
}

/** The whole job as one message for any chatbot. */
export function chatPrompt(task) {
  return [
    task.system,
    '',
    '--------',
    '',
    strip(task.prompt),
    '',
    '--------',
    '',
    task.needsPicture ? 'IMPORTANT: the picture is attached to this message. Look at it carefully before answering.\n' : '',
    'HOW TO ANSWER: reply with ONE JSON object and nothing else, inside a ```json code block.',
    'It must have exactly this shape. Replace every <...> with real text and every 0 with a real number',
    '(the /* notes */ only explain the field - leave them out of your answer). Write all of it; do not stop early.',
    '',
    '```json',
    skeleton(task.schema),
    '```',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

/** Read a chatbot's reply back, exactly as an API answer would be. */
export function importReply(task, reply) {
  // Comments the model copied from the template would break JSON.parse.
  const text = String(reply || '').replace(/\/\*[\s\S]*?\*\//g, '');
  // A long answer sometimes arrives in pieces ("continue"): join every code block, in order.
  // Split on the fences rather than pairing them: the first piece usually never got its closing one.
  // Pieces with no JSON punctuation in them are the chatbot's chatter ("Hope that helps!").
  const blocks = text.split(/```(?:json)?/i).slice(1).map((b) => b.trim()).filter((b) => /["{}[\]]/.test(b));
  const parsed = (blocks.length > 1 && parseJsonLoosely(blocks.join('\n'))) || parseJsonLoosely(text);
  if (!parsed) {
    throw new Error('Could not find the answer in that reply. Copy the WHOLE reply, including the ```json block. '
      + 'If the chatbot stopped half way, ask it to "continue", then paste both parts together.');
  }
  return task.normalize(parsed);
}
