// Contacts page: Clients and Businesses (who documents are billed from).
import { h, topbar, barBtn, tabs, searchBar, emptyState, clear, cell, avatar, fab, swipeRow, closeOpenSwipe, confirm, icon } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { menuScreen } from './menu.js';
import { initials } from '../format.js';
import { openClientEditor, clientSubtitle, matchesClient } from './clients.js';
import { openBusinessEditor } from './businesses.js';

export function contactsPage() {
  const ui = { tab: 'clients', query: '', searching: false };
  const content = h('div', { class: 'content' });
  const searchWrap = h('div', { class: 'search-reveal hidden' });
  const search = searchBar({ placeholder: 'Search contacts', onInput: (v) => { ui.query = v; render(); } });
  searchWrap.append(search);
  const theFab = fab(createNew, 'New client');
  const page = h('div', { class: 'page' },
    topbar({
      title: 'Contacts',
      left: barBtn('', { iconName: 'gear', ariaLabel: 'Settings', onClick: () => nav.push(menuScreen()) }),
      right: barBtn('', { iconName: 'search', ariaLabel: 'Search', onClick: toggleSearch }),
      sub: h('div', {}, tabs([{ value: 'clients', label: 'Clients' }, { value: 'businesses', label: 'My Businesses' }], ui.tab, (v) => { ui.tab = v; theFab.setAttribute('aria-label', v === 'clients' ? 'New client' : 'New business'); render(); }), searchWrap)
    }),
    h('div', { class: 'page-wrap' }, content, theFab)
  );
  page.querySelector('.topbar-sub').classList.add('tabs-sub');
  content.addEventListener('scroll', closeOpenSwipe, { passive: true });

  function toggleSearch() {
    ui.searching = !ui.searching;
    searchWrap.classList.toggle('hidden', !ui.searching);
    if (ui.searching) setTimeout(() => search.input.focus(), 50);
    else { search.input.value = ''; search.classList.remove('has-text'); ui.query = ''; render(); }
  }
  function createNew() { ui.tab === 'clients' ? openClientEditor(null) : openBusinessEditor(null); }

  function render() {
    clear(content);
    const q = ui.query;
    const listEl = h('div', { class: 'plain-list' });
    if (ui.tab === 'clients') {
      const all = [...store.state.clients].sort((a, b) => a.name.localeCompare(b.name));
      if (!all.length) { content.append(emptyState({ iconName: 'people', title: 'No clients yet', text: 'Clients are the people and companies you send invoices to. Tap + to add one.' })); return; }
      const list = all.filter((c) => matchesClient(c, q));
      if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No results', text: `Nothing matches “${q}”.` })); return; }
      for (const c of list) {
        listEl.append(swipeRow(
          cell({ title: c.name || 'Unnamed client', subtitle: clientSubtitle(c), subOneLine: true, avatar: avatar(initials(c.name), null, true), chevron: true, onClick: () => openClientEditor(c) }),
          [{ label: 'Delete', color: 'red', iconName: 'trash', onClick: async () => { if (await confirm({ title: `Delete “${c.name}”?`, confirmLabel: 'Delete' })) store.remove('clients', c.id); } }]
        ));
      }
    } else {
      const all = [...store.state.businesses].sort((a, b) => (b.isDefault - a.isDefault) || a.name.localeCompare(b.name));
      if (!all.length) { content.append(emptyState({ iconName: 'building', title: 'No businesses yet', text: 'Your business details appear at the top of every invoice and estimate. Tap + to add one.' })); return; }
      const list = all.filter((b) => !q || [b.name, b.ownerName, b.email].some((v) => (v || '').toLowerCase().includes(q.toLowerCase())));
      if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No results', text: `Nothing matches “${q}”.` })); return; }
      for (const b of list) {
        listEl.append(swipeRow(
          cell({ title: b.name || 'Untitled business', subtitle: b.ownerName || b.email || null, subOneLine: true, avatar: avatar(initials(b.name), b.logo), badge: b.isDefault ? 'Default' : null, chevron: true, onClick: () => openBusinessEditor(b) }),
          [{ label: 'Delete', color: 'red', iconName: 'trash', onClick: async () => { if (await confirm({ title: `Delete “${b.name}”?`, message: 'Documents created for this business are kept.', confirmLabel: 'Delete' })) { await store.remove('businesses', b.id); if (b.isDefault && store.state.businesses.length) store.save('businesses', { ...store.state.businesses[0], isDefault: true }); } } }]
        ));
      }
      listEl.append(h('div', { class: 'group-footer', style: { padding: '10px 16px' } }, 'The default business is pre-selected on new invoices and estimates.'));
    }
    content.append(listEl);
  }
  render();
  store.onChange(render);
  return page;
}
