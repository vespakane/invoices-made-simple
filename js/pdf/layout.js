// Document layout shared by the PDF file and the on-screen preview.
import { formatMoney, formatDate, formatQuantity } from '../format.js';
import { Dec } from '../dec.js';
import { PAYMENT_TERMS } from '../models.js';

const C = { text: '#111827', muted: '#6B7280', faint: '#9CA3AF', line: '#E5E7EB', fill: '#F3F4F6', white: '#FFFFFF', green: '#15803D' };

export function parseDetails(text) {
  const blocks = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) { if (blocks.length && blocks[blocks.length - 1].type !== 'gap') blocks.push({ type: 'gap' }); continue; }
    const m = /^([-–•*‣◦]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) blocks.push(/^\d/.test(m[1]) ? { type: 'num', label: m[1].replace(')', '.'), text: m[2] } : { type: 'bullet', label: '•', text: m[2] });
    else blocks.push({ type: 'p', text: line });
  }
  while (blocks.length && blocks[blocks.length - 1].type === 'gap') blocks.pop();
  return blocks;
}

// Greedy word wrap using the painter's measurement. Breaks very long words by character.
export function wrapText(p, text, maxWidth, size, bold) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const fits = (s) => p.measure(s, size, bold) <= maxWidth;
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (fits(next)) { cur = next; continue; }
    if (cur) lines.push(cur);
    if (fits(w)) { cur = w; continue; }
    let piece = '';
    for (const ch of w) { if (fits(piece + ch)) piece += ch; else { lines.push(piece); piece = ch; } }
    cur = piece;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Turns description text into physical lines: { x, text, label? }.
function detailLines(p, text, width, size) {
  const out = [];
  for (const b of parseDetails(text)) {
    if (b.type === 'gap') { out.push({ gap: true }); continue; }
    const indent = b.type === 'p' ? 0 : b.type === 'bullet' ? 11 : Math.max(16, p.measure(b.label, size, false) + 5);
    const lines = wrapText(p, b.text, width - indent, size, false);
    lines.forEach((t, i) => out.push({ x: indent, text: t, label: i === 0 ? b.label : null }));
  }
  return out;
}

export function layoutDocument(p, ctx) {
  const { doc, business, client, settings, totals, logo } = ctx;
  const isInv = doc.kind === 'invoice';
  const accent = settings.accentColor || '#2563EB';
  const cur = doc.currency;
  const money = (v) => formatMoney(v, cur);
  const W = p.width, H = p.height, M = 46;
  const innerW = W - 2 * M;
  const footerY = H - M + 6;
  const bottomLimit = H - M - 14;
  let y = M;
  let inTable = false;

  const lh = (size) => Math.round(size * 1.42 * 100) / 100;
  const base = (size) => size * 0.78; // top-of-line to baseline

  function ensure(height) { if (y + height > bottomLimit) newPage(); }
  function newPage() {
    p.addPage();
    y = M;
    p.text(`${isInv ? 'INVOICE' : 'ESTIMATE'} ${doc.number || ''}`.trim(), M, y + base(8), { size: 8, bold: true, color: C.muted });
    p.text(business ? business.name : '', W - M, y + base(8), { size: 8, color: C.muted, align: 'right' });
    y += lh(8) + 8;
    if (inTable) drawTableHeader();
  }
  function textLine(str, x, { size = 10, bold = false, color = C.text, align = 'left' } = {}) {
    p.text(str, x, y + base(size), { size, bold, color, align });
    y += lh(size);
  }
  function paragraph(text, x, width, { size = 9.5, color = C.text } = {}) {
    for (const l of detailLines(p, text, width, size)) {
      if (l.gap) { y += lh(size) * 0.45; continue; }
      ensure(lh(size));
      if (l.label) p.text(l.label, x, y + base(size), { size, color });
      p.text(l.text, x + l.x, y + base(size), { size, color });
      y += lh(size);
    }
  }

  // ---------- Header ----------
  const headerTop = y;
  let leftY = y;
  const leftW = innerW * 0.55;
  if (logo) {
    const maxW = 150, maxH = 54;
    const s = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const lw = logo.width * s, lhgt = logo.height * s;
    p.image(logo, M, leftY, lw, lhgt);
    leftY += lhgt + 10;
  }
  if (business) {
    p.text(business.name, M, leftY + base(13), { size: 13, bold: true, color: C.text });
    leftY += lh(13) + 1;
    const lines = [business.ownerName, ...(business.address || '').split('\n'), business.email, business.phone, business.website, business.taxNumber].map((s) => (s || '').trim()).filter(Boolean);
    for (const l of lines) { p.text(l, M, leftY + base(8.5), { size: 8.5, color: C.muted }); leftY += lh(8.5); }
  }
  // Right: document type and meta
  let rightY = y;
  p.text(isInv ? 'INVOICE' : 'ESTIMATE', W - M, rightY + 22, { size: 24, bold: true, color: accent, align: 'right' });
  rightY += 34;
  const meta = [[isInv ? 'Invoice no.' : 'Estimate no.', doc.number || '—'], ['Date', formatDate(doc.issueDate)]];
  if (isInv) {
    const term = PAYMENT_TERMS.find((t) => t.id === doc.paymentTerms);
    meta.push(['Due date', doc.dueDate ? formatDate(doc.dueDate) : '—']);
    if (term && term.id !== 'custom') meta.push(['Terms', term.label]);
  } else meta.push(['Valid until', doc.validUntil ? formatDate(doc.validUntil) : '—']);
  for (const [k, v] of meta) {
    p.text(k, W - M - 96, rightY + base(9), { size: 9, color: C.muted, align: 'right' });
    p.text(v, W - M, rightY + base(9), { size: 9, bold: true, color: C.text, align: 'right' });
    rightY += lh(9) + 1;
  }
  y = Math.max(leftY, rightY) + 16;
  p.line(M, y, W - M, y, { color: accent, lineWidth: 1.2 });
  y += 18;

  // ---------- Bill to + amount box ----------
  const billTop = y;
  p.text(isInv ? 'BILL TO' : 'PREPARED FOR', M, y + base(8), { size: 8, bold: true, color: accent });
  let by = y + lh(8) + 2;
  if (client) {
    p.text(client.name || client.company || '', M, by + base(11), { size: 11, bold: true, color: C.text }); by += lh(11);
    const cl = [client.company && client.company !== client.name ? client.company : '', ...(client.address || '').split('\n'), client.email, client.phone].map((s) => (s || '').trim()).filter(Boolean);
    for (const l of cl) { p.text(l, M, by + base(9), { size: 9, color: C.muted }); by += lh(9); }
  } else { p.text('No client selected', M, by + base(10), { size: 10, color: C.faint }); by += lh(10); }

  // Amount box on the right
  const boxW = 190, bx = W - M - boxW;
  const isPaid = isInv && doc.status === 'paid';
  const boxSub = isInv ? (isPaid ? (doc.paidAt ? `Paid ${formatDate(doc.paidAt.slice(0, 10))}` : 'Paid in full') : (doc.dueDate ? `Due ${formatDate(doc.dueDate)}` : '')) : (doc.validUntil ? `Valid until ${formatDate(doc.validUntil)}` : '');
  const boxH = boxSub ? 66 : 54;
  p.rect(bx, billTop, boxW, boxH, { fill: C.fill, radius: 6 });
  const boxLabel = isInv ? (isPaid ? 'AMOUNT PAID' : 'BALANCE DUE') : 'ESTIMATE TOTAL';
  p.text(boxLabel, bx + 14, billTop + 20, { size: 8, bold: true, color: C.muted });
  let amtSize = 17;
  while (amtSize > 11 && p.measure(money(totals.total), amtSize, true) > boxW - 28) amtSize -= 1;
  p.text(money(totals.total), bx + 14, billTop + 43, { size: amtSize, bold: true, color: isPaid ? C.green : C.text });
  if (boxSub) p.text(boxSub, bx + 14, billTop + 57, { size: 8, color: C.muted });
  y = Math.max(by, billTop + boxH) + 22;

  // ---------- Items table ----------
  const colQty = 52, colRate = 84, colAmt = 92, pad = 8;
  const xAmt = W - M, xRate = xAmt - colAmt, xQty = xRate - colRate, xDesc = M + pad;
  const descW = (xQty - colQty) - xDesc - 6;
  function drawTableHeader() {
    p.rect(M, y, innerW, 20, { fill: C.fill, radius: 3 });
    const ty = y + 13.5;
    p.text('DESCRIPTION', xDesc, ty, { size: 7.5, bold: true, color: C.muted });
    p.text('QTY', xQty - pad, ty, { size: 7.5, bold: true, color: C.muted, align: 'right' });
    p.text('RATE', xRate - pad, ty, { size: 7.5, bold: true, color: C.muted, align: 'right' });
    p.text('AMOUNT', xAmt - pad, ty, { size: 7.5, bold: true, color: C.muted, align: 'right' });
    y += 26;
  }
  inTable = true;
  ensure(20 + 60);
  drawTableHeader();

  const items = doc.items || [];
  const sectionTotals = new Map(totals.sections.map((s) => [s.id, s]));
  let currentSection = null;
  const closeSection = () => {
    if (!currentSection) return;
    const st = sectionTotals.get(currentSection.id);
    ensure(lh(8.5) + 6);
    p.text(`${currentSection.title || 'Section'} subtotal`, xRate - pad, y + base(8.5), { size: 8.5, color: C.muted, align: 'right' });
    p.text(money(st ? st.subtotal : 0), xAmt - pad, y + base(8.5), { size: 8.5, bold: true, color: C.muted, align: 'right' });
    y += lh(8.5) + 6;
    p.line(M, y, W - M, y, { color: C.line });
    y += 6;
    currentSection = null;
  };

  if (!items.length) { ensure(lh(10)); p.text('No items', xDesc, y + base(10), { size: 10, color: C.faint }); y += lh(10); }
  for (const it of items) {
    if (it.type === 'section') {
      closeSection();
      ensure(lh(9) + 10 + lh(10) + lh(9) * 2); // keep heading with the first item
      y += 2;
      p.text((it.title || 'Section').toUpperCase(), xDesc, y + base(8.5), { size: 8.5, bold: true, color: accent });
      y += lh(8.5) + 5;
      currentSection = it;
      continue;
    }
    const lines = detailLines(p, it.details, descW, 8.5);
    const titleLines = wrapText(p, it.title || 'Untitled item', descW, 10, true);
    const firstBlock = titleLines.length * lh(10) + Math.min(2, lines.length) * lh(8.5) + 8;
    ensure(firstBlock);
    const rowTop = y;
    y += 4;
    titleLines.forEach((t, i) => {
      p.text(t, xDesc, y + base(10), { size: 10, bold: true, color: C.text });
      if (i === 0) {
        const line = totals.lines.find((l) => l.id === it.id);
        p.text(formatQuantity(it.quantity), xQty - pad, y + base(10), { size: 9.5, color: C.text, align: 'right' });
        p.text(money(it.unitPrice), xRate - pad, y + base(10), { size: 9.5, color: C.text, align: 'right' });
        p.text(money(line ? line.total : 0), xAmt - pad, y + base(10), { size: 10, bold: true, color: C.text, align: 'right' });
      }
      y += lh(10);
    });
    if (lines.length) {
      y += 1;
      for (const l of lines) {
        if (l.gap) { y += lh(8.5) * 0.45; continue; }
        ensure(lh(8.5) + 4);
        if (l.label) p.text(l.label, xDesc + 4, y + base(8.5), { size: 8.5, color: C.muted });
        p.text(l.text, xDesc + 4 + l.x, y + base(8.5), { size: 8.5, color: C.muted });
        y += lh(8.5);
      }
    }
    y += 5;
    p.line(M, y, W - M, y, { color: C.line });
    y += 3;
  }
  closeSection();
  inTable = false;

  // ---------- Totals ----------
  const rows = [['Subtotal', money(totals.subtotal), false]];
  if (!totals.discount.isZero()) rows.push([`Discount${doc.discountType === 'percent' ? ` (${Dec.from(doc.discountValue).toString()}%)` : ''}`, '−' + money(totals.discount), false]);
  if (!totals.taxRate.isZero()) rows.push([`${doc.taxLabel || 'Tax'} (${totals.taxRate.toString()}%)`, money(totals.tax), false]);
  rows.push(['Total', money(totals.total), true]);
  if (isInv) rows.push([doc.status === 'paid' ? 'Paid' : 'Balance Due', money(doc.status === 'paid' ? totals.total : totals.balance), 'due']);
  const totW = 230, tx = W - M - totW;
  const totH = rows.reduce((a, r) => a + (r[2] ? 26 : 18), 0) + 10;
  ensure(totH + 10);
  y += 8;
  const totTop = y;
  for (const [label, value, kind] of rows) {
    if (kind === 'due') {
      p.rect(tx, y, totW, 24, { fill: doc.status === 'paid' ? '#DCFCE7' : accent, radius: 4 });
      const col = doc.status === 'paid' ? C.green : C.white;
      p.text(label, tx + 12, y + 16, { size: 10, bold: true, color: col });
      p.text(value, W - M - 12, y + 16, { size: 11.5, bold: true, color: col, align: 'right' });
      y += 26;
    } else if (kind) {
      p.line(tx, y + 2, W - M, y + 2, { color: C.text, lineWidth: 0.8 });
      p.text(label, tx + 12, y + 19, { size: 11, bold: true, color: C.text });
      p.text(value, W - M - 12, y + 19, { size: 12, bold: true, color: C.text, align: 'right' });
      y += 26;
    } else {
      p.text(label, tx + 12, y + 12, { size: 9.5, color: C.muted });
      p.text(value, W - M - 12, y + 12, { size: 9.5, color: C.text, align: 'right' });
      y += 18;
    }
  }
  y += 10;

  // PAID stamp
  if (isInv && doc.status === 'paid') {
    p.opacity(0.22);
    const sx = M + 40, sy = totTop + 34;
    p.text('PAID', sx, sy + 20, { size: 44, bold: true, color: C.green, angle: 10 });
    p.opacity(1);
  }

  // ---------- Notes / terms / payment ----------
  const sections = [
    ['NOTES', doc.notes],
    ['TERMS', doc.terms],
    [isInv ? 'PAYMENT INSTRUCTIONS' : null, isInv ? doc.paymentInstructions : null]
  ].filter(([k, v]) => k && (v || '').trim());
  if (sections.length) {
    y += 6;
    ensure(lh(8) + lh(9.5) * 2);
    p.line(M, y, W - M, y, { color: C.line });
    y += 14;
    for (const [label, text] of sections) {
      ensure(lh(8) + lh(9.5) * 2);
      p.text(label, M, y + base(8), { size: 8, bold: true, color: accent });
      y += lh(8) + 3;
      paragraph(text, M, innerW, { size: 9.5, color: C.text });
      y += 10;
    }
  }

  // ---------- Footer with page numbers ----------
  const n = p.pageCount;
  for (let i = 1; i <= n; i++) {
    p.setPage(i);
    const label = `${isInv ? 'Invoice' : 'Estimate'} ${doc.number || ''}${business ? ' · ' + business.name : ''}`;
    p.text(label, M, footerY, { size: 7.5, color: C.faint });
    if (n > 1) p.text(`Page ${i} of ${n}`, W - M, footerY, { size: 7.5, color: C.faint, align: 'right' });
  }
  return { pages: n };
}
