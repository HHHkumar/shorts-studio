import React from 'react';
import { barsAskText, layoutBars, type Bars } from '../../lib/figures/bars.ts';
import { Footer, useStagger, type ArtProps } from './shared';

/**
 * Bar models: rows of bars on one scale, split into segments - a ratio's
 * parts as equal blocks, what a replacement has drawn off as an outline - and
 * the working, a line per step, underneath. Bars grow in from the left one
 * row after another, as a pure function of the frame.
 */
export const BarsArt: React.FC<ArtProps & { figure: Bars }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = barsAskText(figure, reveal);
  const body = h - font * 2.1;
  const L = layoutBars(figure, reveal, w, body, font);
  const radius = Math.min(10, L.rows[0] ? L.rows[0].height / 4 : 10);

  return (
    <g>
      {L.rows.map((row, i) => {
        const grow = at(i);
        const start = row.segments[0]?.x ?? 0;
        const clipId = 'bars-grow-' + i;
        const full = row.segments.reduce((t, sg) => t + sg.width, 0);
        return (
          <g key={i}>
            <defs>
              <clipPath id={clipId}>
                <rect x={start - 4} y={row.y - 4} width={full * grow + 8} height={row.height + 8} />
              </clipPath>
            </defs>
            <text x={row.label.x} y={row.label.y} textAnchor={row.label.anchor} fontFamily={theme.fontBody} fontWeight={700}
              fontSize={L.labelFont} fill={theme.textDim} opacity={Math.min(1, grow * 2)}>{row.label.text}</text>
            <g clipPath={'url(#' + clipId + ')'}>
              {row.segments.map((sg, k) => (
                sg.width > 0.5 ? (
                  <g key={k}>
                    <rect x={sg.x + 2} y={row.y} width={Math.max(0, sg.width - 4)} height={row.height} rx={radius}
                      fill={sg.ghost ? 'none' : sg.accent ? theme.accent : theme.textDim}
                      fillOpacity={sg.ghost ? 0 : sg.accent ? 0.9 : 0.32}
                      stroke={sg.ghost ? (sg.accent ? theme.accent : theme.textDim) : 'none'} strokeWidth={3} strokeDasharray={sg.ghost ? '10 8' : undefined} />
                    {/* Block edges as notches at top and bottom, so they never cross the text in the middle. */}
                    {sg.blocks && sg.blocks > 1
                      ? Array.from({ length: sg.blocks - 1 }, (_, j) => {
                        const x = sg.x + ((j + 1) * sg.width) / sg.blocks!;
                        const notch = row.height * 0.24;
                        return (
                          <g key={j} stroke={theme.bg} strokeWidth={4}>
                            <line x1={x} y1={row.y} x2={x} y2={row.y + notch} />
                            <line x1={x} y1={row.y + row.height - notch} x2={x} y2={row.y + row.height} />
                          </g>
                        );
                      })
                      : null}
                  </g>
                ) : null
              ))}
            </g>
            {row.segments.map((sg, k) => (
              sg.label ? (
                <text key={'t' + k} x={sg.label.x} y={sg.label.y} textAnchor={sg.label.anchor} fontFamily={theme.fontBody} fontWeight={800}
                  fontSize={L.labelFont}
                  fill={sg.label.anchor === 'middle' ? (sg.accent ? theme.bg : theme.text) : sg.accent ? theme.accent : theme.text}
                  opacity={Math.max(0, grow * 2 - 1)}>{sg.label.text}</text>
              ) : null
            ))}
          </g>
        );
      })}
      {L.lines.map((line, k) => (
        <text key={'l' + k} x={line.x} y={line.y} textAnchor={line.anchor} fontFamily={theme.fontBody} fontWeight={700}
          fontSize={L.lineFont} fill={line.text.endsWith('?') ? theme.textDim : theme.text} opacity={at(L.rows.length + 1 + k)}>{line.text}</text>
      ))}
      <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(L.rows.length + 3)} />
    </g>
  );
};
