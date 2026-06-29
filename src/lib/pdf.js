// ── PDF TEXT EXTRACTION ───────────────────────────────────
// Uses pdfjs-dist, handles Android no-space joins

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfText(file, password = '') {
  const buf = await file.arrayBuffer();
  let pdf;

  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), password }).promise;
  } catch (e) {
    if (e.name === 'PasswordException') throw e;
    throw new Error('Could not open PDF: ' + e.message);
  }

  const allItems = [];
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items   = (content?.items || []).map(x => x.str || '');
    pageTexts.push(items.join(' '));
    allItems.push(...items);
  }

  return {
    // Page-separated (better for most parsers)
    text: pageTexts.join('\n'),
    // Fully flat (better when Android joins across page breaks)
    flat: allItems.join(' '),
    numPages: pdf.numPages,
  };
}

export async function extractPdfTextWithPassword(file, passwords = ['', 'AZJPC5858Q', '12345678']) {
  for (const pwd of passwords) {
    try {
      return await extractPdfText(file, pwd);
    } catch (e) {
      if (e.name !== 'PasswordException') throw e;
      // Wrong password, try next
    }
  }
  throw new Error('Could not open PDF — wrong password');
}
