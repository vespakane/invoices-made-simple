import { h, topbar, barBtn, segmented, pills, searchBar, emptyState, clear, toast, confirm, swipeRow, closeOpenSwipe, haptic, actionSheet, icon, isStandalone } from '../ui.js';
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
  return doc.clientSnapshot ? doc.clientSnapshot.name : 'No client';
}

// Hook for later phases: opening a document. Replaced by the editor in Phase 3.
export let openDocument = async (doc, opts) => { toast(`${doc.number}: editor arrives in Phase 3`); };
export function setOpenDocument(fn) { openDocument = fn; }

export function homeScreen() {
  const ui = { kind: 'invoice', filter: { invoice: 'all', estimate: 'all' }, query: { invoice: '', estimate: '' } };

  const content = h('div', { class: 'content' });
  const filterRow = h('div');
  const search = searchBar({ placeholder: 'Search invoices', onInput: (v) => { ui.query[ui.kind] = v; renderList(); } });

  const seg = segmented(
    [{ value: 'invoice', label: 'Invoices' }, { value: 'estimate', label: 'Estimates' }],
    ui.kind,
    (v) => { ui.kind = v; search.input.value = ui.query[v]; search.classList.toggle('has-text', !!ui.query[v]); search.input.placeholder = v === 'invoice' ? 'Search invoices' : 'Search estimates'; renderFilters(); renderList(); }
  );
  seg.style.width = 'min(260px, 52vw)';

  const plus = barBtn('', { iconName: 'plus', cls: 'plus', ariaLabel: 'New invoice', onClick: () => createNew() });

  const screen = h('div', { class: 'screen' },
    topbar({
      title: seg,
      left: barBtn('', { iconName: 'gear', ariaLabel: 'Settings', onClick: () => nav.push(menuScreen()) }),
      right: plus,
      sub: h('div', {}, filterRow, search)
    }),
    content
  );
  content.addEventListener('scroll', closeOpenSwipe, { passive: true });

  function renderFilters() {
    clear(filterRow);
    filterRow.append(pills(FILTERS[ui.kind], ui.filter[ui.kind], (v) => { ui.filter[ui.kind] = v; renderList(); }));
    plus.setAttribute('aria-label', ui.kind === 'invoice' ? 'New invoice' : 'New estimate');
  }

  function renderList() {
    clear(content);
    const isInv = ui.kind === 'invoice';
    const filter = ui.filter[ui.kind];
    const query = ui.query[ui.kind];
    const all = store.state.documents.filter((d) => d.kind === ui.kind);
    if (!all.length) {
      if (!store.state.businesses.length && !store.state.documents.length) {
        content.append(
          emptyState({ iconName: 'building', title: 'Welcome', text: 'Add your business details once and they appear on every invoice and estimate. Then tap + to create your first one.' }),
          h('div', { class: 'group' }, h('button', { class: 'btn', type: 'button', onClick: async () => { const b = await openBusinessEditor(null); if (b) toast('Business added. Tap + to create an invoice.'); } }, icon('plus'), 'Set Up Your Business'))
        );
      } else {
        content.append(emptyState({ iconName: isInv ? 'doc' : 'doc-text', title: isInv ? 'No invoices yet' : 'No estimates yet', text: 'Tap + to create one.' }));
      }
      installTip();
      return;
    }
    installTip();
    const list = queryDocuments(store.state.documents, { kind: ui.kind, filter, query, ctx: queryCtx });
    if (!list.length) {
      const f = FILTERS[ui.kind].find((x) => x.value === filter);
      content.append(emptyState({ iconName: query ? 'search' : (isInv ? 'doc' : 'doc-text'), title: query ? 'No results' : `No ${filter === 'all' ? '' : f.label.toLowerCase() + ' '}${isInv ? 'invoices' : 'estimates'}`, text: query ? `Nothing matches “${query}” in ${f.label === 'All' ? 'all' : f.label.toLowerCase()} ${isInv ? 'invoices' : 'estimates'}.` : '' }));
      return;
    }
    const currency = list[0].currency;
    const sameCurrency = list.every((d) => d.currency === currency);
    const summaryLabel = isInv ? (filter === 'paid' ? 'Paid' : filter === 'outstanding' ? 'Outstanding' : 'Total') : (filter === 'all' ? 'Total' : filter === 'open' ? 'Open' : 'Closed');
    content.append(
      h('div', { class: 'list-summary' }, h('span', {}, `${list.length} ${isInv ? 'invoice' : 'estimate'}${list.length === 1 ? '' : 's'}`), sameCurrency ? h('span', {}, `${summaryLabel} `, h('strong', {}, formatMoney(sumTotals(list, currencyDecimals(currency)), currency))) : null),
      h('section', { class: 'group' }, h('div', { class: 'cells' }, ...list.map(docRow)))
    );
  }

  function installTip() {
    const ua = navigator.userAgent;
    const iosSafari = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!iosSafari || isStandalone() || store.state.settings.installTipDismissed) return;
    content.prepend(h('div', { class: 'install-tip', role: 'note' },
      icon('share'),
      h('div', { class: 'tip-text' }, h('strong', {}, 'Add to your Home Screen'), 'Tap the Share button below, then “Add to Home Screen”. The app then opens full screen and works offline.'),
      h('button', { type: 'button', 'aria-label': 'Dismiss', onClick: () => { store.saveSettings({ installTipDismissed: true }); } }, icon('xmark'))
    ));
  }

  function docRow(doc) {
    const st = statusInfo(doc);
    const totals = computeTotals(doc, currencyDecimals(doc.currency));
    const row = h('button', { type: 'button', class: 'doc-row', onClick: () => openDocument(doc) },
      h('div', { class: 'doc-main' },
        h('div', { class: 'doc-client' }, clientLabel(doc)),
        h('div', { class: 'doc-meta' }, `${doc.number} · ${st.key === 'overdue' ? 'Due ' + formatDate(doc.dueDate) : formatDate(doc.issueDate)}`)
      ),
      h('div', { class: 'doc-side' },
        h('div', { class: 'doc-total' }, formatMoney(totals.total, doc.currency)),
        h('span', { class: `badge ${st.color}` }, st.label)
      )
    );
    const actions = doc.kind === 'invoice' ? [
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

  async function duplicate(doc) {
    const copy = await docs.duplicateDocument(doc);
    haptic('light');
    toast(`Duplicated as ${copy.number}`);
  }

  async function convert(est) {
    if (est.convertedToId && store.document(est.convertedToId)) {
      const again = await confirm({ title: 'Already converted', message: `This estimate was already converted to an invoice. Create another invoice from it?`, confirmLabel: 'Create Invoice', destructive: false });
      if (!again) return;
    }
    const inv = await docs.convertToInvoice(est);
    haptic('success');
    toast(`Created invoice ${inv.number}`);
  }

  async function remove(doc) {
    const ok = await confirm({ title: `Delete ${doc.kind === 'invoice' ? 'invoice' : 'estimate'} ${doc.number}?`, message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    await docs.deleteDocument(doc);
    haptic('medium');
  }

  async function createNew() {
    let biz = store.defaultBusiness();
    if (!biz) {
      const go = await confirm({ title: 'Add your business first', message: 'Your business name and details appear at the top of every document. It only takes a moment.', confirmLabel: 'Add Business', destructive: false });
      if (!go) return;
      biz = await openBusinessEditor(null);
      if (!biz) return;
    }
    const doc = await docs.createDocument(ui.kind, { business: biz });
    haptic('light');
    openDocument(doc, { fresh: true });
  }

  renderFilters();
  renderList();
  store.onChange(renderList);
  return screen;
}
