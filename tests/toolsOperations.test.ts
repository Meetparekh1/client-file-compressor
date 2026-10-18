import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  rotatePdfPages,
  deletePdfPages,
  reorderPdfPages,
  addPageNumbersToPdf,
  flattenPdfForm,
} from '../src/lib/advancedPdfEngines';
import {
  parsePageRangeString,
  extractPdfPages,
  splitPdfIntoSinglePages,
} from '../src/lib/pdfOperations';
import {
  applyWatermarkOrSignature,
  type WatermarkOptions,
} from '../src/lib/scanAndSignEngines';
import { textToPdf } from '../src/lib/advancedPdfEngines';

// Helper to create a dummy multi-page PDF File
async function createTestPdfFile(pageCount: number = 3, fileName: string = 'test.pdf'): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Page ${i + 1}`);
  }
  const bytes = await doc.save();
  return new File([bytes], fileName, { type: 'application/pdf' });
}

describe('Tool Operations & Download Regression Tests', () => {
  describe('rotatePdfPages', () => {
    it('rotates all pages by 90 degrees correctly', async () => {
      const file = await createTestPdfFile(3);
      const rotatedBlob = await rotatePdfPages(file, 90, 'all');
      expect(rotatedBlob).toBeInstanceOf(Blob);
      expect(rotatedBlob.size).toBeGreaterThan(0);

      const buffer = await rotatedBlob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPageCount()).toBe(3);
      expect(doc.getPage(0).getRotation().angle).toBe(90);
      expect(doc.getPage(1).getRotation().angle).toBe(90);
      expect(doc.getPage(2).getRotation().angle).toBe(90);
    });

    it('rotates specific pages only', async () => {
      const file = await createTestPdfFile(3);
      const rotatedBlob = await rotatePdfPages(file, 180, [2]);
      const buffer = await rotatedBlob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPage(0).getRotation().angle).toBe(0);
      expect(doc.getPage(1).getRotation().angle).toBe(180);
      expect(doc.getPage(2).getRotation().angle).toBe(0);
    });
  });

  describe('deletePdfPages', () => {
    it('deletes selected pages and returns correct remaining count', async () => {
      const file = await createTestPdfFile(4);
      const { blob, remainingCount } = await deletePdfPages(file, [2, 4]);
      expect(remainingCount).toBe(2);

      const buffer = await blob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPageCount()).toBe(2);
    });

    it('throws error when attempting to delete all pages', async () => {
      const file = await createTestPdfFile(2);
      await expect(deletePdfPages(file, [1, 2])).rejects.toThrow(
        /You cannot delete all pages/i
      );
    });

    it('throws error when no valid pages are provided to delete', async () => {
      const file = await createTestPdfFile(2);
      await expect(deletePdfPages(file, [99])).rejects.toThrow(
        /Please specify at least one valid page number/i
      );
    });
  });

  describe('reorderPdfPages', () => {
    it('reorders pages according to specified sequence', async () => {
      const file = await createTestPdfFile(3);
      const reorderedBlob = await reorderPdfPages(file, [3, 1, 2]);
      expect(reorderedBlob).toBeInstanceOf(Blob);

      const buffer = await reorderedBlob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPageCount()).toBe(3);
    });

    it('rejects empty or invalid order arrays', async () => {
      const file = await createTestPdfFile(3);
      await expect(reorderPdfPages(file, [])).rejects.toThrow();
      await expect(reorderPdfPages(file, [99, 100])).rejects.toThrow();
    });
  });

  describe('addPageNumbersToPdf', () => {
    it('adds page numbers with page-of-total format', async () => {
      const file = await createTestPdfFile(3);
      const numberedBlob = await addPageNumbersToPdf(file, {
        position: 'bottom-center',
        format: 'page-of-total',
        fontSize: 12,
      });
      expect(numberedBlob).toBeInstanceOf(Blob);
      expect(numberedBlob.size).toBeGreaterThan(0);

      const buffer = await numberedBlob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPageCount()).toBe(3);
    });

    it('adds page numbers with number-only format at top-right', async () => {
      const file = await createTestPdfFile(2);
      const numberedBlob = await addPageNumbersToPdf(file, {
        position: 'top-right',
        format: 'number-only',
        fontSize: 10,
      });
      expect(numberedBlob).toBeInstanceOf(Blob);
      const buffer = await numberedBlob.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      expect(doc.getPageCount()).toBe(2);
    });
  });

  describe('flattenPdfForm', () => {
    it('flattens PDF forms without corrupting document structure', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([300, 400]);
      page.drawText('Form test');
      const form = doc.getForm();
      const textField = form.createTextField('testField');
      textField.setText('Hello Antigravity');
      textField.addToPage(page, { x: 50, y: 300, width: 200, height: 30 });
      const bytes = await doc.save();
      const file = new File([bytes], 'form.pdf', { type: 'application/pdf' });

      const flattenedBlob = await flattenPdfForm(file);
      expect(flattenedBlob).toBeInstanceOf(Blob);

      const buffer = await flattenedBlob.arrayBuffer();
      const loaded = await PDFDocument.load(buffer);
      expect(loaded.getPageCount()).toBe(1);
    });
  });

  describe('extractPdfPages and splitPdfIntoSinglePages', () => {
    it('extracts specific pages into a single PDF', async () => {
      const file = await createTestPdfFile(5);
      const pages = parsePageRangeString('2-4', 5);
      expect(pages).toEqual([2, 3, 4]);

      const { blob, extractedPageCount } = await extractPdfPages(file, pages);
      expect(extractedPageCount).toBe(3);
      expect(blob).toBeInstanceOf(Blob);

      const doc = await PDFDocument.load(await blob.arrayBuffer());
      expect(doc.getPageCount()).toBe(3);
    });

    it('splits PDF into individual single pages', async () => {
      const file = await createTestPdfFile(3);
      const { pageBlobs } = await splitPdfIntoSinglePages(file);
      expect(pageBlobs.length).toBe(3);
      expect(pageBlobs[0].pageNumber).toBe(1);
      expect(pageBlobs[1].pageNumber).toBe(2);
      expect(pageBlobs[2].pageNumber).toBe(3);
    });
  });

  describe('applyWatermarkOrSignature', () => {
    it('applies text watermark with center position', async () => {
      const file = await createTestPdfFile(2);
      const options: WatermarkOptions = {
        type: 'text',
        text: 'CONFIDENTIAL',
        position: 'center',
        opacity: 0.5,
        pageRange: 'all',
      };
      const stampedBlob = await applyWatermarkOrSignature(file, options);
      expect(stampedBlob).toBeInstanceOf(Blob);
      const doc = await PDFDocument.load(await stampedBlob.arrayBuffer());
      expect(doc.getPageCount()).toBe(2);
    });

    it('applies watermark to first page only', async () => {
      const file = await createTestPdfFile(3);
      const options: WatermarkOptions = {
        type: 'text',
        text: 'DRAFT',
        position: 'bottom-right',
        opacity: 0.8,
        pageRange: 'first',
      };
      const stampedBlob = await applyWatermarkOrSignature(file, options);
      expect(stampedBlob).toBeInstanceOf(Blob);
      const doc = await PDFDocument.load(await stampedBlob.arrayBuffer());
      expect(doc.getPageCount()).toBe(3);
    });
  });

  describe('textToPdf', () => {
    it('creates standardized A4 PDF from text content', async () => {
      const title = 'Meeting Minutes';
      const content = 'Line 1 of minutes\nLine 2 of minutes\nLine 3 of minutes';
      const author = 'Auditor';

      const blob = await textToPdf(title, content, author);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');

      const doc = await PDFDocument.load(await blob.arrayBuffer());
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    });
  });
});
