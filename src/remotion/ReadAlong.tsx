import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import type { WordTiming } from '../lib/types';

/**
 * The spoken line, shown as the main text on screen, one phrase at a time,
 * with each word lighting up as it is said.
 *
 * This is the whole point of the read-along model: there is only ever one text
 * on screen, and it is exactly what the viewer is hearing. Nothing is displayed
 * that is not spoken, so the eyes and the ears cannot disagree.
 */

const MAX_WORDS = 6;

export interface Phrase {
  words: WordTiming[];
  start: number;
  end: number;
}

/** Break the spoken words into short phrases, preferring punctuation. */
export function toPhrases(words: WordTiming[]): Phrase[] {
  const phrases: Phrase[] = [];
  let current: WordTiming[] = [];

  const flush = () => {
    if (!current.length) return;
    phrases.push({
      words: current,
      start: current[0].start,
      end: current[current.length - 1].end,
    });
    current = [];
  };

  for (const w of words) {
    current.push(w);
    const endsClause = /[.,!?;:]$/.test(w.word);
    if (current.length >= MAX_WORDS || (endsClause && current.length >= 3)) flush();
  }
  flush();
  return phrases;
}

/**
 * Scripts whose shape a fake italic or tight letter-spacing would damage:
 * Indic, Arabic, Thai, CJK, Hangul. Their glyphs join and stack, so slanting
 * them or pulling them together breaks the letterforms.
 */
const COMPLEX_SCRIPT =
  /[؀-ۿऀ-෿฀-๿က-႟぀-ヿ㐀-鿿가-힯]/;

/** Bigger type for short phrases, smaller for long ones. */
function sizeFor(phrase: Phrase, max: number, min: number): number {
  const chars = phrase.words.reduce((n, w) => n + w.word.length + 1, 0);
  if (chars <= 18) return max;
  if (chars >= 60) return min;
  return Math.round(max + (min - max) * ((chars - 18) / 42));
}

export const ReadAlong: React.FC<{
  theme: Theme;
  words: WordTiming[];
  /** Cancels the mp3 encoder delay so highlights land on the right syllable. */
  offset?: number;
  /** Shown when there are no word timings yet (before the voiceover exists). */
  fallbackText: string;
  maxSize?: number;
  minSize?: number;
  color?: string;
}> = ({ theme, words, offset = 0, fallbackText, maxSize = 96, minSize = 56, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps - offset;

  const phrases = useMemo(() => toPhrases(words), [words]);

  const complex = COMPLEX_SCRIPT.test(fallbackText || words.map((w) => w.word).join(' '));

  const base: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    // Wide enough that the 1.06x scale on the current word cannot close it up.
    gap: '0.14em 0.34em',
    fontFamily: theme.fontDisplay,
    fontWeight: theme.displayWeight,
    letterSpacing: complex ? 0 : theme.displayTracking,
    textTransform: complex ? 'none' : theme.displayTransform,
    fontStyle: theme.displayItalic && !complex ? 'italic' : 'normal',
    lineHeight: 1.14,
    textAlign: 'center',
    width: '100%',
  };

  // No timings yet: show the whole line so the preview still reads correctly.
  if (!phrases.length) {
    const text = fallbackText.trim();
    if (!text) return null;
    return (
      <div style={{ ...base, fontSize: minSize, color: color || theme.text }}>
        {text}
      </div>
    );
  }

  // The phrase being spoken, or the one we just finished if we are in a gap.
  let index = phrases.findIndex((p) => time >= p.start && time <= p.end + 0.2);
  if (index === -1) index = phrases.reduce((best, p, i) => (time > p.start ? i : best), 0);
  const phrase = phrases[index];

  const appear = interpolate(time, [phrase.start - 0.12, phrase.start + 0.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const size = sizeFor(phrase, maxSize, minSize);

  let currentIndex = -1;
  for (let i = 0; i < phrase.words.length; i++) {
    if (time >= phrase.words[i].start - 0.03) currentIndex = i;
  }

  return (
    <div
      style={{
        ...base,
        fontSize: size,
        color: color || theme.text,
        opacity: appear,
        transform: 'translateY(' + (1 - appear) * 18 + 'px)',
      }}
    >
      {phrase.words.map((w, i) => {
        const spoken = time >= w.start - 0.03;
        // Exactly one word is "current": the latest one that has started.
        // Testing each word's own window independently lets two light up at
        // once whenever the windows overlap.
        const current = i === currentIndex;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              // Unspoken words stay faint so the viewer can read ahead a little.
              color: current ? theme.accent : spoken ? (color || theme.text) : hexToRgba(color || theme.text, 0.32),
              transform: current ? 'scale(1.06)' : 'scale(1)',
              textShadow: current && theme.glow !== 'none' ? theme.glow : undefined,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
