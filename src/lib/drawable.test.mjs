// Run: node src/lib/drawable.test.mjs
//
// What an image model may draw for a doodle scene. Every direction below was
// written by Gemini for a video in the library and drawn without anybody
// checking it - they are the cases this rule exists for.

import { drawnText, judgeDrawing, settleDirection, TECHNICAL_WORDS } from './drawable.ts';
import { allKinds, EQUIPMENT, equipmentId, findEquipment, isEquipmentId } from './equipment.ts';

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
const judge = (text, approved = []) => judgeDrawing(text, approved);

console.log('\neveryday things are drawn');

const EVERYDAY = [
  'a light bulb',
  'a pipe junction with water rushing in from two sides and forming a swirl in the center. water pipes, junction fitting. a tiny rubber duck caught spinning in the whirlpool',
  'four copper wires, junction box. one of the wires is twisted into a neat pretzel shape',
  'three stopwatches side by side vibrating with cartoon motion lines. three stopwatches',
  'a glowing light bulb, a battery. drawn confetti bursts outward around the light bulb',
  'an hourglass rapidly draining sand beside a tightly wound copper coil. hourglass, copper coil',
  'an oversized round wall clock. the hands on the clock spin backward in a blur',
  'two widely spaced parallel overhead wires. a tiny measurement ruler stretched taut between the two wires',
  'a ticking metronome with a swinging pendulum counting down between two coils of wire. a metronome, two coils of wire',
  'a small test battery, two terminal clips, a glowing light bulb. test battery flexing tiny cartoon biceps',
  'an hourglass with glowing electrical sparks tumbling rapidly between the glass bulbs. hourglass, electrical sparks',
  'a wobbly mechanical seesaw teetering precariously over a sharp central pivot with weights on both arms. a seesaw, lead weights, a pivot',
  'an archery target board with an arrow in the bullseye',
  'four simple balance scales side-by-side holding various sizes of electric battery cells and weights. four balance scales, miniature weights',
  'a classic mechanical stopwatch swinging gently from a cord like a pendulum beside a burning candle. a stopwatch, a cord, a candle',
  'two light bulbs on a wooden stand. one light bulb has tiny spark doodles zapping out of it',
  'a blank whiteboard easel',
  'a spiral notepad, a pencil. the pencil has an excessively chewed eraser',
  'a large question mark. question mark wearing a tiny party hat',
  'an electrical coil, a giant thumbs-up icon',
];

test('a light bulb, an hourglass, water in pipes and a seesaw are drawn as before', () => {
  for (const text of EVERYDAY) {
    const v = judge(text);
    assert(v.outcome === 'draw', '"' + text.slice(0, 60) + '" was refused: ' + v.why);
  }
});

console.log('\nanything that states a fact is not');

const FACTS = [
  ['a diamond-shaped dependent source and a circular independent source surrounded by floating question marks. a diamond source symbol, a circular source symbol', 'symbol'],
  ['a closed circuit box with two terminals', 'circuit'],
  ['four diverging schematic wire paths', 'circuit'],
  ['a rolled-out blueprint sheet', 'circuit'],
  ['a test battery connected to two terminal posts', 'connection'],
  ['a circuit loop showing a diamond-shaped source and a circular battery under a large spotlight', 'circuit'],
  ['four separate pathway diagrams showing open switches, shorting jumper wires, and testing probes', ''],
  ['four separate panels showing spaced parallel wires, an ultra-thin wire, a raincloud, and a rough knobby cable', 'panels'],
  ['a resonant frequency bell curve drawing', 'graph'],
  ['a tall spiky bell curve next to a wide flat curve, with horizontal arrows comparing their widths', 'graph'],
  ['two mechanical vise clamps squeezing the flanks of a bell curve, forcing the center upward', 'graph'],
  ['four separate panels showing different combinations of upward and downward arrows beside circuit switches. switches, arrows', ''],
  ['a single shining bulb on the left side and a neat grid of ten identical bulbs on the right. light bulbs, connecting wires', ''],
  ['four blank diagram boxes', 'diagram'],
  ['a magnet with curved field lines looping from one end to the other', 'field'],
  ['a compass with a red arrow pointing left', 'arrows'],
  ['a row of seven identical light bulbs', 'count'],
  ['a cutaway of a battery showing its layers', 'inside'],
];

test('a circuit, a curve, a symbol, field lines, arrows, panels and exact counts are refused, and say why', () => {
  for (const [text, expect] of FACTS) {
    const v = judge(text);
    assert(v.outcome === 'none', '"' + text.slice(0, 60) + '" would be drawn');
    assert(v.why.includes(expect), '"' + text.slice(0, 50) + '" was refused for "' + v.why + '", expected ' + expect);
  }
});

console.log('\nequipment is only ever an approved drawing');

const EQUIPMENT_SCENES = [
  ['a transmission tower', 'transmission-tower'],
  ['overhead transmission lines suspended on steel lattice towers glowing with faint aura rings around the cables. transmission towers, overhead cables', 'transmission-tower'],
  ['an analog meter', 'analog-meter'],
  ['a tiny delicate analog meter vibrating violently as cartoon lightning bolts strike its wire terminals', 'analog-meter'],
  ['a galvanometer', 'analog-meter'],
  ['a workbench, an analog wattmeter', 'analog-meter'],
  ['a DC motor coupled by a pulley to a hanging heavy iron weight. a motor, a pulley, an iron weight', 'motor'],
  ['thyristor', 'thyristor'],
  ['an electrical energy meter with spinning disc', 'energy-meter'],
  ['four resistor coils. one resistor coil is stretched out and tangled like an unruly slinky', 'resistor'],
  ['a coil of wire and a capacitor', 'capacitor'],
  ['a glowing hot heating coil radiating heat waves next to an inductor coil sitting cool', 'inductor'],
  ['a step-down transformer on a pole with thick wires in and thin wires out', 'pole-transformer'],
];

test('with nothing approved, a scene that names equipment gets no picture, and says what is missing', () => {
  for (const [text, id] of EQUIPMENT_SCENES) {
    const v = judge(text);
    assert(v.outcome === 'none', '"' + text.slice(0, 50) + '" would be drawn by an image model');
    assert(v.wanted.includes(id), '"' + text.slice(0, 50) + '" wants ' + JSON.stringify(v.wanted) + ', expected ' + id);
  }
  assert(/no drawing of one has been approved/.test(judge('an analog meter').why), judge('an analog meter').why);
});

test('once a kind is approved, the scene shows that drawing', () => {
  for (const [text, id] of EQUIPMENT_SCENES) {
    const v = judge(text, [id]);
    assert(v.outcome === 'approved' && v.equipment === id, '"' + text.slice(0, 50) + '" -> ' + v.outcome + ' ' + v.equipment);
  }
});

test('an approved drawing wins even when the words went on to ask for a connection', () => {
  const hookup = 'a transformer connected with test leads to an analog ammeter and wattmeter with quivering needles';
  assert(judge(hookup).outcome === 'none');
  const v = judge(hookup, ['transformer']);
  assert(v.outcome === 'approved' && v.equipment === 'transformer');
  assert(v.wanted.includes('analog-meter'), 'the meter it also named is not on the list of what is missing');
  // The first approved kind it names, not the first kind.
  assert(judge(hookup, ['analog-meter']).equipment === 'analog-meter');
});

test('parts with no drawing in the catalogue are refused by name, so they can be added', () => {
  const v = judge('a motor rotor spinning rapidly with motion swooshes surrounded by shrinking magnetic coils');
  assert(v.outcome === 'none' && v.wanted.includes('motor') && v.wanted.includes('rotor'), JSON.stringify(v));
  const core = judge('transformer core with wire windings');
  assert(core.outcome === 'none' && core.wanted.includes('transformer core') && core.wanted.includes('winding'), JSON.stringify(core.wanted));
  assert(!core.wanted.includes('transformer'), 'the longer name did not take the words from the shorter');
});

test('the longest name wins: a transformer on a pole is not a power transformer', () => {
  const found = findEquipment('a current reading taken at a transformer on a pole beside a circuit breaker').map((f) => f.id);
  assert(found.join() === 'pole-transformer,circuit-breaker', found.join());
  assert(findEquipment('a metronome and a thermometer, metered out').length === 0, 'a word inside a word was taken for a meter');
  assert(findEquipment('two bus-bars and three MCBs').map((f) => f.id).join() === 'busbar,mcb');
});

console.log('\nthe catalogue');

test('every kind has an id, words, a brief and a checklist, and no two share a word', () => {
  const seen = new Map();
  for (const k of EQUIPMENT) {
    assert(isEquipmentId(k.id), k.id + ' is not a usable id');
    assert(k.name && k.words.length && k.draw.length > 60 && k.check.length > 15, k.id + ' is incomplete');
    assert(!/["\n]/.test(k.draw), k.id + ' has a quote or a line break in its brief');
    for (const w of k.words) {
      assert(w === w.toLowerCase(), k.id + ': "' + w + '" is not lower case');
      assert(!seen.has(w), '"' + w + '" is claimed by ' + seen.get(w) + ' and ' + k.id);
      seen.set(w, k.id);
    }
  }
  assert(new Set(EQUIPMENT.map((k) => k.id)).size === EQUIPMENT.length, 'two kinds share an id');
});

test('no brief asks for something the rule itself would refuse to draw', () => {
  // A brief is a picture of one thing: no lettering, no readings, no counts an image model must get right beyond the checklist.
  for (const k of EQUIPMENT) {
    assert(!/\b(label|labelled|text|letters?|numbers? on|reading of|arrow)\b/i.test(k.draw), k.id + ' asks for lettering or arrows');
  }
});

test('a technical word that becomes a kind stops being a bare word', () => {
  const kinds = allKinds([{ id: 'stator', name: 'Stator', words: ['stator'], draw: 'a stator', check: '' }]);
  const before = judgeDrawing('a stator with its slots', []);
  assert(before.outcome === 'none' && before.wanted.includes('stator'));
  const after = judgeDrawing('a stator with its slots', ['stator'], kinds);
  assert(after.outcome === 'approved' && after.equipment === 'stator', JSON.stringify(after));
  assert(TECHNICAL_WORDS.includes('stator'));
  assert(equipmentId('Buchholz relay!') === 'buchholz-relay' && equipmentId('***') === '');
});

console.log('\nwhat a scene becomes');

const ill = (action, props = '', gag = 'none') => ({ subject: 'illustration', action, emotion: 'busy', props, gag });
const mascot = (props, gag = 'none') => ({ subject: 'mascot', pose: 'point', action: 'points at the bench', emotion: 'curious', props, gag });

test('an illustration that may not be drawn becomes the engineer explaining, with the reason', () => {
  const out = settleDirection(ill('two wattmeters connected in parallel to three supply lines, one needle resting dead at zero'), { pose: 'teach' });
  assert(out.direction.subject === 'mascot' && out.direction.pose === 'teach' && out.direction.props === '', JSON.stringify(out.direction));
  assert(!/wattmeter/.test(out.direction.action), 'the engineer was still told about the wattmeters');
  assert(/illustration asked for/.test(out.note) && /engineer explains/.test(out.note), out.note);
});

test('the animated engineer keeps his pose and loses only what stood beside him', () => {
  const out = settleDirection(mascot('a closed circuit box with two terminals', 'the box is winking'));
  assert(out.direction.subject === 'mascot' && out.direction.pose === 'point' && out.direction.action === 'points at the bench');
  assert(out.direction.props === '' && out.direction.gag === 'none', JSON.stringify(out.direction));
  assert(/beside the engineer asked for a circuit/.test(out.note), out.note);
});

test('an everyday scene, and an engineer with nothing beside him, are left exactly as written', () => {
  const bulb = mascot('a glowing light bulb, a battery');
  assert(settleDirection(bulb).direction === bulb && settleDirection(bulb).note === '');
  const bare = mascot('');
  assert(settleDirection(bare).direction === bare);
  const pipes = ill('water rushing through a pipe junction', 'water pipes');
  assert(settleDirection(pipes).direction === pipes);
});

test('approved equipment is shown: beside the animated engineer, or as the picture itself', () => {
  const beside = settleDirection(mascot('an analog meter'), { approved: ['analog-meter'] });
  assert(beside.equipment === 'analog-meter' && beside.direction.subject === 'mascot' && beside.note === '');
  const picture = settleDirection(ill('a DC motor coupled by a pulley to a hanging weight'), { approved: ['motor'] });
  assert(picture.equipment === 'motor' && picture.direction.subject === 'illustration');
  // With the animation off he would have to be drawn in beside it, so the approved drawing is the scene.
  const still = settleDirection(mascot('an analog meter'), { approved: ['analog-meter'], animated: false });
  assert(still.equipment === 'analog-meter' && still.direction.subject === 'illustration', JSON.stringify(still.direction));
});

test('a still of the engineer is judged on what he is doing as well', () => {
  const d = { subject: 'mascot', action: 'points at a transformer on a pole', emotion: 'curious', props: '', gag: 'none' };
  assert(drawnText(d, true) === '' && settleDirection(d, { animated: true }).direction === d, 'the animated engineer was judged on words that are never drawn');
  const still = settleDirection(d, { animated: false });
  assert(still.direction.action !== d.action && still.wanted.includes('pole-transformer'), JSON.stringify(still));
});

test('a person who asks for it by name gets it drawn, and it is theirs to judge', () => {
  const d = ill('a circuit loop with a battery and a lamp');
  assert(settleDirection(d, { forced: true }).direction === d);
  // Forcing never replaces an approved drawing with a fresh one.
  assert(settleDirection(ill('a motor'), { forced: true, approved: ['motor'] }).equipment === 'motor');
});

console.log('\n' + passed + ' checks passed');
