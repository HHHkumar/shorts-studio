// ---------------------------------------------------------------------------
// Control-system block diagrams, read from one line and solved.
//
// A block diagram is a claim: this signal minus that one, through G, fed back
// through H. Drawn from memory it is a picture of a loop; drawn from a line it
// is a system that can be solved - and the transfer function the explanation
// states, checked against it. The line is a list of signal paths:
//
//     R > +A > G1 > G2 > C; C > H > -A
//
// "+A" and "-A" enter summing junction A with that sign, and "A" carries on
// out of it. Everything else is a block (G1, G2, H) or a signal: the first
// name of the first path is the input, its last name the output. A block's
// transfer function, when the question gives one, comes from the items -
// { label: "G1", symbol: "10/(s+1)" } - and is otherwise its own name.
//
// Laid out by elkjs (BlockDiagramView), checked by the server with mathjs
// (sketch-checks.mjs). Pure: no DOM, .ts imports only.
// ---------------------------------------------------------------------------

export type BlockKind = 'input' | 'output' | 'block' | 'junction';

export interface BlockNode {
  id: string;
  kind: BlockKind;
  /** What is written on it: the block's transfer function, or its name. */
  label: string;
}

export interface BlockEdge {
  from: string;
  to: string;
  /** Into a summing junction: the sign it is added with. */
  sign?: '+' | '-';
}

export interface BlockDiagram {
  nodes: BlockNode[];
  edges: BlockEdge[];
  input: string;
  output: string;
}

/** Past this, the boxes are too small to read on a phone. */
export const MAX_BLOCKS = 7;

const ARROW = /\s*(?:->|→|>)\s*/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\(s\))?$/;

/** Read a block diagram's line. `errors` finish the sentence "The block diagram ...". */
export function readBlockDiagram(params: { network?: unknown }, items: { label?: string; symbol?: string }[] = []): { diagram: BlockDiagram | null; errors: string[] } {
  const chains = String(params.network || '').split(/[;\n]+/).map((c) => c.trim()).filter(Boolean)
    .map((c) => c.split(ARROW).map((t) => t.trim().replace(/−/g, '-')).filter(Boolean));
  if (!chains.length || chains.every((c) => c.length < 2)) return { diagram: null, errors: ['does not give its signal paths ("network")'] };

  const junctions = new Set<string>();
  for (const chain of chains) for (const t of chain) if (/^[+-]/.test(t)) junctions.add(t.slice(1));
  const nodes = new Map<string, BlockNode>();
  const edges: BlockEdge[] = [];
  const tf = new Map(items.filter((it) => it && it.label).map((it) => [String(it.label).trim(), String(it.symbol || '').trim()]));

  for (const chain of chains) {
    for (const t of chain) {
      const id = /^[+-]/.test(t) ? t.slice(1) : t;
      if (!NAME.test(id)) return { diagram: null, errors: ['has "' + t + '" in it, which is not a name or a junction'] };
      if (!nodes.has(id)) nodes.set(id, { id, kind: junctions.has(id) ? 'junction' : 'block', label: junctions.has(id) ? '' : tf.get(id) || id });
    }
    for (let k = 1; k < chain.length; k++) {
      const from = chain[k - 1].replace(/^[+-]/, '');
      const into = chain[k];
      const to = into.replace(/^[+-]/, '');
      if (junctions.has(to) && !/^[+-]/.test(into)) return { diagram: null, errors: ['enters junction ' + to + ' without a sign (write +' + to + ' or -' + to + ')'] };
      edges.push({ from, to, ...(/^[+-]/.test(into) ? { sign: into[0] as '+' | '-' } : {}) });
    }
  }

  const input = chains[0][0].replace(/^[+-]/, '');
  const output = chains[0][chains[0].length - 1].replace(/^[+-]/, '');
  if (junctions.has(input) || junctions.has(output)) return { diagram: null, errors: ['must start at its input and end at its output, not at a junction'] };
  nodes.get(input)!.kind = 'input';
  nodes.get(output)!.kind = 'output';
  nodes.get(input)!.label = input;
  nodes.get(output)!.label = output;

  const into = (id: string) => edges.filter((e) => e.to === id);
  for (const n of nodes.values()) {
    if (n.kind === 'input' && into(n.id).length) return { diagram: null, errors: ['feeds something back into its input ' + n.id] };
    if ((n.kind === 'block' || n.kind === 'output') && into(n.id).length !== 1) {
      return { diagram: null, errors: [into(n.id).length ? 'adds two signals at ' + n.id + ' - signals are added at a junction (+A, -A)' : 'has nothing going into ' + n.id] };
    }
    if (n.kind === 'junction' && into(n.id).length < 2) return { diagram: null, errors: ['has a junction ' + n.id + ' with only one input'] };
  }
  const blocks = [...nodes.values()].filter((n) => n.kind === 'block').length;
  if (blocks < 1 || blocks > MAX_BLOCKS) return { diagram: null, errors: [blocks ? 'has more than ' + MAX_BLOCKS + ' blocks' : 'has no blocks in it'] };
  return { diagram: { nodes: [...nodes.values()], edges, input, output }, errors: [] };
}

/**
 * The output over the input, for given block gains: every signal written as
 * an equation - a block multiplies its one input, a junction adds its signed
 * inputs - and the system solved. Null when it has no single solution (a loop
 * with a gain of exactly one, say).
 */
export function closedLoopGain(d: BlockDiagram, gain: (id: string) => number): number | null {
  const unknowns = d.nodes.filter((n) => n.kind !== 'input').map((n) => n.id);
  const at = new Map(unknowns.map((id, i) => [id, i]));
  const n = unknowns.length;
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  const b = Array(n).fill(0);
  for (const id of unknowns) {
    const row = at.get(id)!;
    A[row][row] = 1;
    const node = d.nodes.find((x) => x.id === id)!;
    for (const e of d.edges.filter((x) => x.to === id)) {
      const k = node.kind === 'junction' ? (e.sign === '-' ? -1 : 1) : node.kind === 'block' ? gain(id) : 1;
      if (e.from === d.input) b[row] += k;
      else A[row][at.get(e.from)!] -= k;
    }
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const v = b[at.get(d.output)!] / A[at.get(d.output)!][at.get(d.output)!];
  return Number.isFinite(v) ? v : null;
}

/**
 * Which edges run against the flow when the diagram is laid out: those on a
 * feedback branch (a node on no path from input to output) and those that
 * close a loop between two nodes that are on one. Drawn right to left, under
 * the forward path, the way a textbook draws a feedback loop.
 */
export function feedbackEdges(d: BlockDiagram): Set<number> {
  const out = (id: string) => d.edges.map((e, i) => ({ e, i })).filter((x) => x.e.from === id);
  // The forward nodes: those on some path from input to output that visits no
  // node twice. H reaches the output only by going round the loop, so it is
  // not one - which is what puts it under the forward path.
  const forward = new Set<string>();
  const onPath: string[] = [];
  const paths = (id: string) => {
    if (onPath.includes(id)) return;
    onPath.push(id);
    if (id === d.output) for (const n of onPath) forward.add(n);
    else for (const { e } of out(id)) paths(e.to);
    onPath.pop();
  };
  paths(d.input);
  const back = new Set<number>();
  // Back edges among forward nodes, found by a walk from the input.
  const state = new Map<string, 'open' | 'done'>();
  const dfs = (id: string) => {
    state.set(id, 'open');
    for (const { e, i } of out(id)) {
      if (!forward.has(e.to) || !forward.has(id)) continue;
      if (state.get(e.to) === 'open') back.add(i);
      else if (!state.has(e.to)) dfs(e.to);
    }
    state.set(id, 'done');
  };
  dfs(d.input);
  d.edges.forEach((e, i) => { if (!forward.has(e.from) || !forward.has(e.to)) back.add(i); });
  return back;
}

/** The diagram in words, for the picture check. */
export function describeBlockDiagram(d: BlockDiagram): string {
  const name = (id: string) => {
    const n = d.nodes.find((x) => x.id === id)!;
    return n.kind === 'junction' ? 'junction ' + id : n.label;
  };
  return 'Block diagram from ' + d.input + ' to ' + d.output + ': '
    + d.edges.map((e) => name(e.from) + ' into ' + (e.sign ? '(' + e.sign + ') ' : '') + name(e.to)).join(', ') + '.';
}
