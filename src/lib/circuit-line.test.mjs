// Run: node --import ./tools/ts-resolve.mjs src/lib/circuit-line.test.mjs
//
// A circuit from one short line: read, laid out, solved and checked. The
// cases are the circuits real videos drew wrongly, written the way the line
// now lets them be written.

import { readCheck, readCircuitLine, readSource } from './circuit-line.ts';
import { answerCircuit, fitCircuit, normalizeCircuit, solveCircuit, magnitude } from './figures/circuit.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-12;

const read = (network, labelA, extra = {}) => readCircuitLine({ network, labelA, ...extra });
const ok = (network, labelA, extra) => {
  const r = read(network, labelA, extra);
  assert(r.line, 'refused: ' + r.errors.join('; '));
  return r.line;
};
const refused = (network, labelA, extra) => {
  const r = read(network, labelA, extra);
  assert(!r.line, 'was read, and should not have been');
  return r.errors.join('; ');
};
const kinds = (line) => line.circuit.elements.filter((e) => e.kind !== 'wire').map((e) => e.kind).join(',');
const part = (line, label) => line.circuit.elements.find((e) => e.label === label);

test('a part is what its unit says it is', () => {
  const line = ok('R=10Ω + 31.8mH + C1=100µF', '230 V, 50 Hz');
  assert(kinds(line) === 'resistor,inductor,capacitor,voltage', kinds(line));
  assert(near(line.circuit.elements.find((e) => e.kind === 'inductor').value, 0.0318), 'the inductor is not in henries');
  assert(near(part(line, 'C1').value, 1e-4), 'the capacitor is not in farads');
  assert(line.circuit.frequency === 50);
});

test('or what its name says, when it has no value: a schematic, with nothing invented', () => {
  const line = ok('R + L + C', 'Vs', { mode: 'ac' });
  assert(kinds(line) === 'resistor,inductor,capacitor,voltage', kinds(line));
  assert(line.circuit.elements.filter((e) => e.kind !== 'wire').every((e) => e.symbolic), 'a part with no value was given one');
  assert(!line.solved, 'a circuit with no values was called solved');
  assert(line.written.length === 0, 'numbers were written: ' + line.written);
  assert(part(line, 'Vs') && part(line, 'Vs').kind === 'voltage', 'the supply lost its name');
});

test('bare numbers are still resistors, so an old line still reads', () => {
  const line = ok('2 + (6 | 3)', '10 V');
  assert(kinds(line) === 'resistor,resistor,resistor,voltage', kinds(line));
  assert(line.solved, 'not solved');
  const s = solveCircuit(line.circuit);
  const supply = line.circuit.elements.find((e) => e.kind === 'voltage');
  assert(near(magnitude(s.elements[supply.id].current), 2.5), 'the supply current is ' + magnitude(s.elements[supply.id].current));
});

test('a part that cannot be read is refused, never guessed', () => {
  assert(/cannot tell what kind of part "Foo"/.test(refused('R + Foo', '12 V')), 'an unknown name was drawn as something');
  assert(/L1 is an inductor/.test(refused('L1=5Ω + R=2Ω', '12 V AC')), 'ohms on an inductor were accepted');
  assert(/R1 is a resistor, but 5mH/.test(refused('R1=5mH', '12 V AC')), 'henries on a resistor were accepted');
  assert(/cannot read the value/.test(refused('R=abcΩ', '12 V')));
  assert(/could not be read/.test(refused('R + (L | ', '12 V')), 'half a network was drawn');
});

test('the meter and its shunt: the shunt hidden, and the meter current CHECKED', () => {
  const line = ok('Rm=99Ω | Rsh=1Ω?', '100 mA', { mode: 'dc', labelB: 'I(Rm) = 1 mA' });
  assert(line.circuit.elements.find((e) => e.kind === 'current'), 'a current is not drawn as a current source');
  assert(part(line, 'Rsh').unknown && !part(line, 'Rm').unknown, 'the wrong part is hidden');
  assert(line.solved && line.computed === '1 mA', 'computed ' + line.computed);
  assert(line.hidden.join() === '1' && line.written.includes(99) && line.written.includes(100), 'written ' + line.written + ' hidden ' + line.hidden);
  assert(line.circuit.ask && line.circuit.ask.quantity === 'current', 'the checked fact is not shown');
});

test('a circuit that does not do what the script says is not drawn', () => {
  const why = refused('Rm=99Ω | Rsh=2Ω', '100 mA', { labelB: 'I(Rm) = 1 mA' });
  assert(/does not do what the script says/.test(why) && /I\(Rm\) works out to 1\.98 mA, not 1 mA/.test(why), why);
  assert(/not one of its parts/.test(refused('R1=4Ω + R2=6Ω', '10 V', { labelB: 'I(R9) = 1 A' })));
});

test('the short-circuit test: a resistance and a REACTANCE, giving the rated current', () => {
  const line = ok('Req=0.5Ω + Xeq=j1.414Ω', '30 V', { mode: 'ac', labelB: 'I = 20 A' });
  assert(kinds(line) === 'resistor,inductor,voltage', 'the reactance is drawn as ' + kinds(line));
  assert(part(line, 'Xeq').shown === 'j1.41 Ω', 'shown as ' + part(line, 'Xeq').shown);
  assert(line.solved && line.computed === '20 A', 'computed ' + line.computed);
  // Drawn as two resistors this added to 1.91 ohm; as an impedance it is 1.5.
  const z = ok('Req=0.5Ω + Xeq=j1.414Ω', '', { mode: 'ac', labelB: 'Z = 1.5 Ω' });
  assert(z.computed === '1.5 Ω', 'impedance ' + z.computed);
});

test('a reactance by its name, and a capacitive one by its sign', () => {
  const line = ok('R=3Ω + XL=8Ω + XC=4Ω', '100 V', { mode: 'ac', labelB: 'I = 20 A' });
  assert(kinds(line) === 'resistor,inductor,capacitor,voltage', kinds(line));
  assert(part(line, 'XC').shown === '−j4 Ω', part(line, 'XC').shown);
  const same = ok('R=3Ω + j8Ω + -j4Ω', '100 V', { mode: 'ac', labelB: 'I = 20 A' });
  assert(same.computed === '20 A');
  assert(/not said to be AC/.test(refused('R=3Ω + XL=8Ω', '100 V', { mode: 'dc' })), 'a reactance in a DC circuit');
  assert(/XL is inductive but its reactance is written -j8Ω/.test(refused('XL=-j8Ω', '100 V AC')));
});

test('a back EMF opposes the supply', () => {
  const line = ok('Ra=0.5Ω + Eb=210V', '220 V', { mode: 'dc', labelB: 'I = 20 A' });
  assert(kinds(line) === 'resistor,voltage,voltage', kinds(line));
  assert(line.computed === '20 A', 'armature current ' + line.computed);
});

test('no supply: the network stands between terminals A and B, and its resistance is checked', () => {
  const line = ok('4Ω + (6Ω | 3Ω)', '', { labelB: 'R = 6 Ω' });
  assert(!line.circuit.elements.some((e) => e.kind === 'voltage' || e.kind === 'current'), 'a supply was invented');
  assert(line.circuit.nodes.some((n) => n.id === 'A') && line.circuit.nodes.some((n) => n.id === 'B'), 'no terminals');
  assert(line.computed === '6 Ω', 'equivalent ' + line.computed);
  assert(/R works out to 6 Ω, not 5 Ω/.test(refused('4Ω + (6Ω | 3Ω)', '', { labelB: 'R = 5 Ω' })));
});

test('a line, its capacitance and its load: parts that are drawn and not solved', () => {
  const line = ok('L + (C | Load)', 'Vs', { mode: 'ac' });
  assert(kinds(line) === 'inductor,capacitor,load,voltage', kinds(line));
  assert(!line.solved);
  const devices = ok('R=10Ω + SCR + lamp', '230 V AC');
  assert(kinds(devices) === 'resistor,scr,lamp,voltage', kinds(devices));
  assert(!devices.solved, 'a thyristor was solved as though it were a number');
  const meters = ok('A + (V | R=10Ω)', '12 V');
  assert(meters.circuit.elements.filter((e) => e.kind === 'meter').map((e) => e.letter).join() === 'A,V');
});

test('a fact about a circuit that cannot be solved is not shown as though checked', () => {
  const line = ok('L + (C | Load)', 'Vs', { mode: 'ac', labelB: 'I(C) = 2 A' });
  assert(!line.check && !line.circuit.ask && line.computed === '', 'an unchecked fact is on the picture');
});

test('the supply is read: its kind, its value, AC or DC, and its name', () => {
  const s = readSource('Vs = 230 V, 50 Hz', '');
  assert(s.kind === 'voltage' && s.value === 230 && s.ac && s.frequency === 50 && s.label === 'Vs', JSON.stringify(s));
  assert(readSource('100 mA', 'dc').kind === 'current' && near(readSource('100 mA', 'dc').value, 0.1));
  assert(readSource('12 V', '').ac === false, 'a plain voltage is DC unless it says otherwise');
  assert(readSource('AC Source', '').ac === true && readSource('AC Source', '').label === '', JSON.stringify(readSource('AC Source', '')));
  assert(readSource('', 'ac').kind === 'none' && readSource('', 'ac').ac === true);
  assert(readSource('12 V', 'ac').ac === true, 'the mode did not win');
});

test('a fact is read: what, of which part, and how much', () => {
  const c = readCheck('I(Rm) = 1 mA');
  assert(c.quantity === 'current' && c.about === 'Rm' && near(c.value, 0.001), JSON.stringify(c));
  assert(readCheck('Zeq = 1.5 Ω').quantity === 'impedance' && readCheck('P(R1)=8W').about === 'R1');
  assert(readCheck('Measure Response') === null && readCheck('') === null, 'prose was read as a fact');
  assert(readCheck('I = 5 V') === null, 'a current in volts was accepted');
});

test('every circuit it lays out is one the figure rules would accept: nothing crosses, nothing floats', () => {
  const lines = [
    ['R + L + C', 'Vs AC'], ['Rm=99Ω | Rsh=1Ω', '100 mA'], ['2 + (6 | 3)', '10 V'], ['(4 | 4 | 4) + 2', '12 V'],
    ['(1 + 2) | (3 + 4) | 5', '9 V'], ['1 + (2 | (3 + 4)) + 5', '9 V'], ['((1 | 2) + 3) | 4', '9 V'], ['L + (C | Load)', 'Vs AC'],
    ['4Ω + (6Ω | 3Ω)', ''], ['(6Ω | 3Ω) + 4Ω', ''],
  ];
  for (const [network, labelA] of lines) {
    const line = ok(network, labelA);
    // The same geometry checks a netlist written by hand goes through, with
    // every part given a value so that only the drawing is being judged.
    const asWritten = {
      nodes: line.circuit.nodes,
      elements: line.circuit.elements.map((e) => ({ id: e.id, kind: e.kind === 'wire' ? 'wire' : 'resistor', from: e.from, to: e.to, value: 1 })),
    };
    const { errors } = normalizeCircuit(asWritten);
    const real = errors.filter((x) => !/more than|off the grid|nothing drives/.test(x));
    assert(!real.length, network + ': ' + real.join('; '));
  }
});

test('too large to draw clearly is refused rather than crammed in', () => {
  assert(/too large/.test(refused('1 + 2 + 3 + 4 + 5', '9 V')));
  assert(/too large/.test(refused('1 | 2 | 3 | 4 | 5 | 6', '9 V')));
  assert(/too large/.test(refused('(1 + 2) | (3 + 4) | (5 + 6) | 7', '9 V')), 'four stacked branches');
  assert(/more than 8/.test(refused('(1+2+3) | (4+5+6) | (7+8+9)', '9 V')));
});

test('a circuit that ends in parallel branches is drawn as a ladder: rungs between two rails', () => {
  const rails = (line) => [...new Set(line.circuit.nodes.map((n) => n.row))].sort().join();
  const upright = (line, label) => {
    const e = part(line, label);
    const a = line.circuit.nodes.find((n) => n.id === e.from);
    const b = line.circuit.nodes.find((n) => n.id === e.to);
    return a.col === b.col;
  };
  // The meter and its shunt hang side by side from the same two rails.
  const shunt = ok('Rm=99Ω | Rsh=1Ω', '100 mA');
  assert(rails(shunt) === '0,1', 'rows ' + rails(shunt));
  assert(upright(shunt, 'Rm') && upright(shunt, 'Rsh'), 'a rung is lying down');
  // A line: its inductance along the top, its capacitance and the load across.
  const lineModel = ok('L + (C | Load)', 'Vs AC');
  assert(!upright(lineModel, 'L') && upright(lineModel, 'C') && upright(lineModel, 'Load'));
  // A true ladder network: series, shunt, series, shunt.
  const ladder = ok('R1=1Ω + (R2=2Ω | (R3=1Ω + R4=1Ω))', '6 V', { labelB: 'I = 3 A' });
  assert(rails(ladder) === '0,1' && upright(ladder, 'R2') && !upright(ladder, 'R3') && upright(ladder, 'R4'));
  assert(ladder.computed === '3 A', 'the ladder does not solve as written: ' + ladder.computed);
  // Four in parallel fit as rungs where four stacked rows would not.
  assert(ok('1 | 2 | 3 | 4', '9 V').circuit.nodes.every((n) => n.row <= 1));
  // A plain series loop stays a loop, with every part along the top.
  const loop = ok('R + L + C', 'Vs AC');
  assert(!upright(loop, 'R') && !upright(loop, 'L') && !upright(loop, 'C'));
  // And one that is not a ladder - branches of more than one part before the last - is stacked.
  assert(rails(ok('(1 + 2) | (3 + 4) | 5', '9 V')) === '0,1,2,3');
});

test('a switch says whether it is open, and a part whose symbol names it has no second label', () => {
  const line = ok('R=10Ω + SCR + lamp + switch open', '230 V AC');
  const sw = line.circuit.elements.find((e) => e.kind === 'switch');
  assert(sw.open === true && sw.label === '', JSON.stringify(sw));
  assert(!ok('R=10Ω + switch closed', '12 V').circuit.elements.find((e) => e.kind === 'switch').open);
  assert(line.circuit.elements.find((e) => e.kind === 'lamp').label === '' && part(line, 'SCR'), 'labels');
  const meters = ok('A + (V | R=10Ω)', '12 V').circuit.elements.filter((e) => e.kind === 'meter');
  assert(meters.every((m) => m.label === '') && meters.map((m) => m.letter).join() === 'A,V', JSON.stringify(meters));
});

test('labels shrink until none lies on another, and the circuit says when it cannot be made to fit', () => {
  const tight = ok('Req=0.5Ω + Xeq=j1.414Ω + Rload=12.5Ω', '230 V', { mode: 'ac' });
  const fitted = fitCircuit(tight.circuit, 940, 800, 36);
  assert(fitted.fits, 'three parts in a row do not fit at any size');
  const boxes = fitted.layout.elements.map((e) => e.label && e.label.box).filter(Boolean);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      assert(!(a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2), 'two labels overlap at ' + fitted.font + ' px');
    }
  }
  assert(fitCircuit(ok('R + L + C', 'Vs AC').circuit, 940, 800, 36).font === 36, 'a roomy circuit was shrunk');
});

test('what a reviewer is told says each part for what it is', () => {
  const words = ok('Rm=99Ω | Rsh=1Ω?', '100 mA', { labelB: 'I(Rm) = 1 mA' }).words;
  assert(/a DC current source of 100 mA/.test(words), words);
  assert(/a resistor Rm of 99 Ω in parallel with a resistor Rsh of 1 Ω \(shown as "\?" until the answer\)/.test(words), words);
  assert(/solved, it gives I\(Rm\) = 1 mA/.test(words), words);
  assert(/an inductor L, in series with \[a capacitor C in parallel with a load Load\]/.test(ok('L + (C | Load)', 'Vs AC').words), ok('L + (C | Load)', 'Vs AC').words);
});

console.log('\n' + passed + ' checks passed');
