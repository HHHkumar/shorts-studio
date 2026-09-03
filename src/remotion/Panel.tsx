import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { alignLabels, revealedCount } from '../lib/options-timing';
import type { Theme } from '../lib/theme';
import { hexToRgba } from '../lib/theme';
import type { PanelEdge, PanelNode, PanelStep, ScenePanel, WordTiming } from '../lib/types';
import { autoFontSize, useEnter, useMetrics } from './ui';
import { MotionPanel } from './Motion';

// ---------------------------------------------------------------------------
// The explainer scene primitives.
//
// Each of these is a whole-frame layout, not a small graphic tucked under a
// line of text. That is the difference between a short and an explainer: a
// short says one thing per scene, an explainer shows a structure and walks you
// round it.
//
// Every reveal is driven by the narration. `useReveal` matches each label
// against the spoken word timings, so an item lights up when the voice actually
// reaches it - not on a timer somebody guessed. When the match fails (a
// paraphrase, another language, no audio recorded yet) it spreads the items
// evenly, which still reads as deliberate rather than broken.
//
// No hooks inside map loops: the parent reads the frame once and every item
// animation is a pure function of it.
// ---------------------------------------------------------------------------

export interface PanelProps {
  theme: Theme;
  panel: ScenePanel;
  /** Word timings for this scene's narration, which drive the reveals. */
  words: WordTiming[];
  /** Seconds added to every word timing to cancel the mp3 encoder delay. */
  offset: number;
}

interface Reveal {
  /** How many entries the narration has reached. At least one. */
  count: number;
  frame: number;
  fps: number;
}

function useReveal(labels: string[], words: WordTiming[], offset: number): Reveal {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const seconds = durationInFrames / fps;
  const starts = alignLabels(words, labels, seconds);
  const count = labels.length ? revealedCount(starts, frame / fps - offset) : 0;
  return { count, frame, fps };
}

/** How far the nth item has animated in, 0 before the voice reaches it. */
function itemEntry(r: Reveal, index: number): number {
  if (index >= r.count) return 0;
  return interpolate(r.frame - index * 2, [0, r.fps * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Title / section card
// ---------------------------------------------------------------------------

export const TitlePanel: React.FC<PanelProps> = ({ theme, panel }) => {
  const m = useMetrics();
  const enter = useEnter(0, theme);
  const under = useEnter(6, theme);
  const title = panel.title || '';

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: autoFontSize(title, m.headlineMax * 1.1, m.headlineMin),
          fontWeight: theme.displayWeight,
          textTransform: theme.displayTransform,
          letterSpacing: theme.displayTracking,
          color: theme.text,
          lineHeight: 1.06,
          opacity: enter,
          transform: 'translateY(' + (1 - enter) * 34 + 'px)',
          textShadow: theme.glow !== 'none' ? theme.glow : undefined,
        }}
      >
        {title}
      </div>

      {/* A rule that draws itself outwards from the centre. */}
      <div
        style={{
          margin: '30px auto 0',
          height: 5,
          width: 240 * under,
          borderRadius: 999,
          background: theme.accent,
        }}
      />

      {panel.subtitle ? (
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.fontBody,
            fontSize: Math.round(m.headlineMin * 0.62),
            color: theme.textDim,
            opacity: under,
            lineHeight: 1.35,
          }}
        >
          {panel.subtitle}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Metaphor - the heart of conceptual explaining
// ---------------------------------------------------------------------------

/**
 * The thing you already understand on the left, the thing being explained on
 * the right, and a link between them.
 *
 * The bridge is drawn as ≈ rather than a divider, because this is an analogy
 * and not a comparison - and the right-hand side arrives second, after the
 * narration has established the familiar side.
 */
export const MetaphorPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const labels = [panel.leftLabel || '', panel.rightLabel || ''];
  const r = useReveal(labels.filter(Boolean), words, offset);
  const bridge = useEnter(10, theme);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: m.landscape ? 'row' : 'column',
        alignItems: 'stretch',
        gap: m.landscape ? 26 : 16,
      }}
    >
      <MetaphorSide
        theme={theme}
        landscape={m.landscape}
        label={panel.leftLabel || ''}
        symbol={panel.leftSymbol}
        points={panel.leftPoints}
        tone={theme.text}
        entry={itemEntry(r, 0)}
        lit={r.count > 0}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          fontFamily: theme.fontDisplay,
          fontSize: m.landscape ? 68 : 52,
          fontWeight: 900,
          color: theme.accent,
          opacity: bridge,
          transform: 'scale(' + (0.6 + 0.4 * bridge) + ')',
        }}
      >
        ≈
      </div>

      <MetaphorSide
        theme={theme}
        landscape={m.landscape}
        label={panel.rightLabel || ''}
        symbol={panel.rightSymbol}
        points={panel.rightPoints}
        tone={theme.accent}
        entry={itemEntry(r, 1)}
        lit={r.count > 1}
      />
    </div>
  );
};

const MetaphorSide: React.FC<{
  theme: Theme;
  landscape: boolean;
  label: string;
  symbol?: string;
  points?: string[];
  tone: string;
  entry: number;
  lit: boolean;
}> = ({ theme, landscape, label, symbol, points, tone, entry, lit }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      background: theme.surface,
      border: theme.borderWidth + 'px solid ' + (lit ? tone : theme.border),
      borderRadius: theme.radius,
      padding: landscape ? '44px 38px' : '30px 26px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      opacity: 0.3 + 0.7 * entry,
      transform: 'translateY(' + (1 - entry) * 24 + 'px)',
      boxShadow: lit ? '0 0 46px ' + hexToRgba(tone, 0.26) : theme.shadow,
    }}
  >
    {symbol ? <div style={{ fontSize: landscape ? 104 : 84, lineHeight: 1 }}>{symbol}</div> : null}
    <div
      style={{
        fontFamily: theme.fontDisplay,
        fontSize: autoFontSize(label, landscape ? 54 : 46, 30),
        fontWeight: 800,
        color: tone,
        textAlign: 'center',
        lineHeight: 1.15,
      }}
    >
      {label}
    </div>
    {(points || []).slice(0, 3).map((pt, i) => (
      <div
        key={i}
        style={{
          fontFamily: theme.fontBody,
          fontSize: landscape ? 29 : 25,
          color: theme.textDim,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {pt}
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Labelled diagram - boxes and arrows. The workhorse.
// ---------------------------------------------------------------------------

/**
 * Lays the nodes out on a grid and draws the edges between them as arrows.
 *
 * Positions come from the storyboard when it supplies them and from a sensible
 * flow otherwise: up to three across, wrapping down. Arrows are drawn first so
 * a line never cuts across a label, and each is trimmed to the border of the
 * boxes it joins so the arrowhead touches the box instead of burying itself
 * under the text.
 */
export const DiagramPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const nodes = (panel.nodes || []).slice(0, 8);
  const r = useReveal(nodes.map((n) => n.label), words, offset);

  if (!nodes.length) return null;

  const perRow = nodes.length <= 2 ? nodes.length : nodes.length <= 4 ? 2 : 3;
  const placed = nodes.map((n, i) => ({
    ...n,
    col: Number.isFinite(n.col as number) ? (n.col as number) : i % perRow,
    row: Number.isFinite(n.row as number) ? (n.row as number) : Math.floor(i / perRow),
  }));

  const cols = Math.max(...placed.map((n) => n.col)) + 1;
  const rows = Math.max(...placed.map((n) => n.row)) + 1;

  // A normalised coordinate space; the SVG stretches to fill whatever box the
  // scene gives it. The whole diagram gets a fixed aspect rather than one
  // derived from the row count, so a single-row chain fills the frame instead
  // of sitting in a thin band with dead space above and below it.
  const VW = 1000;
  const VH = m.landscape ? 520 : 760;
  const cellW = VW / cols;
  const cellH = VH / rows;

  const centre = (n: { col: number; row: number }) => ({
    x: n.col * cellW + cellW / 2,
    y: n.row * cellH + cellH / 2,
  });

  const byId = new Map(placed.map((n) => [n.id, n]));
  const indexById = new Map(placed.map((n, i) => [n.id, i]));

  const boxW = Math.min(cellW * 0.82, 330);
  const boxH = Math.min(cellH * 0.6, 200);

  const arrowGrow = interpolate(r.frame, [0, r.fps * 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // An arrow only means anything once both of the boxes it joins are on screen.
  const visibleEdges = (panel.edges || [])
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return null;
      if ((indexById.get(edge.from) ?? 99) >= r.count) return null;
      if ((indexById.get(edge.to) ?? 99) >= r.count) return null;
      return { edge, a: centre(from), b: centre(to) };
    })
    .filter(Boolean) as { edge: PanelEdge; a: Point; b: Point }[];

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={'0 0 ' + VW + ' ' + VH}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        <defs>
          <marker id="pnl-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 z" fill={theme.accent} />
          </marker>
        </defs>

        {visibleEdges.map(({ edge, a, b }, i) => (
          <Edge key={i} edge={edge} theme={theme} a={a} b={b} boxW={boxW} boxH={boxH} grow={arrowGrow} />
        ))}

        {placed.map((n, i) => (
          <NodeBox
            key={n.id + '-' + i}
            node={n}
            theme={theme}
            pos={centre(n)}
            boxW={boxW}
            boxH={boxH}
            entry={itemEntry(r, i)}
            isActive={i === r.count - 1}
          />
        ))}

        {/* Edge labels go last, on a chip, because a word on an arrow that runs
            close to a box would otherwise be drawn underneath it. */}
        {visibleEdges.map(({ edge, a, b }, i) =>
          edge.label && arrowGrow > 0.98 ? (
            <EdgeLabel
              key={'l' + i}
              text={edge.label}
              theme={theme}
              a={a}
              b={b}
              boxW={boxW}
              boxH={boxH}
            />
          ) : null,
        )}
      </svg>
    </div>
  );
};

/**
 * The width of a string at a given font size, near enough.
 *
 * SVG has no layout engine to ask, so a box has to be sized from an estimate.
 * 0.56em a character is close for the body faces in use and errs wide, which is
 * the right direction to err: a label that comes out slightly small still
 * reads, and one that comes out too wide runs straight out of its box.
 */
const textWidth = (text: string, size: number) => text.length * size * 0.56;

/** The largest size at which this label fits its box, wrapped if it must be. */
function fitLabel(label: string, boxW: number, boxH: number, hasSymbol: boolean) {
  const inner = boxW * 0.88;
  const maxLines = hasSymbol ? 2 : 3;
  const roomH = boxH * (hasSymbol ? 0.44 : 0.82);

  for (let size = 38; size >= 15; size -= 1) {
    const perLine = Math.max(4, Math.floor(inner / (size * 0.56)));
    const lines = wrapLabel(label, perLine);
    if (lines.length > maxLines) continue;
    if (lines.length * size * 1.18 > roomH) continue;
    if (Math.max(...lines.map((l) => textWidth(l, size))) > inner) continue;
    return { lines, size };
  }
  return { lines: wrapLabel(label, 14).slice(0, maxLines), size: 15 };
}

const NodeBox: React.FC<{
  node: PanelNode;
  theme: Theme;
  pos: Point;
  boxW: number;
  boxH: number;
  entry: number;
  isActive: boolean;
}> = ({ node, theme, pos, boxW, boxH, entry, isActive }) => {
  const highlight = node.accent || isActive;
  const { lines, size } = fitLabel(node.label || '', boxW, boxH, !!node.symbol);

  // Symbol and label are one block, centred together. Laying the text out from
  // the middle of the box instead pushed a two-line label out through the base.
  const symH = node.symbol ? boxH * 0.3 : 0;
  const gap = node.symbol ? boxH * 0.05 : 0;
  const textH = lines.length * size * 1.18;
  const top = -(symH + gap + textH) / 2;

  return (
    <g opacity={clamp01(0.12 + 0.88 * entry)} transform={'translate(' + pos.x + ',' + pos.y + ')'}>
      <rect
        x={-boxW / 2}
        y={-boxH / 2}
        width={boxW}
        height={boxH}
        rx={theme.layout === 'nerdy' ? 4 : 18}
        fill={theme.surface}
        stroke={highlight ? theme.accent : theme.border}
        strokeWidth={theme.borderWidth + (highlight ? 1.5 : 0)}
      />
      {node.symbol ? (
        <text x={0} y={top + symH * 0.86} textAnchor="middle" fontSize={symH}>
          {node.symbol}
        </text>
      ) : null}
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={top + symH + gap + i * size * 1.18 + size * 0.82}
          textAnchor="middle"
          fontSize={size}
          fontFamily={theme.fontBody}
          fontWeight={700}
          fill={highlight ? theme.accent : theme.text}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

const Edge: React.FC<{
  edge: PanelEdge;
  theme: Theme;
  a: Point;
  b: Point;
  boxW: number;
  boxH: number;
  grow: number;
}> = ({ edge, theme, a, b, boxW, boxH, grow }) => {
  if (grow <= 0.01) return null;
  const [sx, sy] = edgePoint(a, b, boxW, boxH);
  const [ex, ey] = edgePoint(b, a, boxW, boxH);

  return (
    <line
      x1={sx}
      y1={sy}
      x2={sx + (ex - sx) * grow}
      y2={sy + (ey - sy) * grow}
      stroke={theme.accent}
      strokeWidth={4}
      strokeDasharray={edge.dashed ? '10 10' : undefined}
      markerEnd={grow > 0.98 ? 'url(#pnl-arrow)' : undefined}
    />
  );
};

/** A word riding on an arrow, on a chip so the line cannot run through it. */
const EdgeLabel: React.FC<{
  text: string;
  theme: Theme;
  a: Point;
  b: Point;
  boxW: number;
  boxH: number;
}> = ({ text, theme, a, b, boxW, boxH }) => {
  const [sx, sy] = edgePoint(a, b, boxW, boxH);
  const [ex, ey] = edgePoint(b, a, boxW, boxH);
  const size = 25;
  const w = textWidth(text, size) + 22;
  const h = size * 1.7;

  // Sit beside the arrow, not on it. Boxes are close together, so a chip
  // centred on a short edge covers the whole line including the arrowhead, and
  // the reader loses which way the thing flows.
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const off = h / 2 + 10;
  const x = (sx + ex) / 2 + (-dy / len) * off;
  const y = (sy + ey) / 2 + (dx / len) * off;

  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={theme.bg}
        stroke={theme.border}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + size * 0.34}
        textAnchor="middle"
        fontSize={size}
        fontFamily={theme.fontBody}
        fill={theme.textDim}
      >
        {text}
      </text>
    </g>
  );
};

/** Where the line from `a` towards `b` crosses a's box border. */
function edgePoint(a: Point, b: Point, w: number, h: number): [number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a.x, a.y];
  const hw = w / 2 + 10;
  const hh = h / 2 + 10;
  // Grow the direction vector until it meets whichever side it reaches first.
  const t = Math.min(
    dx === 0 ? Infinity : Math.abs(hw / dx),
    dy === 0 ? Infinity : Math.abs(hh / dy),
  );
  return [a.x + dx * t, a.y + dy * t];
}

function wrapLabel(text: string, per: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > per) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + ' ' + w : w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Process - steps in sequence with a travelling highlight
// ---------------------------------------------------------------------------

export const ProcessPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const steps = (panel.steps || []).slice(0, 6);
  const r = useReveal(steps.map((s) => s.label), words, offset);
  const active = r.count - 1;
  // Across the frame only when there is room; four boxes in a row on a phone
  // leaves each of them too narrow to read.
  const row = m.landscape && steps.length <= 4;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        alignItems: 'stretch',
        gap: row ? 0 : 14,
      }}
    >
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <StepBlock
            theme={theme}
            step={step}
            index={i}
            entry={itemEntry(r, i)}
            isActive={i === active}
            row={row}
            landscape={m.landscape}
          />
          {i < steps.length - 1 ? (
            <div
              style={{
                flex: row ? '0 0 40px' : '0 0 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: i < active ? theme.accent : theme.border,
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {row ? '→' : '↓'}
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
};

const StepBlock: React.FC<{
  theme: Theme;
  step: PanelStep;
  index: number;
  entry: number;
  isActive: boolean;
  row: boolean;
  landscape: boolean;
}> = ({ theme, step, index, entry, isActive, row, landscape }) => (
  <div
    style={{
      flex: row ? 1 : '0 0 auto',
      minWidth: 0,
      display: 'flex',
      flexDirection: row ? 'column' : 'row',
      alignItems: 'center',
      gap: row ? 12 : 20,
      padding: row ? '30px 20px' : '20px 24px',
      textAlign: row ? 'center' : 'left',
      background: isActive ? theme.accentSoft : theme.surface,
      border: theme.borderWidth + 'px solid ' + (isActive ? theme.accent : theme.border),
      borderRadius: theme.radius,
      boxShadow: isActive ? '0 0 44px ' + hexToRgba(theme.accent, 0.32) : theme.shadow,
      opacity: 0.25 + 0.75 * entry,
      transform: 'translateY(' + (1 - entry) * 18 + 'px) scale(' + (isActive ? 1.02 : 1) + ')',
    }}
  >
    <div
      style={{
        flex: '0 0 auto',
        width: 56,
        height: 56,
        borderRadius: theme.layout === 'nerdy' ? 4 : 999,
        background: isActive ? theme.accent : theme.accentSoft,
        color: isActive ? theme.bg : theme.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.fontDisplay,
        fontSize: 28,
        fontWeight: 800,
      }}
    >
      {step.symbol || index + 1}
    </div>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: autoFontSize(step.label, landscape ? 37 : 34, 23),
          fontWeight: 700,
          color: theme.text,
          lineHeight: 1.2,
        }}
      >
        {step.label}
      </div>
      {step.detail ? (
        <div
          style={{
            marginTop: 6,
            fontFamily: theme.fontBody,
            fontSize: landscape ? 25 : 23,
            color: theme.textDim,
            lineHeight: 1.3,
          }}
        >
          {step.detail}
        </div>
      ) : null}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Versus - A held against B, revealed point by point
// ---------------------------------------------------------------------------

export const VersusPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const left = (panel.leftPoints || []).slice(0, 4);
  const right = (panel.rightPoints || []).slice(0, 4);

  // The narration works across the table, not down one column: "AC does this,
  // DC does that". Matching in that order is what keeps the highlight honest.
  const order: string[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) order.push(left[i]);
    if (right[i]) order.push(right[i]);
  }
  const r = useReveal(order, words, offset);
  const shown = new Set(order.slice(0, r.count));

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: m.landscape ? 'row' : 'column',
        gap: m.landscape ? 24 : 14,
        alignItems: 'stretch',
      }}
    >
      <VersusColumn
        theme={theme}
        landscape={m.landscape}
        label={panel.leftLabel || 'A'}
        symbol={panel.leftSymbol}
        points={left}
        tone={theme.text}
        shown={shown}
      />
      <VersusColumn
        theme={theme}
        landscape={m.landscape}
        label={panel.rightLabel || 'B'}
        symbol={panel.rightSymbol}
        points={right}
        tone={theme.accent}
        shown={shown}
      />
    </div>
  );
};

const VersusColumn: React.FC<{
  theme: Theme;
  landscape: boolean;
  label: string;
  symbol?: string;
  points: string[];
  tone: string;
  shown: Set<string>;
}> = ({ theme, landscape, label, symbol, points, tone, shown }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      background: theme.surface,
      border: theme.borderWidth + 'px solid ' + tone,
      borderRadius: theme.radius,
      padding: landscape ? '32px 30px' : '24px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
        fontFamily: theme.fontDisplay,
        fontSize: autoFontSize(label, landscape ? 48 : 42, 28),
        fontWeight: 800,
        color: tone,
      }}
    >
      {symbol ? <span style={{ fontSize: '1.1em' }}>{symbol}</span> : null}
      {label}
    </div>
    {points.map((pt, i) => {
      const lit = shown.has(pt);
      return (
        <div
          key={i}
          style={{
            fontFamily: theme.fontBody,
            fontSize: landscape ? 29 : 25,
            color: theme.text,
            lineHeight: 1.3,
            opacity: lit ? 1 : 0.16,
            paddingLeft: 12,
            paddingTop: 3,
            paddingBottom: 3,
            borderLeft: '3px solid ' + (lit ? tone : 'transparent'),
            textAlign: 'left',
          }}
        >
          {pt}
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const TimelinePanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const steps = (panel.steps || []).slice(0, 5);
  const r = useReveal(steps.map((s) => s.label), words, offset);

  // A vertical spine in a 16:9 frame is a narrow column with half the screen
  // empty beside it. Time reads left to right there instead.
  if (m.landscape) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start' }}>
        {steps.map((step, i) => {
          const entry = itemEntry(r, i);
          const isActive = i === r.count - 1;
          const reached = i < r.count;
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              {step.when ? (
                <div
                  style={{
                    fontFamily: theme.fontDisplay,
                    fontSize: 38,
                    fontWeight: 800,
                    color: reached ? theme.accent : theme.textDim,
                    opacity: 0.3 + 0.7 * entry,
                    marginBottom: 14,
                  }}
                >
                  {step.when}
                </div>
              ) : null}

              {/* The spine runs through the dots, so it is drawn as a rule
                  behind each one rather than as a separate line. */}
              <div style={{ position: 'relative', height: 30 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 13,
                    left: i === 0 ? '50%' : 0,
                    right: i === steps.length - 1 ? '50%' : 0,
                    height: 4,
                    background: i < r.count - 1 ? theme.accent : theme.border,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: isActive ? 2 : 6,
                    left: '50%',
                    width: isActive ? 26 : 18,
                    height: isActive ? 26 : 18,
                    marginLeft: isActive ? -13 : -9,
                    borderRadius: 999,
                    background: reached ? theme.accent : theme.border,
                    boxShadow: isActive ? '0 0 28px ' + hexToRgba(theme.accent, 0.6) : undefined,
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: '0 14px',
                  opacity: 0.22 + 0.78 * entry,
                  transform: 'translateY(' + (1 - entry) * 16 + 'px)',
                }}
              >
                <div
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: autoFontSize(step.label, 36, 22),
                    fontWeight: 700,
                    color: theme.text,
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </div>
                {step.detail ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: theme.fontBody,
                      fontSize: 24,
                      color: theme.textDim,
                      lineHeight: 1.3,
                    }}
                  >
                    {step.detail}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {steps.map((step, i) => {
        const entry = itemEntry(r, i);
        const isActive = i === r.count - 1;
        const reached = i < r.count;
        return (
          <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
            {/* The spine, with a dot on every entry. */}
            <div
              style={{
                flex: '0 0 auto',
                width: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: isActive ? 26 : 18,
                  height: isActive ? 26 : 18,
                  borderRadius: 999,
                  background: reached ? theme.accent : theme.border,
                  marginTop: 12,
                  flex: '0 0 auto',
                  boxShadow: isActive ? '0 0 28px ' + hexToRgba(theme.accent, 0.6) : undefined,
                }}
              />
              {i < steps.length - 1 ? (
                <div
                  style={{
                    width: 4,
                    flex: 1,
                    minHeight: 24,
                    background: i < r.count - 1 ? theme.accent : theme.border,
                  }}
                />
              ) : null}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                paddingBottom: 20,
                opacity: 0.22 + 0.78 * entry,
                transform: 'translateX(' + (1 - entry) * 20 + 'px)',
                textAlign: 'left',
              }}
            >
              {step.when ? (
                <div
                  style={{
                    fontFamily: theme.fontDisplay,
                    fontSize: m.landscape ? 33 : 29,
                    fontWeight: 800,
                    color: theme.accent,
                  }}
                >
                  {step.when}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: autoFontSize(step.label, m.landscape ? 37 : 33, 23),
                  fontWeight: 700,
                  color: theme.text,
                  lineHeight: 1.2,
                }}
              >
                {step.label}
              </div>
              {step.detail ? (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: theme.fontBody,
                    fontSize: m.landscape ? 25 : 23,
                    color: theme.textDim,
                    lineHeight: 1.3,
                  }}
                >
                  {step.detail}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Icon grid
// ---------------------------------------------------------------------------

export const GridPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const steps = (panel.steps || []).slice(0, 6);
  const r = useReveal(steps.map((s) => s.label), words, offset);
  // Balanced rows. Four items across three columns leaves one orphan on a row
  // of its own, which reads as a mistake rather than a layout.
  const n = Math.max(steps.length, 1);
  const cols = m.landscape ? (n <= 4 ? n : Math.ceil(n / 2)) : n <= 4 ? 2 : 3;

  return (
    <div
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))',
        gap: m.landscape ? 24 : 16,
      }}
    >
      {steps.map((step, i) => {
        const entry = itemEntry(r, i);
        const isActive = i === r.count - 1;
        return (
          <div
            key={i}
            style={{
              background: isActive ? theme.accentSoft : theme.surface,
              border: theme.borderWidth + 'px solid ' + (isActive ? theme.accent : theme.border),
              borderRadius: theme.radius,
              padding: m.landscape ? '32px 20px' : '24px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              opacity: 0.2 + 0.8 * entry,
              transform: 'scale(' + (0.9 + 0.1 * entry) + ')',
              boxShadow: isActive ? '0 0 40px ' + hexToRgba(theme.accent, 0.28) : theme.shadow,
            }}
          >
            {step.symbol ? (
              <div style={{ fontSize: m.landscape ? 70 : 56, lineHeight: 1 }}>{step.symbol}</div>
            ) : null}
            <div
              style={{
                fontFamily: theme.fontBody,
                fontSize: autoFontSize(step.label, m.landscape ? 33 : 29, 20),
                fontWeight: 700,
                color: theme.text,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {step.label}
            </div>
            {step.detail ? (
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: m.landscape ? 23 : 20,
                  color: theme.textDim,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {step.detail}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Recap
// ---------------------------------------------------------------------------

export const RecapPanel: React.FC<PanelProps> = ({ theme, panel, words, offset }) => {
  const m = useMetrics();
  const steps = (panel.steps || []).slice(0, 5);
  const r = useReveal(steps.map((s) => s.label), words, offset);
  const head = useEnter(0, theme);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {panel.title ? (
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: Math.round(m.headlineMax * 0.6),
            fontWeight: theme.displayWeight,
            textTransform: theme.displayTransform,
            letterSpacing: theme.displayTracking,
            color: theme.accent,
            opacity: head,
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {panel.title}
        </div>
      ) : null}

      {steps.map((step, i) => {
        const entry = itemEntry(r, i);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: m.landscape ? '22px 30px' : '16px 20px',
              background: theme.surface,
              border: theme.borderWidth + 'px solid ' + (i < r.count ? theme.accent : theme.border),
              borderRadius: theme.radius,
              opacity: 0.2 + 0.8 * entry,
              transform: 'translateX(' + (1 - entry) * -22 + 'px)',
              textAlign: 'left',
            }}
          >
            <div style={{ flex: '0 0 auto', fontSize: 36, color: theme.accent, lineHeight: 1 }}>
              {step.symbol || '✓'}
            </div>
            <div
              style={{
                fontFamily: theme.fontBody,
                fontSize: autoFontSize(step.label, m.landscape ? 39 : 33, 23),
                fontWeight: 600,
                color: theme.text,
                lineHeight: 1.25,
              }}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------

export const PANEL_COMPONENTS = {
  title: TitlePanel,
  metaphor: MetaphorPanel,
  diagram: DiagramPanel,
  process: ProcessPanel,
  versus: VersusPanel,
  timeline: TimelinePanel,
  grid: GridPanel,
  motion: MotionPanel,
  recap: RecapPanel,
} as const;

export type PanelName = keyof typeof PANEL_COMPONENTS;
