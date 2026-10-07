import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../js/zip.js';
import { buildXlsx, colName } from '../js/xlsx.js';
import { documentRows, documentCSV, listCSV, documentXlsx } from '../js/exports.js';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('crc32 matches the reference value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('zip and xlsx open with a standard unzip tool', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'xlsx-'));
  const file = path.join(dir, 't.xlsx');
  writeFileSync(file, buildXlsx([{ name: 'Sheet', rows: [['A', 1], [{ v: 2.5, t: 'n', style: 2 }, 'b<&>"']] }]));
  const out = execFileSync('python3', ['-I', '-c', `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print(sorted(z.namelist())); print(z.read('xl/worksheets/sheet1.xml').decode())`, file]).toString();
  assert.match(out, /^None\n/);
  assert.match(out, /xl\/workbook\.xml/);
  assert.match(out, /<c r="B1"><v>1<\/v><\/c>/);
  assert.match(out, /b&lt;&amp;&gt;&quot;/);
  assert.equal(colName(0), 'A'); assert.equal(colName(25), 'Z'); assert.equal(colName(26), 'AA');
});

const doc = { kind: 'invoice', number: 'INV-0007', status: 'outstanding', issueDate: '2026-10-07', dueDate: '2026-11-06', paymentTerms: 'net30', currency: 'USD', discountType: 'percent', discountValue: '10', taxLabel: 'VAT', taxRate: '20', notes: 'Thanks, "friend"', terms: '', paymentInstructions: 'Bank 123',
  items: [{ id: 's', type: 'section', title: 'Phase 1' }, { id: 'a', type: 'item', title: 'Work', details: 'Line one\nLine two', quantity: '2', unitPrice: '100' }] };
const ctx = { business: { name: 'Biz', email: 'b@x.com', address: '1 St\nTown' }, client: { name: 'Cli', email: 'c@x.com' } };

test('document rows carry items, totals and notes', () => {
  const rows = documentRows(doc, ctx);
  const item = rows.find((r) => r[1] === 'Work');
  assert.deepEqual(item, ['Phase 1', 'Work', 'Line one\nLine two', 2, 100, 200]);
  assert.deepEqual(rows.find((r) => r[4] === 'Total'), ['', '', '', '', 'Total', 216]);
  assert.deepEqual(rows.find((r) => r[4] === 'Balance due'), ['', '', '', '', 'Balance due', 216]);
  const csv = documentCSV(doc, ctx);
  assert.ok(csv.startsWith('﻿Invoice,INV-0007'));
  assert.ok(csv.includes('"Line one\nLine two"'));
  assert.ok(csv.includes('"Thanks, ""friend"""'));
  assert.ok(documentXlsx(doc, ctx).length > 1000);
});

test('list export has one row per document', () => {
  const csv = listCSV([doc, { ...doc, kind: 'estimate', number: 'EST-0001', status: 'open', validUntil: '2026-12-01' }], { client: () => ctx.client, business: () => ctx.business });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('Invoice,INV-0007,Outstanding,2026-10-07,2026-11-06,Cli,c@x.com,Biz,USD,200,20,36,216,216'));
  assert.ok(lines[2].startsWith('Estimate,EST-0001,Open,2026-10-07,2026-12-01'));
});
