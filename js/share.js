// Delivering files: share sheet, email, print, save and downloads.
import * as store from './store.js';
import { generatePDF, buildContext, pdfFilename } from './pdf/index.js';
import { documentCSV, documentXlsx } from './exports.js';
import { computeTotals } from './totals.js';
import { formatMoney, formatDate, currencyDecimals } from './format.js';
import { markSent } from './docs.js';
import { toast, confirm, alert, actionSheet, haptic } from './ui.js';

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canShareFiles = (file) => !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));

export function fillTemplate(tpl, doc) {
  const business = store.business(doc.businessId);
  const client = store.client(doc.clientId);
  const totals = computeTotals(doc, currencyDecimals(doc.currency));
  const map = {
    number: doc.number || '', business: business ? business.name : '', client: client ? client.name : '',
    total: formatMoney(totals.total, doc.currency), date: formatDate(doc.issueDate),
    dueDate: doc.dueDate ? formatDate(doc.dueDate) : '', validUntil: doc.validUntil ? formatDate(doc.validUntil) : ''
  };
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

export function emailParts(doc) {
  const s = store.state.settings;
  const isInv = doc.kind === 'invoice';
  return {
    to: (store.client(doc.clientId) || {}).email || '',
    subject: fillTemplate(isInv ? s.emailSubjectInvoice : s.emailSubjectEstimate, doc),
    body: fillTemplate(isInv ? s.emailBodyInvoice : s.emailBodyEstimate, doc)
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Shares via the system share sheet when files are supported, otherwise downloads.
// Returns 'shared', 'downloaded' or 'cancelled'.
export async function deliverFile(blob, filename, { title = filename, text = '' } = {}) {
  const file = new File([blob], filename, { type: blob.type });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title, ...(text ? { text } : {}) });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      console.warn('share failed, falling back to download', e);
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

async function withBusy(label, fn) {
  toast(label, 60000);
  try { return await fn(); } finally { toast('', 1); }
}

export async function pdfFile(doc) {
  const { blob, filename } = await generatePDF(doc);
  return { blob: new Blob([blob], { type: 'application/pdf' }), filename };
}

// ---------- Send by email ----------
export async function sendDocument(doc) {
  const { to, subject, body } = emailParts(doc);
  if (!doc.clientId) { toast('Add a client before sending'); return; }
  if (!(doc.items || []).length) { const go = await confirm({ title: 'No items yet', message: 'This document has no line items. Send it anyway?', confirmLabel: 'Send', destructive: false }); if (!go) return; }
  let pdf;
  try { pdf = await withBusy('Preparing PDF…', () => pdfFile(doc)); } catch (e) { console.error(e); toast('Could not create the PDF'); return; }
  const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });

  if (canShareFiles(file)) {
    if (to) { try { await navigator.clipboard.writeText(to); } catch { /* ignore */ } }
    if (!store.state.settings.sendTipShown) {
      await alert({ title: 'How sending works', message: `Choose Mail (or any email app) in the share sheet. The PDF is attached and the subject and message are filled in.${to ? ` The client's address (${to}) has been copied so you can paste it into the To field.` : ''}`, buttons: [{ label: 'Got it', value: true, bold: true }] });
      await store.saveSettings({ sendTipShown: true });
    } else if (to) toast(`${to} copied — paste it into the To field`, 2600);
    let result;
    try {
      await navigator.share({ files: [file], title: subject, text: body });
      result = 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.warn(e); result = 'failed';
    }
    if (result === 'shared') await afterSend(doc);
    return;
  }

  // Fallback: no file sharing (desktop or older browsers). Download the PDF and open a mail draft.
  downloadBlob(pdf.blob, pdf.filename);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await alert({ title: 'Attach the PDF', message: `This browser cannot attach files automatically. The PDF “${pdf.filename}” has been downloaded. A new email will open next; attach the PDF before sending.`, buttons: [{ label: 'Open Email', value: true, bold: true }] });
  window.location.href = mailto;
  setTimeout(() => afterSend(doc), 1500);
}

async function afterSend(doc) {
  const isInv = doc.kind === 'invoice';
  const yes = await confirm({ title: 'Mark as sent?', message: isInv && doc.status === 'draft' ? 'The invoice will move from Draft to Outstanding.' : 'The sent date will be recorded.', confirmLabel: 'Mark as Sent', cancelLabel: 'Not yet', destructive: false });
  if (!yes) return;
  const latest = store.document(doc.id) || doc;
  await markSent(latest);
  haptic('success');
  toast(isInv ? 'Invoice sent' : 'Estimate sent');
}

// ---------- Share / print / save ----------
export async function shareMenu(doc) {
  const ios = isIOS();
  const v = await actionSheet({ title: 'PDF', actions: [
    { label: 'Share PDF…', value: 'share' },
    { label: 'Print', value: 'print' },
    { label: ios ? 'Save to Files' : 'Save PDF', value: 'save' }
  ] });
  if (!v) return;
  let pdf;
  try { pdf = await withBusy('Preparing PDF…', () => pdfFile(doc)); } catch (e) { console.error(e); toast('Could not create the PDF'); return; }
  if (v === 'share') return deliverFile(pdf.blob, pdf.filename, { title: pdf.filename });
  if (v === 'save') {
    const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
    if (ios && canShareFiles(file)) { toast('Choose “Save to Files” in the share sheet', 2600); return deliverFile(pdf.blob, pdf.filename); }
    downloadBlob(pdf.blob, pdf.filename); toast('PDF saved to Downloads'); return;
  }
  if (v === 'print') return printPDF(pdf);
}

export async function printPDF(pdf) {
  const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
  if (isIOS() && canShareFiles(file)) {
    toast('Choose “Print” in the share sheet', 2600);
    return deliverFile(pdf.blob, pdf.filename);
  }
  const url = URL.createObjectURL(pdf.blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  document.body.append(frame);
  frame.onload = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, '_blank'); } setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000); };
}

// ---------- Downloads: PDF / CSV / Excel ----------
export async function exportMenu(doc) {
  const v = await actionSheet({ title: 'Download as', actions: [
    { label: 'PDF', value: 'pdf' },
    { label: 'Excel (.xlsx)', value: 'xlsx' },
    { label: 'CSV', value: 'csv' }
  ] });
  if (!v) return;
  const ctx = await buildContext(doc);
  const base = pdfFilename(doc).replace(/\.pdf$/, '');
  let blob, filename;
  if (v === 'pdf') { const p = await withBusy('Preparing PDF…', () => pdfFile(doc)); blob = p.blob; filename = p.filename; }
  else if (v === 'csv') { blob = new Blob([documentCSV(doc, ctx)], { type: 'text/csv' }); filename = base + '.csv'; }
  else { blob = new Blob([documentXlsx(doc, ctx)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); filename = base + '.xlsx'; }
  const r = await deliverFile(blob, filename, { title: filename });
  if (r === 'downloaded') toast(`${filename} downloaded`);
}

export async function exportList(docs, name) {
  const { listCSV, listXlsx } = await import('./exports.js');
  const v = await actionSheet({ title: `Export ${name}`, actions: [{ label: 'Excel (.xlsx)', value: 'xlsx' }, { label: 'CSV', value: 'csv' }] });
  if (!v) return;
  const lookup = { client: (id) => store.client(id), business: (id) => store.business(id) };
  const date = new Date().toISOString().slice(0, 10);
  const blob = v === 'csv' ? new Blob([listCSV(docs, lookup)], { type: 'text/csv' }) : new Blob([listXlsx(docs, lookup, name)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `${name} ${date}.${v}`;
  const r = await deliverFile(blob, filename, { title: filename });
  if (r === 'downloaded') toast(`${filename} downloaded`);
}
