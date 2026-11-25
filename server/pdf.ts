import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
(globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker;
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPage } from './types.ts';

const PAGE_BATCH_SIZE = 12;

export async function extractPdfPages(buffer: Buffer): Promise<{
  pageCount: number;
  pages: PdfPage[];
  charCount: number;
}> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Invalid PDF file header.');
  }

  const uint8 = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data: uint8,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const extractedByPage = new Array<PdfPage | null>(pageCount).fill(null);

  for (let start = 1; start <= pageCount; start += PAGE_BATCH_SIZE) {
    const end = Math.min(pageCount, start + PAGE_BATCH_SIZE - 1);
    const pageNumbers = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

    await Promise.all(
      pageNumbers.map(async (pageNum) => {
        const page = await pdfDoc.getPage(pageNum);
        try {
          const textContent = await page.getTextContent();
          const rawItems = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;
          let pageText = '';
          for (const item of rawItems) {
            if (typeof item.str === 'string') {
              pageText += item.str;
              pageText += item.hasEOL ? '\n' : ' ';
            }
          }
          const normalized = pageText
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          if (normalized.length > 0) {
            extractedByPage[pageNum - 1] = { pageNumber: pageNum, text: normalized };
          }
        } finally {
          page.cleanup();
        }
      }),
    );
  }

  await pdfDoc.cleanup();

  const pages: PdfPage[] = [];
  let charCount = 0;
  for (const item of extractedByPage) {
    if (item) {
      pages.push(item);
      charCount += item.text.length;
    }
  }

  if (pages.length === 0) {
    throw new Error(
      'No extractable text found in this PDF. Scanned image-only PDFs are not supported.',
    );
  }

  return { pageCount, pages, charCount };
}
