import { h, topbar, backBtn, barBtn, group, cell, actionCell, avatar, field, toggleField, emptyState, icon, confirm, toast, haptic, clear } from '../ui.js';
import * as nav from '../nav.js';
import * as store from '../store.js';
import { newBusiness } from '../models.js';
import { initials } from '../format.js';

export function businessesScreen() {
  const content = h('div', { class: 'content' });
  const screen = h('div', {},
    topbar({
      title: 'Businesses',
      left: backBtn(() => nav.pop()),
      right: barBtn('', { iconName: 'plus', cls: 'plus', ariaLabel: 'Add business', onClick: () => openBusinessEditor(null) })
    }),
    content
  );

  function render() {
    clear(content);
    const list = [...store.state.businesses].sort((a, b) => (b.isDefault - a.isDefault) || a.name.localeCompare(b.name));
    if (!list.length) {
      content.append(
        emptyState({ iconName: 'building', title: 'No businesses yet', text: 'Add your business details once and they will appear on every invoice and estimate.' }),
        h('div', { class: 'group' }, h('button', { class: 'btn', type: 'button', onClick: () => openBusinessEditor(null) }, icon('plus'), 'Add Business'))
      );
      return;
    }
    content.append(group({ footer: 'The default business is pre-selected on new invoices and estimates.' },
      ...list.map((b) => cell({
        title: b.name || 'Untitled business',
        subtitle: b.ownerName || b.email || null,
        subOneLine: true,
        avatar: avatar(initials(b.name), b.logo),
        badge: b.isDefault ? 'Default' : null,
        chevron: true,
        onClick: () => openBusinessEditor(b)
      }))
    ));
  }

  render();
  const off = store.onChange(render);
  screen.onHide = off;
  return screen;
}

// Opens the editor as a modal sheet. Resolves with the saved business, or null when cancelled.
export function openBusinessEditor(business) {
  const isNew = !business;
  const draft = isNew ? newBusiness({ isDefault: store.state.businesses.length === 0 }) : { ...business };
  let dirty = false;
  const mark = () => { dirty = true; };

  const logoBox = h('div', { class: 'logo-box' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const removeBtn = h('button', { type: 'button', class: 'destructive', onClick: () => { draft.logo = null; mark(); renderLogo(); } }, 'Remove Logo');
  function renderLogo() {
    clear(logoBox);
    if (draft.logo) logoBox.append(h('img', { src: draft.logo, alt: 'Logo' })); else logoBox.append(icon('photo'));
    removeBtn.classList.toggle('hidden', !draft.logo);
  }
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      draft.logo = await resizeImage(file, 800);
      mark();
      renderLogo();
    } catch (e) {
      console.error(e);
      toast('Could not load that image');
    }
  });
  renderLogo();

  const defaultToggle = toggleField({ label: 'Default business', value: !!draft.isDefault, onChange: (v) => { draft.isDefault = v; mark(); } });

  const content = h('div', { class: 'content' },
    h('section', { class: 'group' }, h('div', { class: 'cells' },
      h('div', { class: 'logo-picker' }, logoBox, h('div', { class: 'logo-actions' },
        h('button', { type: 'button', onClick: () => fileInput.click() }, draft.logo ? 'Change Logo' : 'Add Logo'), removeBtn), fileInput),
      field({ label: 'Business name', value: draft.name, placeholder: 'Required', autocapitalize: 'words', stacked: true, onInput: (v) => { draft.name = v; mark(); } }),
      field({ label: 'Owner name', value: draft.ownerName, placeholder: 'Your name', autocapitalize: 'words', stacked: true, onInput: (v) => { draft.ownerName = v; mark(); } })
    )),
    group({ header: 'Contact' },
      field({ label: 'Email', value: draft.email, placeholder: 'you@example.com', type: 'email', inputmode: 'email', autocapitalize: 'none', stacked: true, onInput: (v) => { draft.email = v.trim(); mark(); } }),
      field({ label: 'Phone', value: draft.phone, placeholder: '+1 555 123 4567', type: 'tel', inputmode: 'tel', stacked: true, onInput: (v) => { draft.phone = v; mark(); } }),
      field({ label: 'Address', value: draft.address, placeholder: 'Street\nCity, State ZIP', multiline: true, autocapitalize: 'words', onInput: (v) => { draft.address = v; mark(); } }),
      field({ label: 'Website', value: draft.website, placeholder: 'www.example.com', type: 'url', inputmode: 'url', autocapitalize: 'none', stacked: true, onInput: (v) => { draft.website = v.trim(); mark(); } }),
      field({ label: 'Tax / registration number', value: draft.taxNumber, placeholder: 'Optional', stacked: true, autocapitalize: 'characters', onInput: (v) => { draft.taxNumber = v; mark(); } })
    ),
    group({ header: 'Defaults for new documents', footer: 'Payment instructions, such as bank details, are printed at the bottom of every invoice. You can change them per document.' },
      field({ label: 'Payment instructions', value: draft.paymentInstructions, placeholder: 'Bank name, account number, PayPal…', multiline: true, onInput: (v) => { draft.paymentInstructions = v; mark(); } }),
      field({ label: 'Default notes', value: draft.defaultNotes, placeholder: 'Thank you for your business!', multiline: true, onInput: (v) => { draft.defaultNotes = v; mark(); } })
    ),
    group({ header: 'Numbering', footer: 'The number the next new invoice or estimate for this business will get.' },
      field({ label: 'Next invoice number', value: String(draft.nextInvoiceNumber || 1), inputmode: 'numeric', onInput: (v) => { const n = parseInt(v, 10); if (n > 0) { draft.nextInvoiceNumber = n; mark(); } } }),
      field({ label: 'Next estimate number', value: String(draft.nextEstimateNumber || 1), inputmode: 'numeric', onInput: (v) => { const n = parseInt(v, 10); if (n > 0) { draft.nextEstimateNumber = n; mark(); } } })
    ),
    group({}, defaultToggle),
    isNew ? null : group({}, actionCell('Delete Business', { destructive: true, center: true, onClick: deleteBusiness }))
  );

  let resolved = null;
  const sheetEl = h('div', {},
    topbar({
      title: isNew ? 'New Business' : 'Edit Business',
      left: barBtn('Cancel', { onClick: cancel }),
      right: barBtn('Save', { primary: true, onClick: save })
    }),
    content
  );

  async function cancel() {
    if (dirty && !(await confirm({ title: 'Discard changes?', confirmLabel: 'Discard' }))) return;
    nav.pop(null);
  }

  async function save() {
    draft.name = draft.name.trim();
    if (!draft.name) { toast('Please enter a business name'); content.querySelector('input').focus(); return; }
    const others = store.state.businesses.filter((b) => b.id !== draft.id);
    if (draft.isDefault) {
      const changed = others.filter((b) => b.isDefault).map((b) => ({ ...b, isDefault: false }));
      if (changed.length) await store.saveMany('businesses', changed);
    } else if (!others.some((b) => b.isDefault)) {
      draft.isDefault = true;
    }
    await store.save('businesses', draft);
    haptic('success');
    resolved = draft;
    nav.pop(draft);
  }

  async function deleteBusiness() {
    const ok = await confirm({ title: `Delete “${draft.name}”?`, message: 'Documents created for this business are kept.', confirmLabel: 'Delete' });
    if (!ok) return;
    await store.remove('businesses', draft.id);
    if (draft.isDefault && store.state.businesses.length) {
      await store.save('businesses', { ...store.state.businesses[0], isDefault: true });
    }
    nav.pop(null);
  }

  const p = nav.sheet(sheetEl);
  if (isNew) setTimeout(() => { const i = content.querySelector('input'); if (i) i.focus(); }, 450);
  return p.then((v) => v === undefined ? resolved : v);
}

export function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), ht = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = ht;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, ht);
      const isPng = /png|gif|webp|svg/i.test(file.type);
      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
