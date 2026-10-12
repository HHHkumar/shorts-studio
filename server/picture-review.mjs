// ---------------------------------------------------------------------------
// The picture review: a second pair of eyes on every diagram.
//
// The rules in sketch-contract.mjs and number-source.mjs stop a picture that
// was never fully stated, or that draws a number nobody gave. They cannot stop
// one that is fully stated and still wrong: a diode's curve under a line about
// a thyristor, a line's shunt capacitance drawn as two resistors, a switch
// where the line says "apply a test source". Whether a picture is TRUE OF THE
// LINE IT SITS ON is a judgement, so it is asked of a model whose only job is
// to make it - with the question, the answer, the line, the picture in words,
// and the frame as it will be rendered.
//
// Two reviewers when both keys are there: Gemini, which can see the frame, and
// DeepSeek, which did not write the script. A picture is taken out when they
// AGREE it should go. On the first real video checked, every picture both
// objected to was wrong - a line drawn as a battery and resistors, an arrow
// diagram too small to read - and every picture only one objected to was fine:
// a capacitor for a line's capacitance, a pair of labelled cards. A reviewer
// alone is quick to call a sound picture "generic"; two seldom make the same
// mistake. Where they differ the picture stays, marked for a person to judge.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { fetchRetrying } from './retry.mjs';
import { picturesIn } from './picture-words.mjs';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';

/** The four verdicts a reviewer may give, from best to worst. */
export const VERDICTS = ['right', 'unsure', 'unrelated', 'wrong'];

/** A picture with one of these verdicts is taken out of the video. */
export const isFlagged = (verdict) => verdict === 'wrong' || verdict === 'unrelated';

const SYSTEM_LINES = (withFrames) => [
  'You check the pictures in a short exam-preparation video, mostly electrical engineering, before',
  'it is published. A wrong picture is the worst fault such a video can have: a viewer believes a',
  'diagram more readily than a sentence. You are the last check.',
  '',
  'For each picture you are given the question, its correct answer, the line spoken while the',
  'picture is on screen, and what the picture shows, in words.'
    + (withFrames ? ' You are also given the frame as it' : ''),
  ...(withFrames ? [
    'will be rendered. The frame also carries the spoken line as large text, and sometimes a cartoon',
    'engineer: ignore both and judge the diagram. Where the frame and the words disagree, the frame',
    'is what the viewer sees - judge the frame, and say so.',
  ] : []),
  '',
  'Judge each picture against THE LINE IT SITS ON and against the question. One verdict each:',
  '- "right": it shows the thing the line says - the same component, the same relationship, the',
  '  same values - and nothing on it is false for this question. When the line states a general',
  '  principle, a correct general illustration of THAT principle is right: a parallel-plate',
  '  capacitor under a line about the capacitance between conductors, currents meeting at a node',
  '  under a line about charge not piling up there.',
  '- "wrong": something on it is false or misleading here. The usual faults:',
  '  * the wrong component or device: a resistor standing for an inductor, a capacitor, a reactor,',
  '    a winding or a back EMF; a diode\'s characteristic for a thyristor; a switch for a source.',
  '  * the wrong relationship: which of two quantities leads or lags, which is larger, which way',
  '    current or power flows, a phase shift where there is none.',
  '  * a value the question does not give and its working does not reach, drawn as though it were',
  '    data; or component values that do not agree with the numbers in the working.',
  '  * labels that name the wrong thing, or a label cut off part way through a word.',
  '  * on the question scene: anything that shows or gives away the answer. That scene may show',
  '    the setup the question describes and nothing more.',
  '  * a drawing that cannot be read: parts on top of each other, or too small to make out.',
  '- "unrelated": nothing on it is false in general, but it is not about what this line says: a',
  '  picture of some other idea from the same chapter, an analogy the line does not make, or a',
  '  picture with nothing in it. Simple is not unrelated, and neither is general.',
  '- "unsure": you cannot tell from what you were given. Say this rather than guess.',
  '',
  'Be strict about what is FALSE, and fair about what is merely plain: a schematic may be simple,',
  'and a picture is not wrong for leaving things out. It is wrong for showing something false.',
  'A "side by side" picture is two short labels, each under a small emoji. Judge what the labels',
  'say; the emoji is decoration and is never a reason to object.',
  '',
  'reason: one concrete sentence naming what is false or missing, e.g. "draws the line\'s shunt',
  'capacitance as two 50 ohm resistors". For "right", say what it shows correctly.',
  '',
  'Reply with JSON only: {"pictures": [{"n": <picture number>, "verdict": "right" | "wrong" |',
  '"unrelated" | "unsure", "reason": "..."}]} - one entry for every picture, in order.',
].join('\n');

export const REVIEW_SYSTEM = SYSTEM_LINES(true);
export const REVIEW_SYSTEM_TEXT = SYSTEM_LINES(false);

const BEAT = { question: 'on the question scene, before the answer', outro: 'on the closing scene' };

/** What a reviewer is told about the video, and the pictures it is asked about. */
export function buildReviewRequest(content, pictures) {
  const c = content || {};
  const lines = ['SUBJECT: ' + (c.subject || ''), 'TOPIC: ' + (c.topic || '')];
  if (c.question) lines.push('QUESTION: ' + c.question);
  if (Array.isArray(c.options) && c.options.length) {
    lines.push('OPTIONS: ' + c.options.join(' | '));
    if (c.options[c.correctIndex] !== undefined) lines.push('CORRECT ANSWER: ' + c.options[c.correctIndex]);
  }
  const steps = (c.explanation || []).filter(Boolean);
  if (steps.length) lines.push('WORKING: ' + steps.join(' / '));
  const formulas = (c.script || []).map((s) => s && s.visual && s.visual.kind === 'formula' && s.visual.formula).filter(Boolean);
  if (formulas.length) lines.push('FORMULAS SHOWN: ' + formulas.join(' ; '));
  const spoken = (c.script || []).filter((s) => s && (s.kind === 'answer' || s.kind === 'explain') && s.narration);
  if (spoken.length) {
    lines.push('', 'THE EXPLANATION, AS SPOKEN:');
    spoken.forEach((s, i) => lines.push('  ' + (i + 1) + '. ' + s.narration));
  }
  lines.push('', 'PICTURES TO CHECK:');
  pictures.forEach((p, i) => {
    lines.push('Picture ' + (i + 1) + ' - ' + (BEAT[p.beat] || 'on an explanation scene'));
    lines.push('  line: "' + p.narration + '"');
    lines.push('  shows: ' + p.words);
  });
  return lines.join('\n');
}

/** Dig the JSON object out of a reply that may have prose or a code fence around it. */
function parseLoose(text) {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the reply');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * A reviewer's reply, held to one verdict per picture. Pure, so it is tested
 * without a network. A picture the reply skipped, or gave a verdict that is
 * not one of the four, is "unsure" - never "right" by default.
 */
export function judgeReply(reply, pictures) {
  let list = [];
  try {
    const parsed = typeof reply === 'string' ? parseLoose(reply) : reply;
    list = Array.isArray(parsed && parsed.pictures) ? parsed.pictures : [];
  } catch {
    list = [];
  }
  const byNumber = new Map();
  for (const item of list) {
    const n = Number(item && item.n);
    if (Number.isInteger(n) && !byNumber.has(n)) byNumber.set(n, item);
  }
  return pictures.map((p, i) => {
    const item = byNumber.get(i + 1);
    const verdict = item && VERDICTS.includes(item.verdict) ? item.verdict : 'unsure';
    const reason = item && typeof item.reason === 'string' ? item.reason.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    return {
      scene: p.scene,
      key: p.key,
      verdict,
      reason: reason || (item ? '' : 'The reviewer gave no verdict on this picture.'),
    };
  });
}

/**
 * One verdict from what each reviewer said.
 *
 * A picture goes only when every reviewer who looked says it should - and
 * then by the worse of their verdicts. One alone may take out a picture it
 * calls WRONG, since there is nobody to contradict it; "unrelated" from one
 * reviewer alone is an opinion about relevance, and is left to a person.
 * Anything short of agreement is "unsure": kept, and shown with both views.
 */
export function settle(said) {
  const views = (said || []).filter((s) => s && VERDICTS.includes(s.verdict));
  if (!views.length) return { verdict: 'unsure', reason: '' };
  const against = views.filter((s) => isFlagged(s.verdict));
  const reasonOf = (verdict) => (views.find((s) => s.verdict === verdict) || {}).reason || '';

  if (against.length === views.length && (views.length > 1 || views[0].verdict === 'wrong')) {
    const verdict = views.some((s) => s.verdict === 'wrong') ? 'wrong' : 'unrelated';
    return { verdict, reason: reasonOf(verdict) };
  }
  if (against.length) {
    const who = against.map((s) => s.by + ' says ' + (s.verdict === 'wrong' ? 'wrong' : 'beside the point')
      + (s.reason ? ' (' + s.reason.replace(/\.$/, '') + ')' : '')).join('; ');
    const others = views.filter((s) => !isFlagged(s.verdict)).map((s) => s.by).join(' and ');
    return { verdict: 'unsure', reason: who + (others ? '; ' + others + ' does not.' : '. Nobody else looked.') };
  }
  if (views.some((s) => s.verdict === 'unsure')) return { verdict: 'unsure', reason: reasonOf('unsure') };
  return { verdict: 'right', reason: reasonOf('right') };
}

/** Reviews of the same pictures by several reviewers, settled picture by picture. */
export function combineReviews(named) {
  const sets = named.filter((s) => s && Array.isArray(s.reviews) && s.reviews.length);
  if (!sets.length) return [];
  return sets[0].reviews.map((first, i) => {
    const said = sets.map((set) => set.reviews[i] && { by: set.by, verdict: set.reviews[i].verdict, reason: set.reviews[i].reason }).filter(Boolean);
    return { scene: first.scene, key: first.key, ...settle(said), said };
  });
}

async function askGemini({ apiKey, model, text, frames }) {
  const parts = [{ text }];
  for (const f of frames) {
    parts.push({ text: 'THE FRAME FOR PICTURE ' + f.n + ':' });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: fs.readFileSync(f.file).toString('base64') } });
  }
  const body = {
    systemInstruction: { parts: [{ text: frames.length ? REVIEW_SYSTEM : REVIEW_SYSTEM_TEXT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          pictures: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                n: { type: 'INTEGER' },
                verdict: { type: 'STRING', enum: ['right', 'wrong', 'unrelated', 'unsure'] },
                reason: { type: 'STRING' },
              },
              required: ['n', 'verdict', 'reason'],
              propertyOrdering: ['n', 'reason', 'verdict'],
            },
          },
        },
        required: ['pictures'],
      },
    },
  };
  const res = await fetchRetrying(GEMINI + '/' + encodeURIComponent(model || 'gemini-2.5-flash') + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = (JSON.parse(raw).error || {}).message || ''; } catch { detail = raw.slice(0, 200); }
    if (res.status === 429) throw new Error('Gemini rate limit hit. Wait a minute and check the pictures again.');
    throw new Error('Gemini could not check the pictures (' + res.status + '): ' + (detail || 'unknown'));
  }
  const payload = JSON.parse(raw);
  return ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

async function askDeepseek({ apiKey, model, text }) {
  const chosen = model || 'deepseek-chat';
  const body = {
    model: chosen,
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_TEXT },
      { role: 'user', content: text + '\n\nReply with json.' },
    ],
    temperature: 0,
    max_tokens: 1800,
  };
  if (!/reasoner/i.test(chosen)) body.response_format = { type: 'json_object' };
  const res = await fetchRetrying(DEEPSEEK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error('DeepSeek could not check the pictures (' + res.status + ').');
  const payload = JSON.parse(raw);
  return (payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content) || '';
}

/**
 * Review every picture in a video that states something.
 *
 * `frames` is [{ scene, file }] from renderSceneFrames, or empty - the review
 * then goes on the words alone, and says so. Returns one review per picture,
 * who gave it, and anything that went wrong with a reviewer; it throws only
 * when no reviewer answered at all.
 */
export async function reviewPictures({ content, geminiKey, geminiModel, deepseekKey, deepseekModel, frames = [] }) {
  const pictures = picturesIn(content);
  if (!pictures.length) return { reviews: [], pictures: [], by: [], sawFrames: false, problems: [] };
  if (!geminiKey && !deepseekKey) throw new Error('Checking the pictures needs a Gemini or a DeepSeek key. Add one on the Keys step.');

  const text = buildReviewRequest(content, pictures);
  const numbered = frames
    .map((f) => ({ ...f, n: pictures.findIndex((p) => p.scene === f.scene) + 1 }))
    .filter((f) => f.n > 0 && f.file && fs.existsSync(f.file));

  const jobs = [];
  if (geminiKey) {
    jobs.push(askGemini({ apiKey: geminiKey, model: geminiModel, text, frames: numbered })
      .then((reply) => ({ by: 'Gemini', reviews: judgeReply(reply, pictures) })));
  }
  if (deepseekKey) {
    jobs.push(askDeepseek({ apiKey: deepseekKey, model: deepseekModel, text })
      .then((reply) => ({ by: 'DeepSeek', reviews: judgeReply(reply, pictures) })));
  }
  const settled = await Promise.allSettled(jobs);
  const answered = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  const problems = settled.filter((s) => s.status === 'rejected').map((s) => (s.reason && s.reason.message) || String(s.reason));
  if (!answered.length) throw new Error(problems[0] || 'No reviewer answered.');

  const reviews = combineReviews(answered).map((r, i) => ({
    ...r,
    words: pictures[i].words,
    narration: pictures[i].narration,
    frame: (frames.find((f) => f.scene === r.scene) || {}).url || '',
  }));
  return {
    reviews,
    pictures,
    by: answered.map((a) => a.by),
    sawFrames: Boolean(geminiKey && numbered.length && answered.some((a) => a.by === 'Gemini')),
    problems,
  };
}
