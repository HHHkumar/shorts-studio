import React from 'react';
import { formatQuantity } from '../../lib/figures/quantity.ts';
import {
  layoutThreePhase, solveThreePhase, threePhaseAskText, threePhaseRows, type ThreePhase,
} from '../../lib/figures/three-phase.ts';
import { ArrowHead, Footer, STROKE, useStagger, type ArtProps } from './shared';

/**
 * The connection itself - a star from its neutral, or a delta through its
 * terminals - with each phase impedance drawn as a box, the supply entering at
 * R, Y and B, and the working underneath.
 */
export const ThreePhaseArt: React.FC<ArtProps & { figure: ThreePhase }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = threePhaseAskText(figure, reveal);
  const body = h - (footerText ? font * 2.1 : 0);
  const rows = threePhaseRows(figure, reveal);
  const L = layoutThreePhase(figure, w, body, font, rows.length);
  const s = solveThreePhase(figure);
  const small = font * 0.8;
  const zText = 'Z = ' + (!reveal && figure.ask === 'impedance' ? '?' : formatQuantity(figure.impedance, 'Ω'));

  return (
    <g>
      {L.impedances.map((z, k) => {
        const dx = z.x2 - z.x1;
        const dy = z.y2 - z.y1;
        const len = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const boxL = len * 0.42;
        const mx = (z.x1 + z.x2) / 2;
        const my = (z.y1 + z.y2) / 2;
        return (
          <g key={k} opacity={at(k)}>
            <line x1={z.x1} y1={z.y1} x2={z.x2} y2={z.y2} stroke={theme.text} strokeWidth={STROKE} />
            <g transform={'translate(' + mx + ' ' + my + ') rotate(' + angle + ')'}>
              <rect x={-boxL / 2} y={-20} width={boxL} height={40} rx={6} fill={theme.bg} stroke={theme.text} strokeWidth={STROKE} />
            </g>
          </g>
        );
      })}
      {/* One impedance carries the Z label, off to the side of its box. */}
      {(() => {
        const z = L.impedances[0];
        const mx = (z.x1 + z.x2) / 2;
        const my = (z.y1 + z.y2) / 2;
        const right = mx >= L.centre.x;
        return (
          <text x={mx + (right ? 42 : -42)} y={my + small * 0.35} textAnchor={right ? 'start' : 'end'}
            fontFamily={theme.fontBody} fontWeight={700} fontSize={small} fill={figure.ask === 'impedance' && !reveal ? theme.accent : theme.text}
            opacity={at(3)}>{zText}</text>
        );
      })()}
      {L.terminals.map((p, k) => {
        const dx = p.terminal.x - p.outer.x;
        const dy = p.terminal.y - p.outer.y;
        const mx = (p.outer.x + p.terminal.x) / 2;
        const my = (p.outer.y + p.terminal.y) / 2;
        const labelX = p.outer.x + (p.outer.x - p.terminal.x) * 0.25;
        const labelY = p.outer.y + (p.outer.y - p.terminal.y) * 0.25 + small * 0.35;
        return (
          <g key={p.name} opacity={at(3 + k)}>
            <line x1={p.outer.x} y1={p.outer.y} x2={p.terminal.x} y2={p.terminal.y} stroke={theme.accent} strokeWidth={STROKE} />
            {/* Line current flows in from the supply. */}
            <ArrowHead x={mx + dx * 0.12} y={my + dy * 0.12} dx={dx} dy={dy} size={20} fill={theme.accent} />
            <circle cx={p.terminal.x} cy={p.terminal.y} r={9} fill={theme.text} />
            <text x={labelX} y={labelY} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={800} fontSize={font}
              fill={theme.accent}>{p.name}</text>
          </g>
        );
      })}
      {figure.connection === 'star' ? (
        <g opacity={at(2)}>
          <circle cx={L.centre.x} cy={L.centre.y} r={10} fill={theme.text} />
          {/* Straight below the neutral, in the gap between the two lower phases. */}
          <text x={L.centre.x} y={L.centre.y + small * 1.9} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700} fontSize={small}
            fill={theme.textDim}>N</text>
        </g>
      ) : null}
      <text x={L.centre.x} y={L.centre.y + (figure.connection === 'delta' ? L.radius * 0.18 : -L.radius * 0.45)} textAnchor="middle"
        fontFamily={theme.fontBody} fontWeight={700} fontSize={small} fill={theme.textDim} opacity={at(4)}>
        {figure.connection === 'star' ? '' : 'Δ'}
      </text>
      {rows.map((row, k) => (
        <text key={k} x={w / 2} y={L.rowsTop + k * font * 1.35} textAnchor="middle" fontFamily={theme.fontBody}
          fontWeight={k === 1 ? 800 : 700} fontSize={k === 1 ? font : font * 0.85}
          fill={k === 1 ? theme.accent : theme.text} opacity={at(6 + k)}>{row}</text>
      ))}
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(11)} /> : null}
      {s ? null : null}
    </g>
  );
};
