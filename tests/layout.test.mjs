import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDetails, wrapText } from '../js/pdf/layout.js';

const fakePainter = { measure: (t) => t.length * 5 };

test('parses bullets, numbered lists, paragraphs and gaps', () => {
  const b = parseDetails('Intro line\n\n- first\n• second\n* third\n1. step one\n2) step two\n\n\nTail');
  assert.deepEqual(b.map((x) => x.type), ['p', 'gap', 'bullet', 'bullet', 'bullet', 'num', 'num', 'gap', 'p']);
  assert.equal(b[5].label, '1.');
  assert.equal(b[6].label, '2.');
  assert.equal(b[2].text, 'first');
  assert.deepEqual(parseDetails('  \n\n'), []);
});

test('wraps words within width and breaks long words', () => {
  assert.deepEqual(wrapText(fakePainter, 'one two three four', 45, 10), ['one two', 'three', 'four']);
  assert.deepEqual(wrapText(fakePainter, 'abcdefghijkl', 25, 10), ['abcde', 'fghij', 'kl']);
  assert.deepEqual(wrapText(fakePainter, '', 100, 10), ['']);
});
