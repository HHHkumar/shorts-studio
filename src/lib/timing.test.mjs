// Run: node src/lib/timing.test.mjs
//
// The outputs of a timing diagram are worked out, edge by edge: these are the
// truth tables and characteristic tables every digital electronics paper sets.

import { describeTiming, readTiming, timingFactProblem, toWaveJson } from './timing.ts';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};
const out = (mode, network, extra = {}) => {
  const r = readTiming({ mode, network, ...extra });
  if (!r.timing) return 'ERROR ' + r.errors[0];
  return r.timing.lanes.filter((l) => l.kind === 'output').map((l) => l.values.join('')).join(' ');
};

console.log('\ngates');
ok('AND', out('and', 'A=0011; B=0101') === '0001', out('and', 'A=0011; B=0101'));
ok('OR, NAND, NOR, XOR, XNOR', [out('or', 'A=0011; B=0101'), out('nand', 'A=0011; B=0101'), out('nor', 'A=0011; B=0101'), out('xor', 'A=0011; B=0101'), out('xnor', 'A=0011; B=0101')].join() === '0111,1110,1000,0110,1001');
ok('NOT', out('not', 'A=0110') === '1001');

console.log('\nlatches and flip-flops');
ok('SR latch: set, hold, reset, hold', out('sr-latch', 'S=1000; R=0010') === '1100', out('sr-latch', 'S=1000; R=0010'));
ok('an SR latch with S and R both 1 is not drawn', /S and R to 1 together/.test(out('sr-latch', 'S=11; R=01')));
ok('D flip-flop: Q follows D at each edge', out('d-flipflop', 'D=10110') === '10110');
ok('T flip-flop: toggles while T is 1, holds while 0', out('t-flipflop', 'T=11011') === '10010', out('t-flipflop', 'T=11011'));
ok('T flip-flop with T held at 1 halves the clock', out('t-flipflop', 'T=11111111') === '10101010');
ok('JK: 10 sets, 01 resets, 00 holds, 11 toggles', out('jk-flipflop', 'J=1001 1; K=0101 1') === '10010', out('jk-flipflop', 'J=10011; K=01011'));
ok('a stated start of Q0=1 is honoured', out('jk-flipflop', 'J=00; K=00; Q0=1') === '11');

console.log('\ncounters');
ok('a 2-bit counter counts 1, 2, 3, 0', out('counter', 'bits=2') === '1010 0110', out('counter', 'bits=2'));
ok('a 3-bit counter over 8 pulses ends at 000', out('counter', 'bits=3', { count: 8 }) === '10101010 01100110 00011110');
ok('a counter with no bits, or too many, is not drawn', /bits/.test(out('counter', '')) && /bits/.test(out('counter', 'bits=6')));

console.log('\nwhat a script must give');
ok('no mode, no diagram', /which circuit/.test(out('', 'A=01')));
ok('a missing input is named', /input K/.test(out('jk-flipflop', 'J=0101')));
ok('inputs of different lengths are refused', /different numbers/.test(out('and', 'A=0011; B=01')));
ok('anything but 0s and 1s is refused', /0s and 1s/.test(out('and', 'A=0021; B=0101')));

console.log('\nfacts it is checked against');
const jk = readTiming({ mode: 'jk-flipflop', network: 'J=1111; K=1111' }).timing;
ok('a fact that holds', timingFactProblem(jk, 'Q = 1010') === '');
ok('one that does not says what the circuit gives', /circuit gives 1010/.test(timingFactProblem(jk, 'Q = 1100')));
const counter = readTiming({ mode: 'counter', network: 'bits=3', count: 5 }).timing;
ok("a counter's last state, most significant bit first", timingFactProblem(counter, 'Q2Q1Q0 = 101') === '' && /gives 101/.test(timingFactProblem(counter, 'Q2Q1Q0 = 110')));

console.log('\nfor WaveDrom');
const wave = toWaveJson(readTiming({ mode: 'jk-flipflop', network: 'J=1100; K=0110' }).timing);
ok('a clock, the inputs half a cycle early, and Q', wave.signal[0].wave === 'p...' && wave.signal[1].phase === 0.5 && wave.signal[3].name === 'Q', JSON.stringify(wave.signal));
ok('a level that holds is a dot', wave.signal[1].wave === '1.0.');
ok('and it reads in words', /JK flip-flop over 4 cycles: J = 1100, K = 0110, Q = 1000/i.test(describeTiming(readTiming({ mode: 'jk-flipflop', network: 'J=1100; K=0110' }).timing)));

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
