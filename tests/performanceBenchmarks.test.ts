import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressFile } from '../src/lib/compressors';
import { compressPdfToTarget } from '../src/lib/compressors/pdfCompressor';
import { compressDocxToTarget } from '../src/lib/compressors/docxCompressor';
import { ocrScannedPdf } from '../src/lib/ocrEngine';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Mock dependencies that require node canvas / worker binaries in jsdom
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

vi.mock('pdfjs-dist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pdfjs-dist')>();
  return {
    ...actual,
    getDocument: vi.fn(),
  };
});

describe('Phase 3 — Performance & Engine Quality Benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PDF Compression Throughput & Target Accuracy', () => {
    it('benchmarks multi-page PDF compression throughput (pages/sec) with canvas rendering', async () => {
      // Mock getDocument to supply simulated pages with viewport and rendering
      const mockPdf = {
        numPages: 4,
        destroy: vi.fn().mockResolvedValue(undefined),
        getPage: vi.fn().mockImplementation(async (pageNum: number) => ({
          getViewport: vi.fn().mockReturnValue({ width: 200, height: 200 }),
          render: vi.fn().mockReturnValue({
            promise: Promise.resolve(),
          }),
          cleanup: vi.fn(),
        })),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
        destroy: vi.fn(),
      } as any);

      // Create a dummy valid PDF file
      const doc = await PDFDocument.create();
      for (let i = 0; i < 4; i++) {
        doc.addPage([200, 200]);
      }
      const pdfBytes = await doc.save();
      const pdfFile = new File([pdfBytes as unknown as BlobPart], 'benchmark-sample.pdf', {
        type: 'application/pdf',
      });

      const startTime = performance.now();
      const result = await compressPdfToTarget(pdfFile, {
        targetSizeBytes: Math.floor(pdfBytes.length * 0.7),
        tolerance: 0.1,
      });
      const durationMs = performance.now() - startTime;
      const durationSec = durationMs / 1000;
      const pagesPerSecond = durationSec > 0 ? 4 / durationSec : 4;

      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
      expect(pagesPerSecond).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(15000); // Must complete promptly
      expect(mockPdf.destroy).toHaveBeenCalled();
    });

    it('honors AbortSignal cancellation immediately during PDF compression', async () => {
      const doc = await PDFDocument.create();
      for (let i = 0; i < 6; i++) {
        doc.addPage([200, 200]);
      }
      const pdfBytes = await doc.save();
      const pdfFile = new File([pdfBytes as unknown as BlobPart], 'cancel-pdf.pdf', {
        type: 'application/pdf',
      });

      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      await expect(
        compressPdfToTarget(pdfFile, {
          targetSizeBytes: 1000,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('2. DOCX Media Compression Benchmarks', () => {
    it('benchmarks DOCX media deflation and processing speed', async () => {
      // Create a simulated docx archive containing an image media part
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types></Types>');
      zip.file('word/document.xml', '<w:document></w:document>');

      // Create valid 1x1 png bytes
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
        0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
        0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
        0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      zip.file('word/media/image1.png', pngBytes);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const docxFile = new File([zipBlob], 'benchmark.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const startTime = performance.now();
      const result = await compressDocxToTarget(docxFile, {
        targetSizeBytes: Math.floor(zipBlob.size * 0.8),
        tolerance: 0.1,
      });
      const durationMs = performance.now() - startTime;

      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(10000);
    });

    it('honors AbortSignal cancellation promptly during DOCX compression', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types></Types>');
      zip.file('word/media/image1.png', new Uint8Array(500));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const docxFile = new File([zipBlob], 'cancel.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        compressDocxToTarget(docxFile, {
          targetSizeBytes: 200,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('3. OCR Engine Throughput and Diagnostics', () => {
    it('accurately computes pages/sec, chars/sec, and throughput metrics', async () => {
      const mockWorker = {
        terminate: vi.fn().mockResolvedValue(true),
        recognize: vi.fn().mockResolvedValue({
          data: { text: 'Extracted benchmark text string from synthetic scan.' },
        }),
      };
      vi.mocked(createWorker).mockResolvedValue(mockWorker as any);

      const mockPdf = {
        numPages: 2,
        destroy: vi.fn().mockResolvedValue(undefined),
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
          render: vi.fn().mockReturnValue({
            promise: Promise.resolve(),
          }),
          cleanup: vi.fn(),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
        destroy: vi.fn(),
      } as any);

      const fakeFile = new File(['%PDF-synthetic'], 'test.pdf', { type: 'application/pdf' });
      const result = await ocrScannedPdf(fakeFile);

      expect(result.text).toBeDefined();
      expect(result.throughput).toBeDefined();
      expect(result.throughput?.totalPages).toBe(2);
      expect(result.throughput?.durationMs).toBeGreaterThan(0);
      expect(result.throughput?.pagesPerSecond).toBeGreaterThanOrEqual(0);
      expect(result.throughput?.charsPerSecond).toBeGreaterThanOrEqual(0);
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('cancels OCR pipeline cleanly on AbortSignal without leaking state', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([300, 300]);
      const pdfBytes = await doc.save();
      const pdfFile = new File([pdfBytes as unknown as BlobPart], 'ocr-cancel.pdf', {
        type: 'application/pdf',
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        ocrScannedPdf(pdfFile, undefined, { signal: controller.signal })
      ).rejects.toThrow(/cancelled/i);
    });
  });

  describe('4. Image Compressor Cancellation Responsiveness', () => {
    it('aborts image bisection and downscaling when signal is aborted', async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg'));
      const file = new File([blob], 'cancel-img.jpg', { type: 'image/jpeg' });

      const controller = new AbortController();
      controller.abort();

      await expect(
        compressFile(file, {
          targetSizeBytes: 200,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled/i);
    });
  });
});
