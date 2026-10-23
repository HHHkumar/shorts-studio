// ---------------------------------------------------------------------------
// The news explainer writer: a research brief (with its numbered sources) in,
// a scene-by-scene script out - each scene with a picture OR a data graphic,
// and the sources that back it.
//
// The rules that matter most are in NEWS_SYSTEM: only facts from the brief,
// every side in its fairest form, quotes verbatim and attributed, and never a
// picture of an identifiable real person.
// ---------------------------------------------------------------------------

import { EFFECTS, MOTIONS, STOCK_QUERY_HINT } from './writer.mjs';
import { voiceGuide } from './voice-direction.mjs';

export const GRAPHIC_KINDS = ['map', 'bars', 'line', 'number', 'quote', 'people', 'timeline', 'versus', 'headline'];
const VISUALS = ['picture', ...GRAPHIC_KINDS];

const clean = (v, max = 2000) => (typeof v === 'string' ? v : '').replace(/\*\*/g, '').replace(/[*_`]/g, '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export const TONES = {
  clear: 'Clear and calm, like a good public broadcaster: plain words, short sentences, warm but serious.',
  energetic: 'Energetic YouTube explainer: punchy hook, fast rhythm, vivid comparisons - but never sensational.',
  story: 'Storytelling: open on a real moment or a person affected (anonymised unless public), then widen out.',
};

const GRAPHIC_SCHEMA = {
  type: 'OBJECT',
  description: 'Only for graphic visuals; leave fields empty for a picture.',
  properties: {
    title: { type: 'STRING', description: 'Short on-screen title of the graphic (for headline: the headline itself).' },
    items: {
      type: 'ARRAY',
      description: 'bars/line: one per bar or point (label + value). people: label = name, note = role and position. timeline: label = date, note = what happened. number: optional one item whose note is a small caption.',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          value: { type: 'NUMBER' },
          note: { type: 'STRING' },
        },
        required: ['label', 'value', 'note'],
        propertyOrdering: ['label', 'value', 'note'],
      },
    },
    unit: { type: 'STRING', description: 'bars/line/number unit appended to values, e.g. "%", " bn", "°C". Empty if none.' },
    countries: { type: 'ARRAY', items: { type: 'STRING' }, description: 'map: country names to highlight (common English names).' },
    quote: { type: 'STRING', description: 'quote: the exact words, verbatim from the brief. headline: an optional one-line subheading.' },
    who: { type: 'STRING', description: 'quote: who said it.' },
    role: { type: 'STRING', description: 'quote: their role. headline: a small kicker such as "Explained" or a date.' },
    leftTitle: { type: 'STRING', description: 'versus: the first side.' },
    leftPoints: { type: 'ARRAY', items: { type: 'STRING' }, description: 'versus: 2-4 short points for the first side.' },
    rightTitle: { type: 'STRING', description: 'versus: the other side.' },
    rightPoints: { type: 'ARRAY', items: { type: 'STRING' }, description: 'versus: 2-4 short points for the other side.' },
    value: { type: 'NUMBER', description: 'number: the striking number.' },
    from: { type: 'NUMBER', description: 'number: where the count starts (usually 0).' },
  },
  required: ['title', 'items', 'unit', 'countries', 'quote', 'who', 'role', 'leftTitle', 'leftPoints', 'rightTitle', 'rightPoints', 'value', 'from'],
  propertyOrdering: ['title', 'items', 'unit', 'countries', 'quote', 'who', 'role', 'leftTitle', 'leftPoints', 'rightTitle', 'rightPoints', 'value', 'from'],
};

export const NEWS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A clear, curiosity-driven YouTube title under 70 characters. Accurate, not clickbait.' },
    titleIdeas: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Three alternative titles.' },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          narration: { type: 'STRING', description: 'What the narrator says over this visual, 20-40 words, plain spoken language.' },
          visual: { type: 'STRING', enum: VISUALS, description: 'picture, or the data graphic that shows this best.' },
          imagePrompt: { type: 'STRING', description: 'For picture only: a generic editorial illustration (places, objects, anonymous people, symbols). NEVER an identifiable real person, logo or flag-burning. Empty for graphics.' },
          graphic: GRAPHIC_SCHEMA,
          sources: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Numbers of the sources (from the list) that back this scene. Every factual scene needs at least one.' },
          effect: { type: 'STRING', enum: EFFECTS, description: 'Subtle atmosphere for pictures; none for graphics.' },
          motion: { type: 'STRING', enum: MOTIONS, description: 'Camera move for pictures; still or auto for graphics.' },
          chapter: { type: 'STRING', description: 'Chapter title if a new section starts here ("What happened", "Why it matters", "The two sides", "What next"), else empty.' },
          stockQuery: { type: 'STRING', description: STOCK_QUERY_HINT + ' For news, real photos of the places, buildings and public figures involved are welcome here.' },
        },
        required: ['narration', 'visual', 'imagePrompt', 'graphic', 'sources', 'effect', 'motion', 'chapter', 'stockQuery'],
        propertyOrdering: ['narration', 'visual', 'imagePrompt', 'graphic', 'sources', 'effect', 'motion', 'chapter', 'stockQuery'],
      },
    },
    sources: {
      type: 'ARRAY',
      description: 'The sources used, numbered from 1 in this order. If a numbered list was given, repeat it unchanged.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          publisher: { type: 'STRING' },
          url: { type: 'STRING' },
          date: { type: 'STRING', description: 'YYYY-MM-DD if known.' },
        },
        required: ['title', 'publisher', 'url', 'date'],
        propertyOrdering: ['title', 'publisher', 'url', 'date'],
      },
    },
    description: { type: 'STRING', description: 'YouTube description: 2 short neutral paragraphs, then 3-5 hashtags on the last line. Do not list sources; the app adds them.' },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, description: '10-15 search tags.' },
    factNotes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'What is disputed, developing, unverified or single-sourced, so the creator can check before publishing.' },
  },
  required: ['title', 'titleIdeas', 'scenes', 'sources', 'description', 'tags', 'factNotes'],
  propertyOrdering: ['title', 'titleIdeas', 'scenes', 'sources', 'description', 'tags', 'factNotes'],
};

export const NEWS_SYSTEM = [
  'You write captivating, plain-language YouTube news explainers for people who do not follow the news closely.',
  'Each video is a sequence of scenes; each scene is one visual (a picture or a data graphic) under one or two spoken sentences.',
  '',
  'Accuracy and fairness come first:',
  '- Use ONLY facts in the research brief. Never add facts, numbers or quotes from memory.',
  '- Attribute claims ("according to Reuters", "the government says"). Say clearly what is unconfirmed or still developing.',
  '- On anything political or contested, give every major side in its strongest fair form, in neutral words, and let the',
  '  viewer decide. No loaded adjectives, no speculation about motives, no telling the viewer what to think.',
  '- Quotes are verbatim from the brief, with who said them. Never invent or tidy a quote.',
  '- Dates are concrete ("on Sunday, 5 October"), relative to the "as of" date.',
  '',
  'Make it captivating:',
  '- Open with a one-line hook that puts the news in human terms, then say within 20 seconds why it matters to the viewer.',
  '- Then: what happened; how we got here; who is who; the different sides; what happens next; a short recap.',
  '  Mark these as chapters.',
  '- Explain jargon the first time. Use everyday comparisons for big numbers.',
  '',
  'Visuals:',
  '- Prefer a data graphic whenever the scene is about a number, a trend, a place, a quote, the key people, a sequence',
  '  of events or two positions: number, bars, line, map, quote, people, timeline, versus. Use headline for the opening.',
  '- Graphics need real data from the brief: bars at least 2 items with values, a line at least 3 points.',
  '- Use picture for general scenes, as generic editorial illustration only. A picture must NEVER show an identifiable',
  '  real person (no politicians, leaders or celebrities), real logos, or anything graphic or violent.',
  '- Every factual scene lists the numbers of the sources that back it.',
].join('\n');

/** The writing prompt. With `brief` it writes from research; without, a chatbot is asked to research first. */
export function buildNewsPrompt(o) {
  const minutes = Math.min(15, Math.max(1, Number(o.minutes) || 4));
  const words = Math.round(minutes * 150);
  const sources = Array.isArray(o.sources) ? o.sources : [];
  const lines = [
    'As of: ' + (o.asOf || new Date().toISOString().slice(0, 10)),
    'Story: ' + clean(o.story, 600),
    o.region ? 'Audience: ' + clean(o.region, 80) + ' - explain the local angle where there is one.' : '',
    o.angle ? 'Angle from the creator: ' + clean(o.angle, 600) : '',
    'Tone: ' + (TONES[o.tone] || TONES.clear),
    'Narration language: ' + (o.language || 'English') + '. Image prompts and graphic labels may stay in English.',
    'Length: about ' + minutes + ' minutes, about ' + words + ' words, about ' + Math.max(5, Math.round(words / 30)) + ' scenes.',
    '',
  ];
  if (o.brief) {
    lines.push('Numbered sources:');
    sources.forEach((s, i) => lines.push((i + 1) + '. ' + [s.publisher, s.title, s.date, s.url].filter(Boolean).join(' - ')));
    lines.push('', 'Research brief:', String(o.brief).slice(0, 30000));
  } else {
    lines.push('There is no research brief: SEARCH THE WEB NOW for the latest reliable reporting on this story before',
      'writing, cross-check it, and list the sources you used (with their real URLs and dates) in "sources".');
  }
  if (o.voiceTags) lines.push('', voiceGuide({ kind: 'news' }));
  lines.push('', 'Return only the JSON object.');
  return lines.filter((l) => l !== null && l !== undefined).join('\n');
}

function normalizeGraphic(kind, g) {
  const x = g && typeof g === 'object' ? g : {};
  const items = (Array.isArray(x.items) ? x.items : [])
    .map((i) => ({ label: clean(i && i.label, 60), value: num(i && i.value), note: clean(i && i.note, 140) }))
    .filter((i) => i.label);
  const graphic = {
    kind,
    title: clean(x.title, 140),
    items: items.map((i) => ({ ...i, value: Number.isFinite(i.value) ? i.value : 0 })),
    unit: clean(x.unit, 12),
    countries: (Array.isArray(x.countries) ? x.countries : []).map((c) => clean(c, 60)).filter(Boolean).slice(0, 20),
    quote: clean(x.quote, 400),
    who: clean(x.who, 80),
    role: clean(x.role, 80),
    left: { title: clean(x.leftTitle, 60), points: (Array.isArray(x.leftPoints) ? x.leftPoints : []).map((p) => clean(p, 90)).filter(Boolean).slice(0, 4) },
    right: { title: clean(x.rightTitle, 60), points: (Array.isArray(x.rightPoints) ? x.rightPoints : []).map((p) => clean(p, 90)).filter(Boolean).slice(0, 4) },
    value: Number.isFinite(num(x.value)) ? num(x.value) : 0,
    from: Number.isFinite(num(x.from)) ? num(x.from) : 0,
  };
  // A graphic without the data it needs is worse than a picture: fall back.
  const valued = items.filter((i) => Number.isFinite(i.value));
  const ok = {
    map: graphic.countries.length > 0,
    bars: valued.length >= 2,
    line: valued.length >= 3,
    number: Number.isFinite(num(x.value)),
    quote: Boolean(graphic.quote && graphic.who),
    people: items.length >= 1,
    timeline: items.length >= 2,
    versus: graphic.left.points.length > 0 && graphic.right.points.length > 0,
    headline: Boolean(graphic.title),
  }[kind];
  return ok ? graphic : null;
}

/** Repair the writer's output. `given` is the research's source list (authoritative when present). */
export function normalizeNews(input, given = []) {
  const c = input && typeof input === 'object' ? input : {};
  const fromReply = (Array.isArray(c.sources) ? c.sources : [])
    .map((s) => ({ title: clean(s && s.title, 200), publisher: clean(s && s.publisher, 60), url: clean(s && s.url, 600), date: clean(s && s.date, 30) }))
    .filter((s) => s.title || s.url);
  const sources = given.length ? given : fromReply;
  const n = sources.length;
  const scenes = (Array.isArray(c.scenes) ? c.scenes : [])
    .map((s) => {
      const visual = VISUALS.includes(s && s.visual) ? s.visual : 'picture';
      const graphic = visual === 'picture' ? null : normalizeGraphic(visual, s.graphic);
      return {
        narration: clean(s && s.narration),
        imagePrompt: clean(s && s.imagePrompt, 800),
        graphic,
        sources: [...new Set((Array.isArray(s && s.sources) ? s.sources : []).map((k) => Math.round(num(k)) - 1).filter((k) => k >= 0 && k < n))],
        effect: graphic ? 'none' : (EFFECTS.includes(s && s.effect) ? s.effect : 'none'),
        motion: graphic ? 'still' : (MOTIONS.includes(s && s.motion) ? s.motion : 'auto'),
        chapter: clean(s && s.chapter, 60),
        stockQuery: clean(s && s.stockQuery, 80),
      };
    })
    .filter((s) => s.narration);
  if (!scenes.length) throw new Error('The writer returned no scenes. Try again.');
  const strings = (v, max) => (Array.isArray(v) ? v.map((x) => clean(x, 200)).filter(Boolean).slice(0, max) : []);
  return {
    title: clean(c.title, 100),
    titleIdeas: strings(c.titleIdeas, 5),
    styleBible: '',
    scenes,
    sources,
    description: typeof c.description === 'string' ? c.description.trim().slice(0, 4500) : '',
    tags: strings(c.tags, 20).map((t) => t.replace(/^#/, '')),
    factNotes: strings(c.factNotes, 20),
  };
}
