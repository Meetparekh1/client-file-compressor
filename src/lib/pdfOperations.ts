import { PDFDocument } from 'pdf-lib';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_PDF_PAGES, 
  TIMEOUT_GENERAL_MS, 
  withExecutionTimeout 
} from './securityLimits';

export interface MergePdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount?: number;
}

/**
 * Merges multiple PDF files in order into a single PDF blob.
 */
export async function mergePdfFiles(
  pdfFiles: File[],
  onProgress?: (progress: number, currentFileName: string) => void
): Promise<{ blob: Blob; totalPages: number }> {
  if (pdfFiles.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  for (const f of pdfFiles) {
    validateFileSize(f);
  }

  return withExecutionTimeout(
    (async () => {
      const mergedPdf = await PDFDocument.create();
      let totalPages = 0;

      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        onProgress?.(Math.round((i / pdfFiles.length) * 100), file.name);

        const arrayBuffer = await file.arrayBuffer();
        const donorPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const donorPages = donorPdf.getPageIndices();

        if (totalPages + donorPages.length > MAX_PDF_PAGES) {
          validatePageCount(totalPages + donorPages.length, MAX_PDF_PAGES, 'Merge PDF');
        }

        const copiedPages = await mergedPdf.copyPages(donorPdf, donorPages);

        for (const page of copiedPages) {
          mergedPdf.addPage(page);
          totalPages++;
        }
      }

      onProgress?.(95, 'Finalizing document...');
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      onProgress?.(100, 'Done');

      return { blob, totalPages };
    })(),
    TIMEOUT_GENERAL_MS,
    'Merge PDF Files'
  );
}

/**
 * Parses page ranges string like "1-3, 5, 8-10" into 1-based page number array.
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  if (typeof totalPages !== 'number' || totalPages <= 0) {
    throw new Error('Invalid total document page count.');
  }

  if (typeof rangeStr !== 'string') {
    return [];
  }

  const clean = rangeStr.replace(/\s+/g, '');
  if (!clean) return [];

  const parts = clean.split(',');
  const selectedPages = new Set<number>();

  for (const part of parts) {
    if (!part) continue;

    if (part.includes('-')) {
      const hyphenParts = part.split('-');
      if (hyphenParts.length !== 2) {
        throw new Error(`Invalid page range: "${part}". Please check format (e.g. 1-3, 5).`);
      }
      const [startStr, endStr] = hyphenParts;
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start > end || start < 1) {
        throw new Error(`Invalid page range: "${part}". Please check format (e.g. 1-3, 5).`);
      }
      if (start > totalPages) {
        throw new Error(`Page range "${part}" starts outside document range (1 to ${totalPages}).`);
      }

      for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
        selectedPages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (isNaN(p) || p < 1 || p > totalPages) {
        throw new Error(`Page number ${p} is outside document range (1 to ${totalPages}).`);
      }
      selectedPages.add(p);
    }
  }

  return Array.from(selectedPages).sort((a, b) => a - b);
}

/**
 * Extracts specified pages from a PDF and returns a new PDF blob.
 */
export async function extractPdfPages(
  sourceFile: File,
  pagesToExtract: number[], // 1-based numbers
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; extractedPageCount: number }> {
  validateFileSize(sourceFile);
  if (pagesToExtract.length === 0) {
    throw new Error('Please select at least one page to extract.');
  }

  return withExecutionTimeout(
    (async () => {
      onProgress?.(20);
      const arrayBuffer = await sourceFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const totalPages = sourcePdf.getPageCount();
      validatePageCount(totalPages, MAX_PDF_PAGES, 'Extract PDF');

      const zeroBasedIndices = pagesToExtract
        .filter(p => p >= 1 && p <= totalPages)
        .map(p => p - 1);

      if (zeroBasedIndices.length === 0) {
        throw new Error('No valid pages found within document range.');
      }

      onProgress?.(50);
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(sourcePdf, zeroBasedIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      onProgress?.(85);
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      onProgress?.(100);

      return { blob, extractedPageCount: zeroBasedIndices.length };
    })(),
    TIMEOUT_GENERAL_MS,
    'Extract PDF Pages'
  );
}

/**
 * Splits a PDF into individual 1-page PDF blobs.
 */
export async function splitPdfIntoSinglePages(
  sourceFile: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ pageBlobs: { pageNumber: number; blob: Blob }[] }> {
  validateFileSize(sourceFile);

  return withExecutionTimeout(
    (async () => {
      const arrayBuffer = await sourceFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const totalPages = sourcePdf.getPageCount();
      validatePageCount(totalPages, MAX_PDF_PAGES, 'Split PDF');
      const pageBlobs: { pageNumber: number; blob: Blob }[] = [];

      for (let i = 0; i < totalPages; i++) {
        onProgress?.(i + 1, totalPages);
        const singlePdf = await PDFDocument.create();
        const [copied] = await singlePdf.copyPages(sourcePdf, [i]);
        singlePdf.addPage(copied);
        const bytes = await singlePdf.save();
        pageBlobs.push({
          pageNumber: i + 1,
          blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        });
      }

      return { pageBlobs };
    })(),
    TIMEOUT_GENERAL_MS,
    'Split PDF'
  );
}
