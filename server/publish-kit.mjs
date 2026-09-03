// ---------------------------------------------------------------------------
// Everything you need in front of you when the upload form is open.
//
// The metadata already exists on step 7 as boxes to copy one at a time. That is
// fine while the tab is open and useless an hour later, on a different machine,
// or when you are uploading six videos in a row. This packs the same thing into
// a zip that sits next to the .mp4.
//
// Two things in here cannot be copied out of the page, because only the tool
// knows them:
//
//   chapters - real timestamps, computed from the scene timeline that produced
//              the video. Nobody can type these accurately afterwards.
//   credits  - which icon sets and photos actually ended up in this video, and
//              which of them ask for a credit in return.
//
// Everything is plain text. No format anybody needs an app to open.
// ---------------------------------------------------------------------------

import { NEEDS_ATTRIBUTION } from './icons.mjs';
import { makeZip } from './zip.mjs';

/** YouTube's own limits, so nothing in the kit is silently too long to paste. */
const TITLE_LIMIT = 100;
const DESCRIPTION_LIMIT = 5000;

/** A chapter shorter than this is refused by YouTube, so short scenes merge. */
const MIN_CHAPTER_SECONDS = 10;
/** Fewer than three and YouTube ignores the whole list. */
const MIN_CHAPTERS = 3;
/** Chapters on a 40-second Short are noise. */
const MIN_VIDEO_SECONDS_FOR_CHAPTERS = 60;

const KIND_LABEL = {
  intro: 'Start here',
  hook: 'The question',
  title: 'The question',
  question: 'The question',
  options: 'The options',
  countdown: 'Your turn',
  answer: 'The answer',
  metaphor: 'An analogy',
  diagram: 'How it is built',
  motion: 'What actually happens',
  process: 'Step by step',
  versus: 'Side by side',
  timeline: 'How it came to be',
  grid: 'The pieces',
  explain: 'Why',
  recap: 'What to remember',
  outro: 'Before you go',
};

/** m:ss, or h:mm:ss past an hour. YouTube accepts both and wants no padding on the first field. */
export function stamp(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

/** A short chapter name from whatever the scene has to offer. */
function chapterName(scene) {
  const panel = scene.panel || {};
  const fromPanel = panel.title || panel.leftLabel;
  if (fromPanel && fromPanel.length <= 48) return fromPanel;

  const label = KIND_LABEL[scene.kind];
  if (label) return label;

  const words = String(scene.narration || '').split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  return words ? words.replace(/[.,;:!?]+$/, '') : 'Next';
}

/**
 * Chapter marks for the description.
 *
 * The rules are YouTube's, not ours: the list is ignored entirely unless the
 * first mark is at 0:00, there are at least three, and none is under ten
 * seconds. So scenes are merged forward until each chapter is long enough,
 * which also stops a twenty-scene explainer producing twenty useless chapters.
 *
 * Returns [] when the video cannot have a valid list, rather than a broken one.
 */
export function buildChapters(scenes, fps) {
  const rate = Number(fps) > 0 ? Number(fps) : 30;
  const usable = (Array.isArray(scenes) ? scenes : []).filter(
    (s) => s && Number.isFinite(s.startFrame) && Number.isFinite(s.durationInFrames),
  );
  if (!usable.length) return [];

  const last = usable[usable.length - 1];
  const totalSeconds = (last.startFrame + last.durationInFrames) / rate;
  if (totalSeconds < MIN_VIDEO_SECONDS_FOR_CHAPTERS) return [];

  const chapters = [];
  for (const scene of usable) {
    const at = scene.startFrame / rate;
    const previous = chapters[chapters.length - 1];
    // Too close behind the last mark to be its own chapter: it belongs to it.
    if (previous && at - previous.seconds < MIN_CHAPTER_SECONDS) continue;
    chapters.push({ seconds: at, title: chapterName(scene) });
  }

  // The last chapter needs room too, or YouTube drops the list.
  while (chapters.length > 1
    && totalSeconds - chapters[chapters.length - 1].seconds < MIN_CHAPTER_SECONDS) {
    chapters.pop();
  }

  if (chapters.length < MIN_CHAPTERS) return [];
  // The first mark must be 0:00 exactly. It is the video's own start, so this
  // is a correction rather than a fudge.
  chapters[0].seconds = 0;
  return chapters;
}

/**
 * Who has to be credited for what actually ended up in this video.
 *
 * Deliberately reports the clear cases too. "Nothing here needs a credit" is
 * the answer a creator most wants and can least easily verify for themselves.
 */
export function buildCredits(content, scenes) {
  const lines = [];
  const all = [
    ...(Array.isArray(content && content.script) ? content.script : []),
    ...(Array.isArray(scenes) ? scenes : []),
  ];

  const iconSets = new Set();
  const photos = new Set();
  for (const line of all) {
    for (const actor of (line && line.panel && line.panel.actors) || []) {
      if (actor.iconName) iconSets.add(String(actor.iconName).split(':')[0]);
    }
    if (line && line.stockCredit) photos.add(String(line.stockCredit).trim());
  }

  const mustCredit = [...iconSets].filter((prefix) => NEEDS_ATTRIBUTION.has(prefix));
  const freeToUse = [...iconSets].filter((prefix) => !NEEDS_ATTRIBUTION.has(prefix));

  if (photos.size) {
    lines.push('PHOTOS');
    lines.push('Stock photography used in this video:');
    for (const credit of photos) lines.push('  ' + credit);
    lines.push('');
  }

  if (mustCredit.length) {
    lines.push('ICONS - A CREDIT IS REQUIRED');
    lines.push('These icon sets are Creative Commons Attribution licensed. Keep the');
    lines.push('following line in your description:');
    lines.push('');
    for (const prefix of mustCredit) {
      lines.push('  Icons by ' + prefix + ' (CC BY 3.0), via Iconify.');
    }
    lines.push('');
  }

  if (freeToUse.length) {
    lines.push('ICONS - NO CREDIT REQUIRED');
    lines.push('  ' + freeToUse.join(', ') + ' - MIT / Apache 2.0 / ISC, via Iconify.');
    lines.push('  You may credit them if you like, but you do not have to.');
    lines.push('');
  }

  lines.push('MUSIC AND SOUND');
  lines.push('  Generated by this tool from scratch. Not sampled, not licensed from');
  lines.push('  anyone, no copyright claim possible. Nothing to credit.');
  lines.push('');

  lines.push('NARRATION');
  lines.push('  Synthetic voice. Check your own platform rules on disclosing that.');

  return lines.join('\n');
}

/** The description as it should actually be pasted: body, chapters, credits, tags. */
export function buildDescription(seo, chapters, mustCreditLine) {
  const parts = [String((seo && seo.description) || '').trim()];

  if (chapters.length) {
    parts.push('CHAPTERS\n' + chapters.map((c) => stamp(c.seconds) + ' ' + c.title).join('\n'));
  }

  if (mustCreditLine) parts.push(mustCreditLine);

  const hashtags = (seo && seo.hashtags) || [];
  if (hashtags.length) parts.push(hashtags.join(' '));

  return parts.filter(Boolean).join('\n\n').slice(0, DESCRIPTION_LIMIT);
}

/** A filename that is safe on Windows and still recognisable a month later. */
export function slug(text, fallback = 'video') {
  const out = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || fallback;
}

/**
 * The one page to have open while filling the upload form in, in the order the
 * form asks for things.
 *
 * Its own function because it is the file people will actually read, and a
 * character count that is quietly wrong there is worse than no count at all.
 */
export function buildUploadSheet({
  content, design, seo, title, description, tagLine, credits, hasThumbnail,
}) {
  const pack = seo || {};
  const over = title.length > TITLE_LIMIT;
  const others = (pack.titles || []).filter((t) => t !== title);
  const rule = '='.repeat(72);

  return [
    'UPLOAD SHEET',
    'Made by Shorts Studio on ' + new Date().toLocaleString(),
    '',
    'Topic:     ' + (content.topic || ''),
    // Only when it says something the topic did not. The generator falls back
    // to the topic when no subject was given, and printing it twice reads like
    // a bug in the sheet.
    ...(content.subject && content.subject !== content.topic
      ? ['Subject:   ' + content.subject] : []),
    'Shape:     ' + ((design && design.orientation) === 'landscape'
      ? '16:9 landscape' : '9:16 portrait'),
    '',
    rule,
    '1. TITLE   ' + (over
      ? '*** ' + title.length + ' CHARACTERS - OVER THE ' + TITLE_LIMIT + ' LIMIT, SHORTEN IT ***'
      : '(' + title.length + '/' + TITLE_LIMIT + ')'),
    rule,
    title,
    '',
    ...(others.length
      ? ['The others you were offered:', ...others.map((t) => '  - ' + t), '']
      : []),
    rule,
    '2. DESCRIPTION   (' + description.length + '/' + DESCRIPTION_LIMIT + ')',
    rule,
    'Paste this whole block. Chapters and any required credit are already in it.',
    '',
    description,
    '',
    rule,
    '3. TAGS   (' + tagLine.length + '/500 characters, which is what YouTube counts)',
    rule,
    tagLine || '(none written)',
    '',
    rule,
    '4. THUMBNAIL',
    rule,
    hasThumbnail
      ? 'thumbnail.png, in this folder.'
      : 'Not made yet - go back to step 7, make one, and pack the kit again.',
    '',
    rule,
    '5. AFTER PUBLISHING',
    rule,
    'Post this as a comment and pin it:',
    '',
    pack.pinnedComment || '(none written)',
    '',
    rule,
    '6. CREDITS',
    rule,
    credits,
    '',
  ].join('\n');
}

/**
 * Assemble the kit. Returns { name, buffer } ready to write or serve.
 *
 * `thumbnail` is optional: a kit without one is still worth having, and the
 * creator may not have made one yet.
 */
export function buildPublishKit({ content, design, seo, title, scenes, fps, thumbnail }) {
  const pack = seo || {};
  const chosenTitle = String(title || (pack.titles || [])[0] || content.question || '').trim();
  const chapters = buildChapters(scenes, fps);
  const credits = buildCredits(content, scenes);

  const iconSets = new Set();
  for (const line of [...(content.script || []), ...(scenes || [])]) {
    for (const actor of (line && line.panel && line.panel.actors) || []) {
      if (actor.iconName) iconSets.add(String(actor.iconName).split(':')[0]);
    }
  }
  const mustCredit = [...iconSets].filter((p) => NEEDS_ATTRIBUTION.has(p));
  const creditLine = mustCredit.length
    ? mustCredit.map((p) => 'Icons by ' + p + ' (CC BY 3.0), via Iconify.').join('\n')
    : '';

  const description = buildDescription(pack, chapters, creditLine);
  const tagLine = (pack.tags || []).join(', ');
  const hashLine = (pack.hashtags || []).join(' ');
  const chapterText = chapters.length
    ? chapters.map((c) => stamp(c.seconds) + ' ' + c.title).join('\n')
    : 'This video is too short for chapters. YouTube needs at least three,\n'
      + 'each at least ten seconds, starting at 0:00.';

  const upload = buildUploadSheet({
    content, design, seo: pack, title: chosenTitle, description, tagLine, credits,
    hasThumbnail: !!thumbnail,
  });

  const metadata = {
    generatedBy: 'Shorts Studio',
    generatedAt: new Date().toISOString(),
    topic: content.topic || '',
    subject: content.subject || '',
    videoKind: content.videoKind || 'mcq',
    orientation: (design && design.orientation) || 'portrait',
    title: chosenTitle,
    alternativeTitles: (pack.titles || []).filter((t) => t !== chosenTitle),
    description,
    tags: pack.tags || [],
    hashtags: pack.hashtags || [],
    pinnedComment: pack.pinnedComment || '',
    // Floor, not round: `stamp` floors, and a script seeking to a `seconds`
    // that disagreed with the printed mark would land somewhere else.
    chapters: chapters.map((c) => ({
      start: stamp(c.seconds), seconds: Math.floor(c.seconds), title: c.title,
    })),
    requiredCredits: mustCredit.map((p) => 'Icons by ' + p + ' (CC BY 3.0), via Iconify.'),
    lengthSeconds: scenes && scenes.length
      ? Math.round((scenes[scenes.length - 1].startFrame + scenes[scenes.length - 1].durationInFrames)
        / (Number(fps) || 30))
      : null,
  };

  const files = [
    { name: 'UPLOAD.txt', data: upload },
    { name: 'title.txt', data: chosenTitle + '\n' },
    { name: 'description.txt', data: description + '\n' },
    { name: 'tags.txt', data: tagLine + '\n' },
    { name: 'hashtags.txt', data: hashLine + '\n' },
    { name: 'pinned-comment.txt', data: (pack.pinnedComment || '') + '\n' },
    { name: 'chapters.txt', data: chapterText + '\n' },
    { name: 'credits.txt', data: credits + '\n' },
    { name: 'metadata.json', data: JSON.stringify(metadata, null, 2) + '\n' },
  ];
  if (thumbnail) files.push({ name: 'thumbnail.png', data: thumbnail });

  return {
    name: slug(chosenTitle || content.topic) + '-upload-kit.zip',
    buffer: makeZip(files),
    chapters: chapters.length,
    hasThumbnail: !!thumbnail,
  };
}
