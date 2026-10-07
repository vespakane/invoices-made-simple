import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, nextNumber, parseNumber, counterAfter, isNumberTaken } from '../js/numbering.js';

const settings = { invoicePrefix: 'INV-', estimatePrefix: 'EST-', numberPadding: 4 };

test('formats with prefix and padding', () => {
  assert.equal(formatNumber('INV-', 7, 4), 'INV-0007');
  assert.equal(formatNumber('', 12345, 4), '12345');
  assert.equal(nextNumber({ nextInvoiceNumber: 42 }, 'invoice', settings), 'INV-0042');
  assert.equal(nextNumber({ nextEstimateNumber: 3 }, 'estimate', settings), 'EST-0003');
  assert.equal(nextNumber(null, 'invoice', settings), 'INV-0001');
});

test('parses the trailing number of edited values', () => {
  assert.equal(parseNumber('INV-0042'), 42);
  assert.equal(parseNumber('2026-007'), 7);
  assert.equal(parseNumber('ABC'), null);
  assert.equal(parseNumber(''), null);
});

test('counter advances past manually entered numbers but never goes back', () => {
  const b = { nextInvoiceNumber: 10 };
  assert.equal(counterAfter(b, 'invoice', 'INV-0010'), 11);
  assert.equal(counterAfter(b, 'invoice', 'INV-0050'), 51);
  assert.equal(counterAfter(b, 'invoice', 'INV-0003'), 10);
  assert.equal(counterAfter(b, 'invoice', 'DRAFT'), 10);
});

test('detects duplicate numbers within a kind', () => {
  const docs = [{ id: '1', kind: 'invoice', number: 'INV-0001' }, { id: '2', kind: 'estimate', number: 'INV-0001' }];
  assert.ok(isNumberTaken(docs, 'invoice', 'inv-0001'));
  assert.ok(!isNumberTaken(docs, 'invoice', 'INV-0001', '1'));
  assert.ok(!isNumberTaken(docs, 'invoice', 'INV-0002'));
});
