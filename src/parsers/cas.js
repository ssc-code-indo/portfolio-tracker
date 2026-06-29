// ── CAMS / KFintech CAS PARSER ───────────────────────────
// Handles: CAMS CAS (has Total Cost Value) and MFCentral CAS (no cost)
// Robust against PDF.js joining words without spaces on Android

const ISIN_AMFI = {
  'INF760K01JC6': '146130',
  'INF109KC1F91': '151138',
  'INF109K018M4': '120847',
  'INF247L01BF2': '150568',
  'INF247L01DN2': '135798',
  'INF247L01569': '130503',
};

function normalise(text) {
  return text
    // Strip CAMS watermarks (reversed text injected by PDF.js on some devices)
    .replace(/\b\d{4}-eviL\b/g, ' ')
    .replace(/\b[\d.]+V:noisreV\b/g, ' ')
    .replace(/\b\d{10,}-SWSACSMAC\b/g, ' ')
    .replace(/CAMSCASWS-\S+/g, ' ')
    .replace(/Version:V[\d.]+\s+Live-\d+/g, ' ')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, ' ')
    // Normalise no-space joins from Android PDF.js
    .replace(/ClosingUnitBalance/g, 'Closing Unit Balance')
    .replace(/TotalCostValue/g, 'Total Cost Value')
    .replace(/MarketValueon/gi, 'Market Value on')
    .replace(/NAVon/gi, 'NAV on')
    .replace(/FolioNo/gi, 'Folio No')
    .replace(/OpeningUnitBalance/gi, 'Opening Unit Balance')
    .replace(/\s{2,}/g, ' ');
}

// Space-flexible CAMS closing line regex
const CAMS_RE = /Closing\s*Unit\s*Balance\s*:?\s*([\d,]+\.?\d*).{0,300}?NAV\s*on\s*.{0,80}?INR\s*([\d,]+\.?\d*).{0,400}?Total\s*Cost\s*Value\s*:?\s*([\d,]+\.?\d*).{0,300}?Market\s*Value\s*on\s*.{0,80}?INR\s*([\d,]+\.?\d*)/gi;

const ISIN_RE   = /ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{10})/i;
const NAME_RE   = /[A-Z0-9]{4,8}-(.+?)\s*[-–]\s*(?:ISIN\s*:|Non\s*Demat)/i;

export function parseCASTex(text) {
  const mfList = [];
  text = normalise(text);

  const blocks = text.split(/(?=Folio\s*No\s*:)/i);
  let isCams = false;

  for (const block of blocks) {
    CAMS_RE.lastIndex = 0;
    const m = CAMS_RE.exec(block);
    if (!m) continue;
    isCams = true;

    const units   = parseFloat(m[1].replace(/,/g, ''));
    const nav     = parseFloat(m[2].replace(/,/g, ''));
    const cost    = parseFloat(m[3].replace(/,/g, ''));
    const mktVal  = parseFloat(m[4].replace(/,/g, ''));

    const im   = ISIN_RE.exec(block);
    const isin = im ? im[1].trim() : '';

    const nm   = NAME_RE.exec(block);
    let name   = nm ? nm[1].trim() : '';
    name = name.replace(/\s*\(Non[- ]?Demat\).*$/i, '').replace(/\s*\(Advisor.*$/i, '').trim();
    if (!name && isin) name = isin;

    const avgCost = units > 0 ? cost / units : nav;
    const amfi    = ISIN_AMFI[isin] || '';

    // Accumulate multiple folios with same ISIN
    const existing = mfList.find(h => h.isin === isin && isin);
    if (existing) {
      existing.units    += units;
      existing.value    += mktVal;
      existing.invested += cost;
      existing.avgCost   = existing.invested / existing.units;
    } else {
      mfList.push({ type: 'mf', name, units, nav, value: mktVal, isin, invested: cost, avgCost, amfi });
    }
  }

  // MFCentral fallback (no Total Cost Value)
  if (!isCams) {
    const mfcRe = /Closing\s*Unit\s*Balance\s*:?\s*([\d,]+\.?\d*)\s+Nav\s*as\s*on[^:]+:\s*INR\s*([\d,]+\.?\d*)\s+Valuation[^:]+:\s*INR\s*([\d,]+\.?\d*)/gi;
    let bm;
    while ((bm = mfcRe.exec(text)) !== null) {
      const units = parseFloat(bm[1].replace(/,/g, ''));
      const nav   = parseFloat(bm[2].replace(/,/g, ''));
      const value = parseFloat(bm[3].replace(/,/g, ''));
      const before = text.slice(Math.max(0, bm.index - 600), bm.index);
      const im = [...before.matchAll(/ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{10})/gi)].pop();
      const isin = im ? im[1].trim() : '';
      if (units > 0 && nav > 0) {
        const existing = mfList.find(h => h.isin === isin && isin);
        if (existing) {
          existing.units += units;
          existing.value += value;
        } else {
          mfList.push({ type: 'mf', name: isin, units, nav, value, isin, invested: 0, avgCost: nav, amfi: ISIN_AMFI[isin] || '' });
        }
      }
    }
  }

  return mfList;
}
