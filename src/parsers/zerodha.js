// ── ZERODHA PARSERS ──────────────────────────────────────

import { uuid } from '../lib/utils';
import * as XLSX from 'xlsx';

// Sector/industry enrichment map
const SECTOR_MAP = {
  'BEL':       { name: 'Bharat Electronics Ltd',    sector: 'Defence',    industry: 'Defence Electronics',  category: 'Defence' },
  'HAL':       { name: 'Hindustan Aeronautics',      sector: 'Defence',    industry: 'Aerospace',            category: 'Defence' },
  'PFC':       { name: 'Power Finance Corporation',  sector: 'Financials', industry: 'Power NBFC',           category: 'Finance' },
  'RECLTD':    { name: 'REC Limited',                sector: 'Financials', industry: 'Power NBFC',           category: 'Finance' },
  'HDFCBANK':  { name: 'HDFC Bank',                  sector: 'Financials', industry: 'Private Bank',         category: 'Finance' },
  'LT':        { name: 'Larsen & Toubro',            sector: 'Engineering',industry: 'Infrastructure/EPC',   category: 'Industrials' },
  'ITC':       { name: 'ITC Ltd',                    sector: 'FMCG',       industry: 'Cigarettes/Hotels/IT', category: 'Consumer Staples' },
  'COALINDIA': { name: 'Coal India',                 sector: 'Energy',     industry: 'Coal Mining',          category: 'Energy' },
  'NTPC':      { name: 'NTPC Ltd',                   sector: 'Power',      industry: 'Power Generation',     category: 'Utilities' },
  'INFY':      { name: 'Infosys',                    sector: 'IT',         industry: 'IT Services',          category: 'IT' },
  'TCS':       { name: 'TCS',                        sector: 'IT',         industry: 'IT Services',          category: 'IT' },
  'HCLTECH':   { name: 'HCL Technologies',           sector: 'IT',         industry: 'IT Services',          category: 'IT' },
  'WIPRO':     { name: 'Wipro',                      sector: 'IT',         industry: 'IT Services',          category: 'IT' },
  'COFORGE':   { name: 'Coforge',                    sector: 'IT',         industry: 'IT Services',          category: 'IT' },
  'ZOMATO':    { name: 'Zomato',                     sector: 'Consumer Internet', industry: 'Food Delivery', category: 'Consumer Discretionary' },
  'POLYCAB':   { name: 'Polycab India',              sector: 'Industrials',industry: 'Cables & Wires',       category: 'Industrials' },
  'GOLDCASE-E':{ name: 'Nippon India Gold ETF',      sector: 'Commodities',industry: 'Gold ETF',            category: 'Gold' },
  'GOLDBEES':  { name: 'Nippon Gold ETF',            sector: 'Commodities',industry: 'Gold ETF',            category: 'Gold' },
};

export function enrichEquity(h) {
  const d = SECTOR_MAP[h.symbol] || SECTOR_MAP[(h.name || '').toUpperCase()];
  if (d) {
    if (!h.name || h.name === h.symbol) h.name = d.name;
    h.sector   = d.sector;
    h.industry = d.industry;
    if (!h.category || h.category === 'Equity') h.category = d.category;
  }
  return h;
}

// ── Holdings CSV (Zerodha Console → Holdings) ──────────
export function parseZerodhaHoldingsCsv(text) {
  const lines = text.split('\n');
  let headerIdx = -1, colMap = {};

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    const symCol = row.findIndex(c => /^(symbol|instrument)$/i.test(c));
    if (symCol >= 0) {
      headerIdx = i;
      colMap.sym     = symCol;
      colMap.isin    = row.findIndex(c => /^isin$/i.test(c));
      colMap.qty     = row.findIndex(c => /quantity available/i.test(c));
      if (colMap.qty < 0) colMap.qty = row.findIndex(c => /^qty$/i.test(c));
      colMap.avgCost = row.findIndex(c => /average price|avg.*cost/i.test(c));
      colMap.ltp     = row.findIndex(c => /^ltp$|previous closing/i.test(c));
      break;
    }
  }

  if (headerIdx < 0) throw new Error('Header row not found in Zerodha CSV');

  const holdings = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    const sym    = row[colMap.sym]     || '';
    const isin   = colMap.isin >= 0   ? row[colMap.isin]   || '' : '';
    const qty    = parseFloat(row[colMap.qty])     || 0;
    const avg    = parseFloat(row[colMap.avgCost]) || 0;
    const ltp    = parseFloat(row[colMap.ltp])     || 0;
    if (!sym || qty <= 0) continue;

    const h = enrichEquity({
      id: uuid(), type: 'equity', market: 'IN', broker: 'Zerodha',
      symbol: sym, isin, name: sym, category: 'Equity',
      quantity: qty, avgCost: avg, currency: 'INR',
      currentPrice: ltp || avg,
      lastUpdated: new Date().toISOString(), isManual: false,
    });
    holdings.push(h);
  }
  return holdings;
}

// ── P&L XLSX (Zerodha Console → Reports → P&L) ─────────
export async function parseZerodhaPnLXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws  = wb.Sheets['Equity'] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('No Equity sheet found');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerIdx = -1, colMap = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const symCol = row.findIndex(c => c && /^symbol$/i.test(String(c).trim()));
    if (symCol >= 0) {
      headerIdx = i;
      const h = r => row.findIndex(c => c && new RegExp(r, 'i').test(String(c).trim()));
      colMap.sym     = symCol;
      colMap.isin    = h('^isin$');
      colMap.ltp     = h('previous closing');
      colMap.openQty = h('^open quantity$');
      colMap.openVal = h('^open value$');
      colMap.unrlPL  = h('^unrealized p.?l$');
      colMap.unrlPct = h('unrealized p.?l pct');
      break;
    }
  }
  if (headerIdx < 0) throw new Error('Header not found in P&L XLSX');

  const holdings = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const sym    = String(row[colMap.sym]    || '').trim();
    const isin   = colMap.isin >= 0 ? String(row[colMap.isin] || '').trim() : '';
    const openQty= parseFloat(row[colMap.openQty]) || 0;
    const openVal= parseFloat(row[colMap.openVal]) || 0;
    const ltp    = parseFloat(row[colMap.ltp])     || 0;
    if (!sym || openQty <= 0) continue;

    const h = enrichEquity({
      id: uuid(), type: 'equity', market: 'IN', broker: 'Zerodha',
      symbol: sym, isin, name: sym, category: 'Equity',
      quantity: openQty,
      avgCost: openQty > 0 ? openVal / openQty : ltp,
      currency: 'INR', currentPrice: ltp,
      lastUpdated: new Date().toISOString(), isManual: false,
    });
    holdings.push(h);
  }
  return holdings;
}

// ── Tradebook CSV (for XIRR) ────────────────────────────
export function parseZerodhaTradebook(text) {
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.split(',').map(c => c.replace(/"/g, '').trim().toLowerCase()) || [];
  const col = k => header.indexOf(k);
  const cSym  = col('symbol'), cDate = col('trade_date');
  const cType = col('trade_type'), cQty = col('quantity'), cPrice = col('price');

  const bySymbol = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 5) continue;
    const sym   = cols[cSym];
    const date  = new Date(cols[cDate]);
    const type  = cols[cType];
    const qty   = parseFloat(cols[cQty])   || 0;
    const price = parseFloat(cols[cPrice]) || 0;
    if (!sym || !qty) continue;
    if (!bySymbol[sym]) bySymbol[sym] = { trades: [] };
    bySymbol[sym].trades.push({ date, type, qty, price, amount: qty * price });
  }
  return bySymbol;
}
