import test from 'node:test';
import assert from 'node:assert/strict';
import { statusInfo, matchesFilter, matchesQuery, queryDocuments, isOverdue } from '../js/docquery.js';

const ctx = { clientName: (d) => d._client || '', businessName: (d) => d._biz || '', places: 2 };
const inv = (o) => ({ kind: 'invoice', status: 'outstanding', number: 'INV-0001', dueDate: '2999-01-01', items: [{ type: 'item', title: 'Deck repair', details: 'Replace boards', quantity: '2', unitPrice: '625' }], _client: 'Maria Gonzalez', _biz: 'Northwind', ...o });

test('status badges', () => {
  assert.equal(statusInfo(inv()).label, 'Outstanding');
  assert.equal(statusInfo(inv({ status: 'paid' })).label, 'Paid');
  assert.equal(statusInfo(inv({ status: 'draft' })).label, 'Draft');
  assert.equal(statusInfo(inv({ dueDate: '2000-01-01' })).label, 'Overdue');
  assert.equal(statusInfo(inv({ dueDate: '2000-01-01', status: 'paid' })).label, 'Paid');
  assert.ok(isOverdue(inv({ dueDate: '2000-01-01' })));
  assert.equal(statusInfo({ kind: 'estimate', status: 'open' }).label, 'Open');
  assert.equal(statusInfo({ kind: 'estimate', status: 'closed' }).label, 'Closed');
  assert.equal(statusInfo({ kind: 'estimate', status: 'closed', convertedToId: 'x' }).label, 'Invoiced');
});

test('filters are scoped per kind', () => {
  assert.ok(matchesFilter(inv({ status: 'draft' }), 'outstanding'));
  assert.ok(!matchesFilter(inv({ status: 'paid' }), 'outstanding'));
  assert.ok(matchesFilter(inv({ status: 'paid' }), 'paid'));
  assert.ok(matchesFilter({ kind: 'estimate', status: 'open' }, 'open'));
  assert.ok(!matchesFilter({ kind: 'estimate', status: 'open' }, 'closed'));
});

test('search matches client, number, business, items and amount', () => {
  const d = inv();
  assert.ok(matchesQuery(d, 'maria', ctx));
  assert.ok(matchesQuery(d, '0001', ctx));
  assert.ok(matchesQuery(d, 'northwind', ctx));
  assert.ok(matchesQuery(d, 'boards', ctx));
  assert.ok(matchesQuery(d, '1250', ctx));
  assert.ok(matchesQuery(d, '1,250.00', ctx));
  assert.ok(matchesQuery(d, '$1250', ctx));
  assert.ok(matchesQuery(d, '625', ctx));
  assert.ok(!matchesQuery(d, 'zzz', ctx));
  assert.ok(matchesQuery(d, '', ctx));
});

test('query combines kind, filter, search and sorts newest first', () => {
  const docs = [
    inv({ id: 'a', issueDate: '2026-01-01', status: 'paid' }),
    inv({ id: 'b', issueDate: '2026-03-01' }),
    inv({ id: 'c', issueDate: '2026-02-01' }),
    { kind: 'estimate', id: 'e', status: 'open', issueDate: '2026-04-01', items: [], _client: 'Maria' }
  ];
  const r = queryDocuments(docs, { kind: 'invoice', filter: 'outstanding', query: 'maria', ctx });
  assert.deepEqual(r.map((d) => d.id), ['b', 'c']);
  assert.deepEqual(queryDocuments(docs, { kind: 'invoice', filter: 'paid', query: 'maria', ctx }).map((d) => d.id), ['a']);
  assert.deepEqual(queryDocuments(docs, { kind: 'estimate', filter: 'all', query: '', ctx }).map((d) => d.id), ['e']);
});
