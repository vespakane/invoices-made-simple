// Navigation stack with iOS-style push/pop screens and modal sheets, synced with browser history
// so the hardware/gesture back action behaves naturally.
const app = () => document.getElementById('app');
const session = Math.random().toString(36).slice(2);
const stack = []; // { el, type: 'screen'|'sheet', dim, resolve, result }
let pendingResult;
let busy = false;

function depthOf(state) { return state && state.s === session ? state.depth : 0; }

function pushHistory() {
  history.pushState({ s: session, depth: stack.length }, '');
}

export function init(rootEl) {
  app().append(rootEl);
  history.replaceState({ s: session, depth: 0 }, '');
  window.addEventListener('popstate', (e) => {
    const depth = depthOf(e.state);
    while (stack.length > depth) removeTop(pendingResult);
    pendingResult = undefined;
  });
  setupEdgeSwipe();
}

function topScreen() {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].type === 'screen') return stack[i].el;
  return app().firstElementChild;
}

export function push(el) {
  return new Promise((resolve) => {
    const below = topScreen();
    el.classList.add('screen', 'enter');
    app().append(el);
    stack.push({ el, type: 'screen', resolve });
    pushHistory();
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.classList.remove('enter');
      if (below) below.classList.add('under');
    });
    if (el.onShow) el.onShow();
  });
}

export function sheet(el) {
  return new Promise((resolve) => {
    const dim = document.createElement('div');
    dim.className = 'sheet-dim';
    el.classList.add('sheet');
    app().append(dim, el);
    stack.push({ el, type: 'sheet', dim, resolve });
    pushHistory();
    el.getBoundingClientRect();
    requestAnimationFrame(() => { dim.classList.add('show'); el.classList.add('show'); });
    if (el.onShow) el.onShow();
  });
}

// Pops the top entry. Returns a promise that resolves when the pop has completed.
export function pop(result) {
  if (!stack.length || busy) return Promise.resolve();
  busy = true;
  pendingResult = result;
  return new Promise((resolve) => {
    const done = () => { window.removeEventListener('popstate', done); busy = false; setTimeout(resolve, 0); };
    window.addEventListener('popstate', done);
    history.back();
  });
}

export function popToRoot() {
  if (!stack.length) return Promise.resolve();
  return new Promise((resolve) => {
    const n = stack.length;
    const done = () => { window.removeEventListener('popstate', done); setTimeout(resolve, 0); };
    window.addEventListener('popstate', done);
    history.go(-n);
  });
}

export function depth() { return stack.length; }

function removeTop(result) {
  const entry = stack.pop();
  if (!entry) return;
  const { el, type, dim, resolve } = entry;
  if (el.onHide) { try { el.onHide(); } catch (e) { console.error(e); } }
  if (type === 'screen') {
    el.classList.add('leave');
    const below = topScreen();
    if (below) below.classList.remove('under');
    el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 420);
  } else {
    el.classList.remove('show');
    if (dim) dim.classList.remove('show');
    el.style.pointerEvents = 'none';
    setTimeout(() => { el.remove(); if (dim) dim.remove(); }, 420);
  }
  resolve(result);
}

// Edge swipe to go back (standalone web apps do not get the system gesture).
function setupEdgeSwipe() {
  let tracking = null;
  const root = app();
  root.addEventListener('touchstart', (e) => {
    if (busy || !stack.length) return;
    const top = stack[stack.length - 1];
    if (top.type !== 'screen') return;
    const t = e.touches[0];
    if (t.clientX > 24) return;
    tracking = { x: t.clientX, y: t.clientY, el: top.el, below: stack.length > 1 ? null : null, moved: false, w: root.clientWidth };
    tracking.below = (() => { for (let i = stack.length - 2; i >= 0; i--) if (stack[i].type === 'screen') return stack[i].el; return root.firstElementChild; })();
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = Math.max(0, t.clientX - tracking.x);
    const dy = Math.abs(t.clientY - tracking.y);
    if (!tracking.moved) {
      if (dx < 8) return;
      if (dy > dx) { tracking = null; return; }
      tracking.moved = true;
      tracking.el.style.transition = 'none';
      if (tracking.below) tracking.below.style.transition = 'none';
    }
    tracking.el.style.transform = `translateX(${dx}px)`;
    if (tracking.below) { tracking.below.style.transform = `translateX(${-30 + 30 * (dx / tracking.w)}%)`; tracking.below.style.opacity = String(0.85 + 0.15 * (dx / tracking.w)); }
  }, { passive: true });
  const end = (e) => {
    if (!tracking) return;
    const tr = tracking; tracking = null;
    if (!tr.moved) return;
    const t = e.changedTouches[0];
    const dx = Math.max(0, t.clientX - tr.x);
    tr.el.style.transition = '';
    if (tr.below) tr.below.style.transition = '';
    requestAnimationFrame(() => {
      tr.el.style.transform = '';
      if (tr.below) { tr.below.style.transform = ''; tr.below.style.opacity = ''; }
      if (dx > tr.w * 0.3) pop();
    });
  };
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);
}
