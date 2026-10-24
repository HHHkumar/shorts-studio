// ---------------------------------------------------------------------------
// Is the transfer function a block diagram states the diagram's own?
//
// The diagram is solved (closedLoopGain in src/lib/block-diagram.ts) with the
// blocks given numbers - several sets of them, and several values of s - and
// the stated function, read with mathjs, must give the same number every
// time. Two expressions that agree at that many unrelated points are the same
// function; one slip in a sign or a missing H does not survive the first.
// ---------------------------------------------------------------------------

import { all, create } from 'mathjs';
import { closedLoopGain, readBlockDiagram } from '../src/lib/block-diagram.ts';
import { latexToMath } from './working-check.mjs';

const math = create(all);

/** Values for the symbols, set by set: no two alike, none 0 or 1, none a simple fraction. */
const TRIALS = [
  [1.37, 0.73, 2.11, 0.41, 1.83, 0.59, 2.47, 0.97],
  [0.62, 1.91, 0.38, 2.29, 0.83, 1.49, 0.27, 1.13],
  [2.03, 0.47, 1.21, 0.89, 0.33, 2.61, 1.07, 0.71],
];
const S_VALUES = [0.37, 1.43, 2.71];
const FUNCTIONS = new Set(['sqrt', 'exp', 'sin', 'cos', 'tan', 'log', 'abs', 'pi', 'e']);

/**
 * An expression made readable to mathjs: products written side by side
 * ("G1G2H", "s(s+2)") get their multiplication signs, and LaTeX is read as
 * the worked solutions are.
 */
export function readExpression(text, names) {
  let s = String(text || '');
  if (/\\/.test(s)) s = latexToMath(s) || '';
  // Known names, longest first, so "G1G2H" is G1 * G2 * H and not one symbol.
  const sorted = [...names].sort((a, b) => b.length - a.length);
  if (sorted.length) {
    const re = new RegExp('(' + sorted.map((n) => n.replace(/[()]/g, '\\$&')).join('|') + ')', 'g');
    s = s.replace(re, ' $1 ');
  }
  return s
    .replace(/\(s\)/g, '')
    .replace(/(\d)\s*([A-Za-z(])/g, '$1*$2')
    .replace(/\)\s*\(/g, ')*(')
    .replace(/([A-Za-z0-9_]+)\s*\(/g, (m, name) => (FUNCTIONS.has(name) ? m : name + '*('))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Why a block diagram cannot be drawn, finishing "The block diagram ...". Empty when it can. */
export function blockDiagramProblems(params, items) {
  const { diagram, errors } = readBlockDiagram(params || {}, items || []);
  if (!diagram) return errors.slice(0, 1);
  const blocks = diagram.nodes.filter((n) => n.kind === 'block');

  // Every symbol any block's function uses, besides s: each gets its own value.
  const symbols = new Set(blocks.map((b) => b.id));
  for (const b of blocks) {
    if (b.label === b.id) continue;
    try {
      math.parse(readExpression(b.label, [])).traverse((node) => {
        if (node.type === 'SymbolNode' && node.name !== 's' && !FUNCTIONS.has(node.name)) symbols.add(node.name);
      });
    } catch {
      return ['gives ' + b.id + ' a transfer function that cannot be read: ' + b.label];
    }
  }
  const order = [...symbols];

  const stated = String((params || {}).labelB || '').trim();
  const rhs = stated.includes('=') ? stated.slice(stated.lastIndexOf('=') + 1) : '';
  for (let t = 0; t < TRIALS.length; t++) {
    const scope = { s: S_VALUES[t] };
    order.forEach((name, i) => { scope[name] = TRIALS[t][i % TRIALS[t].length] + Math.floor(i / TRIALS[t].length) * 0.13; });
    const gains = {};
    for (const b of blocks) {
      if (b.label === b.id) { gains[b.id] = scope[b.id]; continue; }
      try {
        gains[b.id] = Number(math.evaluate(readExpression(b.label, []), { ...scope }));
      } catch {
        return ['gives ' + b.id + ' a transfer function that cannot be read: ' + b.label];
      }
    }
    const value = closedLoopGain(diagram, (id) => gains[id]);
    if (value === null) return ['has a loop whose gain is exactly one, so it has no closed-loop transfer function'];
    if (!rhs.trim()) continue;
    let claim;
    try {
      claim = Number(math.evaluate(readExpression(rhs, order), { ...scope }));
    } catch {
      return ['states "' + stated + '", which could not be read'];
    }
    if (!Number.isFinite(claim) || Math.abs(claim - value) > 1e-6 * Math.max(1, Math.abs(value))) {
      return ['says ' + stated + ', but solving the diagram gives a different transfer function'];
    }
  }
  return [];
}
