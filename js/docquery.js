// Pure helpers for document status, filtering, searching and sorting.
import { computeTotals } from './totals.js';
import { isPast } from './format.js';
import { Dec, normalizeNumberString } from './dec.js';

export function isOverdue(doc) {
  return doc.kind === 'invoice' && doc.status !== 'paid' && !!doc.dueDate && isPast(doc.dueDate);
}

// Returns { key, label, color } for the status badge.
export function statusInfo(doc) {
  if (doc.kind === 'invoice') {
    if (doc.status === 'paid') return { key: 'paid', label: 'Paid', color: 'green' };
    if (isOverdue(doc)) return { key: 'overdue', label: 'Overdue', color: 'red' };
    if (doc.status === 'draft') return { key: 'draft', label: 'Draft', color: 'gray' };
    return { key: 'outstanding', label: 'Outstanding', color: 'orange' };
  }
  if (doc.status === 'closed') return { key: 'closed', label: doc.convertedToId ? 'Invoiced' : 'Closed', color: 'gray' };
  return { key: 'open', label: 'Open', color: 'blue' };
}

export function matchesFilter(doc, filter) {
  if (!filter || filter === 'all') return true;
  if (doc.kind === 'invoice') {
    if (filter === 'paid') return doc.status === 'paid';
    if (filter === 'outstanding') return doc.status !== 'paid';
  } else {
    if (filter === 'open') return doc.status === 'open';
    if (filter === 'closed') return doc.status === 'closed';
  }
  return true;
}

// ctx: { businessName(doc), clientName(doc), places }
export function matchesQuery(doc, query, ctx) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    doc.number,
    ctx.clientName(doc),
    ctx.businessName(doc),
    ...(doc.items || []).flatMap((it) => [it.title, it.details])
  ].filter(Boolean).join('\n').toLowerCase();
  if (hay.includes(q)) return true;
  // Amount match: "1250", "1,250.00", "$1250"
  const qn = normalizeNumberString(q);
  if (qn && /\d/.test(qn)) {
    const total = computeTotals(doc, ctx.places || 2).total;
    const fixed = total.toFixed(ctx.places || 2);
    if (fixed === qn || fixed.startsWith(qn) || total.toString() === qn || fixed.replace('.', '') === qn.replace('.', '')) return true;
    const qd = Dec.from(qn);
    if (!qd.isZero() && qd.eq(total)) return true;
    if (!qd.isZero() && (doc.items || []).some((it) => it.type !== 'section' && (qd.eq(it.unitPrice) || qd.eq(Dec.from(it.quantity).mul(it.unitPrice).round(ctx.places || 2))))) return true;
  }
  return false;
}

export function sortDocuments(docs) {
  return [...docs].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function queryDocuments(docs, { kind, filter, query, ctx }) {
  return sortDocuments(docs.filter((d) => d.kind === kind && matchesFilter(d, filter) && matchesQuery(d, query, ctx)));
}

export function sumTotals(docs, places = 2) {
  return docs.reduce((acc, d) => acc.add(computeTotals(d, places).total), Dec.ZERO);
}
