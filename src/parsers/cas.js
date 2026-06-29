import * as pdfjsLib from 'pdfjs-dist';

// --- NATIVE VITE WORKER CONFIG ---
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;
}

export const parseCamsPDFText = (rawText) => {
  const portfolio = {};
  
  // Normalize text: remove layout quotes, commas between text, and internal ISIN spacing quirks
  const normalizedText = rawText
    .replace(/"/g, '')
    .replace(/INF\s+/gi, 'INF'); // Fixes the KFintech "INF 109..." space bug

  // 1. Extract all individual asset blocks using ISIN positions as structural anchors
  const isinRegex = /(INF[\dW]{9,10})/gi;
  const matches = [...normalizedText.matchAll(isinRegex)];

  if (matches.length === 0) {
    console.error("Parser alert: No ISIN strings starting with 'INF' detected in the document text stream.");
    return [];
  }

  matches.forEach((match, index) => {
    const isin = match[1].toUpperCase();
    
    // Create a text window surrounding the ISIN to capture both preceding and trailing metrics safely
    const startPos = index === 0 ? 0 : matches[index - 1].index;
    const endPos = index === matches.length - 1 ? normalizedText.length : matches[index + 1].index;
    const searchWindow = normalizedText.substring(startPos, endPos);

    // Extract closing units (handles clean decimals or space separation layouts)
    const unitMatch = searchWindow.match(/Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i);
    const units = unitMatch ? parseFloat(unitMatch[1].replace(/,/g, '')) : 0;

    // Extract cost figures (matches "Total Cost Value", "Cost Value", or "Amount Invested")
    const costMatch = searchWindow.match(/(?:Total\s*Cost\s*Value|Cost\s*Value|Cost\s*Basis|Amount\s*Invested)\s*:?\s*(?:Rs\.?|₹|INR)?\s*([\d,.]+)/i);
    const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

    // Extract nearby Folio number
    const folioMatch = searchWindow.match(/(?:Folio\s*No|Folio)\s*:\s*([\w\/|-]+)/i);
    const folio = folioMatch ? folioMatch[1].trim() : "Unknown Folio";

    if (units > 0) {
      if (portfolio[isin]) {
        portfolio[isin].units += units;
        portfolio[isin].cost += cost;
      } else {
        portfolio[isin] = {
          isin,
          units,
          cost: cost || 0,
          folios: [folio]
        };
      }
    }
  });

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
