import { h, topbar, backBtn, barBtn, group, cell, actionCell, field, selectField, dateField, icon, confirm, toast, haptic, clear, actionSheet, actionCell as _ac } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { PAYMENT_TERMS, newLineItem, newSection, uid, nowISO } from '../models.js';
import { Dec } from '../dec.js';
import { formatMoney, formatDate, formatQuantity, currencyDecimals, currencySymbol, CURRENCIES, addDays } from '../format.js';
import { computeTotals } from '../totals.js';
import { statusInfo } from '../docquery.js';
import { isNumberTaken } from '../numbering.js';
import * as docs from '../docs.js';
import { pickClient, pickBusiness } from './pickers.js';
import { openItemEditor, openSectionEditor } from './itemEditor.js';
import { openClientEditor } from './clients.js';
import { openBusinessEditor } from './businesses.js';

// Hooks filled in by later phases (PDF preview, sending, exports).
export const actions = {
  preview: async (doc) => toast('PDF preview arrives in Phase 4'),
  send: async (doc) => toast('Sending arrives in Phase 5'),
  share: async (doc) => toast('Sharing arrives in Phase 5'),
  exportMenu: async (doc) => toast('Downloads arrive in Phase 5')
};

export function editorScreen(docId, { fresh = false } = {}) {
  let doc = structuredClone(store.document(docId));
  if (!doc) return h('div', {}, topbar({ title: 'Not found', left: backBtn(() => nav.pop()) }));
  const isInv = doc.kind === 'invoice';
  const kindLabel = isInv ? 'Invoice' : 'Estimate';
  let saveTimer = null;
  let places = currencyDecimals(doc.currency);

  // ---------- persistence ----------
  function touch(immediate = false) {
    doc.updatedAt = nowISO();
    refreshTotals();
    clearTimeout(saveTimer);
    if (immediate) return persist();
    saveTimer = setTimeout(persist, 400);
  }
  async function persist() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!store.document(doc.id)) return; // deleted meanwhile
    await store.save('documents', structuredClone(doc));
  }

  // ---------- header ----------
  const titleEl = h('span', {}, doc.number || kindLabel);
  const screen = h('div', {},
    topbar({
      title: titleEl,
      left: backBtn(async () => { await persist(); nav.pop(); }, 'Back'),
      right: barBtn('', { iconName: 'ellipsis', ariaLabel: 'More actions', onClick: moreMenu })
    })
  );
  const content = h('div', { class: 'content has-footer' });
  screen.append(content);

  // ---------- parties ----------
  const partiesGroup = h('div');
  function renderParties() {
    clear(partiesGroup);
    const biz = store.business(doc.businessId);
    const cl = store.client(doc.clientId);
    const st = statusInfo(doc);
    partiesGroup.append(group({},
      cell({ title: 'From', value: biz ? biz.name : 'Choose business', chevron: true, cls: biz ? '' : 'attention', onClick: async () => { const b = await pickBusiness(doc.businessId); if (b) { applyBusiness(b); } } }),
      cell({ title: 'To', value: cl ? cl.name : 'Add client', chevron: true, cls: cl ? '' : 'attention', onClick: chooseClient }),
      cell({ title: 'Status', right: h('span', { class: `badge ${st.color}` }, st.label), chevron: true, onClick: statusMenu })
    ));
  }
  function applyBusiness(b) {
    const prev = store.business(doc.businessId);
    doc.businessId = b.id;
    if (!doc.paymentInstructions || (prev && doc.paymentInstructions === prev.paymentInstructions)) doc.paymentInstructions = b.paymentInstructions || '';
    if (!doc.notes || (prev && doc.notes === prev.defaultNotes)) doc.notes = b.defaultNotes || '';
    renderParties(); renderNotes(); touch();
  }
  async function chooseClient() {
    const c = await pickClient(doc.clientId);
    if (c) { doc.clientId = c.id; renderParties(); touch(); }
  }

  // ---------- details ----------
  const detailsGroup = h('div');
  function renderDetails() {
    clear(detailsGroup);
    const numberField = field({ label: 'Number', value: doc.number, placeholder: isInv ? 'INV-0001' : 'EST-0001', autocapitalize: 'characters', onInput: (v) => { doc.number = v.trim(); titleEl.textContent = doc.number || kindLabel; touch(); }, onChange: (v) => { if (isNumberTaken(store.state.documents, doc.kind, v, doc.id)) toast(`${v} is already used by another ${kindLabel.toLowerCase()}`); const b = store.business(doc.businessId); if (b) docs.bumpCounter(b, doc.kind, v); } });
    const rows = [numberField, dateField({ label: 'Date', value: doc.issueDate, onChange: (v) => { if (!v) return; const delta = v; doc.issueDate = v; if (isInv && doc.paymentTerms !== 'custom') doc.dueDate = docs.dueDateFor(v, doc.paymentTerms); renderDetails(); touch(); } })];
    if (isInv) {
      rows.push(selectField({ label: 'Terms', value: doc.paymentTerms, options: PAYMENT_TERMS.map((t) => ({ value: t.id, label: t.label })), onChange: (v) => { doc.paymentTerms = v; if (v !== 'custom') doc.dueDate = docs.dueDateFor(doc.issueDate, v); renderDetails(); touch(); } }));
      rows.push(dateField({ label: 'Due date', value: doc.dueDate, onChange: (v) => { if (!v) return; doc.dueDate = v; doc.paymentTerms = 'custom'; renderDetails(); touch(); } }));
    } else {
      rows.push(dateField({ label: 'Valid until', value: doc.validUntil, onChange: (v) => { if (!v) return; doc.validUntil = v; touch(); } }));
    }
    detailsGroup.append(group({ header: 'Details' }, ...rows));
  }

  // ---------- items ----------
  const itemsGroup = h('div');
  function renderItems() {
    clear(itemsGroup);
    const totals = computeTotals(doc, places);
    const list = h('div', { class: 'cells items-list' });
    if (!doc.items.length) {
      list.append(h('div', { class: 'items-empty' }, 'No items yet. Add what you are charging for.'));
    }
    doc.items.forEach((it, idx) => {
      let row;
      if (it.type === 'section') {
        const sec = totals.sections.find((s) => s.id === it.id);
        row = h('div', { class: 'item-row section-row' },
          h('button', { type: 'button', class: 'item-body', onClick: () => editSection(it) },
            h('div', { class: 'section-title' }, it.title || 'Section'),
            h('div', { class: 'section-sub' }, sec && sec.count ? `${sec.count} item${sec.count === 1 ? '' : 's'} · ${formatMoney(sec.subtotal, doc.currency)}` : 'No items')
          ),
          dragHandle()
        );
      } else {
        const line = totals.lines.find((l) => l.id === it.id);
        row = h('div', { class: 'item-row' },
          h('button', { type: 'button', class: 'item-body', onClick: () => editItem(it) },
            h('div', { class: 'item-main' },
              h('div', { class: 'item-title' }, it.title || 'Untitled item'),
              it.details ? h('div', { class: 'item-details' }, firstLine(it.details)) : null,
              h('div', { class: 'item-qty' }, `${formatQuantity(it.quantity)} × ${formatMoney(it.unitPrice, doc.currency)}`)
            ),
            h('div', { class: 'item-total mono' }, formatMoney(line ? line.total : 0, doc.currency))
          ),
          dragHandle()
        );
      }
      row.dataset.id = it.id;
      enableDrag(row, list);
      list.append(row);
    });
    list.append(
      actionCell('Add Item', { iconName: 'plus', onClick: addItem }),
      actionCell('Add Section Heading', { iconName: 'list', onClick: addSection })
    );
    itemsGroup.append(h('section', { class: 'group' }, h('div', { class: 'group-header' }, 'Items'), list));
  }
  function firstLine(text) { return (text || '').split('\n').map((l) => l.trim()).filter(Boolean)[0] || ''; }
  function dragHandle() {
    return h('div', { class: 'drag-handle', 'aria-label': 'Reorder', role: 'button' }, icon('grip'));
  }
  async function addItem() {
    const r = await openItemEditor(null, { currency: doc.currency, isNew: true });
    if (r.action === 'save') { doc.items.push(r.item); renderItems(); touch(); haptic('light'); }
  }
  async function addSection() {
    const r = await openSectionEditor(newSection(), { isNew: true });
    if (r.action === 'save') { doc.items.push(r.item); renderItems(); touch(); }
  }
  async function editItem(it) {
    const r = await openItemEditor(it, { currency: doc.currency });
    applyItemResult(it, r);
  }
  async function editSection(it) {
    const r = await openSectionEditor(it);
    applyItemResult(it, r);
  }
  function applyItemResult(it, r) {
    const i = doc.items.findIndex((x) => x.id === it.id);
    if (i < 0 || r.action === 'cancel') return;
    if (r.action === 'delete') doc.items.splice(i, 1); else doc.items[i] = r.item;
    renderItems(); touch();
  }

  // Drag to reorder via the handle (pointer events, works for touch and mouse).
  function enableDrag(row, list) {
    const handle = row.querySelector('.drag-handle');
    handle.addEventListener('click', (e) => e.stopPropagation());
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const rows = () => [...list.querySelectorAll('.item-row')];
      const all = rows();
      const startIndex = all.indexOf(row);
      const hgt = row.offsetHeight;
      const startY = e.clientY;
      let target = startIndex;
      let raf = null; let lastY = e.clientY; let scrollDelta = 0;
      row.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      haptic('light');
      const layout = () => {
        const dy = lastY - startY + scrollDelta;
        row.style.transform = `translateY(${dy}px)`;
        const center = row.getBoundingClientRect().top + hgt / 2;
        const others = all.filter((r) => r !== row);
        let t = 0;
        for (const o of others) { const r = o.getBoundingClientRect(); if (center > r.top + r.height / 2) t++; }
        target = t;
        others.forEach((o, j) => {
          const origIndex = j < startIndex ? j : j + 1;
          let shift = 0;
          if (origIndex > startIndex && origIndex <= target) shift = -hgt;
          else if (origIndex < startIndex && origIndex >= target) shift = hgt;
          o.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const onMove = (ev) => {
        lastY = ev.clientY;
        const rect = content.getBoundingClientRect();
        const edge = 70;
        let sp = 0;
        if (ev.clientY < rect.top + edge) sp = -Math.ceil((rect.top + edge - ev.clientY) / 8);
        else if (ev.clientY > rect.bottom - edge - 90) sp = Math.ceil((ev.clientY - (rect.bottom - edge - 90)) / 8);
        if (sp && !raf) {
          const step = () => { const before = content.scrollTop; content.scrollTop += sp; scrollDelta += content.scrollTop - before; layout(); raf = requestAnimationFrame(step); };
          raf = requestAnimationFrame(step);
        } else if (!sp && raf) { cancelAnimationFrame(raf); raf = null; }
        layout();
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        if (raf) cancelAnimationFrame(raf);
        row.classList.remove('dragging');
        all.forEach((r) => { r.style.transform = ''; });
        if (target !== startIndex) {
          const [moved] = doc.items.splice(startIndex, 1);
          doc.items.splice(target, 0, moved);
          haptic('medium');
          touch();
        }
        renderItems();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  // ---------- totals ----------
  const totalsGroup = h('div');
  const footerTotal = h('div', { class: 'footer-total mono' });
  const footerLabel = h('div', { class: 'footer-label' }, isInv ? 'Balance due' : 'Total');
  function renderTotalsGroup() {
    clear(totalsGroup);
    const discountType = selectField({ label: 'Discount', value: doc.discountType, options: [{ value: 'none', label: 'None' }, { value: 'percent', label: 'Percent' }, { value: 'fixed', label: 'Amount' }], onChange: (v) => { doc.discountType = v; if (v === 'none') doc.discountValue = '0'; renderTotalsGroup(); touch(); if (v !== 'none') setTimeout(() => { const i = totalsGroup.querySelector('.discount-value'); if (i) i.focus(); }, 50); } });
    const discountValue = doc.discountType === 'none' ? null : h('div', { class: 'field' }, h('label', {}, doc.discountType === 'percent' ? 'Discount %' : `Discount (${currencySymbol(doc.currency)})`), h('input', { class: 'discount-value mono', inputmode: 'decimal', placeholder: '0', value: Dec.from(doc.discountValue).isZero() ? '' : doc.discountValue, onInput: (e) => { doc.discountValue = e.target.value; touch(); } }));
    const taxRow = h('div', { class: 'field tax-row' },
      h('input', { class: 'tax-label', placeholder: 'Tax', value: doc.taxLabel || '', autocapitalize: 'words', 'aria-label': 'Tax label', onInput: (e) => { doc.taxLabel = e.target.value; touch(); } }),
      h('div', { class: 'tax-rate' }, h('input', { inputmode: 'decimal', placeholder: '0', value: Dec.from(doc.taxRate).isZero() ? '' : doc.taxRate, 'aria-label': 'Tax rate', onInput: (e) => { doc.taxRate = e.target.value; touch(); } }), h('span', {}, '%'))
    );
    const summary = h('div', { class: 'totals-summary' });
    totalsGroup.append(group({ header: 'Totals', footer: 'Tax is applied after the discount.' }, discountType, discountValue, taxRow, summary));
    totalsGroup.summary = summary;
    refreshTotals();
  }
  function refreshTotals() {
    const t = computeTotals(doc, places);
    const s = totalsGroup.summary; if (!s) return;
    clear(s);
    const line = (label, value, cls = '') => h('div', { class: `tl ${cls}` }, h('span', {}, label), h('span', { class: 'mono' }, value));
    s.append(line('Subtotal', formatMoney(t.subtotal, doc.currency)));
    if (!t.discount.isZero()) s.append(line(`Discount${doc.discountType === 'percent' ? ` (${Dec.from(doc.discountValue).toString()}%)` : ''}`, '−' + formatMoney(t.discount, doc.currency)));
    if (!t.taxRate.isZero()) s.append(line(`${doc.taxLabel || 'Tax'} (${t.taxRate.toString()}%)`, formatMoney(t.tax, doc.currency)));
    s.append(line('Total', formatMoney(t.total, doc.currency), 'grand'));
    if (isInv && doc.status === 'paid') s.append(line('Balance due', formatMoney(0, doc.currency), 'paid'));
    footerTotal.textContent = formatMoney(isInv ? t.balance : t.total, doc.currency);
  }

  // ---------- notes ----------
  const notesGroup = h('div');
  function renderNotes() {
    clear(notesGroup);
    notesGroup.append(
      group({ header: 'Notes' },
        field({ label: 'Notes', value: doc.notes, placeholder: 'Shown on the document, e.g. “Thank you for your business!”', multiline: true, onInput: (v) => { doc.notes = v; touch(); } }),
        field({ label: 'Terms', value: doc.terms, placeholder: 'Optional terms and conditions', multiline: true, onInput: (v) => { doc.terms = v; touch(); } }),
        isInv ? field({ label: 'Payment instructions', value: doc.paymentInstructions, placeholder: 'Bank details, PayPal, etc.', multiline: true, onInput: (v) => { doc.paymentInstructions = v; touch(); } }) : null
      ),
      group({},
        selectField({ label: 'Currency', value: doc.currency, options: CURRENCIES.map((c) => ({ value: c, label: `${c} (${currencySymbol(c)})` })), onChange: (v) => { doc.currency = v; places = currencyDecimals(v); renderItems(); renderTotalsGroup(); touch(); } })
      ),
      group({}, actionCell(`Delete ${kindLabel}`, { destructive: true, center: true, onClick: remove }))
    );
  }

  // ---------- footer ----------
  const footer = h('div', { class: 'editor-footer' },
    h('div', { class: 'footer-sum' }, footerLabel, footerTotal),
    h('button', { type: 'button', class: 'btn secondary footer-btn', onClick: () => actions.preview(doc) }, icon('eye'), 'Preview'),
    h('button', { type: 'button', class: 'btn footer-btn', onClick: () => actions.send(doc) }, icon('send'), 'Send')
  );
  screen.append(footer);

  // ---------- menus ----------
  async function statusMenu() {
    const opts = isInv
      ? [doc.status !== 'paid' ? { label: 'Mark as Paid', value: 'paid' } : null, doc.status !== 'outstanding' ? { label: 'Mark as Outstanding', value: 'outstanding' } : null, doc.status !== 'draft' ? { label: 'Mark as Draft', value: 'draft' } : null].filter(Boolean)
      : [doc.status !== 'open' ? { label: 'Reopen', value: 'open' } : null, doc.status !== 'closed' ? { label: 'Close Estimate', value: 'closed' } : null].filter(Boolean);
    const v = await actionSheet({ title: 'Change status', actions: opts });
    if (!v) return;
    doc.status = v;
    if (isInv) doc.paidAt = v === 'paid' ? nowISO() : null;
    haptic(v === 'paid' ? 'success' : 'light');
    renderParties(); touch(true);
  }
  async function moreMenu() {
    const items = [
      { label: 'Preview PDF', value: 'preview' },
      { label: 'Send…', value: 'send' },
      { label: 'Share / Print / Save…', value: 'share' },
      { label: 'Download PDF, CSV or Excel…', value: 'export' },
      isInv ? (doc.status === 'paid' ? { label: 'Mark as Outstanding', value: 'outstanding' } : { label: 'Mark as Paid', value: 'paid' }) : (doc.status === 'closed' ? { label: 'Reopen Estimate', value: 'open' } : { label: 'Close Estimate', value: 'closed' }),
      !isInv ? { label: 'Convert to Invoice', value: 'convert' } : null,
      { label: 'Duplicate', value: 'duplicate' },
      { label: `Delete ${kindLabel}`, value: 'delete', destructive: true }
    ].filter(Boolean);
    const v = await actionSheet({ actions: items });
    if (!v) return;
    await persist();
    if (v === 'preview') return actions.preview(doc);
    if (v === 'send') return actions.send(doc);
    if (v === 'share') return actions.share(doc);
    if (v === 'export') return actions.exportMenu(doc);
    if (['paid', 'outstanding', 'open', 'closed'].includes(v)) { doc.status = v; if (isInv) doc.paidAt = v === 'paid' ? nowISO() : null; renderParties(); haptic('success'); return touch(true); }
    if (v === 'duplicate') { const copy = await docs.duplicateDocument(doc); toast(`Duplicated as ${copy.number}`); await nav.pop(); return openEditor(copy.id); }
    if (v === 'convert') { const inv = await docs.convertToInvoice(doc); toast(`Created invoice ${inv.number}`); await nav.pop(); return openEditor(inv.id); }
    if (v === 'delete') return remove();
  }
  async function remove() {
    const ok = await confirm({ title: `Delete ${kindLabel.toLowerCase()} ${doc.number}?`, message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    clearTimeout(saveTimer); saveTimer = null;
    await docs.deleteDocument(doc);
    haptic('medium');
    nav.pop();
  }

  // ---------- assemble ----------
  content.append(partiesGroup, detailsGroup, itemsGroup, totalsGroup, notesGroup);
  renderParties(); renderDetails(); renderItems(); renderTotalsGroup(); renderNotes();

  // Keep in sync if the record changes elsewhere (e.g. swipe action on the list, client renamed).
  const off = store.onChange((what) => {
    if (what === 'documents') { const latest = store.document(doc.id); if (latest && latest.updatedAt > doc.updatedAt && !saveTimer) { doc = structuredClone(latest); renderParties(); refreshTotals(); } }
    if (what === 'clients' || what === 'businesses') renderParties();
  });
  screen.onHide = () => { off(); if (saveTimer) persist(); };
  screen.onShow = () => {
    if (fresh && !doc.clientId) setTimeout(chooseClient, 420);
  };
  return screen;
}

export function openEditor(docId, opts) {
  return nav.push(editorScreen(docId, opts));
}
