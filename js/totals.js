import { Dec } from './dec.js';

// Computes all monetary figures for a document. Returns Dec values.
export function lineTotal(item) {
  return Dec.from(item.quantity).mul(Dec.from(item.unitPrice));
}

export function computeTotals(doc, places = 2) {
  const items = doc.items || [];
  let subtotal = Dec.ZERO;
  const sections = [];
  let current = null;
  const lines = [];

  for (const it of items) {
    if (it.type === 'section') {
      current = { id: it.id, title: it.title, subtotal: Dec.ZERO, count: 0 };
      sections.push(current);
      continue;
    }
    const total = lineTotal(it).round(places);
    lines.push({ id: it.id, total });
    subtotal = subtotal.add(total);
    if (current) { current.subtotal = current.subtotal.add(total); current.count += 1; }
  }

  let discount = Dec.ZERO;
  if (doc.discountType === 'percent') discount = subtotal.percent(doc.discountValue).round(places);
  else if (doc.discountType === 'fixed') discount = Dec.from(doc.discountValue).round(places);
  if (discount.gt(subtotal)) discount = subtotal;
  if (discount.isNeg()) discount = Dec.ZERO;

  const taxable = subtotal.sub(discount);
  const taxRate = Dec.from(doc.taxRate);
  const tax = taxRate.isZero() ? Dec.ZERO : taxable.percent(taxRate).round(places);
  const total = taxable.add(tax);
  const balance = doc.kind === 'invoice' && doc.status === 'paid' ? Dec.ZERO : total;

  return { subtotal, discount, taxable, tax, taxRate, total, balance, sections, lines, hasSections: sections.length > 0 };
}
