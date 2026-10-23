// ---------------------------------------------------------------------------
// Voice directions for ElevenLabs v4: audio tags written into the narration.
//
// v4 follows stage directions in square brackets - [warm], [amused], [pause] -
// placed right before the words they affect. The writers add a few when the
// voice will be v4 (VOICE_GUIDE), and "Add voice directions" adds them to a
// script that already exists, without changing one word of it.
// ---------------------------------------------------------------------------

const AUDIO_TAG = /\[[^[\]\n]{1,60}\]/g;
const spoken = (t) => String(t || '').replace(AUDIO_TAG, ' ').replace(/\s+/g, ' ').trim();
const norm = (t) => spoken(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
const clean = (v) => (typeof v === 'string' ? v : '').replace(/\*\*/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

/** Tags that suit each tone. News keeps to delivery and pacing: a tag must never sound like an opinion. */
const PALETTES = {
  immersive: '[hushed], [tense], [awed], [urgent], [softly], [building], [grim], [curious]',
  documentary: '[measured], [thoughtful], [grave], [warm], [curious], [quietly]',
  storyteller: '[warm], [gently], [conspiratorial], [fond], [wistful], [amused]',
  playful: '[amused], [playful], [mock-serious], [delighted], [chuckles], [curious]',
  witty: '[deadpan], [dry], [amused], [sarcastic], [mock-serious], [chuckles], [sighs]',
  news: '[clear], [measured], [serious], [calm], [warm] (for the sign-off only)',
};

/** What the writers are told when the voice will be ElevenLabs v4. */
export function voiceGuide({ tone = '', kind = 'history' } = {}) {
  const news = kind === 'news';
  const palette = news ? PALETTES.news : PALETTES[tone] || PALETTES.documentary;
  return [
    'VOICE DIRECTIONS: the narration is voiced by ElevenLabs v4, which follows audio tags - short stage directions in',
    'square brackets placed right before the words they affect. Write them into the narration itself:',
    '- Suitable tags for this video: ' + palette + ', plus [pause] and [long pause] for timing.',
    '- Sparingly: about one tag every two or three sentences, never more than one per sentence. A delivery carries',
    '  forward until the next tag, so only tag where it changes. Many sentences need none.',
    '- Tags describe the VOICE. No sound effects ([door slams], [applause]), no SSML, no (parentheses) or *asterisks*.',
    '- One mood per tag; never contrasting tags on the same words.',
    '- Shape the read with punctuation too: an ellipsis for a held beat... an em dash for a sharp turn - and CAPITALS',
    '  on at most one stressed word in a while.',
    news
      ? '- This is news: tags only for clarity and pacing, never to signal approval, scorn or alarm about any side.'
      : '- Save the strongest delivery for the turns in the story: the reveal, the joke, the closing line.',
  ].join('\n');
}

export const DIRECT_VOICE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER', description: 'The scene number exactly as given, starting at 1.' },
          narration: { type: 'STRING', description: 'The scene\'s narration word for word, with audio tags added. Not one word changed, added or removed.' },
        },
        required: ['index', 'narration'],
        propertyOrdering: ['index', 'narration'],
      },
    },
  },
  required: ['scenes'],
};

export const DIRECT_VOICE_SYSTEM = [
  'You are a voice director preparing a narration script for ElevenLabs v4. Add audio tags to the script so the voice',
  'performs it well. You must NOT change the words: every word, number and punctuation mark stays exactly as written.',
  'You may only insert tags in square brackets (and remove tags that are already there if they do not suit).',
].join('\n');

/** o: { narrations: [text], tone, kind, title } */
export function directVoiceTask(o) {
  const list = (Array.isArray(o.narrations) ? o.narrations : []).map((t) => String(t || ''));
  if (!list.some((t) => spoken(t))) throw new Error('There is no narration to direct yet.');
  return {
    system: DIRECT_VOICE_SYSTEM + '\n\n' + voiceGuide({ tone: o.tone, kind: o.kind }),
    prompt: [
      'Video: ' + (clean(o.title) || '(untitled)'),
      '',
      'There are exactly ' + list.length + ' scenes. Return every one, numbered to match, with its words unchanged.',
      '',
      list.map((t, i) => (i + 1) + '. ' + t.replace(/\s+/g, ' ').trim()).join('\n'),
      '',
      'Return only the JSON object.',
    ].join('\n'),
    schema: DIRECT_VOICE_SCHEMA,
    temperature: 0.4,
    label: 'voice directions',
    normalize: (r) => normalizeDirectVoice(r, list),
  };
}

/**
 * A scene's new narration is taken only when it says exactly the same words as before -
 * a director that "improved" the script is ignored for that scene, and counted.
 */
export function normalizeDirectVoice(r, list) {
  const byIndex = new Map((Array.isArray(r && r.scenes) ? r.scenes : []).map((s) => [Number(s && s.index), s]));
  let rejected = 0;
  const scenes = list.map((original, i) => {
    const got = byIndex.get(i + 1);
    const narration = clean(got && got.narration);
    if (!narration) return { index: i + 1, narration: original, changed: false };
    if (norm(narration) !== norm(original)) { rejected++; return { index: i + 1, narration: original, changed: false }; }
    return { index: i + 1, narration, changed: narration !== original.replace(/\s+/g, ' ').trim() };
  });
  return { scenes, rejected };
}
