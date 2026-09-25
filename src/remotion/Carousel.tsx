import React from 'react';
import { AbsoluteFill } from 'remotion';
import {
  BODY_HEIGHT, CONTENT_WIDTH, LETTERS, OPTION, QUESTION_GAP, SLIDE_SIZE, textHeight, type Slide,
} from '../lib/carousel.ts';
import { getTheme, hexToRgba, type Theme } from '../lib/theme';
import type { DesignSettings, QuizContent } from '../lib/types';
import { FigureView } from './Figure';
import { Backdrop } from './ui';
import { HandFonts } from './fonts';
import { DoodleFilters, DoodleInk, DoodleMark } from './DoodleInk';
import { doodleBlend, FADE_EDGES } from './DoodleStage';
import { Img, staticFile } from 'remotion';

// ---------------------------------------------------------------------------
// One square carousel slide.
//
// Every slide shares a frame: a label and a counter along the top, the body in
// the middle, the channel and a swipe cue along the bottom. The frame is what
// makes six separate images read as one post when they sit side by side in a
// profile grid, and the counter is what tells a reader there is more to swipe.
//
// Sizes come from the plan (src/lib/carousel.ts), which has already checked
// that the text fits. This component only lays it out.
// ---------------------------------------------------------------------------

export const CAROUSEL_ID = 'CarouselSlide';
/** Rendered at the last frame, so every entrance animation borrowed from the video has finished. */
export const CAROUSEL_FRAMES = 120;

export type CarouselSlideProps = {
  content: QuizContent;
  design: DesignSettings;
  slide: Slide;
  /** 0-based. */
  index: number;
  total: number;
  channelName: string;
  /** Doodle look: the mascot's model sheet, relative to public/, for the closing slide. */
  mascot?: string;
};

const PAD_X = (SLIDE_SIZE - CONTENT_WIDTH) / 2;
const STRIP = (SLIDE_SIZE - BODY_HEIGHT) / 2;

const LABELS: Record<Slide['kind'], string> = {
  question: 'Question',
  options: 'Your options',
  answer: 'Answer',
  worked: 'Worked out',
  why: 'Why',
  outro: 'Did you know?',
};

export const CarouselSlide: React.FC<CarouselSlideProps> = ({ content, design, slide, index, total, channelName, mascot }) => {
  const theme = getTheme(design);
  const last = index === total - 1;
  const label = slide.kind === 'why' && slide.parts > 1
    ? 'Why · ' + slide.part + ' of ' + slide.parts
    : slide.kind === 'outro' && !slide.fact ? 'Keep going' : LABELS[slide.kind];
  const swipe = last ? '' : slide.kind === 'question' || slide.kind === 'options' ? 'Swipe for the answer →' : 'Swipe →';

  // In the Doodle look the post matches the video: the same page, the same
  // marker, everything inked by hand. Held still - a slide is a photograph of
  // one frame, and a boil only exists between frames.
  const doodle = theme.layout === 'doodle';
  // The band the plan kept free at the foot of the closing slide. The body
  // shrinks by it, and the engineer stands in it - never over the words.
  const band = doodle && mascot && slide.kind === 'outro' ? slide.picture : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, color: theme.text, overflow: 'hidden' }}>
      {doodle ? <HandFonts /> : null}
      {doodle ? <DoodleFilters boil={false} /> : null}
      <Backdrop theme={theme} />
      {/* Calms the decoration so the body text never competes with it. */}
      <AbsoluteFill style={{ background: hexToRgba(theme.bg, 0.55) }} />

      {band ? (
        // Outside the inked group on purpose: a blend inside a filtered group
        // has nothing behind it to blend with, and shows as a white box.
        <div style={{ position: 'absolute', left: PAD_X, width: CONTENT_WIDTH, top: STRIP + BODY_HEIGHT - band, height: band }}>
          <Img
            src={staticFile(mascot!.replace(/^\/+/, ''))}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              // The model sheet is mostly empty paper round a figure in its
              // middle third. That paper blends away to nothing, so the sheet
              // is scaled up past its band: the engineer grows, and only
              // invisible paper crosses into the room above.
              transform: 'scale(1.4)', transformOrigin: '50% 62%',
              WebkitMaskImage: FADE_EDGES, maskImage: FADE_EDGES, ...doodleBlend(theme),
            }}
          />
        </div>
      ) : null}

      <Inked on={doodle}>

      {/* Top strip: what this slide is, and where it sits in the post. */}
      <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: 0, height: STRIP, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          padding: '12px 26px', borderRadius: 999, background: slide.kind === 'answer' ? theme.correct : theme.accent,
          color: theme.bg, fontFamily: theme.fontBody, fontWeight: 800, fontSize: 30, letterSpacing: 2, textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <div style={{ fontFamily: theme.fontBody, fontWeight: 700, fontSize: 30, color: theme.textDim, fontVariantNumeric: 'tabular-nums' }}>
          {index + 1} / {total}
        </div>
      </div>

      {/* Body. */}
      <div style={{ position: 'absolute', left: PAD_X, width: CONTENT_WIDTH, top: STRIP, height: BODY_HEIGHT - band, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Body slide={slide} theme={theme} content={content} channelName={channelName} />
      </div>

      {/* Bottom strip: whose post it is, and the cue to keep swiping. */}
      <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, bottom: 0, height: STRIP, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30 }}>
        <div style={{ fontFamily: theme.fontBody, fontWeight: 700, fontSize: 28, color: theme.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {/* The last slide names the channel large in its body; once is enough. */}
          {last && slide.kind === 'outro' && channelName ? '' : channelName || [content.subject, content.topic].filter(Boolean)[0] || ''}
        </div>
        {swipe ? (
          <div style={{ fontFamily: theme.fontBody, fontWeight: 800, fontSize: 30, color: theme.accent, whiteSpace: 'nowrap' }}>{swipe}</div>
        ) : null}
      </div>

      {/* The same accent edge as the thumbnail, so the post and the Reel cover look like one set. */}
      <AbsoluteFill style={{ border: '10px solid ' + theme.accent, pointerEvents: 'none' }} />
      </Inked>
    </AbsoluteFill>
  );
};

/** Hand-inks what it wraps in the Doodle look; passes it through untouched in any other. */
const Inked: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) =>
  (on ? <DoodleInk>{children}</DoodleInk> : <>{children}</>);

const display = (theme: Theme, size: number): React.CSSProperties => ({
  fontFamily: theme.fontDisplay,
  fontWeight: theme.displayWeight,
  fontStyle: theme.displayItalic ? 'italic' : 'normal',
  letterSpacing: theme.displayTracking,
  fontSize: size,
  lineHeight: 1.12,
  margin: 0,
});

const Body: React.FC<{ slide: Slide; theme: Theme; content: QuizContent; channelName: string }> = ({ slide, theme, content, channelName }) => {
  switch (slide.kind) {
    case 'question': {
      const figureH = slide.figure
        ? BODY_HEIGHT - textHeight(slide.question, slide.questionSize, CONTENT_WIDTH, 1.12, 0.6) - QUESTION_GAP
        : 0;
      return (
        <>
          {slide.kicker && !slide.options.length && !slide.figure ? (
            <div style={{ fontFamily: theme.fontBody, fontWeight: 800, fontSize: 30, letterSpacing: 3, textTransform: 'uppercase', color: theme.accent, marginBottom: 26 }}>
              {slide.kicker}
            </div>
          ) : null}
          <h1 style={display(theme, slide.questionSize)}>{slide.question}</h1>
          {slide.options.length ? (
            <div style={{ marginTop: QUESTION_GAP }}>
              <Options options={slide.options} size={slide.optionSize} theme={theme} />
            </div>
          ) : null}
          {slide.figure && content.figure ? (
            <div style={{ marginTop: QUESTION_GAP, display: 'flex', justifyContent: 'center' }}>
              <FigureView theme={theme} figure={content.figure} reveal={false}
                box={{ w: CONTENT_WIDTH, h: Math.max(300, Math.floor(figureH)), font: 30 }} />
            </div>
          ) : null}
        </>
      );
    }
    case 'options':
      return (
        <>
          <div style={{ ...display(theme, 50), marginBottom: 40 }}>{slide.prompt}</div>
          <Options options={slide.options} size={slide.optionSize} theme={theme} />
        </>
      );
    case 'answer':
      return (
        <>
          <Options options={slide.options} size={slide.optionSize} theme={theme} correctIndex={slide.correctIndex} />
          {slide.answerLine ? (
            <p style={{ fontFamily: theme.fontBody, fontWeight: 700, fontSize: slide.answerSize, lineHeight: 1.25, margin: '36px 0 0', color: theme.text }}>
              {slide.answerLine}
            </p>
          ) : null}
        </>
      );
    case 'worked':
      return content.figure ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FigureView theme={theme} figure={content.figure} reveal box={{ w: CONTENT_WIDTH, h: BODY_HEIGHT, font: 30 }} />
        </div>
      ) : null;
    case 'why':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          {slide.steps.map((step) => (
            <div key={step.number} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{
                flex: '0 0 auto', width: 56 * 1.6, height: 56 * 1.6, borderRadius: '50%', background: theme.accent, color: theme.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontBody, fontWeight: 900, fontSize: 44,
              }}>
                {step.number}
              </div>
              <div style={{ fontFamily: theme.fontBody, fontWeight: 600, fontSize: slide.size, lineHeight: 1.3, paddingTop: Math.max(0, (56 * 1.6 - slide.size * 1.3) / 2) }}>
                {step.text}
              </div>
            </div>
          ))}
        </div>
      );
    case 'outro':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          {slide.fact ? (
            <div style={{
              padding: '40px 60px', borderRadius: Math.max(theme.radius, 18), background: hexToRgba(theme.accent, 0.12),
              border: '3px solid ' + hexToRgba(theme.accent, 0.5),
              fontFamily: theme.fontBody, fontWeight: 600, fontSize: slide.factSize, lineHeight: 1.3,
            }}>
              {slide.fact}
            </div>
          ) : null}
          <div style={display(theme, slide.fact ? 54 : 76)}>
            {/* An emoji is the one full-colour thing on an ink page - so on one, it is inked too. */}
            <span style={theme.layout === 'doodle' ? { filter: 'grayscale(1) contrast(1.4)' } : undefined}>💾</span>{' '}
            Save this for revision.
            <br />
            <span style={{ color: theme.accent }}>Follow for one every day.</span>
          </div>
          {channelName ? (
            <div style={{ fontFamily: theme.fontBody, fontWeight: 800, fontSize: 40, color: theme.accent }}>{channelName}</div>
          ) : null}
        </div>
      );
    default:
      return null;
  }
};

/** The option rows. With `correctIndex`, the right one is marked and the rest step back. */
const Options: React.FC<{ options: string[]; size: number; theme: Theme; correctIndex?: number }> = ({ options, size, theme, correctIndex }) => {
  const marking = typeof correctIndex === 'number';
  // Marked like the video's answer: circled and struck through by hand,
  // rather than faded and given a typed line-through.
  const doodle = theme.layout === 'doodle';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: OPTION.gap }}>
      {options.map((option, i) => {
        const right = marking && i === correctIndex;
        const wrong = marking && !right;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 22, padding: OPTION.padY + 'px 22px',
            borderRadius: Math.max(theme.radius, 14),
            background: right ? hexToRgba(theme.correct, 0.2) : theme.surface,
            border: Math.max(3, theme.borderWidth) + 'px solid ' + (right ? theme.correct : theme.border),
            opacity: wrong ? (doodle ? 0.62 : 0.45) : 1,
            position: doodle ? 'relative' : undefined,
          }}>
            <div style={{
              flex: '0 0 auto', width: size * OPTION.badge, height: size * OPTION.badge, borderRadius: '50%',
              background: right ? theme.correct : hexToRgba(theme.accent, 0.18), color: right ? theme.bg : theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.fontBody, fontWeight: 900, fontSize: size * 0.9,
            }}>
              {right ? '✓' : LETTERS[i]}
            </div>
            <div style={{
              fontFamily: theme.fontBody, fontWeight: right ? 800 : 700, fontSize: size, lineHeight: OPTION.lineHeight,
              textDecoration: wrong && !doodle ? 'line-through' : 'none', textDecorationColor: hexToRgba(theme.wrong, 0.7),
            }}>
              {option}
            </div>
            {doodle && marking ? (
              <DoodleMark kind={right ? 'circle' : 'strike'} color={right ? theme.correct : theme.text} width={right ? 7 : 5} progress={1} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
