// Sequential document numbering, per business, with user-editable numbers.
export function formatNumber(prefix, n, padding = 4) {
  return `${prefix || ''}${String(n).padStart(padding, '0')}`;
}

export function counterKey(kind) { return kind === 'invoice' ? 'nextInvoiceNumber' : 'nextEstimateNumber'; }
export function prefixFor(kind, settings) { return kind === 'invoice' ? settings.invoicePrefix : settings.estimatePrefix; }

export function nextNumber(business, kind, settings) {
  const n = (business && business[counterKey(kind)]) || 1;
  return formatNumber(prefixFor(kind, settings), n, settings.numberPadding);
}

// Parse the numeric part of a document number. "INV-0042" -> 42, "2024-007" -> 7, "ABC" -> null.
export function parseNumber(numberString) {
  const m = /(\d+)\s*$/.exec(String(numberString || ''));
  return m ? parseInt(m[1], 10) : null;
}

// Given a number that was just used, return the counter value the business should hold next.
export function counterAfter(business, kind, usedNumber) {
  const current = (business && business[counterKey(kind)]) || 1;
  const n = parseNumber(usedNumber);
  if (n === null) return current;
  return Math.max(current, n + 1);
}

export function isNumberTaken(documents, kind, numberString, excludeId = null) {
  const target = String(numberString || '').trim().toLowerCase();
  if (!target) return false;
  return documents.some((d) => d.kind === kind && d.id !== excludeId && String(d.number || '').trim().toLowerCase() === target);
}
