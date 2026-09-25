import React from 'react';
import { machineAskText, machineRows, type Machine } from '../../lib/figures/machine.ts';
import { ArrowHead, Footer, STROKE, useStagger, type ArtProps } from './shared';

/**
 * Induction and synchronous machines: the stator with its poles, the field
 * sweeping round it, the rotor inside turning the same way. DC machines: the
 * armature with its resistance, and the shunt field across the supply. The
 * working sits underneath either way.
 */
export const MachineArt: React.FC<ArtProps & { figure: Machine }> = ({ theme, figure, reveal, w, h, font }) => {
  const at = useStagger();
  const footerText = machineAskText(figure, reveal);
  const body = h - (footerText ? font * 2.1 : 0);
  const rows = machineRows(figure, reveal);
  const rowH = font * 1.3;
  const rowsTop = body - rows.length * rowH + font * 0.4;
  const drawH = rowsTop - font * 1.4;
  const small = font * 0.8;

  return (
    <g>
      <g opacity={at(0)}>
        {figure.kind === 'induction' || figure.kind === 'synchronous'
          ? <Rotating figure={figure} theme={theme} w={w} h={drawH} small={small} />
          : <DcCircuit figure={figure} theme={theme} w={w} h={drawH} small={small} />}
      </g>
      {rows.map((row, k) => (
        <text key={k} x={w / 2} y={rowsTop + k * rowH} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700}
          fontSize={font * 0.85} fill={row.endsWith('?') ? theme.accent : theme.text} opacity={at(4 + k)}>{row}</text>
      ))}
      {footerText ? <Footer theme={theme} w={w} h={h} font={font} text={footerText} reveal={reveal} opacity={at(11)} /> : null}
    </g>
  );
};

type Part = { figure: Machine; theme: ArtProps['theme']; w: number; h: number; small: number };

/** An arc from a1 to a2 (radians, clockwise on screen) with an arrowhead at the end. */
function arcArrow(cx: number, cy: number, r: number, a1: number, a2: number, colour: string, width: number) {
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return (
    <g>
      <path d={'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2} fill="none" stroke={colour} strokeWidth={width} />
      <ArrowHead x={x2} y={y2} dx={-Math.sin(a2)} dy={Math.cos(a2)} size={22} fill={colour} />
    </g>
  );
}

const Rotating: React.FC<Part> = ({ figure, theme, w, h, small }) => {
  const R = Math.min(h * 0.44, w * 0.3);
  const cx = w / 2;
  const cy = h / 2 + small * 0.4;
  const inner = R * 0.72;
  const rotorR = R * 0.5;
  const poles = Math.min(figure.poles || 4, 12);
  return (
    <g>
      {/* Stator: a thick ring, with the poles marked round its inside. */}
      <circle cx={cx} cy={cy} r={(R + inner) / 2} fill="none" stroke={theme.textDim} strokeOpacity={0.5} strokeWidth={R - inner} />
      {Array.from({ length: poles }, (_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / poles;
        const r = (R + inner) / 2;
        return (
          <text key={k} x={cx + Math.cos(a) * r} y={cy + Math.sin(a) * r + small * 0.35} textAnchor="middle"
            fontFamily={theme.fontBody} fontWeight={800} fontSize={small * 0.85} fill={k % 2 ? theme.accent : theme.text}>
            {k % 2 ? 'S' : 'N'}
          </text>
        );
      })}
      {/* The rotating field, just inside the stator. */}
      {arcArrow(cx, cy, inner - 16, -Math.PI * 0.85, -Math.PI * 0.15, theme.accent, STROKE)}
      <text x={cx} y={cy - inner + 50} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700} fontSize={small * 0.8}
        fill={theme.accent}>field</text>
      {/* Rotor: a cage of bars round its edge. */}
      <circle cx={cx} cy={cy} r={rotorR} fill={theme.bg} stroke={theme.text} strokeWidth={STROKE} />
      {Array.from({ length: 16 }, (_, k) => {
        const a = (k * 2 * Math.PI) / 16;
        return <circle key={k} cx={cx + Math.cos(a) * rotorR * 0.8} cy={cy + Math.sin(a) * rotorR * 0.8} r={Math.max(3, rotorR * 0.06)} fill={theme.textDim} />;
      })}
      {arcArrow(cx, cy, rotorR * 0.5, Math.PI * 0.15, Math.PI * 0.85, theme.text, STROKE - 1)}
      <text x={cx} y={cy + small * 0.3} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700} fontSize={small * 0.8}
        fill={theme.text}>{figure.kind === 'synchronous' ? 'rotor' : 'rotor'}</text>
    </g>
  );
};

const DcCircuit: React.FC<Part> = ({ figure, theme, w, h, small }) => {
  const motor = figure.kind === 'dc-motor';
  const top = h * 0.2;
  const bottom = h * 0.85;
  const left = w * 0.2;
  const right = w * 0.72;
  const shunt = figure.fieldResistance !== undefined;
  const armX = right;
  const armY = (top + bottom) / 2;
  const armR = Math.min(56, (bottom - top) * 0.2);
  const line = { stroke: theme.text, strokeWidth: STROKE, fill: 'none' };
  const zig = (x1: number, x2: number, y: number) => {
    const pts: string[] = [x1 + ',' + y];
    for (let i = 1; i < 10; i++) pts.push((x1 + ((x2 - x1) * i) / 10) + ',' + (y + (i % 2 ? -14 : 14)));
    pts.push(x2 + ',' + y);
    return <polyline points={pts.join(' ')} {...line} />;
  };
  const raX1 = left + (right - left) * 0.3;
  const raX2 = left + (right - left) * 0.6;
  return (
    <g>
      {/* Supply on the left, positive at the top. */}
      <line x1={left} y1={top} x2={left} y2={armY - 26} {...line} />
      <line x1={left - 30} y1={armY - 16} x2={left + 30} y2={armY - 16} {...line} />
      <line x1={left - 16} y1={armY + 10} x2={left + 16} y2={armY + 10} {...line} strokeWidth={STROKE + 3} />
      <line x1={left} y1={armY + 20} x2={left} y2={bottom} {...line} />
      <text x={left - 44} y={armY + small * 0.3} textAnchor="end" fontFamily={theme.fontBody} fontWeight={700} fontSize={small} fill={theme.text}>
        {motor ? 'V' : 'load'}
      </text>
      {/* Top rail through Ra to the armature; bottom rail back. */}
      <line x1={left} y1={top} x2={raX1} y2={top} {...line} />
      {zig(raX1, raX2, top)}
      <text x={(raX1 + raX2) / 2} y={top - 26} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700} fontSize={small} fill={theme.text}>Ra</text>
      <line x1={raX2} y1={top} x2={armX} y2={top} {...line} />
      <line x1={armX} y1={top} x2={armX} y2={armY - armR} {...line} />
      <circle cx={armX} cy={armY} r={armR} fill={theme.bg} stroke={theme.accent} strokeWidth={STROKE} />
      <text x={armX} y={armY + small * 0.35} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={800} fontSize={small} fill={theme.accent}>
        {motor ? 'M' : 'G'}
      </text>
      <text x={armX + armR + 16} y={armY + small * 0.35} fontFamily={theme.fontBody} fontWeight={700} fontSize={small} fill={theme.accent}>
        {motor ? 'Eb' : 'E'}
      </text>
      <line x1={armX} y1={armY + armR} x2={armX} y2={bottom} {...line} />
      <line x1={left} y1={bottom} x2={armX} y2={bottom} {...line} />
      <ArrowHead x={raX2 + (armX - raX2) * 0.55} y={top} dx={motor ? 1 : -1} dy={0} size={20} fill={theme.text} />
      <text x={raX2 + (armX - raX2) * 0.5} y={top + small * 1.4} textAnchor="middle" fontFamily={theme.fontBody} fontWeight={700}
        fontSize={small * 0.85} fill={theme.text}>Ia</text>
      {shunt ? (
        <g>
          {/* The shunt field sits across the supply, between the rails. */}
          <line x1={left + (armX - left) * 0.2} y1={top} x2={left + (armX - left) * 0.2} y2={armY - 50} {...line} />
          {Array.from({ length: 4 }, (_, k) => (
            <path key={k} d={'M ' + (left + (armX - left) * 0.2) + ' ' + (armY - 50 + k * 25) + ' a 14 12.5 0 0 1 0 25'} {...line} stroke={theme.textDim} />
          ))}
          <line x1={left + (armX - left) * 0.2} y1={armY + 50} x2={left + (armX - left) * 0.2} y2={bottom} {...line} />
          <text x={left + (armX - left) * 0.2 + 26} y={armY + small * 0.35} fontFamily={theme.fontBody} fontWeight={700} fontSize={small * 0.85} fill={theme.textDim}>field</text>
        </g>
      ) : null}
    </g>
  );
};
