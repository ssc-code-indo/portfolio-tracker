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
  
  // Normalize layout text: remove internal whitespace formatting gaps
  const normalizedText = rawText
    .replace(/"/g, '')
    .replace(/INF\s+/gi, 'INF'); // Fixes KFintech space anomalies

  // 1. Locate every ISIN starting anchor in the entire file
  const isinRegex = /(INF[\dW]{9,12})/gi;
  const positions = [];
  let match;
  
  while ((match = isinRegex.exec(normalizedText)) !== null) {
    positions.push({
      isin: match[1].toUpperCase(),
      index: match.index
    });
  }

  if (positions.length === 0) {
    console.error("Parser alert: No valid ISIN keys detected inside text matrix stream.");
    return [];
  }

  // 2. Fragment the entire document text into absolute mutual fund boundaries
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const startPos = current.index;
    // The section boundaries extend all the way up until the next fund's ISIN starts
    const endPos = (i + 1 < positions.length) ? positions[i + 1].index : normalizedText.length;
    
    const isolatedSection = normalizedText.substring(startPos, endPos);

    // Extract closing units within this exact isolated boundaries block
    const unitMatch = isolatedSection.match(/Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i);
    const units = unitMatch ? parseFloat(unitMatch[1].replace(/,/g, '')) : 0;

    // Extract absolute cost statement configurations
    const costMatch = isolatedSection.match(/(?:Total\s*Cost\s*Value|Cost\s*Value|Cost\s*Basis|Amount\s*Invested)\s*:?\s*(?:Rs\.?|₹|INR)?\s*([\d,.]+)/i);
    const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

    // Track original holding records
    if (units > 0) {
      if (portfolio[current.isin]) {
        portfolio[current.isin].units += units;
        portfolio[current.isin].cost += cost;
      } else {
        portfolio[current.isin] = {
          isin: current.isin,
          units,
          cost: cost || 0,
          folios: []
        };
      }
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
