// Run: node server/claude.test.mjs
//
// The schema translation is the load-bearing part of the Claude path. The quiz
// and storyboard schemas are written in Gemini's dialect and are long; keeping
// a second hand-written copy for Claude would drift the first time either
// prompt changed. So they are translated, and this checks the translation
// against the real schemas rather than a toy one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toJsonSchema, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from './claude.mjs';

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

console.log('\ntranslating Gemini schemas to JSON Schema');

test('type names are lowercased', () => {
  assert.equal(toJsonSchema({ type: 'OBJECT', properties: {} }).type, 'object');
  assert.equal(toJsonSchema({ type: 'STRING' }).type, 'string');
  assert.equal(toJsonSchema({ type: 'INTEGER' }).type, 'integer');
  assert.equal(toJsonSchema({ type: 'BOOLEAN' }).type, 'boolean');
  assert.equal(toJsonSchema({ type: 'ARRAY', items: { type: 'STRING' } }).type, 'array');
});

test('arrays carry their item type', () => {
  const out = toJsonSchema({ type: 'ARRAY', items: { type: 'STRING' } });
  assert.equal(out.items.type, 'string');
});

test('nesting survives to the bottom', () => {
  const out = toJsonSchema({
    type: 'OBJECT',
    properties: {
      script: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { kind: { type: 'STRING', enum: ['a', 'b'] } } },
      },
    },
  });
  assert.equal(out.properties.script.items.properties.kind.type, 'string');
  assert.deepEqual(out.properties.script.items.properties.kind.enum, ['a', 'b']);
});

test('objects are closed, so the model cannot invent fields', () => {
  const out = toJsonSchema({ type: 'OBJECT', properties: { a: { type: 'STRING' } } });
  assert.equal(out.additionalProperties, false);
});

test('descriptions are kept, because they are prompt', () => {
  const out = toJsonSchema({ type: 'STRING', description: 'The short line on screen.' });
  assert.equal(out.description, 'The short line on screen.');
});

test('junk in gives a string out rather than throwing', () => {
  assert.equal(toJsonSchema(null).type, 'string');
  assert.equal(toJsonSchema(undefined).type, 'string');
  assert.equal(toJsonSchema('nonsense').type, 'string');
});

console.log('\nagainst the schemas actually in use');

// Read them as text rather than importing, because gemini.mjs reaches the
// network at import time in some paths and this test must stay offline.
const geminiSrc = readFileSync(new URL('./gemini.mjs', import.meta.url), 'utf8');
const explainerSrc = readFileSync(new URL('./explainer.mjs', import.meta.url), 'utf8');

test('both real schemas exist and use the Gemini dialect', () => {
  assert.ok(/const RESPONSE_SCHEMA = \{/.test(geminiSrc), 'quiz schema missing');
  assert.ok(/const RESPONSE_SCHEMA = \{/.test(explainerSrc), 'storyboard schema missing');
  assert.ok(/type: 'OBJECT'/.test(geminiSrc) && /type: 'OBJECT'/.test(explainerSrc));
});

test('every Gemini type name in them has a translation', () => {
  const used = new Set([
    ...[...geminiSrc.matchAll(/type: '([A-Z]+)'/g)].map((m) => m[1]),
    ...[...explainerSrc.matchAll(/type: '([A-Z]+)'/g)].map((m) => m[1]),
  ]);
  const known = new Set(['OBJECT', 'STRING', 'ARRAY', 'INTEGER', 'NUMBER', 'BOOLEAN']);
  const unknown = [...used].filter((t) => !known.has(t));
  assert.deepEqual(unknown, [], 'untranslated type: ' + unknown.join(', '));
});

test('a deep storyboard-shaped schema translates whole', () => {
  const panel = {
    type: 'OBJECT',
    properties: {
      nodes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { id: { type: 'STRING' }, col: { type: 'INTEGER' } },
          required: ['id'],
        },
      },
      dashed: { type: 'BOOLEAN' },
    },
  };
  const out = toJsonSchema({
    type: 'OBJECT',
    properties: { script: { type: 'ARRAY', items: { type: 'OBJECT', properties: { panel } } } },
  });
  const node = out.properties.script.items.properties.panel.properties.nodes.items;
  assert.equal(node.properties.col.type, 'integer');
  assert.equal(node.additionalProperties, false);
  assert.ok(Array.isArray(node.required) && node.required.includes('id'));
});

console.log('\nmodel list');

test('the fallback list is not empty and the default is in it', () => {
  assert.ok(CLAUDE_MODELS.length >= 1);
  assert.ok(CLAUDE_MODELS.some((m) => m.id === DEFAULT_CLAUDE_MODEL), DEFAULT_CLAUDE_MODEL);
});

test('no model id carries a date suffix', () => {
  // Date-suffixed ids are a stale-training-data habit and 404 against the API.
  for (const m of CLAUDE_MODELS) {
    assert.ok(!/-\d{8}$/.test(m.id), m.id + ' looks date-suffixed');
  }
});

console.log('\n' + passed + ' checks passed\n');
