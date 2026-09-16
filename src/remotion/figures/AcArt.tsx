import React from 'react';
import {
  acAskText, acPower, averagePowerText, layoutPhasors, layoutWaveform, phaseShown, phasorAngleLabel, relationText, type AcFigure, type AcSignal,
} from '../../lib/figures/ac.ts';
import { formatQuantity } from '../../lib/figures/quantity.ts';
import { ArrowHead, Footer, STROKE, polyline, useStagger, type ArtProps } from './shared';

/**
 * Phasors and waveforms. Voltages are drawn in the text colour, currents in
 * the accent, and a second signal of the same kind is dashed, so the pairing
 * is legible in every theme without relying on a colour legend alone.
 */
export const AcArt: React.FC<ArtProps & { figure: AcFigure }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = figure.ask ? acAskText(figure, reveal) : relationText(figure, reveal);
  const footer = footerText ? font * 2.1 : 0;
  const body = h - footer;

  const colourOf = (s: AcSignal) => (s.kind === 'voltage' ? theme.text : theme.accent);
  const dashOf = (s: AcSignal) => {
    const same = figure.signals.filter((x) => x.kind === s.kind);
    return same.indexOf(s) > 0 ? '14 10' : undefined;
  };

  const phasorH = figure.view === 'both' ? body * 0.5 : figure.view === 'phasor' ? body : 0;
  const waveH = body - phasorH;

  return (
    <g>
      {phasorH > 0 ? (
        <g opacity={at(0)}>
          <Phasors figure={figure} theme={theme} w={w} h={phasorH} font={font} reveal={reveal} colourOf={colourOf} dashOf={dashOf} />
        </g>
      ) : null}
      {waveH > 0 ? (
        <g transform={'translate(0 ' + phasorH + ')'} opacity={at(2)}>
          <Waves figure={figure} theme={theme} w={w} h={waveH} font={font} reveal={reveal} colourOf={colourOf} dashOf={dashOf} />
        </g>
      ) : null}
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(4)} /> : null}
    </g>
  );
};

type Part = {
  figure: AcFigure; theme: ArtProps['theme']; w: number; h: number; font: number; reveal: boolean;
  colourOf: (s: AcSignal) => string; dashOf: (s: AcSignal) => string | undefined;
};

const Phasors: React.FC<Part> = ({ figure, theme, w, h, font, reveal, colourOf, dashOf }) => {
  const cx = w * 0.36;
  const cy = h / 2;
  const radius = Math.min(h * 0.44, w * 0.38);
  const arrows = layoutPhasors(figure, cx, cy, radius);
  const power = acPower(figure);
  const v = arrows.find((a) => a.signal.kind === 'voltage');
  const i = arrows.find((a) => a.signal.kind === 'current');
  const small = font * 0.78;

  // The angle between V and I: an arc from the voltage round to the current,
  // labelled where the text clears both arrows (see phasorAngleLabel).
  let arc: React.ReactNode = null;
  if (power && v && i) {
    const text = 'φ = ' + (phaseShown(figure, reveal) ? formatQuantity(Math.abs(power.phi), '°') : '?');
    const label = phasorAngleLabel(figure, cx, cy, radius, small, text);
    if (label) {
      arc = (
        <g>
          <path
            d={'M ' + label.from.x + ' ' + label.from.y + ' A ' + label.arcRadius + ' ' + label.arcRadius + ' 0 0 ' + label.sweep + ' ' + label.to.x + ' ' + label.to.y}
            fill="none" stroke={theme.textDim} strokeWidth={3}
          />
          <text x={label.x} y={label.y} textAnchor={label.anchor} fontFamily={theme.fontBody} fontWeight={700}
            fontSize={small} fill={theme.textDim}>{text}</text>
        </g>
      );
    }
  }

  return (
    <g>
      <line x1={cx - radius * 0.6} y1={cy} x2={cx} y2={cy} stroke={theme.textDim} strokeWidth={2} strokeDasharray="6 8" />
      {arc}
      {arrows.map((a) => {
        const colour = colourOf(a.signal);
        const dx = a.x - cx;
        const dy = a.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const lx = a.x + (dx / len) * 30;
        const ly = a.y + (dy / len) * 30 + small * 0.35;
        return (
          <g key={a.signal.id}>
            <line x1={cx} y1={cy} x2={a.x - (dx / len) * 16} y2={a.y - (dy / len) * 16} stroke={colour} strokeWidth={STROKE + 1} strokeDasharray={dashOf(a.signal)} />
            <ArrowHead x={a.x} y={a.y} dx={dx} dy={dy} size={24} fill={colour} />
            <text x={lx} y={ly} textAnchor={dx < -1 ? 'end' : dx > 1 ? 'start' : 'middle'} fontFamily={theme.fontBody}
              fontWeight={700} fontSize={small} fill={colour}>
              {a.signal.label + ' ' + formatQuantity(a.signal.rms, a.signal.kind === 'voltage' ? 'V' : 'A')}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={7} fill={theme.text} />
    </g>
  );
};

const Waves: React.FC<Part> = ({ figure, theme, w, h, font, reveal, colourOf, dashOf }) => {
  const legendH = font * 1.3;
  const layout = layoutWaveform(figure, w, h - legendH - font * 0.9);
  const small = font * 0.62;
  const power = acPower(figure);

  return (
    <g>
      {/* The key sits above the plot, never on it: V and I on the left, average power on the right. */}
      <g>
        {figure.signals.map((s, k) => (
          <text key={s.id} x={layout.left + k * (w * 0.3)} y={font} fontFamily={theme.fontBody} fontWeight={700}
            fontSize={small * 1.15} fill={colourOf(s)}>
            {s.label + ': peak ' + formatQuantity(s.rms * Math.SQRT2, s.kind === 'voltage' ? 'V' : 'A')}
          </text>
        ))}
        {layout.averageY !== null && power ? (
          <text x={layout.right} y={font} textAnchor="end" fontFamily={theme.fontBody} fontWeight={700}
            fontSize={small * 1.15} fill={theme.accent}>
            {averagePowerText(figure, reveal)}
          </text>
        ) : null}
      </g>
      <g transform={'translate(0 ' + legendH + ')'}>
        {layout.powerPositive.map((poly, k) => (
          <polygon key={'p' + k} points={polyline(poly)} fill={theme.accent} fillOpacity={0.26} />
        ))}
        {layout.powerNegative.map((poly, k) => (
          <polygon key={'n' + k} points={polyline(poly)} fill={theme.wrong} fillOpacity={0.3} />
        ))}
        <line x1={layout.left} y1={layout.axisY} x2={layout.right} y2={layout.axisY} stroke={theme.textDim} strokeWidth={2} />
        {layout.ticks.map((t) => (
          <g key={t.label}>
            <line x1={t.x} y1={layout.axisY - 8} x2={t.x} y2={layout.axisY + 8} stroke={theme.textDim} strokeWidth={2} />
          </g>
        ))}
        {[layout.ticks[1], layout.ticks[3], layout.ticks[5], layout.ticks[7]].map((t) => (
          <text key={'l' + t.label} x={t.x} y={h - legendH - small * 0.3} textAnchor="middle" fontFamily={theme.fontBody}
            fontSize={small} fill={theme.textDim}>{t.label}</text>
        ))}
        {layout.signals.map((s) => (
          <polyline key={s.signal.id} points={polyline(s.points)} fill="none" stroke={colourOf(s.signal)}
            strokeWidth={STROKE} strokeDasharray={dashOf(s.signal)} strokeLinejoin="round" />
        ))}
        {layout.averageY !== null && power ? (
          <g>
            <line x1={layout.left} y1={layout.averageY} x2={layout.right} y2={layout.averageY} stroke={theme.accent}
              strokeWidth={3} strokeDasharray="10 8" />
          </g>
        ) : null}
      </g>
    </g>
  );
};
