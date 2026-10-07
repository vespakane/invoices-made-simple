// In-memory state with write-through persistence to IndexedDB and a simple change event.
import * as db from './db.js';
import { defaultSettings } from './models.js';

export const state = {
  businesses: [],
  clients: [],
  documents: [],
  savedItems: [],
  settings: defaultSettings(),
  loaded: false
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } } }

export async function load() {
  await db.persistStorage();
  const [businesses, clients, documents, savedItems, settingsRows] = await Promise.all(
    ['businesses', 'clients', 'documents', 'savedItems', 'settings'].map((s) => db.getAll(s))
  );
  state.businesses = businesses;
  state.clients = clients;
  state.documents = documents;
  state.savedItems = savedItems;
  const saved = settingsRows.find((r) => r.id === 'app');
  state.settings = { ...defaultSettings(), ...(saved || {}), id: 'app' };
  state.loaded = true;
  emit('load');
}

function collection(name) { return state[name]; }

export async function save(name, record) {
  record.updatedAt = new Date().toISOString();
  const list = collection(name);
  const i = list.findIndex((r) => r.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  await db.put(name, record);
  emit(name);
  return record;
}

export async function saveMany(name, records) {
  const list = collection(name);
  for (const record of records) {
    record.updatedAt = new Date().toISOString();
    const i = list.findIndex((r) => r.id === record.id);
    if (i >= 0) list[i] = record; else list.push(record);
  }
  await db.putMany(name, records);
  emit(name);
}

export async function remove(name, id) {
  const list = collection(name);
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list.splice(i, 1);
  await db.remove(name, id);
  emit(name);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch, id: 'app' };
  await db.put('settings', state.settings);
  emit('settings');
  return state.settings;
}

export async function wipeAll() {
  for (const s of ['businesses', 'clients', 'documents', 'savedItems']) {
    await db.clear(s);
    state[s] = [];
  }
  emit('wipe');
}

// Lookups
export const byId = (name, id) => collection(name).find((r) => r.id === id) || null;
export const defaultBusiness = () => state.businesses.find((b) => b.isDefault) || state.businesses[0] || null;
export const business = (id) => byId('businesses', id);
export const client = (id) => byId('clients', id);
export const document = (id) => byId('documents', id);
