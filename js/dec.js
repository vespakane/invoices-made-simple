// Exact decimal arithmetic for money, built on BigInt. Never uses floating point.
// Values are stored as strings ("12.50") in records and converted with Dec.from().
const PLACES = 6n;
const ONE = 10n ** PLACES;

function abs(n) { return n < 0n ? -n : n; }
function divRound(a, b) {
  // Round half away from zero.
  const q = a / b;
  const r = a % b;
  if (abs(r) * 2n >= abs(b)) return q + ((a < 0n) !== (b < 0n) ? -1n : 1n);
  return q;
}

export function normalizeNumberString(input) {
  // Accepts "1,234.56", "1.234,56", "12,5", "12.5", "$12.50", "-3" and returns "1234.56" style.
  let s = String(input ?? '').trim().replace(/\s/g, '').replace(/[^\d.,\-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // A single comma followed by exactly three digits reads as a thousands separator ("4,800");
    // anything else reads as a decimal comma ("12,5", "12,50").
    if (s.indexOf(',') === lastComma) s = /^-?[1-9]\d{0,2},\d{3}$/.test(s) ? s.replace(',', '') : s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastDot > -1 && s.indexOf('.') !== lastDot) {
    s = s.replace(/\./g, '');
  }
  return s;
}

export class Dec {
  constructor(raw) { this.raw = raw; }

  static from(v) {
    if (v instanceof Dec) return v;
    if (v === null || v === undefined || v === '') return Dec.ZERO;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return Dec.ZERO;
      v = v.toFixed(6);
    }
    const s = normalizeNumberString(v);
    const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) return Dec.ZERO;
    const neg = m[1] === '-';
    const intPart = BigInt(m[2] || '0');
    const fracDigits = (m[3] || '').slice(0, 6).padEnd(6, '0');
    let raw = intPart * ONE + BigInt(fracDigits);
    if (neg) raw = -raw;
    return new Dec(raw);
  }

  add(o) { return new Dec(this.raw + Dec.from(o).raw); }
  sub(o) { return new Dec(this.raw - Dec.from(o).raw); }
  mul(o) { return new Dec(divRound(this.raw * Dec.from(o).raw, ONE)); }
  div(o) {
    const d = Dec.from(o).raw;
    if (d === 0n) return Dec.ZERO;
    return new Dec(divRound(this.raw * ONE, d));
  }
  percent(p) { return this.mul(p).div(100); }
  neg() { return new Dec(-this.raw); }
  abs() { return new Dec(abs(this.raw)); }
  cmp(o) { const r = Dec.from(o).raw; return this.raw < r ? -1 : this.raw > r ? 1 : 0; }
  eq(o) { return this.cmp(o) === 0; }
  lt(o) { return this.cmp(o) < 0; }
  gt(o) { return this.cmp(o) > 0; }
  isZero() { return this.raw === 0n; }
  isNeg() { return this.raw < 0n; }
  min(o) { return this.lt(o) ? this : Dec.from(o); }
  max(o) { return this.gt(o) ? this : Dec.from(o); }

  round(places = 2) {
    const p = BigInt(Math.max(0, Math.min(6, places)));
    const factor = 10n ** (PLACES - p);
    return new Dec(divRound(this.raw, factor) * factor);
  }

  toFixed(places = 2) {
    const r = this.round(places);
    const neg = r.raw < 0n;
    const a = abs(r.raw);
    const intPart = a / ONE;
    const frac = (a % ONE).toString().padStart(6, '0').slice(0, places);
    return (neg ? '-' : '') + intPart.toString() + (places > 0 ? '.' + frac : '');
  }

  toString() {
    // Canonical form without trailing zeros, e.g. "12.5", "3", "0.125".
    const neg = this.raw < 0n;
    const a = abs(this.raw);
    const intPart = a / ONE;
    let frac = (a % ONE).toString().padStart(6, '0').replace(/0+$/, '');
    return (neg && a !== 0n ? '-' : '') + intPart.toString() + (frac ? '.' + frac : '');
  }

  toNumber() { return Number(this.toString()); }
  toJSON() { return this.toString(); }
}
Dec.ZERO = new Dec(0n);
Dec.ONE = new Dec(ONE);

export const D = (v) => Dec.from(v);
