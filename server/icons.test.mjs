// Run: node server/icons.test.mjs
//
// Offline on purpose. Everything here is about what happens to a noun on its
// way to becoming a shape, and to third-party markup on its way into the DOM -
// neither of which should need the network to check.

import assert from 'node:assert/strict';
import { sanitizeBody, searchTerm } from './icons.mjs';

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

console.log('\nturning a noun into a search');

test('a plain noun is left alone', () => {
  assert.equal(searchTerm('fish'), 'fish');
});

test('case and punctuation are flattened', () => {
  assert.equal(searchTerm('Fish!'), 'fish');
  assert.equal(searchTerm('  Wind Turbine  '), 'wind turbine');
});

test('articles and vague adjectives are dropped', () => {
  // "a big fish" and "fish" should find the same picture; nothing in an icon
  // set is indexed under "big".
  assert.equal(searchTerm('a big fish'), 'fish');
  assert.equal(searchTerm('the large dam'), 'dam');
});

test('a long phrase is cut to something searchable', () => {
  // A model that writes a sentence here would otherwise match nothing at all.
  assert.equal(searchTerm('a salmon swimming upstream towards the dam').split(' ').length, 3);
});

test('junk gives an empty term rather than throwing', () => {
  assert.equal(searchTerm(''), '');
  assert.equal(searchTerm(null), '');
  assert.equal(searchTerm('!!!'), '');
});

console.log('\nsanitising third-party markup');

test('ordinary drawing survives untouched', () => {
  const body = '<path fill="currentColor" d="M12 20l.76-3z"/>';
  assert.equal(sanitizeBody(body), body);
});

test('groups and their attributes survive', () => {
  const body = '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M11 11"/></g>';
  assert.equal(sanitizeBody(body), body);
});

test('a script tag is removed', () => {
  assert.equal(sanitizeBody('<script>steal()</script><path d="M0"/>'), '<path d="M0"/>');
});

test('an event handler is removed but the shape is kept', () => {
  assert.equal(sanitizeBody('<path onclick="bad()" d="M1"/>'), '<path d="M1"/>');
  assert.equal(sanitizeBody('<path onload=bad() d="M1"/>'), '<path d="M1"/>');
});

test('a link out of the document is removed', () => {
  assert.ok(!sanitizeBody('<a href="http://evil.test"><path/></a>').includes('evil.test'));
});

test('a same-document reference is kept, because gradients need it', () => {
  const body = '<path fill="url(#g)" href="#g"/>';
  assert.equal(sanitizeBody(body), body);
});

test('an external image is removed', () => {
  assert.equal(sanitizeBody('<image href="http://evil.test/x.png"/>'), '');
});

test('a javascript: url does not survive in any form', () => {
  assert.ok(!sanitizeBody('<path fill="javascript:bad()"/>').includes('javascript:'));
});

test('junk in gives a string out rather than throwing', () => {
  assert.equal(sanitizeBody(null), '');
  assert.equal(sanitizeBody(undefined), '');
});

console.log('\n' + passed + ' checks passed\n');
