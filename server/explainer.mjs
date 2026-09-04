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

import { callModel } from './gemini.mjs';
// The renderer's own cue matcher, so a warning here agrees with what the video
// actually does. Node strips the types on import; there is no second copy.
import { missingCues } from '../src/lib/options-timing.ts';

/** Layouts the storyboard may choose from, plus the plain talking beats. */
/** Must stay in step with EXPLAINER_KINDS in src/lib/types.ts - a kind missing
 *  here is not offered to the model and is quietly downgraded to `explain`,
 *  which looks exactly like the model choosing not to use it. */
const PANEL_KINDS = [
  'title', 'metaphor', 'diagram', 'process', 'versus', 'timeline', 'grid', 'motion', 'recap',
];
const SCENE_KINDS = [...PANEL_KINDS, 'explain', 'outro'];

const STEP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    label: { type: 'STRING', description: 'The short line on screen. 2-7 words.' },
    detail: { type: 'STRING', description: 'Optional second line, smaller. One short clause.' },
    symbol: { type: 'STRING', description: 'Optional single emoji or symbol.' },
    icon: {
      type: 'STRING',
      description: 'A plain English noun for this thing, e.g. "boiler". Drawn as real artwork.',
    },
    when: { type: 'STRING', description: 'Timeline only: the year or stage, e.g. "1831".' },
  },
  required: ['label'],
};

/**
 * The verbs a storyboard may use on a motion scene. Closed on purpose: the same
 * reason the sketch catalogue is closed. A model given free rein over motion
 * writes plausible instructions for an engine that does not exist.
 */
export const MOTION_ACTIONS = ['appear', 'move', 'blocked', 'climb', 'pulse', 'spin', 'exit'];

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
                    icon: {
                      type: 'STRING',
                      description: 'A plain English noun for what this box is, e.g. "boiler".',
                    },
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
              actors: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING', description: 'Short, unique, referenced by beats.' },
                    icon: {
                      type: 'STRING',
                      description: 'A plain English noun for the thing, e.g. "fish". One or two words.',
                    },
                    label: { type: 'STRING', description: 'Optional caption under the shape.' },
                    x: { type: 'NUMBER', description: '0 at the left edge, 1 at the right.' },
                    y: { type: 'NUMBER', description: '0 at the top, 1 at the bottom.' },
                    scale: { type: 'NUMBER', description: '1 is normal. 0.6 to 2.' },
                    accent: { type: 'BOOLEAN', description: 'Draw in the accent colour.' },
                    hidden: { type: 'BOOLEAN', description: 'Start off screen until an appear beat.' },
                  },
                  required: ['id', 'icon', 'x', 'y'],
                },
              },
              beats: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    actor: { type: 'STRING', description: 'The id of the actor this happens to.' },
                    action: { type: 'STRING', enum: MOTION_ACTIONS },
                    to: { type: 'STRING', description: 'The id of the actor being moved toward.' },
                    x: { type: 'NUMBER' },
                    y: { type: 'NUMBER' },
                    cue: {
                      type: 'STRING',
                      description: 'One or two words from the narration of THIS scene. The beat fires there.',
                    },
                  },
                  required: ['actor', 'action'],
                },
              },
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
  'VOICE. This is four minutes of continuous talking, so how it sounds matters more here than in',
  'any short. Write it the way a person explains something they find genuinely interesting to a',
  'friend who is capable but does not know this subject.',
  '',
  '- Second person, present tense. "You push current through it", not "current is passed through".',
  '- Vary the sentence length. A short one after a long one is the single thing that stops narration',
  '  sounding like a lecture. Never write three long sentences in a row.',
  '- Concrete before abstract. Name the real thing, then the principle - never the reverse.',
  '- No throat-clearing, ever: "In this video", "Let us dive in", "As we can see", "It is important',
  '  to note", "Now,". Delete the run-up and start at the point.',
  '- Never narrate the screen. Do not say "the diagram shows" or "here we see" - the picture is',
  '  already there. Talk about the thing, not about the slide.',
  '- Every scene must hand off to the next. End on something that makes the next scene wanted: a',
  '  consequence, a tension, an unanswered question. No scene is an island.',
  '- Ask a question now and then and answer it immediately. That is what keeps someone watching.',
  '- Do not restate what you just said. Only the recap looks backwards.',
  '- The first scene has to earn the next four minutes. Open on something surprising or something',
  '  the viewer already half-believes and is about to find out is wrong.',
  '',
  'NARRATION MECHANICS.',
  '- Write it to be spoken, not read. Say "about a thousand", not "1,000".',
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
  '  motion   - something HAPPENING, acted out with moving pictures. Reach for this whenever the',
  '             beat is an EVENT rather than a structure: something blocked, something escaping,',
  '             something carried along, two things colliding, a barrier and then a way past it.',
  '             If you can say "and then it..." about the beat, it is a motion scene.',
  '             Do NOT use it for a list, a comparison, or a set of parts - those are grid,',
  '             versus and diagram, and they do those jobs far better.',
  '',
  '             actors: 2-4 things. `icon` is a PLAIN ENGLISH NOUN - "fish", "dam", "turbine",',
  '             "factory". One or two words, singular. Never an icon set name, never a phrase,',
  '             never an emoji. The tool looks the word up in an icon library and draws it.',
  '             x and y place each one: 0,0 is top left, 1,1 is bottom right, 0.5,0.5 the middle.',
  '             Keep visible actors at least 0.2 apart or they overlap into one unreadable shape.',
  '             A thing that arrives partway through gets hidden:true and an `appear` beat.',
  '',
  '             beats: 3-6 events, in the order they happen. Each names an actor and one action:',
  '               appear  - fades in. For something that arrives partway through.',
  '               move    - travels across and stops beside another actor (`to`) or a spot (x,y).',
  '               blocked - runs at `to`, is thrown back, tries again, gives up. "This way is shut."',
  '               climb   - steps up and over `to`. The way through, once one exists.',
  '               pulse   - swells once, to say "this one, now".',
  '               spin    - rotates on the spot. For anything turning.',
  '               exit    - drifts away and fades.',
  '',
  '             CUES ARE THE HARD PART. Read this twice. Every beat carries a `cue`: one or two',
  '             words that you have ALREADY WRITTEN into this scene\'s narration. The beat fires',
  '             at the moment the voice reaches those words. There are no timestamps anywhere.',
  '               1. Every cue must appear VERBATIM in this scene\'s narration. Copy the words out',
  '                  of the sentence you wrote. A cue that is not in the narration cannot fire.',
  '               2. The cues must appear in the narration in the SAME ORDER as the beats.',
  '               3. Never cue a beat on the last four words. It will not have time to play.',
  '                  Write another clause after it.',
  '               4. Pick distinctive words. "the", "it" and "this" appear everywhere and will',
  '                  match the wrong moment.',
  '',
  '             A COMPLETE EXAMPLE. Note how every cue is lifted straight out of the narration,',
  '             and how the sentence carries on after the final cue so the last beat can play:',
  '',
  '               narration: "A salmon heading upstream meets a wall of concrete it has no way',
  '                 over, and the whole run collapses behind it. Cut a fish ladder into the side',
  '                 and the salmon climbs it in shallow steps, one at a time, until it is past."',
  '               panel.title: "A way over"',
  '               actors:',
  '                 fish   icon "fish"   x 0.12 y 0.62  label "Salmon"  accent true',
  '                 dam    icon "dam"    x 0.52 y 0.55  label "Dam"     scale 1.4',
  '                 ladder icon "stairs" x 0.78 y 0.42  label "Fish ladder"  hidden true',
  '               beats:',
  '                 fish   move    to dam     cue "upstream"',
  '                 fish   blocked to dam     cue "wall of concrete"',
  '                 ladder appear             cue "fish ladder"',
  '                 fish   climb   to ladder  cue "climbs"',
  '',
  '  recap    - what to take away. 3-4 steps. Use once, at the end.',
  '  explain  - a plain talking beat with no layout. Use sparingly, for a transition or an aside.',
  '  outro    - the sign-off. Once, last.',
  '',
  'STRUCTURE. A good explainer moves: why you should care -> the familiar analogy -> the real',
  'thing -> how it works -> what it means -> what to remember. Do not use the same layout twice',
  'in a row. Use metaphor at least once, diagram at least once, and recap exactly once at the end.',
  'Include ONE motion scene wherever the subject has a moment that genuinely moves - a thing',
  'blocked, carried, escaping, colliding, or finding a way past an obstacle. Most subjects have',
  'one. Put it in the middle, where the mechanism is being explained, not at the start or the end.',
  'Two at most, and none at all is better than forcing one onto a subject that does not move.',
  '',
  'PICTURES. Every diagram box and every step may carry an `icon`: a PLAIN ENGLISH NOUN for what',
  'the thing is - "boiler", "turbine", "fish", "factory", "battery". One or two words, singular.',
  'The tool looks it up in a library of 200,000 drawings and renders it in the theme colours, so',
  'this is how a layout stops being a row of empty boxes. Give one to every box and every step',
  'where a real object is being named. Leave it out for an abstract idea - there is no drawing of',
  '"efficiency" worth having, and a wrong picture is worse than none.',
  'Never write an icon set name, never a phrase, never an emoji in this field.',
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
  if (o.tone) lines.push('Tone: ' + o.tone + '. Hold that tone the whole way through - it is the one thing a viewer notices across four minutes.');
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
  const parsed = await callModel(options.provider, apiKey, model, {
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
/** A 0-1 stage coordinate. Anything off the scale is pulled back on screen. */
const coord = (v, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  // 0.04 rather than 0, so a figure placed at the edge is not half cropped.
  return Math.max(0.04, Math.min(0.96, n));
};

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
      const step = {
        label: clean(o.label, 60),
        detail: clean(o.detail, 90),
        symbol: symbol(o.symbol),
        when: clean(o.when, 18),
      };
      // The noun the server looks up. Kept only when it is short enough to be
      // a thing rather than a sentence - "boiler" finds a picture, "the place
      // where water becomes steam" finds nothing.
      const icon = clean(o.icon, 32);
      if (icon) step.icon = icon;
      return step;
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
        const icon = clean(r.icon, 32);
        if (icon) node.icon = icon;
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

  if (kind === 'motion') {
    // A short heading above the action, when the scene wants one.
    const heading = clean(o.title, 60);
    if (heading) panel.title = heading;

    const seen = new Set();
    panel.actors = (Array.isArray(o.actors) ? o.actors : [])
      .map((a) => {
        const r = a && typeof a === 'object' ? a : {};
        const id = clean(r.id, 24);
        // The icon noun is what gets searched, so a whole sentence is useless.
        const icon = clean(r.icon, 32);
        if (!id || !icon || seen.has(id)) return null;
        seen.add(id);
        const actor = { id, icon, x: coord(r.x, 0.5), y: coord(r.y, 0.5) };
        const label = clean(r.label, 24);
        if (label) actor.label = label;
        const scale = Number(r.scale);
        if (Number.isFinite(scale)) actor.scale = Math.max(0.4, Math.min(2.5, scale));
        if (r.accent === true) actor.accent = true;
        if (r.hidden === true) actor.hidden = true;
        return actor;
      })
      .filter(Boolean)
      .slice(0, 5);

    // One actor cannot act on anything, which is the whole point of the layout.
    if (panel.actors.length < 2) return null;

    const ids = new Set(panel.actors.map((a) => a.id));
    panel.beats = (Array.isArray(o.beats) ? o.beats : [])
      .map((b) => {
        const r = b && typeof b === 'object' ? b : {};
        const actor = clean(r.actor, 24);
        const action = clean(r.action, 16);
        // A beat aimed at an actor that was never declared moves nothing, and a
        // verb outside the vocabulary has no implementation behind it.
        if (!ids.has(actor) || !MOTION_ACTIONS.includes(action)) return null;
        const beat = { actor, action };
        const to = clean(r.to, 24);
        // Pointing at itself would compute a zero-length move and read as a stall.
        if (to && ids.has(to) && to !== actor) beat.to = to;
        if (Number.isFinite(Number(r.x))) beat.x = coord(r.x, 0.5);
        if (Number.isFinite(Number(r.y))) beat.y = coord(r.y, 0.5);
        const cue = clean(r.cue, 40);
        if (cue) beat.cue = cue;
        return beat;
      })
      .filter(Boolean)
      .slice(0, 8);

    // Actors with nothing happening to them is a still life, not a motion
    // scene; the other layouts draw a static arrangement far better.
    return panel.beats.length ? panel : null;
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

/**
 * What is wrong with the motion scenes in a freshly written storyboard.
 *
 * A motion scene fails quietly. A cue the narrator never says still animates -
 * just on a guess rather than on the voice - and nobody watching the render
 * knows why it feels loose. So the storyboard is checked the moment it arrives,
 * while the fix is still one regenerate away.
 *
 * Returns plain sentences, not error objects: these are read by a person in a
 * black window, not handled by code.
 */
export function checkMotion(content) {
  const notes = [];
  const scenes = Array.isArray(content && content.script) ? content.script : [];

  scenes.forEach((line, i) => {
    if (!line || line.kind !== 'motion' || !line.panel) return;
    const where = 'scene ' + (i + 1);
    const beats = line.panel.beats || [];
    const actors = line.panel.actors || [];

    const cues = beats.map((b) => b.cue || '');
    const unusable = cues.filter((c) => !c).length;
    if (unusable) {
      notes.push(where + ': ' + unusable + ' beat(s) have no cue, so they can only be guessed at.');
    }

    const missing = missingCues(line.narration || '', cues.filter(Boolean));
    if (missing.length) {
      notes.push(where + ': the narration never says ' + missing.map((c) => '"' + c + '"').join(', ')
        + ', so those beats cannot fire on the voice.');
    }

    // A beat cued on the last handful of words has no room to play before the
    // scene cuts. The animation is not wrong, it is just never seen.
    const spoken = String(line.narration || '').split(/\s+/).filter(Boolean);
    if (spoken.length > 6) {
      // Whole words only: a substring test would match "is" inside "this".
      const strip = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
      const tail = new Set(spoken.slice(-4).map(strip));
      const late = cues.filter((c) => c && tail.has(strip(c.split(/\s+/)[0])));
      if (late.length) {
        notes.push(where + ': "' + late[0] + '" is cued on the last few words, so that beat will'
          + ' barely be seen. Move it earlier in the sentence.');
      }
    }

    // Two actors on the same spot draw on top of each other.
    for (let a = 0; a < actors.length; a++) {
      for (let b = a + 1; b < actors.length; b++) {
        const dx = Math.abs(actors[a].x - actors[b].x);
        const dy = Math.abs(actors[a].y - actors[b].y);
        // Hidden actors are allowed to share a spot: they arrive later, usually
        // exactly where the thing they replace or attach to already is.
        if (dx < 0.12 && dy < 0.12 && !actors[a].hidden && !actors[b].hidden) {
          notes.push(where + ': "' + actors[a].id + '" and "' + actors[b].id
            + '" start almost on top of each other.');
        }
      }
    }
  });

  return notes;
}
