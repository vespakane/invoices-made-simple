import { h, topbar, backBtn, group, cell, field, selectField, segmented, toast, clear, icon } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { CURRENCIES, currencySymbol } from '../format.js';
import { PAYMENT_TERMS } from '../models.js';

const ACCENTS = ['#2563EB', '#0F766E', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#111827'];

function settingsField(key, opts) {
  const s = store.state.settings;
  return field({ ...opts, value: s[key] ?? '', onInput: (v) => { store.saveSettings({ [key]: opts.numeric ? v.replace(/[^\d.,]/g, '') : v }); } });
}

export function defaultsScreen() {
  const s = store.state.settings;
  const content = h('div', { class: 'content' },
    group({ header: 'New documents', footer: 'These are used when you create a new invoice or estimate. You can change them on each document.' },
      selectField({ label: 'Currency', value: s.currency, options: CURRENCIES.map((c) => ({ value: c, label: `${c} (${currencySymbol(c)})` })), onChange: (v) => store.saveSettings({ currency: v }) }),
      settingsField('taxLabel', { label: 'Tax label', placeholder: 'Tax, VAT, GST…', autocapitalize: 'words' }),
      settingsField('taxRate', { label: 'Tax rate %', placeholder: '0', inputmode: 'decimal', numeric: true }),
      selectField({ label: 'Payment terms', value: s.paymentTerms, options: PAYMENT_TERMS.filter((t) => t.id !== 'custom').map((t) => ({ value: t.id, label: t.label })), onChange: (v) => store.saveSettings({ paymentTerms: v }) }),
      field({ label: 'Estimates valid for', value: String(s.estimateValidDays || 30), inputmode: 'numeric', placeholder: '30', onInput: (v) => { const n = parseInt(v, 10); if (n > 0) store.saveSettings({ estimateValidDays: n }); } })
    ),
    group({ header: 'Numbering', footer: 'Numbers count up separately for each business. Set the next number for a business in its details under Businesses.' },
      settingsField('invoicePrefix', { label: 'Invoice prefix', placeholder: 'INV-', autocapitalize: 'characters' }),
      settingsField('estimatePrefix', { label: 'Estimate prefix', placeholder: 'EST-', autocapitalize: 'characters' }),
      selectField({ label: 'Digits', value: String(s.numberPadding || 4), options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} (${'1'.padStart(n, '0')})` })), onChange: (v) => store.saveSettings({ numberPadding: parseInt(v, 10) }) })
    )
  );
  return h('div', {}, topbar({ title: 'Defaults', left: backBtn(() => nav.pop()) }), content);
}

export function styleScreen() {
  const s = store.state.settings;
  const swatches = h('div', { class: 'swatches' });
  const custom = h('input', { type: 'color', value: s.accentColor || '#2563EB', 'aria-label': 'Custom color' });
  function render() {
    clear(swatches);
    const current = (store.state.settings.accentColor || '').toLowerCase();
    for (const c of ACCENTS) {
      swatches.append(h('button', { type: 'button', class: `swatch ${current === c.toLowerCase() ? 'on' : ''}`, style: { background: c }, 'aria-label': c, onClick: () => { store.saveSettings({ accentColor: c }); custom.value = c; render(); } }, current === c.toLowerCase() ? icon('check') : null));
    }
    const isCustom = !ACCENTS.map((x) => x.toLowerCase()).includes(current);
    swatches.append(h('label', { class: `swatch custom ${isCustom ? 'on' : ''}`, style: isCustom ? { background: current } : null, 'aria-label': 'Custom color' }, isCustom ? icon('check') : null, custom));
  }
  custom.addEventListener('input', () => { store.saveSettings({ accentColor: custom.value }); render(); });
  render();
  const content = h('div', { class: 'content' },
    group({ header: 'Accent color', footer: 'Used for headings and highlights on PDFs. Tap the last swatch to pick any color.' }, h('div', { class: 'field stacked' }, swatches)),
    group({ header: 'Page size' }, h('div', { class: 'field' }, segmented([{ value: 'letter', label: 'US Letter' }, { value: 'a4', label: 'A4' }], s.pageSize || 'letter', (v) => store.saveSettings({ pageSize: v }))))
  );
  return h('div', {}, topbar({ title: 'Document Style', left: backBtn(() => nav.pop()) }), content);
}

export function templatesScreen() {
  const tpl = (key, label) => field({ label, value: store.state.settings[key], multiline: true, onInput: (v) => store.saveSettings({ [key]: v }) });
  const content = h('div', { class: 'content' },
    group({ header: 'Invoices' }, tpl('emailSubjectInvoice', 'Subject'), tpl('emailBodyInvoice', 'Message')),
    group({ header: 'Estimates' }, tpl('emailSubjectEstimate', 'Subject'), tpl('emailBodyEstimate', 'Message')),
    group({ header: 'Placeholders', footer: 'These are replaced when you send: {number}, {business}, {client}, {total}, {date}, {dueDate}, {validUntil}.' })
  );
  return h('div', {}, topbar({ title: 'Email Templates', left: backBtn(() => nav.pop()) }), content);
}
