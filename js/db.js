// Thin promise wrapper around IndexedDB. All app data lives on the device.
const DB_NAME = 'invoices-app';
const DB_VERSION = 1;
export const STORES = ['businesses', 'clients', 'documents', 'savedItems', 'settings'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
  });
  return dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    try { result = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

export async function getAll(store) {
  const db = await openDB();
  return tx(db, store, 'readonly', (s) => s.getAll());
}
export async function put(store, value) {
  const db = await openDB();
  await tx(db, store, 'readwrite', (s) => s.put(value));
  return value;
}
export async function putMany(store, values) {
  const db = await openDB();
  await tx(db, store, 'readwrite', (s) => { values.forEach((v) => s.put(v)); });
}
export async function remove(store, id) {
  const db = await openDB();
  await tx(db, store, 'readwrite', (s) => s.delete(id));
}
export async function clear(store) {
  const db = await openDB();
  await tx(db, store, 'readwrite', (s) => s.clear());
}
export async function persistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* ignore */ }
}
