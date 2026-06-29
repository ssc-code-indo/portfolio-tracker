import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;
}

export const parseCamsPDFText = (rawText) => {
  // 1. Split the text into individual blocks based on Folio markers
  const blocks = rawText.split(/(?=Folio No\s*:)/i);
  const parsedHoldings = [];

  for (const block of blocks) {
    // Extract Folio Number
    const folioMatch = block.match(/(?:Folio\s*No|Folio)\s*:\s*([\w\/|-]+)/i);
    if (!folioMatch) continue;
    const folio = folioMatch[1].trim();

    // Find all ISIN positions inside this folio block
    const isinMatches = [...block.matchAll(/\b(INF[\dW\s]{9,11})\b/gi)];
    
    for (const match of isinMatches) {
      const isin = match[1].replace(/\s/g, '').toUpperCase();
      
      // Slice the block text starting from this specific ISIN instance to isolate its specific data metrics
      const subText = block.substring(match.index);

      // Extract the closing unit balance specific to this fund block
      const balanceMatch = subText.match(/Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i);
      const units = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0;

      // Extract the cost value statement specific to this fund block
      const costMatch = subText.match(/(?:Total\s*Cost\s*Value|Cost\s*Value|Cost\s*Basis|Amount\s*Invested)\s*:?\s*(?:Rs\.?|₹|INR)?\s*([\d,.]+)/i);
      const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

      if (units > 0) {
        parsedHoldings.push({
          isin,
          units,
          cost,
          folios: [folio]
        });
      }
    }
  }

  // Combine duplicate ISIN values if any exist across separate folios
  const aggregatedPortfolio = {};
  for (const holding of parsedHoldings) {
    if (aggregatedPortfolio[holding.isin]) {
      aggregatedPortfolio[holding.isin].units += holding.units;
      aggregatedPortfolio[holding.isin].cost += holding.cost;
      if (!aggregatedPortfolio[holding.isin].folios.includes(holding.folios[0])) {
        aggregatedPortfolio[holding.isin].folios.push(holding.folios[0]);
      }
    } else {
      aggregatedPortfolio[holding.isin] = holding;
    }
  }

  return Object.values(aggregatedPortfolio);
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
