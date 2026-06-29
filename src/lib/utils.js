// ── FORMATTERS ───────────────────────────────────────────

export function uuid() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

export function fmtINR(n) {
  if (n == null || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  let s;
  if (abs >= 1e7)       s = '₹' + (n/1e7).toFixed(2) + 'Cr';
  else if (abs >= 1e5)  s = '₹' + (n/1e5).toFixed(2) + 'L';
  else if (abs >= 1e3)  s = '₹' + n.toLocaleString('en-IN', {maximumFractionDigits:0});
  else                  s = '₹' + n.toFixed(0);
  return s;
}

export function fmtIDR(n) {
  if (n == null || isNaN(n)) return 'Rp0';
  const abs = Math.abs(n);
  if (abs >= 1e9)  return 'Rp' + (n/1e9).toFixed(2) + 'B';
  if (abs >= 1e6)  return 'Rp' + (n/1e6).toFixed(2) + 'M';
  return 'Rp' + n.toLocaleString('id-ID', {maximumFractionDigits:0});
}

export function fmtUSD(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

export function fmt(n, currency = 'INR') {
  if (currency === 'IDR') return fmtIDR(n);
  if (currency === 'USD') return fmtUSD(n);
  return fmtINR(n);
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '0.00%';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
}

// ── CALCULATIONS ─────────────────────────────────────────

export function toINR(amount, currency, state) {
  if (!amount) return 0;
  if (currency === 'IDR') return amount / (state?.inrIdr || 189);
  if (currency === 'USD') return amount * (state?.usdInr || 84);
  return amount;
}

export function holdingValue(h, state) {
  const price = h.currentPrice || h.avgCost || 0;
  return toINR(price * (h.quantity || 1), h.currency, state);
}

export function holdingInvested(h, state) {
  return toINR((h.avgCost || 0) * (h.quantity || 1), h.currency, state);
}

export function holdingPL(h, state) {
  const val = holdingValue(h, state);
  const inv = holdingInvested(h, state);
  return val - inv;
}

export function holdingPLPct(h) {
  if (!h.avgCost || !h.currentPrice) return 0;
  return (h.currentPrice - h.avgCost) / h.avgCost * 100;
}

export function cagr(current, invested, years) {
  if (!invested || !years) return 0;
  return (Math.pow(current / invested, 1 / years) - 1) * 100;
}

export function sipFV(monthly, rateAnnual, months) {
  const r = rateAnnual / 12 / 100;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

export function fdMaturity(principal, ratePercent, years, compounding = 4) {
  const r = ratePercent / 100;
  return principal * Math.pow(1 + r / compounding, compounding * years);
}

// ── XIRR ─────────────────────────────────────────────────

export function xirr(cashflows) {
  // cashflows: [{date: Date, amount: number}]
  // negative = outflow (buy), positive = inflow (sell / current value)
  if (!cashflows || cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date - b.date);
  const t0 = sorted[0].date;
  const years = sorted.map(cf => (cf.date - t0) / (365.25 * 86400000));
  const amts  = sorted.map(cf => cf.amount);

  const npv  = r => amts.reduce((s, a, i) => s + a / Math.pow(1 + r, years[i]), 0);
  const dnpv = r => amts.reduce((s, a, i) => s - years[i] * a / Math.pow(1 + r, years[i] + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    const f = npv(rate), df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    rate -= f / df;
    if (rate <= -1) rate = -0.9999;
  }
  return Math.abs(npv(rate)) < 1 ? rate : null;
}
