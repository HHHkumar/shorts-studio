// ---------------------------------------------------------------------------
// The syllabus planner: a run of questions that covers an exam's syllabus,
// never repeating one already made.
//
// Gemini lays the syllabus out as units and topics, then picks the questions
// to make - each a subject, a topic and the angle it tests - spread across the
// units so a month of videos is a month of the syllabus, not ten videos on
// Ohm's law. Every topic already in the library is passed in to be avoided,
// and checked again here, since a model told to avoid something sometimes
// does not.
//
// A plan is one JSON file in library/plans, committed with the library, so
// both computers work from the same calendar.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fetchRetrying } from './retry.mjs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const PLAN_ID = /^[a-z0-9-]{3,60}$/;
export const MAX_PLAN_ITEMS = 40;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    syllabus: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { unit: { type: 'STRING' }, topics: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['unit', 'topics'],
      },
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          unit: { type: 'STRING' },
          subject: { type: 'STRING' },
          topic: { type: 'STRING' },
          angle: { type: 'STRING' },
          difficulty: { type: 'STRING', enum: ['Easy', 'Medium', 'Hard'] },
        },
        required: ['unit', 'subject', 'topic', 'angle', 'difficulty'],
      },
    },
  },
  required: ['syllabus', 'items'],
};

export const PLANNER_SYSTEM = [
  'You plan a series of short exam-preparation videos, one multiple-choice question each, for',
  'electrical engineering students preparing for a competitive exam.',
  '',
  'First lay out the exam\'s technical syllabus as units, each with its main topics, as the',
  'official syllabus has them. Then choose the questions to make:',
  '- Spread them across the units in proportion to how much each is examined; never more than three',
  '  in a row from one unit.',
  '- Each: its unit, the subject (e.g. "Electrical Machines"), a specific topic (e.g. "Slip in',
  '  induction motors"), the angle - one sentence on what the question should test, e.g. "Why slip',
  '  can never be zero on load" - and a difficulty, mostly Medium.',
  '- Questions that have actually been asked in this exam\'s past papers are the best choice.',
  '- Never a topic in the AVOID list: those videos have been made already.',
  '- Every topic distinct.',
  '',
  'Reply with the JSON object only.',
].join('\n');

/** A plan's file name, from its exam. */
export const planIdFor = (exam) =>
  String(exam || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'plan';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Topics already covered: the library's videos, and anything already in the plan. */
export function coveredTopics(videos, plan) {
  const out = new Set();
  for (const v of videos || []) {
    const c = v.content || v;
    if (c.topic) out.add(norm(c.topic));
  }
  for (const item of (plan && plan.items) || []) out.add(norm(item.topic));
  out.delete('');
  return out;
}

/** Keep the model's items that are complete, distinct, and not already covered. */
export function tidyItems(raw, covered, count) {
  const seen = new Set(covered);
  const out = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    const topic = String(it && it.topic || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const key = norm(topic);
    if (!topic || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: Math.random().toString(36).slice(2, 10),
      unit: String(it.unit || '').trim().slice(0, 80),
      subject: String(it.subject || '').trim().slice(0, 60),
      topic,
      angle: String(it.angle || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(it.difficulty) ? it.difficulty : 'Medium',
      status: 'todo',
      videoId: '',
    });
    if (out.length >= count) break;
  }
  return out;
}

export async function generatePlan({ apiKey, model, exam, focus, count, covered }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  if (!exam) throw new Error('Choose the exam to plan for.');
  const n = Math.max(5, Math.min(MAX_PLAN_ITEMS, Number(count) || 20));
  const request = [
    'EXAM: ' + exam,
    focus ? 'FOCUS ON: ' + focus : '',
    'QUESTIONS WANTED: ' + n,
    covered.size ? 'AVOID (already made): ' + [...covered].slice(0, 200).join('; ') : 'AVOID: nothing yet',
  ].filter(Boolean).join('\n');
  const body = {
    systemInstruction: { parts: [{ text: PLANNER_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: request }] }],
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model || 'gemini-2.5-flash') + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = (JSON.parse(raw).error || {}).message || ''; } catch { detail = raw.slice(0, 200); }
    if (res.status === 429) throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    throw new Error('Gemini could not plan the series (' + res.status + '): ' + (detail || 'unknown'));
  }
  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent a plan that could not be read. Try again.');
  }
  const syllabus = (Array.isArray(parsed.syllabus) ? parsed.syllabus : [])
    .map((u) => ({ unit: String(u.unit || '').slice(0, 80), topics: (Array.isArray(u.topics) ? u.topics : []).map(String).slice(0, 20) }))
    .filter((u) => u.unit);
  const items = tidyItems(parsed.items, covered, n);
  if (!items.length) throw new Error('Gemini planned nothing new - everything it suggested is already in your library.');
  return { syllabus, items };
}

// --- on disk ------------------------------------------------------------------

const planFile = (dir, id) => {
  if (!PLAN_ID.test(String(id || ''))) throw new Error('That is not a plan.');
  return path.join(dir, id + '.json');
};

export function readPlan(dir, id) {
  try {
    return JSON.parse(fs.readFileSync(planFile(dir, id), 'utf8'));
  } catch {
    return null;
  }
}

export function listPlans(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && PLAN_ID.test(f.slice(0, -5)))
    .map((f) => readPlan(dir, f.slice(0, -5)))
    .filter(Boolean);
}

export function savePlan(dir, plan) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(planFile(dir, plan.id), JSON.stringify(plan, null, 1));
  return plan;
}

/** Add newly planned items to an exam's plan, making it if need be. */
export function extendPlan(dir, exam, focus, result, now = new Date()) {
  const id = planIdFor(exam);
  const plan = readPlan(dir, id) || { id, exam, createdAt: now.toISOString(), syllabus: [], items: [] };
  plan.focus = focus || plan.focus || '';
  if (result.syllabus.length) plan.syllabus = result.syllabus;
  plan.items = [...plan.items, ...result.items];
  plan.updatedAt = now.toISOString();
  return savePlan(dir, plan);
}

/** Change one item: its status, or the video made for it. */
export function updateItem(dir, planId, itemId, patch) {
  const plan = readPlan(dir, planId);
  if (!plan) throw new Error('That plan is not here any more.');
  const item = plan.items.find((i) => i.id === itemId);
  if (!item) throw new Error('That item is not in the plan any more.');
  if (patch.status && ['todo', 'done', 'skipped'].includes(patch.status)) item.status = patch.status;
  if (typeof patch.videoId === 'string') item.videoId = patch.videoId;
  plan.updatedAt = new Date().toISOString();
  return savePlan(dir, plan);
}

export function deletePlan(dir, id) {
  const f = planFile(dir, id);
  if (fs.existsSync(f)) fs.rmSync(f);
}
