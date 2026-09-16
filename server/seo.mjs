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
    instagram: {
      type: 'OBJECT',
      properties: {
        caption: { type: 'STRING' },
        hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
        altText: { type: 'STRING' },
      },
      required: ['caption', 'hashtags', 'altText'],
      propertyOrdering: ['caption', 'hashtags', 'altText'],
    },
    facebook: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        caption: { type: 'STRING' },
        hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
        keywords: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['title', 'caption', 'hashtags', 'keywords'],
      propertyOrdering: ['title', 'caption', 'hashtags', 'keywords'],
    },
  },
  required: ['titles', 'description', 'tags', 'hashtags', 'thumbnailText', 'pinnedComment', 'instagram', 'facebook'],
  propertyOrdering: ['titles', 'description', 'tags', 'hashtags', 'thumbnailText', 'pinnedComment', 'instagram', 'facebook'],
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
  '- Mix broad, exam and specific. For an electrical video that is "electrical engineering",',
'  "gate ee", "transformer efficiency"; for an aptitude one, "quantitative aptitude", "ssc cgl",',
'  "boats and streams shortcut". Follow the subject you are given, not these examples.',
  '- Include common misspellings and abbreviations where they are genuinely used.',
  '- The whole list must stay under 480 characters when joined with commas.',
  '',
  'HASHTAGS: 3 to 5, no spaces, no leading hash - it is added later.',
  '',
  'thumbnailText: 2 to 4 words for the thumbnail. Big, punchy, readable at phone size.',
  'pinnedComment: one short comment inviting an answer or a follow-up, under 200 characters.',
  '',
  'The same video is also posted as an Instagram Reel and a Facebook Reel. Those are searched',
  'differently from YouTube, so write for each rather than copying the YouTube text.',
  '',
  'instagram.caption: Instagram search reads the words of the caption, so the keywords a student',
  '  would type (topic, concept, exam) must be in the sentences themselves.',
  '- The first line is all that shows before "more": under 125 characters, a hook that names',
  '  the topic. Asking the viewer to answer the question in the comments works well.',
  '- Then 2 to 4 short lines on what the Reel covers, in plain words. One emoji per line at most.',
  '- End with one call to action: save it for revision, or send it to a friend preparing for the exam.',
  '- Do NOT put hashtags or the answer in the caption. Under 1000 characters.',
  'instagram.hashtags: 3 to 5 - Instagram ignores any beyond five. Specific beats broad:',
  '  one for the topic, one for the exam, one for the subject. No #Shorts, no #viral, no #fyp.',
  'instagram.altText: one plain sentence describing what is on screen, with the topic keyword,',
  '  under 120 characters. Instagram uses it for search as well as for screen readers.',
  '',
  'facebook.title: under 70 characters, plain and searchable, the topic first.',
  'facebook.caption: Facebook shows very little before "See more", so 1 to 3 short sentences:',
  '  a hook naming the topic, what the viewer learns, and a question inviting a comment.',
  '  No hashtags and no answer inside it. Under 300 characters.',
  'facebook.hashtags: 1 to 3, specific.',
  'facebook.keywords: 5 to 10 lower-case search phrases for the video Tags field.',
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
    lines.push('This is a Short: keep the description tight, and put #Shorts in the YouTube hashtags only.');
  }

  lines.push('');
  lines.push('Return the JSON object only.');
  return lines.join('\n');
}

export { buildPrompt, normalizeSeo };

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
    instagram: normalizeInstagram(r.instagram, hashtags),
    facebook: normalizeFacebook(r.facebook, hashtags, tags),
    tagsLength: used,
    generatedAt: new Date().toISOString(),
  };
}

/** Instagram's own limits. Five hashtags since December 2025 - any past five are ignored. */
export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_HASHTAG_LIMIT = 5;
/** Roughly what shows before "more" in the feed. */
export const INSTAGRAM_HOOK_LENGTH = 125;
/** Facebook takes many more, but past three they read as spam and do nothing for search. */
export const FACEBOOK_HASHTAG_LIMIT = 3;

/** Tags that belong to one platform's own vocabulary, or to none, and help nobody find a Reel. */
const FOREIGN_TAGS = /^(shorts|youtubeshorts|ytshorts|youtube|fyp|foryou|foryoupage|viral|trending)$/i;

/** Hashtags without the #, unique regardless of case, capped. */
function cleanHashtags(list, limit) {
  const out = [];
  for (const h of Array.isArray(list) ? list : []) {
    const tag = clean(h, 40).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!tag || FOREIGN_TAGS.test(tag)) continue;
    if (out.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * Caption text with any hashtags the model slipped in taken back out - they
 * are posted from their own list, and one in both places counts twice against
 * Instagram's five.
 */
function captionBody(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[*_`]/g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '').replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, Math.max(0, max));
}

/** The caption and its hashtags, as one block to paste. */
export function joinPost(caption, hashtags) {
  const tags = (hashtags || []).map((h) => '#' + h).join(' ');
  return [caption, tags].filter(Boolean).join('\n\n');
}

export function normalizeInstagram(raw, fallbackHashtags = []) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let hashtags = cleanHashtags(r.hashtags, INSTAGRAM_HASHTAG_LIMIT);
  if (!hashtags.length) hashtags = cleanHashtags(fallbackHashtags, INSTAGRAM_HASHTAG_LIMIT);
  // The whole post, hashtags included, has to fit Instagram's limit.
  const room = INSTAGRAM_CAPTION_LIMIT - joinPost('', hashtags).length - 2;
  const caption = captionBody(r.caption, room);
  return {
    caption,
    hashtags,
    altText: clean(r.altText, 250),
    post: joinPost(caption, hashtags),
    hookLength: (caption.split('\n')[0] || '').length,
  };
}

export function normalizeFacebook(raw, fallbackHashtags = [], fallbackTags = []) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let hashtags = cleanHashtags(r.hashtags, FACEBOOK_HASHTAG_LIMIT);
  if (!hashtags.length) hashtags = cleanHashtags(fallbackHashtags, FACEBOOK_HASHTAG_LIMIT);
  const source = Array.isArray(r.keywords) && r.keywords.length ? r.keywords : fallbackTags;
  const keywords = [];
  for (const k of Array.isArray(source) ? source : []) {
    const word = clean(k, 60).toLowerCase().replace(/^#+/, '').replace(/,/g, '');
    if (word && !keywords.includes(word)) keywords.push(word);
    if (keywords.length === 10) break;
  }
  const caption = captionBody(r.caption, 1000);
  return {
    title: clean(r.title, 100),
    caption,
    hashtags,
    keywords,
    post: joinPost(caption, hashtags),
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
