// CSV and Excel exports for a single document and for the whole list.
import { Dec } from './dec.js';
import { computeTotals } from './totals.js';
import { currencyDecimals, formatDate } from './format.js';
import { statusInfo } from './docquery.js';
import { buildXlsx } from './xlsx.js';
import { PAYMENT_TERMS } from './models.js';

export function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCSV(rows) {
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

const num = (v, places) => Number(Dec.from(v).toFixed(places));
const money = (v, places, bold = false) => ({ v: num(v, places), t: 'n', style: bold ? 3 : 2 });
const bold = (v) => ({ v, t: 's', style: 1 });
const head = (v) => ({ v, t: 's', style: 5 });

// Rows describing one document; used for both CSV and Excel.
export function documentRows(doc, { business, client }, { styled = false } = {}) {
  const places = currencyDecimals(doc.currency);
  const t = computeTotals(doc, places);
  const isInv = doc.kind === 'invoice';
  const kind = isInv ? 'Invoice' : 'Estimate';
  const B = styled ? bold : (v) => v;
  const H = styled ? head : (v) => v;
  const M = styled ? (v, b) => money(v, places, b) : (v) => num(v, places);
  const rows = [
    [B(kind), doc.number || ''],
    ['Status', statusInfo(doc).label],
    ['Date', formatDate(doc.issueDate)],
    isInv ? ['Due date', doc.dueDate ? formatDate(doc.dueDate) : ''] : ['Valid until', doc.validUntil ? formatDate(doc.validUntil) : ''],
    isInv ? ['Terms', (PAYMENT_TERMS.find((p) => p.id === doc.paymentTerms) || {}).label || ''] : null,
    ['Currency', doc.currency],
    [],
    [B('From'), business ? business.name : ''],
    business && business.ownerName ? ['', business.ownerName] : null,
    business && business.email ? ['', business.email] : null,
    business && business.phone ? ['', business.phone] : null,
    ...((business && business.address) ? business.address.split('\n').map((l) => ['', l]) : []),
    [],
    [B(isInv ? 'Bill to' : 'Prepared for'), client ? client.name : ''],
    client && client.company ? ['', client.company] : null,
    client && client.email ? ['', client.email] : null,
    client && client.phone ? ['', client.phone] : null,
    ...((client && client.address) ? client.address.split('\n').map((l) => ['', l]) : []),
    [],
    [H('Section'), H('Item'), H('Description'), H('Quantity'), H('Rate'), H('Amount')]
  ].filter(Boolean);
  let section = '';
  for (const it of doc.items || []) {
    if (it.type === 'section') { section = it.title; continue; }
    const line = t.lines.find((l) => l.id === it.id);
    rows.push([section, it.title, it.details || '', num(it.quantity, 6), M(it.unitPrice), M(line ? line.total : 0)]);
  }
  rows.push([]);
  rows.push(['', '', '', '', B('Subtotal'), M(t.subtotal)]);
  if (!t.discount.isZero()) rows.push(['', '', '', '', B(`Discount${doc.discountType === 'percent' ? ` (${Dec.from(doc.discountValue).toString()}%)` : ''}`), M(t.discount.neg())]);
  if (!t.taxRate.isZero()) rows.push(['', '', '', '', B(`${doc.taxLabel || 'Tax'} (${t.taxRate.toString()}%)`), M(t.tax)]);
  rows.push(['', '', '', '', B('Total'), M(t.total, true)]);
  if (isInv) rows.push(['', '', '', '', B('Balance due'), M(t.balance, true)]);
  const notes = [['Notes', doc.notes], ['Terms', doc.terms], isInv ? ['Payment instructions', doc.paymentInstructions] : null].filter((x) => x && (x[1] || '').trim());
  if (notes.length) { rows.push([]); for (const [k, v] of notes) rows.push([B(k), v]); }
  return rows;
}

export function documentCSV(doc, ctx) { return toCSV(documentRows(doc, ctx)); }
export function documentXlsx(doc, ctx) {
  return buildXlsx([{ name: `${doc.kind === 'invoice' ? 'Invoice' : 'Estimate'} ${doc.number || ''}`.trim(), rows: documentRows(doc, ctx, { styled: true }), colWidths: [22, 30, 50, 10, 14, 14] }]);
}

// List export: one row per document.
export function listRows(docs, lookup, { styled = false } = {}) {
  const H = styled ? head : (v) => v;
  const rows = [[H('Type'), H('Number'), H('Status'), H('Date'), H('Due / Valid until'), H('Client'), H('Client email'), H('Business'), H('Currency'), H('Subtotal'), H('Discount'), H('Tax'), H('Total'), H('Balance due'), H('Sent'), H('Paid')]];
  for (const d of docs) {
    const places = currencyDecimals(d.currency);
    const t = computeTotals(d, places);
    const c = lookup.client(d.clientId), b = lookup.business(d.businessId);
    const M = (v, bold2 = false) => styled ? money(v, places, bold2) : num(v, places);
    rows.push([d.kind === 'invoice' ? 'Invoice' : 'Estimate', d.number || '', statusInfo(d).label, d.issueDate || '', d.kind === 'invoice' ? (d.dueDate || '') : (d.validUntil || ''), c ? c.name : '', c ? c.email : '', b ? b.name : '', d.currency, M(t.subtotal), M(t.discount), M(t.tax), M(t.total, true), d.kind === 'invoice' ? M(t.balance) : '', d.sentAt ? d.sentAt.slice(0, 10) : '', d.paidAt ? d.paidAt.slice(0, 10) : '']);
  }
  return rows;
}
export function listCSV(docs, lookup) { return toCSV(listRows(docs, lookup)); }
export function listXlsx(docs, lookup, name = 'Documents') {
  return buildXlsx([{ name, rows: listRows(docs, lookup, { styled: true }), colWidths: [10, 12, 12, 12, 14, 24, 26, 22, 9, 12, 12, 12, 12, 12, 12, 12] }]);
}
