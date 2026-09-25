import React from 'react';
import { layoutTriangle, triangleAskText, type PowerTriangle } from '../../lib/figures/power-triangle.ts';
import { Footer, STROKE, useStagger, type ArtProps } from './shared';

/**
 * P, Q and S as the sides of one right-angled triangle, drawn to scale. With a
 * correction, the new hypotenuse is dashed and the capacitor's share of Q - the
 * part it cancels - is the thick accented top of the vertical side.
 */
export const TriangleArt: React.FC<ArtProps & { figure: PowerTriangle }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = triangleAskText(figure, reveal);
  const body = h - (footerText ? font * 2.1 : 0);
  const L = layoutTriangle(figure, w, body, font, reveal);
  const { origin: o, base: b, apex: a, corrected: c } = L;
  const line = { strokeWidth: STROKE, strokeLinecap: 'round' as const, fill: 'none' };
  const up = a.y < b.y ? -1 : 1;
  const mark = 22;

  // The angle arc from the base round to the hypotenuse.
  const hyp = Math.atan2(a.y - o.y, a.x - o.x);
  const r = L.arcRadius;
  const arc = 'M ' + (o.x + r) + ' ' + o.y + ' A ' + r + ' ' + r + ' 0 0 ' + (up < 0 ? 0 : 1) + ' ' + (o.x + Math.cos(hyp) * r) + ' ' + (o.y + Math.sin(hyp) * r);

  return (
    <g>
      <g opacity={at(0)}>
        <line x1={o.x} y1={o.y} x2={b.x} y2={b.y} stroke={theme.text} {...line} />
      </g>
      <g opacity={at(1)}>
        <line x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke={theme.text} {...line} />
        {/* The right angle between P and Q. */}
        <polyline points={(b.x - mark) + ',' + b.y + ' ' + (b.x - mark) + ',' + (b.y + up * mark) + ' ' + b.x + ',' + (b.y + up * mark)}
          stroke={theme.textDim} strokeWidth={3} fill="none" />
      </g>
      <g opacity={at(2)}>
        <line x1={o.x} y1={o.y} x2={a.x} y2={a.y} stroke={theme.text} {...line} />
        {Math.abs(a.y - b.y) > 1 ? <path d={arc} stroke={theme.textDim} strokeWidth={3} fill="none" /> : null}
      </g>
      {c ? (
        <g opacity={at(4)}>
          <line x1={o.x} y1={o.y} x2={c.x} y2={c.y} stroke={theme.text} strokeWidth={STROKE - 1} strokeDasharray="14 10" fill="none" />
          <line x1={c.x} y1={c.y} x2={a.x} y2={a.y} stroke={theme.accent} strokeWidth={STROKE + 5} strokeLinecap="butt" />
        </g>
      ) : null}
      {L.labels.map((l, i) => (
        <text key={l.key} x={l.x} y={l.y} textAnchor={l.anchor} fontFamily={theme.fontBody} fontWeight={700}
          fontSize={font * 0.9} fill={l.key === 'Qc' ? theme.accent : l.text.endsWith('?') ? theme.accent : theme.text}
          opacity={at(3 + i)}>
          {l.text}
        </text>
      ))}
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(9)} /> : null}
    </g>
  );
};
