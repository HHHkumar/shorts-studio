// ---------------------------------------------------------------------------
// The explainer storyboard.
//
// A different kind of video from the MCQ: no question, no options, no reveal.
// Three to five minutes that build understanding one scene at a time, using
// analogies and diagrams instead of equations.
//
// The contract is the same as the quiz one in every way that matters - the
// script is a list of beats, each beat carries the exact words to speak, and
// the length of the recorded audio decides the length of the scene. What
// changes is that each beat also names a LAYOUT and fills it in. That is the
// storyboard: `kind` says which component draws the scene, `panel` says what
// goes in it.
//
// The reveals are deliberately not authored here. The renderer works out when
// each label is spoken and lights it up then, so a storyboard never has to
// carry a reveal order that could disagree with the narration.
// ---------------------------------------------------------------------------

import { callGemini } from './gemini.mjs';

/** Layouts the storyboard may choose from, plus the plain talking beats. */
const PANEL_KINDS = [
  'title', 'metaphor', 'diagram', 'process', 'versus', 'timeline', 'grid', 'recap',
];
const SCENE_KINDS = [...PANEL_KINDS, 'explain', 'outro'];

const STEP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    label: { type: 'STRING', description: 'The short line on screen. 2-7 words.' },
    detail: { type: 'STRING', description: 'Optional second line, smaller. One short clause.' },
    symbol: { type: 'STRING', description: 'Optional single emoji or symbol.' },
    when: { type: 'STRING', description: 'Timeline only: the year or stage, e.g. "1831".' },
  },
  required: ['label'],
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic: { type: 'STRING' },
    /** The one question the whole video answers. Shown on the title card. */
    question: { type: 'STRING' },
    hook: { type: 'STRING', description: 'One line on why this is worth three minutes.' },
    outro: { type: 'STRING' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    motifSymbols: { type: 'ARRAY', items: { type: 'STRING' } },
    script: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: SCENE_KINDS },
          narration: { type: 'STRING', description: 'Exactly what the voice says. Plain words.' },
          imageQuery: { type: 'STRING', description: '2-4 concrete words for a backdrop photo.' },
          panel: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              subtitle: { type: 'STRING' },
              leftLabel: { type: 'STRING' },
              rightLabel: { type: 'STRING' },
              leftSymbol: { type: 'STRING' },
              rightSymbol: { type: 'STRING' },
              leftPoints: { type: 'ARRAY', items: { type: 'STRING' } },
              rightPoints: { type: 'ARRAY', items: { type: 'STRING' } },
              nodes: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING', description: 'Short, unique, referenced by edges.' },
                    label: { type: 'STRING' },
                    symbol: { type: 'STRING' },
                    col: { type: 'INTEGER' },
                    row: { type: 'INTEGER' },
                  },
                  required: ['id', 'label'],
                },
              },
              edges: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    from: { type: 'STRING' },
                    to: { type: 'STRING' },
                    label: { type: 'STRING' },
                    dashed: { type: 'BOOLEAN' },
                  },
                  required: ['from', 'to'],
                },
              },
              steps: { type: 'ARRAY', items: STEP_SCHEMA },
            },
          },
        },
        required: ['kind', 'narration'],
      },
    },
  },
  required: ['topic', 'question', 'hook', 'outro', 'script'],
};

const SYSTEM = [
  'You are a director writing the storyboard for an explainer video. Your job is to make somebody',
  'understand how something works, using pictures and analogies rather than equations.',
  '',
  'THE ONE RULE. Every word of narration is read aloud, and the layout on screen is what the',
  'narration is talking about at that moment. If the voice says "three stages", the screen shows',
  'three stages. Never describe something the viewer cannot see, and never show something the',
  'voice does not mention.',
  '',
  'NARRATION.',
  '- Write it to be spoken, not read. Short sentences. Say "about a thousand", not "1,000".',
  '- No markdown, no LaTeX, no bullet characters, no stage directions, no "welcome back".',
  '- Do not read the on-screen labels out word for word. Speak the label naturally inside a',
  '  sentence: for the label "Boiler" say "it starts in the boiler, where water becomes steam".',
  '  The renderer matches your spoken words against the labels to time the reveals, so the label',
  '  words MUST appear somewhere in that scene\'s narration, in the same order as the labels.',
  '- Cover the labels in the order you listed them. That order is the reveal order.',
  '',
  'MATHS. Almost none. If a formula is unavoidable, say it in words and move on. This video is',
  'about intuition. A viewer should finish it able to explain the idea to somebody else, not able',
  'to solve a problem.',
  '',
  'THE LAYOUTS. Pick the one that fits what the beat is doing:',
  '',
  '  title    - the question the video answers. Use once, near the start.',
  '             panel.title = the question. panel.subtitle = one line of promise.',
  '  metaphor - the heart of the whole thing. Something the viewer already understands on the',
  '             LEFT, the thing being explained on the RIGHT. leftLabel/rightLabel, a symbol each,',
  '             and up to 3 leftPoints/rightPoints that line up one for one.',
  '             e.g. left "Water in a pipe" / right "Current in a wire".',
  '  diagram  - the real object as boxes and arrows. nodes (2-6, each with a short id and label)',
  '             and edges joining them. Use col/row to lay them out; a left-to-right chain is',
  '             row 0 with col 0,1,2. Put a word on an edge when the arrow itself carries meaning',
  '             ("steam", "230 V"). dashed:true for a return path or an indirect effect.',
  '  process  - how it works, step by step. 3-5 steps, each a short label plus optional detail.',
  '  versus   - two things held against each other. leftPoints and rightPoints, SAME NUMBER on',
  '             each side, and point 1 on the left must answer point 1 on the right.',
  '  timeline - how it came to be. 3-5 steps, each with `when`.',
  '  grid     - several parallel things of equal weight, each with a symbol. 3-6 steps.',
  '  recap    - what to take away. 3-4 steps. Use once, at the end.',
  '  explain  - a plain talking beat with no layout. Use sparingly, for a transition or an aside.',
  '  outro    - the sign-off. Once, last.',
  '',
  'STRUCTURE. A good explainer moves: why you should care -> the familiar analogy -> the real',
  'thing -> how it works -> what it means -> what to remember. Do not use the same layout twice',
  'in a row. Use metaphor at least once, diagram at least once, and recap exactly once at the end.',
  '',
  'LABELS. Two to five words. They are drawn inside boxes, so a label longer than about twenty',
  'characters will not fit. Symbols are one emoji, and only where one genuinely helps.',
  '',
  'TRUTH. Every claim must be one you would defend. An analogy may simplify, but it must not',
  'mislead - if the analogy breaks down somewhere that matters, say so in the narration.',
].join('\n');

const WORDS_PER_SECOND = 2.6;

/**
 * How many scenes and how many words each.
 *
 * An explainer breathes: roughly nine seconds a beat, which is long enough for
 * a layout to build and be understood before the next one arrives. Anything
 * faster and the reveals trip over each other.
 */
/** About nine seconds of speech - long enough for a layout to build and land. */
const PREFERRED_WORDS_PER_SCENE = 26;

/**
 * Enough scenes for a five minute video, and not so many that the model is
 * asked for a wall of JSON it will take minutes to produce.
 */
const MAX_SCENES = 36;

export function storyboardBudget(targetSeconds) {
  const target = Math.max(60, Math.min(600, Number(targetSeconds) || 240));
  const totalWords = Math.round(target * WORDS_PER_SECOND);

  const scenes = Math.max(6, Math.min(MAX_SCENES, Math.round(totalWords / PREFERRED_WORDS_PER_SCENE)));

  // Words per scene is DERIVED from the scene count, never assumed. Fixing it
  // at 26 and then capping the scene count meant the prompt asked for
  // 22 x 24 = 528 words while claiming to want 300 seconds, or 780 - so every
  // long explainer came out a third short, and the two numbers in the prompt
  // contradicted each other. The model followed the per-scene figure, because
  // that is the one it can act on.
  const wordsPerScene = Math.round(totalWords / scenes);

  return { target, totalWords, scenes, wordsPerScene };
}

function buildPrompt(o) {
  const b = storyboardBudget(o.targetSeconds);
  const lines = [];

  lines.push('Write the storyboard for an explainer video.');
  lines.push('');
  lines.push('Topic: ' + (o.topic || 'choose a good one in ' + (o.subject || 'science')));
  if (o.subject) lines.push('Field: ' + o.subject);
  if (o.level) lines.push('Audience: ' + o.level + '. Pitch the vocabulary there.');
  if (o.tone) lines.push('Tone: ' + o.tone + '.');
  if (o.language && o.language !== 'English') {
    lines.push('Write ALL narration and every on-screen label in ' + o.language + '.');
  }
  if (o.avoid) lines.push('Avoid: ' + o.avoid + '.');
  if (o.extra) lines.push('Also: ' + o.extra + '.');
  lines.push('');

  lines.push('LENGTH. Write EXACTLY ' + b.scenes + ' scenes.');
  lines.push('Each scene needs about ' + b.wordsPerScene + ' words of narration - not 10, not 15.');
  lines.push('That comes to roughly ' + b.totalWords + ' spoken words, which reads aloud in about '
    + b.target + ' seconds. Those three numbers agree; keep all three.');
  lines.push('');
  lines.push('This is the requirement that gets missed most often. A scene with one short sentence');
  lines.push('in it is half a scene. Give every one of them a complete thought: say the thing, then');
  lines.push('say what it means or why it matters. There is no way to stretch a short script');
  lines.push('afterwards - the video simply comes out at half the length that was asked for.');
  lines.push('');

  lines.push('The last scene is the outro' + (o.extra ? '' : ' - a short sign-off') + '.');
  lines.push('The scene before it is the recap.');
  lines.push('');
  lines.push('Return the JSON. No commentary.');
  return lines.join('\n');
}

export async function generateStoryboard(apiKey, model, options) {
  const parsed = await callGemini(apiKey, model, {
    system: SYSTEM,
    prompt: buildPrompt(options),
    schema: RESPONSE_SCHEMA,
    temperature: 0.55 + (Number(options.curiosity) || 5) * 0.03,
    label: 'storyboard',
  });
  return normalizeStoryboard(parsed, options);
}

// --- cleaning ---------------------------------------------------------------

const clean = (v, max = 400) =>
  (typeof v === 'string' ? v : '')
    .replace(/\s+/g, ' ')
    .replace(/[*_`#]/g, '')
    .trim()
    .slice(0, max);

const list = (v, max, len) =>
  (Array.isArray(v) ? v : [])
    .map((x) => clean(x, len))
    .filter(Boolean)
    .slice(0, max);

/** One emoji or symbol, never a word. */
const symbol = (v) => {
  const s = clean(v, 8);
  if (!s) return '';
  // A "symbol" that is really a word would be drawn at 70px and swamp the box.
  return /^[\p{L}\p{N}]{2,}$/u.test(s) ? '' : s.slice(0, 4);
};

function normalizeSteps(raw, max) {
  return (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const o = r && typeof r === 'object' ? r : {};
      return {
        label: clean(o.label, 60),
        detail: clean(o.detail, 90),
        symbol: symbol(o.symbol),
        when: clean(o.when, 18),
      };
    })
    .filter((s) => s.label)
    .slice(0, max);
}

/**
 * Keep only what this layout actually draws.
 *
 * A panel arriving with fields for three different layouts is not a hint that
 * the model was being generous - it means a scene would render half-built
 * furniture nobody asked for. Each kind takes its own fields and drops the rest.
 */
export function normalizePanel(raw, kind) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const panel = {};

  if (kind === 'title') {
    panel.title = clean(o.title, 90);
    panel.subtitle = clean(o.subtitle, 120);
    return panel.title ? panel : null;
  }

  if (kind === 'recap') {
    panel.title = clean(o.title, 40);
    panel.steps = normalizeSteps(o.steps, 5);
    return panel.steps.length ? panel : null;
  }

  if (kind === 'metaphor' || kind === 'versus') {
    panel.leftLabel = clean(o.leftLabel, 40);
    panel.rightLabel = clean(o.rightLabel, 40);
    panel.leftSymbol = symbol(o.leftSymbol);
    panel.rightSymbol = symbol(o.rightSymbol);
    panel.leftPoints = list(o.leftPoints, 4, 70);
    panel.rightPoints = list(o.rightPoints, 4, 70);

    // Both sides or neither: one lonely card is not a comparison, and the
    // renderer would draw a bridge to nothing.
    if (!panel.leftLabel || !panel.rightLabel) return null;

    if (kind === 'versus') {
      // A versus table reads across. Ragged columns break that, so trim to the
      // shorter side rather than leaving a row half empty.
      const n = Math.min(panel.leftPoints.length, panel.rightPoints.length);
      if (!n) return null;
      panel.leftPoints = panel.leftPoints.slice(0, n);
      panel.rightPoints = panel.rightPoints.slice(0, n);
    }
    return panel;
  }

  if (kind === 'diagram') {
    const seen = new Set();
    panel.nodes = (Array.isArray(o.nodes) ? o.nodes : [])
      .map((n) => {
        const r = n && typeof n === 'object' ? n : {};
        const id = clean(r.id, 24);
        const label = clean(r.label, 40);
        if (!id || !label || seen.has(id)) return null;
        seen.add(id);
        const node = { id, label, symbol: symbol(r.symbol) };
        if (Number.isFinite(Number(r.col))) node.col = Math.max(0, Math.min(5, Math.round(Number(r.col))));
        if (Number.isFinite(Number(r.row))) node.row = Math.max(0, Math.min(5, Math.round(Number(r.row))));
        return node;
      })
      .filter(Boolean)
      .slice(0, 8);

    if (panel.nodes.length < 2) return null;

    const ids = new Set(panel.nodes.map((n) => n.id));
    panel.edges = (Array.isArray(o.edges) ? o.edges : [])
      .map((e) => {
        const r = e && typeof e === 'object' ? e : {};
        const from = clean(r.from, 24);
        const to = clean(r.to, 24);
        // An arrow to a box that was never declared draws a line into empty
        // space, so drop it rather than render a dangling stub.
        if (!ids.has(from) || !ids.has(to) || from === to) return null;
        return { from, to, label: clean(r.label, 24), dashed: r.dashed === true };
      })
      .filter(Boolean)
      .slice(0, 10);

    return panel;
  }

  if (kind === 'process') {
    panel.steps = normalizeSteps(o.steps, 6);
    return panel.steps.length >= 2 ? panel : null;
  }

  if (kind === 'timeline') {
    panel.steps = normalizeSteps(o.steps, 5);
    return panel.steps.length >= 2 ? panel : null;
  }

  if (kind === 'grid') {
    panel.steps = normalizeSteps(o.steps, 6);
    return panel.steps.length >= 2 ? panel : null;
  }

  return null;
}

const PANEL_SET = new Set(PANEL_KINDS);

/**
 * Turn whatever came back into the shape the rest of the app already speaks.
 *
 * The explainer fills the same QuizContent as the quiz does, minus the parts
 * only a quiz has. That is what lets the voiceover, sync, mixing, stock picker,
 * renderer and SEO steps work on it without knowing which kind of video it is.
 */
export function normalizeStoryboard(input, options = {}) {
  const raw = input && typeof input === 'object' ? input : {};

  const script = (Array.isArray(raw.script) ? raw.script : [])
    .map((line) => {
      const o = line && typeof line === 'object' ? line : {};
      let kind = clean(o.kind, 20).toLowerCase();
      if (!SCENE_KINDS.includes(kind)) kind = 'explain';
      const narration = clean(o.narration, 900);
      if (!narration) return null;

      const panel = PANEL_SET.has(kind) ? normalizePanel(o.panel, kind) : null;
      // A layout scene with nothing to lay out is just a talking beat. Better a
      // clean explain scene than an empty frame with a subtitle under it.
      const finalKind = PANEL_SET.has(kind) && !panel ? 'explain' : kind;

      const entry = { kind: finalKind, narration, imageQuery: clean(o.imageQuery, 60) };
      if (panel) entry.panel = panel;
      return entry;
    })
    .filter(Boolean);

  if (!script.length) {
    throw new Error('Gemini returned a storyboard with no scenes in it. Try again.');
  }

  // The creator's greeting goes first, exactly as they typed it.
  const intro = clean(options.intro, 300);
  if (intro) script.unshift({ kind: 'intro', narration: intro, imageQuery: '' });

  // Exactly one outro, and it is last.
  const outroIndex = script.findIndex((s) => s.kind === 'outro');
  if (outroIndex !== -1 && outroIndex !== script.length - 1) {
    script.push(script.splice(outroIndex, 1)[0]);
  }

  const question = clean(raw.question, 200) || clean(raw.topic, 200);

  return {
    videoKind: 'explainer',
    subject: clean(options.subject, 60) || clean(raw.topic, 60),
    topic: clean(raw.topic, 120) || clean(options.topic, 120),
    difficulty: clean(options.difficulty, 40),
    hook: clean(raw.hook, 200),
    // The one question the video answers. Used on the title card and by SEO.
    question,
    // An explainer has no quiz in it. These stay empty and the MCQ scenes are
    // simply never in the script.
    options: [],
    correctIndex: 0,
    answerLine: '',
    explanation: [],
    funFact: '',
    outro: clean(raw.outro, 200),
    hashtags: list(raw.hashtags, 8, 30).map((h) => (h.startsWith('#') ? h : '#' + h.replace(/\s+/g, ''))),
    motifSymbols: list(raw.motifSymbols, 6, 4).map(symbol).filter(Boolean),
    script,
  };
}
