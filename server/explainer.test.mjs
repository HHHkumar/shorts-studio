// Run: node server/explainer.test.mjs
//
// The storyboard normalizer is the gate between a model's imagination and the
// renderer. Everything here is a shape the renderer would otherwise have to
// cope with at draw time: an arrow to a box that does not exist, a comparison
// with one side, a "symbol" that is really a word.

import assert from 'node:assert/strict';
import { normalizePanel, normalizeStoryboard, storyboardBudget } from './explainer.mjs';

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

console.log('\nstoryboard budget');

test('a four minute explainer asks for a script that is actually four minutes', () => {
  const b = storyboardBudget(240);
  assert.equal(b.target, 240);
  // 2.6 words a second is the measured rate of the voice we use.
  assert.equal(b.totalWords, 624);
  assert.ok(b.scenes >= 20, 'expected plenty of scenes, got ' + b.scenes);
});

test('scene count stays sane at both extremes', () => {
  assert.ok(storyboardBudget(30).scenes >= 6);
  assert.ok(storyboardBudget(6000).scenes <= 22);
});

console.log('\npanels');

test('a diagram edge pointing at a box that does not exist is dropped', () => {
  const panel = normalizePanel({
    nodes: [{ id: 'a', label: 'Boiler' }, { id: 'b', label: 'Turbine' }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'ghost' }],
  }, 'diagram');
  assert.equal(panel.edges.length, 1);
  assert.equal(panel.edges[0].to, 'b');
});

test('an edge from a box to itself is dropped', () => {
  const panel = normalizePanel({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ from: 'a', to: 'a' }],
  }, 'diagram');
  assert.equal(panel.edges.length, 0);
});

test('a diagram with one box is not a diagram', () => {
  assert.equal(normalizePanel({ nodes: [{ id: 'a', label: 'Alone' }] }, 'diagram'), null);
});

test('duplicate node ids are dropped, because edges address them by id', () => {
  const panel = normalizePanel({
    nodes: [{ id: 'a', label: 'First' }, { id: 'a', label: 'Second' }, { id: 'b', label: 'Third' }],
  }, 'diagram');
  assert.deepEqual(panel.nodes.map((n) => n.label), ['First', 'Third']);
});

test('a metaphor with only one side is refused', () => {
  assert.equal(normalizePanel({ leftLabel: 'Water in a pipe' }, 'metaphor'), null);
});

test('a versus table is trimmed to the shorter column', () => {
  const panel = normalizePanel({
    leftLabel: 'AC',
    rightLabel: 'DC',
    leftPoints: ['Reverses direction', 'Easy to transform', 'Used in the grid'],
    rightPoints: ['Flows one way'],
  }, 'versus');
  // A row with one half missing reads as an omission, not a comparison.
  assert.equal(panel.leftPoints.length, 1);
  assert.equal(panel.rightPoints.length, 1);
});

test('a versus with no points on one side is refused', () => {
  assert.equal(
    normalizePanel({ leftLabel: 'AC', rightLabel: 'DC', leftPoints: ['x'] }, 'versus'),
    null,
  );
});

test('a word offered as a symbol is dropped, not drawn at 70px', () => {
  const panel = normalizePanel({
    leftLabel: 'Pipe', rightLabel: 'Wire',
    leftSymbol: 'water', rightSymbol: '⚡',
    leftPoints: ['a'], rightPoints: ['b'],
  }, 'metaphor');
  assert.equal(panel.leftSymbol, '');
  assert.equal(panel.rightSymbol, '⚡');
});

test('a process needs at least two steps to be a process', () => {
  assert.equal(normalizePanel({ steps: [{ label: 'Only one' }] }, 'process'), null);
  assert.ok(normalizePanel({ steps: [{ label: 'One' }, { label: 'Two' }] }, 'process'));
});

test('node positions are clamped to the grid the renderer lays out', () => {
  const panel = normalizePanel({
    nodes: [{ id: 'a', label: 'A', col: 99, row: -4 }, { id: 'b', label: 'B' }],
  }, 'diagram');
  assert.equal(panel.nodes[0].col, 5);
  assert.equal(panel.nodes[0].row, 0);
  // An unpositioned node stays unpositioned so the flow layout can place it.
  assert.equal(panel.nodes[1].col, undefined);
});

console.log('\nstoryboard');

const storyboard = (over = {}) => ({
  topic: 'How a transformer works',
  question: 'How does a transformer change voltage?',
  hook: 'It has no moving parts and it runs the entire grid.',
  outro: 'Subscribe for more.',
  hashtags: ['electrical', '#power'],
  motifSymbols: ['⚡', 'transformer'],
  script: [
    { kind: 'title', narration: 'How does a transformer work?', panel: { title: 'How a transformer works' } },
    {
      kind: 'metaphor',
      narration: 'Think of a gear pair, then think of a transformer.',
      panel: { leftLabel: 'Gear pair', rightLabel: 'Transformer', leftPoints: ['x'], rightPoints: ['y'] },
    },
    { kind: 'recap', narration: 'So remember two things.', panel: { steps: [{ label: 'Turns ratio' }] } },
    { kind: 'outro', narration: 'Thanks for watching.' },
  ],
  ...over,
});

test('an explainer fills the same content shape the rest of the app speaks', () => {
  const c = normalizeStoryboard(storyboard(), { subject: 'Electrical Machines' });
  assert.equal(c.videoKind, 'explainer');
  assert.equal(c.subject, 'Electrical Machines');
  // No quiz in it, but the fields exist so nothing downstream has to branch.
  assert.deepEqual(c.options, []);
  assert.equal(c.answerLine, '');
  assert.equal(c.script.length, 4);
});

test('a layout scene with nothing to lay out becomes a plain talking beat', () => {
  const c = normalizeStoryboard(storyboard({
    script: [
      { kind: 'diagram', narration: 'Here is the thing.', panel: { nodes: [{ id: 'a', label: 'Alone' }] } },
      { kind: 'outro', narration: 'Bye.' },
    ],
  }), {});
  // Better a clean talking scene than an empty frame with a subtitle under it.
  assert.equal(c.script[0].kind, 'explain');
  assert.equal(c.script[0].panel, undefined);
});

test('an unknown scene kind degrades to explain rather than throwing', () => {
  const c = normalizeStoryboard(storyboard({
    script: [{ kind: 'interpretive-dance', narration: 'Watch this.' }],
  }), {});
  assert.equal(c.script[0].kind, 'explain');
});

test('the creator greeting is inserted first, exactly as typed', () => {
  const c = normalizeStoryboard(storyboard(), { intro: "Hi, it's Hemanth here." });
  assert.equal(c.script[0].kind, 'intro');
  assert.equal(c.script[0].narration, "Hi, it's Hemanth here.");
});

test('the outro is moved to the end wherever the model put it', () => {
  const c = normalizeStoryboard(storyboard({
    script: [
      { kind: 'outro', narration: 'Thanks for watching.' },
      { kind: 'title', narration: 'How it works.', panel: { title: 'How it works' } },
    ],
  }), {});
  assert.equal(c.script[c.script.length - 1].kind, 'outro');
});

test('hashtags gain their hash and motif words that are not symbols are dropped', () => {
  const c = normalizeStoryboard(storyboard(), {});
  assert.deepEqual(c.hashtags, ['#electrical', '#power']);
  assert.deepEqual(c.motifSymbols, ['⚡']);
});

test('a storyboard with no usable scenes fails loudly instead of rendering blank', () => {
  assert.throws(() => normalizeStoryboard({ script: [{ kind: 'title', narration: '' }] }, {}), /no scenes/i);
});

test('markdown in narration is stripped, because it would be read aloud', () => {
  const c = normalizeStoryboard(storyboard({
    script: [{ kind: 'explain', narration: 'This is **really** important.' }],
  }), {});
  assert.equal(c.script[0].narration, 'This is really important.');
});

console.log('\n' + passed + ' checks passed\n');
