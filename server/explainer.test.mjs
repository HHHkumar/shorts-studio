// Run: node server/explainer.test.mjs
//
// The storyboard normalizer is the gate between a model's imagination and the
// renderer. Everything here is a shape the renderer would otherwise have to
// cope with at draw time: an arrow to a box that does not exist, a comparison
// with one side, a "symbol" that is really a word.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkMotion, MOTION_ACTIONS, normalizePanel, normalizeStoryboard, storyboardBudget } from './explainer.mjs';

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

test('the prompt never asks for two different lengths at once', () => {
  // The regression that made every long explainer come out a third short: a
  // fixed 24 words a scene, then a scene cap, so 300 seconds was requested as
  // 22 x 24 = 528 words - a 203 second script - while the prompt still claimed
  // to want 300. Scenes x words must always land back on the target.
  for (const target of [60, 120, 180, 240, 300, 420, 600]) {
    const b = storyboardBudget(target);
    const implied = (b.scenes * b.wordsPerScene) / 2.6;
    assert.ok(
      Math.abs(implied - b.target) <= b.target * 0.05,
      target + 's target implies a ' + Math.round(implied) + 's script',
    );
  }
});

test('scenes stay long enough to read and short enough to hold', () => {
  for (const target of [60, 180, 300, 600]) {
    const b = storyboardBudget(target);
    const seconds = b.wordsPerScene / 2.6;
    assert.ok(seconds >= 8 && seconds <= 20, target + 's gives ' + seconds.toFixed(1) + 's a scene');
  }
});

test('scene count stays sane at both extremes', () => {
  assert.ok(storyboardBudget(30).scenes >= 6);
  assert.ok(storyboardBudget(6000).scenes <= 36);
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

console.log('\nmotion scenes');

const motion = (over = {}) => normalizePanel({
  title: 'A way over',
  actors: [
    { id: 'fish', icon: 'fish', x: 0.1, y: 0.6 },
    { id: 'dam', icon: 'dam', x: 0.5, y: 0.5 },
  ],
  beats: [{ actor: 'fish', action: 'move', to: 'dam', cue: 'upstream' }],
  ...over,
}, 'motion');

test('a well formed motion scene survives intact', () => {
  const p = motion();
  assert.equal(p.title, 'A way over');
  assert.equal(p.actors.length, 2);
  assert.deepEqual(p.beats[0], { actor: 'fish', action: 'move', to: 'dam', cue: 'upstream' });
});

test('one actor is not a scene, because nothing can act on anything', () => {
  assert.equal(motion({ actors: [{ id: 'fish', icon: 'fish', x: 0.1, y: 0.6 }] }), null);
});

test('actors with nothing happening to them are not a motion scene', () => {
  // A still arrangement is what every other layout already draws, better.
  assert.equal(motion({ beats: [] }), null);
});

test('a verb outside the vocabulary is dropped, not passed on', () => {
  // There is no implementation behind an invented verb, so the renderer would
  // draw a motionless actor and nobody would know why.
  assert.equal(motion({ beats: [{ actor: 'fish', action: 'teleport' }] }), null);
});

test('a beat aimed at an actor that was never declared is dropped', () => {
  assert.equal(motion({ beats: [{ actor: 'otter', action: 'move' }] }), null);
});

test('a target that does not exist is forgotten, but the beat still plays', () => {
  const p = motion({ beats: [{ actor: 'fish', action: 'pulse', to: 'nowhere' }] });
  assert.equal(p.beats[0].to, undefined);
  assert.equal(p.beats[0].action, 'pulse');
});

test('an actor cannot be told to move to itself', () => {
  // That is a zero length journey, which reads on screen as a stall.
  const p = motion({ beats: [{ actor: 'fish', action: 'move', to: 'fish' }] });
  assert.equal(p.beats[0].to, undefined);
});

test('duplicate actor ids are dropped, because beats address them by id', () => {
  const p = motion({
    actors: [
      { id: 'fish', icon: 'fish', x: 0.1, y: 0.6 },
      { id: 'fish', icon: 'shark', x: 0.3, y: 0.6 },
      { id: 'dam', icon: 'dam', x: 0.5, y: 0.5 },
    ],
  });
  assert.deepEqual(p.actors.map((a) => a.id), ['fish', 'dam']);
});

test('coordinates off the frame are pulled back on to it', () => {
  const p = motion({
    actors: [
      { id: 'fish', icon: 'fish', x: -3, y: 0.6 },
      { id: 'dam', icon: 'dam', x: 99, y: 0.5 },
    ],
  });
  assert.equal(p.actors[0].x, 0.04);
  assert.equal(p.actors[1].x, 0.96);
});

test('a missing coordinate lands in the middle, not in the corner', () => {
  const p = motion({
    actors: [
      { id: 'fish', icon: 'fish' },
      { id: 'dam', icon: 'dam', x: 0.5, y: 0.5 },
    ],
  });
  assert.equal(p.actors[0].x, 0.5);
  assert.equal(p.actors[0].y, 0.5);
});

test('an absurd scale is clamped instead of filling the screen', () => {
  const p = motion({
    actors: [
      { id: 'fish', icon: 'fish', x: 0.1, y: 0.6, scale: 40 },
      { id: 'dam', icon: 'dam', x: 0.5, y: 0.5, scale: 0.001 },
    ],
  });
  assert.equal(p.actors[0].scale, 2.5);
  assert.equal(p.actors[1].scale, 0.4);
});

test('the verb list matches the one the renderer implements', () => {
  // The same guard the sketch catalogue has. A verb offered to the model with
  // no case behind it is a scene that silently does nothing, and the only way
  // to notice is to render it and wonder why nothing moved.
  const types = readFileSync(new URL('../src/lib/types.ts', import.meta.url), 'utf8');
  const block = types.slice(types.indexOf('export type MotionAction'));
  const declared = [...block.slice(0, block.indexOf(';')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(declared.slice().sort(), MOTION_ACTIONS.slice().sort());

  // The verbs are implemented in the pure physics module, not the component -
  // the component only draws what that returns.
  const renderer = readFileSync(new URL('../src/lib/motion-physics.ts', import.meta.url), 'utf8');
  for (const verb of MOTION_ACTIONS) {
    assert.ok(renderer.includes("case '" + verb + "'"), 'no case for ' + verb);
    assert.ok(renderer.includes(verb + ': '), 'no duration for ' + verb);
  }
});

test('the layouts offered to the model are the layouts the app knows', () => {
  // These two lists are written separately - the server cannot import the
  // TypeScript one - and a kind present in only one of them fails silently in
  // the worst way: the schema refuses it, the normalizer downgrades it to a
  // plain talking beat, and the result is indistinguishable from the model
  // choosing not to use that layout. That is exactly how `motion` shipped
  // dead the first time.
  const types = readFileSync(new URL('../src/lib/types.ts', import.meta.url), 'utf8');
  const declared = types.slice(types.indexOf('export const EXPLAINER_KINDS'));
  const fromTypes = [...declared.slice(0, declared.indexOf(';')).matchAll(/'([a-z]+)'/g)]
    .map((m) => m[1]);

  const server = readFileSync(new URL('./explainer.mjs', import.meta.url), 'utf8');
  const block = server.slice(server.indexOf('const PANEL_KINDS = ['));
  const fromServer = [...block.slice(0, block.indexOf('];')).matchAll(/'([a-z]+)'/g)]
    .map((m) => m[1]);

  assert.deepEqual(fromServer.slice().sort(), fromTypes.slice().sort());
});

test('every layout offered to the model has a component that draws it', () => {
  const server = readFileSync(new URL('./explainer.mjs', import.meta.url), 'utf8');
  const block = server.slice(server.indexOf('const PANEL_KINDS = ['));
  const kinds = [...block.slice(0, block.indexOf('];')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

  const panel = readFileSync(new URL('../src/remotion/Panel.tsx', import.meta.url), 'utf8');
  const registry = panel.slice(panel.indexOf('export const PANEL_COMPONENTS'));
  for (const kind of kinds) {
    assert.ok(new RegExp('\\n  ' + kind + ':').test(registry), 'nothing draws ' + kind);
  }
});

test('every layout the model may choose is normalized by name', () => {
  // A kind with no branch in normalizePanel returns null, which throws the
  // panel away and leaves a scene that talks but draws nothing.
  const server = readFileSync(new URL('./explainer.mjs', import.meta.url), 'utf8');
  const block = server.slice(server.indexOf('const PANEL_KINDS = ['));
  const kinds = [...block.slice(0, block.indexOf('];')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  for (const kind of kinds) {
    assert.ok(server.includes("kind === '" + kind + "'"), 'no normalizer branch for ' + kind);
  }
});

console.log('\nthe worked example in the prompt');

// The example is the highest-leverage part of the motion instructions: a model
// copies its shape far more faithfully than it follows prose rules. So the
// example itself is checked, with the same validator that judges real output.
// If someone rewrites the narration in the prompt and forgets the cues, this
// fails rather than quietly teaching every future video the mistake.
const EXAMPLE_NARRATION =
  'A salmon heading upstream meets a wall of concrete it has no way over, and the whole run '
  + 'collapses behind it. Cut a fish ladder into the side and the salmon climbs it in shallow '
  + 'steps, one at a time, until it is past.';

const EXAMPLE_CUES = ['upstream', 'wall of concrete', 'fish ladder', 'climbs'];

test('the example narration is still the one written in the prompt', () => {
  const src = readFileSync(new URL('./explainer.mjs', import.meta.url), 'utf8');
  // The prompt wraps it across lines, so compare on the distinctive fragments.
  for (const fragment of ['A salmon heading upstream meets a wall of concrete',
    'Cut a fish ladder into the side', 'until it is past']) {
    assert.ok(src.includes(fragment), 'prompt no longer contains: ' + fragment);
  }
});

test('every cue in the example really is in the example narration', () => {
  const c = {
    script: [{
      kind: 'motion',
      narration: EXAMPLE_NARRATION,
      panel: {
        actors: [
          { id: 'fish', icon: 'fish', x: 0.12, y: 0.62 },
          { id: 'dam', icon: 'dam', x: 0.52, y: 0.55 },
          { id: 'ladder', icon: 'stairs', x: 0.78, y: 0.42, hidden: true },
        ],
        beats: [
          { actor: 'fish', action: 'move', to: 'dam', cue: EXAMPLE_CUES[0] },
          { actor: 'fish', action: 'blocked', to: 'dam', cue: EXAMPLE_CUES[1] },
          { actor: 'ladder', action: 'appear', cue: EXAMPLE_CUES[2] },
          { actor: 'fish', action: 'climb', to: 'ladder', cue: EXAMPLE_CUES[3] },
        ],
      },
    }],
  };
  assert.deepEqual(checkMotion(c), []);
});

test('the example survives the normalizer it is teaching the model to satisfy', () => {
  const p = normalizePanel({
    actors: [
      { id: 'fish', icon: 'fish', x: 0.12, y: 0.62, accent: true },
      { id: 'dam', icon: 'dam', x: 0.52, y: 0.55, scale: 1.4 },
      { id: 'ladder', icon: 'stairs', x: 0.78, y: 0.42, hidden: true },
    ],
    beats: [
      { actor: 'fish', action: 'move', to: 'dam', cue: 'upstream' },
      { actor: 'fish', action: 'blocked', to: 'dam', cue: 'wall of concrete' },
      { actor: 'ladder', action: 'appear', cue: 'fish ladder' },
      { actor: 'fish', action: 'climb', to: 'ladder', cue: 'climbs' },
    ],
  }, 'motion');
  assert.ok(p, 'the example the model is shown must not be thrown away');
  assert.equal(p.actors.length, 3);
  assert.equal(p.beats.length, 4);
});

console.log('\nwarnings on a freshly written storyboard');

test('a cue the narration never says is reported', () => {
  const notes = checkMotion({
    script: [{
      kind: 'motion',
      narration: 'A salmon swims upstream and then the whole run collapses behind it.',
      panel: {
        actors: [{ id: 'a', icon: 'fish', x: 0.1, y: 0.5 }, { id: 'b', icon: 'dam', x: 0.6, y: 0.5 }],
        beats: [{ actor: 'a', action: 'move', to: 'b', cue: 'concrete wall' }],
      },
    }],
  });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /never says/);
});

test('a beat with no cue at all is reported', () => {
  const notes = checkMotion({
    script: [{
      kind: 'motion',
      narration: 'A salmon swims upstream and then the whole run collapses behind it.',
      panel: {
        actors: [{ id: 'a', icon: 'fish', x: 0.1, y: 0.5 }, { id: 'b', icon: 'dam', x: 0.6, y: 0.5 }],
        beats: [{ actor: 'a', action: 'pulse' }],
      },
    }],
  });
  assert.match(notes.join(' '), /no cue/);
});

test('two visible actors on the same spot are reported', () => {
  const notes = checkMotion({
    script: [{
      kind: 'motion',
      narration: 'A salmon swims upstream and then the whole run collapses behind it.',
      panel: {
        actors: [{ id: 'a', icon: 'fish', x: 0.5, y: 0.5 }, { id: 'b', icon: 'dam', x: 0.52, y: 0.5 }],
        beats: [{ actor: 'a', action: 'move', to: 'b', cue: 'upstream' }],
      },
    }],
  });
  assert.match(notes.join(' '), /on top of each other/);
});

test('a hidden actor may share a spot, because it arrives later', () => {
  const notes = checkMotion({
    script: [{
      kind: 'motion',
      narration: 'A salmon swims upstream and then the whole run collapses behind it.',
      panel: {
        actors: [
          { id: 'a', icon: 'fish', x: 0.5, y: 0.5 },
          { id: 'b', icon: 'stairs', x: 0.5, y: 0.5, hidden: true },
        ],
        beats: [{ actor: 'a', action: 'move', to: 'b', cue: 'upstream' }],
      },
    }],
  });
  assert.equal(notes.length, 0, notes.join(' '));
});

test('a beat cued on the last few words is reported as unwatchable', () => {
  const notes = checkMotion({
    script: [{
      kind: 'motion',
      narration: 'The salmon meets the dam and the whole run finally collapses.',
      panel: {
        actors: [{ id: 'a', icon: 'fish', x: 0.1, y: 0.5 }, { id: 'b', icon: 'dam', x: 0.6, y: 0.5 }],
        beats: [{ actor: 'a', action: 'blocked', to: 'b', cue: 'collapses' }],
      },
    }],
  });
  assert.match(notes.join(' '), /barely be seen/);
});

test('scenes that are not motion are left alone', () => {
  assert.deepEqual(checkMotion({ script: [{ kind: 'diagram', narration: 'x', panel: { nodes: [] } }] }), []);
  assert.deepEqual(checkMotion({}), []);
  assert.deepEqual(checkMotion(null), []);
});

console.log('\nartwork in the ordinary layouts');

test('a diagram box keeps the noun the server will look up', () => {
  const p = normalizePanel({
    nodes: [{ id: 'b', label: 'Boiler', icon: 'boiler' }, { id: 't', label: 'Turbine', icon: 'wind turbine' }],
    edges: [{ from: 'b', to: 't' }],
  }, 'diagram');
  assert.deepEqual(p.nodes.map((n) => n.icon), ['boiler', 'wind turbine']);
});

test('a process step keeps its noun too', () => {
  const p = normalizePanel({
    steps: [{ label: 'Boil it', icon: 'boiler' }, { label: 'Spin it', icon: 'turbine' }],
  }, 'process');
  assert.deepEqual(p.steps.map((s) => s.icon), ['boiler', 'turbine']);
});

test('a sentence offered as an icon is dropped, because it finds nothing', () => {
  // "boiler" finds a picture; "the place where water becomes steam" does not,
  // and would cost two network calls to discover that.
  const long = 'the place in the plant where the water actually becomes steam';
  const p = normalizePanel({ steps: [{ label: 'Boil', icon: long }] }, 'grid');
  assert.ok(!p || !p.steps[0].icon || p.steps[0].icon.length <= 32);
});

test('a layout with no icons still works, since they are optional', () => {
  const p = normalizePanel({ steps: [{ label: 'One' }, { label: 'Two' }] }, 'process');
  assert.equal(p.steps.length, 2);
  assert.equal(p.steps[0].icon, undefined);
});

console.log('\n' + passed + ' checks passed\n');
