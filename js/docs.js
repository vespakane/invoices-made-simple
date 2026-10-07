// Document actions that touch the store: create, duplicate, status changes, conversion, deletion.
import * as store from './store.js';
import { newDocument, newLineItem, newSection, nowISO, todayISO, uid, PAYMENT_TERMS } from './models.js';
import { nextNumber, counterAfter, counterKey } from './numbering.js';
import { addDays } from './format.js';

export function dueDateFor(issueDate, terms, customDate = null) {
  const t = PAYMENT_TERMS.find((p) => p.id === terms);
  if (!t || t.days === null) return customDate || addDays(issueDate, 30);
  return addDays(issueDate, t.days);
}

// Creates and persists a new draft document using the default business and the next number.
export async function createDocument(kind, { business = null } = {}) {
  const s = store.state.settings;
  const biz = business || store.defaultBusiness();
  const doc = newDocument(kind, { settings: s, business: biz, number: nextNumber(biz, kind, s) });
  if (kind === 'invoice') doc.dueDate = dueDateFor(doc.issueDate, doc.paymentTerms);
  else doc.validUntil = addDays(doc.issueDate, s.estimateValidDays || 30);
  await store.save('documents', doc);
  if (biz) await bumpCounter(biz, kind, doc.number);
  return doc;
}

export async function bumpCounter(business, kind, usedNumber) {
  const next = counterAfter(business, kind, usedNumber);
  if (next !== business[counterKey(kind)]) await store.save('businesses', { ...business, [counterKey(kind)]: next });
}

export async function duplicateDocument(doc) {
  const biz = store.business(doc.businessId) || store.defaultBusiness();
  const copy = {
    ...structuredClone(doc),
    id: uid(),
    number: nextNumber(biz, doc.kind, store.state.settings),
    issueDate: todayISO(),
    status: doc.kind === 'invoice' ? 'draft' : 'open',
    sentAt: null, paidAt: null, convertedFromId: null, convertedToId: null,
    demo: false,
    createdAt: nowISO(), updatedAt: nowISO()
  };
  copy.items = (doc.items || []).map((it) => ({ ...it, id: uid() }));
  if (doc.kind === 'invoice') copy.dueDate = dueDateFor(copy.issueDate, copy.paymentTerms, doc.dueDate);
  else copy.validUntil = addDays(copy.issueDate, store.state.settings.estimateValidDays || 30);
  await store.save('documents', copy);
  if (biz) await bumpCounter(biz, doc.kind, copy.number);
  return copy;
}

export async function setStatus(doc, status) {
  const patch = { ...doc, status };
  if (doc.kind === 'invoice') patch.paidAt = status === 'paid' ? nowISO() : null;
  return store.save('documents', patch);
}

export async function markSent(doc) {
  const patch = { ...doc, sentAt: nowISO() };
  if (doc.kind === 'invoice' && doc.status === 'draft') patch.status = 'outstanding';
  return store.save('documents', patch);
}

export async function convertToInvoice(estimate) {
  const biz = store.business(estimate.businessId) || store.defaultBusiness();
  const s = store.state.settings;
  const inv = {
    ...structuredClone(estimate),
    id: uid(),
    kind: 'invoice',
    number: nextNumber(biz, 'invoice', s),
    issueDate: todayISO(),
    status: 'draft',
    paymentTerms: s.paymentTerms,
    validUntil: null,
    sentAt: null, paidAt: null,
    convertedFromId: estimate.id, convertedToId: null,
    demo: false,
    createdAt: nowISO(), updatedAt: nowISO()
  };
  inv.dueDate = dueDateFor(inv.issueDate, inv.paymentTerms);
  inv.items = (estimate.items || []).map((it) => ({ ...it, id: uid() }));
  await store.save('documents', inv);
  await store.save('documents', { ...estimate, status: 'closed', convertedToId: inv.id });
  if (biz) await bumpCounter(biz, 'invoice', inv.number);
  return inv;
}

export async function deleteDocument(doc) {
  if (doc.convertedFromId) {
    const est = store.document(doc.convertedFromId);
    if (est && est.convertedToId === doc.id) await store.save('documents', { ...est, convertedToId: null });
  }
  await store.remove('documents', doc.id);
}

export { newLineItem, newSection };
