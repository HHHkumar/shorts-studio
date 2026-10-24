// Run: node server/block-check.test.mjs
//
// Block diagrams: read from their line, solved, and the transfer function a
// script states held to the solution. The forms are the ones every control
// systems paper reduces.

import { blockDiagramProblems, readExpression } from './block-check.mjs';
import { closedLoopGain, feedbackEdges, readBlockDiagram, describeBlockDiagram } from '../src/lib/block-diagram.ts';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const problems = (network, labelB = '', items = []) => blockDiagramProblems({ network, labelB }, items);
const T = String.raw;

console.log('\nreading');
const loop = readBlockDiagram({ network: 'R > +A > G1 > G2 > C; C > H > -A' }).diagram;
ok('input, output, blocks and the junction', loop.input === 'R' && loop.output === 'C'
  && loop.nodes.filter((n) => n.kind === 'block').map((n) => n.id).join() === 'G1,G2,H' && loop.nodes.find((n) => n.id === 'A').kind === 'junction');
ok('the feedback branch is the one drawn back under the forward path', [...feedbackEdges(loop)].map((i) => loop.edges[i].from + '>' + loop.edges[i].to).join() === 'C>H,H>A');
ok('a block given a transfer function shows it', readBlockDiagram({ network: 'R > +A > G > C; C > -A' }, [{ label: 'G', symbol: '10/(s+1)' }]).diagram.nodes.find((n) => n.id === 'G').label === '10/(s+1)');
ok('two signals into a block are refused: they meet at a junction', /junction/.test(readBlockDiagram({ network: 'R > G > C; R > G' }).errors[0] || ''));
ok('a junction entered with no sign is refused', /without a sign/.test(readBlockDiagram({ network: 'R > +A > G > C; C > A' }).errors[0] || ''));
ok('and it reads in words', /Block diagram from R to C: R into \(\+\) junction A/.test(describeBlockDiagram(loop)));

console.log('\nsolving');
const g = (vals) => (id) => vals[id];
ok('negative feedback: G/(1 + GH)', Math.abs(closedLoopGain(readBlockDiagram({ network: 'R > +A > G > C; C > H > -A' }).diagram, g({ G: 2, H: 0.5 })) - 1) < 1e-12);
ok('positive feedback: G/(1 - GH)', Math.abs(closedLoopGain(readBlockDiagram({ network: 'R > +A > G > C; C > H > +A' }).diagram, g({ G: 2, H: 0.25 })) - 4) < 1e-12);
ok('blocks in series multiply, branches in parallel add', Math.abs(closedLoopGain(readBlockDiagram({ network: 'R > G1 > +B > G3 > C; R > G2 > +B' }).diagram, g({ G1: 2, G2: 3, G3: 4 })) - 20) < 1e-12);
ok('a loop of gain exactly one has no answer', closedLoopGain(readBlockDiagram({ network: 'R > +A > G > C; C > H > +A' }).diagram, g({ G: 2, H: 0.5 })) === null);

console.log('\nwhat a script states');
ok('unity negative feedback', problems('R > +A > G > C; C > -A', 'C/R = G/(1+G)').length === 0);
ok('G1G2/(1 + G1G2H), written with no multiplication signs', problems('R > +A > G1 > G2 > C; C > H > -A', 'C/R = G1G2/(1+G1G2H)').length === 0);
ok('the same in LaTeX', problems('R > +A > G1 > G2 > C; C > H > -A', T`\frac{C(s)}{R(s)} = \frac{G_1 G_2}{1 + G_1 G_2 H}`.replace(/G_(\d)/g, 'G$1')).length === 0);
ok('a wrong sign is caught', /different transfer function/.test(problems('R > +A > G1 > G2 > C; C > H > -A', 'C/R = G1G2/(1-G1G2H)')[0] || ''));
ok('a missing H is caught', /different transfer function/.test(problems('R > +A > G1 > G2 > C; C > H > -A', 'C/R = G1G2/(1+G1G2)')[0] || ''));
ok('with real transfer functions: 10/(s+1) in unity feedback is 10/(s+11)',
  problems('R > +A > G > C; C > -A', 'C/R = 10/(s+11)', [{ label: 'G', symbol: '10/(s+1)' }]).length === 0);
ok('and 10/(s(s+2)) in unity feedback is 10/(s^2+2s+10)',
  problems('R > +A > G > C; C > -A', 'C/R = 10/(s^2 + 2s + 10)', [{ label: 'G', symbol: '10/(s(s+2))' }]).length === 0);
ok('a minor loop inside a major one', problems('R > +A > G1 > +B > G2 > C; C > H2 > -B; C > H1 > -A', 'C/R = G1G2/(1 + G2H2 + G1G2H1)').length === 0);
ok('a diagram with nothing stated is still solved, and drawn', problems('R > +A > G > C; C > H > -A').length === 0);
ok('a reading that cannot be read is refused, not guessed', /could not be read/.test(problems('R > +A > G > C; C > -A', 'C/R = G /// (1+G)')[0] || ''));
ok('juxtaposed products are spelled out', readExpression('G1G2H', ['G1', 'G2', 'H']).split(/[\s*]+/).join() === 'G1,G2,H' && readExpression('10/(s(s+2))', []) === '10/(s*(s+2))', readExpression('G1G2H', ['G1', 'G2', 'H']));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
