import React from 'react';
import { interpolate, spring } from 'remotion';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import {
  CARD_STAGGER, columnsFor, isTall, mathWidth, parseMath, type FormulaCard, type FormulaSheet as Sheet,
} from '../lib/formula-card';
import { MathText } from './MathText';
import { FormulaGraph } from './FormulaGraph';

// ---------------------------------------------------------------------------
// The formula card as a revision sheet: a title, then one card per formula -
// its icon, its number and name, the formula typeset, what the symbols mean,
// and a small graph of what it says.
//
// Sized from the box it is given, so the same sheet fills a 9:16 frame (one
// column), a 16:9 one (two columns) and a square carousel slide. In a video
// the cards arrive one after another and each graph draws itself in; `still`
// is for a picture of the finished sheet - everything drawn, nothing waiting.
// ---------------------------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** How many frames a card's graph takes to draw itself on. */
const DRAW_FRAMES = 26;

export const FormulaSheetView: React.FC<{
  theme: Theme;
  sheet: Sheet;
  width: number;
  height: number;
  /** Frames since the sheet appeared. */
  frame: number;
  fps: number;
  /** A finished picture: every card in, every graph drawn. */
  still?: boolean;
  /** Leave the title off - a carousel slide has its own heading. */
  noTitle?: boolean;
}> = ({ theme, sheet, width, height, frame, fps, still = false, noTitle = false }) => {
  const cards = sheet.cards;
  const cols = columnsFor(cards.length, width, height);
  const rows = Math.ceil(cards.length / cols);
  const titleSize = noTitle ? 0 : clamp(Math.min(width * 0.06, height * 0.05), 30, 76);
  const titleH = noTitle ? 0 : titleSize * 1.6;
  const gap = clamp(height * 0.014, 12, 24);
  const cardW = (width - gap * (cols - 1)) / cols;
  // One or two cards may grow tall, and stack their graphs; a full sheet keeps
  // every card the same modest shape.
  const cardH = Math.min((height - titleH - gap * rows) / rows, cardW * (cards.length <= 2 ? 1.1 : 0.62));

  const titleIn = still ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 110 } });

  return (
    // A short sheet sits in the middle of the frame, not stuck to its top.
    <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {noTitle ? null : (
        <div
          style={{
            height: titleH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.fontDisplay,
            fontWeight: theme.displayWeight,
            fontSize: titleSize,
            color: theme.accent,
            textAlign: 'center',
            letterSpacing: theme.displayTracking,
            opacity: titleIn,
            transform: 'translateY(' + (1 - titleIn) * -20 + 'px)',
            whiteSpace: 'nowrap',
            maxWidth: width,
          }}
        >
          <span style={{ fontSize: Math.min(1, (width * 0.98) / (sheet.title.length * titleSize * 0.52)) + 'em' }}>{sheet.title}</span>
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(' + cols + ', ' + cardW + 'px)',
          gridAutoRows: cardH + 'px',
          gap,
          marginTop: noTitle ? 0 : gap * 0.5,
        }}
      >
        {cards.map((card, i) => {
          const at = 6 + i * CARD_STAGGER;
          const enter = still ? 1 : spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 120, mass: 0.8 } });
          const draw = still ? 1 : interpolate(frame, [at + 8, at + 8 + DRAW_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          // A still is caught mid-loop at a moment that shows it well.
          const time = still ? 1.1 : Math.max(0, frame - at - 8 - DRAW_FRAMES) / fps;
          return (
            <Card key={i} theme={theme} card={card} number={i + 1} w={cardW} h={cardH} enter={enter} draw={draw} time={time} />
          );
        })}
      </div>
    </div>
  );
};

const Card: React.FC<{
  theme: Theme;
  card: FormulaCard;
  number: number;
  w: number;
  h: number;
  enter: number;
  draw: number;
  time: number;
}> = ({ theme, card, number, w, h, enter, draw, time }) => {
  const pad = clamp(h * 0.08, 10, 22);
  const hasGraph = card.graph.kind !== 'none';
  // A card taller than it is wide - a sheet of one or two - puts its graph
  // underneath, large, rather than squeezed beside words in a big empty box.
  const stacked = h > w * 0.45;
  const graphW = !hasGraph ? 0 : stacked ? Math.min(w - pad * 2, h * 0.5 * 1.6) : Math.min(w * 0.36, (h - pad * 2) * 1.6);
  const graphH = graphW / 1.6;
  // A narrow card - two to a carousel row - gives the icon's room to the words.
  const icon = card.art && card.art.body && w > 600 ? Math.min(stacked ? h * 0.16 : h * 0.44, w * 0.13) : 0;
  const textW = w - pad * 2 - (stacked ? 0 : graphW + (hasGraph ? pad : 0)) - (icon ? icon + pad : 0);
  // Sizes follow the card's height - but a stacked card shares it with its graph.
  const room = stacked ? h * 0.42 : h;

  // Smaller before cut short: a name that ends in "..." is no use on a
  // revision sheet. Monospace looks set the widest letters.
  const perChar = /mono|consol|courier/i.test(theme.fontBody) ? 0.62 : 0.52;
  const fitting = (text: string, size: number, min: number) =>
    Math.max(min, Math.min(size, textW / Math.max(1, text.length * perChar)));
  // Down to a readable floor, and past that onto a second line.
  const nameSize = fitting(number + '. ' + card.name, clamp(room * 0.13, 16, 52), 18);
  const nameWraps = (number + '. ' + card.name).length * perChar * nameSize > textW;
  const noteSize = Math.min(...card.notes.map((n) => fitting(n, clamp(room * 0.075, 13, 30), 12)), clamp(room * 0.075, 13, 30));
  const nodes = React.useMemo(() => parseMath(card.formula), [card.formula]);
  const tall = isTall(nodes);
  // As big as the card allows, then down until it fits the width.
  const byHeight = clamp(room * (tall ? 0.2 : 0.25), 18, stacked ? 120 : 76);
  // The width estimate runs a little short of real italic type, so it is given
  // room: a fraction that reached into the graph was the first to show it.
  const formulaSize = Math.max(14, Math.min(byHeight, textW / Math.max(1, mathWidth(nodes) * 1.18)));
  const notes = card.notes.slice(0, h > 150 ? 2 : 1);

  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: stacked ? 'center' : undefined,
        gap: pad,
        padding: pad,
        background: theme.surface,
        border: theme.borderWidth + 'px solid ' + hexToRgba(theme.border === 'transparent' ? theme.text : theme.border, 0.35),
        borderRadius: Math.min(theme.radius, 22),
        boxShadow: theme.shadow,
        opacity: enter,
        transform: 'translateY(' + (1 - enter) * 26 + 'px) scale(' + (0.96 + 0.04 * enter) + ')',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: pad, width: stacked ? '100%' : undefined, justifyContent: stacked ? 'center' : undefined }}>
      {icon ? (
        <div
          style={{
            width: icon,
            height: icon,
            flex: 'none',
            borderRadius: icon * 0.28,
            background: theme.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.accent,
          }}
        >
          <svg
            viewBox={'0 0 ' + card.art!.width + ' ' + card.art!.height}
            width={icon * 0.66}
            height={icon * 0.66}
            fill="currentColor"
            dangerouslySetInnerHTML={{ __html: card.art!.body }}
          />
        </div>
      ) : null}
      <div style={{ width: stacked ? undefined : textW, maxWidth: textW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: room * 0.035 }}>
        <div
          style={{
            fontFamily: theme.fontBody,
            fontWeight: 700,
            fontSize: nameSize,
            color: theme.text,
            lineHeight: 1.1,
            whiteSpace: nameWraps ? 'normal' : 'nowrap',
            overflow: 'hidden',
            maxHeight: nameSize * 2.3,
          }}
        >
          <span style={{ color: theme.accent }}>{number}.</span> {card.name}
        </div>
        <div style={{ lineHeight: 1 }}>
          <MathText theme={theme} src={card.formula} size={formulaSize} />
        </div>
        {notes.map((n, k) => (
          <div
            key={k}
            style={{
              fontFamily: theme.fontBody,
              fontSize: noteSize,
              color: theme.textDim,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {n}
          </div>
        ))}
      </div>
      </div>
      {hasGraph ? (
        <div style={{ flex: 'none', width: graphW, height: graphH, marginLeft: stacked ? undefined : 'auto' }}>
          <FormulaGraph theme={theme} graph={card.graph} draw={draw} time={time} width={graphW} height={graphH} />
        </div>
      ) : null}
    </div>
  );
};
