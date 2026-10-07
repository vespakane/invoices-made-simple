import { h, topbar, backBtn, barBtn, group, cell, actionCell, avatar, field, emptyState, icon, confirm, toast, haptic, clear, searchBar } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { newClient } from '../models.js';
import { initials } from '../format.js';

export function clientSubtitle(c) {
  return [c.company, c.email || c.phone].filter(Boolean).join(' · ') || null;
}

export function matchesClient(c, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [c.name, c.company, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(s));
}

export function clientsScreen() {
  let query = '';
  const content = h('div', { class: 'content' });
  const search = searchBar({ placeholder: 'Search clients', onInput: (v) => { query = v; render(); } });
  const screen = h('div', {},
    topbar({
      title: 'Clients',
      left: backBtn(() => nav.pop()),
      right: barBtn('', { iconName: 'plus', cls: 'plus', ariaLabel: 'Add client', onClick: () => openClientEditor(null) }),
      sub: search
    }),
    content
  );

  function render() {
    clear(content);
    const all = [...store.state.clients].sort((a, b) => a.name.localeCompare(b.name));
    if (!all.length) {
      content.append(
        emptyState({ iconName: 'people', title: 'No clients yet', text: 'Clients are the people and companies you send invoices to.' }),
        h('div', { class: 'group' }, h('button', { class: 'btn', type: 'button', onClick: () => openClientEditor(null) }, icon('plus'), 'Add Client'))
      );
      return;
    }
    const list = all.filter((c) => matchesClient(c, query));
    if (!list.length) { content.append(emptyState({ iconName: 'search', title: 'No results', text: `Nothing matches “${query}”.` })); return; }
    content.append(group({},
      ...list.map((c) => cell({
        title: c.name || 'Unnamed client',
        subtitle: clientSubtitle(c),
        subOneLine: true,
        avatar: avatar(initials(c.name), null, true),
        chevron: true,
        onClick: () => openClientEditor(c)
      }))
    ));
  }

  render();
  const off = store.onChange(render);
  screen.onHide = off;
  return screen;
}

// Opens the client editor as a sheet. Resolves with the saved client, or null.
export function openClientEditor(client, { presetName = '' } = {}) {
  const isNew = !client;
  const draft = isNew ? newClient({ name: presetName }) : { ...client };
  let dirty = !!presetName;
  const mark = () => { dirty = true; };
  let resolved = null;

  const supportsContacts = 'contacts' in navigator && 'ContactsManager' in window;

  const content = h('div', { class: 'content' },
    supportsContacts && isNew ? group({}, actionCell('Import from Contacts', { iconName: 'contacts', onClick: importContact })) : null,
    group({},
      field({ label: 'Name', value: draft.name, placeholder: 'Required', autocapitalize: 'words', stacked: true, autocomplete: 'name', onInput: (v) => { draft.name = v; mark(); } }),
      field({ label: 'Company', value: draft.company, placeholder: 'Optional', autocapitalize: 'words', stacked: true, autocomplete: 'organization', onInput: (v) => { draft.company = v; mark(); } })
    ),
    group({ header: 'Contact' },
      field({ label: 'Email', value: draft.email, placeholder: 'client@example.com', type: 'email', inputmode: 'email', autocapitalize: 'none', stacked: true, autocomplete: 'email', onInput: (v) => { draft.email = v.trim(); mark(); } }),
      field({ label: 'Phone', value: draft.phone, placeholder: 'Optional', type: 'tel', inputmode: 'tel', stacked: true, autocomplete: 'tel', onInput: (v) => { draft.phone = v; mark(); } }),
      field({ label: 'Billing address', value: draft.address, placeholder: 'Street\nCity, State ZIP', multiline: true, autocapitalize: 'words', onInput: (v) => { draft.address = v; mark(); } })
    ),
    group({},
      field({ label: 'Notes', value: draft.notes, placeholder: 'Private notes, not shown on documents', multiline: true, onInput: (v) => { draft.notes = v; mark(); } })
    ),
    isNew ? null : group({}, actionCell('Delete Client', { destructive: true, center: true, onClick: deleteClient }))
  );

  const sheetEl = h('div', {},
    topbar({
      title: isNew ? 'New Client' : 'Edit Client',
      left: barBtn('Cancel', { onClick: cancel }),
      right: barBtn('Save', { primary: true, onClick: save })
    }),
    content
  );

  async function importContact() {
    try {
      const picked = await navigator.contacts.select(['name', 'email', 'tel', 'address'], { multiple: false });
      const c = picked && picked[0];
      if (!c) return;
      const inputs = content.querySelectorAll('input, textarea');
      draft.name = (c.name && c.name[0]) || draft.name;
      draft.email = (c.email && c.email[0]) || draft.email;
      draft.phone = (c.tel && c.tel[0]) || draft.phone;
      const a = c.address && c.address[0];
      if (a) draft.address = [a.addressLine && a.addressLine.join('\n'), [a.city, a.region, a.postalCode].filter(Boolean).join(' '), a.country].filter(Boolean).join('\n');
      inputs[0].value = draft.name; inputs[2].value = draft.email; inputs[3].value = draft.phone; inputs[4].value = draft.address; inputs[4].fit && inputs[4].fit();
      mark();
    } catch (e) { console.error(e); }
  }

  async function cancel() {
    if (dirty && !(await confirm({ title: 'Discard changes?', confirmLabel: 'Discard' }))) return;
    nav.pop(null);
  }

  async function save() {
    draft.name = draft.name.trim();
    if (!draft.name) { toast('Please enter a name'); content.querySelector('input[autocomplete="name"]').focus(); return; }
    await store.save('clients', draft);
    haptic('success');
    resolved = draft;
    nav.pop(draft);
  }

  async function deleteClient() {
    const used = store.state.documents.filter((d) => d.clientId === draft.id).length;
    const ok = await confirm({ title: `Delete “${draft.name}”?`, message: used ? `${used} document${used === 1 ? '' : 's'} will keep their copy of the client details.` : '', confirmLabel: 'Delete' });
    if (!ok) return;
    await store.remove('clients', draft.id);
    nav.pop(null);
  }

  const p = nav.sheet(sheetEl);
  if (isNew) setTimeout(() => { const i = content.querySelector('input[autocomplete="name"]'); if (i) i.focus(); }, 450);
  return p.then((v) => v === undefined ? resolved : v);
}
