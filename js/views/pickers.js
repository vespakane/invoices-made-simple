import { h, topbar, backBtn, barBtn, group, cell, actionCell, avatar, emptyState, searchBar, clear, actionSheet, icon } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { initials, formatMoney } from '../format.js';
import { openClientEditor, clientSubtitle, matchesClient } from './clients.js';
import { openBusinessEditor } from './businesses.js';

// Pushes a searchable client list. Resolves with the chosen client, or null.
export function pickClient(currentId = null) {
  return new Promise((resolve) => {
    let query = '';
    let chosen = null;
    const content = h('div', { class: 'content' });
    const search = searchBar({ placeholder: 'Search or type a new name', onInput: (v) => { query = v; render(); } });
    const screen = h('div', {},
      topbar({ title: 'Choose Client', left: backBtn(() => nav.pop()), right: barBtn('', { iconName: 'plus', cls: 'plus', ariaLabel: 'New client', onClick: () => createNew() }), sub: search }),
      content
    );
    async function createNew() {
      const c = await openClientEditor(null, { presetName: query.trim() });
      if (c) { chosen = c; nav.pop(); }
    }
    function choose(c) { chosen = c; nav.pop(); }
    function render() {
      clear(content);
      const all = [...store.state.clients].sort((a, b) => a.name.localeCompare(b.name));
      const list = all.filter((c) => matchesClient(c, query));
      const newLabel = query.trim() ? `New client “${query.trim()}”` : 'New Client';
      content.append(group({}, actionCell(newLabel, { iconName: 'plus', onClick: createNew })));
      if (!all.length) { content.append(emptyState({ iconName: 'people', title: 'No clients yet', text: 'Add your first client to send them an invoice.' })); return; }
      if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No matches', text: 'Tap the button above to add this client.' })); return; }
      content.append(group({ header: 'Clients' }, ...list.map((c) => cell({
        title: c.name, subtitle: clientSubtitle(c), subOneLine: true,
        avatar: avatar(initials(c.name), null, true),
        right: c.id === currentId ? icon('check', 'cell-check') : null,
        onClick: () => choose(c)
      }))));
    }
    render();
    const off = store.onChange(render);
    screen.onHide = () => { off(); resolve(chosen); };
    nav.push(screen);
    setTimeout(() => { if (!store.state.clients.length) search.input.focus(); }, 450);
  });
}

// Action sheet to switch business. Resolves with a business or null.
export async function pickBusiness(currentId) {
  const list = [...store.state.businesses].sort((a, b) => (b.isDefault - a.isDefault) || a.name.localeCompare(b.name));
  const choice = await actionSheet({
    title: 'From which business?',
    actions: [...list.map((b) => ({ label: (b.id === currentId ? '✓ ' : '') + b.name, value: b.id })), { label: 'New Business…', value: '__new' }]
  });
  if (!choice) return null;
  if (choice === '__new') return openBusinessEditor(null);
  return store.business(choice);
}

// Sheet listing the items library. Resolves with a saved item or null.
export function pickSavedItem(currency) {
  return new Promise((resolve) => {
    let query = '';
    let chosen = null;
    const content = h('div', { class: 'content' });
    const search = searchBar({ placeholder: 'Search items', onInput: (v) => { query = v; render(); } });
    const sheet = h('div', {},
      topbar({ title: 'Items Library', left: barBtn('Cancel', { onClick: () => nav.pop() }), sub: search }),
      content
    );
    function render() {
      clear(content);
      const q = query.toLowerCase();
      const list = [...store.state.savedItems].sort((a, b) => a.title.localeCompare(b.title)).filter((it) => !q || it.title.toLowerCase().includes(q) || (it.details || '').toLowerCase().includes(q));
      if (!store.state.savedItems.length) { content.append(emptyState({ iconName: 'tag', title: 'No saved items', text: 'Turn on “Save to library” when editing an item to reuse it later.' })); return; }
      if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No matches' })); return; }
      content.append(group({}, ...list.map((it) => cell({ title: it.title, subtitle: it.details || null, subOneLine: true, value: it.unitPrice ? formatMoney(it.unitPrice, currency) : null, onClick: () => { chosen = it; nav.pop(); } }))));
    }
    render();
    const off = store.onChange(render);
    sheet.onHide = () => { off(); resolve(chosen); };
    nav.sheet(sheet);
  });
}
