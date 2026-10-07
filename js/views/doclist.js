// One document list page (invoices or estimates): filter tabs, search, year groups, swipe actions, FAB.
import { h, topbar, barBtn, tabs, searchBar, emptyState, clear, toast, confirm, swipeRow, closeOpenSwipe, haptic, fab, icon } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { menuScreen } from './menu.js';
import { queryDocuments, statusInfo, sumTotals } from '../docquery.js';
import { computeTotals } from '../totals.js';
import { formatMoney, formatDate, currencyDecimals } from '../format.js';
import * as docs from '../docs.js';
import { openBusinessEditor } from './businesses.js';

const FILTERS = {
  invoice: [{ value: 'all', label: 'All' }, { value: 'outstanding', label: 'Outstanding' }, { value: 'paid', label: 'Paid' }],
  estimate: [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]
};

export const queryCtx = {
  clientName: (d) => (store.client(d.clientId) || {}).name || '',
  businessName: (d) => (store.business(d.businessId) || {}).name || '',
  places: 2
};

export function clientLabel(doc) {
  const c = store.client(doc.clientId);
  if (c) return c.name || c.company || 'Unnamed client';
  return 'No client';
}

export let openDocument = async (doc, opts) => { toast(`${doc.number}`); };
export function setOpenDocument(fn) { openDocument = fn; }

export function docListPage(kind) {
  const isInv = kind === 'invoice';
  const title = isInv ? 'Invoices' : 'Estimates';
  const ui = { filter: 'all', query: '', searching: false };

  const content = h('div', { class: 'content' });
  const searchWrap = h('div', { class: 'search-reveal hidden' });
  const search = searchBar({ placeholder: `Search ${title.toLowerCase()}`, onInput: (v) => { ui.query = v; render(); } });
  searchWrap.append(search);
  const filterTabs = tabs(FILTERS[kind], ui.filter, (v) => { ui.filter = v; render(); });
  const searchBtn = barBtn('', { iconName: 'search', ariaLabel: 'Search', onClick: toggleSearch });

  const page = h('div', { class: 'page' },
    topbar({
      title,
      left: barBtn('', { iconName: 'gear', ariaLabel: 'Settings', onClick: () => nav.push(menuScreen()) }),
      right: searchBtn,
      sub: h('div', {}, filterTabs, searchWrap),
      cls: 'tabs-bar'
    }),
    h('div', { class: 'page-wrap' }, content, fab(createNew, isInv ? 'New invoice' : 'New estimate'))
  );
  page.querySelector('.topbar-sub').classList.add('tabs-sub');
  content.addEventListener('scroll', closeOpenSwipe, { passive: true });

  function toggleSearch() {
    ui.searching = !ui.searching;
    searchWrap.classList.toggle('hidden', !ui.searching);
    if (ui.searching) { setTimeout(() => search.input.focus(), 50); }
    else { search.input.value = ''; search.classList.remove('has-text'); ui.query = ''; render(); }
  }

  function render() {
    clear(content);
    const all = store.state.documents.filter((d) => d.kind === kind);
    if (!all.length) {
      if (!store.state.businesses.length && !store.state.documents.length) {
        content.append(
          emptyState({ iconName: 'building', title: 'Welcome', text: 'Add your business details once and they appear on every invoice and estimate. Then tap + to create your first one.' }),
          h('div', { class: 'group' }, h('button', { class: 'btn', type: 'button', onClick: async () => { const b = await openBusinessEditor(null); if (b) toast('Business added. Tap + to create an invoice.'); } }, icon('plus'), 'Set Up Your Business'))
        );
      } else {
        content.append(emptyState({ iconName: isInv ? 'doc' : 'doc-text', title: `No ${title.toLowerCase()} yet`, text: 'Tap + to create one.' }));
      }
      return;
    }
    const list = queryDocuments(store.state.documents, { kind, filter: ui.filter, query: ui.query, ctx: queryCtx });
    if (!list.length) {
      const f = FILTERS[kind].find((x) => x.value === ui.filter);
      content.append(emptyState({ iconName: ui.query ? 'search' : (isInv ? 'doc' : 'doc-text'), title: ui.query ? 'No results' : `No ${ui.filter === 'all' ? '' : f.label.toLowerCase() + ' '}${title.toLowerCase()}`, text: ui.query ? `Nothing matches “${ui.query}” in ${f.label === 'All' ? 'all' : f.label.toLowerCase()} ${title.toLowerCase()}.` : '' }));
      return;
    }
    const listEl = h('div', { class: 'plain-list' });
    let year = null;
    let bucket = [];
    const flush = () => {
      if (!bucket.length) return;
      const cur = bucket[0].currency;
      const same = bucket.every((d) => d.currency === cur);
      listEl.append(h('div', { class: 'year-head' }, h('span', {}, String(year)), same ? h('strong', {}, formatMoney(sumTotals(bucket, currencyDecimals(cur)), cur)) : h('strong', {}, `${bucket.length} ${bucket.length === 1 ? 'document' : 'documents'}`)));
      bucket.forEach((d) => listEl.append(docRow(d)));
      bucket = [];
    };
    for (const d of list) {
      const y = (d.issueDate || '').slice(0, 4) || 'Undated';
      if (y !== year) { flush(); year = y; }
      bucket.push(d);
    }
    flush();
    content.append(listEl);
  }

  function docRow(doc) {
    const st = statusInfo(doc);
    const totals = computeTotals(doc, currencyDecimals(doc.currency));
    const row = h('button', { type: 'button', class: 'doc-row', onClick: () => openDocument(doc) },
      h('div', { class: 'doc-main' },
        h('div', { class: 'doc-client' }, clientLabel(doc)),
        h('div', { class: 'doc-meta' }, `${doc.number}${st.key === 'overdue' ? ' · Due ' + formatDate(doc.dueDate) : ' · ' + formatDate(doc.issueDate)}`)
      ),
      h('div', { class: 'doc-side' },
        h('div', { class: 'doc-total' }, formatMoney(totals.total, doc.currency)),
        h('span', { class: `doc-status ${st.color}` }, st.label)
      )
    );
    const actions = isInv ? [
      doc.status === 'paid'
        ? { label: 'Outstanding', color: 'orange', iconName: 'doc', onClick: () => { docs.setStatus(doc, 'outstanding'); haptic('medium'); } }
        : { label: 'Mark Paid', color: 'green', iconName: 'check', onClick: () => { docs.setStatus(doc, 'paid'); haptic('success'); toast(`${doc.number} marked as paid`); } },
      { label: 'Duplicate', color: 'blue', iconName: 'duplicate', onClick: () => duplicate(doc) },
      { label: 'Delete', color: 'red', iconName: 'trash', onClick: () => remove(doc) }
    ] : [
      doc.status === 'closed'
        ? { label: 'Reopen', color: 'blue', iconName: 'doc-text', onClick: () => { docs.setStatus(doc, 'open'); haptic('medium'); } }
        : { label: 'Close', color: 'gray', iconName: 'check', onClick: () => { docs.setStatus(doc, 'closed'); haptic('medium'); } },
      { label: 'To Invoice', color: 'green', iconName: 'arrow-right', onClick: () => convert(doc) },
      { label: 'Duplicate', color: 'blue', iconName: 'duplicate', onClick: () => duplicate(doc) },
      { label: 'Delete', color: 'red', iconName: 'trash', onClick: () => remove(doc) }
    ];
    return swipeRow(row, actions);
  }

  async function duplicate(doc) { const copy = await docs.duplicateDocument(doc); haptic('light'); toast(`Duplicated as ${copy.number}`); }
  async function convert(est) {
    if (est.convertedToId && store.document(est.convertedToId)) {
      const again = await confirm({ title: 'Already converted', message: 'This estimate was already converted to an invoice. Create another invoice from it?', confirmLabel: 'Create Invoice', destructive: false });
      if (!again) return;
    }
    const inv = await docs.convertToInvoice(est);
    haptic('success'); toast(`Created invoice ${inv.number}`);
  }
  async function remove(doc) {
    const ok = await confirm({ title: `Delete ${isInv ? 'invoice' : 'estimate'} ${doc.number}?`, message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    await docs.deleteDocument(doc); haptic('medium');
  }
  async function createNew() {
    let biz = store.defaultBusiness();
    if (!biz) {
      const go = await confirm({ title: 'Add your business first', message: 'Your business name and details appear at the top of every document. It only takes a moment.', confirmLabel: 'Add Business', destructive: false });
      if (!go) return;
      biz = await openBusinessEditor(null);
      if (!biz) return;
    }
    const doc = await docs.createDocument(kind, { business: biz });
    haptic('light');
    openDocument(doc, { fresh: true });
  }

  render();
  store.onChange(render);
  page.refresh = render;
  return page;
}
