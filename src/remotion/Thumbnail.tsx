import React from 'react';
import { AbsoluteFill } from 'remotion';
import { getTheme, hexToRgba } from '../lib/theme';
import type { DesignSettings, QuizContent } from '../lib/types';
import { AmbientLayer } from './AmbientLayer';
import { Backdrop } from './ui';

// ---------------------------------------------------------------------------
// The thumbnail.
//
// A still, not a frame of the video, because the two jobs are different. A
// frame has to work for the three seconds it is on screen with a voice
// explaining it. A thumbnail has to work in the width of a thumb, with no
// sound, against thirty other thumbnails, in about a fifth of a second.
//
// Everything here follows from that one measurement: YouTube shows these at
// roughly 210 pixels wide in a feed. So the title is enormous, the word count
// is capped rather than shrunk to fit, and there is always a solid scrim
// between the text and whatever is behind it. A thumbnail that is merely
// readable at full size is not readable at all.
// ---------------------------------------------------------------------------

export type ThumbnailLayout = 'question' | 'statement' | 'split' | 'number';

export type ThumbnailProps = {
  content: QuizContent;
  design: DesignSettings;
  /** The big text. Wrap a word in *asterisks* to colour it with the accent. */
  title: string;
  /** A small line above the title - the subject, or the exam. */
  kicker: string;
  /** A corner tag, e.g. "GATE EE". Empty to leave it off. */
  badge: string;
  /** The big figure for the 'number' layout, e.g. "8,760" or "60%". */
  figure: string;
  /** One emoji for the 'split' layout. */
  symbol: string;
  layout: ThumbnailLayout;
};

export const THUMBNAIL_ID = 'Thumbnail';
export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;

/** Words per line at each size, tuned so nothing ever needs shrinking to fit. */
function titleSize(text: string, cap: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.replace(/\*/g, '').length;
  if (chars <= 18 && words <= 3) return cap;
  if (chars <= 30) return cap * 0.82;
  if (chars <= 46) return cap * 0.66;
  return cap * 0.54;
}

/** Split on *marked* words so one phrase can carry the accent colour. */
const Marked: React.FC<{ text: string; accent: string }> = ({ text, accent }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
      part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
        <span key={i} style={{ color: accent }}>{part.slice(1, -1)}</span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </>
);

export const Thumbnail: React.FC<ThumbnailProps> = ({
  content,
  design,
  title,
  kicker,
  badge,
  figure,
  symbol,
  layout,
}) => {
  const theme = getTheme(design);
  const bigText = (title || content.question || '').trim();

  const shell: React.CSSProperties = {
    fontFamily: theme.fontDisplay,
    fontWeight: 900,
    color: theme.text,
    lineHeight: 1.02,
    letterSpacing: theme.displayTracking,
    textTransform: theme.displayTransform,
    // Every layout gets this. Thumbnails are viewed over whatever the feed puts
    // behind them, and a hairline shadow is what keeps light text off a light
    // photo from dissolving.
    textShadow: '0 4px 26px ' + hexToRgba(theme.bg, 0.85),
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      <Backdrop theme={theme} />

      {design.ambient && design.ambient !== 'none' ? (
        <AmbientLayer
          theme={theme}
          content={content}
          name={design.ambient}
          intensity={design.ambientIntensity}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
        />
      ) : null}

      {/* The scrim. Without it the title competes with the backdrop at the one
          size where the title has to win outright. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, ' + hexToRgba(theme.bg, 0.55) + ' 0%, ' +
            hexToRgba(theme.bg, 0.8) + ' 55%, ' + hexToRgba(theme.bg, 0.94) + ' 100%)',
        }}
      />

      {/* A thick accent edge. It is what makes the tile read as one object at
          210 pixels rather than as a rectangle of text. */}
      <AbsoluteFill
        style={{ border: '10px solid ' + theme.accent, borderRadius: 2, pointerEvents: 'none' }}
      />

      <AbsoluteFill
        style={{
          padding: '62px 68px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {badge ? (
          <div
            style={{
              position: 'absolute',
              top: 44,
              right: 52,
              padding: '12px 26px',
              borderRadius: 999,
              background: theme.accent,
              color: theme.bg,
              fontFamily: theme.fontDisplay,
              fontWeight: 900,
              fontSize: 34,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {badge}
          </div>
        ) : null}

        {kicker ? (
          <div
            style={{
              fontFamily: theme.fontBody,
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: theme.accent,
              marginBottom: 22,
            }}
          >
            {kicker}
          </div>
        ) : null}

        {layout === 'split' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
            <div style={{ ...shell, fontSize: titleSize(bigText, 116), flex: 1, minWidth: 0 }}>
              <Marked text={bigText} accent={theme.accent} />
            </div>
            {symbol ? (
              <div style={{ fontSize: 300, lineHeight: 1, flex: '0 0 auto' }}>{symbol}</div>
            ) : null}
          </div>
        ) : layout === 'number' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                ...shell,
                fontSize: 250,
                color: theme.accent,
                // Not tighter than 1. A figure with a comma in it has a
                // descender, and at 250px a 0.94 line let it sit on top of the
                // words underneath.
                lineHeight: 1,
                textShadow: '0 6px 40px ' + hexToRgba(theme.accent, 0.45),
              }}
            >
              {figure || '?'}
            </div>
            <div style={{ ...shell, fontSize: titleSize(bigText, 84) }}>
              <Marked text={bigText} accent={theme.accent} />
            </div>
          </div>
        ) : layout === 'question' ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 34 }}>
            <div
              style={{
                ...shell,
                fontSize: 210,
                color: theme.accent,
                lineHeight: 0.8,
                flex: '0 0 auto',
              }}
            >
              ?
            </div>
            <div style={{ ...shell, fontSize: titleSize(bigText, 108), flex: 1, minWidth: 0 }}>
              <Marked text={bigText} accent={theme.accent} />
            </div>
          </div>
        ) : (
          <div style={{ ...shell, fontSize: titleSize(bigText, 134) }}>
            <Marked text={bigText} accent={theme.accent} />
          </div>
        )}

        {/* A rule, not a caption. Anything smaller than the title is unreadable
            at feed size, so nothing smaller than the title is worth the room. */}
        <div
          style={{
            marginTop: 30,
            height: 12,
            width: 210,
            borderRadius: 999,
            background: theme.accent,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
