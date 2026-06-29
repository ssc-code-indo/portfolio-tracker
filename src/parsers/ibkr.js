// ── IBKR CSV PARSER ──────────────────────────────────────
// Parses IBKR Transaction History CSV export
// Format: Transaction History,Data,Date,Account,Desc,TxnType,Symbol,Qty,Price,Currency,...

import { uuid } from '../lib/utils';

export function parseIBKRCsv(text) {
  const lines = text.split(/\r?\n/);
  const positions = {};

  for (const line of lines) {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 8) continue;
    const [section, rowtype, , , desc, txnType, sym, qtyStr, priceStr, currency] = cols;

    // Transaction History format
    if (section === 'Transaction History' && rowtype === 'Data') {
      const qty   = parseFloat(qtyStr)   || 0;
      const price = parseFloat(priceStr) || 0;
      if (!sym || sym === '-' || !qty || !price) continue;
      if (!['Buy', 'Sell'].includes(txnType)) continue;

      if (!positions[sym]) positions[sym] = { sym, name: desc || sym, qty: 0, totalCost: 0, buys: 0, currency: currency || 'USD' };
      if (txnType === 'Buy')  { positions[sym].qty += qty;          positions[sym].totalCost += qty * price; positions[sym].buys++; }
      if (txnType === 'Sell') { positions[sym].qty -= Math.abs(qty); }
    }

    // Classic Open Positions format
    if (section === 'Open Positions' && rowtype === 'Data' && cols[2] === 'Stocks') {
      const [,,,symC, nameC, qtyC,,costC,,closeC] = cols;
      const qty  = parseFloat(qtyC)   || 0;
      const cost = parseFloat(costC)  || 0;
      const close= parseFloat(closeC) || cost;
      if (symC && qty > 0 && !positions[symC]) {
        positions[symC] = { sym: symC, name: nameC || symC, qty, totalCost: qty * cost, buys: 1, currency: 'USD' };
      }
    }
  }

  return Object.values(positions)
    .filter(p => p.qty > 0.0001)
    .map(p => ({
      id:           uuid(),
      type:         'equity',
      market:       'US',
      broker:       'IBKR',
      symbol:       p.sym,
      name:         p.name.slice(0, 40),
      category:     'US Equity',
      quantity:     p.qty,
      avgCost:      p.buys > 0 && p.totalCost > 0 ? p.totalCost / p.qty : 0,
      currency:     p.currency || 'USD',
      currentPrice: p.buys > 0 && p.totalCost > 0 ? p.totalCost / p.qty : 0,
      lastUpdated:  new Date().toISOString(),
      isManual:     false,
    }));
}
