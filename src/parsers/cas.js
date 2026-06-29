import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  const workerCode = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js');`;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
}

const cleanCamsLine = (line) => line.replace(/CAMSCASWS-\S+/gi, '').replace(/Version:\s*V[\d.]+\s+Live-\d+/gi, '').trim();

export const parseCamsPDFText = (rawText) => {
  const portfolio = {};
  const lines = rawText.split('\n').map(cleanCamsLine).filter(Boolean);
  const folioRegex = /(?:Folio\s*No|Folio)\s*:\s*([\w\/|-]+)/i;
  const closingBalanceRegex = /Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i;
  const costBasisRegex = /(?:Cost\s*Basis|Amount\s*Invested|Value\s*at\s*Cost)\s*:?\s*(?:Rs\.?|₹)?\s*([\d,.]+)/i;
  const isinRegex = /\b(INF[\dW\s]{9,10})\b/i;

  let currentFolio = null, currentIsin = null, currentUnits = 0, currentCost = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const folioMatch = line.match(folioRegex);
    if (folioMatch) currentFolio = folioMatch[1].trim();
    const isinMatch = line.match(isinRegex);
    if (isinMatch) currentIsin = isinMatch[1].replace(/\s/g, '').toUpperCase();
    const balanceMatch = line.match(closingBalanceRegex);
    if (balanceMatch) currentUnits = parseFloat(balanceMatch[1].replace(/,/g, ''));
    const costMatch = line.match(costBasisRegex);
    if (costMatch) currentCost = parseFloat(costMatch[1].replace(/,/g, ''));

    if (currentIsin && currentUnits > 0) {
      if (currentCost === 0) {
        for (let lookahead = 1; lookahead <= 2; lookahead++) {
          if (lines[i + lookahead]) {
            const aheadCostMatch = lines[i + lookahead].match(costBasisRegex);
            if (aheadCostMatch) {
              currentCost = parseFloat(aheadCostMatch[1].replace(/,/g, ''));
              break;
            }
          }
        }
      }
      if (portfolio[currentIsin]) {
        portfolio[currentIsin].units += currentUnits;
        portfolio[currentIsin].cost += currentCost;
      } else {
        portfolio[currentIsin] = { isin: currentIsin, units: currentUnits, cost: currentCost || 0, folios: currentFolio ? [currentFolio] : [] };
      }
      currentUnits = 0; currentCost = 0;
    }
  }
  return Object.values(portfolio);
};

export const handleCamsUpload = async (file, password = '') => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;
    let completeRawText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      completeRawText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    const parsedHoldings = parseCamsPDFText(completeRawText);
    if (parsedHoldings.length === 0) throw new Error("No holdings found in PDF — is this a CAMS/KFintech CAS?");
    return { success: true, data: parsedHoldings };
  } catch (error) {
    return { success: false, error: error.message || "Failed to process CAMS PDF file." };
  }
};
