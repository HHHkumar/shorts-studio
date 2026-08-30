// ---------------------------------------------------------------------------
// Title, tags and description for the upload form.
//
// Written by Gemini from the finished video, using the same key as the script.
// Exam-focused search behaviour is specific: people type the exam name, the
// subject and the topic, so those have to be in the title and the first line of
// the description, not buried.
// ---------------------------------------------------------------------------

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
import { fetchRetrying } from './retry.mjs';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titles: { type: 'ARRAY', items: { type: 'STRING' } },
    description: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    thumbnailText: { type: 'STRING' },
    pinnedComment: { type: 'STRING' },
  },
  required: ['titles', 'description', 'tags', 'hashtags', 'thumbnailText', 'pinnedComment'],
  propertyOrdering: ['titles', 'description', 'tags', 'hashtags', 'thumbnailText', 'pinnedComment'],
};

const SYSTEM = [
  'You write YouTube metadata for an educational channel. You are precise and you never invent',
  'facts about the video that are not in the material you are given.',
  '',
  'TITLES: give 5 options, each under 90 characters.',
  '- Front-load the words a person would actually type into search.',
  '- Every title must be true. Curiosity is fine; a promise the video does not keep is not.',
  '- Vary the angle across the five: one plain and searchable, one question-shaped, one',
  '  challenge-shaped, one that names the exam, one that names the specific concept.',
  '- No ALL CAPS words except a genuine acronym. At most one emoji, and only if it earns its place.',
  '',
  'DESCRIPTION:',
  '- First line is the one that shows in search. Put the topic and the exam in it.',
  '- Then two or three sentences on what the video actually covers.',
  '- Then a short bulleted list of the specific concepts touched, using "-" as the bullet.',
  '- Then a line for the channel or site if one is given.',
  '- End with the hashtags on their own line.',
  '- Plain text only. No markdown headings, no asterisks.',
  '',
  'TAGS: 18 to 25 of them, lower case, comma-free, each a phrase somebody might search.',
  '- Mix broad ("electrical engineering"), exam ("gate ee"), and specific ("transformer efficiency").',
  '- Include common misspellings and abbreviations where they are genuinely used.',
  '- The whole list must stay under 480 characters when joined with commas.',
  '',
  'HASHTAGS: 3 to 5, no spaces, no leading hash - it is added later.',
  '',
  'thumbnailText: 2 to 4 words for the thumbnail. Big, punchy, readable at phone size.',
  'pinnedComment: one short comment inviting an answer or a follow-up, under 200 characters.',
  '',
  'Reply with the JSON object only.',
].join('\n');

function buildPrompt(content, options) {
  const lines = [];
  const isShort = options.orientation !== 'landscape';

  lines.push('Write metadata for this ' + (isShort ? 'YouTube Short (vertical, under 90s)' : 'long-form YouTube video (16:9)') + '.');
  lines.push('');
  lines.push('SUBJECT: ' + (content.subject || ''));
  lines.push('TOPIC: ' + (content.topic || ''));
  if (options.exam) lines.push('EXAM / AUDIENCE: ' + options.exam);
  if (options.level) lines.push('LEVEL: ' + options.level);
  if (options.language && options.language !== 'English') {
    lines.push('LANGUAGE: ' + options.language + '. Write the metadata in this language,');
    lines.push('but keep exam names, technical terms and tags in English as people search them that way.');
  }
  if (options.channelName) lines.push('CHANNEL / SITE: ' + options.channelName);
  lines.push('');
  lines.push('QUESTION ASKED: ' + content.question);
  lines.push('OPTIONS: ' + (content.options || []).join(' | '));
  lines.push('CORRECT ANSWER: ' + (content.options || [])[content.correctIndex]);
  lines.push('');

  const explain = (content.script || [])
    .filter((s) => s.kind === 'explain')
    .map((s) => s.narration)
    .filter(Boolean);
  if (explain.length) {
    lines.push('WHAT THE VIDEO EXPLAINS:');
    explain.forEach((e, i) => lines.push('  ' + (i + 1) + '. ' + e));
    lines.push('');
  }
  if (content.funFact) lines.push('CLOSING FACT: ' + content.funFact);

  if (isShort) {
    lines.push('');
    lines.push('This is a Short: keep the description tight, and put #Shorts in the hashtags.');
  }

  lines.push('');
  lines.push('Return the JSON object only.');
  return lines.join('\n');
}

export async function generateSeo(apiKey, model, content, options) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(content, options || {}) }] }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));

  const payload = JSON.parse(raw);
  const candidate = payload.candidates && payload.candidates[0];
  if (!candidate) throw new Error('Gemini returned no metadata. Try again.');

  const text = (candidate.content && candidate.content.parts ? candidate.content.parts : [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned empty metadata. Try again.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Could not read the metadata. Try again.');
    parsed = JSON.parse(text.slice(start, end + 1));
  }

  return normalizeSeo(parsed, content);
}

const clean = (v, max = 400) =>
  typeof v === 'string' ? v.replace(/[*_`]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max) : '';

/** YouTube's own limits, enforced here so nothing is rejected at upload. */
const TITLE_LIMIT = 100;
const DESCRIPTION_LIMIT = 4800;
const TAGS_TOTAL_LIMIT = 480;

function normalizeSeo(raw, content) {
  const r = raw && typeof raw === 'object' ? raw : {};

  const titles = (Array.isArray(r.titles) ? r.titles : [])
    .map((t) => clean(t, TITLE_LIMIT))
    .filter(Boolean)
    .slice(0, 5);
  if (!titles.length) titles.push(clean(content.question, TITLE_LIMIT));

  const hashtags = (Array.isArray(r.hashtags) ? r.hashtags : [])
    .map((h) => clean(h, 40).replace(/^#/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 5);

  // Tags are capped by total length, not just count: YouTube rejects the lot
  // if the joined string is too long.
  const tags = [];
  let used = 0;
  for (const candidateTag of (Array.isArray(r.tags) ? r.tags : [])) {
    const tag = clean(candidateTag, 60).toLowerCase().replace(/,/g, '');
    if (!tag || tags.includes(tag)) continue;
    const cost = tag.length + (tags.length ? 1 : 0);
    if (used + cost > TAGS_TOTAL_LIMIT) break;
    tags.push(tag);
    used += cost;
  }

  // Multi-line fields keep their line breaks; only runs of spaces are collapsed.
  const description = typeof r.description === 'string'
    ? r.description.replace(/[*_`]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, DESCRIPTION_LIMIT)
    : '';

  return {
    titles,
    description,
    tags,
    hashtags,
    thumbnailText: clean(r.thumbnailText, 40),
    pinnedComment: clean(r.pinnedComment, 200),
    tagsLength: used,
    generatedAt: new Date().toISOString(),
  };
}

function explainError(status, raw) {
  let detail = '';
  try {
    detail = (JSON.parse(raw).error || {}).message || '';
  } catch {
    detail = String(raw).slice(0, 200);
  }
  if (status === 400 && /API key not valid/i.test(detail)) {
    return 'That Gemini API key was rejected. Check it on the Keys step.';
  }
  if (status === 429) return 'Gemini rate limit hit. Wait a minute and press Write metadata again.';
  if (status === 503) {
    return 'Google’s servers are busy right now, and the tool already retried three times. Wait a few seconds and try again, or switch to a Flash model.';
  }
  if (status >= 500) return 'Google had a server error (' + status + '). It was retried automatically; try again in a moment.';
  return 'Gemini error ' + status + ': ' + (detail || 'unknown');
}
