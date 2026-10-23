// ---------------------------------------------------------------------------
// The storyboard artist: one picture for every beat of the script.
//
// The browser splits each scene into beats of about two seconds (see
// src/lib/storyboard.ts). This writes the picture for each - literal, varied
// in framing, with the same recurring cast - plus a stock search for each.
// ---------------------------------------------------------------------------

import { STOCK_QUERY_HINT } from './writer.mjs';

const clean = (v) => (typeof v === 'string' ? v : '').replace(/\*\*/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

export const STORYBOARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    styleBible: {
      type: 'STRING',
      description: 'The recurring cast and setting in 2-4 sentences: names, ages, clothing and one distinctive feature each. Return the given one unchanged if there is one.',
    },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER', description: 'The scene number exactly as given.' },
          shots: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                beat: { type: 'INTEGER', description: 'The beat number exactly as given, starting at 1.' },
                imagePrompt: { type: 'STRING', description: 'In English, 1-2 sentences: who or what is in the frame, doing what, where, and the framing (wide, medium, close-up, insert). No written text in the picture.' },
                stockQuery: { type: 'STRING', description: STOCK_QUERY_HINT },
              },
              required: ['beat', 'imagePrompt', 'stockQuery'],
              propertyOrdering: ['beat', 'imagePrompt', 'stockQuery'],
            },
          },
        },
        required: ['index', 'shots'],
        propertyOrdering: ['index', 'shots'],
      },
    },
  },
  required: ['styleBible', 'scenes'],
  propertyOrdering: ['styleBible', 'scenes'],
};

export const STORYBOARD_SYSTEM = [
  'You are the storyboard artist for a narrated, illustrated YouTube explainer in which the picture changes every couple',
  'of seconds - a new drawing on almost every phrase. The script is split into numbered beats. For EVERY beat, describe',
  'one picture that shows exactly what that beat says.',
  '',
  'Rules:',
  '- Literal and specific: the person, object, place or action the beat names. When a beat is abstract, find a concrete',
  '  visual metaphor or a visual joke (an exaggerated reaction, an absurd contrast).',
  '- Pictures in a row must differ: alternate wide establishing shots, medium shots, close-ups of faces or hands, and',
  '  inserts of a single object. Never two near-identical pictures one after the other.',
  '- Keep a small recurring cast recognisable: use their names from the style bible and repeat their key features.',
  '- Period-accurate clothing, buildings and objects. Simple, readable staging: one idea per picture.',
  '- No written words, signs, captions or speech bubbles in the pictures; show a date with an object (a calendar page, a',
  '  stamped seal) if it matters.',
  '- Humour where the narration is funny, never at the expense of real suffering. Nothing gory.',
  '- Where a scene says its first picture is kept, still describe beat 1 briefly, and make beat 2 follow on from it.',
  '- Return a shot for every beat, numbered to match.',
].join('\n');

/** o: { title, styleName, styleBible, kind, scenes: [{ index, beats: [text], keepFirst }] } */
export function storyboardTask(o) {
  const scenes = (Array.isArray(o.scenes) ? o.scenes : []).filter((s) => Array.isArray(s.beats) && s.beats.length);
  if (!scenes.length) throw new Error('There are no scenes to storyboard yet.');
  const total = scenes.reduce((a, s) => a + s.beats.length, 0);
  const lines = scenes.map((s) => [
    'Scene ' + s.index + ' (' + s.beats.length + ' beat' + (s.beats.length === 1 ? '' : 's') + ')' + (s.keepFirst ? ' - its first picture is kept: ' + clean(s.keepFirst) : ''),
    ...s.beats.map((b, k) => '  ' + (k + 1) + '. ' + clean(b)),
  ].join('\n'));
  return {
    system: STORYBOARD_SYSTEM,
    prompt: [
      'Video: ' + (clean(o.title) || '(untitled)'),
      o.kind === 'news'
        ? 'This is a news explainer: real photos are searched with stockQuery first, so name real places, institutions and public figures there; pictures of real people are never invented.'
        : 'Picture style of the illustrator: ' + (clean(o.styleName) || 'hand-drawn cartoon') + '.',
      clean(o.styleBible) ? 'Style bible (recurring cast and setting): ' + clean(o.styleBible) : 'There is no style bible yet: write one that fits the script.',
      '',
      'There are ' + total + ' beats in all. Return a shot for each.',
      '',
      lines.join('\n\n'),
      '',
      'Return only the JSON object.',
    ].join('\n'),
    schema: STORYBOARD_SCHEMA,
    temperature: 0.7,
    label: 'storyboard',
    normalize: (r) => normalizeStoryboard(r, scenes),
  };
}

/** Only the scenes and beats that were asked about, numbered as asked. */
export function normalizeStoryboard(r, scenes) {
  const byIndex = new Map((Array.isArray(r && r.scenes) ? r.scenes : []).map((s) => [Number(s && s.index), s]));
  return {
    styleBible: clean(r && r.styleBible),
    scenes: scenes.map((s) => {
      const got = byIndex.get(Number(s.index));
      const raw = Array.isArray(got && got.shots) ? got.shots : [];
      const shots = [];
      for (const x of raw) {
        const beat = Math.round(Number(x && x.beat));
        if (!(beat >= 1 && beat <= s.beats.length) || shots.some((y) => y.beat === beat)) continue;
        const imagePrompt = clean(x.imagePrompt);
        const stockQuery = clean(x.stockQuery).slice(0, 80);
        if (imagePrompt || stockQuery) shots.push({ beat, imagePrompt, stockQuery });
      }
      return { index: Number(s.index), shots: shots.sort((a, b) => a.beat - b.beat) };
    }),
  };
}
