// ---------------------------------------------------------------------------
// The fun fact, kept in step with the scene that says it.
//
// When a quiz is generated the fact is copied into the closing scene's words -
// fact first, then the sign-off - and from then on there were two copies. The
// Script step's "Fun fact (shown at the end)" box edited one; the video showed
// and spoke the other. An edited fact never reached the video, and the
// carousel, which reads the box, disagreed with it.
//
// The two are linked only while the scene BEGINS with the fact, which is how
// the server writes it. Not "contains": the box is edited a keystroke at a
// time, so the first letter typed would be searched for, found somewhere in
// the middle of the sign-off, and replaced there. When Gemini wrote its own
// closing scene and told the fact in its own words, there is no safe place to
// put the new one, and the box says so rather than pretending it worked.
//
// Pure logic: no React, and imports carry their .ts extension.
// ---------------------------------------------------------------------------

import type { QuizContent } from './types.ts';

const tidy = (s: unknown) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/** The scene that closes the video - the one the fact is said in. -1 if there is none. */
export function closingScene(content: QuizContent): number {
  const script = Array.isArray(content && content.script) ? content.script : [];
  for (let i = script.length - 1; i >= 0; i--) if (script[i] && script[i].kind === 'outro') return i;
  return -1;
}

/** Does the closing scene say the fact, the way the server wrote it: fact first? */
export function factIsSpoken(content: QuizContent): boolean {
  const at = closingScene(content);
  if (at < 0) return false;
  const fact = tidy(content.funFact);
  const said = tidy(content.script[at].narration);
  if (!fact) return said === tidy(content.outro);
  return said === fact || said.startsWith(fact + ' ');
}

/**
 * The content with the fact changed - and the closing scene's words changed to
 * match, if they are linked. `scene` is the scene whose voiceover no longer
 * matches its words, or -1 if no scene's words changed.
 *
 * `next` is kept exactly as typed, trailing space and all, because it is what
 * the box shows while someone is typing into it.
 */
export function withFunFact(content: QuizContent, next: string): { content: QuizContent; scene: number } {
  const at = closingScene(content);
  const updated = { ...content, funFact: next };
  if (at < 0 || !factIsSpoken(content)) return { content: updated, scene: -1 };

  const fact = tidy(content.funFact);
  const said = tidy(content.script[at].narration);
  const rest = fact ? said.slice(fact.length) : ' ' + said;
  const narration = tidy(tidy(next) + rest);
  if (narration === said) return { content: updated, scene: -1 };

  return {
    content: { ...updated, script: updated.script.map((line, i) => (i === at ? { ...line, narration } : line)) },
    scene: at,
  };
}

/**
 * Put the fact in the closing scene when they are not linked: the fact, then
 * the sign-off, the way the server writes it. From then on they are linked.
 */
export function speakFunFact(content: QuizContent): { content: QuizContent; scene: number } {
  const at = closingScene(content);
  if (at < 0) return { content, scene: -1 };
  const narration = tidy(tidy(content.funFact) + ' ' + tidy(content.outro));
  return {
    content: { ...content, script: content.script.map((line, i) => (i === at ? { ...line, narration } : line)) },
    scene: at,
  };
}
