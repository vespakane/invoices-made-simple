import { h, topbar, barBtn, group, field, toggleField, actionCell, confirm, toast, haptic } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { newLineItem, newSavedItem } from '../models.js';
import { Dec } from '../dec.js';
import { formatMoney, currencySymbol } from '../format.js';
import { pickSavedItem } from './pickers.js';

// Edits a line item in a sheet. Resolves with { action: 'save'|'delete'|'cancel', item }.
export function openItemEditor(item, { currency, isNew = false } = {}) {
  const draft = item ? { ...item } : newLineItem();
  let saveToLibrary = false;
  let result = { action: 'cancel' };

  const totalEl = h('div', { class: 'cell-value mono', style: { fontWeight: '600', color: 'var(--text)' } });
  const refreshTotal = () => { totalEl.textContent = formatMoney(Dec.from(draft.quantity).mul(Dec.from(draft.unitPrice)), currency); };

  const titleField = field({ label: 'Item', value: draft.title, placeholder: 'What are you charging for?', stacked: true, autocapitalize: 'sentences', onInput: (v) => { draft.title = v; } });
  const detailsField = field({ label: 'Description', value: draft.details, placeholder: 'Optional details. Start lines with “-” for bullets or “1.” for numbered steps.', multiline: true, autocapitalize: 'sentences', onInput: (v) => { draft.details = v; } });
  const qtyField = field({ label: 'Quantity', value: draft.quantity, placeholder: '1', inputmode: 'decimal', onInput: (v) => { draft.quantity = v; refreshTotal(); } });
  const priceField = field({ label: `Rate (${currencySymbol(currency)})`, value: draft.unitPrice, placeholder: '0.00', inputmode: 'decimal', onInput: (v) => { draft.unitPrice = v; refreshTotal(); } });
  qtyField.input.addEventListener('focus', () => qtyField.input.select());
  priceField.input.addEventListener('focus', () => priceField.input.select());
  refreshTotal();

  const content = h('div', { class: 'content' },
    store.state.savedItems.length ? group({}, actionCell('Choose from Items Library', { iconName: 'tag', onClick: fromLibrary })) : null,
    group({}, titleField, detailsField),
    group({}, qtyField, priceField, h('div', { class: 'field' }, h('label', {}, 'Line total'), totalEl)),
    group({ footer: 'Saved items can be added to any invoice or estimate with one tap.' },
      toggleField({ label: 'Save to Items Library', value: false, onChange: (v) => { saveToLibrary = v; } })),
    isNew ? null : group({}, actionCell('Delete Item', { destructive: true, center: true, onClick: remove }))
  );

  const sheet = h('div', {},
    topbar({ title: isNew ? 'New Item' : 'Edit Item', left: barBtn('Cancel', { onClick: () => nav.pop() }), right: barBtn(isNew ? 'Add' : 'Done', { primary: true, onClick: save }) }),
    content
  );

  async function fromLibrary() {
    const saved = await pickSavedItem(currency);
    if (!saved) return;
    draft.title = saved.title; draft.details = saved.details || ''; draft.unitPrice = saved.unitPrice || '';
    titleField.input.value = draft.title; detailsField.input.value = draft.details; detailsField.input.fit(); priceField.input.value = draft.unitPrice;
    refreshTotal();
    setTimeout(() => qtyField.input.focus(), 100);
  }

  async function save() {
    draft.title = draft.title.trim();
    if (!draft.title) { toast('Please enter an item name'); titleField.input.focus(); return; }
    draft.quantity = Dec.from(draft.quantity || '1').toString();
    if (Dec.from(draft.quantity).isZero()) draft.quantity = '1';
    draft.unitPrice = Dec.from(draft.unitPrice).toString();
    if (saveToLibrary) {
      const existing = store.state.savedItems.find((s) => s.title.toLowerCase() === draft.title.toLowerCase());
      await store.save('savedItems', existing ? { ...existing, details: draft.details, unitPrice: draft.unitPrice } : newSavedItem({ title: draft.title, details: draft.details, unitPrice: draft.unitPrice }));
    }
    haptic('light');
    result = { action: 'save', item: draft };
    nav.pop();
  }

  async function remove() {
    if (!(await confirm({ title: 'Delete this item?', confirmLabel: 'Delete' }))) return;
    result = { action: 'delete', item: draft };
    nav.pop();
  }

  const p = nav.sheet(sheet).then(() => result);
  if (isNew) setTimeout(() => titleField.input.focus(), 450);
  return p;
}

// Edits a section heading. Resolves with { action, item }.
export function openSectionEditor(section, { isNew = false } = {}) {
  const draft = { ...section };
  let result = { action: 'cancel' };
  const titleField = field({ label: 'Section title', value: draft.title, placeholder: 'e.g. Phase 1: Demolition', stacked: true, autocapitalize: 'sentences', onInput: (v) => { draft.title = v; } });
  const content = h('div', { class: 'content' },
    group({ footer: 'Sections group the items below them and show their own subtotal.' }, titleField),
    isNew ? null : group({}, actionCell('Delete Section', { destructive: true, center: true, onClick: async () => { if (await confirm({ title: 'Delete this section?', message: 'Items below it are kept.', confirmLabel: 'Delete' })) { result = { action: 'delete', item: draft }; nav.pop(); } } }))
  );
  const sheet = h('div', {},
    topbar({ title: isNew ? 'New Section' : 'Edit Section', left: barBtn('Cancel', { onClick: () => nav.pop() }), right: barBtn(isNew ? 'Add' : 'Done', { primary: true, onClick: () => { draft.title = draft.title.trim(); if (!draft.title) { toast('Please enter a title'); return; } result = { action: 'save', item: draft }; nav.pop(); } }) }),
    content
  );
  const p = nav.sheet(sheet).then(() => result);
  setTimeout(() => titleField.input.focus(), 450);
  return p;
}
