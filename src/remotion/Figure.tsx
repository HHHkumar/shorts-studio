import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { answerFigure, formatAnswer, formatQuantity, type Figure } from '../lib/figures/index.ts';
import {
  ASK_UNIT, elementText, layoutCircuit, type Circuit, type CircuitElement, type PlacedElement,
} from '../lib/figures/circuit.ts';
import { branchText, layoutJunction, type Junction } from '../lib/figures/junction.ts';
import { useEnter, useMetrics } from './ui';
import { AcArt } from './figures/AcArt';
import { TriangleArt } from './figures/TriangleArt';
import { ThreePhaseArt } from './figures/ThreePhaseArt';
import { TransformerArt } from './figures/TransformerArt';
import { MachineArt } from './figures/MachineArt';

/**
 * The figure of the question itself - the junction, the circuit - drawn from
 * its netlist.
 *
 * Plain SVG rather than p5: a figure is still, apart from its entrance, so
 * there is no canvas to keep in step with the frame, and text stays crisp at
 * any size. Every value shown comes from the figure's own data, and the
 * unknown stays a "?" until the scene is allowed to reveal it.
 */
export const FigureView: React.FC<{
  theme: Theme;
  figure: Figure;
  reveal: boolean;
  highlight?: string;
}> = ({ theme, figure, reveal, highlight }) => {
  const { width } = useVideoConfig();
  const m = useMetrics();
  const enter = useEnter(2, theme);
  const w = Math.round(width - m.padX * 2);
  // Tall enough to use the frame: at 760 a phasor diagram above a waveform left
  // each at half size with a third of the phone screen empty underneath.
  const h = m.landscape ? 620 : 940;
  const font = m.landscape ? 32 : 36;

  return (
    <svg
      width={w}
      height={h}
      viewBox={'0 0 ' + w + ' ' + h}
      style={{ display: 'block', opacity: enter, transform: 'scale(' + (0.94 + 0.06 * enter) + ')' }}
    >
      {figure.type === 'junction' ? <JunctionArt theme={theme} junction={figure} reveal={reveal} w={w} h={h} font={font} />
        : figure.type === 'circuit' ? <CircuitArt theme={theme} circuit={figure} reveal={reveal} highlight={highlight} w={w} h={h} font={font} />
        : figure.type === 'ac' ? <AcArt theme={theme} figure={figure} reveal={reveal} w={w} h={h} font={font} />
        : figure.type === 'power-triangle' ? <TriangleArt theme={theme} figure={figure} reveal={reveal} w={w} h={h} font={font} />
        : figure.type === 'three-phase' ? <ThreePhaseArt theme={theme} figure={figure} reveal={reveal} w={w} h={h} font={font} />
        : figure.type === 'transformer' ? <TransformerArt theme={theme} figure={figure} reveal={reveal} w={w} h={h} font={font} />
        : figure.type === 'machine' ? <MachineArt theme={theme} figure={figure} reveal={reveal} w={w} h={h} font={font} />
        : null}
    </svg>
  );
};

type ArtProps = { theme: Theme; reveal: boolean; w: number; h: number; font: number };

/** Parts arrive one after another, over about a second. A pure function of the frame. */
function useStagger(): (i: number) => number {
  const frame = useCurrentFrame();
  return (i) => Math.max(0, Math.min(1, (frame - 6 - i * 3) / 8));
}

const STROKE = 5;

// --- junction ------------------------------------------------------------------------

const JunctionArt: React.FC<ArtProps & { junction: Junction }> = ({ theme, junction, reveal, w, h, font }) => {
  const at = useStagger();
  const layout = layoutJunction(junction, w, h - font * 2.4);
  const { cx, cy } = layout;
  const unknown = junction.branches.find((b) => b.unknown);
  const answer = answerFigure(junction);

  const side = (dir: 'in' | 'out') => junction.branches
    .filter((b) => b.direction === dir)
    .map((b) => (b.unknown && !reveal ? b.label : formatQuantity(b.value, 'A')))
    .join(' + ');
  const sum = side('in') + '  =  ' + side('out');
  const footerY = Math.min(h - font * 0.6, cy + layout.length + font * 2.6);

  return (
    <g>
      {layout.branches.map((p, i) => {
        const colour = p.branch.unknown ? theme.accent : theme.text;
        const ux = Math.cos(p.angle);
        const uy = Math.sin(p.angle);
        // The arrow sits halfway along and points the way the current flows.
        const mx = cx + ux * layout.length * 0.55;
        const my = cy + uy * layout.length * 0.55;
        const toward = p.branch.direction === 'in' ? -1 : 1;
        const ax = ux * toward;
        const ay = uy * toward;
        const size = 22;
        const tip = { x: mx + ax * size, y: my + ay * size };
        const left = { x: mx - ay * size * 0.8, y: my + ax * size * 0.8 };
        const right = { x: mx + ay * size * 0.8, y: my - ax * size * 0.8 };
        const lx = p.x + ux * 26;
        const ly = p.y + uy * 26 + font * 0.35;
        return (
          <g key={i} opacity={at(i)}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colour} strokeWidth={STROKE} strokeLinecap="round" />
            <polygon points={[tip, left, right].map((q) => q.x + ',' + q.y).join(' ')} fill={colour} />
            <text
              x={lx}
              y={ly}
              textAnchor={p.x < cx - 4 ? 'end' : p.x > cx + 4 ? 'start' : 'middle'}
              fontFamily={theme.fontBody}
              fontWeight={700}
              fontSize={font}
              fill={colour}
            >
              {branchText(p.branch, reveal)}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={13} fill={theme.text} />
      <text
        x={w / 2}
        y={footerY}
        textAnchor="middle"
        fontFamily={theme.fontBody}
        fontWeight={700}
        fontSize={font * 0.9}
        fill={reveal ? theme.accent : theme.textDim}
        opacity={at(junction.branches.length + 1)}
      >
        {reveal && unknown && answer
          ? sum + '   →   ' + unknown.label + ' = ' + formatAnswer(answer)
          : 'In = Out:   ' + sum}
      </text>
    </g>
  );
};

// --- circuit -------------------------------------------------------------------------

const QUANTITY_WORD: Record<string, string> = {
  current: 'Current through', voltage: 'Voltage across', power: 'Power in',
  resistance: 'Resistance of', impedance: 'Impedance of',
};

function askText(c: Circuit, reveal: boolean): string {
  if (!c.ask) return '';
  const { quantity, element, from, to } = c.ask;
  const target = element
    ? (c.elements.find((e) => e.id === element)?.label || element)
    : from + ' and ' + to;
  const lead = element ? QUANTITY_WORD[quantity] : (quantity[0].toUpperCase() + quantity.slice(1) + ' between');
  if (!reveal) return lead + ' ' + target + ' = ?';
  const answer = answerFigure(c);
  return lead + ' ' + target + ' = ' + (answer ? formatAnswer(answer) : '?');
}

const CircuitArt: React.FC<ArtProps & { circuit: Circuit; highlight?: string }> = ({
  theme, circuit, reveal, highlight, w, h, font,
}) => {
  const at = useStagger();
  const footer = circuit.ask ? font * 2.2 : 0;
  const layout = layoutCircuit(circuit, w, h - footer, font);
  const asked = circuit.ask?.element;
  // The question line sits under the drawing, not at the foot of the box: in a
  // tall frame a small circuit otherwise floats far above its own caption.
  const drawnBottom = Math.max(
    ...layout.nodes.map((n) => n.y + 20),
    ...layout.elements.map((e) => (e.label ? e.label.box.y2 : e.my)),
  );
  const footerY = Math.min(h - font * 0.6, drawnBottom + font * 2);
  const terminals = new Set([circuit.ask?.from, circuit.ask?.to].filter(Boolean) as string[]);

  return (
    <g>
      {layout.elements.map((p, i) => {
        const hot = p.element.id === highlight || p.element.id === asked;
        const colour = hot ? theme.accent : theme.text;
        return (
          <g key={p.element.id} opacity={at(i)}>
            <Part p={p} colour={colour} bg={theme.bg} ac={circuit.frequency > 0} />
            <PartLabel p={p} theme={theme} font={font} reveal={reveal} colour={p.element.unknown && !reveal ? theme.accent : colour} />
          </g>
        );
      })}
      {layout.nodes.map((n) => (
        terminals.has(n.id) ? (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={12} fill={theme.bg} stroke={theme.accent} strokeWidth={STROKE} />
            <text x={n.x} y={n.y - 24} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={800}
              fontSize={font} fill={theme.accent}>{n.id}</text>
          </g>
        ) : n.degree >= 3 ? (
          <circle key={n.id} cx={n.x} cy={n.y} r={9} fill={theme.text} />
        ) : null
      ))}
      {circuit.ask ? (
        <text
          x={w / 2}
          y={footerY}
          textAnchor="middle"
          fontFamily={theme.fontBody}
          fontWeight={700}
          fontSize={font * 0.95}
          fill={reveal ? theme.accent : theme.textDim}
          opacity={at(layout.elements.length + 1)}
        >
          {askText(circuit, reveal)}
        </text>
      ) : null}
    </g>
  );
};

/** One part: the wire up to its symbol, the symbol, and the wire on from it. */
const Part: React.FC<{ p: PlacedElement; colour: string; bg: string; ac: boolean }> = ({ p, colour, bg, ac }) => {
  const e = p.element;
  const common = { stroke: colour, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (e.kind === 'wire' || p.length === 0) return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...common} />;

  const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
  const dx = (p.x2 - p.x1) / len;
  const dy = (p.y2 - p.y1) / len;
  const half = p.length / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <g>
      <line x1={p.x1} y1={p.y1} x2={p.mx - dx * half} y2={p.my - dy * half} {...common} />
      <line x1={p.mx + dx * half} y1={p.my + dy * half} x2={p.x2} y2={p.y2} {...common} />
      {/* Drawn along +x from `from` to `to`, then turned into place. */}
      <g transform={'translate(' + p.mx + ' ' + p.my + ') rotate(' + angle + ')'}>
        <Symbol kind={e.kind} half={half} common={common} colour={colour} bg={bg} ac={ac} />
      </g>
    </g>
  );
};

const Symbol: React.FC<{
  kind: CircuitElement['kind']; half: number; colour: string; bg: string; ac: boolean;
  common: React.SVGProps<SVGElement>;
}> = ({ kind, half, colour, bg, ac, common }) => {
  const c = common as any;
  if (kind === 'resistor') {
    const pts: string[] = [-half + ',0'];
    const n = 12;
    for (let i = 1; i < n; i++) pts.push((-half + (i * 2 * half) / n) + ',' + (i % 2 ? -18 : 18));
    pts.push(half + ',0');
    return <polyline points={pts.join(' ')} {...c} />;
  }
  if (kind === 'inductor') {
    const r = half / 4;
    let d = 'M ' + -half + ' 0';
    for (let i = 0; i < 4; i++) d += ' a ' + r + ' ' + r + ' 0 0 1 ' + 2 * r + ' 0';
    return <path d={d} {...c} />;
  }
  if (kind === 'capacitor') {
    return (
      <g>
        <line x1={-half} y1={0} x2={-10} y2={0} {...c} />
        <line x1={10} y1={0} x2={half} y2={0} {...c} />
        <line x1={-10} y1={-32} x2={-10} y2={32} {...c} />
        <line x1={10} y1={-32} x2={10} y2={32} {...c} />
      </g>
    );
  }
  if (kind === 'lamp') {
    const r = Math.min(30, half);
    const k = r * 0.7;
    return (
      <g>
        <line x1={-half} y1={0} x2={-r} y2={0} {...c} />
        <line x1={r} y1={0} x2={half} y2={0} {...c} />
        <circle r={r} fill={bg} stroke={colour} strokeWidth={STROKE} />
        <line x1={-k} y1={-k} x2={k} y2={k} {...c} />
        <line x1={-k} y1={k} x2={k} y2={-k} {...c} />
      </g>
    );
  }
  if (kind === 'voltage' && !ac) {
    // A cell: the long plate is positive, on the `to` side.
    return (
      <g>
        <line x1={-half} y1={0} x2={-9} y2={0} {...c} />
        <line x1={9} y1={0} x2={half} y2={0} {...c} />
        <line x1={-9} y1={-18} x2={-9} y2={18} {...c} strokeWidth={STROKE + 3} />
        <line x1={9} y1={-38} x2={9} y2={38} {...c} />
        <line x1={24} y1={-44} x2={40} y2={-44} {...c} strokeWidth={4} />
        <line x1={32} y1={-52} x2={32} y2={-36} {...c} strokeWidth={4} />
      </g>
    );
  }
  const r = Math.min(34, half);
  return (
    <g>
      <line x1={-half} y1={0} x2={-r} y2={0} {...c} />
      <line x1={r} y1={0} x2={half} y2={0} {...c} />
      <circle r={r} fill={bg} stroke={colour} strokeWidth={STROKE} />
      {kind === 'voltage' ? (
        <path d={'M ' + -r * 0.6 + ' 0 q ' + r * 0.3 + ' ' + -r * 0.7 + ' ' + r * 0.6 + ' 0 t ' + r * 0.6 + ' 0'} {...c} strokeWidth={4} />
      ) : (
        <g>
          <line x1={-r * 0.55} y1={0} x2={r * 0.45} y2={0} {...c} strokeWidth={4} />
          <polygon points={r * 0.6 + ',0 ' + r * 0.2 + ',-10 ' + r * 0.2 + ',10'} fill={colour} />
        </g>
      )}
    </g>
  );
};

/**
 * The name and value beside a part, where the layout reserved room for it.
 * Parts on a column get two short lines - the name, then the value - so a
 * label never runs off the side of the frame.
 */
const PartLabel: React.FC<{ p: PlacedElement; theme: Theme; font: number; reveal: boolean; colour: string }> = ({
  p, theme, font, reveal, colour,
}) => {
  const text = elementText(p.element, reveal);
  const at = p.label;
  if (!text || !at) return null;
  const common = { fontFamily: theme.fontBody, fontWeight: 700, fontSize: font, fill: colour, textAnchor: at.anchor };
  if (!at.twoLines) return <text x={at.x} y={at.y} {...common}>{text}</text>;
  const [name, value] = text.split(' = ');
  return (
    <text x={at.x} y={at.y} {...common}>
      <tspan x={at.x}>{name}</tspan>
      <tspan x={at.x} dy={font * 1.05}>{value}</tspan>
    </text>
  );
};
