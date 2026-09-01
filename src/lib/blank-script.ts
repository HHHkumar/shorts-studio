import type { TopicForm } from './api';
import type { QuizContent, SceneKind, ScriptLine } from './types';

// ---------------------------------------------------------------------------
// Starting a script by hand.
//
// Everything downstream of step 2 is driven by `content.script`, so a script
// typed by a person is worth exactly as much to the rest of the tool as one
// Gemini wrote. This just puts the right shape on screen - the correct beats in
// the correct order, and roughly the right number of them for the length asked
// for - so the work is filling boxes in rather than building the structure.
//
// One thing it deliberately does NOT do is set scene durations. A scene lasts
// as long as its recorded narration and not a moment less, which is the whole
// reason the sound and picture cannot drift apart. The target length here
// decides how many boxes appear and how much to write in each; the real length
// arrives with the voiceover.
// ---------------------------------------------------------------------------

/** The measured pace of the voice, used to turn seconds into a word count. */
const WORDS_PER_SECOND = 2.6;

/** Seconds the fixed quiz beats take up before any explanation is written. */
const QUIZ_FIXED_SECONDS = 22;

export interface Blank {
  content: QuizContent;
  /** Roughly how many words each explanation scene wants. Shown as a hint. */
  wordsPerScene: number;
}

const line = (kind: SceneKind, narration = ''): ScriptLine => ({ kind, narration });

/**
 * Build an empty script of the right shape for the chosen mode and length.
 *
 * The scene count comes from the target so the writer is not left guessing how
 * much to produce; scenes can still be added and removed afterwards.
 */
export function blankContent(form: TopicForm): Blank {
  const explainer = form.videoKind === 'explainer';
  const target = Math.max(15, Number(form.targetSeconds) || 45);
  const intro = (form.intro || '').trim();

  const script: ScriptLine[] = [];
  if (intro) script.push(line('intro', intro));

  let wordsPerScene: number;

  if (explainer) {
    // About nine seconds a beat, the same pacing the generated storyboards use.
    const words = Math.round(target * WORDS_PER_SECOND);
    const count = Math.max(3, Math.min(30, Math.round(words / 26)));
    wordsPerScene = Math.round(words / count);

    script.push(line('title'));
    for (let i = 0; i < count - 2; i++) script.push(line('explain'));
    script.push(line('outro'));
  } else {
    // The quiz beats are fixed; only the explanation stretches with the target.
    const spare = Math.max(0, target - QUIZ_FIXED_SECONDS);
    const count = Math.max(1, Math.min(20, Math.round((spare * WORDS_PER_SECOND) / 22)));
    wordsPerScene = 22;

    script.push(line('hook'), line('question'), line('options'), line('countdown'), line('answer'));
    for (let i = 0; i < count; i++) script.push(line('explain'));
    script.push(line('outro'));
  }

  const content: QuizContent = {
    videoKind: explainer ? 'explainer' : 'mcq',
    handWritten: true,
    subject: form.subject || '',
    topic: form.topic || '',
    difficulty: form.difficulty || '',
    hook: '',
    question: '',
    // A quiz needs four boxes to type into; an explainer has no options at all.
    options: explainer ? [] : ['', '', '', ''],
    correctIndex: 0,
    answerLine: '',
    explanation: [],
    funFact: '',
    outro: '',
    hashtags: [],
    motifSymbols: [],
    script,
  };

  return { content, wordsPerScene };
}

/** Seconds a written line will take to read aloud, at the voice's own pace. */
export function spokenSeconds(text: string): number {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return words / WORDS_PER_SECOND;
}

/** The whole script's spoken length, for the meter in the editor. */
export function scriptSeconds(script: ScriptLine[]): number {
  return script.reduce((total, l) => total + spokenSeconds(l.narration), 0);
}
