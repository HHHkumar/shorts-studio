import React from 'react';
import { continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../lib/theme';
import { feedbackEdges, type BlockDiagram } from '../lib/block-diagram';
import { mathWidth, parseMath } from '../lib/formula-card';
import { MathText, mathFontFor } from './MathText';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';

// ---------------------------------------------------------------------------
// A control-system block diagram, laid out by elkjs.
//
// elkjs is the Eclipse layout engine: layered graph drawing, orthogonal wires.
// It is told which branches are feedback (src/lib/block-diagram.ts), so they
// run back under the forward path the way a textbook draws a loop, and it
// routes every wire round the boxes. This draws its answer: blocks with their
// transfer functions, summing points with the sign of each input, a dot where
// a signal is taken off, and an arrow on every wire.
//
// elkjs is loaded the first time a block diagram is drawn, not with the app,
// and the frame waits for the layout (delayRender), which takes milliseconds.
// ---------------------------------------------------------------------------

const FONT = 34;
const PAD = 22;
const JUNCTION = 46;
const POINT = 10;

interface Box { x: number; y: number; w: number; h: number }
interface Wire { points: { x: number; y: number }[]; sign?: '+' | '-'; from: string; to: string }
interface Laid { width: number; height: number; boxes: Record<string, Box>; wires: Wire[] }

/** How big each node is drawn: a block by its function's width, a junction a fixed circle. */
function sizeOf(d: BlockDiagram, id: string) {
  const n = d.nodes.find((x) => x.id === id)!;
  if (n.kind === 'junction') return { w: JUNCTION, h: JUNCTION };
  if (n.kind === 'input' || n.kind === 'output') return { w: POINT, h: POINT };
  const w = Math.max(2.2, mathWidth(parseMath(n.label))) * FONT + PAD * 2;
  const tall = /\\frac|\//.test(n.label);
  return { w, h: tall ? FONT * 2.6 : FONT * 1.9 };
}

async function layout(d: BlockDiagram): Promise<Laid> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const back = feedbackEdges(d);
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '46',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: d.nodes.map((n) => ({ id: n.id, width: sizeOf(d, n.id).w, height: sizeOf(d, n.id).h })),
    // A feedback wire is given to elkjs the other way round, and turned back
    // for drawing; the forward ones are asked to run straight, so the forward
    // path is one row.
    edges: d.edges.map((e, i) => ({
      id: 'e' + i,
      sources: [back.has(i) ? e.to : e.from],
      targets: [back.has(i) ? e.from : e.to],
      ...(back.has(i) ? {} : { layoutOptions: { 'elk.layered.priority.straightness': '10' } }),
    })),
  };
  const out = await elk.layout(graph);
  const height = out.height || 0;
  // elkjs puts the reversed branches above the forward path; a textbook puts
  // the feedback underneath, so the whole drawing is turned over.
  const flip = (y: number) => height - y;
  const boxes: Record<string, Box> = {};
  for (const c of out.children || []) {
    const s = sizeOf(d, c.id);
    const cy = flip((c.y || 0) + (c.height || 0) / 2);
    boxes[c.id] = { x: (c.x || 0) + ((c.width || 0) - s.w) / 2, y: cy - s.h / 2, w: s.w, h: s.h };
  }
  const wires: Wire[] = ((out.edges || []) as ElkExtendedEdge[]).map((e, i) => {
    const s = (e.sections || [])[0];
    const pts = s ? [s.startPoint, ...(s.bendPoints || []), s.endPoint].map((p) => ({ x: p.x, y: flip(p.y) })) : [];
    const edge = d.edges[i];
    return { points: back.has(i) ? pts.reverse() : pts, sign: edge.sign, from: edge.from, to: edge.to };
  });
  return { width: out.width || 0, height, boxes, wires };
}

export const BlockDiagramView: React.FC<{ theme: Theme; diagram: BlockDiagram }> = ({ theme, diagram }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [laid, setLaid] = React.useState<Laid | null>(null);
  const [handle] = React.useState(() => delayRender('Laying out the block diagram'));

  React.useEffect(() => {
    let live = true;
    layout(diagram)
      .then((l) => { if (live) setLaid(l); })
      .catch(() => { if (live) setLaid(null); })
      .finally(() => continueRender(handle));
    return () => { live = false; };
  }, [diagram, handle]);

  if (!laid) return null;
  const ink = theme.text;
  const accent = theme.accent;
  const font = mathFontFor(theme);
  const margin = 70;
  const stub = 90;
  const vbW = laid.width + margin * 2 + stub;
  const vbH = laid.height + margin * 2;
  const outBox = laid.boxes[diagram.output];
  const inBox = laid.boxes[diagram.input];
  // Wires drawn in order, along the signal: everything is in by two thirds of the scene.
  const total = laid.wires.length + 1;
  const shown = interpolate(frame, [4, Math.max(8, durationInFrames * 0.66)], [0.6, total], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = (k: number) => Math.max(0, Math.min(1, shown - k));
  const outgoing = (id: string) => laid.wires.filter((w) => w.from === id).length;

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <svg viewBox={[-margin, -margin, vbW, vbH].join(' ')} style={{ width: '96%', overflow: 'visible' }}>
        <defs>
          <marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={ink} />
          </marker>
        </defs>
        {laid.wires.map((w, k) => {
          if (w.points.length < 2) return null;
          const end = w.points[w.points.length - 1];
          const before = w.points[w.points.length - 2];
          const start = w.points[0];
          const dx = Math.sign(end.x - before.x);
          const dy = Math.sign(end.y - before.y);
          return (
            <g key={k} opacity={fade(k)}>
              {/* No arrowhead into the output point: the output arrow beyond it says which way. */}
              <polyline points={w.points.map((p) => p.x + ',' + p.y).join(' ')} fill="none" stroke={ink} strokeWidth={4}
                markerEnd={w.to === diagram.output ? undefined : 'url(#bd-arrow)'} />
              {outgoing(w.from) > 1 && diagram.nodes.find((n) => n.id === w.from)!.kind !== 'junction'
                ? <circle cx={start.x} cy={start.y} r={7} fill={ink} />
                : null}
              {w.sign ? (
                <text x={end.x - dx * 26 + (dy ? 18 : 0)} y={end.y - dy * 26 + (dx ? -14 : 0)} fill={w.sign === '-' ? accent : ink}
                  fontSize={FONT} fontFamily={font} textAnchor="middle" dominantBaseline="middle">
                  {w.sign === '-' ? '−' : '+'}
                </text>
              ) : null}
            </g>
          );
        })}
        {diagram.nodes.map((n) => {
          const b = laid.boxes[n.id];
          if (!b) return null;
          if (n.kind === 'junction') {
            const r = b.w / 2;
            const cx = b.x + r;
            const cy = b.y + r;
            const d = r * 0.7;
            return (
              <g key={n.id}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={ink} strokeWidth={4} />
                <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke={ink} strokeWidth={3} />
                <line x1={cx - d} y1={cy + d} x2={cx + d} y2={cy - d} stroke={ink} strokeWidth={3} />
              </g>
            );
          }
          if (n.kind === 'block') {
            return (
              <g key={n.id}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="none" stroke={ink} strokeWidth={4} />
                <foreignObject x={b.x} y={b.y} width={b.w} height={b.h}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MathText theme={theme} src={n.label} size={FONT} color={ink} />
                  </div>
                </foreignObject>
              </g>
            );
          }
          return null;
        })}
        {inBox ? (
          <text x={inBox.x - 12} y={inBox.y + inBox.h / 2} fill={ink} fontSize={FONT} fontFamily={font} textAnchor="end" dominantBaseline="middle">
            {diagram.input}
          </text>
        ) : null}
        {outBox ? (
          <g opacity={fade(total - 1)}>
            <line x1={outBox.x + outBox.w / 2} y1={outBox.y + outBox.h / 2} x2={outBox.x + outBox.w / 2 + stub - 10} y2={outBox.y + outBox.h / 2}
              stroke={ink} strokeWidth={4} markerEnd="url(#bd-arrow)" />
            <text x={outBox.x + stub} y={outBox.y + outBox.h / 2 - 30} fill={ink} fontSize={FONT} fontFamily={font} textAnchor="middle">
              {diagram.output}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
};
