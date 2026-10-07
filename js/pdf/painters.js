// Two painters sharing one interface: jsPDF (real PDF file) and Canvas (on-screen preview).
// All coordinates are in PDF points. Text y is the alphabetic baseline.

const FONT_REG = './vendor/OpenSans-Regular.ttf';
const FONT_BOLD = './vendor/OpenSans-Bold.ttf';
let fontB64 = null;
let jsPDFReady = null;
let webFontsReady = null;

async function fetchB64(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function loadJsPDF() {
  if (!jsPDFReady) {
    jsPDFReady = (async () => {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = './vendor/jspdf.umd.min.js';
          s.onload = resolve; s.onerror = () => reject(new Error('Could not load the PDF library'));
          document.head.append(s);
        });
      }
      const [reg, bold] = await Promise.all([fetchB64(FONT_REG), fetchB64(FONT_BOLD)]);
      fontB64 = { reg, bold };
      return window.jspdf.jsPDF;
    })();
  }
  return jsPDFReady;
}

export function loadWebFonts() {
  if (!webFontsReady) {
    webFontsReady = (async () => {
      if (!('FontFace' in window)) return;
      const reg = new FontFace('OpenSansPDF', `url(${FONT_REG})`, { weight: '400' });
      const bold = new FontFace('OpenSansPDF', `url(${FONT_BOLD})`, { weight: '700' });
      await Promise.all([reg.load(), bold.load()]);
      document.fonts.add(reg); document.fonts.add(bold);
    })();
  }
  return webFontsReady;
}

export const PAGE_SIZES = { letter: [612, 792], a4: [595.28, 841.89] };

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [37, 99, 235];
}

// ---------- jsPDF painter ----------
export async function createPdfPainter(pageSize = 'letter') {
  const jsPDF = await loadJsPDF();
  const [w, hgt] = PAGE_SIZES[pageSize] || PAGE_SIZES.letter;
  const pdf = new jsPDF({ unit: 'pt', format: [w, hgt], compress: true });
  pdf.addFileToVFS('OpenSans-Regular.ttf', fontB64.reg);
  pdf.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
  pdf.addFileToVFS('OpenSans-Bold.ttf', fontB64.bold);
  pdf.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
  pdf.setFont('OpenSans', 'normal');
  let pages = 1;
  const font = (size, bold) => { pdf.setFont('OpenSans', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  return {
    kind: 'pdf', width: w, height: hgt, pdf,
    get pageCount() { return pages; },
    addPage() { pdf.addPage([w, hgt]); pages++; },
    setPage(i) { pdf.setPage(i); },
    measure(text, size, bold) { font(size, bold); return pdf.getTextWidth(text); },
    text(str, x, y, { size = 10, bold = false, color = '#111111', align = 'left', angle = 0 } = {}) {
      font(size, bold);
      pdf.setTextColor(...hexToRgb(color));
      pdf.text(str, x, y, { align, angle, baseline: 'alphabetic' });
    },
    rect(x, y, rw, rh, { fill = null, stroke = null, lineWidth = 0.5, radius = 0 } = {}) {
      if (fill) pdf.setFillColor(...hexToRgb(fill));
      if (stroke) { pdf.setDrawColor(...hexToRgb(stroke)); pdf.setLineWidth(lineWidth); }
      const style = fill && stroke ? 'FD' : fill ? 'F' : stroke ? 'S' : null;
      if (!style) return;
      if (radius) pdf.roundedRect(x, y, rw, rh, radius, radius, style); else pdf.rect(x, y, rw, rh, style);
    },
    line(x1, y1, x2, y2, { color = '#E5E7EB', lineWidth = 0.5 } = {}) {
      pdf.setDrawColor(...hexToRgb(color)); pdf.setLineWidth(lineWidth); pdf.line(x1, y1, x2, y2);
    },
    image(img, x, y, iw, ih) {
      try { pdf.addImage(img.dataUrl, img.format, x, y, iw, ih, undefined, 'FAST'); } catch (e) { console.warn('logo skipped', e); }
    },
    opacity(a) { pdf.setGState(new pdf.GState({ opacity: a, 'stroke-opacity': a })); },
    finish() { return pdf.output('blob'); }
  };
}

// ---------- Canvas painter (preview) ----------
export async function createCanvasPainter(pageSize = 'letter', { cssWidth = 360, measurer = null } = {}) {
  await loadWebFonts();
  const [w, hgt] = PAGE_SIZES[pageSize] || PAGE_SIZES.letter;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const k = (cssWidth / w) * dpr;
  const canvases = [];
  let ctx = null;
  const measureCanvas = document.createElement('canvas').getContext('2d');
  const fontStr = (size, bold) => `${bold ? '700' : '400'} ${size}px OpenSansPDF, "Open Sans", -apple-system, Helvetica, Arial, sans-serif`;
  function addPage() {
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(hgt * k);
    c.style.width = cssWidth + 'px'; c.style.height = Math.round(cssWidth * hgt / w) + 'px';
    c.className = 'pdf-page';
    const cx = c.getContext('2d');
    cx.scale(k, k);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, hgt);
    canvases.push(c); ctx = cx;
  }
  addPage();
  return {
    kind: 'canvas', width: w, height: hgt, canvases,
    get pageCount() { return canvases.length; },
    addPage,
    setPage(i) { ctx = canvases[i - 1].getContext('2d'); },
    measure(text, size, bold) {
      if (measurer) return measurer(text, size, bold);
      measureCanvas.font = fontStr(size, bold); return measureCanvas.measureText(text).width;
    },
    text(str, x, y, { size = 10, bold = false, color = '#111111', align = 'left', angle = 0 } = {}) {
      ctx.save();
      ctx.font = fontStr(size, bold); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
      if (angle) { ctx.translate(x, y); ctx.rotate(-angle * Math.PI / 180); ctx.fillText(str, 0, 0); }
      else ctx.fillText(str, x, y);
      ctx.restore();
    },
    rect(x, y, rw, rh, { fill = null, stroke = null, lineWidth = 0.5, radius = 0 } = {}) {
      ctx.save();
      ctx.beginPath();
      if (radius && ctx.roundRect) ctx.roundRect(x, y, rw, rh, radius); else ctx.rect(x, y, rw, rh);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
      ctx.restore();
    },
    line(x1, y1, x2, y2, { color = '#E5E7EB', lineWidth = 0.5 } = {}) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    },
    image(img, x, y, iw, ih) { if (img.el) ctx.drawImage(img.el, x, y, iw, ih); },
    opacity(a) { ctx.globalAlpha = a; },
    finish() { return canvases; }
  };
}

// Loads a logo data URL into an object both painters can draw.
export function loadImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const el = new Image();
    el.onload = () => resolve({ dataUrl, el, width: el.naturalWidth, height: el.naturalHeight, format: /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG' });
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
}
