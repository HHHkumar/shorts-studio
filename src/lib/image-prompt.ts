import type { QuizContent, ScriptLine } from './types';

// ---------------------------------------------------------------------------
// A first draft of what to draw for a scene.
//
// `imageQuery` is written for a stock SEARCH - two or three nouns, because that
// is what a photo library takes - and handing it to an image model gets you a
// literal, flat reading of two words. The narration is the richest description
// of the scene there is, so most of the time it is the better seed.
//
// Most of the time, not all. A hook says "Most people get this wrong" and an
// outro says "Follow for more"; both describe the VIEWER, not the picture, and
// drafting from them produces a prompt about nothing. Those beats fall back to
// what the video is actually about.
//
// This is only ever a draft. It fills a box the creator is about to edit.
// ---------------------------------------------------------------------------

/** Beats whose words are aimed at the viewer rather than at the subject. */
const RHETORICAL = new Set(['hook', 'outro', 'intro', 'countdown', 'options', 'title', 'recap']);

/** Discourse markers that open a spoken line and describe nothing. */
const OPENERS = /^(so|now|and|but|then|well|okay|right|look|see|here)\b[,\s]*/i;

/** Words about the listener, which an image cannot show. */
const SECOND_PERSON = /\b(you|your|yours|we|our|ours|us|let's|lets)\b\s*/gi;

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

export function draftImagePrompt(line: ScriptLine, content: QuizContent): string {
  const kind = String(line && line.kind);
  const query = tidy(String((line && line.imageQuery) || ''));
  const subject = tidy(String((content && content.subject) || ''));
  const topic = tidy(String((content && content.topic) || ''));

  // A rhetorical beat gets the topic, because its own words are about nobody.
  if (RHETORICAL.has(kind)) {
    const seed = [topic, query].filter(Boolean)[0] || subject;
    return seed ? withSubject(seed, subject) : '';
  }

  const said = tidy(String((line && line.narration) || ''))
    .replace(OPENERS, '')
    .replace(SECOND_PERSON, '');

  const seed = tidy(said).length > 12 ? tidy(said) : query;
  if (!seed) return topic ? withSubject(topic, subject) : '';

  return withSubject(clip(seed, 180), subject);
}

/** Cut to a length an image model reads, never mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, '').replace(/[,;:\s]+$/, '');
}

/** Name the field, unless the sentence already did. */
function withSubject(scene: string, subject: string): string {
  if (!subject) return scene;
  return scene.toLowerCase().includes(subject.toLowerCase()) ? scene : scene + ' — ' + subject;
}
