// ---------------------------------------------------------------------------
// Timing diagrams that are simulated, not drawn from memory.
//
// A timing diagram is a claim about a circuit: at this clock edge, Q went
// high. A model asked to draw one draws the shape it remembers, and a JK
// flip-flop whose Q fails to toggle with J = K = 1 is a wrong answer printed
// as a picture. So the script names the circuit and gives only its INPUTS -
//
//     mode "jk-flipflop", network "J=1100; K=0110"
//
// - and the outputs are worked out here, edge by edge, the way the circuit
// works them out. WaveDrom (the timing-diagram renderer digital designers
// use) draws the result; this file says what it draws.
//
// Conventions, the ones exam papers use: positive-edge triggered; every
// output starts at 0 unless the line says "Q0=1"; an input is read at the
// edge of its own clock cycle, and drawn changing half a cycle before it, so
// it is plainly steady when the edge comes.
// ---------------------------------------------------------------------------

export type TimingMode =
  | 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'xnor' | 'not'
  | 'sr-latch' | 'd-flipflop' | 't-flipflop' | 'jk-flipflop' | 'counter';

export const TIMING_MODES: TimingMode[] = [
  'and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not', 'sr-latch', 'd-flipflop', 't-flipflop', 'jk-flipflop', 'counter',
];

/** The inputs each circuit takes, in the order they are drawn. */
export const INPUTS: Record<TimingMode, string[]> = {
  and: ['A', 'B'], or: ['A', 'B'], nand: ['A', 'B'], nor: ['A', 'B'], xor: ['A', 'B'], xnor: ['A', 'B'], not: ['A'],
  'sr-latch': ['S', 'R'], 'd-flipflop': ['D'], 't-flipflop': ['T'], 'jk-flipflop': ['J', 'K'], counter: [],
};

const CLOCKED = new Set<TimingMode>(['d-flipflop', 't-flipflop', 'jk-flipflop', 'counter']);
export const isClocked = (mode: TimingMode) => CLOCKED.has(mode);

/** Long enough to show a pattern, short enough to read on a phone. */
export const MAX_CYCLES = 12;
export const MAX_BITS = 4;

export type Bit = 0 | 1;

export interface TimingLane {
  name: string;
  kind: 'clock' | 'input' | 'output';
  values: Bit[];
}

export interface Timing {
  mode: TimingMode;
  cycles: number;
  lanes: TimingLane[];
}

/** The bits of one input: "1100", "1 1 0 0", "1,1,0,0". Null if anything else is in it. */
function bits(text: string): Bit[] | null {
  const s = text.replace(/[\s,]+/g, '');
  if (!s || !/^[01]+$/.test(s)) return null;
  return [...s].map((c) => (c === '1' ? 1 : 0));
}

/**
 * Read a timing diagram's line and simulate it. `errors` says, in words that
 * finish "The timing diagram ...", why it cannot be drawn.
 */
export function readTiming(params: { mode?: unknown; network?: unknown; count?: unknown }): { timing: Timing | null; errors: string[] } {
  const mode = String(params.mode || '').toLowerCase() as TimingMode;
  if (!TIMING_MODES.includes(mode)) return { timing: null, errors: ['does not say which circuit it is ("mode")'] };
  const given: Record<string, Bit[]> = {};
  let bitsWide = 0;
  let start: Bit = 0;
  for (const part of String(params.network || '').split(/[;\n]+/)) {
    const m = part.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*[=:]\s*(.+?)\s*$/);
    if (!m) continue;
    const name = m[1].toUpperCase();
    if (name === 'BITS') { bitsWide = Number(m[2]); continue; }
    if (name === 'Q0') { start = m[2].trim() === '1' ? 1 : 0; continue; }
    const b = bits(m[2]);
    if (!b) return { timing: null, errors: ['gives ' + name + ' as something other than 0s and 1s'] };
    given[name] = b;
  }

  const lanes: TimingLane[] = [];
  let cycles = 0;
  if (mode === 'counter') {
    const n = Math.round(bitsWide || 0);
    if (n < 1 || n > MAX_BITS) return { timing: null, errors: ['does not say how many bits the counter has ("bits=3"), or has more than ' + MAX_BITS] };
    cycles = Math.round(Number(params.count) || Math.min(MAX_CYCLES, 2 ** n));
    if (cycles < 2 || cycles > MAX_CYCLES) return { timing: null, errors: ['needs between 2 and ' + MAX_CYCLES + ' clock pulses ("count")'] };
    lanes.push({ name: 'CLK', kind: 'clock', values: Array(cycles).fill(1) as Bit[] });
    for (let b = 0; b < n; b++) {
      const values = Array.from({ length: cycles }, (_, k) => (((k + 1) % 2 ** n) >> b) & 1) as Bit[];
      lanes.push({ name: 'Q' + b, kind: 'output', values });
    }
    return { timing: { mode, cycles, lanes }, errors: [] };
  }

  const names = INPUTS[mode];
  for (const name of names) {
    if (!given[name]) return { timing: null, errors: ['does not give input ' + name + ' ("' + names.map((n) => n + '=0110').join('; ') + '")'] };
  }
  cycles = given[names[0]].length;
  if (names.some((n) => given[n].length !== cycles)) return { timing: null, errors: ['gives its inputs for different numbers of cycles'] };
  if (cycles < 2 || cycles > MAX_CYCLES) return { timing: null, errors: ['needs between 2 and ' + MAX_CYCLES + ' cycles of input'] };

  if (isClocked(mode)) lanes.push({ name: 'CLK', kind: 'clock', values: Array(cycles).fill(1) as Bit[] });
  for (const name of names) lanes.push({ name, kind: 'input', values: given[name] });

  const out: Bit[] = [];
  let q: Bit = start;
  for (let k = 0; k < cycles; k++) {
    const v = (n: string) => given[n][k];
    switch (mode) {
      case 'and': q = (v('A') & v('B')) as Bit; break;
      case 'or': q = (v('A') | v('B')) as Bit; break;
      case 'nand': q = (1 - (v('A') & v('B'))) as Bit; break;
      case 'nor': q = (1 - (v('A') | v('B'))) as Bit; break;
      case 'xor': q = (v('A') ^ v('B')) as Bit; break;
      case 'xnor': q = (1 - (v('A') ^ v('B'))) as Bit; break;
      case 'not': q = (1 - v('A')) as Bit; break;
      case 'sr-latch':
        if (v('S') && v('R')) return { timing: null, errors: ['sets S and R to 1 together, which a latch does not allow'] };
        if (v('S')) q = 1; else if (v('R')) q = 0;
        break;
      case 'd-flipflop': q = v('D'); break;
      case 't-flipflop': if (v('T')) q = (1 - q) as Bit; break;
      case 'jk-flipflop': {
        const j = v('J');
        const kk = v('K');
        if (j && kk) q = (1 - q) as Bit; else if (j) q = 1; else if (kk) q = 0;
        break;
      }
      default: break;
    }
    out.push(q);
  }
  const outName = mode === 'sr-latch' || isClocked(mode) ? 'Q' : 'Y';
  lanes.push({ name: outName, kind: 'output', values: out });
  return { timing: { mode, cycles, lanes }, errors: [] };
}

/**
 * Does a fact the script states about the diagram hold? "Q = 0110" names an
 * output and its value in each cycle; "Q2Q1Q0 = 101" a counter's state after
 * the last pulse. Empty when it holds or there is nothing to check.
 */
export function timingFactProblem(timing: Timing, fact: unknown): string {
  const text = String(fact || '').trim();
  if (!text) return '';
  const m = text.match(/^([A-Za-z0-9]+)\s*=\s*([01\s]+)$/);
  if (!m) return '';
  const name = m[1].toUpperCase();
  const want = m[2].replace(/\s+/g, '');
  const lane = timing.lanes.find((l) => l.name.toUpperCase() === name);
  if (lane) {
    const got = lane.values.join('');
    return got === want ? '' : 'says ' + lane.name + ' = ' + want + ', but the circuit gives ' + got;
  }
  // Q2Q1Q0: the counter's state after the last pulse, most significant first.
  const parts = name.match(/Q\d/g);
  if (parts && parts.join('') === name) {
    const got = parts.map((p) => {
      const l = timing.lanes.find((x) => x.name === p);
      return l ? String(l.values[l.values.length - 1]) : '?';
    }).join('');
    return got === want ? '' : 'says ' + name + ' = ' + want + ' at the end, but the circuit gives ' + got;
  }
  return 'names ' + m[1] + ', which is not in the diagram';
}

/** WaveDrom's wave string: a digit where the level changes, a dot where it holds. */
function waveOf(values: Bit[]): string {
  return values.map((v, i) => (i > 0 && values[i - 1] === v ? '.' : String(v))).join('');
}

/**
 * The diagram as WaveDrom's WaveJSON. Inputs of a clocked circuit are drawn
 * half a cycle early, so each is steady when its edge comes.
 */
export function toWaveJson(timing: Timing): { signal: object[]; config: object } {
  const clocked = isClocked(timing.mode);
  const signal = timing.lanes.map((lane) => {
    if (lane.kind === 'clock') return { name: lane.name, wave: 'p' + '.'.repeat(timing.cycles - 1) };
    if (lane.kind === 'input' && clocked) return { name: lane.name, wave: waveOf(lane.values), phase: 0.5 };
    return { name: lane.name, wave: waveOf(lane.values) };
  });
  // One unit a cycle: wider only makes it flatter, and a portrait frame needs height.
  return { signal, config: { hscale: 1 } };
}

/** The diagram in words, for the picture check and the fact-check. */
export function describeTiming(timing: Timing): string {
  const what = timing.mode === 'counter'
    ? 'a ' + (timing.lanes.length - 1) + '-bit counter'
    : timing.mode.replace('-', ' ').replace('flipflop', 'flip-flop');
  return 'Timing diagram of ' + what + ' over ' + timing.cycles + ' cycles: '
    + timing.lanes.filter((l) => l.kind !== 'clock').map((l) => l.name + ' = ' + l.values.join('')).join(', ') + '.';
}
