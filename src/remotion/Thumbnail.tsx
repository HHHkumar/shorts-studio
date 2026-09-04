import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { getTheme, hexToRgba } from '../lib/theme';
import type { DesignSettings, QuizContent, ThumbnailShape } from '../lib/types';
export { THUMB_SIZES, thumbSizeFor, type ThumbnailShape } from '../lib/types';
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
// Everything here follows from that one measurement: a thumbnail is shown at
// roughly two hundred pixels wide, in either shape. So the title is enormous,
// the word count is capped rather than shrunk to fit, and there is always a
// scrim between the text and whatever is behind it. A thumbnail that is merely
// readable at full size is not readable at all.
//
// Two shapes, because the two places these go are different. 16:9 is the
// YouTube cover image. 9:16 is what a Short or a Reel shows, and it is not a
// cropped 16:9 - the layouts that put two things side by side have to stack,
// and a title has a lot more room to wrap.
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
  shape: ThumbnailShape;
};

export const THUMBNAIL_ID = 'Thumbnail';

/**
 * The largest size this text can take without needing to be shrunk to fit.
 *
 * Portrait gets more generous thresholds because it has the height to wrap
 * into: the same sentence that must go small to fit two lines of a 16:9 frame
 * can stay big across four lines of a 9:16 one.
 */
function titleSize(text: string, cap: number, portrait: boolean): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.replace(/\*/g, '').length;
  const short = portrait ? 22 : 18;
  const mid = portrait ? 40 : 30;
  const long = portrait ? 60 : 46;
  if (chars <= short && words <= 4) return cap;
  if (chars <= mid) return cap * 0.82;
  if (chars <= long) return cap * 0.68;
  return cap * 0.56;
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
  // Taken from the composition rather than the props, so the two can never
  // disagree about what is being drawn.
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const theme = getTheme(design);
  const bigText = (title || content.question || '').trim();

  // Everything scales off the width, so a size tuned in one shape holds in the
  // other instead of being re-guessed per layout.
  const s = width / 1280;
  const px = (n: number) => Math.round(n * s);

  const shell: React.CSSProperties = {
    fontFamily: theme.fontDisplay,
    fontWeight: 900,
    color: theme.text,
    lineHeight: 1.02,
    letterSpacing: theme.displayTracking,
    textTransform: theme.displayTransform,
    // Thumbnails are viewed over whatever the feed puts behind them, and this
    // is what keeps light text off a light surface from dissolving.
    textShadow: '0 ' + px(4) + 'px ' + px(26) + 'px ' + hexToRgba(theme.bg, 0.85),
  };

  const titleCap = portrait ? 150 : 134;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      <Backdrop theme={theme} />

      {design.ambient && design.ambient !== 'none' ? (
        <AmbientLayer
          theme={theme}
          content={content}
          name={design.ambient}
          intensity={design.ambientIntensity}
          width={width}
          height={height}
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

      {/* A thick accent edge, which is what makes the tile read as one object
          at two hundred pixels rather than as a rectangle of text. */}
      <AbsoluteFill
        style={{
          border: px(10) + 'px solid ' + theme.accent,
          borderRadius: 2,
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill
        style={{
          padding: px(portrait ? 74 : 62) + 'px ' + px(68) + 'px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {badge ? (
          <div
            style={{
              position: 'absolute',
              top: px(portrait ? 62 : 44),
              right: px(52),
              padding: px(12) + 'px ' + px(26) + 'px',
              borderRadius: 999,
              background: theme.accent,
              color: theme.bg,
              fontFamily: theme.fontDisplay,
              fontWeight: 900,
              fontSize: px(34),
              letterSpacing: px(1.5),
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
              fontSize: px(40),
              letterSpacing: px(4),
              textTransform: 'uppercase',
              color: theme.accent,
              marginBottom: px(22),
            }}
          >
            {kicker}
          </div>
        ) : null}

        {layout === 'split' ? (
          // Side by side in 16:9, stacked in 9:16. A narrow frame split into
          // two columns leaves both of them too thin to carry anything.
          <div
            style={{
              display: 'flex',
              flexDirection: portrait ? 'column-reverse' : 'row',
              alignItems: portrait ? 'flex-start' : 'center',
              gap: px(portrait ? 30 : 46),
            }}
          >
            <div
              style={{
                ...shell,
                fontSize: px(titleSize(bigText, portrait ? titleCap : 116, portrait)),
                flex: portrait ? '0 0 auto' : 1,
                minWidth: 0,
              }}
            >
              <Marked text={bigText} accent={theme.accent} />
            </div>
            {symbol ? (
              <div style={{ fontSize: px(portrait ? 400 : 300), lineHeight: 1, flex: '0 0 auto' }}>
                {symbol}
              </div>
            ) : null}
          </div>
        ) : layout === 'number' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(4) }}>
            <div
              style={{
                ...shell,
                fontSize: px(portrait ? 300 : 250),
                color: theme.accent,
                // Not tighter than 1. A figure with a comma in it has a
                // descender, and a 0.94 line let it sit on the words below.
                lineHeight: 1,
                textShadow: '0 ' + px(6) + 'px ' + px(40) + 'px ' + hexToRgba(theme.accent, 0.45),
              }}
            >
              {figure || '?'}
            </div>
            <div style={{ ...shell, fontSize: px(titleSize(bigText, portrait ? 96 : 84, portrait)) }}>
              <Marked text={bigText} accent={theme.accent} />
            </div>
          </div>
        ) : layout === 'question' ? (
          // The mark sits beside the text in 16:9 and above it in 9:16, where
          // taking a third of the width for one glyph would cost too much.
          <div
            style={{
              display: 'flex',
              flexDirection: portrait ? 'column' : 'row',
              alignItems: 'flex-start',
              gap: px(portrait ? 0 : 34),
            }}
          >
            <div
              style={{
                ...shell,
                fontSize: px(portrait ? 300 : 210),
                color: theme.accent,
                lineHeight: 0.8,
                flex: '0 0 auto',
                marginBottom: portrait ? px(24) : 0,
              }}
            >
              ?
            </div>
            <div
              style={{
                ...shell,
                fontSize: px(titleSize(bigText, portrait ? titleCap : 108, portrait)),
                flex: portrait ? '0 0 auto' : 1,
                minWidth: 0,
              }}
            >
              <Marked text={bigText} accent={theme.accent} />
            </div>
          </div>
        ) : (
          <div style={{ ...shell, fontSize: px(titleSize(bigText, titleCap, portrait)) }}>
            <Marked text={bigText} accent={theme.accent} />
          </div>
        )}

        {/* A rule, not a caption. Anything smaller than the title is unreadable
            at feed size, so nothing smaller than the title is worth the room. */}
        <div
          style={{
            marginTop: px(30),
            height: px(12),
            width: px(210),
            borderRadius: 999,
            background: theme.accent,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
