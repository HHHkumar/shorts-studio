// ---------------------------------------------------------------------------
// Talks to Google Gemini and comes back with a complete, ready-to-shoot
// video: the question, the answer, the explanation AND the narration script
// broken into the exact scenes the Remotion composition expects.
// ---------------------------------------------------------------------------

import { SKETCH_NAMES, sketchPromptLines } from './sketch-catalogue.mjs';
import { fetchRetrying } from './retry.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Kinds Gemini is allowed to emit. 'intro' is deliberately absent: that scene is
// the creator's own greeting and is inserted verbatim, never written by a model.
const SCENE_KINDS = ['hook', 'question', 'options', 'countdown', 'answer', 'explain', 'outro'];

// Structured output: Gemini is forced to return exactly this shape, so we never
// have to fish JSON out of prose.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    subject: { type: 'STRING' },
    topic: { type: 'STRING' },
    difficulty: { type: 'STRING' },
    hook: { type: 'STRING' },
    question: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' } },
    correctIndex: { type: 'INTEGER' },
    answerLine: { type: 'STRING' },
    explanation: { type: 'ARRAY', items: { type: 'STRING' } },
    funFact: { type: 'STRING' },
    outro: { type: 'STRING' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    motifSymbols: { type: 'ARRAY', items: { type: 'STRING' } },
    script: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: SCENE_KINDS },
          narration: { type: 'STRING' },
          imageQuery: { type: 'STRING' },
          visual: {
            type: 'OBJECT',
            properties: {
              kind: { type: 'STRING', enum: ['none', 'formula', 'bars', 'compare', 'icon', 'sketch'] },
              formula: { type: 'STRING' },
              caption: { type: 'STRING' },
              sketch: { type: 'STRING', enum: SKETCH_NAMES },
              params: {
                type: 'OBJECT',
                properties: {
                  mode: { type: 'STRING' },
                  angle: { type: 'NUMBER' },
                  speed: { type: 'NUMBER' },
                  frequency: { type: 'NUMBER' },
                  amplitude: { type: 'NUMBER' },
                  count: { type: 'NUMBER' },
                  ratio: { type: 'NUMBER' },
                  labelA: { type: 'STRING' },
                  labelB: { type: 'STRING' },
                },
                propertyOrdering: [
                  'mode', 'angle', 'speed', 'frequency', 'amplitude', 'count', 'ratio', 'labelA', 'labelB',
                ],
              },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    label: { type: 'STRING' },
                    value: { type: 'NUMBER' },
                    symbol: { type: 'STRING' },
                  },
                  required: ['label'],
                  propertyOrdering: ['label', 'value', 'symbol'],
                },
              },
            },
            required: ['kind'],
            propertyOrdering: ['kind', 'formula', 'caption', 'items', 'sketch', 'params'],
          },
        },
        required: ['kind', 'narration'],
        propertyOrdering: ['kind', 'narration', 'imageQuery', 'visual'],
      },
    },
  },
  required: [
    'subject', 'topic', 'difficulty', 'hook', 'question', 'options', 'correctIndex',
    'answerLine', 'explanation', 'funFact', 'outro', 'hashtags', 'motifSymbols', 'script',
  ],
  propertyOrdering: [
    'subject', 'topic', 'difficulty', 'hook', 'question', 'options', 'correctIndex',
    'answerLine', 'explanation', 'funFact', 'outro', 'hashtags', 'motifSymbols', 'script',
  ],
};

const SYSTEM = [
  'You write short-form science and maths quiz videos (YouTube Shorts, Reels and TikTok, plus',
  'longer landscape explainers). You always return one multiple-choice question with exactly 4',
  'options, and a narration script.',
  '',
  'THE NARRATION IS ALSO THE ON-SCREEN TEXT. Every word you write is spoken aloud AND drawn on',
  'the screen, a few words at a time, highlighting as it is said. There is no separate headline.',
  'So every line must work as speech and as large display type at the same time.',
  '',
  'HARD RULES FOR NARRATION:',
  '- Write it exactly as it should be spoken. No markdown, no asterisks, no LaTeX, no code fences.',
  '- Spell symbols out in words: "x squared", not "x^2". "9.8 metres per second squared", not "9.8 m/s^2".',
  '- One idea per scene. The word budget per scene is given in the request - follow it closely,',
  '  because it is what decides whether the finished video hits its target length.',
  '- Short sentences inside that. Conversational, second person. No filler like "In this video".',
  '- Never refer to options by letter ("option A"); say the option text itself.',
  '',
  'SCENE ORDER, exactly once each unless noted:',
  '1. hook      - one scroll-stopping line, under 12 words.',
  '2. question  - the question text, word for word, and nothing else. No "here is your question".',
  '3. options   - read the four options in order, in the same wording as the options array,',
  '               separated naturally, e.g. "Is it the hammer, the feather, both together, or neither?".',
  '               Each option lights up on screen as you say it, so the order and wording must match.',
  '4. countdown - an empty string. This beat is a silent timer.',
  '5. answer    - the answer in one short sentence, and nothing else.',
  '6. explain   - as many as the request asks for, one idea each, at the word budget given.',
  '7. outro     - the fun fact plus a short call to action.',
  '',
  'The four options must all be plausible. Exactly one is correct. correctIndex is 0-based.',
  'Do not put "A)", "B)" or bullet characters inside the option strings.',
  '',
  'DIAGRAMS. Use them generously. A wall of text is a weak video; showing the thing is what makes',
  'an explainer worth watching. Reach for one whenever there is something to show.',
  '',
  'Where they are allowed:',
  '- explain and outro scenes: any kind.',
  '- question scene: a SETUP diagram only - the circuit, the apparatus, the geometry being asked',
  '  about. It must not hint at which option is correct. Use "sketch" or "formula" here, never',
  '  bars, compare or icon, and never a graph or pie, because a plotted curve usually IS the answer.',
  '- hook, options, countdown and answer: always "none".',
  '- formula : one short equation in plain unicode, e.g. "F = m × a" or "v² = u² + 2as".',
  '            Under 30 characters, in the "formula" field. Best for a calculation step.',
  '- bars    : 2 to 4 quantities compared. Each item needs a label and a numeric value, all in',
  '            the SAME unit, and the unit goes in "caption", e.g. "Surface gravity, m/s²".',
  '            Best for "which is bigger". Never invent numbers you are not confident about.',
  '- compare : exactly 2 things side by side. Each item needs a short label and one emoji as',
  '            "symbol". Best for before/after, or here/there.',
  '- icon    : one emoji as "symbol" plus a 1-3 word label.',
  '- sketch  : a real animation from the library below.',
  '- none    : no diagram for this scene.',
  'Say nothing in a diagram that gives away the answer before the answer scene.',
  '',
  ...sketchPromptLines(),
  '',
  'motifSymbols: 3 to 6 single emoji or symbols evoking the topic, e.g. ["🪐","🌙","⭐","g"].',
  'They drift faintly in the background, so pick things that read at a glance.',
  '',
  'imageQuery: 2 to 4 words used to search a photo library for a backdrop for that scene.',
  '- Name something PHOTOGRAPHABLE. "telescope observatory night", not "the nature of gravity".',
  '- Concrete objects, places, apparatus, materials, organisms. Never abstractions or equations.',
  '- For space, physics and earth science, prefer terms NASA would have: "spiral galaxy hubble",',
  '  "lunar surface astronaut", "hurricane from orbit".',
  '- Leave it as an empty string when no honest photo exists for the idea. An empty string is',
  '  much better than a misleading stock picture.',
  '- Always empty for the options and countdown scenes.',
  '- For the hook and question scenes, keep it broad and atmospheric - the subject in general,',
  '  never the specific thing that is the answer. A photo of Venus over the hook of a question',
  '  whose answer is Venus gives it away.',
].join('\n');

// ---------------------------------------------------------------------------
// Length budgeting
// ---------------------------------------------------------------------------

/** A natural narration pace, in words per second. */
const WORDS_PER_SECOND = 2.6;

/**
 * Roughly how many words the fixed beats eat: the hook, the question, reading
 * the four options, the answer and the outro. Everything left over is the
 * explanation, which is the part that actually scales with the target length.
 */
const FIXED_BEAT_WORDS = 85;

/**
 * Turn "I want a 300 second video" into instructions a model can follow.
 *
 * This is the whole reason long-form used to come out under a minute: the
 * prompt asked for 300 seconds while simultaneously capping every scene at 22
 * words and the explanation at 8 scenes, which together cannot exceed about
 * 100 seconds. The budget now falls out of the target instead of fighting it.
 */
export function scriptBudget(targetSeconds, orientation) {
  const target = Math.max(15, Number(targetSeconds) || 45);
  const longForm = target >= 120 || orientation === 'landscape';

  const totalWords = Math.round(target * WORDS_PER_SECOND);
  const explainWords = Math.max(30, totalWords - FIXED_BEAT_WORDS);

  // Long-form earns longer beats: a 45-word scene runs about 17 seconds, which
  // is a comfortable dwell time on a 16:9 screen. Shorts stay punchy.
  const wordsPerScene = longForm ? 45 : 17;
  const explainCount = Math.min(20, Math.max(2, Math.round(explainWords / wordsPerScene)));

  return {
    target,
    longForm,
    totalWords,
    explainCount,
    // Spread the budget evenly over however many scenes we settled on.
    wordsPerScene: Math.round(explainWords / explainCount),
  };
}

function budgetLines(budget) {
  const lines = [];
  lines.push('');
  lines.push('LENGTH BUDGET - this decides whether the video hits its target, so treat it as a hard spec:');
  lines.push('- Total spoken words across every scene: about ' + budget.totalWords + '.');
  lines.push('- Write exactly ' + budget.explainCount + ' explain scenes.');
  lines.push('- Each explain scene: about ' + budget.wordsPerScene + ' words. Do not go under ' +
    Math.round(budget.wordsPerScene * 0.8) + '.');
  lines.push('- Scenes coming out too short is the most common failure here. A 12-word scene where ' +
    budget.wordsPerScene + ' was asked for leaves the finished video less than half the length wanted.');

  if (budget.longForm) {
    lines.push('');
    lines.push('This is a LONG-FORM EXPLAINER, not a short. Those ' + budget.explainCount +
      ' scenes must be a real explanation that builds, not one point restated. Give it an arc:');
    lines.push('  a. Ground it - what the viewer already knows, and why the obvious answer is tempting.');
    lines.push('  b. The key idea - the one concept the whole thing turns on.');
    lines.push('  c. The mechanism - how it actually works, step by step.');
    lines.push('  d. A worked example with real numbers, if the subject allows it.');
    lines.push('  e. The common misconception, named and corrected.');
    lines.push('  f. Where it shows up in the real world, and why it matters.');
    lines.push('Each scene still says ONE thing. Depth comes from the sequence, not from cramming.');
    lines.push('Use the diagram field often here - a formula, a bar chart or a sketch every few scenes.');
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Exam preparation
// ---------------------------------------------------------------------------

/**
 * What each paper actually asks for. The same syllabus topic makes a very
 * different question for GATE than for an ITI trade test, and getting this
 * wrong is the difference between useful revision and a video nobody finishes.
 */
const EXAM_STYLE = {
  'GATE EE': 'Analytical and numerical. One or two steps of real derivation, standard symbols, '
    + 'and a distractor that catches a common conceptual error. Assume a strong degree-level base.',
  'ESE / IES (Electrical)': 'Conceptual breadth with some numerics. Favour standards, definitions '
    + 'and comparisons between methods. Assume degree level.',
  'SSC JE (Electrical)': 'Direct application of a standard formula, or straight factual recall. '
    + 'Solvable in under a minute. Diploma level, no calculus.',
  'RRB JE (Electrical)': 'Definitions, standard values and single-formula numericals. '
    + 'Diploma level, quick to answer, no derivation.',
  'State AE / JE (Electrical)': 'Standard formulas plus basic theory, in the style of a state '
    + 'engineering services paper. Diploma to degree level.',
  'PSU — UPPCL / DMRC / NTPC / BHEL': 'GATE-flavoured but a step easier. Practical plant and '
    + 'utility context is welcome. Degree level.',
  'ITI / Wireman / Electrician trade': 'Strictly practical. Wiring, tools, ratings, cable sizes, '
    + 'earthing, IE rules and safety. Absolutely no calculus and no derivations.',
  'Working professional / plant engineer': 'Written for someone who does this job. Operational '
    + 'reality over textbook theory: what actually happens on the plant, why it is done that way, '
    + 'typical values, failure modes and safe practice. No exam framing.',
};

const DIAGRAM_DENSITY = {
  sparse: 'Use a diagram only where it genuinely earns its place - roughly one explain scene in three.',
  balanced: 'Put a diagram on most explain scenes, and on the question scene when there is a setup worth showing.',
  rich: 'Put a diagram on EVERY explain scene, and a setup diagram on the question scene. '
    + 'Vary the kind - do not use the same one twice in a row. If nothing fits a scene, prefer a '
    + 'sketch over leaving it bare.',
};

function densityLine(o) {
  const key = DIAGRAM_DENSITY[o.diagramDensity] ? o.diagramDensity : 'balanced';
  return '- Diagram density: ' + DIAGRAM_DENSITY[key];
}

function examLines(o) {
  if (o.contentType !== 'electrical') return [];

  const exam = o.exam && EXAM_STYLE[o.exam] ? o.exam : 'GATE EE';
  const professional = exam === 'Working professional / plant engineer';

  const lines = ['', professional
    ? 'THIS IS PROFESSIONAL CONTENT for people working in the field, not a curiosity short.'
    : 'THIS IS EXAM PREPARATION, not a curiosity short.'];

  lines.push('- Audience: ' + exam);
  lines.push('- Style required: ' + EXAM_STYLE[exam]);
  lines.push('- Syllabus area: ' + o.subject + '. Stay inside it.');
  lines.push('- The question must be answerable from standard course material, with one');
  lines.push('  unambiguously correct option. No trick wording.');
  lines.push('- Use the symbols, units and terminology of Indian engineering practice.');
  lines.push('- Make the wrong options the mistakes candidates actually make - a swapped formula,');
  lines.push('  a missing root three, a confused per-phase and per-line value - not random numbers.');

  if (!professional) {
    lines.push('- The hook may still be attention-grabbing, but the question itself must look like');
    lines.push('  it came off a real paper. Accuracy matters more than surprise here.');
  }

  return lines;
}

function curiosityHint(c) {
  const n = Number(c) || 5;
  if (n <= 3) return '  (Low: keep it a straightforward textbook question, plainly worded.)';
  if (n <= 6) return '  (Medium: a familiar idea with one mildly surprising twist.)';
  if (n <= 8) return '  (High: pick a counter-intuitive result. The hook should feel like a challenge.)';
  return '  (Maximum: choose something that sounds impossible until explained. The answer should make the viewer say "wait, what?".)';
}

function buildPrompt(o) {
  const budget = scriptBudget(o.targetSeconds, o.orientation);
  const lines = [];
  lines.push('Make one quiz video with these settings:');
  lines.push('- Subject: ' + o.subject);
  if (o.topic && o.topic.trim()) lines.push('- Specific topic: ' + o.topic.trim());
  else lines.push('- Specific topic: your choice, pick something genuinely interesting inside this subject.');
  lines.push('- Audience level: ' + o.level);
  lines.push('- Difficulty: ' + o.difficulty);
  lines.push('- Flavour: ' + o.flavour);
  lines.push('- Curiosity factor: ' + o.curiosity + ' out of 10.');
  lines.push(curiosityHint(o.curiosity));
  lines.push('- Tone of voice: ' + o.tone);
  lines.push('- Language: ' + o.language);
  lines.push('- Target finished length: about ' + budget.target + ' seconds of narration in total.');
  lines.push('- Format: ' + (o.orientation === 'landscape' ? '16:9 landscape' : '9:16 vertical short'));

  if (o.flavour === 'Mathematical') {
    lines.push('- The question must require an actual calculation. The explain scenes must show the working, one step per scene.');
  } else if (o.flavour === 'Theoretical') {
    lines.push('- The question must test conceptual understanding, not arithmetic. No number-crunching.');
  } else if (o.flavour === 'Real-world application') {
    lines.push('- Anchor the question in a concrete everyday situation the viewer has seen before.');
  } else {
    lines.push('- Mix a little reasoning with a little calculation.');
  }

  if (o.avoid && o.avoid.trim()) lines.push('- Avoid these topics or question types: ' + o.avoid.trim());
  if (o.extra && o.extra.trim()) lines.push('- Extra instructions from the creator: ' + o.extra.trim());

  lines.push(densityLine(o));
  examLines(o).forEach((l) => lines.push(l));
  budgetLines(budget).forEach((l) => lines.push(l));

  lines.push('');
  lines.push('Return only the JSON object.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Model listing
// ---------------------------------------------------------------------------

/**
 * Ask the key which models it can actually use. Hard-coding a list goes stale
 * every few months and produces a confusing 404, so the dropdown is built from
 * whatever Google says this specific key has access to.
 */
export async function listModels(apiKey) {
  const collected = [];
  let pageToken = '';

  for (let page = 0; page < 5; page++) {
    const url = ENDPOINT + '?pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetchRetrying(url, { headers: { 'x-goog-api-key': apiKey } });
    const raw = await res.text();
    if (!res.ok) throw new Error(explainGeminiError(res.status, raw));

    const data = JSON.parse(raw);
    for (const m of data.models || []) collected.push(m);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const usable = collected
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      displayName: m.displayName || '',
    }))
    .filter((m) => /^gemini-/i.test(m.id))
    // These exist but cannot write a JSON quiz script.
    .filter((m) => !/embedding|aqa|vision|image|audio|tts|live|realtime|robotics|computer-use/i.test(m.id));

  const seen = new Set();
  const unique = usable.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));

  unique.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

  // Recommend a plain "flash" build if the key has one - best speed/cost balance.
  const recommended = unique.find((m) => /^gemini-[\d.]+-flash$/i.test(m.id)) || unique[0];

  return unique.map((m) => ({
    id: m.id,
    label:
      (m.displayName || m.id) +
      (recommended && m.id === recommended.id ? ' — recommended' : '') +
      (isPreview(m.id) ? ' (preview)' : ''),
  }));
}

const isPreview = (id) => /preview|exp|latest|-\d{2}-\d{2}$/i.test(id);

/**
 * Sort order, most important first: stable builds before previews, newer
 * generations before older ones, then flash / pro / flash-lite within a
 * generation. Version has to outweigh family, or an old 1.5 Flash would
 * outrank the current 2.5 Pro.
 */
function rank(id) {
  const previewPenalty = isPreview(id) ? 1000 : 0;
  const version = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');

  let family = 9;
  if (/flash-lite/i.test(id)) family = 3;
  else if (/flash/i.test(id)) family = 1;
  else if (/pro/i.test(id)) family = 2;

  return previewPenalty - version * 10 + family;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateContent(apiKey, model, options) {
  const parsed = await callGemini(apiKey, model, {
    system: SYSTEM,
    prompt: buildPrompt(options),
    schema: RESPONSE_SCHEMA,
    temperature: 0.4 + (Number(options.curiosity) || 5) * 0.06,
  });
  return normalizeContent(parsed, options);
}

/**
 * One structured-JSON call to Gemini, with every failure translated into
 * something a person can act on.
 *
 * Shared with the explainer storyboard: the two generators differ only in their
 * prompt and their schema, and duplicating the retry, parse and error handling
 * would mean fixing the same bug twice.
 */
export async function callGemini(apiKey, model, { system, prompt, schema, temperature }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      topP: 0.95,
      // No maxOutputTokens on purpose. On the 2.5 models the thinking tokens
      // count against it, so a fixed 8192 truncated long scripts before they
      // were finished; each model's own maximum is the right ceiling here.
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(explainGeminiError(res.status, raw));

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Gemini sent back something that was not JSON. Try again.');
  }

  const candidate = payload.candidates && payload.candidates[0];
  if (!candidate) {
    const blocked = payload.promptFeedback && payload.promptFeedback.blockReason;
    throw new Error(
      blocked
        ? 'Gemini refused this topic (' + blocked + '). Try a different topic.'
        : 'Gemini returned no result. Try again.',
    );
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini ran out of room before finishing. Lower the target length and try again.');
  }

  const text = (candidate.content && candidate.content.parts ? candidate.content.parts : [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned an empty script. Try again.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Very rare with responseSchema, but be forgiving anyway.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Could not read the script Gemini sent back. Try again.');
    parsed = JSON.parse(text.slice(start, end + 1));
  }

  return parsed;
}

function explainGeminiError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.error && j.error.message) || '';
  } catch {
    detail = raw.slice(0, 300);
  }
  if (status === 400 && /API key not valid/i.test(detail)) {
    return 'That Gemini API key was rejected. Check for stray spaces and paste it again.';
  }
  if (status === 403) return 'Gemini refused the key (403). Make sure the Generative Language API is enabled for it.';
  if (status === 404) {
    return 'Your key cannot use that Gemini model. Reload the page so the dropdown refreshes with the models your key does have, then pick one from the top of the list.';
  }
  if (status === 429) return 'Gemini rate limit hit. Wait about a minute and press Generate again.';
  if (status === 503) {
    return 'Google’s servers are busy right now, and the tool already retried three times. Wait a few seconds and press the button again — or switch to a Flash model, which is far less contended than Pro.';
  }
  if (status >= 500) return 'Google had a server error (' + status + '). It was retried automatically; try again in a moment.';
  return 'Gemini error ' + status + ': ' + (detail || 'unknown');
}

// ---------------------------------------------------------------------------
// Repair whatever came back so the rest of the app can trust it.
// ---------------------------------------------------------------------------

const KIND_RANK = {
  intro: -1, hook: 0, question: 1, options: 2, countdown: 3, answer: 4, explain: 5, outro: 6,
};

const clean = (v, fallback = '') => {
  const s = typeof v === 'string' ? v : '';
  const out = s
    .replace(/\*\*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    // Unwrap LaTeX inline maths ($x$ -> x). Only matched pairs with no spaces
    // inside are touched, so a lone currency symbol like $5 survives.
    .replace(/\$([^$\s]{1,40})\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return out || fallback;
};

export function normalizeContent(input, options) {
  const c = input && typeof input === 'object' ? input : {};

  let opts = Array.isArray(c.options) ? c.options.map((o) => clean(o)).filter(Boolean) : [];
  // Strip a genuine list marker like "A) " or "2. ", but require the space:
  // without it, an option of "9.8 m/s" would lose its "9." and become "8 m/s".
  opts = opts.map((o) => o.replace(/^\s*(?:[A-Da-d]|\d{1,2})[).:\-]\s+/, '').trim());
  opts = Array.from(new Set(opts)).slice(0, 4);

  // Pad with *distinct* fillers - four identical "None of these" rows on screen
  // look broken, and the viewer cannot tell them apart.
  const FILLERS = ['None of these', 'Not enough information', 'Cannot be determined', 'All of the above'];
  for (const filler of FILLERS) {
    if (opts.length >= 4) break;
    if (!opts.includes(filler)) opts.push(filler);
  }

  let correctIndex = Number.isInteger(c.correctIndex) ? c.correctIndex : 0;
  if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;

  const content = {
    subject: clean(c.subject, options.subject),
    topic: clean(c.topic, options.topic || options.subject),
    difficulty: clean(c.difficulty, options.difficulty),
    hook: clean(c.hook, 'Can you solve this?'),
    question: clean(c.question, 'Which one is correct?'),
    options: opts,
    correctIndex,
    answerLine: clean(c.answerLine, 'The answer is ' + opts[correctIndex] + '.'),
    explanation: (Array.isArray(c.explanation) ? c.explanation : []).map((e) => clean(e)).filter(Boolean).slice(0, 4),
    funFact: clean(c.funFact),
    outro: clean(c.outro, 'Follow for one more every day.'),
    hashtags: (Array.isArray(c.hashtags) ? c.hashtags : [])
      .map((h) => clean(h).replace(/^#/, '').replace(/\s+/g, ''))
      .filter(Boolean)
      .slice(0, 5),
    motifSymbols: (Array.isArray(c.motifSymbols) ? c.motifSymbols : [])
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter((m) => m && m.length <= 4)
      .slice(0, 6),
    script: [],
  };

  let script = (Array.isArray(c.script) ? c.script : [])
    .map((s) => ({
      kind: SCENE_KINDS.includes(s && s.kind) ? s.kind : 'explain',
      narration: clean(s && s.narration),
      imageQuery: clean(s && s.imageQuery).slice(0, 60),
      visual: normalizeVisual(s && s.visual, SCENE_KINDS.includes(s && s.kind) ? s.kind : 'explain'),
    }))
    .filter((s) => s.narration || s.kind === 'countdown');

  // Keep the storytelling order no matter what order the model emitted.
  script = script
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (KIND_RANK[a.s.kind] - KIND_RANK[b.s.kind]) || (a.i - b.i))
    .map((x) => x.s);

  // Fill in any beat the model skipped, so the video is never missing a step.
  const has = (k) => script.some((s) => s.kind === k);
  const blank = { kind: 'none' };

  if (!has('hook')) {
    script.unshift({ kind: 'hook', narration: content.hook, imageQuery: '', visual: blank });
  }
  if (!has('question')) {
    script.splice(1, 0, { kind: 'question', narration: content.question, imageQuery: '', visual: blank });
  }
  if (!has('options')) {
    // Lower-case the leading word only when it is a determiner or pronoun, so
    // "The hammer" reads naturally mid-sentence but "Jupiter" keeps its capital.
    const SAFE_TO_LOWER = new Set([
      'the', 'a', 'an', 'they', 'it', 'both', 'neither', 'either', 'all',
      'none', 'some', 'no', 'not', 'nothing', 'everything', 'more', 'less',
    ]);
    const spokenOption = (o) => {
      const first = o.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
      return SAFE_TO_LOWER.has(first) ? o.charAt(0).toLowerCase() + o.slice(1) : o;
    };
    const said = content.options.map(spokenOption);
    const spoken = 'Is it ' + said.slice(0, -1).join(', ') + ', or ' + said[said.length - 1] + '?';

    const at = script.findIndex((s) => KIND_RANK[s.kind] > KIND_RANK.options);
    script.splice(at === -1 ? script.length : at, 0, {
      kind: 'options', narration: spoken, imageQuery: '', visual: blank,
    });
  }
  if (!has('countdown')) {
    const at = script.findIndex((s) => KIND_RANK[s.kind] > KIND_RANK.countdown);
    script.splice(at === -1 ? script.length : at, 0, {
      kind: 'countdown', narration: '', imageQuery: '', visual: blank,
    });
  }
  if (!has('answer')) {
    const at = script.findIndex((s) => KIND_RANK[s.kind] > KIND_RANK.answer);
    script.splice(at === -1 ? script.length : at, 0, {
      kind: 'answer', narration: content.answerLine, imageQuery: '', visual: blank,
    });
  }
  if (!has('explain') && content.explanation.length) {
    const at = script.findIndex((s) => s.kind === 'outro');
    const steps = content.explanation.map((e) => ({
      kind: 'explain', narration: e, imageQuery: '', visual: blank,
    }));
    script.splice(at === -1 ? script.length : at, 0, ...steps);
  }
  if (!has('outro')) {
    script.push({
      kind: 'outro',
      narration: (content.funFact ? content.funFact + ' ' : '') + content.outro,
      imageQuery: '',
      visual: blank,
    });
  }

  // The creator's greeting goes first, exactly as they typed it.
  const intro = clean(options.intro);
  if (intro) {
    script = script.filter((line) => line.kind !== 'intro');
    script.unshift({ kind: 'intro', narration: intro, imageQuery: '', visual: blank });
  }

  // The countdown is a silent timer beat: never narrate over it.
  script = script.map((s) => (s.kind === 'countdown' ? { ...s, narration: '' } : s));

  content.script = script;
  return content;
}

// ---------------------------------------------------------------------------
// Diagram validation
// ---------------------------------------------------------------------------

const VISUAL_KINDS = ['none', 'formula', 'bars', 'compare', 'icon', 'sketch'];

/**
 * Scenes that never carry a diagram. Everything before the reveal, because a
 * picture there gives the answer away; plus the answer scene itself, whose
 * screen is already filled by the four options lighting up.
 */
const NO_DIAGRAM_KINDS = new Set(['intro', 'hook', 'options', 'countdown', 'answer']);

/**
 * The question scene may show the situation being asked about - the circuit,
 * the apparatus, the geometry - but nothing that hints at which option is
 * right. A plotted curve or a pie chart usually *is* the answer, so those two
 * stay out, and the caption is dropped because a caption is the easiest place
 * for the answer to leak.
 */
const SETUP_SAFE_SKETCHES = new Set([
  'circuit', 'transformer', 'phasor', 'waveform', 'block-flow', 'projectile',
  'pendulum', 'orbit', 'atom', 'refraction', 'vector-field', 'wave-interference', 'sine-wave',
]);

/** Only known knobs, only finite numbers, only short labels. */
function normalizeParams(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of ['angle', 'speed', 'frequency', 'amplitude', 'count', 'ratio']) {
    const n = Number(p[key]);
    // Each sketch clamps to its own sensible range; this only strips junk.
    if (Number.isFinite(n)) out[key] = n;
  }
  for (const key of ['mode', 'labelA', 'labelB']) {
    const v = clean(p[key]).slice(0, 24);
    if (v) out[key] = v;
  }
  return out;
}

/**
 * A malformed diagram must never reach the renderer: a "bars" visual with no
 * numbers, or a "compare" with one side missing, would draw a broken scene.
 * Anything that does not fully check out degrades to no diagram at all.
 */
function normalizeVisual(raw, sceneKind) {
  if (!raw || typeof raw !== 'object') return { kind: 'none' };
  // A diagram before the answer gives the game away: an icon captioned
  // "Venus mystery" on the opening screen tells the viewer the answer is Venus
  // before the question has even been read. Diagrams start after the reveal.
  if (NO_DIAGRAM_KINDS.has(sceneKind)) return { kind: 'none' };

  const kind = VISUAL_KINDS.includes(raw.kind) ? raw.kind : 'none';
  if (kind === 'none') return { kind: 'none' };

  const setupOnly = sceneKind === 'question';
  if (setupOnly) {
    if (kind === 'sketch') {
      if (!SETUP_SAFE_SKETCHES.has(clean(raw.sketch))) return { kind: 'none' };
    } else if (kind !== 'formula') {
      // bars, compare and icon nearly always encode the answer.
      return { kind: 'none' };
    }
  }

  const caption = setupOnly ? '' : clean(raw.caption).slice(0, 60);
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((it) => ({
      label: clean(it && it.label).slice(0, 40),
      value: Number(it && it.value),
      symbol: typeof (it && it.symbol) === 'string' ? it.symbol.trim().slice(0, 4) : '',
    }))
    .filter((it) => it.label || it.symbol);

  if (kind === 'sketch') {
    // An invented sketch name would silently draw nothing, so it is rejected
    // here, where falling back to no diagram at all is still tidy.
    const name = clean(raw.sketch);
    if (!SKETCH_NAMES.includes(name)) return { kind: 'none' };
    // Sketches share the items array: block-flow uses it for stage labels,
    // pie for slices, circuit for component values.
    return {
      kind,
      sketch: name,
      caption,
      params: normalizeParams(raw.params),
      items: items.slice(0, 5).map((it) => ({ label: it.label, value: it.value, symbol: it.symbol })),
    };
  }

  if (kind === 'formula') {
    const formula = clean(raw.formula).slice(0, 42);
    return formula ? { kind, formula, caption } : { kind: 'none' };
  }

  if (kind === 'bars') {
    const usable = items.filter((it) => Number.isFinite(it.value)).slice(0, 4);
    // Bars are meaningless without at least two real numbers to compare.
    if (usable.length < 2) return { kind: 'none' };
    return { kind, caption, items: usable.map((it) => ({ label: it.label, value: it.value })) };
  }

  if (kind === 'compare') {
    const pair = items.slice(0, 2);
    if (pair.length < 2) return { kind: 'none' };
    return { kind, caption, items: pair.map((it) => ({ label: it.label, symbol: it.symbol || '•' })) };
  }

  // icon
  const first = items[0];
  if (!first || !first.symbol) return { kind: 'none' };
  return { kind, caption, items: [{ label: first.label, symbol: first.symbol }] };
}
