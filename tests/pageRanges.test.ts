import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { 
  parsePageRangeString, 
  extractPdfPages, 
  splitPdfIntoSinglePages 
} from '../src/lib/pdfOperations';
import { 
  rotatePdfPages, 
  deletePdfPages, 
  reorderPdfPages 
} from '../src/lib/advancedPdfEngines';

async function createSamplePdf(pageCount = 4): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([300, 400]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 350 });
  }
  const bytes = await pdfDoc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], 'sample.pdf', { type: 'application/pdf' });
}

describe('Page Ranges and PDF Page Operations', () => {
  describe('parsePageRangeString', () => {
    it('parses single page number correctly', () => {
      const result = parsePageRangeString('3', 5);
      expect(result).toEqual([3]);
    });

    it('parses comma-separated pages and sorts them', () => {
      const result = parsePageRangeString('5, 1, 3', 10);
      expect(result).toEqual([1, 3, 5]);
    });

    it('parses simple page ranges like 1-4', () => {
      const result = parsePageRangeString('1-4', 10);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('parses mixed ranges and individual numbers', () => {
      const result = parsePageRangeString('1-3, 5, 8-10', 12);
      expect(result).toEqual([1, 2, 3, 5, 8, 9, 10]);
    });

    it('handles arbitrary whitespace correctly', () => {
      const result = parsePageRangeString('  2 - 4 ,   7 ,  9 - 10  ', 10);
      expect(result).toEqual([2, 3, 4, 7, 9, 10]);
    });

    it('deduplicates overlapping page specifications', () => {
      const result = parsePageRangeString('1-3, 2-4, 3, 4', 5);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('clamps range end to totalPages if within valid bounds', () => {
      const result = parsePageRangeString('3-8', 5);
      expect(result).toEqual([3, 4, 5]);
    });

    it('returns an empty array for empty or whitespace-only strings', () => {
      expect(parsePageRangeString('', 5)).toEqual([]);
      expect(parsePageRangeString('   ', 5)).toEqual([]);
    });

    it('throws error when individual page number exceeds totalPages', () => {
      expect(() => parsePageRangeString('8', 5)).toThrow(/outside document range/i);
    });

    it('throws error for page number 0 or negative numbers', () => {
      expect(() => parsePageRangeString('0', 5)).toThrow(/outside document range/i);
      expect(() => parsePageRangeString('-2', 5)).toThrow(/invalid page range/i);
    });

    it('throws error for inverted ranges like 5-2', () => {
      expect(() => parsePageRangeString('5-2', 10)).toThrow(/invalid page range/i);
    });

    it('throws error for non-numeric input', () => {
      expect(() => parsePageRangeString('abc', 10)).toThrow(/outside document range|invalid page range/i);
      expect(() => parsePageRangeString('1-xyz', 10)).toThrow(/invalid page range/i);
    });
  });

  describe('extractPdfPages', () => {
    it('extracts specific pages into a new valid PDF', async () => {
      const pdf = await createSamplePdf(5);
      const { blob, extractedPageCount } = await extractPdfPages(pdf, [2, 4]);

      expect(extractedPageCount).toBe(2);
      expect(blob.type).toBe('application/pdf');

      const loaded = await PDFDocument.load(await blob.arrayBuffer());
      expect(loaded.getPageCount()).toBe(2);
    });

    it('throws error if no pages are selected for extraction', async () => {
      const pdf = await createSamplePdf(3);
      await expect(extractPdfPages(pdf, [])).rejects.toThrow(/select at least one page/i);
    });

    it('throws error if selected pages are outside document range', async () => {
      const pdf = await createSamplePdf(3);
      await expect(extractPdfPages(pdf, [9, 10])).rejects.toThrow(/no valid pages/i);
    });
  });

  describe('splitPdfIntoSinglePages', () => {
    it('splits a multi-page PDF into single-page PDF blobs', async () => {
      const pdf = await createSamplePdf(3);
      const { pageBlobs } = await splitPdfIntoSinglePages(pdf);

      expect(pageBlobs.length).toBe(3);
      expect(pageBlobs[0].pageNumber).toBe(1);
      expect(pageBlobs[1].pageNumber).toBe(2);
      expect(pageBlobs[2].pageNumber).toBe(3);

      for (const item of pageBlobs) {
        const loaded = await PDFDocument.load(await item.blob.arrayBuffer());
        expect(loaded.getPageCount()).toBe(1);
      }
    });
  });

  describe('deletePdfPages', () => {
    it('deletes selected pages and preserves remaining pages', async () => {
      const pdf = await createSamplePdf(4);
      const { blob, remainingCount } = await deletePdfPages(pdf, [2, 3]);

      expect(remainingCount).toBe(2);
      const loaded = await PDFDocument.load(await blob.arrayBuffer());
      expect(loaded.getPageCount()).toBe(2);
    });

    it('throws error when trying to delete all pages in document', async () => {
      const pdf = await createSamplePdf(3);
      await expect(deletePdfPages(pdf, [1, 2, 3])).rejects.toThrow(/cannot delete all pages/i);
    });
  });

  describe('rotatePdfPages', () => {
    it('rotates all pages by the specified angle', async () => {
      const pdf = await createSamplePdf(2);
      const rotatedBlob = await rotatePdfPages(pdf, 90, 'all');

      const loaded = await PDFDocument.load(await rotatedBlob.arrayBuffer());
      expect(loaded.getPage(0).getRotation().angle).toBe(90);
      expect(loaded.getPage(1).getRotation().angle).toBe(90);
    });

    it('rotates only targeted pages', async () => {
      const pdf = await createSamplePdf(3);
      const rotatedBlob = await rotatePdfPages(pdf, 180, [2]);

      const loaded = await PDFDocument.load(await rotatedBlob.arrayBuffer());
      expect(loaded.getPage(0).getRotation().angle).toBe(0);
      expect(loaded.getPage(1).getRotation().angle).toBe(180);
      expect(loaded.getPage(2).getRotation().angle).toBe(0);
    });
  });

  describe('reorderPdfPages', () => {
    it('reorders pages according to provided page order sequence', async () => {
      const pdf = await createSamplePdf(3);
      const reorderedBlob = await reorderPdfPages(pdf, [3, 1, 2]);

      const loaded = await PDFDocument.load(await reorderedBlob.arrayBuffer());
      expect(loaded.getPageCount()).toBe(3);
    });
  });
});
