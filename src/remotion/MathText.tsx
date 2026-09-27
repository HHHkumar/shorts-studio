import React from 'react';
import type { Theme } from '../lib/theme';
import { isSpaced, parseMath, type MathNode } from '../lib/formula-card';

// ---------------------------------------------------------------------------
// A formula, typeset: fractions stacked, roots with their bar, subscripts and
// superscripts, variables in italic. Plain HTML spans, so it sits in any text
// and scales with the font size it is given.
//
// The face is the textbook one - Cambria Math, which every Windows machine
// has, and the renderer's Chrome uses it - in every look but Doodle, where the
// formula is written in the same marker as the rest of the page. Handwriting
// is not slanted into italics; the pen already leans.
// ---------------------------------------------------------------------------

export const MATH_FONT = "'Cambria Math', Cambria, 'Times New Roman', Georgia, serif";

export const mathFontFor = (theme: Theme): string => (theme.layout === 'doodle' ? theme.fontDisplay : MATH_FONT);

const Nodes: React.FC<{ nodes: MathNode[]; italic: boolean }> = ({ nodes, italic }) => (
  <>
    {nodes.map((n, i) => <Node key={i} n={n} italic={italic} />)}
  </>
);

const Node: React.FC<{ n: MathNode; italic: boolean }> = ({ n, italic }) => {
  if (n.t === 'text') {
    return (
      <span
        style={{
          fontStyle: italic && n.style === 'var' ? 'italic' : 'normal',
          margin: isSpaced(n) ? '0 0.24em' : n.style === 'word' ? '0 0.12em' : undefined,
          whiteSpace: 'pre',
        }}
      >
        {n.s}
      </span>
    );
  }
  if (n.t === 'frac') {
    return (
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          verticalAlign: 'middle',
          margin: '0 0.12em',
          fontSize: '0.88em',
          lineHeight: 1.05,
        }}
      >
        <span style={{ padding: '0 0.15em' }}><Nodes nodes={n.num} italic={italic} /></span>
        <span style={{ alignSelf: 'stretch', height: '0.07em', minHeight: 2, background: 'currentColor', margin: '0.06em 0' }} />
        {/* A little more room below the bar: a root's own bar sat on it. */}
        <span style={{ padding: '0.12em 0.15em 0' }}><Nodes nodes={n.den} italic={italic} /></span>
      </span>
    );
  }
  if (n.t === 'sqrt') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'stretch', verticalAlign: 'middle', margin: '0 0.06em' }}>
        <span style={{ fontSize: '1.15em', lineHeight: 1, marginRight: '-0.04em', fontStyle: 'normal' }}>√</span>
        <span style={{ borderTop: '0.07em solid currentColor', padding: '0.04em 0.1em 0', lineHeight: 1.1 }}>
          <Nodes nodes={n.body} italic={italic} />
        </span>
      </span>
    );
  }
  // Scripts: both stacked beside the base, or the one alone, raised or lowered.
  const small: React.CSSProperties = { fontSize: '0.62em', lineHeight: 1 };
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {n.base ? <Node n={n.base} italic={italic} /> : null}
      {n.sub && n.sup ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', ...small, marginLeft: '0.05em' }}>
          <span><Nodes nodes={n.sup} italic={italic} /></span>
          <span><Nodes nodes={n.sub} italic={italic} /></span>
        </span>
      ) : n.sup ? (
        <span style={{ ...small, verticalAlign: '0.8em', marginLeft: '0.04em' }}><Nodes nodes={n.sup} italic={italic} /></span>
      ) : n.sub ? (
        <span style={{ ...small, verticalAlign: '-0.3em', marginLeft: '0.03em' }}><Nodes nodes={n.sub} italic={italic} /></span>
      ) : null}
    </span>
  );
};

/** A formula written in the card notation (src/lib/formula-card.ts), typeset. */
export const MathText: React.FC<{
  theme: Theme;
  src: string;
  size: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ theme, src, size, color, style }) => {
  const nodes = React.useMemo(() => parseMath(src), [src]);
  return (
    <span
      style={{
        fontFamily: mathFontFor(theme),
        fontSize: size,
        color: color || theme.text,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      <Nodes nodes={nodes} italic={theme.layout !== 'doodle'} />
    </span>
  );
};
