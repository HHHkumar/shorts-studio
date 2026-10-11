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
// DeepSeek, which did not write the script. A picture is kept only when
// neither calls it wrong or unrelated. That errs towards no picture, which is
// the side this app means to err on.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { fetchRetrying } from './retry.mjs';
import { picturesIn } from './picture-words.mjs';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';

/** From best to worst. Two reviewers who differ are settled by the worse verdict. */
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
  '- "right": it shows the specific thing the line says - the same component, the same',
  '  relationship, the same values - and nothing on it is false for this question.',
  '- "wrong": something on it is false or misleading here. The usual faults:',
  '  * the wrong component or device: a resistor standing for an inductor, a capacitor, a reactor,',
  '    a winding or a back EMF; a diode\'s characteristic for a thyristor; a switch for a source.',
  '  * the wrong relationship: which of two quantities leads or lags, which is larger, which way',
  '    current or power flows, a phase shift where there is none.',
  '  * a value the question does not give and its working does not reach, drawn as though it were',
  '    data; or component values that do not agree with the numbers in the working.',
  '  * labels that name the wrong thing.',
  '- "unrelated": nothing on it is false in general, but it does not show what this line says: a',
  '  generic picture from the same chapter, an analogy the line does not make, a decoration, or a',
  '  picture with nothing in it.',
  '- "unsure": you cannot tell from what you were given. Say this rather than guess.',
  '',
  'Be strict about "right": when you hesitate between "right" and anything else, it is not',
  '"right". Be fair as well: a schematic may be simple, and a picture is not wrong for leaving',
  'things out. It is wrong for showing something false.',
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
 * Two reviews of the same pictures, settled by the worse verdict, with each
 * reviewer's reason kept beside its name.
 */
export function combineReviews(named) {
  const sets = named.filter((s) => s && Array.isArray(s.reviews) && s.reviews.length);
  if (!sets.length) return [];
  return sets[0].reviews.map((first, i) => {
    let verdict = first.verdict;
    const said = [];
    for (const set of sets) {
      const r = set.reviews[i];
      if (!r) continue;
      if (VERDICTS.indexOf(r.verdict) > VERDICTS.indexOf(verdict)) verdict = r.verdict;
      said.push({ by: set.by, verdict: r.verdict, reason: r.reason });
    }
    // The reason shown is the one that goes with the verdict that won.
    const winner = said.find((s) => s.verdict === verdict) || said[0];
    return { scene: first.scene, key: first.key, verdict, reason: winner ? winner.reason : '', said };
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
