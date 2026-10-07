// Small DOM toolkit with iOS-styled components.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'ref') v(el);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---------- Icons (SF-Symbol-like, stroke based) ----------
const PATHS = {
  'chevron-left': 'M15 4l-8 8 8 8',
  'chevron-right': 'M9 4l8 8-8 8',
  'chevron-down': 'M4 9l8 8 8-8',
  'plus': 'M12 5v14M5 12h14',
  'gear': 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  'search': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  'xmark': 'M6 6l12 12M18 6L6 18',
  'xmark-circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9 9l6 6M15 9l-6 6',
  'doc': 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  'doc-text': 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  'person': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  'people': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-5-6.7',
  'building': 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M4 21h16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M10 21v-3',
  'trash': 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  'check': 'M5 12l5 5L20 7',
  'photo': 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 5 5 3-3 5 5M16 9h.01',
  'ellipsis': 'M5 12h.01M12 12h.01M19 12h.01',
  'tag': 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
  'list': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'mail': 'M3 6h18v12H3zM3 7l9 6 9-6',
  'share': 'M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  'contacts': 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 18a4 4 0 0 1 8 0M3 8h2M3 12h2M3 16h2',
  'duplicate': 'M8 8h12v12H8zM4 16V4h12',
  'arrow-right': 'M4 12h16M13 5l7 7-7 7',
  'calendar': 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  'flask': 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3',
  'info': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 11v6M12 7.5h.01',
  'grip': 'M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01',
  'eye': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'send': 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  'printer': 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  'folder': 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  'bolt': 'M13 2L4 14h7l-1 8 9-12h-7z',
  'minus': 'M5 12h14'
};

export function icon(name, cls = '') {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', name === 'chevron-right' || name === 'chevron-left' || name === 'chevron-down' ? '2.4' : '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', PATHS[name] || '');
  svg.append(path);
  return svg;
}

// ---------- Top bar ----------
export function topbar({ title = '', left = null, right = null, sub = null, cls = '' } = {}) {
  return h('header', { class: `topbar ${cls}` },
    h('div', { class: 'topbar-row' },
      h('div', { class: 'topbar-left' }, left),
      h('h1', { class: 'topbar-title' }, title),
      h('div', { class: 'topbar-right' }, right)
    ),
    sub ? h('div', { class: 'topbar-sub' }, sub) : null
  );
}

export function barBtn(label, { onClick, primary = false, destructive = false, iconName = null, cls = '', disabled = false, ariaLabel = null } = {}) {
  const b = h('button', {
    class: `bar-btn ${primary ? 'primary' : ''} ${destructive ? 'destructive' : ''} ${iconName && !label ? 'icon' : ''} ${cls}`,
    type: 'button', onClick, disabled, 'aria-label': ariaLabel || (typeof label === 'string' ? label : null)
  }, iconName ? icon(iconName) : null, label);
  return b;
}

export function backBtn(onClick, label = 'Back') {
  return h('button', { class: 'bar-btn back', type: 'button', onClick, 'aria-label': 'Back' }, icon('chevron-left'), label);
}

// ---------- Lists ----------
export function group({ header = null, footer = null, cls = '' } = {}, ...children) {
  return h('section', { class: `group ${cls}` },
    header ? h('div', { class: 'group-header' }, header) : null,
    children.flat().some(Boolean) ? h('div', { class: 'cells' }, ...children) : null,
    footer ? h('div', { class: 'group-footer' }, footer) : null
  );
}

export function cell({ title, subtitle = null, value = null, avatar = null, chevron = false, onClick = null, badge = null, cls = '', subOneLine = false, right = null } = {}) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, { class: `cell ${onClick ? 'tappable' : ''} ${avatar ? 'inset-icon' : ''} ${cls}`, type: onClick ? 'button' : null, onClick },
    avatar,
    h('div', { class: 'cell-main' },
      h('div', { class: 'cell-title' }, title),
      subtitle ? h('div', { class: `cell-sub ${subOneLine ? 'one-line' : ''}` }, subtitle) : null
    ),
    badge ? h('span', { class: 'badge-default' }, badge) : null,
    value !== null ? h('div', { class: 'cell-value' }, value) : null,
    right,
    chevron ? icon('chevron-right', 'cell-chevron') : null
  );
}

export function actionCell(label, { onClick, destructive = false, center = false, iconName = null } = {}) {
  return h('button', { class: `cell tappable action ${destructive ? 'destructive' : ''} ${center ? 'center' : ''}`, type: 'button', onClick },
    iconName ? icon(iconName, 'cell-icon') : null, h('span', {}, label));
}

export function avatar(text, img = null, round = false) {
  const a = h('div', { class: `avatar ${round ? 'round' : ''}` });
  if (img) a.append(h('img', { src: img, alt: '' })); else a.textContent = text;
  return a;
}

// ---------- Form fields ----------
export function autogrow(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(24, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  ta.fit = fit;
  return ta;
}

export function field({ label, value = '', placeholder = '', type = 'text', inputmode = null, multiline = false, stacked = false, autocapitalize = null, autocomplete = 'off', onInput = null, onChange = null, name = null, enterkeyhint = null, maxlength = null, align = null } = {}) {
  const id = 'f-' + Math.random().toString(36).slice(2, 8);
  let input;
  if (multiline) {
    input = autogrow(h('textarea', { id, placeholder, rows: 1, autocapitalize, autocomplete, name, maxlength }));
    input.value = value || '';
  } else {
    input = h('input', { id, type, placeholder, inputmode, autocapitalize, autocomplete, name, enterkeyhint, maxlength });
    input.value = value ?? '';
  }
  if (align) input.style.textAlign = align;
  if (onInput) input.addEventListener('input', () => onInput(input.value, input));
  if (onChange) input.addEventListener('change', () => onChange(input.value, input));
  const wrap = h('div', { class: `field ${stacked || multiline ? 'stacked' : ''}` }, label ? h('label', { for: id }, label) : null, input);
  wrap.input = input;
  return wrap;
}

export function selectField({ label, value, options, onChange }) {
  const sel = h('select', {}, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  sel.addEventListener('change', () => onChange(sel.value, sel));
  const wrap = h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'select-wrap' }, sel, icon('chevron-down')));
  wrap.input = sel;
  return wrap;
}

export function dateField({ label, value, onChange, min = null }) {
  const input = h('input', { type: 'date', min });
  input.value = value || '';
  input.addEventListener('change', () => onChange(input.value, input));
  const wrap = h('div', { class: 'field' }, h('label', {}, label), input);
  wrap.input = input;
  return wrap;
}

export function toggleField({ label, value, onChange, sublabel = null }) {
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': value ? 'true' : 'false', 'aria-label': label });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', next ? 'true' : 'false');
    haptic('light');
    onChange(next);
  });
  const wrap = h('div', { class: 'field toggle' },
    h('div', { class: 'cell-main' }, h('div', { class: 'cell-title' }, label), sublabel ? h('div', { class: 'cell-sub' }, sublabel) : null), sw);
  wrap.setValue = (v) => sw.setAttribute('aria-checked', v ? 'true' : 'false');
  return wrap;
}

export function emptyState({ iconName = 'doc', title, text }) {
  return h('div', { class: 'empty' }, icon(iconName), h('h2', {}, title), text ? h('p', {}, text) : null);
}

export function segmented(options, value, onChange) {
  const el = h('div', { class: 'segmented', role: 'tablist' });
  const buttons = options.map((o) => h('button', { type: 'button', role: 'tab', 'aria-selected': o.value === value ? 'true' : 'false', onClick: () => { select(o.value); onChange(o.value); } }, o.label));
  function select(v) { buttons.forEach((b, i) => b.setAttribute('aria-selected', options[i].value === v ? 'true' : 'false')); }
  el.append(...buttons);
  el.select = select;
  return el;
}

export function pills(options, value, onChange) {
  const el = h('div', { class: 'pills', role: 'tablist' });
  const buttons = options.map((o) => h('button', { type: 'button', class: 'pill', role: 'tab', 'aria-selected': o.value === value ? 'true' : 'false', onClick: () => { select(o.value); onChange(o.value); } }, o.label, o.count !== undefined ? h('span', { class: 'count' }, String(o.count)) : null));
  function select(v) { buttons.forEach((b, i) => b.setAttribute('aria-selected', options[i].value === v ? 'true' : 'false')); }
  el.append(...buttons);
  el.select = select;
  el.setCounts = (counts) => buttons.forEach((b, i) => { const c = b.querySelector('.count'); if (c && counts[options[i].value] !== undefined) c.textContent = String(counts[options[i].value]); });
  return el;
}

export function searchBar({ placeholder = 'Search', value = '', onInput }) {
  const input = h('input', { type: 'search', placeholder, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', enterkeyhint: 'search', 'aria-label': placeholder });
  input.value = value;
  const wrap = h('div', { class: `search ${value ? 'has-text' : ''}` }, icon('search'), input,
    h('button', { class: 'clear', type: 'button', 'aria-label': 'Clear search', onClick: () => { input.value = ''; wrap.classList.remove('has-text'); onInput(''); input.focus(); } }, icon('xmark-circle')));
  input.addEventListener('input', () => { wrap.classList.toggle('has-text', !!input.value); onInput(input.value); });
  wrap.input = input;
  return wrap;
}

// ---------- Overlays ----------
const overlayRoot = () => document.getElementById('overlay-root');

export function alert({ title, message = '', buttons = [{ label: 'OK', value: true }] }) {
  return new Promise((resolve) => {
    const dim = h('div', { class: 'alert-dim', role: 'alertdialog', 'aria-modal': 'true' });
    const close = (v) => { dim.classList.remove('show'); setTimeout(() => dim.remove(), 200); resolve(v); };
    const stacked = buttons.length > 2;
    const box = h('div', { class: 'alert' },
      h('div', { class: 'alert-body' }, h('h3', {}, title), message ? h('p', {}, message) : null),
      h('div', { class: `alert-actions ${stacked ? 'stacked' : ''}` },
        ...buttons.map((b) => h('button', { type: 'button', class: `${b.style === 'destructive' ? 'destructive' : ''} ${b.bold || b.style === 'cancel' ? 'bold' : ''}`, onClick: () => close(b.value) }, b.label))
      )
    );
    dim.append(box);
    overlayRoot().append(dim);
    requestAnimationFrame(() => dim.classList.add('show'));
  });
}

export function confirm({ title, message = '', confirmLabel = 'Delete', cancelLabel = 'Cancel', destructive = true }) {
  return alert({ title, message, buttons: [
    { label: cancelLabel, value: false, style: 'cancel' },
    { label: confirmLabel, value: true, style: destructive ? 'destructive' : 'default', bold: !destructive }
  ] });
}

export function actionSheet({ title = null, actions = [], cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'action-sheet-wrap', role: 'dialog', 'aria-modal': 'true' });
    const close = (v) => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 220); resolve(v); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
    const sheet = h('div', { class: 'action-sheet' },
      h('div', { class: 'as-group' },
        title ? h('div', { class: 'as-title' }, title) : null,
        ...actions.map((a) => h('button', { type: 'button', class: a.destructive ? 'destructive' : '', onClick: () => close(a.value) }, a.label))
      ),
      h('div', { class: 'as-group' }, h('button', { type: 'button', class: 'cancel', onClick: () => close(null) }, cancelLabel))
    );
    wrap.append(sheet);
    overlayRoot().append(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
  });
}

let toastEl = null; let toastTimer = null;
export function toast(text, ms = 1800) {
  if (toastEl) { toastEl.remove(); clearTimeout(toastTimer); toastEl = null; }
  if (!text) return;
  toastEl = h('div', { class: 'toast', role: 'status' }, text);
  overlayRoot().append(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('show'));
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, 300); }, ms);
}

export function haptic(kind = 'light') {
  // iOS Safari does not expose haptics to web content; vibrate is a no-op there but works on Android.
  try { if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [10, 30, 10] : kind === 'medium' ? 15 : 8); } catch { /* ignore */ }
}

// ---------- Keyboard "Done" bar (standalone mode has no native accessory bar) ----------
export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function setupKeyboardDone() {
  if (!isStandalone()) return;
  const bar = h('div', { class: 'kb-bar' }, h('button', { type: 'button', class: 'kb-done', onMousedown: (e) => e.preventDefault(), onClick: () => { if (document.activeElement) document.activeElement.blur(); } }, 'Done'));
  overlayRoot().append(bar);
  const position = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const bottom = window.innerHeight - (vv.height + vv.offsetTop);
    bar.style.bottom = Math.max(0, bottom) + 'px';
  };
  const update = () => {
    const a = document.activeElement;
    const editing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.type !== 'date';
    bar.classList.toggle('show', !!editing);
    position();
  };
  document.addEventListener('focusin', () => setTimeout(update, 50));
  document.addEventListener('focusout', () => setTimeout(update, 50));
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', update); window.visualViewport.addEventListener('scroll', position); }
}

// ---------- Swipe-to-reveal actions (trailing side) ----------
let openSwipe = null;
export function closeOpenSwipe() { if (openSwipe) { openSwipe.close(); openSwipe = null; } }
document.addEventListener('pointerdown', (e) => { if (openSwipe && !openSwipe.el.contains(e.target)) closeOpenSwipe(); }, true);

// actions: [{ label, color: 'red'|'orange'|'green'|'blue'|'gray'|'purple', iconName, onClick }]
// The first action is the primary one, triggered by a long swipe.
export function swipeRow(contentEl, actions) {
  const row = h('div', { class: 'swipe-row' });
  const acts = h('div', { class: 'swipe-actions' }, ...actions.map((a) => h('button', { type: 'button', class: `swipe-btn ${a.color || 'gray'}`, onClick: (e) => { e.stopPropagation(); close(); a.onClick(); } }, a.iconName ? icon(a.iconName) : null, h('span', {}, a.label))));
  contentEl.classList.add('swipe-content');
  row.append(acts, contentEl);
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, width = 0, openOffset = 0, pid = null;
  const setX = (x, animate) => { contentEl.style.transition = animate ? 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none'; contentEl.style.transform = `translateX(${x}px)`; acts.style.setProperty('--reveal', `${Math.min(1, Math.max(0, -x / width))}`); };
  function close() { setX(0, true); openOffset = 0; row.classList.remove('open'); if (openSwipe && openSwipe.el === row) openSwipe = null; }
  function open() { width = acts.offsetWidth; setX(-width, true); openOffset = -width; row.classList.add('open'); closeOpenSwipe(); openSwipe = { el: row, close }; }
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    width = acts.offsetWidth; startX = e.clientX; startY = e.clientY; dx = 0; dragging = true; decided = false; pid = e.pointerId;
  });
  row.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pid) return;
    const mx = e.clientX - startX, my = e.clientY - startY;
    if (!decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      if (Math.abs(my) > Math.abs(mx)) { dragging = false; return; }
      decided = true;
      if (openSwipe && openSwipe.el !== row) closeOpenSwipe();
      try { row.setPointerCapture(pid); } catch { /* ignore */ }
    }
    dx = Math.min(0, Math.max(-width * 1.6, openOffset + mx));
    if (openOffset === 0 && mx > 0) dx = 0;
    setX(dx, false);
    row.classList.toggle('full', -dx > width * 1.25 && actions.length > 0);
  });
  const finish = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    if (!decided) return;
    e.preventDefault();
    row.dataset.swiped = '1'; setTimeout(() => delete row.dataset.swiped, 300);
    if (-dx > width * 1.25) { setX(-row.offsetWidth, true); setTimeout(() => { close(); actions[0].onClick(); }, 180); row.classList.remove('full'); return; }
    if (-dx > width * 0.5) open(); else close();
  };
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', finish);
  contentEl.addEventListener('click', (e) => { if (row.dataset.swiped || row.classList.contains('open')) { e.stopPropagation(); e.preventDefault(); close(); } }, true);
  row.close = close; row.open = open;
  return row;
}
