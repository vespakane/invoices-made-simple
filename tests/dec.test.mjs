import test from 'node:test';
import assert from 'node:assert/strict';
import { Dec, normalizeNumberString } from '../js/dec.js';

test('parses common input formats', () => {
  assert.equal(Dec.from('12.50').toString(), '12.5');
  assert.equal(Dec.from('12,50').toString(), '12.5');
  assert.equal(Dec.from('4,800').toString(), '4800');
  assert.equal(Dec.from('4,8').toString(), '4.8');
  assert.equal(Dec.from('0,125').toString(), '0.125');
  assert.equal(Dec.from('1,234.56').toString(), '1234.56');
  assert.equal(Dec.from('1.234,56').toString(), '1234.56');
  assert.equal(Dec.from('1,234,567').toString(), '1234567');
  assert.equal(Dec.from('$1,250.00').toString(), '1250');
  assert.equal(Dec.from('-3').toString(), '-3');
  assert.equal(Dec.from('').toString(), '0');
  assert.equal(Dec.from(null).toString(), '0');
  assert.equal(Dec.from('abc').toString(), '0');
  assert.equal(Dec.from(0.1).add(0.2).toString(), '0.3');
  assert.equal(normalizeNumberString(' 1 234,5 '), '1234.5');
});

test('arithmetic is exact', () => {
  assert.equal(Dec.from('0.1').add('0.2').toString(), '0.3');
  assert.equal(Dec.from('19.99').mul(3).toString(), '59.97');
  assert.equal(Dec.from('100').div(3).toFixed(2), '33.33');
  assert.equal(Dec.from('2.5').mul('1.5').toString(), '3.75');
  assert.equal(Dec.from('10').sub('10.01').toString(), '-0.01');
  assert.equal(Dec.from('1234.5').percent('8.25').toFixed(2), '101.85');
});

test('rounding is half away from zero', () => {
  assert.equal(Dec.from('2.345').toFixed(2), '2.35');
  assert.equal(Dec.from('2.344').toFixed(2), '2.34');
  assert.equal(Dec.from('-2.345').toFixed(2), '-2.35');
  assert.equal(Dec.from('2.5').toFixed(0), '3');
  assert.equal(Dec.from('1.005').round(2).toString(), '1.01');
});

test('comparisons', () => {
  assert.ok(Dec.from('1').lt('2'));
  assert.ok(Dec.from('2').gt('1.999999'));
  assert.ok(Dec.from('0').isZero());
  assert.ok(Dec.from('-0.000001').isNeg());
  assert.equal(Dec.from('5').min('3').toString(), '3');
});
