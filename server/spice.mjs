// ---------------------------------------------------------------------------
// A second opinion on every circuit: ngspice.
//
// The circuits a video draws are solved by our own nodal analysis
// (solveCircuit in src/lib/figures/circuit.ts), and the numbers a scene states
// about them - "I = 20 A", "R = 6 Ω" - are checked against that solution. One
// solver checking its own answers catches the model's mistakes, not the
// solver's. ngspice is the circuit simulator engineers have used for decades,
// written by other people for other reasons; compiled to WebAssembly
// (eecircuit-engine), it runs in the helper in a few milliseconds a circuit.
//
// Every circuit a script draws is put to both. If their node voltages - or,
// for a question about resistance between two terminals, the voltage a test
// ampere makes - disagree, one of them is wrong about this circuit, and the
// circuit is not drawn.
// ---------------------------------------------------------------------------

import { Simulation } from 'eecircuit-engine';
import { answerCircuit, isSolvable, magnitude, solveCircuit } from '../src/lib/figures/circuit.ts';

/** How far apart the two may be: far tighter than any number a video shows, far looser than rounding. */
export const SPICE_TOLERANCE = 1e-4;

let enginePromise = null;
let queue = Promise.resolve();

/** One engine for the life of the helper, started on first use (about a quarter of a second). */
function engine() {
  if (!enginePromise) {
    const sim = new Simulation();
    enginePromise = sim.start().then(() => sim).catch((err) => { enginePromise = null; throw err; });
  }
  return enginePromise;
}

/** One netlist at a time: the engine is a single simulator, not a pool. */
async function run(netlist) {
  const job = queue.then(async () => {
    const sim = await engine();
    sim.setNetList(netlist);
    return sim.runSim();
  });
  queue = job.catch(() => undefined);
  return job;
}

const safe = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_');

/**
 * The circuit as an ngspice netlist. Our ground - the supply's negative
 * terminal, as solveCircuit chooses it - is SPICE's node 0. A wire or a closed
 * switch is a zero-volt source; an open switch is left out; every node also has
 * a teraohm to ground, so a node reached only through capacitors at DC is not
 * floating (it moves nothing a video could show). With `test`, sources are
 * switched off and one ampere is pushed from `test.from` to `test.to`, which is
 * how solveCircuit finds the resistance between two terminals.
 */
export function toNetlist(c, test = null) {
  const ground = test ? test.to : (c.elements.find((e) => e.kind === 'voltage')?.from || c.nodes[0].id);
  const node = (id) => (id === ground ? '0' : 'n_' + safe(id));
  const ac = c.frequency > 0;
  const across = (e) => !!test && ((e.from === test.from && e.to === test.to) || (e.from === test.to && e.to === test.from));
  const lines = ['* ' + safe(c.title || 'circuit')];
  c.elements.forEach((e, k) => {
    const name = safe(e.id) + '_' + k;
    const a = node(e.from);
    const b = node(e.to);
    const source = (v) => (ac ? 'DC 0 AC ' + v : 'DC ' + v);
    switch (e.kind) {
      case 'resistor': case 'lamp': case 'meter':
        lines.push('R' + name + ' ' + a + ' ' + b + ' ' + e.value); break;
      case 'inductor': lines.push('L' + name + ' ' + a + ' ' + b + ' ' + e.value); break;
      case 'capacitor': lines.push('C' + name + ' ' + a + ' ' + b + ' ' + e.value); break;
      case 'voltage':
        // From is the negative terminal; SPICE writes the positive one first.
        if (across(e)) break;
        lines.push('V' + name + ' ' + b + ' ' + a + ' ' + source(test ? 0 : e.value)); break;
      case 'current':
        // Flowing through the source from `from` to `to`, as solveCircuit has it.
        if (!test) lines.push('I' + name + ' ' + a + ' ' + b + ' ' + source(e.value)); break;
      case 'wire': lines.push('V' + name + ' ' + a + ' ' + b + ' DC 0'); break;
      case 'switch': if (!e.open) lines.push('V' + name + ' ' + a + ' ' + b + ' DC 0'); break;
      default: throw new Error('ngspice is not given a ' + e.kind);
    }
  });
  if (test) lines.push('Itest ' + node(test.to) + ' ' + node(test.from) + ' ' + (ac ? 'DC 0 AC 1' : 'DC 1'));
  for (const n of c.nodes) if (n.id !== ground) lines.push('Rleak_' + safe(n.id) + ' ' + node(n.id) + ' 0 1e12');
  lines.push(ac ? '.ac lin 1 ' + c.frequency + ' ' + c.frequency : '.op');
  lines.push('.end');
  return { text: lines.join('\n'), ground, node };
}

/** Node voltages from an ngspice result, keyed by our node ids. */
function voltagesFrom(result, c, net) {
  const byName = new Map((result.data || []).map((d) => [String(d.name).toLowerCase(), d.values && d.values[0]]));
  const out = {};
  for (const n of c.nodes) {
    if (n.id === net.ground) { out[n.id] = { re: 0, im: 0 }; continue; }
    const v = byName.get('v(' + net.node(n.id) + ')');
    if (v === undefined) return null;
    out[n.id] = typeof v === 'number' ? { re: v, im: 0 } : { re: Number(v.real), im: Number(v.img) };
  }
  return out;
}

const gap = (a, b) => Math.hypot(a.re - b.re, a.im - b.im);

/**
 * Do ngspice and our solver agree about this circuit? `agree` is null when it
 * was not put to ngspice at all (nothing to solve: a diode, a part with no
 * value), with the reason in `skipped`.
 */
export async function crossCheck(c, { solve = solveCircuit, answer = answerCircuit } = {}) {
  if (!c || !Array.isArray(c.elements) || !c.elements.length) return { agree: null, skipped: 'no circuit' };
  const between = c.ask && (c.ask.quantity === 'resistance' || c.ask.quantity === 'impedance') && c.ask.from && c.ask.to && !c.ask.element;
  // A network with no supply is still solvable for the resistance between two
  // of its terminals, which is what such a question asks.
  const passive = !c.elements.some((e) => e.kind === 'voltage' || e.kind === 'current')
    && c.elements.every((e) => e.kind === 'wire' || e.kind === 'switch' || (!e.symbolic && Number.isFinite(e.value) && e.value > 0 && !['diode', 'scr', 'load'].includes(e.kind)));
  if (!isSolvable(c) && !(passive && between)) return { agree: null, skipped: 'nothing in it can be solved' };

  if (!passive) {
    const ours = solve(c);
    if (!ours) return { agree: null, skipped: 'our solver found no solution' };
    const net = toNetlist(c);
    const theirs = voltagesFrom(await run(net.text), c, net);
    if (!theirs) return { agree: false, detail: 'ngspice gave no voltage for every node' };
    const scale = Math.max(1e-9, ...Object.values(theirs).map((v) => Math.hypot(v.re, v.im)));
    for (const n of c.nodes) {
      const d = gap(ours.nodeVoltage[n.id], theirs[n.id]);
      if (d > SPICE_TOLERANCE * scale) {
        return {
          agree: false,
          detail: 'at node ' + n.id + ' ngspice has ' + round(magnitude(theirs[n.id])) + ' V and our solver ' + round(magnitude(ours.nodeVoltage[n.id])) + ' V',
        };
      }
    }
  }

  // A resistance between two terminals is a different solve: check that one too.
  if (between) {
    const mine = answer(c);
    const tnet = toNetlist(c, { from: c.ask.from, to: c.ask.to });
    const tv = voltagesFrom(await run(tnet.text), c, tnet);
    if (mine && tv) {
      const v = tv[c.ask.from];
      const value = c.ask.quantity === 'resistance' ? v.re : magnitude(v);
      if (Math.abs(value - mine.value) > SPICE_TOLERANCE * Math.max(1, Math.abs(value))) {
        return { agree: false, detail: 'between ' + c.ask.from + ' and ' + c.ask.to + ' ngspice has ' + round(value) + ' Ω and our solver ' + round(mine.value) + ' Ω' };
      }
    }
  }
  return { agree: true };
}

const round = (v) => String(Math.round(v * 10000) / 10000);

/**
 * Put every circuit a script draws to ngspice: each circuit sketch, and the
 * question's own figure when it is a circuit. One that ngspice disagrees with
 * is not drawn, and the scene (or figureCheck) says why. If ngspice cannot run
 * at all, nothing is taken out: our solver's own checks still stand.
 */
export async function verifyCircuits(content, { readLine, figureOf, check = crossCheck } = {}) {
  if (!content || !Array.isArray(content.script)) return content;
  const notes = [];
  try {
    for (let i = 0; i < content.script.length; i++) {
      const s = content.script[i];
      const v = s && s.visual;
      if (!v || v.kind !== 'sketch' || v.sketch !== 'circuit' || !v.params || !readLine) continue;
      const read = readLine(v.params);
      if (!read.line) continue;
      const r = await check(read.line.circuit);
      if (r.agree === false) {
        content.script[i] = { ...s, visual: { kind: 'none' }, pictureNote: 'The circuit was not drawn: ngspice, solving it separately, disagrees with our solver - ' + r.detail + '.' };
        notes.push(i);
      }
    }
    const fig = figureOf ? figureOf(content) : null;
    if (fig && fig.type === 'circuit') {
      const r = await check(fig);
      if (r.agree === false) {
        delete content.figure;
        content.figureCheck = { status: 'invalid', problems: ['ngspice, solving the circuit separately, disagrees with our solver - ' + r.detail + '. Nothing was drawn.'] };
      }
    }
  } catch (err) {
    console.log('[spice] could not check the circuits: ' + (err && err.message ? err.message : err));
  }
  if (notes.length) console.log('[spice] ' + notes.length + ' circuit(s) not drawn: ngspice disagreed');
  return content;
}
