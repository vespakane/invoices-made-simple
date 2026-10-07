import { h, topbar, backBtn, group, cell, actionCell, icon, toggleField, confirm, toast, clear } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { businessesScreen } from './businesses.js';
import { clientsScreen } from './clients.js';
import { itemsScreen } from './items.js';
import { defaultsScreen, styleScreen, templatesScreen } from './settings.js';
import { loadDemoData, removeDemoData, hasDemoData } from '../demo.js';
import { exportList } from '../share.js';
import { exportBackup, importBackup } from '../backup.js';

export const APP_VERSION = '1.0';

function menuIcon(name, color) {
  return h('div', { class: 'avatar', style: { background: color, color: '#fff', width: '30px', height: '30px', borderRadius: '7px' } }, icon(name, 'menu-ic'));
}

export function menuScreen() {
  const content = h('div', { class: 'content' });
  const screen = h('div', {}, topbar({ title: 'Settings', left: backBtn(() => nav.pop()) }), content);

  function render() {
    clear(content);
    const nb = store.state.businesses.length, nc = store.state.clients.length, ni = store.state.savedItems.length;
    const invoices = store.state.documents.filter((d) => d.kind === 'invoice'), estimates = store.state.documents.filter((d) => d.kind === 'estimate');
    content.append(
      group({ footer: 'Clients and your businesses are managed on the Contacts tab.' },
        cell({ title: 'Items Library', value: ni ? String(ni) : 'Add', avatar: menuIcon('tag', '#FF9500'), chevron: true, onClick: () => nav.push(itemsScreen()) })
      ),
      group({ header: 'Preferences' },
        cell({ title: 'Defaults & Numbering', subtitle: `${store.state.settings.currency} · ${store.state.settings.invoicePrefix}…`, avatar: menuIcon('bolt', '#34C759'), chevron: true, onClick: () => nav.push(defaultsScreen()) }),
        cell({ title: 'Document Style', avatar: menuIcon('doc', store.state.settings.accentColor || '#2563EB'), chevron: true, onClick: () => nav.push(styleScreen()) }),
        cell({ title: 'Email Templates', avatar: menuIcon('mail', '#FF3B30'), chevron: true, onClick: () => nav.push(templatesScreen()) })
      ),
      group({ header: 'Export & backup', footer: 'Exports open the share sheet so you can save to Files, email them, or send them to your accountant.' },
        actionCell(`Export invoices (${invoices.length})`, { iconName: 'share', onClick: () => invoices.length ? exportList(invoices, 'Invoices') : toast('No invoices to export') }),
        actionCell(`Export estimates (${estimates.length})`, { iconName: 'share', onClick: () => estimates.length ? exportList(estimates, 'Estimates') : toast('No estimates to export') }),
        actionCell('Back up all data', { iconName: 'folder', onClick: exportBackup }),
        actionCell('Restore from backup…', { iconName: 'duplicate', onClick: importBackup })
      ),
      group({ header: 'Demo', footer: 'Fills the app with sample businesses, clients and documents so you can explore. Demo records can be removed again at any time.' },
        toggleField({ label: 'Show demo data', value: hasDemoData(), onChange: async (v) => {
          if (v) { await loadDemoData(); toast('Demo data added'); }
          else {
            const ok = await confirm({ title: 'Remove demo data?', message: 'Only records marked as demo are removed. Your own data is kept.', confirmLabel: 'Remove' });
            if (ok) { await removeDemoData(); toast('Demo data removed'); } else render();
          }
        } })
      ),
      group({ header: 'About' },
        cell({ title: 'Version', value: APP_VERSION }),
        cell({ title: 'Your data', value: 'Stays on this device' })
      )
    );
  }

  render();
  const off = store.onChange(render);
  screen.onHide = off;
  return screen;
}
