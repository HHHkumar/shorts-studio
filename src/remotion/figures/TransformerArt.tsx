import React from 'react';
import { layoutTransformer, transformerAskText, transformerSides, type Transformer } from '../../lib/figures/transformer.ts';
import { ArrowHead, Footer, STROKE, useStagger, type ArtProps } from './shared';

/**
 * A two-limb core: the primary winding on the left limb, the secondary on the
 * right, the flux circulating round the core, and the values on each side.
 */
export const TransformerArt: React.FC<ArtProps & { figure: Transformer }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = transformerAskText(figure, reveal);
  const body = h - (footerText ? font * 2.1 : 0);
  const L = layoutTransformer(figure, w, body, font);
  const sides = transformerSides(figure, reveal);
  const { core, limb } = L;
  const small = font * 0.85;

  // Every loop is the same size on both windings; the side with fewer turns
  // simply has fewer loops, centred on its limb.
  const loopRy = (L.primary.y2 - L.primary.y1) / 16;
  const coil = (x: number, y1: number, y2: number, colour: string, turns: number) => {
    const top = (y1 + y2) / 2 - turns * loopRy;
    return Array.from({ length: turns }, (_, k) => (
      <ellipse key={k} cx={x} cy={top + loopRy + k * 2 * loopRy} rx={limb * 0.8} ry={loopRy} fill="none" stroke={colour} strokeWidth={STROKE - 1} />
    ));
  };
  const coilSpan = (turns: number) => ({ y1: (L.primary.y1 + L.primary.y2) / 2 - turns * loopRy, y2: (L.primary.y1 + L.primary.y2) / 2 + turns * loopRy });
  // Fewer drawn turns on the side with fewer real turns, so a step-down looks like one.
  const primaryTurns = figure.ratio >= 1 ? 8 : Math.max(3, Math.round(8 * figure.ratio));
  const secondaryTurns = figure.ratio >= 1 ? Math.max(3, Math.round(8 / figure.ratio)) : 8;

  const lead = (fromX: number, y: number, toX: number, colour: string) => (
    <g>
      <line x1={fromX} y1={y} x2={toX} y2={y} stroke={colour} strokeWidth={STROKE - 1} />
      <circle cx={toX} cy={y} r={7} fill={theme.bg} stroke={colour} strokeWidth={4} />
    </g>
  );
  const midTop = core.y + limb / 2;

  return (
    <g>
      <g opacity={at(0)}>
        <rect x={core.x + limb / 2} y={core.y + limb / 2} width={core.w - limb} height={core.h - limb} rx={10}
          fill="none" stroke={theme.textDim} strokeOpacity={0.55} strokeWidth={limb} />
        {/* The flux, round the core. */}
        <rect x={core.x + limb / 2} y={core.y + limb / 2} width={core.w - limb} height={core.h - limb} rx={10}
          fill="none" stroke={theme.accent} strokeWidth={2.5} strokeDasharray="10 10" opacity={0.9} />
        <ArrowHead x={core.x + core.w / 2 + 14} y={midTop} dx={1} dy={0} size={18} fill={theme.accent} />
        <text x={core.x + core.w / 2} y={midTop - limb * 0.5 - 10} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700}
          fontSize={small * 0.9} fill={theme.accent}>Φ</text>
      </g>
      <g opacity={at(2)}>
        {coil(L.primary.x, L.primary.y1, L.primary.y2, theme.text, primaryTurns)}
        {lead(L.primary.x - limb * 0.8, coilSpan(primaryTurns).y1, core.x - 26, theme.text)}
        {lead(L.primary.x - limb * 0.8, coilSpan(primaryTurns).y2, core.x - 26, theme.text)}
      </g>
      <g opacity={at(4)}>
        {coil(L.secondary.x, L.secondary.y1, L.secondary.y2, theme.accent, secondaryTurns)}
        {lead(L.secondary.x + limb * 0.8, coilSpan(secondaryTurns).y1, core.x + core.w + 26, theme.accent)}
        {lead(L.secondary.x + limb * 0.8, coilSpan(secondaryTurns).y2, core.x + core.w + 26, theme.accent)}
      </g>
      {sides.left.map((text, k) => (
        <text key={'l' + k} x={L.left[k].x} y={L.left[k].y} textAnchor="end" fontFamily={theme.fontBody} fontWeight={700}
          fontSize={font} fill={text.endsWith('?') ? theme.accent : theme.text} opacity={at(5 + k)}>{text}</text>
      ))}
      {sides.right.map((text, k) => (
        <text key={'r' + k} x={L.right[k].x} y={L.right[k].y} textAnchor="start" fontFamily={theme.fontBody} fontWeight={700}
          fontSize={font} fill={theme.accent} opacity={at(5 + k)}>{text}</text>
      ))}
      {sides.below.map((text, k) => (
        <text key={'b' + k} x={L.below[k].x} y={L.below[k].y} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700}
          fontSize={small} fill={theme.textDim} opacity={at(8 + k)}>{text}</text>
      ))}
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(11)} /> : null}
    </g>
  );
};
