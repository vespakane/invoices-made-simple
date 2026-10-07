import { h, topbar, backBtn, barBtn, group, cell, actionCell, field, emptyState, icon, confirm, toast, clear, searchBar, swipeRow, closeOpenSwipe } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { newSavedItem } from '../models.js';
import { Dec } from '../dec.js';
import { formatMoney, currencySymbol } from '../format.js';

export function itemsScreen() {
  let query = '';
  const currency = store.state.settings.currency;
  const content = h('div', { class: 'content' });
  const search = searchBar({ placeholder: 'Search items', onInput: (v) => { query = v; render(); } });
  const screen = h('div', {},
    topbar({ title: 'Items Library', left: backBtn(() => nav.pop()), right: barBtn('', { iconName: 'plus', cls: 'plus', ariaLabel: 'Add item', onClick: () => openSavedItemEditor(null) }), sub: search }),
    content
  );
  content.addEventListener('scroll', closeOpenSwipe, { passive: true });
  function render() {
    clear(content);
    const all = [...store.state.savedItems].sort((a, b) => a.title.localeCompare(b.title));
    if (!all.length) {
      content.append(emptyState({ iconName: 'tag', title: 'No saved items', text: 'Save the things you charge for often and add them to documents with one tap.' }),
        h('div', { class: 'group' }, h('button', { class: 'btn', type: 'button', onClick: () => openSavedItemEditor(null) }, icon('plus'), 'Add Item')));
      return;
    }
    const q = query.toLowerCase();
    const list = all.filter((it) => !q || it.title.toLowerCase().includes(q) || (it.details || '').toLowerCase().includes(q));
    if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No matches' })); return; }
    content.append(h('section', { class: 'group' }, h('div', { class: 'cells' }, ...list.map((it) => swipeRow(
      cell({ title: it.title, subtitle: it.details || null, subOneLine: true, value: it.unitPrice ? formatMoney(it.unitPrice, currency) : null, chevron: true, onClick: () => openSavedItemEditor(it) }),
      [{ label: 'Delete', color: 'red', iconName: 'trash', onClick: async () => { if (await confirm({ title: `Delete “${it.title}”?`, confirmLabel: 'Delete' })) store.remove('savedItems', it.id); } }]
    )))));
  }
  render();
  const off = store.onChange(render);
  screen.onHide = off;
  return screen;
}

export function openSavedItemEditor(item) {
  const isNew = !item;
  const draft = isNew ? newSavedItem() : { ...item };
  const currency = store.state.settings.currency;
  const titleField = field({ label: 'Item', value: draft.title, placeholder: 'Required', stacked: true, autocapitalize: 'sentences', onInput: (v) => { draft.title = v; } });
  const content = h('div', { class: 'content' },
    group({}, titleField,
      field({ label: 'Description', value: draft.details, placeholder: 'Optional', multiline: true, onInput: (v) => { draft.details = v; } })),
    group({}, field({ label: `Rate (${currencySymbol(currency)})`, value: draft.unitPrice, placeholder: '0.00', inputmode: 'decimal', onInput: (v) => { draft.unitPrice = v; } })),
    isNew ? null : group({}, actionCell('Delete Item', { destructive: true, center: true, onClick: async () => { if (await confirm({ title: `Delete “${draft.title}”?`, confirmLabel: 'Delete' })) { await store.remove('savedItems', draft.id); nav.pop(); } } }))
  );
  const sheet = h('div', {},
    topbar({ title: isNew ? 'New Saved Item' : 'Edit Saved Item', left: barBtn('Cancel', { onClick: () => nav.pop() }), right: barBtn('Save', { primary: true, onClick: async () => {
      draft.title = draft.title.trim();
      if (!draft.title) { toast('Please enter an item name'); return; }
      draft.unitPrice = Dec.from(draft.unitPrice).toString();
      await store.save('savedItems', draft);
      nav.pop();
    } }) }),
    content
  );
  const p = nav.sheet(sheet);
  if (isNew) setTimeout(() => titleField.input.focus(), 450);
  return p;
}
