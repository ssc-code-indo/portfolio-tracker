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
  
  // Normalize spacing anomalies (handles inner spacing e.g., 'INF 109...')
  const normalizedText = rawText.replace(/INF\s+/gi, 'INF');

  // Match all ISIN strings as portfolio anchor indexes
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
    console.error("Parser alert: Reconstructed matrix contains no valid ISIN patterns.");
    return [];
  }

  // Segment isolated boundaries for each fund profile
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const startPos = current.index;
    const endPos = (i + 1 < positions.length) ? positions[i + 1].index : normalizedText.length;
    
    const isolatedSection = normalizedText.substring(startPos, endPos);

    // Extract exact numbers safely 
    const unitMatch = isolatedSection.match(/Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i);
    const units = unitMatch ? parseFloat(unitMatch[1].replace(/,/g, '')) : 0;

    const costMatch = isolatedSection.match(/(?:Total\s*Cost\s*Value|Cost\s*Value|Cost\s*Basis|Amount\s*Invested)\s*:?\s*(?:Rs\.?|₹|INR)?\s*([\d,.]+)/i);
    const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

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
    
    // Process each page utilizing structural Y-X pixel tracking
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Sort elements by Y coordinate descending (top to bottom), then X coordinate ascending (left to right)
      const sortedItems = textContent.items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff; // items within 5 vertical units are treated as the same line
        return a.transform[4] - b.transform[4];
      });

      // Build structured lines instead of an overlapping coordinate stream
      let lastY = null;
      let pageText = '';
      
      for (const item of sortedItems) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n'; // Inject intentional newline break on block changes
        }
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }
      
      completeRawText += pageText + '\n';
    }
    
    const parsedHoldings = parseCamsPDFText(completeRawText);
    if (parsedHoldings.length === 0) throw new Error("No holdings found in PDF — is this a CAMS/KFintech CAS?");
    return { success: true, data: parsedHoldings };
  } catch (error) {
    return { success: false, error: error.message || "Failed to process CAMS PDF file." };
  }
};
