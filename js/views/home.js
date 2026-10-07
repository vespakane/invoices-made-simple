// Root screen: bottom tab bar switching between Invoices, Estimates and Contacts.
import { h, tabbar, closeOpenSwipe } from '../ui.js';
import { docListPage, setOpenDocument, openDocument, queryCtx, clientLabel } from './doclist.js';
import { contactsPage } from './contacts.js';

export { setOpenDocument, openDocument, queryCtx, clientLabel };

export function homeScreen() {
  const pages = { invoice: docListPage('invoice'), estimate: docListPage('estimate'), contacts: contactsPage() };
  let active = null;
  const wrap = h('div', { class: 'page-wrap' }, pages.invoice, pages.estimate, pages.contacts);
  const bar = tabbar([
    { value: 'invoice', label: 'Invoices', icon: 'doc' },
    { value: 'estimate', label: 'Estimates', icon: 'doc-text' },
    { value: 'contacts', label: 'Contacts', icon: 'people' }
  ], 'invoice', (v) => show(v));
  function show(v) {
    closeOpenSwipe();
    if (v === active) { const c = pages[v].querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    active = v;
    for (const [k, p] of Object.entries(pages)) p.classList.toggle('hidden', k !== v);
  }
  show('invoice');
  return h('div', { class: 'screen' }, wrap, bar);
}
