// ── BANK STATEMENT PARSERS ────────────────────────────────

import { uuid } from '../lib/utils';

// ── HDFC NRO BANK STATEMENT ──────────────────────────────
const HDFC_SELF = /sheeba\s*kaul|ib funds transfer|imps.*sahil.*sbin|rda fir inw|rev-imps|rev-upi.*sahil|zerodha broking ltd.*dscnb|neft cr.*zerodha|talentdesk/i;
const HDFC_SKIP = /interest paid|tax deducted|opening bal|closing bal|statement summary|debit card annual|cheque bk chgs|generated on|computer generated/i;
const HDFC_FD   = /fd through mobile|fixed deposit/i;
const HDFC_ZRD  = /zerodha broking|dhdf.*motil|dhdfoir|billdkmotil/i;
const HDFC_MF   = /motilal|canara robeco|icici pru.*mf|sip.*mandate/i;
const HDFC_LOAN = /ach d.*racpc jammu/i;

export function parseHDFCStatement(text) {
  const transactions = [];
  let closingBal = 0;

  // Extract closing balance
  const cbM = text.match(/Closing\s+Bal[^0-9]*([\d,]+\.?\d*)/i);
  if (cbM) closingBal = parseFloat(cbM[1].replace(/,/g, ''));

  // Clean page headers
  text = text
    .replace(/Page No\s*\.\s*:\s*\d+\s*Statement of account/gi, ' ')
    .replace(/MR SAHIL SUKARAN CHATTA[\s\S]*?JAMMU AND KASHMIR/g, ' ')
    .replace(/Statement From[\s\S]*?Account Type[\s\S]*?SAVINGS[^\n]*/g, ' ')
    .replace(/HDFC BANK LIMITED[\s\S]*?Mumbai 400013/g, ' ')
    .replace(/\s{2,}/g, ' ');

  // Split on date tokens
  const rows = text.split(/(?=\b\d{2}\/\d{2}\/\d{2}\b)/);

  for (const row of rows) {
    const dateM = row.match(/^(\d{2})\/(\d{2})\/(\d{2})/);
    if (!dateM) continue;
    const isoDate = `20${dateM[3]}-${dateM[2]}-${dateM[1]}`;

    const amounts = [...row.matchAll(/\b([\d,]{1,10}\.\d{2})\b/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(v => v >= 1 && v < 5_000_000);
    if (!amounts.length) continue;

    const narr = row
      .replace(/\d{2}\/\d{2}\/\d{2}/g, ' ')
      .replace(/\d{10,}/g, ' ')
      .replace(/[\d,]+\.\d{2}/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 60);

    if (!narr || narr.length < 3) continue;
    if (HDFC_SKIP.test(narr)) continue;

    const amt = amounts[0];
    const isCredit = /\bcr\b|credit|deposit|received|inward|neft cr|ach c|return|rev-upi|rev-imps/i.test(row);
    if (isCredit) continue;

    // Tag investment/self-transfer instead of skipping
    if (HDFC_SELF.test(narr)) {
      transactions.push({ id: uuid(), date: isoDate, amount: amt, description: 'Self Transfer', category: 'Self Transfer', source: 'HDFC Bank', currency: 'INR' });
      continue;
    }
    if (HDFC_FD.test(row)) {
      transactions.push({ id: uuid(), date: isoDate, amount: amt, description: 'Fixed Deposit Created', category: 'Investment - FD', source: 'HDFC Bank', currency: 'INR' });
      continue;
    }
    if (HDFC_ZRD.test(row)) {
      transactions.push({ id: uuid(), date: isoDate, amount: amt, description: 'Zerodha Investment', category: 'Investment - Stocks', source: 'HDFC Bank', currency: 'INR' });
      continue;
    }
    if (HDFC_MF.test(row)) {
      transactions.push({ id: uuid(), date: isoDate, amount: amt, description: 'Mutual Fund Investment', category: 'Investment - MF', source: 'HDFC Bank', currency: 'INR' });
      continue;
    }

    // Categorise regular expenses
    let cat = 'Other', merchant = narr;
    if (HDFC_LOAN.test(narr))                              { cat = 'EMI / Loan';      merchant = 'Home Loan EMI'; }
    else if (/airtel/i.test(narr))                         { cat = 'Utilities';       merchant = 'Airtel'; }
    else if (/spotify/i.test(narr))                        { cat = 'Subscriptions';   merchant = 'Spotify'; }
    else if (/jiohotstar|hotstar/i.test(narr))             { cat = 'Subscriptions';   merchant = 'JioHotstar'; }
    else if (/zomato/i.test(narr))                         { cat = 'Food & Dining';   merchant = 'Zomato'; }
    else if (/amazon/i.test(narr))                         { cat = 'Shopping';        merchant = 'Amazon'; }
    else if (/flipkart/i.test(narr))                       { cat = 'Shopping';        merchant = 'Flipkart'; }
    else if (/google.*digital|google play/i.test(narr))    { cat = 'Utilities';       merchant = 'Google Utility'; }
    else if (/dmrc|delhi metro/i.test(narr))               { cat = 'Transport';       merchant = 'Delhi Metro'; }
    else if (/upi-/i.test(narr)) {
      const m = narr.match(/UPI-([A-Z][A-Z0-9 &]+?)(?:\s*[-@]|$)/i);
      merchant = m ? m[1].trim().slice(0, 30) : narr.slice(0, 30);
    }

    transactions.push({ id: uuid(), date: isoDate, amount: amt, description: merchant, category: cat, source: 'HDFC Bank', currency: 'INR' });
  }

  return {
    transactions,
    expenses:      transactions, // alias
    closingBal,
    closingBalINR: closingBal,
    balance:       closingBal,
    isCC:          false,
    currency:      'INR',
    debits:        transactions.length,
    credits:       0,
    account:       'HDFC NRO',
    source:        'HDFC Bank',
  };
}

// ── HSBC INDONESIA BANK STATEMENT ────────────────────────
export function parseHSBCStatement(text) {
  // Token-based scanner — HSBC text has no consistent date-per-row
  const MON = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  const SKIP = new Set(['balance','brought','forward','ref','pib','prim','bbsm','tfr_to','wise','ol','hib','djoko','kanmo','asriah','perkantoran','menara','era','jl','senen','raya','jakarta','indonesia','ac','lt']);
  const SELF_RE = /sheeba|kaul|asriah|pembantu/i;

  let closingBal = 0;
  const cbM = text.match(/Closing Balance[\s\S]{0,30}?([\d,]+)/i);
  if (cbM) closingBal = parseInt(cbM[1].replace(/,/g,''));

  // Tokenise
  const tokens = [];
  for (const m of text.matchAll(/(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})|(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|[\d,]+|[A-Za-z*][A-Za-z0-9*\-./]*/gi)) {
    tokens.push(m[0]);
  }

  const expenses = [];
  let currentDate = '';
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    // Full date: DDMonYYYY
    const fullDate = tok.match(/^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})$/i);
    if (fullDate) {
      const [,d,mStr,y] = fullDate;
      const mo = String(MON[mStr.toLowerCase()]).padStart(2,'0');
      currentDate = `${y}-${mo}-${d.padStart(2,'0')}`;
      i++; continue;
    }

    // Short date: DDMon (carries year from last full date)
    const shortDate = tok.match(/^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i);
    if (shortDate && currentDate) {
      const [,d,mStr] = shortDate;
      const mo = String(MON[mStr.toLowerCase()]).padStart(2,'0');
      const yr = currentDate.slice(0,4);
      currentDate = `${yr}-${mo}-${d.padStart(2,'0')}`;
      i++; continue;
    }

    // Merchant word + amount
    if (/^[A-Za-z]/.test(tok) && !SKIP.has(tok.toLowerCase())) {
      const words = [tok];
      let j = i + 1;
      while (j < tokens.length && j < i + 4 && /^[A-Za-z*]/.test(tokens[j]) && !SKIP.has(tokens[j].toLowerCase())) {
        words.push(tokens[j]); j++;
      }
      // Next numeric = amount?
      if (j < tokens.length && /^[\d,]+$/.test(tokens[j])) {
        const amt = parseInt(tokens[j].replace(/,/g,''));
        if (amt >= 1000 && amt <= 50_000_000) {
          const merchant = words.join(' ');
          if (!SELF_RE.test(merchant) && currentDate) {
            let cat = 'Other';
            if (/grab|gojek|ojek/i.test(merchant))     cat = 'Transport';
            if (/shopee|tokopedia/i.test(merchant))    cat = 'Shopping';
            if (/segari|market/i.test(merchant))       cat = 'Groceries';
            if (/disney|netflix|spotify/i.test(merchant)) cat = 'Subscriptions';
            if (/dentisteam|dental/i.test(merchant))   cat = 'Health & Medical';
            if (/bpjs|insurance/i.test(merchant))      cat = 'Insurance';

            expenses.push({ id: uuid(), date: currentDate, amount: amt, description: merchant, category: cat, source: 'HSBC Bank', currency: 'IDR' });
          }
          i = j + 1; continue;
        }
      }
    }
    i++;
  }

  return { transactions: expenses, expenses, closingBal, closingBalINR: closingBal, balance: closingBal, isCC: false, currency: 'IDR', debits: expenses.length, credits: 0, source: 'HSBC Bank' };
}

// ── HSBC CC STATEMENT ────────────────────────────────────
export function parseHSBCCC(text) {
  const expenses = [];
  const MON = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const currentYear = new Date().getFullYear();

  const txnRe = /(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+([\s\S]+?)\s+([\d,]+)(?:\s*IDR)?\s*(?!\s*CR)/gi;

  let m;
  while ((m = txnRe.exec(text)) !== null) {
    const d  = m[1], mStr = m[2], desc = m[3].trim(), amtStr = m[4];
    const mo = String(MON[mStr.toLowerCase()]).padStart(2,'0');
    const date = `${currentYear}-${mo}-${d.padStart(2,'0')}`;
    const amt  = parseInt(amtStr.replace(/,/g,''));
    if (amt < 1000 || amt > 20_000_000) continue;
    if (/payment|thank you|cash back/i.test(desc)) continue;

    let cat = 'Other';
    if (/grab|gojek/i.test(desc))      cat = 'Transport';
    if (/shopee|tokopedia/i.test(desc)) cat = 'Shopping';
    if (/segari/i.test(desc))          cat = 'Groceries';
    if (/disney|netflix|spotify/i.test(desc)) cat = 'Subscriptions';
    if (/google/i.test(desc))          cat = 'Subscriptions';

    expenses.push({ id: uuid(), date, amount: amt, description: desc.slice(0,50), category: cat, source: 'HSBC CC', currency: 'IDR' });
  }

  return { transactions: expenses, expenses, closingBal: 0, isCC: true, currency: 'IDR', source: 'HSBC CC' };
}

export function parseBankStatement(text, bank) {
  const isCC = /CREDIT CARD STATEMENT|Tagihan Bulan Ini|Tanggal Jatuh Tempo/i.test(text);
  if (bank === 'HSBC' && isCC) return parseHSBCCC(text);
  if (bank === 'HSBC') return parseHSBCStatement(text);
  return parseHDFCStatement(text);
}
