// Record factories and defaults. Money fields are strings handled by Dec.
export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function nowISO() { return new Date().toISOString(); }

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const PAYMENT_TERMS = [
  { id: 'receipt', label: 'Due on receipt', days: 0 },
  { id: 'net7', label: 'Net 7', days: 7 },
  { id: 'net14', label: 'Net 14', days: 14 },
  { id: 'net30', label: 'Net 30', days: 30 },
  { id: 'custom', label: 'Custom date', days: null }
];

export function defaultSettings() {
  const lang = (globalThis.navigator && navigator.language) || 'en-US';
  const region = (lang.split('-')[1] || '').toUpperCase();
  const currencyByRegion = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', HU: 'HUF', CH: 'CHF', JP: 'JPY', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', IN: 'INR', ZA: 'ZAR', BR: 'BRL', MX: 'MXN', SG: 'SGD', HK: 'HKD' };
  const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'HR'];
  const currency = currencyByRegion[region] || (euro.includes(region) ? 'EUR' : 'USD');
  return {
    id: 'app',
    currency,
    taxRate: '0',
    taxLabel: 'Tax',
    paymentTerms: 'net30',
    estimateValidDays: 30,
    invoicePrefix: 'INV-',
    estimatePrefix: 'EST-',
    numberPadding: 4,
    accentColor: '#2563EB',
    pageSize: 'letter',
    emailSubjectInvoice: 'Invoice {number} from {business}',
    emailSubjectEstimate: 'Estimate {number} from {business}',
    emailBodyInvoice: 'Hi {client},\n\nPlease find attached invoice {number} for {total}, due {dueDate}.\n\nThank you for your business!\n\n{business}',
    emailBodyEstimate: 'Hi {client},\n\nPlease find attached estimate {number} for {total}, valid until {validUntil}.\n\nLet me know if you have any questions.\n\n{business}',
    demoData: false,
    onboarded: false
  };
}

export function newBusiness(partial = {}) {
  return {
    id: uid(),
    name: '',
    logo: null,
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    taxNumber: '',
    paymentInstructions: '',
    defaultNotes: '',
    isDefault: false,
    nextInvoiceNumber: 1,
    nextEstimateNumber: 1,
    createdAt: nowISO(),
    ...partial
  };
}

export function newClient(partial = {}) {
  return {
    id: uid(),
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    createdAt: nowISO(),
    ...partial
  };
}

export function newLineItem(partial = {}) {
  return { id: uid(), type: 'item', title: '', details: '', quantity: '1', unitPrice: '', ...partial };
}

export function newSection(partial = {}) {
  return { id: uid(), type: 'section', title: '', ...partial };
}

export function newSavedItem(partial = {}) {
  return { id: uid(), title: '', details: '', unitPrice: '', createdAt: nowISO(), ...partial };
}

export function newDocument(kind, { settings, business = null, number = '' } = {}) {
  const s = settings || defaultSettings();
  const isInvoice = kind === 'invoice';
  return {
    id: uid(),
    kind,
    number,
    businessId: business ? business.id : null,
    clientId: null,
    issueDate: todayISO(),
    paymentTerms: s.paymentTerms,
    dueDate: null,
    validUntil: null,
    status: isInvoice ? 'draft' : 'open',
    sentAt: null,
    paidAt: null,
    currency: s.currency,
    discountType: 'none',
    discountValue: '0',
    taxLabel: s.taxLabel,
    taxRate: s.taxRate,
    notes: business ? business.defaultNotes || '' : '',
    terms: '',
    paymentInstructions: business ? business.paymentInstructions || '' : '',
    items: [],
    convertedFromId: null,
    convertedToId: null,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
}
