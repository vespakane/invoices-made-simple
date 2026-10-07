import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, lineTotal } from '../js/totals.js';

const doc = (over = {}) => ({
  kind: 'invoice', status: 'outstanding', discountType: 'none', discountValue: '0', taxRate: '0',
  items: [
    { id: 'a', type: 'item', title: 'Design', quantity: '2', unitPrice: '150' },
    { id: 'b', type: 'item', title: 'Dev', quantity: '1.5', unitPrice: '99.99' }
  ],
  ...over
});

test('line totals and subtotal', () => {
  assert.equal(lineTotal({ quantity: '1.5', unitPrice: '99.99' }).toString(), '149.985');
  const t = computeTotals(doc());
  assert.equal(t.subtotal.toFixed(2), '449.99'); // 300 + 149.99 (line rounded)
  assert.equal(t.total.toFixed(2), '449.99');
  assert.equal(t.balance.toFixed(2), '449.99');
});

test('percent discount then tax on discounted amount', () => {
  const t = computeTotals(doc({ discountType: 'percent', discountValue: '10', taxRate: '20' }));
  assert.equal(t.discount.toFixed(2), '45.00');
  assert.equal(t.taxable.toFixed(2), '404.99');
  assert.equal(t.tax.toFixed(2), '81.00');
  assert.equal(t.total.toFixed(2), '485.99');
});

test('fixed discount is capped at subtotal and never negative', () => {
  assert.equal(computeTotals(doc({ discountType: 'fixed', discountValue: '1000' })).total.toFixed(2), '0.00');
  assert.equal(computeTotals(doc({ discountType: 'fixed', discountValue: '-5' })).discount.toFixed(2), '0.00');
  assert.equal(computeTotals(doc({ discountType: 'fixed', discountValue: '49.99' })).total.toFixed(2), '400.00');
});

test('paid invoices have zero balance; estimates always show total', () => {
  assert.equal(computeTotals(doc({ status: 'paid' })).balance.toFixed(2), '0.00');
  assert.equal(computeTotals(doc({ kind: 'estimate', status: 'closed' })).balance.toFixed(2), '449.99');
});

test('sections get their own subtotals', () => {
  const t = computeTotals(doc({ items: [
    { id: 's1', type: 'section', title: 'Phase 1' },
    { id: 'a', type: 'item', quantity: '1', unitPrice: '100' },
    { id: 'b', type: 'item', quantity: '2', unitPrice: '25' },
    { id: 's2', type: 'section', title: 'Phase 2' },
    { id: 'c', type: 'item', quantity: '3', unitPrice: '10' }
  ] }));
  assert.equal(t.sections.length, 2);
  assert.equal(t.sections[0].subtotal.toString(), '150');
  assert.equal(t.sections[1].subtotal.toString(), '30');
  assert.equal(t.subtotal.toString(), '180');
});

test('zero-decimal currencies round to whole units', () => {
  const t = computeTotals(doc({ items: [{ id: 'a', type: 'item', quantity: '3', unitPrice: '1000.4' }], taxRate: '10' }), 0);
  assert.equal(t.subtotal.toString(), '3001');
  assert.equal(t.tax.toString(), '300');
});
