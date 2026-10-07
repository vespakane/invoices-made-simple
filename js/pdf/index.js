import * as store from '../store.js';
import { computeTotals } from '../totals.js';
import { currencyDecimals } from '../format.js';
import { createPdfPainter, createCanvasPainter, loadImage, loadJsPDF } from './painters.js';
import { layoutDocument } from './layout.js';

export async function buildContext(doc) {
  const business = store.business(doc.businessId);
  const client = store.client(doc.clientId);
  const settings = store.state.settings;
  const totals = computeTotals(doc, currencyDecimals(doc.currency));
  const logo = business && business.logo ? await loadImage(business.logo) : null;
  return { doc, business, client, settings, totals, logo };
}

export function pdfFilename(doc) {
  const client = store.client(doc.clientId);
  const base = `${doc.kind === 'invoice' ? 'Invoice' : 'Estimate'} ${doc.number || ''}${client ? ' - ' + client.name : ''}`.trim();
  return base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') + '.pdf';
}

// Returns { blob, filename, pages }.
export async function generatePDF(doc) {
  const ctx = await buildContext(doc);
  const p = await createPdfPainter(ctx.settings.pageSize);
  const { pages } = layoutDocument(p, ctx);
  return { blob: p.finish(), filename: pdfFilename(doc), pages };
}

// Renders preview canvases, measured with the PDF font metrics so wrapping matches the file.
export async function renderPreview(doc, cssWidth) {
  const ctx = await buildContext(doc);
  const pdfPainter = await createPdfPainter(ctx.settings.pageSize);
  const measurer = (t, s, b) => pdfPainter.measure(t, s, b);
  const p = await createCanvasPainter(ctx.settings.pageSize, { cssWidth, measurer });
  const { pages } = layoutDocument(p, ctx);
  return { canvases: p.finish(), pages };
}

export { loadJsPDF };
