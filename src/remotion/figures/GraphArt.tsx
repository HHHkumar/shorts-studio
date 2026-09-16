import React from 'react';
import { graphAskText, layoutGraph, type Graph } from '../../lib/figures/graph.ts';
import { roundForDisplay } from '../../lib/figures/quantity.ts';
import { Footer, STROKE, polyline, useStagger, type ArtProps } from './shared';

/**
 * Axes with nice ticks, each curve drawn from its formula, marked points with
 * their coordinates projected to both axes, and asymptotes dashed. The curves
 * draw on over their first second - a pure function of the frame, like every
 * other entrance.
 */
export const GraphArt: React.FC<ArtProps & { figure: Graph }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = graphAskText(figure, reveal);
  const legendH = figure.curves.length > 1 ? font * 1.3 : 0;
  const body = h - (footerText ? font * 2.1 : 0) - legendH;
  const L = layoutGraph(figure, w, body, font);
  const small = font * 0.62;
  const colours = [theme.accent, theme.text, theme.correct];
  const axisTitle = (a: Graph['x']) => a.label + (a.unit ? ' (' + a.unit + ')' : '');

  return (
    <g>
      {legendH ? (
        <g>
          {figure.curves.map((c, k) => (
            <g key={c.id} opacity={at(k)}>
              <line x1={L.plot.left + k * w * 0.3} y1={font * 0.65} x2={L.plot.left + k * w * 0.3 + 36} y2={font * 0.65}
                stroke={colours[k % 3]} strokeWidth={STROKE} />
              <text x={L.plot.left + k * w * 0.3 + 46} y={font * 0.9} fontFamily={theme.fontBody} fontWeight={700} fontSize={small * 1.2}
                fill={colours[k % 3]}>{c.label}</text>
            </g>
          ))}
        </g>
      ) : null}
      <g transform={'translate(0 ' + legendH + ')'}>
        {/* Gridlines and ticks. */}
        {L.yTicks.map((v) => (
          <g key={'y' + v}>
            <line x1={L.plot.left} y1={L.toY(v)} x2={L.plot.right} y2={L.toY(v)} stroke={theme.textDim} strokeOpacity={v === 0 ? 0.7 : 0.18} strokeWidth={v === 0 ? 2.5 : 1.5} />
            <text x={L.plot.left - 10} y={L.toY(v) + small * 0.35} textAnchor="end" fontFamily={theme.fontBody} fontSize={small} fill={theme.textDim}>
              {roundForDisplay(v)}
            </text>
          </g>
        ))}
        {L.xTicks.map((v) => (
          <g key={'x' + v}>
            <line x1={L.toX(v)} y1={L.plot.top} x2={L.toX(v)} y2={L.plot.bottom} stroke={theme.textDim} strokeOpacity={v === 0 ? 0.7 : 0.12} strokeWidth={v === 0 ? 2.5 : 1.5} />
            <text x={L.toX(v)} y={L.plot.bottom + small * 1.4} textAnchor="middle" fontFamily={theme.fontBody} fontSize={small} fill={theme.textDim}>
              {roundForDisplay(v)}
            </text>
          </g>
        ))}
        <line x1={L.plot.left} y1={L.plot.bottom} x2={L.plot.right} y2={L.plot.bottom} stroke={theme.textDim} strokeWidth={3} />
        <line x1={L.plot.left} y1={L.plot.top} x2={L.plot.left} y2={L.plot.bottom} stroke={theme.textDim} strokeWidth={3} />
        <text x={(L.plot.left + L.plot.right) / 2} y={L.plot.bottom + small * 3} textAnchor="middle" fontFamily={theme.fontBody}
          fontWeight={700} fontSize={small * 1.1} fill={theme.text}>{axisTitle(figure.x)}</text>
        <text x={L.plot.left} y={L.plot.top - small * 0.8} textAnchor="start" fontFamily={theme.fontBody}
          fontWeight={700} fontSize={small * 1.1} fill={theme.text}>{axisTitle(figure.y)}</text>
        {figure.asymptotes.map((a, k) => (
          a.y >= L.yRange[0] && a.y <= L.yRange[1] ? (
            <g key={'a' + k} opacity={at(2)}>
              <line x1={L.plot.left} y1={L.toY(a.y)} x2={L.plot.right} y2={L.toY(a.y)} stroke={theme.textDim} strokeWidth={2.5} strokeDasharray="12 10" />
              <text x={L.plot.right - 6} y={L.toY(a.y) - 10} textAnchor="end" fontFamily={theme.fontBody} fontWeight={700} fontSize={small}
                fill={theme.textDim}>{a.label}</text>
            </g>
          ) : null
        ))}
        {L.paths.map((p, k) => (
          <g key={p.curve.id} opacity={at(1 + k)}>
            {p.runs.map((run, r) => (
              <polyline key={r} points={polyline(run)} fill="none" stroke={colours[k % 3]} strokeWidth={STROKE + 1} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        ))}
        {L.points.map((pt, k) => {
          return (
            <g key={'p' + k} opacity={at(4 + k)}>
              <line x1={pt.px} y1={pt.py} x2={pt.px} y2={L.plot.bottom} stroke={theme.accent} strokeWidth={2} strokeDasharray="6 6" />
              <line x1={L.plot.left} y1={pt.py} x2={pt.px} y2={pt.py} stroke={theme.accent} strokeWidth={2} strokeDasharray="6 6" />
              <circle cx={pt.px} cy={pt.py} r={10} fill={theme.accent} />
              <text x={pt.label.x} y={pt.label.y} textAnchor={pt.label.anchor} fontFamily={theme.fontBody} fontWeight={800}
                fontSize={small * 1.15} fill={theme.accent}>{pt.label.text}</text>
            </g>
          );
        })}
      </g>
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(8)} /> : null}
    </g>
  );
};
