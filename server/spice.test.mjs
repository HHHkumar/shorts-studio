// Run: node server/spice.test.mjs
//
// Our nodal analysis against ngspice, on every circuit we can find: circuits
// written in the circuit-line language the way scripts write them, circuits
// built by hand for the cases a line cannot express, and every circuit in the
// saved videos and on the test bench. One disagreement means one solver is
// wrong about something a video would state as fact.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossCheck, toNetlist, verifyCircuits } from './spice.mjs';
import { solveCircuit } from '../src/lib/figures/circuit.ts';
import { readCircuitLine } from '../src/lib/circuit-line.ts';
import { normalizeFigure } from '../src/lib/figures/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const line = (network, labelA, extra = {}) => {
  const r = readCircuitLine({ network, labelA, ...extra });
  if (!r.line) throw new Error('could not read ' + network + ': ' + r.errors.join(' '));
  return r.line.circuit;
};

console.log('\ncircuits as scripts write them');
const written = [
  ['2 + (6 | 3)', '10 V', {}],
  ['R=10Ω + 31.8mH + C1=100µF', '230 V, 50 Hz', {}],
  ['Req=0.5Ω + Xeq=j1.414Ω', '30 V', { mode: 'ac' }],
  ['R=3Ω + XL=8Ω + XC=4Ω', '100 V', { mode: 'ac' }],
  ['R=3Ω + j8Ω + -j4Ω', '100 V', { mode: 'ac' }],
  ['Ra=0.5Ω + Eb=210V', '220 V', { mode: 'dc' }],
  ['R1=1Ω + (R2=2Ω | (R3=1Ω + R4=1Ω))', '6 V', {}],
  ['(1 + 2) | (3 + 4) | 5', '9 V', {}],
  ['1 | 2 | 3 | 4', '9 V', {}],
  ['Rm=99Ω | Rsh=1Ω', '100 mA', { mode: 'dc' }],
  ['A + (V | R=10Ω)', '12 V', {}],
  ['R=10Ω + switch closed', '12 V', {}],
  ['Req=0.5Ω + Xeq=j1.414Ω + Rload=12.5Ω', '230 V', { mode: 'ac' }],

];
for (const [network, labelA, extra] of written) {
  const r = await crossCheck(line(network, labelA, extra));
  ok(network + '  [' + (labelA || 'no supply') + ']', r.agree === true || (r.agree === null && /nothing/.test(r.skipped)), r.detail || r.skipped || '');
}

console.log('\ncircuits a line cannot write');
const node = (id, col, row) => ({ id, col, row });
const el = (id, kind, from, to, value, extra = {}) => ({ id, kind, from, to, value, unknown: false, label: id, ...extra });
const bridge = {
  type: 'circuit', title: 'unbalanced bridge', frequency: 0,
  nodes: [node('a', 0, 0), node('b', 1, 0), node('c', 1, 1), node('d', 2, 0), node('g', 0, 1)],
  elements: [
    el('V1', 'voltage', 'g', 'a', 10), el('R1', 'resistor', 'a', 'b', 2), el('R2', 'resistor', 'a', 'c', 3),
    el('R3', 'resistor', 'b', 'd', 4), el('R4', 'resistor', 'c', 'd', 5), el('R5', 'resistor', 'b', 'c', 6),
    el('W', 'wire', 'd', 'g', 0),
  ],
};
let r = await crossCheck(bridge);
ok('an unbalanced bridge, which does not reduce to series and parallel', r.agree === true, r.detail || '');
const source = {
  type: 'circuit', title: 'current source', frequency: 0,
  nodes: [node('a', 0, 0), node('g', 0, 1)],
  elements: [el('I1', 'current', 'g', 'a', 2), el('R1', 'resistor', 'a', 'g', 5), el('R2', 'resistor', 'a', 'g', 20)],
};
r = await crossCheck(source);
ok('a current source into two resistors', r.agree === true, r.detail || '');
const dcL = {
  type: 'circuit', title: 'inductor and capacitor at dc', frequency: 0,
  nodes: [node('a', 0, 0), node('b', 1, 0), node('c', 2, 0), node('g', 0, 1)],
  elements: [
    el('V1', 'voltage', 'g', 'a', 12), el('L1', 'inductor', 'a', 'b', 0.1), el('R1', 'resistor', 'b', 'g', 4),
    el('C1', 'capacitor', 'b', 'c', 1e-6), el('R2', 'resistor', 'c', 'g', 8),
  ],
};
r = await crossCheck(dcL);
ok('at DC an inductor conducts and a capacitor blocks', r.agree === true, r.detail || '');
const tank = {
  type: 'circuit', title: 'parallel rlc at 50 hz', frequency: 50,
  nodes: [node('a', 0, 0), node('b', 1, 0), node('g', 0, 1)],
  elements: [
    el('V1', 'voltage', 'g', 'a', 230), el('R0', 'resistor', 'a', 'b', 1),
    el('R1', 'resistor', 'b', 'g', 50), el('L1', 'inductor', 'b', 'g', 0.2), el('C1', 'capacitor', 'b', 'g', 50e-6),
  ],
};
r = await crossCheck(tank);
ok('a parallel R, L and C at 50 Hz', r.agree === true, r.detail || '');
const ask = { ...bridge, elements: bridge.elements.filter((e) => e.kind !== 'voltage'), ask: { quantity: 'resistance', from: 'a', to: 'd' } };
ask.elements = [...ask.elements, el('V1', 'voltage', 'g', 'a', 10)];
r = await crossCheck(ask);
ok('the resistance a test ampere finds between two terminals of the bridge', r.agree === true, r.detail || '');

console.log('\nwhat is not put to ngspice');
r = await crossCheck(line('R=10Ω + SCR + lamp', '230 V AC'));
ok('a circuit with an SCR in it is not solved, and says so', r.agree === null && /nothing in it can be solved/.test(r.skipped), JSON.stringify(r));
ok('the netlist names the supply with its positive terminal first, and grounds its negative one',
  /^V\S+ n_\S+ 0 DC 10$/m.test(toNetlist(bridge).text), toNetlist(bridge).text.split('\n')[1]);

console.log('\na solver that is wrong is caught');
const divider = line('2 + (6 | 3)', '10 V');
// A stand-in for our solver that is off by 3% at one node: ngspice must say so.
const wrong = (c) => {
  const s = solveCircuit(c);
  const id = Object.keys(s.nodeVoltage).find((k) => Math.hypot(s.nodeVoltage[k].re, s.nodeVoltage[k].im) > 1);
  s.nodeVoltage[id] = { re: s.nodeVoltage[id].re * 1.03, im: s.nodeVoltage[id].im };
  return s;
};
const caught = await crossCheck(divider, { solve: wrong });
ok('a solution 3% out at one node is refused, and the node named', caught.agree === false && /at node .+ ngspice has .+ V and our solver .+ V/.test(caught.detail), caught.detail);
const badR = await crossCheck(line('4Ω + (6Ω | 3Ω)', '', { labelB: 'R = 6 Ω' }), { answer: () => ({ value: 7, unit: 'Ω' }) });
ok('a wrong resistance between two terminals is refused too', badR.agree === false && /ngspice has 6 Ω and our solver 7 Ω/.test(badR.detail), badR.detail);
ok('a network with no supply is still checked, for the resistance between its terminals',
  (await crossCheck(line('4Ω + (6Ω | 3Ω)', '', { labelB: 'R = 6 Ω' }))).agree === true);

console.log('\nin a script');
const script = {
  script: [
    { kind: 'explain', narration: 'Two in parallel, then the four.', visual: { kind: 'sketch', sketch: 'circuit', params: { network: '2 + (6 | 3)', labelA: '10 V', mode: 'dc' } } },
    { kind: 'explain', narration: 'A plain line.', visual: { kind: 'none' } },
  ],
};
const kept = await verifyCircuits(JSON.parse(JSON.stringify(script)), { readLine: readCircuitLine, figureOf: () => null });
ok('a circuit ngspice agrees with stays in the video', kept.script[0].visual.kind === 'sketch' && !kept.script[0].pictureNote);
const disagree = async () => ({ agree: false, detail: 'at node x ngspice has 4 V and our solver 5 V' });
const out = await verifyCircuits(JSON.parse(JSON.stringify(script)), { readLine: readCircuitLine, figureOf: () => null, check: disagree });
ok('one it disagrees with is taken out, and the scene says why',
  out.script[0].visual.kind === 'none' && /not drawn: ngspice, solving it separately, disagrees .* 4 V and our solver 5 V/.test(out.script[0].pictureNote), out.script[0].pictureNote);
ok('and the scenes without a circuit are untouched', out.script[1].visual.kind === 'none' && !out.script[1].pictureNote);
const withFigure = { script: [], figure: { type: 'circuit', elements: [] } };
const fig = await verifyCircuits(withFigure, { readLine: readCircuitLine, figureOf: (c) => c.figure, check: disagree });
ok('a question figure it disagrees with is not drawn, and figureCheck says why', !fig.figure && fig.figureCheck.status === 'invalid' && /ngspice/.test(fig.figureCheck.problems[0]));
const broken = await verifyCircuits(JSON.parse(JSON.stringify(script)), { readLine: readCircuitLine, figureOf: () => null, check: async () => { throw new Error('engine would not start'); } });
ok('if ngspice cannot run, nothing is taken out', broken.script[0].visual.kind === 'sketch');

console.log('\nevery circuit in the saved videos and on the bench');
let found = 0;
let agreed = 0;
const disagreements = [];
for (const dir of ['library', path.join('bench', 'cases')]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.json'))) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8')); } catch { continue; }
    const content = doc.content || {};
    const circuits = [];
    for (const s of content.script || []) {
      const v = s && s.visual;
      if (v && v.kind === 'sketch' && v.sketch === 'circuit' && v.params) {
        const read = readCircuitLine(v.params);
        if (read.line) circuits.push(read.line.circuit);
      }
    }
    const fig = content.figure ? normalizeFigure(content.figure).figure : null;
    if (fig && fig.type === 'circuit') circuits.push(fig);
    for (const c of circuits) {
      const res = await crossCheck(c);
      if (res.agree === null) continue;
      found++;
      if (res.agree) agreed++; else disagreements.push(f + ': ' + res.detail);
    }
  }
}
ok(found + ' solvable circuits, all agree with ngspice', !disagreements.length, disagreements.slice(0, 3).join(' | '));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
