import React from 'react';
import type { Theme } from '../lib/theme';
import type { FormulaGraph as Graph } from '../lib/formula-card';
import { MathText } from './MathText';

// ---------------------------------------------------------------------------
// The small graph on a formula card: what the formula means, drawn.
//
// Drawn on in a stroke as its card arrives (`draw`, 0 to 1), then kept alive
// by `time`: a dot runs along a wave, the phasor turns, the charging curve is
// traced. Everything is a function of those two numbers, so a frame is the
// same however it is reached - and a still (the carousel) passes draw = 1 and
// a fixed time.
//
// One coordinate box for every kind, 240 x 150, scaled to fit the card.
// Theme colours only: the page's ink for axes and curves, the accent for
// what moves and what is marked, the accent's soft tint for fills.
// ---------------------------------------------------------------------------

const W = 240;
const H = 150;
const STROKE = 3;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A curve as an SVG path, sampled from x0 to x1. */
function curve(f: (x: number) => number, x0: number, x1: number, steps = 90): string {
  let d = '';
  for (let k = 0; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps;
    d += (k ? ' L ' : 'M ') + x.toFixed(1) + ' ' + f(x).toFixed(1);
  }
  return d;
}

/** A label in the card notation, set at (x, y) - its top-left, or centred on x with `centre`. */
const Label: React.FC<{ theme: Theme; x: number; y: number; text: string; size?: number; color?: string; centre?: boolean }> = ({
  theme, x, y, text, size = 17, color, centre,
}) => {
  if (!text) return null;
  const w = 90;
  return (
    <foreignObject x={centre ? x - w / 2 : x} y={y} width={w} height={size * 2.2} style={{ overflow: 'visible' }}>
      <div
        // @ts-expect-error - xmlns is needed for HTML inside SVG, and React passes it through.
        xmlns="http://www.w3.org/1999/xhtml"
        style={{ textAlign: centre ? 'center' : 'left', lineHeight: 1 }}
      >
        <MathText theme={theme} src={text} size={size} color={color} />
      </div>
    </foreignObject>
  );
};

/** Axes with arrowheads. `origin` is where they cross. */
const Axes: React.FC<{ theme: Theme; ox: number; oy: number; xLabel: string; yLabel: string; draw: number }> = ({
  theme, ox, oy, xLabel, yLabel, draw,
}) => {
  const ink = theme.textDim;
  const a = clamp01(draw * 3);
  return (
    <g opacity={a}>
      <path d={'M ' + ox + ' 140 L ' + ox + ' 12 M ' + (ox - 5) + ' 20 L ' + ox + ' 11 L ' + (ox + 5) + ' 20'} fill="none"
        stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={'M ' + (ox - 6) + ' ' + oy + ' L 232 ' + oy + ' M 224 ' + (oy - 5) + ' L 233 ' + oy + ' L 224 ' + (oy + 5)} fill="none"
        stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Label theme={theme} x={ox + 6} y={2} text={yLabel} color={theme.text} />
      <Label theme={theme} x={214} y={oy + 6} text={xLabel} color={theme.text} />
    </g>
  );
};

export const FormulaGraph: React.FC<{
  theme: Theme;
  graph: Graph;
  /** 0 to 1: how much of the graph has been drawn on. */
  draw: number;
  /** Seconds, for what keeps moving once it is drawn. */
  time: number;
  width: number;
  height: number;
}> = ({ theme, graph, draw, time, width, height }) => {
  const clip = 'fg-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (graph.kind === 'none') return null;

  const ink = theme.text;
  const accent = theme.accent;
  const soft = theme.accentSoft;
  const line = { fill: 'none', stroke: ink, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  // The sweep that draws a curve on, left to right.
  const reveal = (x0: number, x1: number) => (
    <clipPath id={clip}>
      <rect x={0} y={0} width={x0 + (x1 - x0) * clamp01(draw)} height={H} />
    </clipPath>
  );
  const done = draw >= 1;
  const loop = (rate: number) => (time * rate) % 1;

  let body: React.ReactNode = null;

  if (graph.kind === 'sine' || graph.kind === 'rms' || graph.kind === 'phase-shift') {
    const ox = 22;
    const oy = 78;
    const amp = 50;
    const x1 = 222;
    const period = 160;
    const wave = (shift: number) => (x: number) => oy - amp * Math.sin((2 * Math.PI * (x - ox)) / period - shift);
    const v = wave(0);
    const shift = 0.7;
    const iw = wave(shift);
    // The positive half-cycles, shaded, as on a textbook sheet.
    const lobes = curve(v, ox, x1) + ' L ' + x1 + ' ' + oy + ' L ' + ox + ' ' + oy + ' Z';
    const along = ox + (x1 - ox) * loop(0.28);
    const rmsY = oy - amp * Math.SQRT1_2;

    body = (
      <>
        <defs>
          {reveal(ox, x1)}
          {/* Only the half above the axis is shaded. */}
          <clipPath id={clip + '-up'}><rect x={0} y={0} width={W} height={oy} /></clipPath>
        </defs>
        <Axes theme={theme} ox={ox} oy={oy} xLabel={graph.x || 't'} yLabel={graph.y} draw={draw} />
        <g clipPath={'url(#' + clip + ')'}>
          {graph.kind !== 'phase-shift' ? (
            <g clipPath={'url(#' + clip + '-up)'}><path d={lobes} fill={soft} stroke="none" /></g>
          ) : null}
          <path d={curve(v, ox, x1)} {...line} />
          {graph.kind === 'phase-shift' ? <path d={curve(iw, ox, x1)} {...line} stroke={accent} /> : null}
        </g>
        {graph.kind === 'sine' && done ? (
          <>
            {/* The peak, marked on the axis. */}
            <path d={'M ' + ox + ' ' + (oy - amp) + ' L 62 ' + (oy - amp)} stroke={theme.textDim} strokeWidth={1.8} strokeDasharray="5 5" />
            <Label theme={theme} x={70} y={oy - amp - 22} text={graph.label} />
          </>
        ) : null}
        {graph.kind === 'rms' && done ? (
          <>
            <path d={'M ' + ox + ' ' + rmsY + ' L ' + x1 + ' ' + rmsY} stroke={accent} strokeWidth={2.6} strokeDasharray="7 6" />
            <Label theme={theme} x={x1 - 44} y={rmsY - 24} text={graph.label} color={accent} />
            <path d={'M ' + ox + ' ' + (oy - amp) + ' L 62 ' + (oy - amp)} stroke={theme.textDim} strokeWidth={1.8} strokeDasharray="5 5" />
            {/* Right of the peak, as on the sine: by the axis it sat on the axis name. */}
            <Label theme={theme} x={70} y={oy - amp - 22} text={graph.label2} />
          </>
        ) : null}
        {graph.kind === 'phase-shift' && done ? (
          <>
            <Label theme={theme} x={58} y={oy - amp - 22} text={graph.label} />
            <Label theme={theme} x={96} y={oy - amp - 8} text={graph.label2} color={accent} />
          </>
        ) : null}
        {done ? (
          <>
            <circle cx={along} cy={v(along)} r={5.5} fill={accent} />
            {graph.kind === 'phase-shift' ? <circle cx={along} cy={iw(along)} r={5.5} fill={ink} /> : null}
          </>
        ) : null}
      </>
    );
  } else if (graph.kind === 'phasor') {
    const cx = 118;
    const cy = 78;
    const r = 52;
    // Turning anticlockwise, as phasors do: negative angles in SVG, y down.
    const turn = clamp01(draw) >= 1 ? loop(0.18) * 2 * Math.PI : 0.9 * clamp01(draw);
    const a = -turn;
    const tip = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    const arcR = 20;
    const large = turn > Math.PI ? 1 : 0;
    const arc = 'M ' + (cx + arcR) + ' ' + cy + ' A ' + arcR + ' ' + arcR + ' 0 ' + large + ' 0 '
      + (cx + arcR * Math.cos(a)).toFixed(1) + ' ' + (cy + arcR * Math.sin(a)).toFixed(1);
    const head = (angle: number) => {
      const back = angle + Math.PI;
      const w1 = { x: tip.x + 11 * Math.cos(back + 0.45), y: tip.y + 11 * Math.sin(back + 0.45) };
      const w2 = { x: tip.x + 11 * Math.cos(back - 0.45), y: tip.y + 11 * Math.sin(back - 0.45) };
      return 'M ' + w1.x + ' ' + w1.y + ' L ' + tip.x + ' ' + tip.y + ' L ' + w2.x + ' ' + w2.y;
    };
    // The ω arrow outside the circle, showing the way round.
    const outer = r + 14;
    const o0 = -0.35;
    const o1 = -1.25;
    const omegaArc = 'M ' + (cx + outer * Math.cos(o0)) + ' ' + (cy + outer * Math.sin(o0)) + ' A ' + outer + ' ' + outer
      + ' 0 0 0 ' + (cx + outer * Math.cos(o1)) + ' ' + (cy + outer * Math.sin(o1));
    const oEnd = { x: cx + outer * Math.cos(o1), y: cy + outer * Math.sin(o1) };
    body = (
      <g opacity={clamp01(draw * 2)}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.textDim} strokeWidth={2.2} />
        <path d={'M ' + (cx - r - 8) + ' ' + cy + ' L ' + (cx + r + 8) + ' ' + cy} stroke={theme.textDim} strokeWidth={1.4} opacity={0.6} />
        <path d={arc} fill="none" stroke={accent} strokeWidth={2.2} />
        <path d={'M ' + cx + ' ' + cy + ' L ' + tip.x + ' ' + tip.y + ' ' + head(a)} {...line} stroke={accent} />
        <path d={omegaArc + ' M ' + (oEnd.x - 9) + ' ' + (oEnd.y + 1) + ' L ' + oEnd.x + ' ' + oEnd.y + ' L ' + (oEnd.x + 2) + ' ' + (oEnd.y + 9)}
          fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Label theme={theme} x={cx + outer * 0.62} y={cy - outer - 16} text={graph.label || '\\omega'} />
        <Label theme={theme} x={cx + 24} y={cy - 22} text={graph.label2 || '\\phi'} size={15} color={accent} />
        <circle cx={cx} cy={cy} r={3.5} fill={ink} />
      </g>
    );
  } else if (graph.kind === 'power-triangle') {
    const A = { x: 34, y: 124 };
    const B = { x: 196, y: 124 };
    const C = { x: 196, y: 30 };
    // Each side drawn on in turn: P, then Q, then S.
    const side = (from: typeof A, to: typeof A, k: number, colour: string) => {
      const p = clamp01(draw * 3 - k);
      if (p <= 0) return null;
      return <path d={'M ' + from.x + ' ' + from.y + ' L ' + (from.x + (to.x - from.x) * p) + ' ' + (from.y + (to.y - from.y) * p)} {...line} stroke={colour} />;
    };
    const phi = Math.atan2(C.y - A.y, C.x - A.x);
    const arcR = 32;
    body = (
      <>
        {done ? <path d={'M ' + A.x + ' ' + A.y + ' L ' + B.x + ' ' + B.y + ' L ' + C.x + ' ' + C.y + ' Z'} fill={soft} stroke="none" /> : null}
        {side(A, B, 0, ink)}
        {side(B, C, 1, ink)}
        {side(A, C, 2, accent)}
        {done ? (
          <>
            <path d={'M ' + (B.x - 12) + ' ' + B.y + ' L ' + (B.x - 12) + ' ' + (B.y - 12) + ' L ' + B.x + ' ' + (B.y - 12)} fill="none" stroke={ink} strokeWidth={1.8} />
            <path d={'M ' + (A.x + arcR) + ' ' + A.y + ' A ' + arcR + ' ' + arcR + ' 0 0 0 ' + (A.x + arcR * Math.cos(phi)).toFixed(1) + ' ' + (A.y + arcR * Math.sin(phi)).toFixed(1)}
              fill="none" stroke={accent} strokeWidth={2.2} />
            <Label theme={theme} x={A.x + arcR + 6} y={A.y - 24} text={graph.label || '\\phi'} size={16} color={accent} />
            <Label theme={theme} x={(A.x + B.x) / 2} y={A.y + 2} text="P" centre />
            <Label theme={theme} x={B.x + 8} y={(B.y + C.y) / 2 - 10} text="Q" />
            <Label theme={theme} x={(A.x + C.x) / 2 - 22} y={(A.y + C.y) / 2 - 30} text="S" color={accent} />
          </>
        ) : null}
      </>
    );
  } else {
    // The curves on a pair of positive axes: proportional, inverse, charging, discharging.
    const ox = 26;
    const oy = 132;
    const x1 = 222;
    const span = x1 - ox;
    const f = graph.kind === 'linear'
      ? (x: number) => oy - ((x - ox) / span) * 104
      : graph.kind === 'inverse'
        ? (x: number) => oy - Math.min(112, 16 / (((x - ox) / span) + 0.12))
        : graph.kind === 'exp-rise'
          ? (x: number) => oy - 96 * (1 - Math.exp((-5 * (x - ox)) / span))
          : (x: number) => oy - 104 * Math.exp((-5 * (x - ox)) / span);
    const start = graph.kind === 'inverse' ? ox + 6 : ox;
    const along = start + (x1 - start) * loop(0.25);
    body = (
      <>
        <defs>{reveal(start, x1)}</defs>
        <Axes theme={theme} ox={ox} oy={oy} xLabel={graph.x} yLabel={graph.y} draw={draw} />
        {graph.kind === 'exp-rise' && done ? (
          <>
            <path d={'M ' + ox + ' ' + (oy - 96) + ' L ' + x1 + ' ' + (oy - 96)} stroke={theme.textDim} strokeWidth={1.8} strokeDasharray="6 5" />
            <Label theme={theme} x={x1 - 40} y={oy - 96 - 24} text={graph.label} color={accent} />
          </>
        ) : null}
        <g clipPath={'url(#' + clip + ')'}>
          <path d={curve(f, start, x1)} {...line} />
        </g>
        {graph.kind !== 'exp-rise' && done ? (
          <Label theme={theme} x={graph.kind === 'linear' ? 150 : 130} y={graph.kind === 'linear' ? 44 : 70} text={graph.label} color={accent} />
        ) : null}
        {done ? <circle cx={along} cy={f(along)} r={5.5} fill={accent} /> : null}
      </>
    );
  }

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {body}
    </svg>
  );
};
