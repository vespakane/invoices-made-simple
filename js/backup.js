// Full backup and restore of all app data as a JSON file.
import * as store from './store.js';
import { deliverFile } from './share.js';
import { alert, toast } from './ui.js';

export async function exportBackup() {
  const data = {
    app: 'invoices-made-simple', version: 1, exportedAt: new Date().toISOString(),
    businesses: store.state.businesses, clients: store.state.clients, documents: store.state.documents, savedItems: store.state.savedItems, settings: store.state.settings
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const filename = `Invoices backup ${data.exportedAt.slice(0, 10)}.json`;
  const r = await deliverFile(blob, filename, { title: filename });
  if (r === 'downloaded') toast(`${filename} downloaded`);
}

export function pickBackupFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => { const f = input.files && input.files[0]; input.remove(); resolve(f || null); });
    document.body.append(input);
    input.click();
  });
}

export async function importBackup() {
  const file = await pickBackupFile();
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not a valid backup'); return; }
  if (!data || data.app !== 'invoices-made-simple' || !Array.isArray(data.documents)) { toast('That file is not a valid backup'); return; }
  const counts = `${data.businesses.length} businesses, ${data.clients.length} clients, ${data.documents.length} documents`;
  const mode = await alert({ title: 'Restore backup', message: `Backup from ${(data.exportedAt || '').slice(0, 10)} with ${counts}.\n\nMerge keeps your current data and adds or updates records from the backup. Replace deletes everything first.`, buttons: [
    { label: 'Cancel', value: null, style: 'cancel' }, { label: 'Merge', value: 'merge', bold: true }, { label: 'Replace All', value: 'replace', style: 'destructive' }
  ] });
  if (!mode) return;
  if (mode === 'replace') await store.wipeAll();
  for (const name of ['businesses', 'clients', 'documents', 'savedItems']) {
    const rows = (data[name] || []).filter((r) => r && r.id);
    if (rows.length) await store.saveMany(name, rows);
  }
  if (data.settings) { const { id, ...rest } = data.settings; await store.saveSettings(rest); }
  toast('Backup restored');
}
