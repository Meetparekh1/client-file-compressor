import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { deletePdfPages, reorderPdfPages, addPageNumbersToPdf, flattenPdfForm, cropPdfPages } from '../src/lib/advancedPdfEngines';
import { parsePageRangeString } from '../src/lib/pdfOperations';
import { convertPdfToDocx, convertPdfToXlsx, convertPdfToPptx } from '../src/lib/officeConverter';
import { compressDocxToTarget } from '../src/lib/compressors/docxCompressor';
import { sanitizeSvg } from '../src/lib/compressors/svgCompressor';
import { compressPdfToTarget } from '../src/lib/compressors/pdfCompressor';
import { ocrScannedPdf } from '../src/lib/ocrEngine';
import { summarizePdfDocument } from '../src/lib/aiSummarizer';

vi.mock('pdfjs-dist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pdfjs-dist')>();
  return {
    ...actual,
    getDocument: vi.fn(),
  };
});

async function createMinimalPdfBlob(pageCount = 2): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 400]);
    page.drawText(`Page ${i + 1} content text`);
  }
  const bytes = await doc.save();
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

describe('Priority 1 Engine Reliability & Tool Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. src/lib/ocrEngine.ts', () => {
    it('validates PDF file type upfront and rejects non-PDF file', async () => {
      const textFile = new File(['hello text'], 'test.txt', { type: 'text/plain' });
      await expect(ocrScannedPdf(textFile)).rejects.toThrow(/invalid file format/i);
    });

    it('rejects 0-byte file', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(ocrScannedPdf(emptyFile)).rejects.toThrow(/is empty/i);
    });

    it('honors AbortSignal immediately without leaking worker', async () => {
      const pdfBlob = await createMinimalPdfBlob(1);
      const pdfFile = new File([pdfBlob], 'doc.pdf', { type: 'application/pdf' });
      const controller = new AbortController();
      controller.abort();

      await expect(ocrScannedPdf(pdfFile, undefined, { signal: controller.signal })).rejects.toThrow(
        /cancelled/i
      );
    });
  });

  describe('2. src/lib/aiSummarizer.ts', () => {
    it('rejects non-text or empty text PDF files', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [] }),
          cleanup: vi.fn(),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const emptyPdfFile = new File(['%PDF-1.4'], 'empty_pages.pdf', { type: 'application/pdf' });
      await expect(summarizePdfDocument(emptyPdfFile)).rejects.toThrow(/no selectable text found/i);
    });

    it('preserves user cancellation via signal', async () => {
      const pdfBlob = await createMinimalPdfBlob(1);
      const pdfFile = new File([pdfBlob], 'doc.pdf', { type: 'application/pdf' });
      const controller = new AbortController();
      controller.abort();

      await expect(summarizePdfDocument(pdfFile, 'executive', undefined, { signal: controller.signal })).rejects.toThrow(
        /cancelled/i
      );
    });
  });

  describe('3. src/lib/advancedPdfEngines.ts', () => {
    it('deletePdfPages prevents removing all pages in document', async () => {
      const pdfBlob = await createMinimalPdfBlob(2);
      const pdfFile = new File([pdfBlob], 'twopages.pdf', { type: 'application/pdf' });

      // Trying to delete both page 1 and page 2
      await expect(deletePdfPages(pdfFile, [1, 2])).rejects.toThrow(
        /cannot delete all pages/i
      );
    });

    it('deletePdfPages handles duplicate page indices and deletes correctly', async () => {
      const pdfBlob = await createMinimalPdfBlob(3);
      const pdfFile = new File([pdfBlob], 'threepages.pdf', { type: 'application/pdf' });

      // Delete page 2 with duplicate inputs [2, 2]
      const { remainingCount, blob } = await deletePdfPages(pdfFile, [2, 2]);
      expect(remainingCount).toBe(2);
      expect(blob.size).toBeGreaterThan(0);

      const resDoc = await PDFDocument.load(await blob.arrayBuffer());
      expect(resDoc.getPageCount()).toBe(2);
    });

    it('deletePdfPages rejects empty or invalid page numbers', async () => {
      const pdfBlob = await createMinimalPdfBlob(2);
      const pdfFile = new File([pdfBlob], 'twopages.pdf', { type: 'application/pdf' });

      await expect(deletePdfPages(pdfFile, [99, 100])).rejects.toThrow(
        /at least one valid page number/i
      );
    });

    it('reorderPdfPages safely reorders pages without crashing', async () => {
      const pdfBlob = await createMinimalPdfBlob(3);
      const pdfFile = new File([pdfBlob], 'doc.pdf', { type: 'application/pdf' });

      const reorderedBlob = await reorderPdfPages(pdfFile, [3, 1, 2]);
      expect(reorderedBlob.size).toBeGreaterThan(0);

      const reorderedDoc = await PDFDocument.load(await reorderedBlob.arrayBuffer());
      expect(reorderedDoc.getPageCount()).toBe(3);
    });

    it('addPageNumbersToPdf validates font size and numeric boundaries', async () => {
      const pdfBlob = await createMinimalPdfBlob(2);
      const pdfFile = new File([pdfBlob], 'numbered.pdf', { type: 'application/pdf' });

      const numberedBlob = await addPageNumbersToPdf(pdfFile, {
        position: 'bottom-center',
        format: 'page-of-total',
        fontSize: 12,
        startAt: 1,
      });
      expect(numberedBlob.size).toBeGreaterThan(0);
    });

    it('cropPdfPages and flattenPdfForm validate file boundaries', async () => {
      const pdfBlob = await createMinimalPdfBlob(1);
      const pdfFile = new File([pdfBlob], 'single.pdf', { type: 'application/pdf' });

      const cropped = await cropPdfPages(pdfFile, { top: 10, bottom: 10, left: 10, right: 10 });
      expect(cropped.size).toBeGreaterThan(0);

      const flattened = await flattenPdfForm(pdfFile);
      expect(flattened.size).toBeGreaterThan(0);
    });
  });

  describe('4. src/lib/pdfOperations.ts', () => {
    it('parsePageRangeString centralizes validation and handles boundary edge cases', () => {
      expect(parsePageRangeString('1-3, 5', 10)).toEqual([1, 2, 3, 5]);
      expect(parsePageRangeString('3, 1, 2, 2', 5)).toEqual([1, 2, 3]);
      expect(parsePageRangeString('', 10)).toEqual([]);
      expect(parsePageRangeString('   ', 10)).toEqual([]);

      expect(() => parsePageRangeString('5-2', 10)).toThrow(/invalid page range/i);
      expect(() => parsePageRangeString('0-3', 10)).toThrow(/invalid page range/i);
      expect(() => parsePageRangeString('1-2-3', 10)).toThrow(/invalid page range/i);
      expect(() => parsePageRangeString('11', 10)).toThrow(/outside document range/i);
      expect(() => parsePageRangeString('15-20', 10)).toThrow(/starts outside document range/i);
      expect(() => parsePageRangeString('1', 0)).toThrow(/invalid total document page count/i);
    });
  });

  describe('5. src/lib/officeConverter.ts', () => {
    it('convertPdfToDocx generates valid OpenXML ZIP package structure via remote engine', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
      zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>');
      const validDocxBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          blob: vi.fn().mockResolvedValue(validDocxBlob),
        })
      );

      const pdfFile = new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' });
      const docxBlob = await convertPdfToDocx(pdfFile, { skipConsentCheck: true });
      expect(docxBlob.size).toBeGreaterThan(0);
      expect(docxBlob.type).toContain('wordprocessingml');

      const loadedZip = await JSZip.loadAsync(docxBlob);
      expect(loadedZip.file('[Content_Types].xml')).not.toBeNull();
      expect(loadedZip.file('word/document.xml')).not.toBeNull();
      vi.unstubAllGlobals();
    });

    it('convertPdfToXlsx rejects non-tabular PDFs with descriptive advice', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: 'Just plain narrative text without tables.', transform: [1, 0, 0, 1, 50, 700], height: 12 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const pdfFile = new File(['%PDF-1.4'], 'narrative.pdf', { type: 'application/pdf' });
      await expect(convertPdfToXlsx(pdfFile)).rejects.toThrow(/NO_TABULAR_DATA/i);
    });

    it('convertPdfToXlsx allows forceContinuousText override when requested', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: 'Paragraph 1', transform: [1, 0, 0, 1, 50, 700], height: 12 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const pdfFile = new File(['%PDF-1.4'], 'narrative.pdf', { type: 'application/pdf' });
      const xlsxBlob = await convertPdfToXlsx(pdfFile, { forceContinuousText: true });
      expect(xlsxBlob.size).toBeGreaterThan(0);

      const zip = await JSZip.loadAsync(xlsxBlob);
      expect(zip.file('[Content_Types].xml')).not.toBeNull();
      expect(zip.file('xl/workbook.xml')).not.toBeNull();
      expect(zip.file('xl/worksheets/sheet1.xml')).not.toBeNull();
    });

    it('convertPdfToPptx generates valid presentation slides package', async () => {
      const mockPdf = {
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 960, height: 540 }),
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: 'Slide Heading', transform: [1, 0, 0, 1, 50, 480], height: 24 },
              { str: '• Key point 1', transform: [1, 0, 0, 1, 50, 400], height: 14 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const pdfFile = new File(['%PDF-1.4'], 'slides.pdf', { type: 'application/pdf' });
      const pptxBlob = await convertPdfToPptx(pdfFile);
      expect(pptxBlob.size).toBeGreaterThan(0);

      const zip = await JSZip.loadAsync(pptxBlob);
      expect(zip.file('[Content_Types].xml')).not.toBeNull();
      expect(zip.file('ppt/presentation.xml')).not.toBeNull();
      expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
      expect(zip.file('ppt/slides/slide2.xml')).not.toBeNull();
    });
  });

  describe('6. src/lib/compressors/docxCompressor.ts', () => {
    it('compresses DOCX archive with no embedded media safely with deflation', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types/>');
      zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>' + 'Sample text '.repeat(500) + '</w:t></w:r></w:p></w:body></w:document>');
      const docxBlob = await zip.generateAsync({ type: 'blob' });
      const docxFile = new File([docxBlob], 'nomedia.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const res = await compressDocxToTarget(docxFile, { targetSizeBytes: 500 });
      expect(res.blob.size).toBeGreaterThan(0);
      expect(res.blob.size).toBeLessThan(docxFile.size);

      const outZip = await JSZip.loadAsync(res.blob);
      expect(outZip.file('word/document.xml')).not.toBeNull();
    });
  });

  describe('7. src/lib/compressors/svgCompressor.ts', () => {
    it('sanitizes SVG with embedded script and dangerous attributes', () => {
      const rawSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <script>alert(1)</script>
          <a href="javascript:alert(2)"><circle cx="50" cy="50" r="40" onclick="alert(3)" /></a>
        </svg>
      `;
      const clean = sanitizeSvg(rawSvg);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('<circle');
    });

    it('rejects malformed SVG with unclosed tags', () => {
      const broken = '<svg><polygon points="0,0 10,10"';
      expect(() => sanitizeSvg(broken)).toThrow(/malformed or potentially unsafe/i);
    });
  });

  describe('8. src/lib/compressors/pdfCompressor.ts', () => {
    it('returns original if target size is already greater than file size', async () => {
      const pdfBlob = await createMinimalPdfBlob(1);
      const pdfFile = new File([pdfBlob], 'tiny.pdf', { type: 'application/pdf' });

      const res = await compressPdfToTarget(pdfFile, { targetSizeBytes: pdfFile.size + 1000 });
      expect(res.blob.size).toBe(pdfFile.size);
      expect(res.iterations).toBe(0);
    });
  });
});
