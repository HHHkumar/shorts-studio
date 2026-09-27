import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { ohms, reductionFormula, reductionWorking, type Reduction } from '../lib/figures/reduce';
import { useMetrics } from './ui';
import { MathText } from './MathText';

// ---------------------------------------------------------------------------
// Series or parallel resistances, combining: the parts are drawn, slide
// together, and become the one equivalent - with its formula above and the
// numbers worked below. Paced over the scene's own length.
//
//   parallel - branches stacked between two rails close up into one;
//   series   - parts along one wire close up into one longer part.
//
// Only for circuits reductionFor() recognises; see src/lib/figures/reduce.ts.
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A resistor's zigzag, centred on (cx, cy), `len` long. */
function zigzag(cx: number, cy: number, len: number, amp: number): string {
  const n = 8;
  let d = 'M ' + (cx - len / 2) + ' ' + cy;
  for (let i = 1; i < n; i++) d += ' L ' + (cx - len / 2 + (i * len) / n) + ' ' + (cy + (i % 2 ? -amp : amp));
  return d + ' L ' + (cx + len / 2) + ' ' + cy;
}

export const ReduceView: React.FC<{ theme: Theme; reduction: Reduction }> = ({ theme, reduction }) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const m = useMetrics();
  const t = frame / Math.max(1, durationInFrames);

  const W = Math.min(width - m.padX * 2, 1100);
  const H = m.landscape ? 380 : 520;
  const draw = clamp01(t / 0.2);
  const slide = interpolate(t, [0.3, 0.58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = slide * slide * (3 - 2 * slide);
  const merged = interpolate(t, [0.55, 0.66], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const working = interpolate(t, [0.62, 0.72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const ink = theme.text;
  const accent = theme.accent;
  const stroke = { fill: 'none', strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const font = m.landscape ? 30 : 34;
  const loads = reduction.loads;
  const labelStyle = { fontFamily: theme.fontBody, fontWeight: 700, fontSize: font } as const;

  let parts: React.ReactNode;
  if (reduction.mode === 'parallel') {
    const xL = W * 0.12;
    const xR = W * 0.88;
    const top = H * 0.14;
    const gap = (H * 0.72) / Math.max(1, loads.length - 1);
    const cy = top + (gap * (loads.length - 1)) / 2;
    parts = (
      <>
        {/* The two rails the branches hang between. */}
        <path d={'M ' + xL + ' ' + (top - 20) + ' L ' + xL + ' ' + (top + gap * (loads.length - 1) + 20)} stroke={ink} {...stroke} opacity={draw * (1 - merged)} />
        <path d={'M ' + xR + ' ' + (top - 20) + ' L ' + xR + ' ' + (top + gap * (loads.length - 1) + 20)} stroke={ink} {...stroke} opacity={draw * (1 - merged)} />
        {loads.map((l, i) => {
          const y = top + i * gap + (cy - (top + i * gap)) * eased;
          return (
            <g key={i} opacity={draw * (1 - merged)}>
              <path d={'M ' + xL + ' ' + y + ' L ' + (W / 2 - 110) + ' ' + y + ' ' + zigzag(W / 2, y, 220, 22).slice(1) + ' L ' + xR + ' ' + y}
                stroke={ink} {...stroke} />
              <text x={W / 2} y={y - 36} textAnchor="middle" fill={ink} style={labelStyle} opacity={1 - eased}>
                {'R' + (i + 1) + ' = ' + ohms(l.value) + ' Ω'}
              </text>
            </g>
          );
        })}
        <g opacity={merged}>
          <path d={'M ' + xL + ' ' + cy + ' L ' + (W / 2 - 130) + ' ' + cy + ' ' + zigzag(W / 2, cy, 260, 26).slice(1) + ' L ' + xR + ' ' + cy}
            stroke={accent} {...stroke} strokeWidth={6} />
          <text x={W / 2} y={cy - 44} textAnchor="middle" fill={accent} style={labelStyle}>
            {'Req = ' + ohms(reduction.result) + ' Ω'}
          </text>
        </g>
      </>
    );
  } else {
    const y = H * 0.5;
    const xL = W * 0.06;
    const xR = W * 0.94;
    const each = Math.min(200, ((xR - xL) * 0.8) / loads.length);
    const spread = (xR - xL) / loads.length;
    parts = (
      <>
        <path d={'M ' + xL + ' ' + y + ' L ' + xR + ' ' + y} stroke={ink} {...stroke} opacity={draw * (1 - merged)} />
        {loads.map((l, i) => {
          const home = xL + spread * (i + 0.5);
          // Each part slides to the middle, closing up with the others.
          const x = home + (W / 2 + (i - (loads.length - 1) / 2) * each * 0.55 - home) * eased;
          return (
            <g key={i} opacity={draw * (1 - merged)}>
              <path d={'M ' + (x - each / 2) + ' ' + y + ' L ' + (x + each / 2) + ' ' + y} stroke={theme.bg} strokeWidth={9} />
              <path d={zigzag(x, y, each * 0.9, 20)} stroke={ink} {...stroke} />
              <text x={x} y={y - 42} textAnchor="middle" fill={ink} style={labelStyle} opacity={1 - eased}>
                {'R' + (i + 1) + ' = ' + ohms(l.value) + ' Ω'}
              </text>
            </g>
          );
        })}
        <g opacity={merged}>
          <path d={'M ' + xL + ' ' + y + ' L ' + (W / 2 - 170) + ' ' + y + ' ' + zigzag(W / 2, y, 340, 26).slice(1) + ' L ' + xR + ' ' + y}
            stroke={accent} {...stroke} strokeWidth={6} />
          <text x={W / 2} y={y - 48} textAnchor="middle" fill={accent} style={labelStyle}>
            {'Req = ' + ohms(reduction.result) + ' Ω'}
          </text>
        </g>
      </>
    );
  }

  const size = m.landscape ? 54 : 60;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
      <div style={{ opacity: draw }}>
        <MathText theme={theme} src={reductionFormula(reduction)} size={size} />
      </div>
      <svg width={W} height={H} viewBox={'0 0 ' + W + ' ' + H} style={{ overflow: 'visible' }}>{parts}</svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: working, transform: 'translateY(' + (1 - working) * 20 + 'px)' }}>
        {reductionWorking(reduction).map((line, i, all) => (
          <MathText key={i} theme={theme} src={line} size={size * 0.9} color={i === all.length - 1 ? theme.correct : theme.text} />
        ))}
      </div>
    </div>
  );
};
