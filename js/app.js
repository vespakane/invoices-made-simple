import * as store from './store.js';
import * as nav from './nav.js';
import { setupKeyboardDone, toast } from './ui.js';
import { homeScreen, setOpenDocument } from './views/home.js';
import { openEditor, actions } from './views/editor.js';
import { previewScreen } from './views/preview.js';
import { sendDocument, shareMenu, exportMenu } from './share.js';

const params = new URLSearchParams(location.search);
if (params.get('sim') === 'iphone') {
  // Dev only: simulate iPhone safe areas in desktop browsers.
  const r = document.documentElement.style;
  r.setProperty('--safe-top', '59px'); r.setProperty('--safe-bottom', '34px');
}

async function main() {
  try {
    await store.load();
  } catch (e) {
    console.error(e);
    document.getElementById('app').textContent = 'Could not open local storage. Please make sure private browsing is off and reload.';
    return;
  }
  setOpenDocument((doc, opts) => openEditor(doc.id, opts));
  actions.preview = (doc) => nav.push(previewScreen(doc));
  actions.send = (doc) => sendDocument(store.document(doc.id) || doc);
  actions.share = (doc) => shareMenu(store.document(doc.id) || doc);
  actions.exportMenu = (doc) => exportMenu(store.document(doc.id) || doc);
  nav.init(homeScreen());
  setupKeyboardDone();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || params.get('nosw')) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    if (navigator.serviceWorker.controller) toast('Updated to the latest version');
  });
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
}

// Expose for debugging and for the screenshot tool.
window.__app = { store, nav };
main();
