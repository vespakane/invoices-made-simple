import { Dec } from './dec.js';

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'INR', 'HUF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
  'RON', 'BGN', 'TRY', 'ZAR', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'SGD', 'HKD', 'KRW', 'THB', 'PHP', 'IDR', 'MYR', 'AED', 'SAR', 'ILS'
];

const fmtCache = new Map();
function nf(currency, opts = {}) {
  const key = currency + JSON.stringify(opts);
  if (!fmtCache.has(key)) {
    try {
      fmtCache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...opts }));
    } catch {
      fmtCache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', ...opts }));
    }
  }
  return fmtCache.get(key);
}

export function currencyDecimals(currency) {
  try { return nf(currency).resolvedOptions().maximumFractionDigits; } catch { return 2; }
}

export function formatMoney(value, currency = 'USD') {
  const d = Dec.from(value);
  const places = currencyDecimals(currency);
  const fixed = d.toFixed(places);
  // Format with Intl using the exactly rounded string so no float drift reaches the display.
  const formatter = nf(currency, { minimumFractionDigits: places, maximumFractionDigits: places });
  return formatter.format(Number(fixed));
}

export function currencySymbol(currency = 'USD') {
  try {
    const parts = nf(currency).formatToParts(0);
    const p = parts.find((x) => x.type === 'currency');
    return p ? p.value : currency;
  } catch { return currency; }
}

export function formatQuantity(value) {
  return Dec.from(value).toString();
}

export function formatDate(iso, style = 'medium') {
  if (!iso) return '';
  const d = parseISODate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: style }).format(d);
}

export function parseISODate(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso, days) {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isPast(iso) {
  const d = parseISODate(iso);
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}

export function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}
